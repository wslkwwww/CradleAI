import { GlobalSettings } from '@/shared/types';
import { ApiProviderResponse } from '@/shared/types/api-types';
import { OpenRouterAdapter } from './adapters/openrouter-adapter';
import { GeminiAdapter } from './adapters/gemini-adapter';
import { OpenRouterSettings } from '@/shared/types/api-types';
export class ApiService {
  /**
   * Send a chat request to the appropriate API provider based on user settings
   */
  public static async sendChatRequest(
    messages: Array<{ role: string; content: string }>,
    settings: GlobalSettings['chat']
  ): Promise<ApiProviderResponse> {
    try {
      console.log(`【ApiService】使用API提供商: ${settings.apiProvider || 'gemini'}`);
      
      // Select the appropriate API provider
      if (settings.apiProvider === 'openrouter' && settings.openrouter && settings.openrouter.apiKey) {
        return await OpenRouterAdapter.sendChatRequest(
          messages,
          settings.openrouter as OpenRouterSettings
        );
      } else {
        // Default to Gemini
        return await GeminiAdapter.sendChatRequest(
          messages,
          settings.characterApiKey
        );
      }
    } catch (error) {
      console.error('【ApiService】发送聊天请求失败:', error);
      throw error;
    }
  }

  /**
   * Test connection to OpenRouter API
   */
  public static async testOpenRouterConnection(apiKey: string): Promise<boolean> {
    return await OpenRouterAdapter.testConnection(apiKey);
  }

  /**
   * Get available models from OpenRouter
   */
  public static async getOpenRouterModels(apiKey: string, forceRefresh = false): Promise<any> {
    return await OpenRouterAdapter.getModels(apiKey, forceRefresh);
  }
}
