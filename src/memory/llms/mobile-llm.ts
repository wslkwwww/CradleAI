import { LLM, LLMResponse } from './base';
import { LLMConfig, Message } from '../types';

/**
 * 适用于移动端的 LLM 实现
 * 集成 openrouter-adapter 和 gemini-adapter 的功能
 */
export class MobileLLM implements LLM {
  // 添加默认初始值以解决 TS2564 错误
  private apiKey: string = '';
  private model: string = 'gpt-4-turbo';
  private apiEndpoint: string = 'https://api.openai.com/v1/chat/completions';
  private provider: 'openai' | 'gemini' | 'openrouter' = 'gemini';
  private llmAdapter: any = null; // 兼容已有适配器
  private apiProvider: string = 'gemini';
  private openrouterConfig: any = {};
  private pendingInitialization: Promise<void> | null = null;
  private lastConfig: LLMConfig | null = null;
  
  constructor(config: LLMConfig) {
    // 保存原始配置参考
    this.lastConfig = {...config};
    this.updateConfig(config);
  }

  /**
   * 更新LLM配置
   * 可用于动态更新API密钥和模型设置
   * @param config LLM配置
   */
  public updateConfig(config: LLMConfig): void {
    // 验证输入配置
    if (!config) {
      console.error('[MobileLLM] 更新配置失败: 配置对象为空');
      return;
    }
    
    // 保存原始API密钥，用于记录和比较
    const originalApiKey = this.apiKey;
    const originalProvider = this.apiProvider;
    
    // 确保新的API密钥有效
    const newApiKey = config.apiKey || this.apiKey || '';
    if (!newApiKey) {
      console.warn('[MobileLLM] 检测到尝试将API密钥设置为空，当前状态:', {
        原密钥长度: originalApiKey.length,
        新密钥长度: 0,
        lastConfigKeyLength: this.lastConfig?.apiKey?.length || 0
      });
      
      // 如果有上一个有效密钥，使用它
      if (this.lastConfig?.apiKey) {
        console.warn('[MobileLLM] 恢复使用上一个有效密钥');
        config.apiKey = this.lastConfig.apiKey;
      }
    }
    
    // 更新配置，确保apiKey有值
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4-turbo';
    this.apiEndpoint = config.url || 'https://api.openai.com/v1/chat/completions';
    this.apiProvider = config.apiProvider || 'gemini';
    this.openrouterConfig = config.openrouter || {};
    
    // 如果有有效的API密钥，保存配置引用
    if (this.apiKey) {
      this.lastConfig = {...config};
    }
    
    // 打印详细的配置变更信息
    const apiKeyChanged = originalApiKey !== this.apiKey;
    const providerChanged = originalProvider !== this.apiProvider;
    
    console.log(`[MobileLLM] 配置已更新:`, {
      apiProvider: this.apiProvider,
      model: this.model,
      apiKeyStatus: this.apiKey ? '已设置' : '未设置',
      apiKeyLength: this.apiKey?.length || 0,
      apiKeyChanged: apiKeyChanged ? '是' : '否',
      providerChanged: providerChanged ? '是' : '否',
      apiKeyFirstChars: this.apiKey ? this.apiKey.substring(0, 4) + '...' : 'N/A'
    });
    
    // 只有当API密钥或提供商变更时才重置适配器
    if (apiKeyChanged || providerChanged) {
      console.log('[MobileLLM] API密钥或提供商已变更，重置适配器');
      this.llmAdapter = null;
      this.provider = this.apiProvider === 'openrouter' ? 'openrouter' : 'gemini';
      
      // 如果有API密钥，尝试立即初始化适配器
      if (this.apiKey) {
        this.pendingInitialization = this.initializeAdapter().catch(err => {
          console.warn(`[MobileLLM] 初始化适配器失败: ${err.message}`);
          this.pendingInitialization = null;
        });
      } else {
        console.warn('[MobileLLM] 无法初始化适配器：API密钥为空');
        this.pendingInitialization = null;
      }
    } else {
      console.log('[MobileLLM] API密钥和提供商未变更，跳过适配器重置');
    }
  }

  /**
   * 初始化适配器
   */
  private async initializeAdapter(): Promise<void> {
    if (!this.apiKey) {
      console.warn('[MobileLLM] 无法初始化适配器: API密钥为空');
      return;
    }
    
    // 保存一份用于初始化的密钥副本，防止在初始化过程中被修改
    const initApiKey = this.apiKey;
    const initModel = this.model;
    const initProvider = this.provider;
    
    try {
      console.log(`[MobileLLM] 开始初始化${initProvider}适配器，密钥长度: ${initApiKey.length}，前4字符: ${initApiKey.substring(0, 4)}...`);
      
      if (initProvider === 'openrouter') {
        try {
          const { OpenRouterAdapter } = require('@/NodeST/nodest/utils/openrouter-adapter');
          this.llmAdapter = new OpenRouterAdapter(
            initApiKey, 
            initModel || this.openrouterConfig?.model || 'gpt-3.5-turbo'
          );
          console.log('[MobileLLM] OpenRouterAdapter 同步初始化成功');
        } catch (error) {
          console.log('[MobileLLM] 同步初始化失败，尝试异步导入');
          const { OpenRouterAdapter } = await import('@/NodeST/nodest/utils/openrouter-adapter');
          this.llmAdapter = new OpenRouterAdapter(
            initApiKey, 
            initModel || this.openrouterConfig?.model || 'gpt-3.5-turbo'
          );
          console.log('[MobileLLM] OpenRouterAdapter 异步初始化成功');
        }
      } else {
        try {
          // 使用 require 而不是 import，避免异步导入可能导致的问题
          const { GeminiAdapter } = require('@/NodeST/nodest/utils/gemini-adapter');
          this.llmAdapter = new GeminiAdapter(initApiKey);
          console.log('[MobileLLM] GeminiAdapter 同步初始化成功');
        } catch (error) {
          console.log('[MobileLLM] 同步初始化失败，尝试异步导入 GeminiAdapter');
          // 尝试异步导入
          const modulePath = '@/NodeST/nodest/utils/gemini-adapter';
          console.log(`[MobileLLM] 尝试从 ${modulePath} 导入`);
          
          try {
            const { GeminiAdapter } = await import(modulePath);
            this.llmAdapter = new GeminiAdapter(initApiKey);
            console.log('[MobileLLM] GeminiAdapter 异步初始化成功');
          } catch (importError) {
            console.error('[MobileLLM] 异步导入失败，尝试直接导入:', importError);
            
            // 最后尝试 services 目录
            try {
              const { GeminiAdapter } = await import('@/NodeST/nodest/utils/gemini-adapter');
              this.llmAdapter = new GeminiAdapter(initApiKey);
              console.log('[MobileLLM] 从 services 目录 GeminiAdapter 初始化成功');
            } catch (finalError) {
              console.error('[MobileLLM] 所有导入尝试均失败:', finalError);
              throw new Error('无法导入 GeminiAdapter: ' + (finalError instanceof Error ? finalError.message : String(finalError)));
            }
          }
        }
      }
      
      // 确认适配器已正确初始化
      if (this.llmAdapter) {
        console.log('[MobileLLM] 适配器初始化成功，验证密钥状态');
        if (typeof this.llmAdapter.apiKey === 'string') {
          console.log(`[MobileLLM] 适配器密钥状态: 已设置，长度 ${this.llmAdapter.apiKey.length}`);
        } else {
          console.warn('[MobileLLM] 适配器密钥异常: ' + (typeof this.llmAdapter.apiKey));
        }
      }
    } catch (error) {
      console.error(`[MobileLLM] 初始化适配器失败:`, error);
      throw error;
    }
  }

  /**
   * 确保适配器已初始化
   */
  private async ensureAdapter(): Promise<void> {
    // 如果有正在进行的初始化，等待它完成
    if (this.pendingInitialization) {
      await this.pendingInitialization;
      this.pendingInitialization = null;
    }
    
    // 额外检查并记录API密钥状态
    if (!this.apiKey) {
      // 检查我们是否有上一个配置中的API密钥
      if (this.lastConfig?.apiKey) {
        console.warn('[MobileLLM] 当前API密钥为空，恢复使用上一个有效密钥');
        this.apiKey = this.lastConfig.apiKey;
      } else {
        console.error('[MobileLLM] API密钥为空，无法使用LLM服务');
        throw new Error('API key cannot be empty');
      }
    }
    
    if (!this.llmAdapter) {
      console.log(`[MobileLLM] 适配器未初始化，正在尝试初始化... (API密钥长度: ${this.apiKey.length})`);
      await this.initializeAdapter();
      
      if (!this.llmAdapter) {
        throw new Error(`无法初始化 ${this.provider} 适配器`);
      }
    }
    
    // 添加额外的适配器检查
    try {
      if (this.provider === 'openrouter' && this.llmAdapter.apiKey !== this.apiKey) {
        console.log('[MobileLLM] OpenRouter适配器密钥不匹配，重新初始化');
        await this.initializeAdapter();
      } else if (this.provider === 'gemini' && this.llmAdapter.apiKey !== this.apiKey) {
        console.log('[MobileLLM] Gemini适配器密钥不匹配，重新初始化');
        await this.initializeAdapter();
      }
    } catch (error) {
      console.error('[MobileLLM] 重新初始化适配器失败:', error);
      // 不抛出异常，继续尝试使用现有适配器
    }
    
    // 最终适配器验证
    if (!this.llmAdapter) {
      console.error('[MobileLLM] 所有初始化尝试失败，无法生成响应');
      throw new Error('无法初始化LLM适配器');
    }
  }

  /**
   * 将消息格式转换为适配器需要的格式
   */
  private formatMessages(messages: Message[]): any[] {
    if (this.provider === 'gemini') {
      // Gemini 格式
      return messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
      }));
    } else {
      // OpenRouter/OpenAI 格式
      return messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }));
    }
  }

  /**
   * 生成响应
   * @param messages 消息数组
   * @param responseFormat 响应格式配置
   * @param tools 可用工具
   * @returns 生成的响应文本或结构化响应
   */
  async generateResponse(
    messages: Message[],
    responseFormat?: { type: string },
    tools?: any[]
  ): Promise<string | LLMResponse> {
    try {
      // 请求前再次检查API密钥
      if (!this.apiKey && this.lastConfig?.apiKey) {
        console.warn('[MobileLLM] 生成响应时发现API密钥为空，恢复使用上一个有效密钥');
        this.apiKey = this.lastConfig.apiKey;
      }
      
      if (!this.apiKey) {
        console.error('[MobileLLM] 调用generateResponse时API密钥为空');
        throw new Error('API key cannot be empty');
      }
      
      await this.ensureAdapter();
      
      // 如果是 JSON 格式响应，添加格式化提示
      if (responseFormat?.type === 'json_object') {
        const lastMessage = messages[messages.length - 1];
        const enhancedContent = typeof lastMessage.content === 'string'
          ? `${lastMessage.content}\n请以有效的JSON格式响应。`
          : lastMessage.content;
        
        messages = [
          ...messages.slice(0, -1),
          { ...lastMessage, content: enhancedContent }
        ];
      }
      
      // 适配不同的 LLM 接口
      const formattedMessages = this.formatMessages(messages);
      
      // 确保适配器存在
      if (!this.llmAdapter) {
        console.error('[MobileLLM] 适配器为null，无法生成内容');
        throw new Error('LLM adapter is not initialized');
      }
      
      console.log(`[MobileLLM] 开始生成内容，提供商: ${this.provider}，模型: ${this.model}，消息数: ${messages.length}`);
      
      // 使用适配器生成内容前，再次检查API密钥
      if (typeof this.llmAdapter.apiKey !== 'string' || !this.llmAdapter.apiKey) {
        console.warn('[MobileLLM] 适配器API密钥无效，尝试设置');
        
        if (this.provider === 'openrouter' && this.llmAdapter.setApiKey) {
          this.llmAdapter.setApiKey(this.apiKey);
        } else if (this.provider === 'gemini') {
          // 重新初始化Gemini适配器
          await this.initializeAdapter();
        }
      }
      
      // 使用适配器生成内容
      const response = await this.llmAdapter.generateContent(formattedMessages);
      console.log(`[MobileLLM] 成功生成内容，响应长度: ${typeof response === 'string' ? response.length : 'unknown'}`);
      
      // 如果使用了工具调用，需要解析响应
      if (tools && tools.length > 0 && typeof response === 'string' && response.includes('"name"') && response.includes('"arguments"')) {
        try {
          // 尝试解析响应中的工具调用
          const responseObj = JSON.parse(response);
          if (responseObj.tool_calls || responseObj.toolCalls) {
            const toolCalls = responseObj.tool_calls || responseObj.toolCalls;
            return {
              content: responseObj.content || '',
              role: 'assistant',
              toolCalls: toolCalls.map((call: any) => ({
                name: call.function?.name || call.name,
                arguments: call.function?.arguments || call.arguments
              }))
            };
          }
        } catch (e) {
          // 如果解析失败，返回原始响应
          console.warn('解析工具调用失败，返回原始响应:', e);
        }
      }
      
      return response;
    } catch (error) {
      console.error('生成 LLM 响应失败:', error);
      throw error;
    }
  }

  /**
   * 生成聊天响应
   * @param messages 消息数组
   * @returns 生成的聊天响应
   */
  async generateChat(messages: Message[]): Promise<LLMResponse> {
    try {
      // 请求前再次检查API密钥
      if (!this.apiKey && this.lastConfig?.apiKey) {
        console.warn('[MobileLLM] 生成聊天响应时发现API密钥为空，恢复使用上一个有效密钥');
        this.apiKey = this.lastConfig.apiKey;
      }
      
      if (!this.apiKey) {
        console.error('[MobileLLM] 调用generateChat时API密钥为空');
        throw new Error('API key cannot be empty');
      }
      
      await this.ensureAdapter();
      
      const formattedMessages = this.formatMessages(messages);
      const response = await this.llmAdapter.generateContent(formattedMessages);
      
      return {
        content: typeof response === 'string' ? response : response.content || '',
        role: 'assistant'
      };
    } catch (error) {
      console.error('生成聊天响应失败:', error);
      throw error;
    }
  }
}
