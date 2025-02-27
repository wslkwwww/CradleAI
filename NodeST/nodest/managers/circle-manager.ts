import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character } from '../../../shared/types';
import { CircleRFramework, CirclePostOptions, CircleResponse } from '../types/circle-types';
import { GeminiAdapter } from '../utils/gemini-adapter';

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

            // 2. 根据不同的交互类型修改场景提示词
            const modifiedFramework = this.getScenePromptByType(framework, options);

            // 3. 构建完整prompt
            const prompt = this.buildCirclePrompt(modifiedFramework, options);

            // 4. 获取角色响应 (传入apiKey)
            const response = await this.getChatResponse(prompt, apiKey);

            // 5. 解析响应
            const circleResponse = this.parseCircleResponse(response);

            // 6. 更新记忆 (使用responderId)
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

        switch (options.type) {
            case 'newPost':
                scenePrompt = `你正在创建一条新的朋友圈动态。基于你的角色性格，请以JSON格式回应：
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
                scenePrompt = `你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
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
                scenePrompt = `你看到一条朋友圈评论。基于你的角色性格和上下文信息，请以JSON格式回应：
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
                // 默认使用原始场景提示词
                scenePrompt = framework.circle.scenePrompt;
        }

        // 更新场景提示词
        updatedFramework.circle.scenePrompt = scenePrompt;
        return updatedFramework;
    }

    private buildCirclePrompt(framework: CircleRFramework, options: CirclePostOptions): string {
        return `【角色描述】${framework.base.charDescription}\n
【角色性格】${framework.base.charPersonality}\n
【当前场景】${framework.circle.scenePrompt}\n
【内容】${options.content.text}\n
【上下文】${options.content.context || ''}\n
请以JSON格式回复，响应格式如下:
${JSON.stringify(framework.circle.responseFormat, null, 2)}`;
    }

    /**
     * 改进的响应解析方法，从文本中提取并解析JSON
     */
    private parseCircleResponse(response: string): CircleResponse {
        try {
            console.log('【朋友圈】开始解析响应');
            
            // 尝试提取JSON部分
            const extractedJson = this.extractJson(response);
            
            if (!extractedJson) {
                console.error('【朋友圈】未能在响应中找到有效的JSON');
                throw new Error('未能从AI回复中提取有效数据');
            }
            
            console.log('【朋友圈】成功提取JSON:', extractedJson);
            
            // 验证解析出的JSON是否包含必要字段
            if (!extractedJson.action) {
                console.error('【朋友圈】解析出的JSON缺少action字段');
                throw new Error('AI回复数据格式不完整');
            }
            
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
            // 直接尝试解析整个文本
            try {
                return JSON.parse(text);
            } catch (e) {
                // 解析失败，继续下面的提取逻辑
            }
            
            // 使用正则表达式寻找文本中的JSON部分
            const jsonPattern = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g;
            const matches = text.match(jsonPattern);
            
            if (!matches || matches.length === 0) {
                console.error('【朋友圈】未找到JSON格式内容');
                return null;
            }
            
            // 尝试解析找到的每一个JSON候选
            for (const match of matches) {
                try {
                    const parsed = JSON.parse(match);
                    
                    // 验证这是否是我们期望的响应格式
                    if (parsed && typeof parsed === 'object' && 'action' in parsed) {
                        console.log('【朋友圈】找到有效的JSON响应');
                        return parsed;
                    }
                } catch (e) {
                    // 继续尝试下一个匹配
                    continue;
                }
            }
            
            // 如果没有找到有效的JSON，但至少有一个JSON结构，则尝试解析第一个
            try {
                return JSON.parse(matches[0]);
            } catch (e) {
                console.error('【朋友圈】所有候选JSON均解析失败');
                return null;
            }
        } catch (error) {
            console.error('【朋友圈】提取JSON时出错:', error);
            return null;
        }
    }
}