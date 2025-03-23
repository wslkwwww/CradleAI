import { Message } from '../types';
import { AddMemoryOptions, SearchMemoryOptions } from '../memory.types';

/**
 * Mem0 记忆服务单例
 * 用于全局访问记忆相关功能
 */
class Mem0Service {
  private static instance: Mem0Service | null = null;
  // Make memoryRef public so it can be accessed by other services
  public memoryRef: any = null; // Add a reference to the memory instance
  
  private memoryActions: {
    add: (messages: string | Message[], options: AddMemoryOptions) => Promise<any>;
    search: (query: string, options: SearchMemoryOptions) => Promise<any>;
    get: (memoryId: string) => Promise<any>;
    update: (memoryId: string, data: string) => Promise<any>;
    delete: (memoryId: string) => Promise<any>;
    reset: () => Promise<any>;
  } | null = null;
  
  private initialized = false;
  private isEmbeddingAvailable = true; // 跟踪嵌入服务是否可用
  
  // 记录最近处理的记忆ID，用于后续更新AI响应
  private lastProcessedMemoryIds: string[] = [];
  
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
      
      // 处理AI回复，如果有待更新的记忆，为它们添加AI响应
      if (role === 'bot' && this.lastProcessedMemoryIds.length > 0) {
        console.log(`[Mem0Service] 收到AI回复，长度: ${message.length}字符，将更新${this.lastProcessedMemoryIds.length}条记忆的AI响应字段`);
        await this.updateAIResponseForMemories(this.lastProcessedMemoryIds, message);
        return;
      }
      
      // 如果是用户消息，先尝试搜索相关记忆
      if (role === 'user') {
        try {
          console.log(`[Mem0Service] 用户消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}", 正在检索相关记忆...`);
          
          // 搜索相关记忆来提供上下文
          const searchResults = await this.searchMemories(
            message,
            characterId,
            conversationId,
            5 // 检索最相关的5条记忆
          );
          
          const resultCount = searchResults?.results?.length || 0;
          if (resultCount > 0) {
            console.log(`[Mem0Service] 为用户消息找到 ${resultCount} 条相关记忆:`);
            
            // 详细记录每条记忆
            interface SearchResult {
              id: string;
              memory: string;
              score: number;
              metadata?: {
                aiResponse?: string;
                [key: string]: any;
              };
            }

            searchResults.results.forEach((item: SearchResult, index: number) => {
              console.log(`[Mem0Service] 记忆 #${index + 1} (ID: ${item.id}):`);
              console.log(`  内容: ${item.memory}`);
              console.log(`  相似度得分: ${item.score}`);
              if (item.metadata?.aiResponse) {
              console.log(`  AI响应: ${item.metadata.aiResponse.substring(0, 100)}${item.metadata.aiResponse.length > 100 ? '...' : ''}`);
              }
            });
          } else {
            console.log('[Mem0Service] 没有找到相关记忆');
          }
        } catch (searchError) {
          console.warn('[Mem0Service] 搜索相关记忆时出错:', searchError);
        }
      }
      
      // 只处理用户消息，为AI回复的情况已在上面处理过
      if (role !== 'user') {
        console.log('[Mem0Service] 跳过单独的AI回复消息，没有待更新的用户消息记忆');
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
      
      // 清空上次处理的记忆ID，准备记录新的ID
      this.lastProcessedMemoryIds = [];
      
      if (factsCount > 0) {
        console.log(`[Mem0Service] 提取的事实详情:`);
        
        // 收集这次处理中添加或更新的记忆ID
        const processedIds: string[] = [];
        
        result.results.forEach((item: { id: string; memory: string; metadata?: any }, index: number) => {
          console.log(`  事实 #${index + 1} (ID: ${item.id}): ${item.memory}`);
          if (item.metadata?.event) {
            console.log(`    操作类型: ${item.metadata.event}`);
            
            // 如果是添加或更新操作，记录ID以便后续更新AI响应
            if (item.metadata.event === 'ADD' || item.metadata.event === 'UPDATE') {
              processedIds.push(item.id);
            }
          }
          if (item.metadata?.previousMemory) {
            console.log(`    之前内容: ${item.metadata.previousMemory}`);
          }
        });
        
        // 保存这次处理的记忆ID，以便下次AI回复时更新
        if (processedIds.length > 0) {
          this.lastProcessedMemoryIds = processedIds;
          console.log(`[Mem0Service] 已记录 ${processedIds.length} 个待更新的记忆ID，等待AI回复后更新AI响应字段`);
        }
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
   * 更新记忆的AI响应字段
   * @param memoryIds 待更新的记忆ID数组
   * @param aiResponse AI回复内容
   */
  private async updateAIResponseForMemories(memoryIds: string[], aiResponse: string): Promise<void> {
    try {
      if (!this.memoryRef || !memoryIds || memoryIds.length === 0 || !aiResponse) {
        console.log('[Mem0Service] 无更新任务或缺少必要参数，跳过AI响应更新');
        return;
      }
      
      // 过滤掉无效的记忆ID（null、undefined或空字符串）
      const validMemoryIds = memoryIds.filter(id => id && id.trim() !== '');
      if (validMemoryIds.length === 0) {
        console.log('[Mem0Service] 没有有效的记忆ID需要更新，跳过处理');
        this.lastProcessedMemoryIds = [];
        return;
      }
      
      // 截断过长的AI响应
      const maxResponseLength = 1000;
      const truncatedResponse = aiResponse.length > maxResponseLength 
        ? aiResponse.substring(0, maxResponseLength) + "..." 
        : aiResponse;
      
      console.log(`[Mem0Service] 正在为 ${validMemoryIds.length} 条记忆更新AI响应`);
      console.log(`[Mem0Service] 响应内容前50字符: "${truncatedResponse.substring(0, 50)}${truncatedResponse.length > 50 ? '...' : ''}"`);
      
      // 调用memory实例的方法更新AI响应
      if (this.memoryRef && typeof this.memoryRef.updateAIResponse === 'function') {
        try {
          await this.memoryRef.updateAIResponse(validMemoryIds, truncatedResponse);
          console.log(`[Mem0Service] 成功更新 ${validMemoryIds.length} 条记忆的AI响应字段`);
          
          // 记录更新的记忆ID，方便调试
          if (validMemoryIds.length <= 5) {
            console.log(`[Mem0Service] 更新的记忆ID: ${validMemoryIds.join(', ')}`);
          } else {
            console.log(`[Mem0Service] 更新的记忆ID (前5条): ${validMemoryIds.slice(0, 5).join(', ')}`);
          }
        } catch (updateError) {
          console.error('[Mem0Service] 批量更新AI响应失败，尝试逐个更新:', updateError);
          
          // 如果批量更新失败，尝试逐个更新
          let successCount = 0;
          for (const memoryId of validMemoryIds) {
            try {
              await this.memoryRef.updateAIResponse([memoryId], truncatedResponse);
              successCount++;
            } catch (singleError) {
              console.error(`[Mem0Service] 更新单条记忆 ${memoryId} 的AI响应失败:`, singleError);
            }
          }
          
          if (successCount > 0) {
            console.log(`[Mem0Service] 逐个更新方式成功更新了 ${successCount}/${validMemoryIds.length} 条记忆的AI响应`);
          } else {
            console.error(`[Mem0Service] 所有记忆的AI响应更新都失败了`);
          }
        }
      } else {
        console.warn('[Mem0Service] memory实例不支持updateAIResponse方法，无法更新AI响应');
      }
      
      // 清空处理过的记忆ID
      this.lastProcessedMemoryIds = [];
    } catch (error) {
      console.error('[Mem0Service] 更新AI响应失败:', error);
      
      // 清空处理过的记忆ID，避免失败后重复尝试
      this.lastProcessedMemoryIds = [];
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
    console.log(`[Mem0Service] 搜索参数: characterId=${characterId}, conversationId=${conversationId}, limit=${limit}`);
    
    try {
      // 记录搜索开始时间，用于计算搜索耗时
      const searchStartTime = Date.now();
      
      const results = await this.memoryActions!.search(
        query,
        {
          userId: 'current-user',
          agentId: characterId,
          runId: conversationId,
          limit
        }
      );
      
      // 计算搜索耗时
      const searchEndTime = Date.now();
      const searchTime = searchEndTime - searchStartTime;
      
      // 计算结果数量
      const resultCount = results.results?.length || 0;
      console.log(`[Mem0Service] 搜索结果: 找到 ${resultCount} 条记忆, 搜索耗时: ${searchTime}ms`);
      
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
          console.log(`    相似度: ${typeof item.score === 'number' ? item.score.toFixed(4) : item.score}`);
          console.log(`    创建时间: ${item.createdAt}`);
          if (item.updatedAt) {
            console.log(`    最后更新: ${item.updatedAt}`);
          }
          if (item.metadata && Object.keys(item.metadata).length > 0) {
            // Check specifically for aiResponse
            if (item.metadata.aiResponse) {
              const aiResponse = String(item.metadata.aiResponse);
              console.log(`    AI响应: ${aiResponse.substring(0, 100)}${aiResponse.length > 100 ? '...' : ''}`);
            }
            
            // Log other metadata too
            const otherMetadata = { ...item.metadata };
            delete otherMetadata.aiResponse; // Remove aiResponse since we already logged it
            
            if (Object.keys(otherMetadata).length > 0) {
              console.log(`    其他元数据: ${JSON.stringify(otherMetadata)}`);
            }
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
  
  /**
   * 更新嵌入器API密钥
   * @param apiKey 智谱API密钥
   */
  public updateEmbedderApiKey(apiKey: string): void {
    try {
      if (!this.initialized || !this.memoryRef) {
        console.warn('[Mem0Service] 记忆服务尚未初始化，无法更新嵌入器API密钥');
        return;
      }
      
      if (!apiKey) {
        console.warn('[Mem0Service] API密钥为空，跳过更新');
        return;
      }
      
      console.log('[Mem0Service] 正在更新嵌入器API密钥', apiKey.length > 0 ? `长度: ${apiKey.length}` : '空API密钥');
      
      // 直接调用记忆实例的方法更新API密钥
      if (typeof this.memoryRef.updateEmbedderApiKey === 'function') {
        this.memoryRef.updateEmbedderApiKey(apiKey);
        console.log('[Mem0Service] 成功更新嵌入器API密钥');
      } else if (this.memoryRef.embedder && typeof this.memoryRef.embedder.updateApiKey === 'function') {
        // 如果记忆实例没有专门的方法，尝试直接访问嵌入器
        this.memoryRef.embedder.updateApiKey(apiKey);
        console.log('[Mem0Service] 通过直接访问嵌入器更新API密钥');
      } else {
        console.warn('[Mem0Service] 记忆实例或嵌入器不支持更新API密钥');
      }
    } catch (error) {
      console.error('[Mem0Service] 更新嵌入器API密钥时出错:', error);
    }
  }
}

export default Mem0Service;
