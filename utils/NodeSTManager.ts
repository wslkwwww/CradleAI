import { NodeST } from '@/NodeST/nodest';
import { Character, GlobalSettings } from '@/shared/types';
import { CirclePostOptions, CircleResponse } from '@/NodeST/nodest/managers/circle-manager';

/**
 * NodeST Manager
 * 管理与 NodeST 系统的通信
 */
class NodeSTManagerClass {
  private nodeST: NodeST;

  constructor() {
    this.nodeST = new NodeST();
    console.log('[NodeSTManager] NodeST Manager initialized');
  }

  // Update API settings with full apiSettings object support
  updateApiSettings(
    apiKey: string, 
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): void {
    console.log('[NodeSTManager] Updating API settings:', {
      apiKeyLength: apiKey?.length || 0,
      provider: apiSettings?.apiProvider || 'gemini',
      hasOpenRouter: !!apiSettings?.openrouter,
      openRouterEnabled: apiSettings?.openrouter?.enabled
    });
    
    // Pass full apiSettings to NodeST
    this.nodeST.updateApiSettings(apiKey, apiSettings);
  }

  /**
   * Process a chat message
   */
  async processChatMessage(params: {
    userMessage: string;
    status?: "更新人设" | "新建角色" | "同一角色继续对话";
    conversationId: string;
    apiKey: string;
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    character?: Character;
  }): Promise<{
    success: boolean;
    text?: string;
    error?: string;
  }> {
    try {
      const characterId = params.character?.id || params.conversationId;
      const jsonString = params.character?.jsonData;
      
      console.log('[NodeSTManager] Processing request:', {
        apiKeyLength: params.apiKey?.length || 0,
        apiProvider: params.apiSettings?.apiProvider || 'gemini',
        openRouterEnabled: params.apiSettings?.apiProvider === 'openrouter' && params.apiSettings?.openrouter?.enabled,
        openRouterModel: params.apiSettings?.openrouter?.model,
        status: params.status || '同一角色继续对话',
        conversationId: params.conversationId,
        characterId: characterId,
        hasCharacter: !!params.character,
        hasJsonData: !!jsonString,
        action: params.status === "更新人设" ? "更新人设" : (params.status === "新建角色" ? "新建角色" : "继续对话")
      });

      // If OpenRouter is configured, ensure we're using the latest settings
      if (params.apiSettings?.apiProvider === 'openrouter' && params.apiSettings?.openrouter?.enabled) {
        // Update settings before processing to ensure correct adapter is used
        this.nodeST.updateApiSettings(params.apiKey, params.apiSettings);
      }

      console.log('[NodeSTManager] Calling NodeST.processChatMessage with conversationId:', params.conversationId);
      
      // For character updates, log that we're updating character data
      if (params.status === "更新人设" && jsonString) {
        console.log('[NodeSTManager] Updating character data for:', characterId);
      }
      
      // Call NodeST with all params including apiSettings
      const response = await this.nodeST.processChatMessage({
        userMessage: params.userMessage,
        conversationId: params.conversationId,
        status: params.status || "同一角色继续对话",
        apiKey: params.apiKey,
        apiSettings: params.apiSettings,
        jsonString
      });

      if (response.success) {
        return {
          success: true,
          text: response.response
        };
      } else {
        console.error('[NodeSTManager] Error from NodeST:', response.error);
        return {
          success: false,
          error: response.error || "Unknown error"
        };
      }
    } catch (error) {
      console.error('[NodeSTManager] Error processing chat message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  // Add circle interaction methods
  async initCharacterCircle(character: Character): Promise<boolean> {
    try {
      return await this.nodeST.initCharacterCircle(character);
    } catch (error) {
      console.error('[NodeSTManager] Circle init error:', error);
      return false;
    }
  }

  async processCircleInteraction(options: CirclePostOptions): Promise<CircleResponse> {
    try {
      return await this.nodeST.processCircleInteraction(options);
    } catch (error) {
      console.error('[NodeSTManager] Circle interaction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Create and export a singleton instance
export const NodeSTManager = new NodeSTManagerClass();
