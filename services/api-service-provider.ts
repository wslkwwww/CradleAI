import { ApiSettings } from '@/shared/types/api-types';
import { GeminiAdapter } from '@/NodeST/nodest/utils/gemini-adapter';
import { OpenRouterAdapter } from '@/NodeST/nodest/utils/openrouter-adapter';
import { ChatMessage } from '@/shared/types';

interface ServiceOptions {
  apiProvider?: string;
  openrouter?: {
    enabled?: boolean;
    apiKey?: string;
    model?: string;
    autoRoute?: boolean;
    useBackupModels?: boolean;
    backupModels?: string[];
  };
  additionalGeminiKeys?: string[];
  useGeminiModelLoadBalancing?: boolean;
  useGeminiKeyRotation?: boolean;
  geminiPrimaryModel?: string;
  geminiBackupModel?: string;
  retryDelay?: number;
}

/**
 * 提供API服务选择和管理的工具类
 * 可以根据设置选择使用Gemini或OpenRouter
 */
export class ApiServiceProvider {
  private static geminiAdapterInstances: Record<string, GeminiAdapter> = {};
  private static openRouterAdapterInstances: Record<string, OpenRouterAdapter> = {};
  
  /**
   * Clean up resources associated with API adapters
   */
  public static dispose() {
    // Dispose all Gemini adapters
    Object.values(this.geminiAdapterInstances).forEach(adapter => {
      if (adapter && typeof adapter.dispose === 'function') {
        adapter.dispose();
      }
    });
    
    this.geminiAdapterInstances = {};
    this.openRouterAdapterInstances = {};
  }
  
  /**
   * 获取适合当前设置的API适配器
   * @param apiKey API密钥
   * @param apiSettings API设置
   * @returns 适配器实例
   */
  static getAdapter(
    apiKey: string, 
    apiSettings?: ApiSettings, 
    options: Partial<ServiceOptions> = {}
  ): GeminiAdapter | OpenRouterAdapter {
    console.log(`【API服务】获取适配器，提供商=${apiSettings?.apiProvider || 'gemini'}`);
    
    // 如果使用OpenRouter且启用了OpenRouter设置
    if (apiSettings?.apiProvider === 'openrouter' &&
        apiSettings.openrouter?.enabled &&
        apiSettings.openrouter?.apiKey) {
      
      const cacheKey = `openrouter-${apiSettings.openrouter.apiKey}-${apiSettings.openrouter.model}`;
      
      // 检查缓存中是否有实例
      if (!this.openRouterAdapterInstances[cacheKey]) {
        console.log(`【API服务】创建新的OpenRouter适配器实例，模型=${apiSettings.openrouter.model}`);
        this.openRouterAdapterInstances[cacheKey] = new OpenRouterAdapter(
          apiSettings.openrouter.apiKey,
          apiSettings.openrouter.model
        );
      } else {
        console.log(`【API服务】使用现有OpenRouter适配器实例`);
      }
      
      return this.openRouterAdapterInstances[cacheKey];
    }
    
    // Extract options
    const additionalKeys = options.additionalGeminiKeys || [];
    const useModelLoadBalancing = options.useGeminiModelLoadBalancing || false;
    const useKeyRotation = options.useGeminiKeyRotation || false;
    const primaryModel = options.geminiPrimaryModel;
    const backupModel = options.geminiBackupModel;
    const retryDelay = options.retryDelay;
    
    // 生成gemini适配器的缓存键，考虑到负载均衡设置和模型设置
    const geminiCacheKey = `gemini-${apiKey}-lb${useModelLoadBalancing ? 1 : 0}-kr${useKeyRotation ? 1 : 0}-keys${additionalKeys.length}-pm${primaryModel || 'default'}-bm${backupModel || 'default'}`;
    
    // 检查缓存中是否有实例
    if (!this.geminiAdapterInstances[geminiCacheKey] && apiKey) {
      console.log(`【API服务】创建新的Gemini适配器实例，启用模型负载均衡: ${useModelLoadBalancing}, 启用密钥轮换: ${useKeyRotation}, 额外密钥数: ${additionalKeys.length}`);
      
      // Create adapter with all options
      this.geminiAdapterInstances[geminiCacheKey] = new GeminiAdapter(apiKey, {
        additionalKeys,
        useModelLoadBalancing,
        useKeyRotation,
        primaryModel,
        backupModel,
        retryDelay
      });
    } else if (this.geminiAdapterInstances[geminiCacheKey]) {
      console.log(`【API服务】使用现有Gemini适配器实例，更新配置`);
      // 更新现有实例的配置
      const adapter = this.geminiAdapterInstances[geminiCacheKey];
      adapter.updateSettings({
        additionalKeys,
        useModelLoadBalancing,
        useKeyRotation,
        primaryModel,
        backupModel,
        retryDelay
      });
    } else if (!apiKey) {
      console.error(`【API服务】缺少Gemini API密钥`);
      // 创建一个没有API密钥的适配器，这会在调用时失败，但避免了null异常
      return new GeminiAdapter('', {
        useModelLoadBalancing,
        useKeyRotation
      });
    }
    
    return this.geminiAdapterInstances[geminiCacheKey];
  }
  
  /**
   * 清除适配器缓存
   */
  static clearAdapterCache(): void {
    console.log(`【API服务】清除适配器缓存，共 ${
      Object.keys(this.geminiAdapterInstances).length + 
      Object.keys(this.openRouterAdapterInstances).length
    } 个实例`);
    
    this.geminiAdapterInstances = {};
    this.openRouterAdapterInstances = {};
  }
  
  /**
   * 发送生成请求到当前选择的API
   * @param messages 消息数组
   * @param apiKey API密钥
   * @param options 服务选项
   * @returns 生成的文本内容
   */
  static async generateContent(
    messages: ChatMessage[],
    apiKey: string,
    options: ServiceOptions = {}
  ): Promise<string> {
    console.log(`【API服务】发送生成请求，消息数量=${messages.length}`);
    
    const apiProvider = options.apiProvider || 'gemini';

    if (apiProvider === 'openrouter' && options.openrouter?.enabled) {
      return await this.generateWithOpenRouter(messages, options.openrouter);
    } else {
      return await this.generateWithGemini(
        messages, 
        apiKey, 
        options
      );
    }
  }

  /**
   * 使用Gemini API生成内容
   * @param messages 消息数组
   * @param apiKey 主API密钥
   * @param options 服务选项
   * @returns 生成的文本
   */
  private static async generateWithGemini(
    messages: ChatMessage[], 
    apiKey: string,
    options: ServiceOptions = {}
  ): Promise<string> {
    try {
      // 获取或创建适配器
      const adapter = this.getAdapter(apiKey, { apiProvider: 'gemini' }, options) as GeminiAdapter;
      
      // 记录请求开始时间
      const startTime = Date.now();
      
      // 发送请求
      const response = await adapter.generateContent(messages);
      
      // 计算请求耗时
      const duration = Date.now() - startTime;
      console.log(`【API服务】Gemini请求完成，耗时=${duration}ms，响应长度=${response.length}`);
      
      return response;
    } catch (error) {
      console.error('【API服务】使用Gemini生成内容失败:', error);
      throw error;
    }
  }

  /**
   * 使用OpenRouter API生成内容
   * @param messages 消息数组
   * @param options OpenRouter选项
   * @returns 生成的文本
   */
  private static async generateWithOpenRouter(
    messages: ChatMessage[],
    options: ServiceOptions['openrouter'] = {}
  ): Promise<string> {
    try {
      // 获取或创建适配器
      const adapter = this.getAdapter(options.apiKey || '', {
        apiProvider: 'openrouter',
        openrouter: {
          enabled: true,
          apiKey: options.apiKey || '',
          model: options.model || 'openai/gpt-3.5-turbo'
        }
      }) as OpenRouterAdapter;
      
      // 记录请求开始时间
      const startTime = Date.now();
      
      // 发送请求
      const response = await adapter.generateContent(messages);
      
      // 计算请求耗时
      const duration = Date.now() - startTime;
      console.log(`【API服务】OpenRouter请求完成，耗时=${duration}ms，响应长度=${response.length}`);
      
      return response;
    } catch (error) {
      console.error('【API服务】使用OpenRouter生成内容失败:', error);
      throw error;
    }
  }
}
