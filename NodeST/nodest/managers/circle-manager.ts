import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character } from '../../../shared/types';
import { CircleRFramework, CirclePostOptions, CircleResponse } from '@/shared/types/circle-types';
import { GeminiAdapter } from '../utils/gemini-adapter';
import { OpenRouterAdapter } from '../utils/openrouter-adapter';
import { MessageBoxItem, RelationshipMapData } from '../../../shared/types/relationship-types';
import { PromptBuilderService, DEntry, RFrameworkEntry } from '../services/prompt-builder-service';
export { CirclePostOptions, CircleResponse };
export class CircleManager {
    
    private geminiAdapter: GeminiAdapter | null = null;
    private openRouterAdapter: OpenRouterAdapter | null = null;
    private apiKey?: string;
    private openRouterConfig?: {
        apiKey?: string;
        model?: string;
    };
    // Add rate limiting variables
    private static requestQueue: Array<{
        resolve: (value: string) => void;
        reject: (error: any) => void;
        prompt: string;
    }> = [];
    private static isProcessing = false;
    private static requestInterval = 2000; // 2 seconds between requests
    private static lastRequestTime = 0;
    
    constructor(
        apiKey?: string,
        openRouterConfig?: {
            apiKey?: string;
            model?: string;
        }
    ) {
        this.apiKey = apiKey || '';
        this.openRouterConfig = openRouterConfig;
        console.log(`【CircleManager】创建实例，apiKey存在: ${!!apiKey}, openRouter配置:`, 
            openRouterConfig ? {
                hasKey: !!openRouterConfig.apiKey,
                model: openRouterConfig.model
            } : 'none'
        );
        
        // 初始化适配器
        if (openRouterConfig?.apiKey) {
            this.openRouterAdapter = new OpenRouterAdapter(
                openRouterConfig.apiKey,
                openRouterConfig.model || 'openai/gpt-3.5-turbo'
            );
            console.log('【CircleManager】已初始化 OpenRouter 适配器');
        } else if (apiKey) {
            this.geminiAdapter = new GeminiAdapter(apiKey);
            console.log('【CircleManager】已初始化 Gemini 适配器');
        }
    }

    updateApiKey(
        apiKey: string,
        openRouterConfig?: {
            apiKey?: string;
            model?: string;
        }
    ): void {
        console.log(`【CircleManager】更新API Key和配置`, {
            hasGeminiKey: !!apiKey,
            hasOpenRouterKey: !!openRouterConfig?.apiKey,
            openRouterModel: openRouterConfig?.model
        });
        
        this.apiKey = apiKey;
        
        // Only update OpenRouter configuration if explicitly provided
        if (openRouterConfig) {
            this.openRouterConfig = openRouterConfig;
            
            // If OpenRouter config is provided, use it
            if (openRouterConfig.apiKey) {
                this.openRouterAdapter = new OpenRouterAdapter(
                    openRouterConfig.apiKey,
                    openRouterConfig.model || 'openai/gpt-3.5-turbo'
                );
                this.geminiAdapter = null; // Clear Gemini adapter
                console.log('【CircleManager】已初始化/更新 OpenRouter 适配器，模型:', openRouterConfig.model);
            }
        } 
        // If no OpenRouter config is provided but we already have one, keep using it
        else if (this.openRouterAdapter && this.openRouterConfig?.apiKey) {
            console.log('【CircleManager】保留现有 OpenRouter 配置');
        }
        // Otherwise, use/update Gemini adapter
        else {
            this.geminiAdapter = new GeminiAdapter(apiKey);
            console.log('【CircleManager】已初始化/更新 Gemini 适配器');
        }
    }

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
    private async getChatResponse(prompt: string): Promise<string> {
        try {
            console.log('【朋友圈】发送请求到LLM, 使用适配器:', 
                this.openRouterAdapter ? 'OpenRouter' : 'Gemini'
            );
            
            // Return a promise that will be resolved when the request is processed
            return new Promise((resolve, reject) => {
                // Add request to queue
                CircleManager.requestQueue.push({
                    resolve,
                    reject,
                    prompt
                });
                
                // Process queue if not already processing
                if (!CircleManager.isProcessing) {
                    this.processRequestQueue();
                }
            });
        } catch (error) {
            console.error('【朋友圈】获取AI回复失败:', error);
            console.log('【朋友圈】API调用失败，使用备用模拟数据');
            return this.getMockResponse();
        }
    }
    
    // Add a new method to process the request queue
    private async processRequestQueue(): Promise<void> {
        // Set processing flag
        CircleManager.isProcessing = true;
        
        while (CircleManager.requestQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - CircleManager.lastRequestTime;
            
            // If we need to wait, do so
            if (timeSinceLastRequest < CircleManager.requestInterval) {
                const waitTime = CircleManager.requestInterval - timeSinceLastRequest;
                console.log(`【朋友圈】API速率限制：等待 ${waitTime}ms 后发送下一个请求`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // Get next request from queue
            const request = CircleManager.requestQueue.shift();
            if (!request) continue;
            
            try {
                // Create message content
                const message = {
                    role: "user",
                    parts: [{ text: request.prompt }]
                };
                
                let response: string;
                
                // Use the correct adapter
                if (this.openRouterAdapter) {
                    response = await this.openRouterAdapter.generateContent([message]);
                } else if (this.geminiAdapter) {
                    response = await this.geminiAdapter.generateContent([message]);
                } else {
                    console.log('【朋友圈】没有可用的API适配器，使用模拟数据');
                    response = this.getMockResponse();
                }
                
                // Update last request time
                CircleManager.lastRequestTime = Date.now();
                
                // Resolve the promise
                request.resolve(response);
            } catch (error) {
                console.error('【朋友圈】API请求失败:', error);
                request.reject(error);
            }
        }
        
        // Clear processing flag
        CircleManager.isProcessing = false;
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
    async initCharacterCircle(characterId: string): Promise<boolean> {
        try {
            console.log(`【CircleManager】初始化角色朋友圈: ${characterId}, apiKey存在: ${!!this.apiKey}`);
            
            // Load character data first (we need the full Character object)
            const characterData = await this.loadJson<Character>(
                this.getStorageKey(characterId, '_character_data')
            );
            
            if (!characterData) {
                console.log(`【CircleManager】未找到角色 ${characterId} 的数据，尝试创建空的基础数据`);
                
                // Create minimal character data if it doesn't exist
                const minimalCharacter: Character = {
                    id: characterId,
                    name: "Unknown Character",
                    avatar: null,
                    backgroundImage: null,
                    description: "",
                    personality: "",
                    interests: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                
                // Save minimal character data
                await this.saveJson(
                    this.getStorageKey(characterId, '_character_data'),
                    minimalCharacter
                );
                
                // Initialize circle framework with minimal data
                return await this.circleInit(minimalCharacter);
            }
            
            // Initialize circle framework with loaded character data
            return await this.circleInit(characterData);
        } catch (error) {
            console.error(`【CircleManager】初始化角色朋友圈失败:`, error);
            return false;
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

严格按以下格式用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你的评论内容（如不评论则省略此字段）"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
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
            
            // 检查是否有图片需要处理
            const hasImages = options.content.images && options.content.images.length > 0;
            if (hasImages) {
                console.log(`【朋友圈】检测到帖子包含 ${options.content.images!.length} 张图片`);
            }
            
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
            let relationshipReviewPrompt = '';
            
            // 消息盒子D类条目
            if (characterData.messageBox?.length) {
              const messagesText = this.formatMessageBoxForPrompt(characterData.messageBox);
              console.log(`【角色关系】为角色 ${characterData.name} 添加消息盒子D类条目，包含 ${characterData.messageBox.length} 条消息`);
              dEntries.push(PromptBuilderService.createDEntry({
                name: "Message Box",
                content: `【消息盒子】\n以下是你最近收到的互动消息:\n${messagesText}`,
                depth: 1,
                constant: true
              }));
            } else {
              console.log(`【角色关系】角色 ${characterData.name} 没有消息或消息盒子为空，跳过添加消息盒子D类条目`);
            }
            
            // 关系图谱D类条目
            if (characterData.relationshipMap?.relationships) {
              const relationshipsText = this.formatRelationshipMapForPrompt(characterData.relationshipMap);
              console.log(`【角色关系】为角色 ${characterData.name} 添加关系图谱D类条目，包含 ${Object.keys(characterData.relationshipMap.relationships).length} 个关系`);
              dEntries.push(PromptBuilderService.createDEntry({
                name: "Relationship Map",
                content: `【关系图谱数据】\n你与其他角色的当前关系:\n${relationshipsText}`,
                depth: 1,
                constant: true
              }));
            } else {
              console.log(`【角色关系】角色 ${characterData.name} 没有关系图谱或关系为空，跳过添加关系图谱D类条目`);
            }
            
            // 状态检视提示词D类条目
            if (characterData.relationshipEnabled && characterData.messageBox) {
              console.log(`【角色关系】检查角色 ${characterData.name} 是否需要关系状态检视，关系系统已启用: ${characterData.relationshipEnabled}`);
              const unreadMessages = characterData.messageBox.filter(msg => !msg.read);
              if (unreadMessages.length > 0) {
                console.log(`【角色关系】角色 ${characterData.name} 有 ${unreadMessages.length} 条未读消息，生成关系状态检视提示词`);
                relationshipReviewPrompt = await this.generateRelationshipStateReviewPrompt(characterData);
                if (relationshipReviewPrompt) {
                  console.log(`【角色关系】成功为角色 ${characterData.name} 添加关系状态检视D类条目，长度: ${relationshipReviewPrompt.length}`);
                  
                  // 修改：直接添加到文本中，而不是作为D类条目 - 这是临时解决方案
                  const reviewEntry = PromptBuilderService.createDEntry({
                    name: "Relationship State Review",
                    content: relationshipReviewPrompt,
                    depth: 1,
                    constant: true
                  });
                  dEntries.push(reviewEntry);
                  
                  // 添加诊断日志
                  console.log(`【角色关系】关系状态检视D类条目已创建，名称: ${reviewEntry.name}, 深度: ${reviewEntry.depth}, 内容长度: ${reviewEntry.content.length}`);
                }
              } else {
                console.log(`【角色关系】角色 ${characterData.name} 没有未读消息，跳过关系状态检视`);
              }
            }

            // 5. 处理图片和用户消息
            let pictureDescription = '';
            let imageInput = null;
            let allMessages = [];
            
            // 6. 构建基本用户消息
            let userMessage = `【内容】${options.content.text}\n【上下文】${options.content.context || ''}`;

            // 7. 使用PromptBuilderService构建消息数组
            const messages = PromptBuilderService.buildPrompt({
              rFramework,
              dEntries,
              userMessage
            });
            
            console.log(`【朋友圈】角色 ${characterData.name} 的请求构建完成，R框架条目数: ${rFramework.length}, D类条目数: ${dEntries.length}`);
            
            let response;
            
            // 8. 统一处理图片和请求 - 修改这部分以确保图片和请求在同一个API调用中
            if (hasImages && this.geminiAdapter) {
                try {
                    console.log(`【朋友圈】处理包含图片的帖子，采用单一API调用方式`);
                    
                    // 获取第一张图片
                    const image = options.content.images![0];
                    
                    // 准备图片输入（这里直接使用URL）
                    imageInput = { url: image };
                    
                    // 将消息转换为文本格式
                    let promptText = PromptBuilderService.messagesToText(messages);
                    
                    // 如果有关系状态检查提示词，添加到提示文本
                    if (relationshipReviewPrompt && promptText.indexOf("关系状态检查") === -1) {
                        promptText += "\n\n" + relationshipReviewPrompt;
                    }
                    
                    console.log(`【朋友圈】发送包含图片的单一请求，提示文本长度: ${promptText.length}`);
                    
                    // 使用带图像的multimodal请求
                    const multimodalResponse = await this.geminiAdapter.generateMultiModalContent(
                        promptText,
                        {
                            images: [imageInput]
                        }
                    );
                    
                    response = multimodalResponse.text || '';
                    
                    // 日志
                    if (response) {
                        console.log(`【朋友圈】成功接收包含图片的响应，响应长度: ${response.length}`);
                        console.log(`【朋友圈】响应前100个字符: ${response.substring(0, 100)}...`);
                    } else {
                        console.log(`【朋友圈】响应为空，可能发生问题`);
                    }
                } catch (error) {
                    console.error(`【朋友圈】处理图片请求时出错:`, error);
                    return {
                        success: false,
                        error: `图片分析失败: ${error instanceof Error ? error.message : '未知错误'}`
                    };
                }
            } else {
                // 处理不包含图片的请求
                // 使用现有流程
                console.log(`【朋友圈】处理不含图片的标准请求`);
                
                // 8. 转换为文本格式并发送请求
                const prompt = PromptBuilderService.messagesToText(messages);

                // 如果日志中没有检测到状态检视提示词，但我们确实创建了它，那么手动添加它
                if (prompt.indexOf("关系状态检查") === -1 && relationshipReviewPrompt) {
                    console.warn(`【角色关系】警告：关系状态检视提示词没有被包含在最终请求中，手动添加`);
                    const modifiedPrompt = prompt + "\n\n" + relationshipReviewPrompt;
                    
                    // 新增日志：打印完整的请求体内容
                    console.log(`【朋友圈】角色 ${characterData.name} 的完整请求体(手动添加了关系状态检视):\n${'-'.repeat(80)}\n${modifiedPrompt}\n${'-'.repeat(80)}`);
                    console.log(`【朋友圈】角色 ${characterData.name} 的最终提示词长度: ${modifiedPrompt.length}`);
                    
                    // 使用修改后的提示词
                    response = await this.getChatResponse(modifiedPrompt);
                } else {
                    // 原来的流程
                    // 新增日志：打印完整的请求体内容
                    console.log(`【朋友圈】角色 ${characterData.name} 的完整请求体:\n${'-'.repeat(80)}\n${prompt}\n${'-'.repeat(80)}`);
                    console.log(`【朋友圈】角色 ${characterData.name} 的最终提示词长度: ${prompt.length}`);
                    response = await this.getChatResponse(prompt);
                }
            }
            
            // 9. 解析响应
            const circleResponse = this.parseCircleResponse(response);
            
            // 10. 如果包含关系状态检查，则解析关系更新
            if (relationshipReviewPrompt && characterData && circleResponse.success) {
                console.log(`【角色关系】角色 ${characterData.name} 检测到关系状态检视提示词，开始解析关系更新`);
                const relationshipUpdates = this.parseRelationshipReviewResponse(response);
                
                // 存储关系更新以便稍后应用
                if (relationshipUpdates.length > 0) {
                    console.log(`【角色关系】角色 ${characterData.name} 解析出 ${relationshipUpdates.length} 条关系更新，将添加到响应中`);
                    circleResponse.relationshipUpdates = relationshipUpdates;
                } else {
                    console.log(`【角色关系】角色 ${characterData.name} 未解析到关系更新或解析失败`);
                }
            }

            // 11. 更新记忆
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
            
        // 检查是否有图片
        const hasImages = options.content.images && options.content.images.length > 0;
        const imagePrompt = hasImages ? 
            `该动态包含图片内容，请首先关注【图片描述】部分，这是对图片内容的详细描述。你的回应应该主要基于图片内容，而不仅仅是动态的文字。` : 
            '';
            
        // 检查是否为自己发布的帖子（发帖者和响应者是同一角色）
        const isOwnPost = options.content.authorId === options.responderId;

        switch (options.type) {
            case 'forwardedPost': // 增加转发帖子的情况
                // 构建转发场景的提示词 - 更新为更好地处理图片内容
                scenePrompt = `用户给你转发了一条朋友圈动态：

【作者】${options.content.authorName || '某人'}
【内容】${contentText}
${hasImages ? "【图片内容】动态中包含图片" : ""}
${options.content.context ? `【上下文】${options.content.context}` : ''}

请你以${framework.base.charDescription.substring(0, 50)}的角色身份，考虑以下几点：
1. 这是在私聊中用户转发给你的朋友圈，而不是你在浏览朋友圈
2. 你可能认识也可能不认识发朋友圈的人
3. 如果发朋友圈的人是你自己，请对"用户看了你的朋友圈并转发给你"这个行为做出反应
${hasImages ? "4. 这条朋友圈包含图片，请优先对图片内容做出回应，在回复中直接提及你看到的图片内容" : ""}

请以JSON格式提供你的回应：
{
  "action": {
    "like": true/false,
    "comment": "${hasImages ? "对图片内容的回应，请明确提及你看到的图片内容" : "你的回复内容"}"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}
}`;
                break;
                
            case 'newPost':
                if (isOwnPost) {
                    // 当角色是发帖者时，应当创建朋友圈内容而不是回应
                    scenePrompt = `作为一个角色，请基于你的性格和背景，创作一条适合发布在朋友圈的内容。

这次发布可能的主题是：${contentText}
${options.content.context ? `【上下文】${options.content.context}` : ''}

请以JSON格式提供你的朋友圈帖子：
{
  "post": "你要发布的朋友圈内容",
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}

确保内容符合你的角色人设，展现出你独特的性格和表达方式。`;
                } else {
                    // 其他角色回应帖子
                    scenePrompt = `作为一个角色，你正在创建一条新的朋友圈动态。以下是准备发布的内容：

【内容】${contentText}
【上下文】${options.content.context || '无'}
${imagePrompt}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false，对自己发的内容通常为false）
- 提供一条你想发布的内容（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式用中文回复，不要包含任何其他文字：
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
                }
                break;
                
            case 'replyToPost':
                if (isOwnPost) {
                    // 当角色是自己发布的帖子的作者时，应该对别人的评论做出回应
                    scenePrompt = `这是你自己发布的朋友圈动态，现在你正在查看别人对你帖子的反应：

【你发布的内容】${contentText}
【上下文】${options.content.context || '无'}
${imagePrompt}

基于你的角色性格，请以JSON格式回应：
- 你对自己发布的这条内容的感受
- 你希望获得什么样的评论或互动
- 包含你的情感状态

回复，不要包含任何其他文字：
{
  "reflection": "对自己帖子的反思或补充想法",
  "expectation": "期待获得的互动类型",
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}
}`;
                } else {
                    // Enhance the prompt specifically for image posts
                    if (hasImages) {
                        scenePrompt = `你正在浏览以下带有图片的朋友圈动态：

【作者】${options.content.authorName || '某人'}
【内容】${contentText}
【上下文】${options.content.context || '无'}

请特别注意上方的【图片描述】部分，这是对图片内容的详细描述。你的回应应该首先对图片内容进行回应，而不是仅关注文字内容。

作为角色 ${framework.base.charDescription.substring(0, 50)}，基于你看到的图片内容和你的性格特点，请思考：
1. 这张图片展示了什么内容？
2. 你对图片中的内容有什么感受？
3. 基于你的角色设定，你会如何回应这张图片？

然后，以JSON格式提供你的回应：
- 决定是否点赞（like: true/false）
- 评论内容应直接提及图片中看到的具体元素，表明你看到并理解了图片内容
- 包含你对图片的情感反应（emotion对象）

严格按以下格式，用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你对图片的具体评论，直接提及图片中的内容"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`;
                    } else {
                        scenePrompt = `你正在浏览以下朋友圈动态：

【作者】${options.content.authorName || '某人'}
【内容】${contentText}
【上下文】${options.content.context || '无'}
${imagePrompt}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式用中文回复，不要包含任何其他文字：
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
                    }
                }
                break;
                
            case 'replyToComment':
                // Also enhance comment replies when there are images
                if (hasImages) {
                    scenePrompt = `你看到以下带有图片的朋友圈评论：

【原帖内容】${options.content.context || '无'}
【评论内容】${contentText}
【评论作者】${options.content.authorName || '某人'}

请特别注意上方的【图片描述】部分，这是对图片内容的详细描述。你的回复应该对图片内容和评论文本都做出响应。

作为角色 ${framework.base.charDescription.substring(0, 50)}，请基于图片内容和你的角色特点：
1. 考虑图片内容如何影响你对评论的回应
2. 在回复中提及图片中的具体元素

然后，以JSON格式提供你的回应：
- 决定是否点赞评论（like: true/false）
- 回复内容应结合图片内容和评论文本
- 包含你的情感反应（emotion对象）

用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你的回复内容，提及图片和评论"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`;
                } else {
                    scenePrompt = `你看到以下朋友圈评论：

【原帖内容】${options.content.context || '无'}
${imagePrompt}
【评论内容】${contentText}
【评论作者】${options.content.authorName || '某人'}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否回复此评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式用中文回复，不要包含任何其他文字：
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
                }
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
            
            // Handle different response formats based on what fields exist in the JSON
            if (extractedJson.post) {
                // This is a post creation response format
                return {
                    success: true,
                    action: {
                        like: false, // No like for own post
                        comment: extractedJson.post // Use post content as comment
                    },
                    emotion: extractedJson.emotion // Preserve emotion data
                };
            } else if (extractedJson.action) {
                // This is a standard interaction response format
                return {
                    success: true,
                    action: {
                        like: Boolean(extractedJson.action.like),
                        comment: extractedJson.action.comment
                    },
                    emotion: extractedJson.emotion
                };
            } else if (extractedJson.reflection) {
                // This is a reflection response (for self-post viewing)
                return {
                    success: true,
                    action: {
                        like: false, // Can't like own post
                        comment: extractedJson.reflection // Use reflection as comment
                    },
                    emotion: extractedJson.emotion
                };
            }
            
            // If we can't determine the format but have something, try to adapt it
            if (typeof extractedJson === 'object' && extractedJson !== null) {
                // Look for any useful fields we might use
                const possibleComment = 
                    extractedJson.comment || 
                    extractedJson.content || 
                    extractedJson.message || 
                    extractedJson.text;
                    
                return {
                    success: true,
                    action: {
                        like: Boolean(extractedJson.like || false),
                        comment: typeof possibleComment === 'string' ? possibleComment : undefined
                    }
                };
            }

            throw new Error('无法识别的响应格式');
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
                
                // Modified: Accept different valid structures instead of just action
                if (this.isValidJsonStructure(directParsed)) {
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
                    if (this.isValidJsonStructure(parsed)) {
                        return parsed;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            // Fallback: try to return any valid JSON, even if it doesn't match our expected structure
            for (const match of matches) {
                try {
                    return JSON.parse(match);
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
     * 验证JSON结构是否符合预期的任一格式
     */
    private isValidJsonStructure(json: any): boolean {
        // 1. 必须是对象
        if (!json || typeof json !== 'object') {
            return false;
        }

        // 2. 检查是否是"post"格式回复（用于创建新帖子）
        if (typeof json.post === 'string' && json.post.trim().length > 0) {
            return true;
        }

        // 3. 检查是否是"reflection"格式（用于自我帖子反思）
        if (typeof json.reflection === 'string' && json.reflection.trim().length > 0) {
            return true;
        }

        // 4. 检查是否是标准的"action"格式回复
        if (json.action && typeof json.action === 'object') {
            // action必须包含like字段
            if (typeof json.action.like !== 'boolean') {
                return false;
            }

            // 如果有comment字段，必须是字符串
            if ('comment' in json.action && typeof json.action.comment !== 'string') {
                return false;
            }

            return true;
        }

        // 5. 检查是否有其他可用字段（宽松检验，用作最后的尝试）
        const hasUsableField = 
            (typeof json.comment === 'string') || 
            (typeof json.content === 'string') ||
            (typeof json.message === 'string') ||
            (typeof json.text === 'string');
        
        if (hasUsableField) {
            return true;
        }

        return false;
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
            /^以下是[^{]*?(?=\{)/i,
            /^这是我为.*创作的朋友圈[^{]*?(?=\{)/i
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
            if (!updateSection || !updateSection[1]) {
                console.log('【角色关系】未找到关系更新部分');
                
                // 尝试查看响应是否包含了潜在的关系更新信息
                if (response.includes('+') || response.includes('-')) {
                    console.log('【角色关系】响应中可能包含关系更新信息，但格式不符合预期');
                    console.log('【角色关系】响应片段:', response.substring(0, 200) + '...');
                }
                
                return results;
            }
            
            console.log(`【角色关系】找到关系更新部分: "${updateSection[1].trim().substring(0, 100)}${updateSection[1].trim().length > 100 ? '...' : ''}"`);
            
            // 解析每一行
            const lines = updateSection[1].trim().split('\n');
            console.log(`【角色关系】发现 ${lines.length} 行待解析内容`);
            
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
                        console.log(`【角色关系】解析关系更新: 目标=${targetId.trim()}, 强度变化=${strengthDelta}${newType ? ', 新类型=' + newType.trim() : ''}`);
                    } else {
                        console.log(`【角色关系】无法解析强度变化值: ${deltaStr}`);
                    }
                } else {
                    console.log(`【角色关系】无法匹配行内容: "${line.trim()}"`);
                }
            }
            
            console.log(`【角色关系】成功解析 ${results.length}/${lines.length} 条关系更新`);
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

    // Changed from postInteraction to circlePost to match existing method
    async processInteraction(options: CirclePostOptions): Promise<CircleResponse> {
        // Check if we have images in the options
        const hasImages = options.content.images && options.content.images.length > 0;
        if (hasImages && options.content.images) {
          console.log(`【CircleManager】处理带图片的朋友圈互动，图片数量: ${options.content.images.length}`);
        }
        
        return this.circlePost(options, this.apiKey);
    }
}