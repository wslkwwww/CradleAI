/**
 * Utility for debugging API settings
 */
export class ApiDebugger {
  static logOpenRouterSettings(
    source: string,
    apiSettings?: {
      apiProvider?: string;
      openrouter?: {
        enabled?: boolean;
        apiKey?: string;
        model?: string;
      };
    }
  ) {
    console.log(`[${source}] API Provider:`, apiSettings?.apiProvider || 'not set');
    
    if (apiSettings?.apiProvider === 'openrouter') {
      console.log(`[${source}] OpenRouter Enabled:`, apiSettings?.openrouter?.enabled || false);
      console.log(`[${source}] OpenRouter Model:`, apiSettings?.openrouter?.model || 'not set');
      console.log(`[${source}] OpenRouter API Key:`, apiSettings?.openrouter?.apiKey ? 'present' : 'missing');
    }
  }
}
