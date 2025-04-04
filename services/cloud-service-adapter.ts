/**
 * Cloud Service Adapter
 * 
 * Provides an adapter layer to simplify interaction with the CloudServiceProvider
 */

import { CloudServiceProvider } from './cloud-service-provider';
import { licenseService } from './license-service';
import { API_CONFIG } from '@/constants/api-config';
import { OpenRouterModel } from '@/shared/types/api-types';

/**
 * Message formats used in different APIs
 */
type StandardMessage = {
  role: string;
  content: string | {
    type?: string;
    text?: string;
    image_url?: string;
  }[];
};

type SimplifiedMessage = {
  role: string;
  content: string;
};

export class CloudServiceAdapter {
  /**
   * Generate chat completion via CradleAI cloud service
   */
  static async generateChatCompletion(
    messages: StandardMessage[],
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
      [key: string]: any;
    } = {}
  ): Promise<any> {
    try {
      // Validate license first
      const licenseInfo = await licenseService.getLicenseInfo();
      if (!licenseInfo || !licenseInfo.isValid) {
        throw new Error('许可证无效或未激活，请在设置中配置有效的激活码');
      }
      
      // Normalize messages format for CradleAI
      const normalizedMessages = messages.map(msg => {
        if (typeof msg.content === 'string') {
          return {
            role: msg.role,
            content: msg.content
          };
        } else if (Array.isArray(msg.content)) {
          // Handle multimodal content (text + images)
          // For now, we just extract text parts and concatenate them
          const textParts = msg.content
            .filter(part => part.text || (part.type === 'text'))
            .map(part => part.text || '')
            .join('\n');
          
          return {
            role: msg.role,
            content: textParts || '(No text content)'
          };
        }
        
        // Fallback
        return {
          role: msg.role,
          content: JSON.stringify(msg.content)
        };
      });
      
      // Use the model from options or get the default from CloudServiceProvider
      const model = options.model || CloudServiceProvider.getPreferredModel();
      
      // Generate the completion, passing the model parameter explicitly
      const response = await CloudServiceProvider.generateChatCompletion(
        normalizedMessages,
        {
          ...options,
          model: model
        }
      );
      
      // Parse the JSON response
      const responseData = await response.json();
      
      return responseData;
    } catch (error) {
      console.error('[CloudServiceAdapter] Error generating completion:', error);
      throw error;
    }
  }
  
  /**
   * Get list of available models from CradleAI or directly from OpenRouter
   */
  static async listAvailableModels(): Promise<any> {
    try {
      // Try to get license info, but don't fail if it's not available
      const licenseInfo = await licenseService.getLicenseInfo().catch(() => null);
      
      // Try using cloud service provider if it's available and enabled
      if (licenseInfo?.isValid && CloudServiceProvider.isEnabled()) {
        try {
          console.log('[CloudServiceAdapter] 尝试通过云服务获取模型列表');
          const modelsData = await CloudServiceProvider.listModels?.();
          return modelsData;
        } catch (cloudError) {
          console.warn('[CloudServiceAdapter] 通过云服务获取模型失败，尝试直接获取:', cloudError);
          // Fall through to direct fetch
        }
      } else {
        console.log('[CloudServiceAdapter] 云服务未启用或许可证无效，将直接从 OpenRouter 获取模型');
      }
      
      // If cloud service is not available or failed, fetch directly from OpenRouter
      return await CloudServiceAdapter.fetchOpenRouterModels();
    } catch (error) {
      console.error('[CloudServiceAdapter] Error listing models:', error);
      throw error;
    }
  }
  
  /**
   * Fetch models directly from OpenRouter public endpoint
   */
  static async fetchOpenRouterModels(): Promise<any> {
    console.log('[CloudServiceAdapter] 直接从 OpenRouter 获取模型列表');
    
    try {
      // We don't have an API key here, so use the public endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://openrouter.ai/api/v1/models?auth=nokey', {
        method: 'GET',
        headers: {
          'HTTP-Referer': 'https://github.com',
          'X-Title': 'AI Chat App'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const modelData = await response.json();
      console.log(`[CloudServiceAdapter] 成功直接从 OpenRouter 获取 ${modelData.data?.length || 0} 个模型`);
      
      // Filter out "Auto Router" before returning
      if (modelData?.data && Array.isArray(modelData.data)) {
        modelData.data = modelData.data.filter(model => 
          model.id !== 'openrouter/auto' && 
          model.name !== 'Auto Router'
        );
      }
      
      return modelData;
    } catch (error) {
      console.error('[CloudServiceAdapter] 直接从 OpenRouter 获取模型失败:', error);
      
      // Return a fallback set of models if fetch fails
      console.log('[CloudServiceAdapter] 返回默认的模型列表');
      return {
        data: CloudServiceAdapter.getDefaultModels()
      };
    }
  }
  
  /**
   * Get a list of default models when API calls fail
   */
  static getDefaultModels(): OpenRouterModel[] {
    return [
      {
        id: "openai/gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        description: "Most capable GPT-3.5 model for chat and text generation",
        context_length: 16385,
        pricing: { 
          prompt: "0.0000015", 
          completion: "0.000002" 
        },
        provider: { id: "openai", name: "OpenAI" }
      },
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        description: "OpenAI's most advanced model for complex tasks",
        context_length: 8192,
        pricing: { 
          prompt: "0.00003", 
          completion: "0.00006" 
        },
        provider: { id: "openai", name: "OpenAI" }
      },
      {
        id: "anthropic/claude-3-opus",
        name: "Claude 3 Opus",
        description: "Anthropic's most capable model for complex tasks",
        context_length: 200000,
        pricing: { 
          prompt: "0.00005", 
          completion: "0.00015" 
        },
        provider: { id: "anthropic", name: "Anthropic" }
      },
      {
        id: "google/gemini-pro",
        name: "Gemini Pro",
        description: "Google's largest model for sophisticated tasks",
        context_length: 30720,
        pricing: { 
          prompt: "0.000005", 
          completion: "0.000005" 
        },
        provider: { id: "google", name: "Google" }
      },
      {
        id: "meta-llama/llama-3-8b-instruct",
        name: "Llama 3 8B Instruct",
        description: "Open source model from Meta, optimized for instruction following",
        context_length: 8192,
        pricing: { 
          prompt: "0", 
          completion: "0" 
        },
        provider: { id: "meta", name: "Meta" }
      },
      {
        id: "mistralai/mistral-small",
        name: "Mistral Small",
        description: "Lightweight model for efficient text generation",
        context_length: 8192,
        pricing: { 
          prompt: "0.000002", 
          completion: "0.000002" 
        },
        provider: { id: "mistral", name: "Mistral AI" }
      },
    ];
  }
  
  /**
   * Format the response from CradleAI to match the expected format
   * @param responseData Raw response data from CradleAI
   */
  static formatChatResponse(responseData: any): any {
    // If the response is already in the expected format, return it as is
    if (responseData.choices && Array.isArray(responseData.choices)) {
      return responseData;
    }
    
    // Otherwise, attempt to format it
    try {
      return {
        id: responseData.id || `cradle-${Date.now()}`,
        object: responseData.object || 'chat.completion',
        created: responseData.created || Math.floor(Date.now() / 1000),
        model: responseData.model || 'unknown',
        choices: [
          {
            index: 0,
            message: {
              role: responseData.message?.role || 'assistant',
              content: responseData.message?.content || responseData.content || '',
            },
            finish_reason: responseData.finish_reason || 'stop'
          }
        ],
        usage: responseData.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      console.error('[CloudServiceAdapter] Error formatting response:', error);
      throw new Error('Failed to format response data');
    }
  }
  
  /**
   * Check if cloud service is available and properly configured
   */
  static async isAvailable(): Promise<boolean> {
    try {
      // Check if license is valid
      const licenseInfo = await licenseService.getLicenseInfo();
      if (!licenseInfo || !licenseInfo.isValid) {
        return false;
      }
      
      // Check if cloud service is enabled
      return CloudServiceProvider.isEnabled();
    } catch (error) {
      console.error('[CloudServiceAdapter] Error checking availability:', error);
      return false;
    }
  }
}
