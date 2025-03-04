import { NodeST, CirclePostOptions, CircleResponse } from '@/NodeST/nodest';
import { Character, GlobalSettings } from '@/shared/types';
import { CircleManager } from '@/NodeST/nodest/managers/circle-manager';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Add this import
import { StorageUtils } from '@/utils/storage-utils';
import { ApiDebugger } from '@/utils/api-debug';

export interface NodeSTResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface ProcessCircleInteractionParams {
  characterId: string;
  postAuthorId?: string;
  postContent?: string;
  commentContent?: string;
  commentAuthor?: string;
  context?: string;
  apiKey: string;
  apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
  type: 'newPost' | 'replyToPost' | 'replyToComment';
}

export class NodeSTManager {
  private static nodeST: NodeST = new NodeST();
  private static circleManager: CircleManager | null = null;

  // Updates NodeST with global API settings
  private static updateNodeSTWithAPISettings(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>) {
    // Update the NodeST instance with the API key
    this.nodeST.setApiKey(apiKey || '');
    
    // Log current API settings
    console.log('[NodeSTManager] Using API settings:', {
      provider: apiSettings?.apiProvider || 'gemini',
      openRouterEnabled: apiSettings?.openrouter?.enabled || false,
      openRouterModel: apiSettings?.openrouter?.model || 'default'
    });
  }

  // Initialize or get CircleManager with proper settings
  private static getCircleManager(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>): CircleManager {
    console.log(`[NodeSTManager] Creating CircleManager with API provider:`, apiSettings?.apiProvider);
    
    if (apiSettings?.apiProvider === 'openrouter' && apiSettings.openrouter?.enabled) {
      console.log(`[NodeSTManager] OpenRouter enabled with model:`, apiSettings.openrouter.model);
      console.log(`[NodeSTManager] OpenRouter API key length:`, apiSettings.openrouter.apiKey?.length || 0);
    }
    
    // Create or update CircleManager with current settings
    if (!this.circleManager) {
      this.circleManager = new CircleManager(apiKey, apiSettings);
    } else {
      // Make sure we update the settings each time
      this.circleManager.updateApiSettings(apiKey, apiSettings);
    }
    
    return this.circleManager;
  }

  static async processChatMessage(params: {
    userMessage: string;
    conversationId: string;
    status: '新建角色' | '同一角色继续对话' | '更新人设';
    apiKey: string;
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    character: Character;
  }): Promise<NodeSTResponse> {
    try {
      console.log('[NodeSTManager] Processing request:', {
        status: params.status,
        conversationId: params.conversationId,
        hasCharacter: !!params.character,
        characterId: params.character?.id,
        hasJsonData: !!params.character?.jsonData,
        apiKeyLength: params.apiKey?.length || 0,
        apiProvider: params.apiSettings?.apiProvider || 'gemini'
      });

      if (!params.character.jsonData) {
        throw new Error('Character data (jsonData) is missing');
      }

      // Update NodeST with API settings
      this.updateNodeSTWithAPISettings(params.apiKey, params.apiSettings);

      // Process chat message with API settings
      console.log('[NodeSTManager] Calling NodeST.processChatMessage with conversationId:', params.conversationId);
      const response = await this.nodeST.processChatMessage({
        userMessage: params.userMessage,
        conversationId: params.conversationId,
        status: params.status,
        apiKey: params.apiKey,
        apiSettings: params.apiSettings,
        jsonString: params.character.jsonData
      });

      console.log('[NodeSTManager] Received response:', {
        success: response.success,
        hasText: !!response.response,
        errorMessage: response.error,
        textPreview: response.response?.substring(0, 50)
      });

      return {
        success: response.success,
        text: response.response,
        error: response.error
      };
    } catch (error) {
      console.error('[NodeSTManager] Processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Add circle interaction methods
  static async initCharacterCircle(character: Character, apiKey?: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>): Promise<boolean> {
    try {
      // Update NodeST with API settings
      this.updateNodeSTWithAPISettings(apiKey || '', apiSettings);
      return await this.nodeST.initCharacterCircle(character);
    } catch (error) {
      console.error('[NodeSTManager] Circle init error:', error);
      return false;
    }
  }

  /**
   * Process circle interactions with OpenRouter support and better API settings handling
   */
  static async processCircleInteraction(params: ProcessCircleInteractionParams): Promise<CircleResponse> {
    try {
      console.log(`[NodeSTManager] Processing circle interaction, type: ${params.type}`);
      
      // Use ApiDebugger for better logging
      ApiDebugger.logOpenRouterSettings('NodeSTManager', params.apiSettings);
      
      // If no API settings provided, try to get from storage
      if (!params.apiSettings || !params.apiSettings.apiProvider) {
        console.log('[NodeSTManager] No API settings provided, trying to get from storage');
        const storedSettings = await StorageUtils.getApiSettings();
        if (storedSettings) {
          console.log('[NodeSTManager] Found API settings in storage');
          params.apiSettings = storedSettings;
          // Use ApiDebugger again for updated settings
          ApiDebugger.logOpenRouterSettings('NodeSTManager - From Storage', params.apiSettings);
        }
      }
      
      // Update NodeST with API settings
      this.updateNodeSTWithAPISettings(params.apiKey, params.apiSettings);
      
      // Get CircleManager with updated settings
      const circleManager = this.getCircleManager(params.apiKey, params.apiSettings);
      
      // Create post options
      const circleOptions: CirclePostOptions = {
        type: params.type,
        content: {
          authorId: params.postAuthorId || '',
          authorName: params.commentAuthor,
          text: params.postContent || '',
          context: params.context
        },
        responderId: params.characterId,
        characterId: params.characterId
      };
      
      // Process with CircleManager directly to ensure API settings are applied
      const response = await circleManager.circlePost(circleOptions, params.apiKey);
      
      console.log(`[NodeSTManager] Circle interaction response success: ${response.success}`);
      
      return response;
    } catch (error) {
      console.error('[NodeSTManager] Circle interaction error:', error);
      return { 
        success: false, 
        error: `处理朋友圈互动失败: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}
