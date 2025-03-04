/**
 * Utility class for debugging API interactions
 */
export class ApiDebugger {
  /**
   * Log OpenRouter settings for debugging
   * @param source Component/module name for the log
   * @param settings API settings object
   */
  static logOpenRouterSettings(source: string, settings?: {
    apiProvider?: 'gemini' | 'openrouter',
    openrouter?: {
      enabled?: boolean,
      apiKey?: string,
      model?: string
    }
  }) {
    console.log(`[${source}] OpenRouter Settings:`, {
      apiProvider: settings?.apiProvider || 'not set',
      enabled: settings?.openrouter?.enabled || false,
      hasApiKey: settings?.openrouter?.apiKey ? 'yes (length: ' + settings.openrouter.apiKey.length + ')' : 'no',
      model: settings?.openrouter?.model || 'not set'
    });
  }
  
  /**
   * Log chat message processing
   * @param source Component/module name for the log
   * @param options Message processing options for logging
   */
  static logChatProcessing(source: string, options: {
    conversationId: string,
    messageLength: number,
    characterInfo?: {
      id: string,
      name: string
    }
  }) {
    console.log(`[${source}] Processing chat message:`, {
      conversationId: options.conversationId,
      messageLength: options.messageLength,
      characterId: options.characterInfo?.id || 'unknown',
      characterName: options.characterInfo?.name || 'unknown'
    });
  }
  
  /**
   * Log chat response
   * @param source Component/module name for the log
   * @param response Response data
   */
  static logChatResponse(source: string, response: {
    success: boolean,
    text?: string,
    error?: string
  }) {
    console.log(`[${source}] Chat response:`, {
      success: response.success,
      textLength: response.text?.length || 0,
      textPreview: response.text?.substring(0, 50) + (response.text && response.text.length > 50 ? '...' : ''),
      error: response.error || 'none'
    });
  }
}
