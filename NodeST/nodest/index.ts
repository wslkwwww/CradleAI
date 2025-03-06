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
    private apiKey: string;
    

    constructor(apiKey?: string) {
      this.apiKey = apiKey || '';
      console.log(`【NodeST】创建新实例，apiKey存在: ${!!apiKey}`);
    }
  
    setApiKey(apiKey: string): void {
      console.log(`【NodeST】设置API Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'undefined'}`);
      this.apiKey = apiKey;
      
      // 如果已经存在核心实例，也更新它的API Key
      if (this.nodeSTCore) {
        this.nodeSTCore.updateApiKey(apiKey);
      }
      
      // 如果已经存在圈子管理器，也更新它的API Key
      // Note: We maintain any existing OpenRouter config when just setting API key
      if (this.circleManager) {
        const existingOpenRouterConfig = this.circleManager['openRouterConfig'];
        this.circleManager.updateApiKey(apiKey, existingOpenRouterConfig);
      }
    }

    // Add new method for updating API settings
    updateApiSettings(
        apiKey: string, 
        apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
    ): void {
        // Set API key first
        this.setApiKey(apiKey);
        
        // Update NodeSTCore settings if it exists
        if (this.nodeSTCore) {
            this.nodeSTCore.updateApiSettings(apiKey, apiSettings);
        }

        // Update CircleManager settings if it exists
        if (this.circleManager) {
            const openRouterConfig = apiSettings?.apiProvider === 'openrouter' && apiSettings.openrouter?.enabled
                ? {
                    apiKey: apiSettings.openrouter.apiKey,
                    model: apiSettings.openrouter.model
                }
                : undefined;
                
            this.circleManager.updateApiKey(apiKey, openRouterConfig);
        }
        
        console.log(`【NodeST】更新API设置:`, {
            provider: apiSettings?.apiProvider || 'gemini',
            hasOpenRouter: !!apiSettings?.openrouter?.enabled,
            model: apiSettings?.openrouter?.model || 'none',
            apiKeyLength: apiKey?.length || 0
        });
    }

    private getCoreInstance(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>): NodeSTCore {
        // 确保使用最新的API Key
        const effectiveApiKey = this.apiKey || apiKey;
        
        // 使用核心 API 设置初始化或更新 NodeSTCore
        if (!this.nodeSTCore) {
            console.log("[NodeST] Creating new NodeSTCore instance with API settings:", {
                provider: apiSettings?.apiProvider || 'gemini',
                hasOpenRouter: !!apiSettings?.openrouter,
                apiKeyLength: effectiveApiKey?.length || 0
            });
            this.nodeSTCore = new NodeSTCore(effectiveApiKey, apiSettings);
        } else {
            console.log("[NodeST] Updating existing NodeSTCore with API settings:", {
                provider: apiSettings?.apiProvider || 'gemini',
                hasOpenRouter: !!apiSettings?.openrouter
            });
            this.nodeSTCore.updateApiSettings(effectiveApiKey, apiSettings);
        }
        
        return this.nodeSTCore;
    }

    private getCircleManager(): CircleManager {
        if (!this.circleManager) {
            // When creating a new instance, respect any existing API settings
            console.log(`【NodeST】创建新的CircleManager实例，apiKey存在: ${!!this.apiKey}`);
            this.circleManager = new CircleManager(this.apiKey);
        }
        return this.circleManager;
    }

    async processChatMessage(params: ProcessChatRequest): Promise<ProcessChatResponse> {
        try {
            console.log("[NodeST] Processing chat message:", { 
                messageLength: params.userMessage.length,
                status: params.status,
                conversationId: params.conversationId,
                apiProvider: params.apiSettings?.apiProvider || 'gemini',
                hasJsonString: !!params.jsonString,
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

                console.log("[NodeST] Updating character settings for conversationId:", params.conversationId);
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
                    success: true,
                    response: "Character updated successfully"
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
            console.log(`【NodeST】初始化角色朋友圈: ${characterId}, apiKey存在: ${!!this.apiKey}`);
            const circleManager = this.getCircleManager();
            return await circleManager.initCharacterCircle(characterId);
        } catch (error) {
            console.error("[NodeST] Error initializing character circle:", error);
            return false;
        }
    }

    async processCircleInteraction(options: CirclePostOptions): Promise<CircleResponse> {
        try {
            console.log(`【NodeST】处理朋友圈互动: ${options.type}, apiKey存在: ${!!this.apiKey}`);
            const circleManager = this.getCircleManager();
            // Changed postInteraction to circlePost
            return await circleManager.circlePost(options, this.apiKey);
        } catch (error) {
            console.error("[NodeST] Error processing circle interaction:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
}
