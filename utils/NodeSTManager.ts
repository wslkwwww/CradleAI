import { NodeST, CirclePostOptions, CircleResponse } from '@/NodeST/nodest';
import { Character } from '@/shared/types';

export interface NodeSTResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export class NodeSTManager {
  private static nodeST = new NodeST();

  // Add more detailed logging to help diagnose issues
  static async processChatMessage(params: {
    userMessage: string;
    conversationId: string;
    status: '新建角色' | '同一角色继续对话' | '更新人设';
    apiKey: string;
    character: Character;
  }): Promise<NodeSTResponse> {
    try {
      console.log('[NodeSTManager] Processing request:', {
        status: params.status,
        conversationId: params.conversationId,
        hasCharacter: !!params.character,
        characterId: params.character?.id,
        hasJsonData: !!params.character?.jsonData,
        apiKeyLength: params.apiKey?.length || 0
      });

      if (!params.character.jsonData) {
        throw new Error('Character data (jsonData) is missing');
      }

      console.log('[NodeSTManager] Calling NodeST.processChatMessage with conversationId:', params.conversationId);
      const response = await this.nodeST.processChatMessage({
        userMessage: params.userMessage,
        conversationId: params.conversationId,
        status: params.status,
        apiKey: params.apiKey,
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
  static async initCharacterCircle(character: Character): Promise<boolean> {
    try {
      return await this.nodeST.initCharacterCircle(character);
    } catch (error) {
      console.error('[NodeSTManager] Circle init error:', error);
      return false;
    }
  }

  static async processCircleInteraction(options: CirclePostOptions): Promise<CircleResponse> {
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
