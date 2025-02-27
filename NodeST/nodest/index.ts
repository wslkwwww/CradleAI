import { NodeSTCore } from './core/node-st-core';
import { CircleManager } from './managers/circle-manager';
import { 
    RoleCardJson, 
    WorldBookJson, 
    PresetJson, 
    AuthorNoteJson,
    ProcessChatOptions,
    Character
} from '../../shared/types';
import { CirclePostOptions, CircleResponse } from './types/circle-types';

interface ProcessChatResponse {
    success: boolean;
    response?: string;
    error?: string;
}

export class NodeST {
    private core: NodeSTCore;
    private circleManager: CircleManager;
    private apiKey?: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey;
        this.core = new NodeSTCore(apiKey);
        this.circleManager = new CircleManager();
    }

    async processChatMessage(options: ProcessChatOptions): Promise<ProcessChatResponse> {
        try {
            const { userMessage, conversationId, status, apiKey, jsonString } = options;
            
            console.log('[NodeST] Processing chat message:', {
                conversationId,
                status,
                apiKeyLength: apiKey?.length || 0,
                hasJsonString: !!jsonString
            });

            // Extract character data if provided as jsonString
            let roleCard: RoleCardJson | undefined;
            let worldBook: WorldBookJson | undefined;
            let preset: PresetJson | undefined;
            let authorNote: AuthorNoteJson | undefined;
            
            if (jsonString) {
                try {
                    const parsedData = JSON.parse(jsonString);
                    roleCard = parsedData.roleCard;
                    worldBook = parsedData.worldBook;
                    preset = parsedData.preset;
                    authorNote = parsedData.authorNote;
                    
                    console.log('[NodeST] Parsed json data:', {
                        hasRoleCard: !!roleCard,
                        roleCardName: roleCard?.name,
                        hasWorldBook: !!worldBook,
                        worldBookEntries: worldBook ? Object.keys(worldBook.entries).length : 0,
                        hasPreset: !!preset,
                        presetPrompts: preset?.prompts?.length,
                        hasAuthorNote: !!authorNote
                    });
                } catch (parseError) {
                    console.error('[NodeST] Error parsing jsonString:', parseError);
                    return {
                        success: false,
                        error: 'Invalid character data format'
                    };
                }
            }

            // 根据不同状态处理对话
            if (status === '新建角色') {
                console.log('[NodeST] Creating new character:', conversationId);
                
                if (!roleCard || !worldBook || !preset) {
                    console.error('[NodeST] Missing required data:', {
                        hasRoleCard: !!roleCard, 
                        hasWorldBook: !!worldBook, 
                        hasPreset: !!preset
                    });
                    return {
                        success: false,
                        error: '新建角色需要完整的角色数据'
                    };
                }

                const success = await this.core.createNewCharacter(
                    conversationId,
                    roleCard,
                    worldBook,
                    preset,
                    authorNote
                );

                if (!success) {
                    console.error('[NodeST] Failed to create new character');
                    return {
                        success: false,
                        error: '创建角色失败'
                    };
                }
                
                console.log('[NodeST] Character created, continuing with first chat message');
                
                // 新角色创建后立即处理第一条消息
                const response = await this.core.continueChat(
                    conversationId,
                    userMessage,
                    apiKey
                );

                console.log('[NodeST] First chat response received:', {
                    hasResponse: !!response,
                    responseLength: response?.length || 0
                });
                
                return {
                    success: true,
                    response: response || '对话初始化成功，但AI未返回回复'
                };
            } else if (status === '更新人设') {
                if (!roleCard || !worldBook || !preset) {
                    return {
                        success: false,
                        error: '更新人设需要完整的角色数据'
                    };
                }

                const success = await this.core.updateCharacter(
                    conversationId,
                    roleCard,
                    worldBook,
                    preset,
                    authorNote
                );

                if (!success) {
                    return {
                        success: false,
                        error: '更新人设失败'
                    };
                }

                // 更新人设后处理当前消息
                const response = await this.core.continueChat(
                    conversationId,
                    userMessage,
                    apiKey
                );

                return {
                    success: true,
                    response: response || '人设更新成功，但AI未返回回复'
                };
            } else if (status === '同一角色继续对话') {
                const response = await this.core.continueChat(
                    conversationId,
                    userMessage,
                    apiKey
                );

                if (!response) {
                    return {
                        success: false,
                        error: '获取AI回复失败'
                    };
                }

                return {
                    success: true,
                    response: response
                };
            } else {
                return {
                    success: false,
                    error: `未知的状态: ${status}`
                };
            }

        } catch (error: any) {
            console.error('[NodeST] Process error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // Circle-related methods
    async initCharacterCircle(character: Character): Promise<boolean> {
        try {
            return await this.circleManager.circleInit(character);
        } catch (error) {
            console.error('Error initializing character circle:', error);
            return false;
        }
    }

    // 更新processCircleInteraction方法，支持不同交互类型
    async processCircleInteraction(options: CirclePostOptions): Promise<CircleResponse> {
        try {
            // 验证必填字段
            if (!options.responderId) {
                console.error('CirclePostOptions 缺少 responderId');
                return {
                    success: false,
                    error: 'Missing responderId'
                };
            }
            
            if (!options.type) {
                console.error('CirclePostOptions 缺少 type');
                return {
                    success: false,
                    error: 'Missing interaction type'
                };
            }
            
            // 支持所有互动类型：newPost, replyToPost, replyToComment
            return await this.circleManager.circlePost(options, this.apiKey);
        } catch (error) {
            console.error('Error processing circle interaction:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    // 添加设置API Key的方法
    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        this.core = new NodeSTCore(apiKey);
    }
}

export type { ProcessChatOptions, CirclePostOptions, CircleResponse };
