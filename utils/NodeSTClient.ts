import { NodeST, ProcessChatOptions } from '@/NodeST/nodest';
import { Character } from '@/constants/types';

interface NodeSTResponse {
  success: boolean;
  error?: string;
}

export class NodeSTClient {
  private static nodeST = new NodeST();

  static async initializeCharacter(
    characterId: string,
    apiKey: string,
    jsonData: any
  ): Promise<NodeSTResponse> {
    try {
      console.log('[NodeST] Initializing character:', characterId);

      const options: ProcessChatOptions = {
        userMessage: "你好！",
        conversationId: characterId,
        status: "新建角色",
        apiKey: apiKey,
        jsonString: JSON.stringify(jsonData)
      };

      await this.nodeST.processChatMessage(options);
      return { success: true };
      
    } catch (error) {
      console.error('[NodeST] Initialization error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async processChat(
    conversationId: string,
    apiKey: string,
    message: string,
    character: Character
  ): Promise<NodeSTResponse> {
    try {
      if (!character.jsonData) {
        throw new Error('Character data is missing');
      }

      const options: ProcessChatOptions = {
        userMessage: message,
        conversationId: conversationId,
        status: "同一角色继续对话",
        apiKey: apiKey,
        jsonString: character.jsonData
      };

      const response = await this.nodeST.processChatMessage(options);
      return { success: true };

    } catch (error) {
      console.error('[NodeST] Chat processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async updateCharacter(
    characterId: string,
    apiKey: string,
    jsonData: string
  ): Promise<NodeSTResponse> {
    try {
      const options: ProcessChatOptions = {
        userMessage: "更新设定",
        conversationId: characterId,
        status: "更新人设",
        apiKey: apiKey,
        jsonString: jsonData
      };

      await this.nodeST.processChatMessage(options);
      return { success: true };

    } catch (error) {
      console.error('[NodeST] Character update error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
