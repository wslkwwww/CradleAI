/**
 * API types for various API providers
 */

/**
 * OpenRouter API settings
 */
export interface OpenRouterSettings {
    enabled: boolean;          // Whether OpenRouter is enabled
    apiKey: string;            // OpenRouter API key
    model: string;             // Selected model ID
    autoRoute: boolean;        // Whether to use auto-routing
    useBackupModels: boolean;  // Whether to use backup models
    backupModels: string[];    // List of backup model IDs
    sortingStrategy: 'price' | 'speed' | 'latency';  // Model sorting strategy
    dataCollection: boolean;   // Whether to allow data collection
    ignoredProviders: string[];  // List of providers to ignore
    quantizationLevel?: string;  // Optional quantization level
}

/**
 * OpenRouter API model information
 */
export interface OpenRouterModel {
    id: string;               // Model ID
    name: string;             // Model display name
    description?: string;     // Model description
    context_length?: number;  // Context window size
    pricing?: {
        prompt?: number;      // Cost per 1K input tokens
        completion?: number;  // Cost per 1K output tokens
    };
    provider?: {
        id?: string;          // Provider ID
        name?: string;        // Provider name
    };
}

/**
 * API provider settings container
 */
export interface ApiSettings {
    provider: 'gemini' | 'openrouter';  // Selected API provider
    gemini?: {
        apiKey: string;         // Gemini API key
    };
    openrouter?: OpenRouterSettings;  // OpenRouter settings
}

/**
 * OpenRouter API request parameters
 */
export interface OpenRouterRequest {
    model: string;
    messages: Array<{
      role: "user" | "system" | "assistant";
      content: string;
    }>;
    temperature: number;
    max_tokens: number;
    stream: boolean;
  }
  

export interface OpenRouterRequestParams {
    model: string;
    messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    top_k?: number;
    stop?: string[];
    tools?: any[];
    tool_choice?: any;
}

/**
 * OpenRouter API response format
 */
export interface OpenRouterResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    error?: {
        message: string;
    }
}

/**
 * OpenRouter 流式响应中的 Delta 对象
 */
export interface OpenRouterDelta {
    role?: string;
    content?: string;
}

/**
 * OpenRouter 错误响应
 */
export interface OpenRouterError {
    error: {
        message: string;
        type?: string;
        param?: string;
        code?: string;
    };
}

/**
 * OpenRouter 模型列表响应
 */
export interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}
