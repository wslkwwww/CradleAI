import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeminiAdapter } from '../utils/gemini-adapter';
import { CharacterUtils } from '../utils/character-utils';
import { 
    RoleCardJson,
    WorldBookJson,
    PresetJson,
    AuthorNoteJson,
    ChatMessage,
    ChatHistoryEntity,
    GeminiMessage,
    RegexScript,
    Character,
} from '../../../shared/types';

export class NodeSTCore {
    private adapter: GeminiAdapter | null = null;
    private currentContents: ChatMessage[] | null = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.initAdapter(apiKey);
        }
    }

    private initAdapter(apiKey: string) {
        if (!apiKey) {
            throw new Error("API key is required");
        }
        this.adapter = new GeminiAdapter(apiKey);
    }

    private getStorageKey(conversationId: string, suffix: string = ''): string {
        return `nodest_${conversationId}${suffix}`;
    }

    private async saveJson(key: string, data: any): Promise<void> {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`Error saving data for key ${key}:`, error);
            throw error;
        }
    }

    private async loadJson<T>(key: string): Promise<T | null> {
        try {
            const data = await AsyncStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Error loading data for key ${key}:`, error);
            return null;
        }
    }

    private async saveContents(contents: ChatMessage[], sessionId: string): Promise<void> {
        try {
            const cleanedContents = contents.filter(item => item !== null);
            await this.saveJson(this.getStorageKey(sessionId, '_contents'), cleanedContents);
            this.currentContents = cleanedContents;
        } catch (error) {
            console.error('Error saving contents:', error);
            throw error;
        }
    }

    // Character Creation Methods
    async createNewCharacter(
        conversationId: string,
        roleCard: RoleCardJson,
        worldBook: WorldBookJson,
        preset: PresetJson,
        authorNote?: AuthorNoteJson,
    ): Promise<boolean> {
        try {
            console.log('[NodeSTCore] Creating new character with data:', {
                conversationId,
                roleCard: {
                    name: roleCard.name,
                    description: roleCard.description?.substring(0, 100) + '...',
                    personality: roleCard.personality?.substring(0, 100) + '...',
                    scenario: roleCard.scenario?.substring(0, 100) + '...',
                    mes_example: roleCard.mes_example?.substring(0, 100) + '...',
                },
                worldBook: {
                    entriesCount: Object.keys(worldBook.entries).length
                },
                preset: {
                    promptsCount: preset.prompts.length,
                    orderCount: preset.prompt_order[0]?.order.length
                },
                hasAuthorNote: !!authorNote
            });

            // 保存角色相关文件
            await Promise.all([
                this.saveJson(this.getStorageKey(conversationId, '_role'), roleCard),
                this.saveJson(this.getStorageKey(conversationId, '_world'), worldBook),
                this.saveJson(this.getStorageKey(conversationId, '_preset'), preset)
            ]);

            if (authorNote) {
                await this.saveJson(this.getStorageKey(conversationId, '_note'), authorNote);
            }

            // 构建初始框架
            const [rFramework, chatHistory] = CharacterUtils.buildRFramework(preset, roleCard, worldBook);
            
            console.log('[NodeSTCore] Framework built:', {
                rFrameworkLength: rFramework.length,
                hasChatHistory: !!chatHistory,
                chatHistoryParts: chatHistory?.parts?.length
            });

            // 确保保存完整的框架内容
            await this.saveJson(
                this.getStorageKey(conversationId, '_contents'),
                rFramework
            );

            const dEntries = CharacterUtils.extractDEntries(preset, worldBook, authorNote);

            // 初始化聊天历史
            if (chatHistory) {
                // 添加开场白
                let historyParts: ChatMessage[] = [];
                
                if (roleCard.first_mes) {
                    historyParts.push({
                        role: "model",
                        parts: [{ text: roleCard.first_mes }],
                        is_first_mes: true
                    });
                }

                const historyEntity: ChatHistoryEntity = {
                    name: chatHistory.name || "Chat History",
                    role: chatHistory.role || "system",
                    parts: historyParts,
                    identifier: chatHistory.identifier
                };

                // 插入D类条目
                const updatedHistory = this.insertDEntriesToHistory(
                    historyEntity,
                    dEntries,
                    ""
                );
                
                await this.saveJson(
                    this.getStorageKey(conversationId, '_history'),
                    updatedHistory
                );
            }

            return true;
        } catch (error) {
            console.error('Error creating new character:', error);
            return false;
        }
    }

    async updateCharacter(
        conversationId: string,
        roleCard: RoleCardJson,
        worldBook: WorldBookJson,
        preset: PresetJson,
        authorNote?: AuthorNoteJson
    ): Promise<boolean> {
        try {
            // 1. 保存原有聊天历史
            const existingHistory = await this.loadJson<ChatHistoryEntity>(
                this.getStorageKey(conversationId, '_history')
            );

            // 2. 强制重建框架内容
            const [rFramework, _] = CharacterUtils.buildRFramework(
                preset,
                roleCard,  // 使用最新的角色卡数据
                worldBook  // 使用最新的世界书信息
            );

            // 3. 重新提取D类条目
            const dEntries = CharacterUtils.extractDEntries(
                preset,
                worldBook,
                authorNote
            );

            // 4. 立即保存更新的文件和框架内容
            await Promise.all([
                this.saveJson(this.getStorageKey(conversationId, '_role'), roleCard),
                this.saveJson(this.getStorageKey(conversationId, '_world'), worldBook),
                this.saveJson(this.getStorageKey(conversationId, '_preset'), preset),
                this.saveJson(this.getStorageKey(conversationId, '_contents'), rFramework), // 保存新的框架内容
                authorNote ? 
                    this.saveJson(this.getStorageKey(conversationId, '_note'), authorNote) : 
                    Promise.resolve()
            ]);

            // 5. 如果存在原有聊天历史，立即应用新的D类条目
            if (existingHistory) {
                // 清除旧的D类条目
                existingHistory.parts = existingHistory.parts.filter(
                    msg => !msg.is_d_entry
                );

                // 重新插入新的D类条目
                const updatedHistory = this.insertDEntriesToHistory(
                    existingHistory,
                    dEntries,
                    existingHistory.parts[existingHistory.parts.length - 1]?.parts[0]?.text || ''
                );

                // 保存更新后的历史
                await this.saveJson(
                    this.getStorageKey(conversationId, '_history'),
                    updatedHistory
                );

                console.log('[NodeSTCore] Updated character data:', {
                    hasNewFramework: !!rFramework?.length,
                    frameworkSize: rFramework?.length,
                    dEntriesCount: dEntries.length,
                    historyMessagesCount: updatedHistory.parts.length
                });
            }

            return true;
        } catch (error) {
            console.error('[NodeSTCore] Error updating character:', error);
            return false;
        }
    }

    async continueChat(
        conversationId: string,
        userMessage: string,
        apiKey: string
    ): Promise<string | null> {
        try {
            console.log('[NodeSTCore] Starting continueChat:', {
                conversationId,
                messageLength: userMessage.length
            });

            // 确保Adapter已初始化
            if (!this.adapter && apiKey) {
                this.initAdapter(apiKey);
            }

            if (!this.adapter) {
                throw new Error("API adapter not initialized - missing API key");
            }

            // 确保加载最新的角色数据
            const roleCard = await this.loadJson<RoleCardJson>(
                this.getStorageKey(conversationId, '_role')
            );
            const worldBook = await this.loadJson<WorldBookJson>(
                this.getStorageKey(conversationId, '_world')
            );
            const preset = await this.loadJson<PresetJson>(
                this.getStorageKey(conversationId, '_preset')
            );
            const authorNote = await this.loadJson<AuthorNoteJson>(
                this.getStorageKey(conversationId, '_note')
            );
            const chatHistory = await this.loadJson<ChatHistoryEntity>(
                this.getStorageKey(conversationId, '_history')
            );

            console.log('[NodeSTCore] Character data loaded:', {
                hasRoleCard: !!roleCard,
                hasWorldBook: !!worldBook,
                hasPreset: !!preset,
                hasAuthorNote: !!authorNote,
                hasChatHistory: !!chatHistory,
                historyLength: chatHistory?.parts?.length
            });

            // Validate required data
            if (!roleCard || !worldBook || !preset || !chatHistory) {
                const missingData = [];
                if (!roleCard) missingData.push('roleCard');
                if (!worldBook) missingData.push('worldBook');
                if (!preset) missingData.push('preset');
                if (!chatHistory) missingData.push('chatHistory');

                const errorMessage = `Missing required data: ${missingData.join(', ')}`;
                console.error('[NodeSTCore]', errorMessage);
                return null;
            }

            // 重要：强制重新提取D类条目，确保使用最新的worldBook
            const dEntries = CharacterUtils.extractDEntries(
                preset!,
                worldBook!,
                authorNote ?? undefined
            );

            console.log('[NodeSTCore] D-entries for chat:', {
                totalEntries: dEntries.length,
                entriesByType: {
                    position4: dEntries.filter(d => d.position === 4).length,
                    authorNote: dEntries.filter(d => d.is_author_note).length,
                    position2: dEntries.filter(d => d.position === 2).length,
                    position3: dEntries.filter(d => d.position === 3).length
                }
            });

            // 修改：只在这里添加用户消息
            const updatedChatHistory: ChatHistoryEntity = {
                ...chatHistory,
                parts: [
                    ...(chatHistory.parts?.filter(msg => 
                        !msg.is_d_entry && 
                        msg.parts[0]?.text !== userMessage
                    ) || []),
                    {
                        role: "user",
                        parts: [{ text: userMessage }]
                    } as ChatMessage
                ]
            };

            // 处理对话
            console.log('[NodeSTCore] Processing chat...');
            const response = await this.processChat(
                userMessage,
                updatedChatHistory,  
                dEntries,
                conversationId,
                roleCard 
            );

            // 如果收到响应，将AI回复也添加到历史记录
            if (response) {
                // 使用 updateChatHistory 方法
                const updatedHistory = this.updateChatHistory(
                    updatedChatHistory,
                    userMessage,
                    response,
                    dEntries
                );

                // 保存更新后的历史
                await this.saveJson(
                    this.getStorageKey(conversationId, '_history'),
                    updatedHistory
                );

                console.log('[NodeSTCore] Chat history saved:', {
                    totalMessages: updatedHistory.parts.length,
                    lastMessage: response.substring(0, 50) + '...'
                });
            }

            return response;

        } catch (error) {
            console.error('[NodeSTCore] Error in continueChat:', error);
            return null;
        }
    }

    // Helper methods for processing and history management
    private shouldIncludeDEntry(
        entry: ChatMessage,
        messages: ChatMessage[]
    ): boolean {
        // 作者注释始终包含
        if (entry.is_author_note || entry.name === "Author Note") {
            return true;
        }

        // constant = true 的条目始终包含
        if (entry.constant === true) {
            console.log('[NodeSTCore] Including constant entry:', entry.name);
            return true;
        }

        // constant = false 的条目必须通过 key 匹配
        if (entry.constant === false) {
            if (!entry.key || entry.key.length === 0) {
                console.log('[NodeSTCore] Excluding entry - no keys defined:', entry.name);
                return false;
            }

            // 检查是否包含任何关键词
            const allText = messages
                .map(msg => msg.parts?.[0]?.text || '')
                .join(' ')
                .toLowerCase();

            const hasMatchingKey = entry.key.some(key => 
                allText.includes(key.toLowerCase())
            );

            console.log('[NodeSTCore] Key match check for entry:', {
                name: entry.name,
                keys: entry.key,
                matched: hasMatchingKey
            });

            return hasMatchingKey;
        }

        // 如果既不是 constant = true，也不是通过 key 匹配的，则不包含
        return false;
    }

    insertDEntriesToHistory(
        chatHistory: ChatHistoryEntity,
        dEntries: ChatMessage[],
        userMessage: string
    ): ChatHistoryEntity {
        console.log('[NodeSTCore] Starting D-entries insertion:', {
            chatHistoryMessages: chatHistory.parts.length,
            dEntriesCount: dEntries.length,
            baseMessage: userMessage.substring(0, 30)
        });

        // 1. 获取纯聊天消息（排除D类条目）
        const chatMessages = chatHistory.parts.filter(msg => 
            !msg.is_d_entry && (
                msg.role === "user" || 
                msg.role === "model" || 
                msg.is_first_mes
            )
        );

        // 2. 找到基准消息（最新的用户消息）的索引
        const baseMessageIndex = chatMessages.findIndex(
            msg => msg.role === "user" && msg.parts[0]?.text === userMessage
        );

        if (baseMessageIndex === -1) {
            console.warn('[NodeSTCore] Base message not found in history');
            return chatHistory;
        }

        // 3. 先过滤符合条件的 D 类条目
        const validDEntries = dEntries.filter(entry => 
            this.shouldIncludeDEntry(entry, chatMessages)
        );

        // 对过滤后的条目进行分组
        const position4Entries = validDEntries
            .filter(entry => entry.position === 4)
            .reduce((acc, entry) => {
                const depth = entry.injection_depth || 0;
                if (!acc[depth]) acc[depth] = [];
                acc[depth].push(entry);
                return acc;
            }, {} as Record<number, ChatMessage[]>);

        // 4. 构建新的消息序列
        const finalMessages: ChatMessage[] = [];
        
        // 4.1 从基准消息开始，往前遍历插入消息和D类条目
        for (let i = 0; i <= baseMessageIndex; i++) {
            const msg = chatMessages[i];
            const depthFromBase = baseMessageIndex - i;

            // 如果在当前位置有对应深度的D类条目，先插入D类条目
            if (position4Entries[depthFromBase]) {
                console.log(`[NodeSTCore] Inserting D-entries with depth=${depthFromBase} before message at position ${i}`);
                finalMessages.push(...position4Entries[depthFromBase]);
            }

            // 插入当前消息
            finalMessages.push(msg);

            // 如果是基准消息且有depth=0的条目，在其后插入
            if (i === baseMessageIndex && position4Entries[0]) {
                console.log('[NodeSTCore] Inserting depth=0 D-entries after base message');
                finalMessages.push(...position4Entries[0]);
            }
        }

        // 4.2 添加基准消息之后的消息（如果有的话）
        for (let i = baseMessageIndex + 1; i < chatMessages.length; i++) {
            finalMessages.push(chatMessages[i]);
        }

        // 5. 处理其他position的条目（从validDEntries中筛选）
        const otherDEntries = validDEntries.filter(entry => entry.position !== 4);
        for (const entry of otherDEntries) {
            const authorNoteIndex = finalMessages.findIndex(msg => msg.is_author_note);
            if (authorNoteIndex !== -1) {
                if (entry.position === 2) {
                    finalMessages.splice(authorNoteIndex, 0, entry);
                    console.log(`[NodeSTCore] Inserted position=2 entry before author note: ${entry.name}`);
                } else if (entry.position === 3) {
                    finalMessages.splice(authorNoteIndex + 1, 0, entry);
                    console.log(`[NodeSTCore] Inserted position=3 entry after author note: ${entry.name}`);
                }
            }
        }

        // 6. 添加详细的调试日志
        console.log('[NodeSTCore] Message sequence after D-entry insertion:', 
            finalMessages.map((msg, idx) => ({
                index: idx,
                type: msg.is_d_entry ? 'D-entry' : 'chat',
                role: msg.role,
                depth: msg.injection_depth,
                position: msg.position,
                isBaseMessage: msg.parts[0]?.text === userMessage,
                preview: msg.parts[0]?.text?.substring(0, 30)
            }))
        );

        return {
            ...chatHistory,
            parts: finalMessages
        };
    }

    private updateChatHistory(
        chatHistory: ChatHistoryEntity,
        userMessage: string,
        aiResponse: string,
        dEntries: ChatMessage[]
    ): ChatHistoryEntity {
        // 1. 保留非D类条目的历史消息
        const cleanHistory = chatHistory.parts.filter(msg => !msg.is_d_entry);

        // 2. 添加新的用户消息（如果不存在）
        const userMessageExists = cleanHistory.some(msg => 
            msg.role === "user" && msg.parts[0]?.text === userMessage
        );

        if (!userMessageExists) {
            cleanHistory.push({
                role: "user",
                parts: [{ text: userMessage }]
            });
        }

        // 3. 添加AI响应（如果有且不存在）
        if (aiResponse) {
            const aiResponseExists = cleanHistory.some(msg =>
                msg.role === "model" && msg.parts[0]?.text === aiResponse
            );

            if (!aiResponseExists) {
                cleanHistory.push({
                    role: "model",
                    parts: [{ text: aiResponse }]
                });
            }
        }

        // 4. 使用最新的消息作为基准，重新插入D类条目
        const updatedHistory = this.insertDEntriesToHistory(
            {
                ...chatHistory,
                parts: cleanHistory
            },
            dEntries,
            userMessage
        );

        console.log('[NodeSTCore] Updated chat history:', {
            originalMessagesCount: chatHistory.parts.length,
            cleanHistoryCount: cleanHistory.length,
            finalMessagesCount: updatedHistory.parts.length,
            hasUserMessage: userMessageExists,
            hasAiResponse: aiResponse ? true : false
        });

        return updatedHistory;
    }

    async processChat(
        userMessage: string,
        chatHistory: ChatHistoryEntity,
        dEntries: ChatMessage[],
        sessionId: string,
        roleCard: RoleCardJson
    ): Promise<string | null> {
        try {
            console.log('[NodeSTCore] Starting processChat with:', {
                userMessage,
                chatHistoryStatus: {
                    exists: !!chatHistory,
                    messagesCount: chatHistory?.parts?.length,
                    identifier: chatHistory?.identifier
                },
                dEntriesCount: dEntries.length
            });

            // 1. 加载框架内容
            const preset = await this.loadJson<PresetJson>(`nodest_${sessionId}_preset`);
            const worldBook = await this.loadJson<WorldBookJson>(`nodest_${sessionId}_world`);
            if (!preset || !worldBook) {
                throw new Error('Required data not found');
            }

            // 2. 重建框架
            const [rFramework, _] = CharacterUtils.buildRFramework(
                preset,
                roleCard,
                worldBook
            );

            // 3. 将更新后的聊天历史插入框架
            const contents = [...rFramework];
            const promptOrder = preset.prompt_order[0]?.order || [];
            const chatHistoryIndex = promptOrder.findIndex(
                item => item.identifier === chatHistory.identifier
            );

            console.log('[NodeSTCore] Framework and chat history status:', {
                rFrameworkLength: contents.length,
                promptOrderLength: promptOrder.length,
                chatHistoryIndex,
                chatHistoryIdentifier: chatHistory.identifier
            });

            // 确保正确插入聊天历史
            if (chatHistoryIndex !== -1) {
                const historyWithDEntries = this.insertDEntriesToHistory(
                    chatHistory,
                    dEntries,
                    userMessage
                );

                // 将处理后的历史插入到框架中
                const historyMessage: ChatMessage = {
                    name: "Chat History",
                    role: "system",
                    parts: historyWithDEntries.parts,
                    identifier: chatHistory.identifier
                };

                contents.splice(chatHistoryIndex, 1, historyMessage);
            }

            // 清理内容用于Gemini
            const cleanedContents = this.cleanContentsForGemini(
                contents,
                userMessage,
                roleCard.name,
                "",
                roleCard
            );

            // 添加最终请求内容的完整日志
            console.log('[NodeSTCore] Final Gemini request structure:', {
                totalMessages: cleanedContents.length,
                messageSequence: cleanedContents.map(msg => ({
                    role: msg.role,
                    type: msg.is_d_entry ? 'D-entry' : 'chat',
                    depth: msg.injection_depth,
                    preview: msg.parts[0]?.text?.substring(0, 30)
                }))
            });

            // 验证是否还有消息要发送
            if (cleanedContents.length === 0) {
                throw new Error('No valid messages to send to Gemini API');
            }

            // 发送到Gemini
            console.log('[NodeSTCore] Sending to Gemini...');
            if (!this.adapter) {
                throw new Error("API adapter not initialized");
            }
            const response = await this.adapter.generateContent(cleanedContents);
            console.log('[NodeSTCore] Gemini response received:', {
                hasResponse: !!response,
                responseLength: response?.length || 0
            });

            // 保存更新后的历史
            if (response) {
                console.log('[NodeSTCore] Saving updated history...');
                const updatedContents = contents ? contents.map(item => {
                    if (item.name === "Chat History") {
                        const messages = item.parts || [];
                        return {
                            name: "Chat History",
                            role: "system",
                            parts: messages,
                            identifier: "chatHistory"
                        } as ChatMessage;
                    }
                    return item;
                }) : [chatHistory as unknown as ChatMessage];
                await this.saveContents(updatedContents, sessionId);
                console.log('[NodeSTCore] History saved successfully');
            }

            return response;
        } catch (error) {
            console.error('[NodeSTCore] Error in processChat:', error);
            return null;
        }
    }

    // Text processing utilities
    private cleanContentsForGemini(
        contents: ChatMessage[],
        userMessage: string = "",
        charName: string = "",
        userName: string = "",
        roleCard?: RoleCardJson
    ): GeminiMessage[] {
        console.log('[NodeSTCore] Starting cleanContentsForGemini:', {
            totalContents: contents.length
        });

        const cleanedContents: GeminiMessage[] = [];

        for (const content of contents) {
            if (!content || !content.parts?.[0]) continue;

            // 如果是聊天历史实体
            if (content.name === "Chat History") {
                // 确保 parts 存在且为数组
                const historyParts = Array.isArray(content.parts) ? content.parts : [];
                
                // 遍历历史消息
                for (const historyMessage of historyParts) {
                    if (!historyMessage.parts?.[0]?.text) continue;

                    // 转换角色映射
                    const role = (() => {
                        switch (historyMessage.role) {
                            case "assistant":
                            case "model":
                                return "model";
                            case "system":
                            case "user":
                            default:
                                return "user";
                        }
                    })();

                    const geminiMessage: GeminiMessage = {
                        role,
                        parts: [{
                            text: this.replacePlaceholders(
                                historyMessage.parts[0].text,
                                userMessage,
                                charName,
                                userName,
                                roleCard
                            )
                        }]
                    };

                    cleanedContents.push(geminiMessage);
                }
            } else {
                // 处理常规消息
                const geminiMessage: GeminiMessage = {
                    role: content.role === "assistant" ? "model" : 
                          content.role === "system" ? "user" : 
                          content.role as "user" | "model",
                    parts: content.parts.map(part => ({
                        text: this.replacePlaceholders(
                            part.text || "", 
                            userMessage, 
                            charName, 
                            userName, 
                            roleCard
                        )
                    }))
                };

                cleanedContents.push(geminiMessage);
            }
        }

        // 过滤掉空消息
        const filteredContents = cleanedContents.filter(msg => {
            const text = msg.parts[0]?.text;
            return text && text.trim() !== '';
        });

        console.log('[NodeSTCore] Final cleaned contents:', {
            originalCount: cleanedContents.length,
            filteredCount: filteredContents.length
        });

        return filteredContents;
    }

    private replacePlaceholders(
        text: string,
        userMessage: string,
        charName: string,
        userName: string,
        roleCard?: RoleCardJson
    ): string {
        if (typeof text !== 'string') {
            return text;
        }

        try {
            // 基础变量替换
            text = text
                .replace(/{{lastMessage}}/g, userMessage)
                .replace(/{{char}}/g, charName)
                .replace(/{{user}}/g, userName);

            // 应用正则替换规则
            if (roleCard?.data?.extensions?.regex_scripts) {
                text = this.applyRegexScripts(
                    text,
                    roleCard.data.extensions.regex_scripts
                );
            }

            return text;
        } catch (e) {
            console.warn('Text processing warning:', e);
            return text;
        }
    }

    private applyRegexScripts(text: string, regexScripts: RegexScript[]): string {
        if (typeof text !== 'string') {
            return text;
        }

        try {
            for (const script of regexScripts) {
                try {
                    let findRegex = script.findRegex;
                    const replaceString = script.replaceString;

                    if (!findRegex || !replaceString) {
                        continue;
                    }

                    // 去除正则表达式字符串的首尾斜杠
                    if (findRegex.startsWith('/') && findRegex.endsWith('/')) {
                        findRegex = findRegex.slice(1, -1);
                    }

                    // 构建正则表达式标志
                    const flags = script.flags || '';
                    const regex = new RegExp(findRegex, flags);

                    // 执行替换
                    text = text.replace(regex, replaceString);

                } catch (e) {
                    console.warn(
                        `Regex script warning - Script ${script.scriptName}:`,
                        e
                    );
                    continue;
                }
            }
            return text;
        } catch (e) {
            console.error('Error in regex replacement:', e);
            return text;
        }
    }
}
