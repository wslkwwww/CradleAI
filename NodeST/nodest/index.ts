import { NodeSTCore } from './core/node-st-core';
import { 
    RoleCardJson, 
    WorldBookJson, 
    PresetJson, 
    AuthorNoteJson, 
    Character,
    GlobalSettings,
} from '../../shared/types';
import { CircleManager, CirclePostOptions, CircleResponse } from './managers/circle-manager';
export interface ProcessChatResponse {
    success: boolean;
    response?: string;
    error?: string;
}

export interface ProcessChatRequest {
    userMessage: string;
    conversationId: string;
    status: "更新人设" | "新建角色" | "同一角色继续对话";
    apiKey: string;
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    jsonString?: string;
}

export { CirclePostOptions, CircleResponse };

export class NodeST {
    private nodeSTCore: NodeSTCore | null = null;
    private circleManager: CircleManager | null = null;

    constructor() {}

    private getCoreInstance(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>): NodeSTCore {
        // 使用核心 API 设置初始化或更新 NodeSTCore
        if (!this.nodeSTCore) {
            console.log("[NodeST] Creating new NodeSTCore instance with API settings:", {
                provider: apiSettings?.apiProvider || 'gemini',
                hasOpenRouter: !!apiSettings?.openrouter
            });
            this.nodeSTCore = new NodeSTCore(apiKey, apiSettings);
        } else {
            console.log("[NodeST] Updating existing NodeSTCore with API settings:", {
                provider: apiSettings?.apiProvider || 'gemini',
                hasOpenRouter: !!apiSettings?.openrouter
            });
            this.nodeSTCore.updateApiSettings(apiKey, apiSettings);
        }
        
        return this.nodeSTCore;
    }

    private getCircleManager(): CircleManager {
        if (!this.circleManager) {
            this.circleManager = new CircleManager();
        }
        return this.circleManager;
    }

    async processChatMessage(params: ProcessChatRequest): Promise<ProcessChatResponse> {
        try {
            console.log("[NodeST] Processing chat message:", { 
                messageLength: params.userMessage.length,
                status: params.status,
                conversationId: params.conversationId,
                apiProvider: params.apiSettings?.apiProvider || 'gemini'
            });

            if (!params.apiKey) {
                return { 
                    success: false, 
                    error: "API key is required" 
                };
            }

            // 获取 NodeSTCore 实例，并传递 API 设置
            const core = this.getCoreInstance(params.apiKey, params.apiSettings);

            if (params.status === "新建角色") {
                if (!params.jsonString) {
                    throw new Error("Character data is required for creating a new character");
                }

                const characterData = this.parseCharacterJson(params.jsonString);
                const created = await core.createNewCharacter(
                    params.conversationId,
                    characterData.roleCard,
                    characterData.worldBook,
                    characterData.preset,
                    characterData.authorNote
                );

                if (!created) {
                    throw new Error("Failed to create new character");
                }

                // 返回角色的第一条消息
                const response = characterData.roleCard.first_mes || "Hello!";
                return { 
                    success: true, 
                    response: response 
                };
            }
            else if (params.status === "更新人设") {
                if (!params.jsonString) {
                    throw new Error("Character data is required for updating a character");
                }

                const characterData = this.parseCharacterJson(params.jsonString);
                const updated = await core.updateCharacter(
                    params.conversationId,
                    characterData.roleCard,
                    characterData.worldBook,
                    characterData.preset,
                    characterData.authorNote
                );

                if (!updated) {
                    throw new Error("Failed to update character");
                }

                return { 
                    success: true
                };
            }
            else if (params.status === "同一角色继续对话") {
                const response = await core.continueChat(
                    params.conversationId,
                    params.userMessage,
                    params.apiKey
                );

                if (response) {
                    return { 
                        success: true, 
                        response: response 
                    };
                } else {
                    return { 
                        success: false, 
                        error: "Failed to generate response" 
                    };
                }
            }

            return { 
                success: false, 
                error: "Unknown status" 
            };
        }
        catch (error) {
            console.error("[NodeST] Error processing chat message:", error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : "Unknown error" 
            };
        }
    }

    // 解析角色数据JSON
    private parseCharacterJson(jsonString: string): {
        roleCard: RoleCardJson;
        worldBook: WorldBookJson;
        preset: PresetJson;
        authorNote?: AuthorNoteJson;
    } {
        try {
            const data = JSON.parse(jsonString);
            return {
                roleCard: data.roleCard,
                worldBook: data.worldBook,
                preset: data.preset,
                authorNote: data.authorNote
            };
        } catch (error) {
            console.error("[NodeST] Error parsing character JSON:", error);
            throw new Error("Invalid character data");
        }
    }

    // Circle 相关方法
    async initCharacterCircle(character: Character | string): Promise<boolean> {
        try {
            const characterId = typeof character === 'string' ? character : character.id;
            const circleManager = this.getCircleManager();
            return await circleManager.initCharacterCircle(characterId);
        } catch (error) {
            console.error("[NodeST] Error initializing character circle:", error);
            return false;
        }
    }

    async processCircleInteraction(options: CirclePostOptions): Promise<CircleResponse> {
        try {
            const circleManager = this.getCircleManager();
            return await circleManager.postInteraction(options);
        } catch (error) {
            console.error("[NodeST] Error processing circle interaction:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
}
