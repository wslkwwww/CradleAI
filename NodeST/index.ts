import { NodeSTCore } from './nodest/core/node-st-core';
import { Character } from '@/shared/types';

export class NodeST {
  private coreInstances: { [key: string]: NodeSTCore } = {};

  private getCoreInstance(
    apiKey: string, 
    apiSettings?: { 
      apiProvider: 'gemini' | 'openrouter', 
      openrouter?: { 
        enabled: boolean, 
        apiKey: string, 
        model: string 
      } 
    }
  ): NodeSTCore {
    // 使用apiKey作为实例缓存的键
    if (!this.coreInstances[apiKey]) {
      console.log('[NodeST] Creating new NodeSTCore instance with API provider:', 
        apiSettings?.apiProvider || 'gemini');
      this.coreInstances[apiKey] = new NodeSTCore(apiKey);
    } else {
      // 更新现有实例的API设置
      this.coreInstances[apiKey].updateApiSettings(apiKey);
    }
    return this.coreInstances[apiKey];
  }

  async processChatMessage(params: {
    userMessage: string,
    conversationId: string,
    status: string,
    apiKey: string,
    apiSettings?: { 
      apiProvider: 'gemini' | 'openrouter', 
      openrouter?: { 
        enabled: boolean, 
        apiKey: string, 
        model: string 
      } 
    },
    jsonString?: string
  }): Promise<string> {
    try {
      // 获取NodeSTCore实例
      const core = this.getCoreInstance(params.apiKey, params.apiSettings);
      
      // 处理聊天消息
      const response = await core.continueChat(
        params.conversationId,
        params.userMessage,
        params.apiKey
      );
      
      return response || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('[NodeST] Error in processChatMessage:', error);
      throw error;
    }
  }

  async clearConversation(conversationId: string): Promise<void> {
    // 清除会话相关的数据
    // 此功能实现在NodeSTCore内部
    console.log('[NodeST] Clearing conversation:', conversationId);
  }

  // 其他可能需要的方法...
}
