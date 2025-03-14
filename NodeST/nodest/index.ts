import { NodeSTCore } from './core/node-st-core';
import { 
    RoleCardJson, 
    WorldBookJson, 
    PresetJson, 
    AuthorNoteJson, 
    Character,
    GlobalSettings,
    ChatHistoryEntity
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
    isCradleGeneration?: boolean; 
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

                // 解析角色数据并详细记录，帮助诊断问题
                try {
                    console.log("[NodeST] 解析角色JSON数据...");
                    const characterData = this.parseCharacterJson(params.jsonString);
                    
                    // 验证所有必要的数据都存在
                    console.log("[NodeST] 验证角色数据完整性:", {
                        hasRoleCard: !!characterData.roleCard,
                        hasWorldBook: !!characterData.worldBook,
                        hasPreset: !!characterData.preset,
                        roleCardName: characterData.roleCard?.name,
                        worldBookEntries: Object.keys(characterData.worldBook?.entries || {}).length,
                        hasChatHistory: !!characterData.chatHistory,
                        chatHistoryMessagesCount: characterData.chatHistory?.parts.length || 0,
                        isCradleGeneration: params.isCradleGeneration || false
                    });
                    
                    // 创建新角色
                    console.log("[NodeST] 开始创建新角色...");
                    const created = await core.createNewCharacter(
                        params.conversationId,
                        characterData.roleCard,
                        characterData.worldBook,
                        characterData.preset,
                        characterData.authorNote,
                        characterData.chatHistory,
                        { isCradleGeneration: params.isCradleGeneration || false }
                    );

                    if (!created) {
                        console.error("[NodeST] 创建新角色失败");
                        throw new Error("Failed to create new character");
                    }

                    // 返回角色的第一条消息
                    const response = characterData.roleCard.first_mes || "Hello!";
                    console.log("[NodeST] 角色创建成功，返回第一条消息");
                    return { 
                        success: true, 
                        response: response 
                    };
                } catch (parseError) {
                    console.error("[NodeST] 解析或创建角色时出错:", parseError);
                    throw parseError;
                }
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
        chatHistory?: ChatHistoryEntity;  // Add chatHistory to return type
    } {
        try {
            console.log("[NodeST] 开始解析角色JSON数据，长度:", jsonString.length);
            
            // 尝试解析JSON
            const data = JSON.parse(jsonString);
            
            // 检查并确保关键字段存在
            if (!data.roleCard || !data.worldBook || !data.preset) {
                console.error("[NodeST] 角色数据缺少必要字段:", {
                    hasRoleCard: !!data.roleCard,
                    hasWorldBook: !!data.worldBook,
                    hasPreset: !!data.preset
                });
                
                // 创建基础数据
                const safeRoleCard = data.roleCard || {
                    name: "未命名角色",
                    first_mes: "你好，很高兴认识你！",
                    description: "这是一个角色",
                    personality: "友好",
                    scenario: "",
                    mes_example: ""
                };
                
                const safeWorldBook = data.worldBook || {
                    entries: {
                        "Alist": {
                            "comment": "Character Attributes List",
                            "content": `<attributes>\n  <personality>友好、随和</personality>\n  <appearance>未指定</appearance>\n  <likes>聊天</likes>\n  <dislikes>未指定</dislikes>\n</attributes>`,
                            "disable": false,
                            "position": 4,
                            "constant": true,
                            "key": [],
                            "order": 1,
                            "depth": 1,
                            "vectorized": false
                        }
                    }
                };
                
                const safePreset = data.preset || this.createDefaultPreset();
                
                // Create default chatHistory entity with first message
                const chatHistoryEntity: ChatHistoryEntity = {
                    name: "Chat History",
                    role: "system",
                    parts: safeRoleCard.first_mes ? [
                        {
                            role: "model",
                            parts: [{ text: safeRoleCard.first_mes }],
                            is_first_mes: true
                        }
                    ] : [],
                    identifier: "chatHistory"
                };
                
                return {
                    roleCard: safeRoleCard,
                    worldBook: safeWorldBook,
                    preset: safePreset,
                    authorNote: data.authorNote,
                    chatHistory: chatHistoryEntity
                };
            }
            
            // Verify preset has proper structure and add missing properties if needed
            if (data.preset) {
                console.log("[NodeST] 验证preset数据结构...");
                // If no prompts array, create it
                if (!Array.isArray(data.preset.prompts)) {
                    console.log("[NodeST] 创建默认的prompts数组");
                    data.preset.prompts = this.createDefaultPreset().prompts;
                }
                
                // If no prompt_order array, create it  
                if (!data.preset.prompt_order || !Array.isArray(data.preset.prompt_order) || 
                    data.preset.prompt_order.length === 0) {
                    console.log("[NodeST] 创建默认的prompt_order");
                    data.preset.prompt_order = this.createDefaultPreset().prompt_order;
                }
                
                // Check that required system prompts exist
                const requiredPrompts = [
                    {name: "Character System", identifier: "characterSystem", role: "user"},
                    {name: "Character Confirmation", identifier: "characterConfirmation", role: "model"},
                    {name: "Character Introduction", identifier: "characterIntro", role: "user"},
                    {name: "Context Instruction", identifier: "contextInstruction", role: "user"},
                    {name: "Continue", identifier: "continuePrompt", role: "user"}
                ];
                
                // Add any missing required prompts
                for (const required of requiredPrompts) {
                    interface RequiredPrompt {
                        name: string;
                        identifier: string;
                        role: string;
                    }
                    
                    interface Prompt {
                        name: string;
                        content: string;
                        enable: boolean;
                        identifier: string;
                        role: string;
                        injection_position?: number;
                        injection_depth?: number;
                    }

                    if (!data.preset.prompts.some((p: Prompt) => p.identifier === required.identifier)) {
                        console.log(`[NodeST] 添加缺失的必要prompt: ${required.identifier}`);
                        const defaultPrompt: Prompt | undefined = this.createDefaultPreset().prompts.find(
                            (p: Prompt) => p.identifier === required.identifier
                        );
                        if (defaultPrompt) {
                            data.preset.prompts.push(defaultPrompt);
                        }
                    }
                }
                
                // Ensure chatHistory is in the prompt_order
                const firstOrder = data.preset.prompt_order[0];
                if (firstOrder && Array.isArray(firstOrder.order)) {
                    // Define interfaces for the order entries
                    interface PromptOrderEntry {
                        identifier: string;
                        enabled: boolean;
                    }

                    interface PromptOrder {
                        order: PromptOrderEntry[];
                    }

                    if (!firstOrder.order.some((o: PromptOrderEntry) => o.identifier === "chatHistory")) {
                        console.log("[NodeST] 在prompt_order中添加chatHistory");
                        // Find where to insert chatHistory (typically before contextInstruction)
                        const contextInstructionIndex: number = firstOrder.order.findIndex(
                            (o: PromptOrderEntry) => o.identifier === "contextInstruction"
                        );
                        
                        if (contextInstructionIndex !== -1) {
                            firstOrder.order.splice(contextInstructionIndex, 0, 
                                {identifier: "chatHistory", enabled: true} as PromptOrderEntry);
                        } else {
                            // Add it near the end
                            firstOrder.order.push({identifier: "chatHistory", enabled: true} as PromptOrderEntry);
                        }
                    }
                }
            }
            
            // If JSON data exists but doesn't have chatHistory, create it
            let chatHistory: ChatHistoryEntity ;
            
            if (!data.chatHistory) {
                console.log("[NodeST] 角色数据中未找到chatHistory，创建默认的chatHistory");
                
                // Look for a Chat History entry in the preset
                let chatHistoryIdentifier = "chatHistory";
                let chatHistoryName = "Chat History";
                
                // Try to find the chatHistory identifier in the preset
                if (data.preset && data.preset.prompt_order && data.preset.prompt_order[0]) {
                    const order = data.preset.prompt_order[0].order || [];
                    interface PromptOrderEntry {
                        identifier: string;
                        enabled: boolean;
                    }
                    const chatHistoryEntry: PromptOrderEntry | undefined = order.find((entry: PromptOrderEntry) => entry.identifier.toLowerCase().includes('chathistory'));
                    if (chatHistoryEntry) {
                        chatHistoryIdentifier = chatHistoryEntry.identifier;
                    }
                }
                
                // Create a chatHistory entity with the character's first message
                chatHistory = {
                    name: chatHistoryName,
                    role: "system",
                    parts: data.roleCard.first_mes ? [
                        {
                            role: "model",
                            parts: [{ text: data.roleCard.first_mes }],
                            is_first_mes: true
                        }
                    ] : [],
                    identifier: chatHistoryIdentifier
                };
                
                console.log("[NodeST] 已创建默认chatHistory，包含角色第一条消息");
            } else {
                // Use existing chatHistory but ensure it has the first message
                chatHistory = data.chatHistory;
                
                // Check if first message exists, if not add it
                const hasFirstMessage = chatHistory.parts.some(msg => msg.is_first_mes);
                if (!hasFirstMessage && data.roleCard && data.roleCard.first_mes) {
                    chatHistory.parts.unshift({
                        role: "model",
                        parts: [{ text: data.roleCard.first_mes }],
                        is_first_mes: true
                    });
                    console.log("[NodeST] 在chatHistory中添加了缺失的first_mes");
                }
            }
            
            console.log("[NodeST] 角色JSON数据解析成功，chatHistory状态:", {
                exists: !!chatHistory,
                messagesCount: chatHistory?.parts?.length || 0,
                hasFirstMessage: chatHistory?.parts?.some(p => p.is_first_mes) || false
            });
            
            return {
                roleCard: data.roleCard,
                worldBook: data.worldBook,
                preset: data.preset,
                authorNote: data.authorNote,
                chatHistory: chatHistory  // Return the processed chatHistory
            };
        } catch (error) {
            console.error("[NodeST] Error parsing character JSON:", error);
            throw new Error("Invalid character data");
        }
    }

    // Add a helper method to create the default preset structure
    private createDefaultPreset(): PresetJson {
        return {
            prompts: [
                {
                    name: "Character System",
                    content: "You are a Roleplayer who is good at playing various types of roles. Regardless of the genre, you will ensure the consistency and authenticity of the role based on the role settings I provide, so as to better fulfill the role.",
                    enable: true,
                    identifier: "characterSystem", 
                    role: "user"
                },
                {
                    name: "Character Confirmation",
                    content: "[Understood]",
                    enable: true,
                    identifier: "characterConfirmation",
                    role: "model"
                },
                {
                    name: "Character Introduction",
                    content: "The following are some information about the character you will be playing. Additional information will be given in subsequent interactions.",
                    enable: true,
                    identifier: "characterIntro",
                    role: "user"
                },
                {
                    name: "Enhance Definitions",
                    content: "",
                    enable: true,
                    identifier: "enhanceDefinitions",
                    injection_position: 1,
                    injection_depth: 3,
                    role: "user"
                },
                {
                    name: "Context Instruction",
                    content: "推荐以下面的指令&剧情继续：\n{{lastMessage}}",
                    enable: true,
                    identifier: "contextInstruction",
                    role: "user"
                },
                {
                    name: "Continue",
                    content: "继续",
                    enable: true,
                    identifier: "continuePrompt", 
                    role: "user"
                }
            ],
            prompt_order: [{
                order: [
                    { identifier: "characterSystem", enabled: true },
                    { identifier: "characterConfirmation", enabled: true },
                    { identifier: "characterIntro", enabled: true },
                    { identifier: "enhanceDefinitions", enabled: true },
                    { identifier: "worldInfoBefore", enabled: true },
                    { identifier: "charDescription", enabled: true },
                    { identifier: "charPersonality", enabled: true },
                    { identifier: "scenario", enabled: true },
                    { identifier: "worldInfoAfter", enabled: true },
                    { identifier: "dialogueExamples", enabled: true },
                    { identifier: "chatHistory", enabled: true },
                    { identifier: "contextInstruction", enabled: true },
                    { identifier: "continuePrompt", enabled: true }
                ]
            }]
        };
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
            
            // If we have responderId but the framework hasn't been initialized yet
            // First check if we have a valid character object in the options
            if (options.responderCharacter) {
                console.log(`【NodeST】使用提供的角色数据初始化朋友圈框架: ${options.responderCharacter.name}`);
                await circleManager.circleInit(options.responderCharacter);
            } else {
                // Otherwise initialize using just the ID
                console.log(`【NodeST】确保角色朋友圈已初始化: ${options.responderId}`);
                const initialized = await circleManager.initCharacterCircle(options.responderId);
                
                if (!initialized) {
                    console.error(`【NodeST】角色 ${options.responderId} 朋友圈初始化失败`);
                    return {
                        success: false,
                        error: "朋友圈框架初始化失败"
                    };
                }
            }
            
            // Now process the interaction
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
