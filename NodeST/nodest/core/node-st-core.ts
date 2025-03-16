import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeminiAdapter } from '../utils/gemini-adapter';
import { OpenRouterAdapter } from '../utils/openrouter-adapter';
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
    GlobalSettings
} from '../../../shared/types';
import { MessagePart } from '@/shared/types';
import { memoryService } from '@/services/memory-service';

export class NodeSTCore {
    private geminiAdapter: GeminiAdapter | null = null;
    private openRouterAdapter: OpenRouterAdapter | null = null;
    private currentContents: ChatMessage[] | null = null;
    private apiKey: string;
    private apiSettings: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'> = {
        apiProvider: 'gemini'
    };

    constructor(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>) {
        this.apiKey = apiKey;
        this.apiSettings = apiSettings || { apiProvider: 'gemini' };
        this.initAdapters(apiKey, apiSettings);
    }

    updateApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        this.geminiAdapter = new GeminiAdapter(apiKey);
        if (this.apiSettings?.apiProvider === 'openrouter' && 
            this.apiSettings.openrouter?.enabled &&
            this.apiSettings.openrouter?.apiKey) {
            this.openRouterAdapter = new OpenRouterAdapter(
                this.apiSettings.openrouter.apiKey,
                this.apiSettings.openrouter.model || 'openai/gpt-3.5-turbo'
            );
        }
    }

    // 添加方法以更新 API 设置
    updateApiSettings(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>): void {
        this.apiKey = apiKey;
        if (apiSettings) {
            this.apiSettings = apiSettings;
            console.log('[NodeSTCore] Updating API settings:', {
                provider: apiSettings.apiProvider,
                openRouterEnabled: apiSettings.openrouter?.enabled,
                model: apiSettings.openrouter?.model || 'none'
            });
        }
        this.initAdapters(apiKey, apiSettings);
    }

    private initAdapters(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>) {
        if (!apiKey) {
            throw new Error("API key is required");
        }

        // Always initialize Gemini as a fallback
        this.geminiAdapter = new GeminiAdapter(apiKey);
        
        // Initialize OpenRouter if enabled and API key is available
        if (apiSettings?.apiProvider === 'openrouter' && 
            apiSettings.openrouter?.enabled && 
            apiSettings.openrouter?.apiKey) {
            console.log('[NodeSTCore] Initializing OpenRouter adapter with:', {
                apiKeyLength: apiSettings.openrouter.apiKey.length,
                model: apiSettings.openrouter.model || 'openai/gpt-3.5-turbo'
            });
            this.openRouterAdapter = new OpenRouterAdapter(
                apiSettings.openrouter.apiKey,
                apiSettings.openrouter.model || 'openai/gpt-3.5-turbo'
            );
        } else {
            // Clear OpenRouter adapter if not enabled
            this.openRouterAdapter = null;
            console.log('[NodeSTCore] OpenRouter not enabled, using Gemini adapter only');
        }

        // Store settings for later use
        if (apiSettings) {
            this.apiSettings = apiSettings;
        }
    }

    // Get the appropriate adapter based on settings
    private getActiveAdapter() {
        // Check if OpenRouter should be used (explicitly check adapter exists)
        if (this.apiSettings?.apiProvider === 'openrouter' && 
            this.apiSettings.openrouter?.enabled && 
            this.openRouterAdapter) {
            console.log('[NodeSTCore] Using OpenRouter adapter with model:', 
                this.apiSettings.openrouter.model || 'default');
            return this.openRouterAdapter;
        }
        
        console.log('[NodeSTCore] Using Gemini adapter');
        return this.geminiAdapter;
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
        chatHistory?: ChatHistoryEntity,  // Add parameter for chatHistory
        options?: { isCradleGeneration?: boolean }
    ): Promise<boolean> {
        try {
            // Log the input parameters fully to verify what we're getting
            console.log('[NodeSTCore] createNewCharacter received parameters:', {
                conversationId,
                roleCardDefined: roleCard !== undefined && roleCard !== null,
                roleCardType: typeof roleCard,
                roleCardKeys: roleCard ? Object.keys(roleCard) : 'undefined roleCard',
                worldBookDefined: worldBook !== undefined && worldBook !== null,
                presetDefined: preset !== undefined && preset !== null,
                authorNoteDefined: !!authorNote,
                chatHistoryDefined: !!chatHistory
            });

            // CRITICAL: Create a defensive copy of roleCard to prevent modification issues
            const safeRoleCard: RoleCardJson = roleCard ? {
                name: roleCard.name || "Unnamed Character",
                first_mes: roleCard.first_mes || "Hello!",
                description: roleCard.description || "No description provided.",
                personality: roleCard.personality || "Friendly",
                scenario: roleCard.scenario || "",
                mes_example: roleCard.mes_example || "",
                background: roleCard.background,
                data: roleCard.data
            } : {
                name: "Unnamed Character",
                first_mes: "Hello! (Default message)",
                description: "This character was created with missing information.",
                personality: "Friendly",
                scenario: "",
                mes_example: ""
            };

            console.log('[NodeSTCore] Using safe roleCard:', {
                name: safeRoleCard.name,
                hasMesExample: !!safeRoleCard.mes_example,
                hasDescription: !!safeRoleCard.description
            });

            // Safety check for worldBook
            const safeWorldBook: WorldBookJson = worldBook || { entries: {} };
            
            // Safety check for preset
            const safePreset: PresetJson = preset || { 
                prompts: [],
                prompt_order: [{ order: [] }]
            };

            // 保存角色相关文件 - use safe versions
            await Promise.all([
                this.saveJson(this.getStorageKey(conversationId, '_role'), safeRoleCard),
                this.saveJson(this.getStorageKey(conversationId, '_world'), safeWorldBook),
                this.saveJson(this.getStorageKey(conversationId, '_preset'), safePreset)
            ]);

            if (authorNote) {
                await this.saveJson(this.getStorageKey(conversationId, '_note'), authorNote);
            }

            // 初始化聊天历史
            if (chatHistory) {
                try {
                    console.log('[NodeSTCore] 初始化聊天历史，使用传入的聊天历史');
                    
                    // Ensure chatHistory has all required fields
                    const historyEntity: ChatHistoryEntity = {
                        name: chatHistory.name || "Chat History",
                        role: chatHistory.role || "system",
                        parts: chatHistory.parts || [],
                        identifier: chatHistory.identifier || "chatHistory"
                    };
                    
                    // If no first_mes in chatHistory but roleCard has it, add it
                    if (safeRoleCard.first_mes && 
                        !historyEntity.parts.some(p => p.is_first_mes)) {
                        
                        console.log('[NodeSTCore] 添加缺失的first_mes到聊天历史');
                        historyEntity.parts.unshift({
                            role: "model",
                            parts: [{ text: safeRoleCard.first_mes }],
                            is_first_mes: true
                        });
                    }
                    
                    // Extract D-entries to ensure they're properly injected
                    const dEntries = CharacterUtils.extractDEntries(
                        safePreset,
                        safeWorldBook,
                        authorNote
                    );
                    
                    // Insert D-entries if there are any
                    if (dEntries.length > 0) {
                        console.log('[NodeSTCore] 向聊天历史注入D类条目，数量:', dEntries.length);
                        const updatedHistory = this.insertDEntriesToHistory(
                            historyEntity,
                            dEntries,
                            ""  // No user message for initial history
                        );
                        
                        // Save the updated history with D-entries
                        await this.saveJson(
                            this.getStorageKey(conversationId, '_history'),
                            updatedHistory
                        );
                        
                        console.log('[NodeSTCore] 聊天历史（含D类条目）初始化成功');
                    } else {
                        // Save the history without D-entries
                        await this.saveJson(
                            this.getStorageKey(conversationId, '_history'),
                            historyEntity
                        );
                        
                        console.log('[NodeSTCore] 聊天历史（无D类条目）初始化成功');
                    }
                } catch (historyError) {
                    console.error('[NodeSTCore] Error initializing chat history:', historyError);
                    // Create default chat history as a fallback
                    this.createDefaultChatHistory(conversationId, safeRoleCard, safePreset, safeWorldBook, authorNote);
                }
            } else {
                console.log('[NodeSTCore] 未提供聊天历史，创建默认聊天历史');
                // Create default chat history when none is provided
                this.createDefaultChatHistory(conversationId, safeRoleCard, safePreset, safeWorldBook, authorNote);
            }

            try {
                // 构建初始框架 - wrap in try/catch to isolate errors
                console.log('[NodeSTCore] Building initial framework...');
                const [rFramework, chatHistory] = CharacterUtils.buildRFramework(
                    safePreset,
                    safeRoleCard,
                    safeWorldBook,
                    { isCradleGeneration: options?.isCradleGeneration || false }
                );
                
                console.log('[NodeSTCore] Framework built successfully:', {
                    rFrameworkLength: rFramework?.length || 0,
                    hasChatHistory: !!chatHistory
                });

                // 确保保存完整的框架内容
                await this.saveJson(
                    this.getStorageKey(conversationId, '_contents'),
                    rFramework
                );

                // Safely extract D-entries
                const dEntries = CharacterUtils.extractDEntries(safePreset, safeWorldBook, authorNote);

                // 初始化聊天历史
                if (chatHistory) {
                    try {
                        // 添加开场白
                        let historyParts: ChatMessage[] = [];
                        
                        if (safeRoleCard.first_mes) {
                            historyParts.push({
                                role: "model",
                                parts: [{ text: safeRoleCard.first_mes }],
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
                        
                        console.log('[NodeSTCore] Chat history initialized successfully');
                    } catch (historyError) {
                        console.error('[NodeSTCore] Error initializing chat history:', historyError);
                        // Continue even if history initialization fails
                    }
                }

                return true;
            } catch (frameworkError) {
                console.error('[NodeSTCore] Error in framework creation:', frameworkError);
                
                // Try a minimal framework as fallback
                try {
                    console.log('[NodeSTCore] Attempting to create minimal framework as fallback...');
                    
                    // Create very simple framework
                    const minimalFramework: ChatMessage[] = [
                        {
                            name: "Character Info",
                            role: "user",
                            parts: [{ text: `Name: ${safeRoleCard.name}\nPersonality: ${safeRoleCard.personality}\nDescription: ${safeRoleCard.description}` }]
                        },
                        {
                            name: "Chat History",
                            role: "system",
                            parts: [{
                                role: "model", 
                                parts: [{ text: safeRoleCard.first_mes || "Hello!" }],
                                is_first_mes: true
                            } as unknown as MessagePart]
                        }
                    ];
                    
                    await this.saveJson(
                        this.getStorageKey(conversationId, '_contents'),
                        minimalFramework
                    );
                    
                    const minimalHistoryEntity: ChatHistoryEntity = {
                        name: "Chat History",
                        role: "system",
                        parts: [{
                            role: "model",
                            parts: [{ text: safeRoleCard.first_mes || "Hello!" }],
                            is_first_mes: true
                        } as ChatMessage],
                        identifier: "chatHistory"
                    };
                    
                    await this.saveJson(
                        this.getStorageKey(conversationId, '_history'),
                        minimalHistoryEntity
                    );
                    
                    console.log('[NodeSTCore] Minimal framework created as fallback');
                    return true;
                } catch (fallbackError) {
                    console.error('[NodeSTCore] Even fallback framework creation failed:', fallbackError);
                    throw frameworkError; // Throw the original error
                }
            }
        } catch (error) {
            console.error('[NodeSTCore] Error creating new character:', error);
            return false;
        }
    }
    
    // Helper method to create a default chat history
    private async createDefaultChatHistory(
        conversationId: string, 
        roleCard: RoleCardJson,
        preset: PresetJson,
        worldBook: WorldBookJson,
        authorNote?: AuthorNoteJson
    ): Promise<void> {
        try {
            console.log('[NodeSTCore] 创建默认聊天历史...');
            
            // Find Chat History identifier from preset if available
            let chatHistoryIdentifier = "chatHistory";
            if (preset && preset.prompt_order && preset.prompt_order[0]) {
                const order = preset.prompt_order[0].order || [];
                const chatHistoryEntry = order.find(entry => 
                    entry.identifier.toLowerCase().includes('chathistory'));
                if (chatHistoryEntry) {
                    chatHistoryIdentifier = chatHistoryEntry.identifier;
                }
            }
            
            // Create messages array with first_mes if available
            const historyParts: ChatMessage[] = [];
            if (roleCard.first_mes) {
                historyParts.push({
                    role: "model",
                    parts: [{ text: roleCard.first_mes }],
                    is_first_mes: true
                });
                console.log('[NodeSTCore] 添加角色第一条消息到默认聊天历史');
            }
            
            const historyEntity: ChatHistoryEntity = {
                name: "Chat History",
                role: "system",
                parts: historyParts,
                identifier: chatHistoryIdentifier
            };
            
            // Extract and insert D-entries (worldbook entries)
            const dEntries = CharacterUtils.extractDEntries(preset, worldBook, authorNote);
            
            if (dEntries.length > 0) {
                console.log('[NodeSTCore] 向默认聊天历史注入D类条目，数量:', dEntries.length);
                const updatedHistory = this.insertDEntriesToHistory(
                    historyEntity,
                    dEntries,
                    ""  // No user message for initial history
                );
                
                await this.saveJson(
                    this.getStorageKey(conversationId, '_history'),
                    updatedHistory
                );
            } else {
                await this.saveJson(
                    this.getStorageKey(conversationId, '_history'),
                    historyEntity
                );
            }
            
            console.log('[NodeSTCore] 默认聊天历史创建完成');
        } catch (error) {
            console.error('[NodeSTCore] Error creating default chat history:', error);
            throw error;
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
        apiKey: string,
        characterId?: string // Add characterId as optional parameter
    ): Promise<string | null> {
        try {
            console.log('[NodeSTCore] Starting continueChat:', {
                conversationId,
                messageLength: userMessage.length,
                apiProvider: this.apiSettings?.apiProvider
            });

            // 确保Adapter已初始化
            if ((!this.geminiAdapter || !this.openRouterAdapter) && apiKey) {
                this.initAdapters(apiKey, this.apiSettings);
            }

            // 获取正确的 adapter
            const adapter = this.getActiveAdapter();
            
            if (!adapter) {
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
            
            // NEW: Check if we need to summarize the chat history
            if (characterId) {
                try {
                    console.log('[NodeSTCore] Checking if chat history needs summarization...');
                    const summarizedHistory = await memoryService.checkAndSummarize(
                        conversationId,
                        characterId,
                        updatedChatHistory,
                        apiKey,
                        this.apiSettings
                    );
                    
                    // Use the potentially summarized history
                    if (summarizedHistory !== updatedChatHistory) {
                        console.log('[NodeSTCore] Chat history was summarized');
                        updatedChatHistory.parts = summarizedHistory.parts;
                    }
                } catch (summaryError) {
                    console.error('[NodeSTCore] Error in chat summarization:', summaryError);
                    // Continue with unsummarized history
                }
            }

            // 处理对话
            console.log('[NodeSTCore] Processing chat...');
            const response = await this.processChat(
                userMessage,
                updatedChatHistory,  
                dEntries,
                conversationId,
                roleCard,
                adapter // 传递正确的适配器
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

        // 1. 先移除所有旧的D类条目，确保不会重复
        const chatMessages = chatHistory.parts.filter(msg => !msg.is_d_entry);
        
        console.log(`[NodeSTCore] Removed ${chatHistory.parts.length - chatMessages.length} old D-entries`);

        // 2. 找到基准消息（最新的用户消息）的索引
        const baseMessageIndex = chatMessages.findIndex(
            msg => msg.role === "user" && msg.parts[0]?.text === userMessage
        );

        if (baseMessageIndex === -1) {
            console.warn('[NodeSTCore] Base message not found in history');
            return {
                ...chatHistory,
                parts: chatMessages // 返回没有D类条目的干净历史
            };
        }

        // 3. 先过滤符合条件的 D 类条目
        const validDEntries = dEntries.filter(entry => 
            this.shouldIncludeDEntry(entry, chatMessages)
        );

        console.log(`[NodeSTCore] Filtered D-entries: ${validDEntries.length} valid out of ${dEntries.length} total`);

        // 对过滤后的条目按注入深度分组，确保只在正确的位置插入
        const position4EntriesByDepth = validDEntries
            .filter(entry => entry.position === 4)
            .reduce((acc, entry) => {
                // 确保注入深度是有效数字，默认为0
                const depth = typeof entry.injection_depth === 'number' ? entry.injection_depth : 0;
                if (!acc[depth]) acc[depth] = [];
                acc[depth].push({
                    ...entry,
                    // 确保明确标记为D类条目，以便下一次更新时可以清除
                    is_d_entry: true
                });
                return acc;
            }, {} as Record<number, ChatMessage[]>);

        // 4. 构建新的消息序列
        const finalMessages: ChatMessage[] = [];
        
        // 4.1 从第一条消息开始，往后遍历插入消息和D类条目
        for (let i = 0; i < chatMessages.length; i++) {
            const msg = chatMessages[i];

            // 只有非基准消息（不是最新用户消息）且在基准消息之前的消息可能有D类条目插入前面
            if (i < baseMessageIndex) {
                // 计算与基准消息的深度差
                const depthFromBase = baseMessageIndex - i;
                // 只有深度大于0时才在消息前插入D类条目（depth=0的条目只在基准消息后插入）
                if (depthFromBase > 0 && position4EntriesByDepth[depthFromBase]) {
                    console.log(`[NodeSTCore] Inserting ${position4EntriesByDepth[depthFromBase].length} D-entries with depth=${depthFromBase} before message at position ${i}`);
                    finalMessages.push(...position4EntriesByDepth[depthFromBase]);
                }
            }

            // 插入当前消息
            finalMessages.push(msg);

            // 如果是基准消息（最新用户消息），在其后插入depth=0的条目
            if (i === baseMessageIndex && position4EntriesByDepth[0]) {
                console.log(`[NodeSTCore] Inserting ${position4EntriesByDepth[0].length} D-entries with depth=0 after base message`);
                finalMessages.push(...position4EntriesByDepth[0]);
            }
        }

        // 5. 处理其他position的条目（从validDEntries中筛选）
        const otherDEntries = validDEntries.filter(entry => entry.position !== 4).map(entry => ({
            ...entry,
            is_d_entry: true // 确保明确标记为D类条目
        }));
        
        for (const entry of otherDEntries) {
            // 对于authorNote相关条目（position=2或3），如果存在作者注释，则在前后插入
            const authorNoteIndex = finalMessages.findIndex(msg => msg.is_author_note);
            if (authorNoteIndex !== -1) {
                if (entry.position === 2) {
                    finalMessages.splice(authorNoteIndex, 0, entry);
                    console.log(`[NodeSTCore] Inserted position=2 entry before author note: ${entry.name}`);
                } else if (entry.position === 3) {
                    finalMessages.splice(authorNoteIndex + 1, 0, entry);
                    console.log(`[NodeSTCore] Inserted position=3 entry after author note: ${entry.name}`);
                }
            } else if (entry.is_author_note) {
                // 如果条目本身是作者注释且历史中尚不存在，添加到末尾
                finalMessages.push(entry);
                console.log(`[NodeSTCore] Added missing author note: ${entry.name}`);
            }
        }

        // 6. 检查最终的消息序列中的D类条目数量，确保正确标记
        const dEntryCount = finalMessages.filter(msg => msg.is_d_entry).length;
        console.log(`[NodeSTCore] Final message sequence has ${dEntryCount} D-entries out of ${finalMessages.length} total messages`);

        // 7. 添加详细的调试日志，显示消息顺序和类型以及D类条目的注入深度
        console.log('[NodeSTCore] Message sequence after D-entry insertion:', 
            finalMessages.map((msg, idx) => ({
                index: idx,
                type: msg.is_d_entry ? 'D-entry' : 'chat',
                role: msg.role,
                depth: msg.is_d_entry ? msg.injection_depth || 0 : 'N/A',
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
        console.log('[NodeSTCore] Updating chat history with new messages and D-entries');
        
        // 1. 保留非D类条目的历史消息
        const cleanHistory = chatHistory.parts.filter(msg => !msg.is_d_entry);
        console.log(`[NodeSTCore] Removed ${chatHistory.parts.length - cleanHistory.length} old D-entries from history`);

        // 2. 添加新的用户消息（如果不存在）
        const userMessageExists = cleanHistory.some(msg => 
            msg.role === "user" && msg.parts[0]?.text === userMessage
        );

        if (!userMessageExists) {
            cleanHistory.push({
                role: "user",
                parts: [{ text: userMessage }]
            });
            console.log('[NodeSTCore] Added new user message to history');
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
                console.log('[NodeSTCore] Added new AI response to history');
            }
        }

        // 4. 使用最新的消息作为基准，重新插入D类条目
        // 确保传递的是干净历史（没有D类条目的）
        const updatedHistory = this.insertDEntriesToHistory(
            {
                ...chatHistory,
                parts: cleanHistory
            },
            dEntries,
            userMessage
        );

        console.log('[NodeSTCore] Updated chat history summary:', {
            originalMessagesCount: chatHistory.parts.length,
            cleanHistoryCount: cleanHistory.length,
            finalMessagesCount: updatedHistory.parts.length,
            dEntriesCount: updatedHistory.parts.filter(msg => msg.is_d_entry).length,
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
        roleCard: RoleCardJson,
        adapter?: GeminiAdapter | OpenRouterAdapter
    ): Promise<string | null> {
        try {
            console.log('[NodeSTCore] Starting processChat with:', {
                userMessage: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''),
                chatHistoryMessagesCount: chatHistory?.parts?.length,
                dEntriesCount: dEntries.length,
                apiProvider: this.apiSettings?.apiProvider
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

            // 查找聊天历史占位符的位置 
            const chatHistoryPlaceholderIndex = contents.findIndex(
                item => item.is_chat_history_placeholder || 
                       (item.identifier === chatHistory.identifier)
            );

            console.log('[NodeSTCore] Found chat history placeholder at index:', chatHistoryPlaceholderIndex);

            // 确保已经清除旧的D类条目并基于最新消息插入新的D类条目
            const historyWithDEntries = this.insertDEntriesToHistory(
                // 确保传入的历史不包含旧的D类条目
                {
                    ...chatHistory,
                    parts: chatHistory.parts.filter(msg => !msg.is_d_entry)
                },
                dEntries,
                userMessage
            );

            // 确保正确插入聊天历史
            if (chatHistoryPlaceholderIndex !== -1) {
                // 将处理后的历史插入到框架中，替换占位符
                const historyMessage: ChatMessage = {
                    name: "Chat History",
                    role: "system",
                    parts: historyWithDEntries.parts,
                    identifier: chatHistory.identifier
                };

                console.log(`[NodeSTCore] Replacing chat history placeholder at index ${chatHistoryPlaceholderIndex} with chat history containing ${historyWithDEntries.parts.length} messages`);
                contents[chatHistoryPlaceholderIndex] = historyMessage;
            } else {
                // 如果找不到占位符，追加到末尾（应该不会发生，但作为安全措施）
                console.warn("[NodeSTCore] Chat history placeholder not found, appending to end");
                contents.push({
                    name: "Chat History",
                    role: "system",
                    parts: historyWithDEntries.parts,
                    identifier: chatHistory.identifier
                });
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
            
            // 打印完整的请求内容以便检查
            console.log('[NodeSTCore] COMPLETE API REQUEST CONTENT:');
            cleanedContents.forEach((msg, i) => {
                console.log(`[Message ${i+1}] Role: ${msg.role}`);
                msg.parts.forEach((part, j) => {
                    console.log(`[Message ${i+1}][Part ${j+1}] Content: "${part.text}"`);
                });
            });

            // 验证是否还有消息要发送
            if (cleanedContents.length === 0) {
                throw new Error('No valid messages to send to Gemini API');
            }

            // 使用传入的适配器或获取活跃适配器
            const activeAdapter = adapter || this.getActiveAdapter();
            if (!activeAdapter) {
                throw new Error("API adapter not initialized");
            }

            // 添加适配器类型日志
            console.log('[NodeSTCore] Using adapter:', {
                type: activeAdapter instanceof OpenRouterAdapter ? 'OpenRouter' : 'Gemini',
                apiProvider: this.apiSettings?.apiProvider
            });

            // 发送到API
            console.log('[NodeSTCore] Sending to API...');
            const response = await activeAdapter.generateContent(cleanedContents);
            console.log('[NodeSTCore] API response received:', {
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
                    
                    // Skip processing memory summary messages for role conversion
                    // but still include them in the API request
                    if (memoryService.isMemorySummary(historyMessage)) {
                        cleanedContents.push({
                            role: "user", // Memory summaries always go as "user" role (system)
                            parts: [{
                                text: historyMessage.parts[0].text
                            }]
                        });
                        continue;
                    }

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
