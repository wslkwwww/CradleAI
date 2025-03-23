import { Message } from '../types';
import { AddMemoryOptions, SearchMemoryOptions } from '../memory.types';

/**
 * Mem0 记忆服务单例
 * 用于全局访问记忆相关功能
 */
class Mem0Service {
  private static instance: Mem0Service | null = null;
  private memoryActions: {
    add: (messages: string | Message[], options: AddMemoryOptions) => Promise<any>;
    search: (query: string, options: SearchMemoryOptions) => Promise<any>;
    get: (memoryId: string) => Promise<any>;
    update: (memoryId: string, data: string) => Promise<any>;
    delete: (memoryId: string) => Promise<any>;
    reset: () => Promise<any>;
  } | null = null;
  private memoryRef: any = null; // Add a reference to the memory instance
  
  private initialized = false;
  private isEmbeddingAvailable = true; // 跟踪嵌入服务是否可用
  
  private constructor() {
    // 私有构造函数，防止外部直接创建实例
  }
  
  /**
   * 获取单例实例
   */
  public static getInstance(): Mem0Service {
    if (!Mem0Service.instance) {
      Mem0Service.instance = new Mem0Service();
    }
    return Mem0Service.instance;
  }
  
  /**
   * 初始化记忆服务
   * @param memoryActions 记忆相关操作函数
   * @param memoryRef 记忆实例引用（用于更新LLM配置）
   */
  public initialize(memoryActions: {
    add: (messages: string | Message[], options: AddMemoryOptions) => Promise<any>;
    search: (query: string, options: SearchMemoryOptions) => Promise<any>;
    get: (memoryId: string) => Promise<any>;
    update: (memoryId: string, data: string) => Promise<any>;
    delete: (memoryId: string) => Promise<any>;
    reset: () => Promise<any>;
  }, memoryRef?: any): void {
    this.memoryActions = memoryActions;
    this.memoryRef = memoryRef; // Store reference to the memory instance
    this.initialized = true;
    console.log('[Mem0Service] 记忆服务初始化成功');
    
    // 在初始化时检查API设置
    this.tryGetZhipuApiKey().then(apiKey => {
      if (apiKey) {
        console.log('[Mem0Service] 找到智谱API密钥，嵌入服务应该可用');
        this.isEmbeddingAvailable = true;
      } else {
        console.warn('[Mem0Service] 未找到智谱API密钥，嵌入服务可能不可用');
        this.isEmbeddingAvailable = false;
      }
    });
  }
  
  /**
   * 检查是否已初始化
   */
  private checkInitialized(): void {
    if (!this.initialized || !this.memoryActions) {
      console.error('[Mem0Service] 记忆服务尚未初始化');
      throw new Error('记忆服务尚未初始化');
    }
  }
  
  /**
   * 尝试从本地存储获取智谱API密钥
   */
  private async tryGetZhipuApiKey(): Promise<string | null> {
    try {
      // 尝试从localStorage获取
      if (typeof localStorage !== 'undefined') {
        const settings = localStorage.getItem('user_settings');
        if (settings) {
          try {
            const parsedSettings = JSON.parse(settings);
            if (parsedSettings?.chat?.zhipuApiKey) {
              return parsedSettings.chat.zhipuApiKey;
            }
          } catch (e) {
            console.error('[Mem0Service] 解析localStorage中的设置失败:', e);
          }
        }
      }
      
      // 尝试从AsyncStorage获取
      if (typeof require !== 'undefined') {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const settings = await AsyncStorage.getItem('user_settings');
          if (settings) {
            const parsedSettings = JSON.parse(settings);
            if (parsedSettings?.chat?.zhipuApiKey) {
              return parsedSettings.chat.zhipuApiKey;
            }
          }
        } catch (e) {
          console.log('[Mem0Service] 从AsyncStorage获取设置失败:', e);
        }
      }
    } catch (error) {
      console.error('[Mem0Service] 尝试获取智谱API密钥失败:', error);
    }
    return null;
  }
  
  /**
   * 添加聊天记忆
   * @param message 消息文本
   * @param role 角色 ('user' | 'bot')
   * @param characterId 角色ID
   * @param conversationId 会话ID
   */
  async addChatMemory(
    message: string,
    role: 'user' | 'bot',
    characterId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      this.checkInitialized();
      
      // 如果嵌入服务不可用，记录消息但不尝试添加
      if (!this.isEmbeddingAvailable) {
        console.log('[Mem0Service] 嵌入服务不可用，记录消息但不添加到向量存储');
        return;
      }
      
      if (!message || message.trim() === '') {
        console.log('[Mem0Service] 跳过空消息');
        return;
      }
      
      // 只处理用户消息，跳过AI回复
      if (role !== 'user') {
        console.log('[Mem0Service] 跳过AI回复消息，不提取事实');
        return;
      }
      
      console.log(`[Mem0Service] 处理用户消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      
      // 添加消息到记忆系统，加入角色信息
      const timestamp = new Date().toISOString();
      const result = await this.memoryActions!.add(message, {
        userId: 'current-user',
        agentId: characterId,
        runId: conversationId, // 使用会话ID作为运行ID
        metadata: {
          timestamp,
          role // 明确传递角色信息
        }
      });
      
      // 记录生成的事实
      const factsCount = result.results?.length || 0;
      console.log(`[Mem0Service] 成功添加记忆，生成了 ${factsCount} 条事实`);
      
      if (factsCount > 0) {
        console.log(`[Mem0Service] 提取的事实详情:`);
        result.results.forEach((item: { id: string; memory: string; metadata?: any }, index: number) => {
          console.log(`  事实 #${index + 1} (ID: ${item.id}): ${item.memory}`);
          if (item.metadata?.event) {
            console.log(`    操作类型: ${item.metadata.event}`);
          }
          if (item.metadata?.previousMemory) {
            console.log(`    之前内容: ${item.metadata.previousMemory}`);
          }
        });
      }
    } catch (error) {
      console.error('[Mem0Service] 添加聊天记忆失败:', error);
      
      // 判断错误类型
      if (error instanceof Error && error.message.includes('智谱嵌入API密钥未设置')) {
        console.warn('[Mem0Service] 智谱API密钥未设置，标记嵌入服务为不可用');
        this.isEmbeddingAvailable = false;
        
        // 尝试重新获取API密钥
        const apiKey = await this.tryGetZhipuApiKey();
        if (apiKey) {
          console.log('[Mem0Service] 找到API密钥，下次请求将尝试使用');
          this.isEmbeddingAvailable = true;
        }
      }
      
      // 不抛出错误，避免影响用户正常对话
      // throw error;
    }
  }
  
  /**
   * 搜索相关记忆
   * @param query 查询文本
   * @param characterId 角色ID
   * @param conversationId 对话ID
   * @param limit 结果数量限制
   */
  public async searchMemories(
    query: string,
    characterId: string,
    conversationId: string,
    limit: number = 5
  ): Promise<any> {
    this.checkInitialized();
    
    // 如果嵌入服务不可用，直接返回空结果
    if (!this.isEmbeddingAvailable) {
      console.log('[Mem0Service] 嵌入服务不可用，返回空搜索结果');
      return { results: [] };
    }
    
    console.log(`[Mem0Service] 开始搜索记忆: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    try {
      const results = await this.memoryActions!.search(
        query,
        {
          userId: 'current-user',
          agentId: characterId,
          runId: conversationId,
          limit
        }
      );
      
      // 计算结果数量
      const resultCount = results.results?.length || 0;
      console.log(`[Mem0Service] 搜索结果: 找到 ${resultCount} 条记忆`);
      
      // 完整打印每个结果
      if (resultCount > 0) {
        console.log(`[Mem0Service] 搜索结果详情:`);
        interface SearchResultItem {
          id: string;
          memory: string;
          score: number;
          createdAt: string;
          updatedAt?: string;
          metadata?: Record<string, unknown>;
        }

                results.results.forEach((item: SearchResultItem, index: number) => {
                  console.log(`  记忆 #${index + 1} (ID: ${item.id}):`);
                  console.log(`    内容: ${item.memory}`);
                  console.log(`    相似度: ${item.score}`);
                  console.log(`    创建时间: ${item.createdAt}`);
                  if (item.updatedAt) {
                    console.log(`    最后更新: ${item.updatedAt}`);
                  }
                  if (Object.keys(item.metadata || {}).length > 0) {
                    console.log(`    元数据: ${JSON.stringify(item.metadata)}`);
                  }
                });
      }
      
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Mem0Service] 搜索记忆失败: ${errorMessage}`);
      
      // 判断错误类型
      if (error instanceof Error && error.message.includes('智谱嵌入API密钥未设置')) {
        console.warn('[Mem0Service] 智谱API密钥未设置，标记嵌入服务为不可用');
        this.isEmbeddingAvailable = false;
        
        // 尝试重新获取API密钥
        this.tryGetZhipuApiKey().then(apiKey => {
          if (apiKey) {
            console.log('[Mem0Service] 找到API密钥，下次请求将尝试使用');
            this.isEmbeddingAvailable = true;
          }
        });
      }
      
      return { results: [] };
    }
  }
  
  /**
   * 更新LLM配置
   * @param config LLM配置
   */
  public updateLLMConfig(config: any): void {
    try {
      if (!this.initialized) {
        console.warn('[Mem0Service] 记忆服务尚未初始化，无法更新LLM配置');
        return;
      }
      
      if (!this.memoryRef || typeof this.memoryRef.updateLLMConfig !== 'function') {
        console.warn('[Mem0Service] 记忆实例引用不可用或不支持updateLLMConfig');
        return;
      }
      
      console.log('[Mem0Service] 更新LLM配置:', {
        apiProvider: config.apiProvider,
        model: config.model,
        apiKeyLength: config.apiKey?.length || 0
      });
      
      this.memoryRef.updateLLMConfig(config);
      console.log('[Mem0Service] LLM配置已更新成功');
    } catch (error) {
      console.error('[Mem0Service] 更新LLM配置时出错:', error);
    }
  }
}

export default Mem0Service;
