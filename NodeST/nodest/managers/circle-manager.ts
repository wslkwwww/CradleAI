import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character } from '../../../shared/types';
import { CircleRFramework, CirclePostOptions, CircleResponse } from '../types/circle-types';
import { GeminiAdapter } from '../utils/gemini-adapter';
import { MessageBoxItem, RelationshipMapData } from '../../../shared/types/relationship-types';
import { PromptBuilderService, DEntry, RFrameworkEntry } from '../services/prompt-builder-service';

export class CircleManager {
    private geminiAdapter: GeminiAdapter | null = null;
    
    constructor() {}

    private getStorageKey(conversationId: string, suffix: string = ''): string {
        return `nodest_${conversationId}${suffix}`;
    }

    private async saveJson(key: string, data: any): Promise<void> {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`保存数据失败，键名: ${key}:`, error);
            throw error;
        }
    }

    private async loadJson<T>(key: string): Promise<T | null> {
        try {
            const data = await AsyncStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`加载数据失败，键名: ${key}:`, error);
            return null;
        }
    }

    // 实现真实的API调用
    private async getChatResponse(prompt: string, apiKey?: string): Promise<string> {
        try {
            console.log('【朋友圈】发送到LLM的完整提示:', prompt.substring(0, 200) + '...');
            
            // 如果没有提供API key或adapter未初始化，则使用模拟数据
            if (!apiKey && !this.geminiAdapter) {
                console.log('【朋友圈】缺少API key，使用模拟数据');
                return this.getMockResponse();
            }
            
            // 初始化或获取adapter
            if (!this.geminiAdapter && apiKey) {
                this.geminiAdapter = new GeminiAdapter(apiKey);
            }
            
            // 创建消息内容
            const message = {
                role: "user",
                parts: [{ text: prompt }]
            };
            
            // 调用API
            console.log('【朋友圈】调用Gemini API...');
            const response = await this.geminiAdapter!.generateContent([message]);
            console.log('【朋友圈】Gemini API返回原始响应:', response.substring(0, 200) + '...');
            
            return response;
        } catch (error) {
            console.error('【朋友圈】获取AI回复失败:', error);
            console.log('【朋友圈】API调用失败，使用备用模拟数据');
            // 出错时使用模拟数据作为备选方案
            return this.getMockResponse();
        }
    }
    
    // 获取模拟响应作为备选方案
    private getMockResponse(): string {
        const mockResponseTypes = [
            // 普通JSON响应
            JSON.stringify({
                action: {
                    like: Math.random() > 0.3,
                    comment: Math.random() > 0.4 ? "看到这些小狗真可爱，我也很喜欢小动物呢！" : undefined
                },
                emotion: {
                    type: "positive",
                    intensity: 0.8
                }
            }),
            // 带前缀的JSON响应
            `好的，这是我的朋友圈回应：\n${JSON.stringify({
                action: {
                    like: true,
                    comment: "小狗狗好可爱！我最喜欢小动物了。"
                },
                emotion: {
                    type: "positive",
                    intensity: 0.9
                }
            })}`,
            // 带解释和后缀的JSON响应
            `我的角色会喜欢这个帖子。\n\n${JSON.stringify({
                action: {
                    like: true,
                    comment: "我也喜欢狗狗！它们总是那么忠诚可爱~"
                },
                emotion: {
                    type: "positive",
                    intensity: 0.7
                }
            })}\n\n希望这样的回应符合预期。`
        ];
        
        // 随机选择一种响应类型
        return mockResponseTypes[Math.floor(Math.random() * mockResponseTypes.length)];
    }

    // 添加 updateCircleMemory 方法
    private async updateCircleMemory(
        responderId: string,  // 改为responderId
        options: CirclePostOptions,
        response: CircleResponse
    ): Promise<void> {
        try {
            const key = this.getStorageKey(responderId, '_circle_memory');
            const existingMemory = await this.loadJson<any[]>(key) || [];

            const newMemory = {
                role: "system",
                parts: [{
                    text: `${options.type}: ${options.content.text}\nResponse: ${JSON.stringify(response)}`
                }],
                timestamp: Date.now()
            };

            existingMemory.push(newMemory);

            // 保存更新后的记忆
            await this.saveJson(key, existingMemory);
            console.log(`【朋友圈】更新了角色 ${responderId} 的朋友圈记忆`);
        } catch (error) {
            console.error('【朋友圈】更新角色记忆失败:', error);
            throw new Error('保存角色社交互动记忆失败');
        }
    }

    // CircleManager specific methods
    async circleInit(character: Character): Promise<boolean> {
        try {
            console.log(`【朋友圈】开始初始化角色 ${character.name} 的朋友圈框架`);
            
            // 从角色的 role_card 中获取正确的描述和性格
            const roleCard = await this.loadJson<any>(
                this.getStorageKey(character.id, '_role')
            );

            if (!roleCard) {
                console.error(`【朋友圈】未找到角色 ${character.name} 的角色卡`);
                throw new Error(`未找到角色 ${character.name} 的角色卡`);
            }

            console.log(`【朋友圈】成功加载角色 ${character.name} 的角色卡`);

            // 构建朋友圈场景的R框架
            const circleRFramework: CircleRFramework = {
                base: {
                    charDescription: roleCard.description || '',
                    charPersonality: roleCard.personality || ''
                },
                circle: {
                    scenePrompt: `你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你的评论内容（如不评论则省略此字段）"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`,
                    responseFormat: {
                        action: {
                            like: false,
                            comment: undefined
                        },
                        emotion: {
                            type: "neutral",
                            intensity: 0.5
                        }
                    }
                }
            };

            // 保存R框架到storage
            await this.saveJson(
                this.getStorageKey(character.id, '_circle_framework'),
                circleRFramework
            );
            
            // 保存角色数据以便后续处理
            await this.saveJson(
                this.getStorageKey(character.id, '_character_data'),
                character
            );
            
            console.log(`【朋友圈】成功为角色 ${character.name} 初始化朋友圈框架`);

            return true;
        } catch (error) {
            console.error('【朋友圈】初始化朋友圈失败:', error);
            return false;
        }
    }

    // 更新circlePost方法，支持apiKey参数和多种交互类型
    async circlePost(options: CirclePostOptions, apiKey?: string): Promise<CircleResponse> {
        try {
            console.log(`【朋友圈】处理互动，类型: ${options.type}，作者ID: ${options.content.authorId}，响应者ID: ${options.responderId}`);
            
            // 1. 获取当前R框架 (使用responderId而非authorId)
            const framework = await this.loadJson<CircleRFramework>(
                this.getStorageKey(options.responderId, '_circle_framework')
            );

            if (!framework) {
                console.error(`【朋友圈】未找到角色框架，响应者ID: ${options.responderId}`);
                throw new Error('朋友圈框架未初始化');
            }

            // 2. 获取角色数据以进行关系处理
            const characterData = await this.loadJson<Character>(
                this.getStorageKey(options.responderId, '_character_data')
            );
            
            if (!characterData) {
                console.error(`【朋友圈】未找到角色数据，响应者ID: ${options.responderId}`);
                throw new Error('角色数据未找到');
            }
            
            // 3. 构建R框架条目
            const rFramework: RFrameworkEntry[] = [
              // 角色描述
              PromptBuilderService.createRFrameworkEntry({
                name: "Character Description",
                content: framework.base.charDescription,
                identifier: "charDescription"
              }),
              // 角色性格
              PromptBuilderService.createRFrameworkEntry({
                name: "Character Personality",
                content: framework.base.charPersonality,
                identifier: "charPersonality"
              }),
              // 聊天历史容器
              PromptBuilderService.createChatHistoryContainer("circleHistory"),
              // 场景提示词
              PromptBuilderService.createRFrameworkEntry({
                name: "Scene Prompt",
                content: this.getScenePromptByType(framework, options).circle.scenePrompt,
                identifier: "scenePrompt"
              })
            ];
            
            // 4. 构建D类条目
            const dEntries: DEntry[] = [];
            
            // 消息盒子D类条目
            if (characterData.messageBox?.length) {
              const messagesText = this.formatMessageBoxForPrompt(characterData.messageBox);
              dEntries.push(PromptBuilderService.createDEntry({
                name: "Message Box",
                content: `【消息盒子】\n以下是你最近收到的互动消息:\n${messagesText}`,
                depth: 1,
                constant: true
              }));
            }
            
            // 关系图谱D类条目
            if (characterData.relationshipMap?.relationships) {
              const relationshipsText = this.formatRelationshipMapForPrompt(characterData.relationshipMap);
              dEntries.push(PromptBuilderService.createDEntry({
                name: "Relationship Map",
                content: `【关系图谱数据】\n你与其他角色的当前关系:\n${relationshipsText}`,
                depth: 1,
                constant: true
              }));
            }
            
            // 状态检视提示词D类条目
            let relationshipReviewPrompt = '';
            if (characterData.relationshipEnabled && characterData.messageBox) {
              const unreadMessages = characterData.messageBox.filter(msg => !msg.read);
              if (unreadMessages.length > 0) {
                relationshipReviewPrompt = await this.generateRelationshipStateReviewPrompt(characterData);
                if (relationshipReviewPrompt) {
                  dEntries.push(PromptBuilderService.createDEntry({
                    name: "Relationship State Review",
                    content: relationshipReviewPrompt,
                    depth: 1,
                    constant: true
                  }));
                }
              }
            }
            
            // 5. 构建用户消息 (内容和上下文)
            const userMessage = `【内容】${options.content.text}\n【上下文】${options.content.context || ''}`;
            
            // 6. 使用PromptBuilderService构建最终请求
            const messages = PromptBuilderService.buildPrompt({
              rFramework,
              dEntries,
              userMessage
            });
            
            // 7. 转换为文本格式并发送请求
            const prompt = PromptBuilderService.messagesToText(messages);
            const response = await this.getChatResponse(prompt, apiKey);
            
            // 8. 解析响应
            const circleResponse = this.parseCircleResponse(response);
            
            // 9. 如果包含关系状态检查，则解析关系更新
            if (relationshipReviewPrompt && characterData && circleResponse.success) {
              const relationshipUpdates = this.parseRelationshipReviewResponse(response);
              
              // 存储关系更新以便稍后应用
              if (relationshipUpdates.length > 0) {
                circleResponse.relationshipUpdates = relationshipUpdates;
              }
            }

            // 10. 更新记忆
            await this.updateCircleMemory(
              options.responderId,
              options,
              circleResponse
            );

            console.log(`【朋友圈】成功处理互动，结果:`, circleResponse);
            return circleResponse;
        } catch (error) {
            console.error('【朋友圈】处理朋友圈互动失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            };
        }
    }

    // 新增：根据互动类型获取适当的场景提示词
    private getScenePromptByType(framework: CircleRFramework, options: CirclePostOptions): CircleRFramework {
        const updatedFramework = { ...framework };
        let scenePrompt = '';

        // 准备要显示的内容
        const contentText = options.content.text.length > 100 ? 
            `${options.content.text.substring(0, 100)}...` : 
            options.content.text;

        switch (options.type) {
            case 'newPost':
                scenePrompt = `作为一个角色，你正在创建一条新的朋友圈动态。以下是准备发布的内容：

【内容】${contentText}
【上下文】${options.content.context || '无'}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false，对自己发的内容通常为false）
- 提供一条你想发布的内容（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": false,
    "comment": "你想发布的朋友圈内容"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`;
                break;
                
            case 'replyToPost':
                scenePrompt = `你正在浏览以下朋友圈动态：

【作者】${options.content.authorName || '某人'}
【内容】${contentText}
【上下文】${options.content.context || '无'}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你的评论内容（如不评论则省略此字段）"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`;
                break;
                
            case 'replyToComment':
                scenePrompt = `你看到以下朋友圈评论：

【原帖内容】${options.content.context || '无'}
【评论内容】${contentText}
【评论作者】${options.content.authorName || '某人'}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否回复此评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你对评论的回复内容（如不回复则省略此字段）"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`;
                break;
                
            default:
                scenePrompt = framework.circle.scenePrompt;
        }

        // 更新场景提示词
        updatedFramework.circle.scenePrompt = scenePrompt;
        return updatedFramework;
    }

    private buildCirclePrompt(
        framework: CircleRFramework, 
        options: CirclePostOptions,
        relationshipReviewPrompt: string = ''
    ): string {
        let prompt = `【角色描述】${framework.base.charDescription}\n
【角色性格】${framework.base.charPersonality}\n`;

        // 添加关系状态检查提示词（如果有）
        if (relationshipReviewPrompt) {
            prompt += `\n${relationshipReviewPrompt}\n`;
        }

        prompt += `【当前场景】${framework.circle.scenePrompt}\n
【内容】${options.content.text}\n
【上下文】${options.content.context || ''}\n
请以JSON格式回复，响应格式如下:
${JSON.stringify(framework.circle.responseFormat, null, 2)}`;

        return prompt;
    }

    /**
     * 改进的响应解析方法，从文本中提取并解析JSON
     */
    private parseCircleResponse(response: string): CircleResponse {
        try {
            console.log('【朋友圈】开始解析响应');
            
            const extractedJson = this.extractJson(response);
            if (!extractedJson) {
                throw new Error('未能从AI回复中提取有效数据');
            }

            console.log('【朋友圈】成功提取JSON:', extractedJson);
            
            return {
                success: true,
                action: {
                    like: Boolean(extractedJson.action.like),
                    comment: extractedJson.action.comment
                }
            };
        } catch (error) {
            console.error('【朋友圈】解析响应失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '解析AI回复失败'
            };
        }
    }
    
    /**
     * 从文本中提取JSON对象
     */
    private extractJson(text: string): any {
        try {
            // 第1步：预处理文本
            let cleanText = this.cleanResponseText(text);
            
            // 第2步：直接尝试解析清理后的文本
            try {
                const directParsed = JSON.parse(cleanText);
                if (this.validateJsonStructure(directParsed)) {
                    return directParsed;
                }
            } catch (e) {
                // 直接解析失败，继续尝试其他方法
            }
            
            // 第3步：使用正则提取JSON对象
            const jsonPattern = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g;
            const matches = cleanText.match(jsonPattern);
            
            if (!matches || matches.length === 0) {
                console.error('【朋友圈】未找到JSON格式内容');
                return null;
            }
            
            // 第4步：尝试解析每个匹配的JSON对象
            for (const match of matches) {
                try {
                    const parsed = JSON.parse(match);
                    if (this.validateJsonStructure(parsed)) {
                        return parsed;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            console.error('【朋友圈】所有提取的JSON都未通过验证');
            return null;
            
        } catch (error) {
            console.error('【朋友圈】提取JSON时出错:', error);
            return null;
        }
    }

    /**
     * 清理响应文本，移除无关内容
     */
    private cleanResponseText(text: string): string {
        // 1. 移除所有```json和```标记
        text = text.replace(/```json\n?|\n?```/g, '');
        
        // 2. 移除常见的AI礼貌用语前缀
        const prefixesToRemove = [
            /^好的，(这是)?我的朋友圈回应：\s*/i,
            /^好的，(我)?(明白|理解)了。\s*/i,
            /^请给我看朋友圈(的)?动态内容，.*?(?=\{)/i,
            /^作为[^{]*?(?=\{)/i,
            /^我将(会)?根据[^{]*?(?=\{)/i,
            /^以下是[^{]*?(?=\{)/i
        ];
        
        for (const prefix of prefixesToRemove) {
            text = text.replace(prefix, '');
        }
        
        // 3. 移除末尾的注释和说明
        const suffixesToRemove = [
            /\n*希望[^}]*$/,
            /\n*这样的回[复应][^}]*$/,
            /\n*[请让]?我知道[^}]*$/
        ];
        
        for (const suffix of prefixesToRemove) {
            text = text.replace(suffix, '');
        }
        
        // 4. 移除多余的空白字符
        text = text.trim().replace(/\s+/g, ' ');
        
        return text;
    }

    /**
     * 验证JSON结构是否符合预期
     */
    private validateJsonStructure(json: any): boolean {
        // 1. 必须是对象
        if (!json || typeof json !== 'object') {
            return false;
        }

        // 2. 必须包含action字段
        if (!json.action || typeof json.action !== 'object') {
            return false;
        }

        // 3. action必须包含like字段
        if (typeof json.action.like !== 'boolean') {
            return false;
        }

        // 4. 如果有comment字段，必须是字符串
        if ('comment' in json.action && typeof json.action.comment !== 'string') {
            return false;
        }

        // 5. 验证emotion字段（可选）
        if (json.emotion) {
            if (typeof json.emotion !== 'object' ||
                !['positive', 'neutral', 'negative'].includes(json.emotion.type) ||
                typeof json.emotion.intensity !== 'number' ||
                json.emotion.intensity < 0 ||
                json.emotion.intensity > 1) {
                return false;
            }
        }

        return true;
    }

    // 新增：生成关系状态检查提示词的方法
    async generateRelationshipStateReviewPrompt(character: Character): Promise<string> {
        if (!character.relationshipMap || !character.messageBox) {
            return '';
        }

        // 仅获取未读消息
        const unreadMessages = character.messageBox.filter((msg: any) => !msg.read);
        if (unreadMessages.length === 0) {
            return '';
        }

        // 创建关系检查提示词
        const prompt = `
【关系状态检查】
以下是你最近收到的互动消息，请分析这些消息，并针对每个互动者更新你对他们的印象和关系强度。

消息列表:
${unreadMessages.map((msg: any, idx: number) => 
  `${idx + 1}. ${msg.senderName}${msg.type === 'like' ? '点赞了你的内容' : 
    msg.type === 'comment' ? '评论了你的内容' : 
    msg.type === 'reply' ? '回复了你的评论' : '给你发送了消息'}: "${msg.content}"`
).join('\n')}

你当前的关系图谱:
${Object.entries(character.relationshipMap.relationships).map(([id, rel]: [string, any]) => 
  `- ${id}: 关系类型=${rel.type}, 关系强度=${rel.strength}`
).join('\n')}

请分析以上消息，根据内容的情感色彩和互动频率，更新你与每个互动者的关系强度(-100到100，负数表示负面关系)。
如果某人的关系强度超过特定阈值，也请考虑更新关系类型(如从陌生人变为熟人或朋友)。

请以以下格式回复:
关系更新:
[互动者ID]-[关系强度变化]-[可选:新关系类型]
[互动者ID]-[关系强度变化]-[可选:新关系类型]
...

例如:
关系更新:
user123-+5
user456--3-rival
user789-+10-friend
`;

        return prompt;
    }

    // 新增：处理关系检查结果的方法
    parseRelationshipReviewResponse(response: string): { 
        targetId: string, strengthDelta: number, newType?: string 
    }[] {
        try {
            const results: { targetId: string, strengthDelta: number, newType?: string }[] = [];
            
            // 提取关系更新部分
            const updateSection = response.match(/关系更新:([\s\S]*?)(?:\n\n|$)/);
            if (!updateSection || !updateSection[1]) return results;
            
            // 解析每一行
            const lines = updateSection[1].trim().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                
                // 尝试匹配模式：id-delta-type
                const match = line.match(/([^-]+)-([+-]\d+)(?:-([a-z_]+))?/);
                if (match) {
                    const [, targetId, deltaStr, newType] = match;
                    const strengthDelta = parseInt(deltaStr);
                    
                    if (!isNaN(strengthDelta)) {
                        results.push({
                            targetId: targetId.trim(),
                            strengthDelta,
                            newType: newType ? newType.trim() : undefined
                        });
                    }
                }
            }
            
            return results;
        } catch (error) {
            console.error('Error parsing relationship review response:', error);
            return [];
        }
    }

    // 修正1: 创建一个方法来将消息盒子转换为D类条目
    private createChatHistoryDEntry(character: Character): any {
        if (!character?.messageBox || character.messageBox.length === 0) {
            return null;
        }
        
        // 将消息盒子格式化为适合AI理解的文本
        const messagesText = character.messageBox
            .slice(0, 15) // 限制显示最近15条消息
            .sort((a, b) => b.timestamp - a.timestamp) // 从新到旧排序
            .map(msg => {
                return `- 来自: ${msg.senderName} (${msg.type})
        内容: ${msg.content}
        时间: ${new Date(msg.timestamp).toLocaleString()}
        ${msg.contextContent ? `上下文: ${msg.contextContent}` : ''}
        ---`;
            }).join('\n');
            
        // 创建D类条目
        return {
            name: "Chat History",
            parts: [{ text: `【消息盒子】\n以下是你最近收到的互动消息:\n${messagesText}` }],
            role: "user",
            is_d_entry: true,
            position: 4,        // position=4表示这是一个动态深度条目
            injection_depth: 1, // 深度1，插入在用户消息之前
            constant: true      // 始终包含此条目
        };
    }

    // 修正2: 创建一个方法来将关系图谱转换为D类条目
    private createRelationshipMapDEntry(character: Character): any {
        if (!character?.relationshipMap?.relationships) {
            return null;
        }
        
        // 格式化关系图谱数据
        const relationshipsText = Object.entries(character.relationshipMap.relationships)
            .map(([id, rel]: [string, any]) => {
                return `- 角色ID: ${id}
        关系类型: ${rel.type}
        关系强度: ${rel.strength}
        描述: ${rel.description}
        最后更新: ${new Date(rel.lastUpdated).toLocaleString()}
        互动次数: ${rel.interactions || 0}`;
            }).join('\n\n');
        
        // 创建D类条目
        return {
            name: "Relationship Map",
            parts: [{ text: `【关系图谱数据】\n你与其他角色的当前关系:\n${relationshipsText}` }],
            role: "user",
            is_d_entry: true,
            position: 4,        // position=4表示这是一个动态深度条目
            injection_depth: 1, // 深度1，插入在用户消息之前
            constant: true      // 始终包含此条目
        };
    }

    // 修正3: 创建一个方法来将状态检视提示词转换为D类条目
    private createRelationshipReviewDEntry(reviewPrompt: string): any {
        if (!reviewPrompt) {
            return null;
        }
        
        // 创建D类条目
        return {
            name: "Relationship State Review",
            parts: [{ text: reviewPrompt }],
            role: "user",
            is_d_entry: true,
            position: 4,        // position=4表示这是一个动态深度条目
            injection_depth: 1, // 深度1，插入在用户消息之前
            constant: true      // 始终包含此条目
        };
    }

    // 修正4: 更新buildCirclePrompt方法来正确处理D类条目
    private buildCirclePromptWithDEntries(
        framework: CircleRFramework,
        options: CirclePostOptions,
        character: Character,
        relationshipReviewPrompt: string = ''
    ): any[] {
        // 构建R框架作为基础
        const messages = [
            {
                role: "user",
                parts: [{ text: `【角色描述】${framework.base.charDescription}` }]
            },
            {
                role: "user",
                parts: [{ text: `【角色性格】${framework.base.charPersonality}` }]
            }
        ];
        
        // 添加D类条目: 消息盒子
        const chatHistoryEntry = this.createChatHistoryDEntry(character);
        if (chatHistoryEntry) {
            messages.push(chatHistoryEntry);
        }
        
        // 添加D类条目: 关系图谱
        const relationshipMapEntry = this.createRelationshipMapDEntry(character);
        if (relationshipMapEntry) {
            messages.push(relationshipMapEntry);
        }
        
        // 添加D类条目: 状态检视提示词
        if (relationshipReviewPrompt) {
            const reviewEntry = this.createRelationshipReviewDEntry(relationshipReviewPrompt);
            if (reviewEntry) {
                messages.push(reviewEntry);
            }
        }
        
        // 添加场景提示词作为主要用户消息
        messages.push({
            role: "user",
            parts: [{
                text: `【当前场景】${framework.circle.scenePrompt}\n
    【内容】${options.content.text}\n
    【上下文】${options.content.context || ''}\n
    请以JSON格式回复，响应格式如下:
    ${JSON.stringify(framework.circle.responseFormat, null, 2)}`
            }]
        });
        
        return messages;
    }

    // 辅助方法: 格式化消息为Gemini请求文本
    private formatMessagesForGeminiRequest(messages: any[]): string {
        return messages.map(msg => {
            if (msg.parts && msg.parts[0] && msg.parts[0].text) {
                return msg.parts[0].text;
            }
            return '';
        }).join('\n\n');
    }

    // 格式化消息盒子内容
    private formatMessageBoxForPrompt(messageBox: MessageBoxItem[]): string {
        return messageBox
          .slice(0, 15) // 限制显示最近15条消息
          .sort((a, b) => b.timestamp - a.timestamp) // 从新到旧排序
          .map(msg => {
            return `- 来自: ${msg.senderName} (${msg.type})
    内容: ${msg.content}
    时间: ${new Date(msg.timestamp).toLocaleString()}
    ${msg.contextContent ? `上下文: ${msg.contextContent}` : ''}
    ---`;
          }).join('\n');
    }

    // 格式化关系图谱内容
    private formatRelationshipMapForPrompt(relationshipMap: RelationshipMapData): string {
        return Object.entries(relationshipMap.relationships)
          .map(([id, rel]: [string, any]) => {
            return `- 角色ID: ${id}
    关系类型: ${rel.type}
    关系强度: ${rel.strength}
    描述: ${rel.description}
    最后更新: ${new Date(rel.lastUpdated).toLocaleString()}
    互动次数: ${rel.interactions || 0}`;
          }).join('\n\n');
    }
}