import { ApiSettings } from '@/shared/types/api-types';
import { GeminiAdapter } from '@/NodeST/nodest/utils/gemini-adapter';
import { OpenRouterAdapter } from '@/NodeST/nodest/utils/openrouter-adapter';

/**
 * 提供API服务选择和管理的工具类
 * 可以根据设置选择使用Gemini或OpenRouter
 */
export class ApiServiceProvider {
  private static geminiAdapterInstances: Record<string, GeminiAdapter> = {};
  private static openRouterAdapterInstances: Record<string, OpenRouterAdapter> = {};
  
  /**
   * 获取适合当前设置的API适配器
   * @param apiKey API密钥
   * @param apiSettings API设置
   * @returns 适配器实例
   */
  static getAdapter(apiKey: string, apiSettings?: ApiSettings): GeminiAdapter | OpenRouterAdapter {
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
    
    // 默认使用Gemini
    const cacheKey = `gemini-${apiKey}`;
    
    // 检查缓存中是否有实例
    if (!this.geminiAdapterInstances[cacheKey] && apiKey) {
      console.log(`【API服务】创建新的Gemini适配器实例`);
      this.geminiAdapterInstances[cacheKey] = new GeminiAdapter(apiKey);
    } else if (!apiKey) {
      console.error(`【API服务】缺少Gemini API密钥`);
      // 创建一个没有API密钥的适配器，这会在调用时失败，但避免了null异常
      return new GeminiAdapter('');
    } else {
      console.log(`【API服务】使用现有Gemini适配器实例`);
    }
    
    return this.geminiAdapterInstances[cacheKey];
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
   * @param apiSettings API设置
   * @returns 生成的文本内容
   */
  static async generateContent(
    messages: Array<{role: string; parts?: {text: string}[]; content?: string}>,
    apiKey: string,
    apiSettings?: ApiSettings
  ): Promise<string> {
    console.log(`【API服务】发送生成请求，消息数量=${messages.length}`);
    
    const adapter = this.getAdapter(apiKey, apiSettings);
    
    try {
      // 记录请求开始时间
      const startTime = Date.now();
      
      // 发送请求
      const response = await adapter.generateContent(messages);
      
      // 计算请求耗时
      const duration = Date.now() - startTime;
      console.log(`【API服务】请求完成，耗时=${duration}ms，响应长度=${response.length}`);
      
      return response;
    } catch (error) {
      console.error('【API服务】生成内容失败:', error);
      throw error;
    }
  }
}
