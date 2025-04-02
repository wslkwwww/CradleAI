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
    add: (messages: string | Message[], options: AddMemoryOptions, isMultiRound?: boolean) => Promise<any>;
    search: (query: string, options: SearchMemoryOptions) => Promise<any>;
    get: (memoryId: string) => Promise<any>;
    update: (memoryId: string, data: string) => Promise<any>;
    delete: (memoryId: string) => Promise<any>;
    reset: () => Promise<any>;
  } | null = null;
  
  private initialized = false;
  // Change to public to allow direct manipulation in emergency situations
  public isEmbeddingAvailable = true; // 跟踪嵌入服务是否可用
  
  // 记录最近处理的记忆ID，用于后续更新AI响应
  private lastProcessedMemoryIds: string[] = [];
  
  // 添加消息缓存，按角色和对话ID组织
  private messageCache: {
    [characterId: string]: {
      [conversationId: string]: {
        messages: Array<{ message: string; role: 'user' | 'bot'; timestamp: string }>;
        userMessageCount: number;
      };
    };
  } = {};
  
  // 设置每10轮用户消息处理一次记忆
  private processingInterval: number = 10;
  
  // 启用/禁用记忆功能
  private memoryEnabled: boolean = true;
  
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
    add: (messages: string | Message[], options: AddMemoryOptions, isMultiRound?: boolean) => Promise<any>;
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
      // 尝试从AsyncStorage获取，优先使用这个方法
      if (typeof require !== 'undefined') {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const settings = await AsyncStorage.getItem('user_settings');
          if (settings) {
            const parsedSettings = JSON.parse(settings);
            if (parsedSettings?.chat?.zhipuApiKey) {
              console.log('[Mem0Service] 从AsyncStorage成功获取zhipuApiKey，长度:', 
                parsedSettings.chat.zhipuApiKey.length);
              return parsedSettings.chat.zhipuApiKey;
            }
          }
        } catch (e) {
          console.log('[Mem0Service] 从AsyncStorage获取设置失败:', e);
        }
      }
      
      // 尝试从localStorage获取（备用）
      if (typeof localStorage !== 'undefined') {
        const settings = localStorage.getItem('user_settings');
        if (settings) {
          try {
            const parsedSettings = JSON.parse(settings);
            if (parsedSettings?.chat?.zhipuApiKey) {
              console.log('[Mem0Service] 从localStorage成功获取zhipuApiKey');
              return parsedSettings.chat.zhipuApiKey;
            }
          } catch (e) {
            console.error('[Mem0Service] 解析localStorage中的设置失败:', e);
          }
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
      
      // 如果嵌入服务不可用或记忆功能被禁用，记录消息但不尝试添加
      if (!this.isEmbeddingAvailable || !this.memoryEnabled) {
        console.log(`[Mem0Service] ${!this.isEmbeddingAvailable ? '嵌入服务不可用' : '记忆功能已禁用'}，记录消息但不添加到向量存储`);
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
      
      // 初始化缓存结构
      if (!this.messageCache[characterId]) {
        this.messageCache[characterId] = {};
      }
      if (!this.messageCache[characterId][conversationId]) {
        this.messageCache[characterId][conversationId] = {
          messages: [],
          userMessageCount: 0
        };
      }
      
      // 添加当前消息到缓存
      const timestamp = new Date().toISOString();
      this.messageCache[characterId][conversationId].messages.push({
        message,
        role,
        timestamp
      });
      
      // 如果是用户消息，增加计数
      if (role === 'user') {
        this.messageCache[characterId][conversationId].userMessageCount++;
        console.log(`[Mem0Service] 缓存用户消息，当前计数: ${this.messageCache[characterId][conversationId].userMessageCount}/${this.processingInterval}`);
      }
      
      // 检查是否达到处理间隔（每10轮用户消息处理一次）
      if (this.messageCache[characterId][conversationId].userMessageCount >= this.processingInterval) {
        console.log(`[Mem0Service] 达到处理间隔 ${this.processingInterval} 轮，开始处理缓存记忆`);
        await this.processMessageCache(characterId, conversationId);
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
    }
  }
  
  /**
   * 处理消息缓存，提取并保存记忆
   * @param characterId 角色ID
   * @param conversationId 会话ID
   */
  private async processMessageCache(
    characterId: string,
    conversationId: string
  ): Promise<void> {
    try {
      if (!this.messageCache[characterId]?.[conversationId]) {
        console.log(`[Mem0Service] 没有找到角色ID=${characterId}，会话ID=${conversationId}的消息缓存`);
        return;
      }
      
      const cache = this.messageCache[characterId][conversationId];
      
      // 构建多轮对话格式
      let conversationText = "";
      cache.messages.forEach((msg, index) => {
        const speaker = msg.role === 'user' ? '用户' : 'AI';
        conversationText += `${speaker}: ${msg.message}\n\n`;
      });
      
      console.log(`[Mem0Service] 处理 ${cache.userMessageCount} 轮对话, 共 ${cache.messages.length} 条消息，角色ID=${characterId}`);
      console.log(`[Mem0Service] 对话内容预览: ${conversationText.substring(0, 100)}...`);
      
      // 调用记忆系统处理多轮对话
      const result = await this.memoryActions!.add(
        conversationText,
        {
          userId: 'current-user',
          agentId: characterId,
          runId: conversationId,
          metadata: {
            timestamp: new Date().toISOString(),
            role: 'user', // 使用user角色，让系统提取事实
            isMultiRound: true // 在元数据中标记这是多轮对话
          }
        },
        true  // 明确标记这是多轮对话处理
      );
      
      // 记录生成的事实
      const factsCount = result.results?.length || 0;
      console.log(`[Mem0Service] 成功添加多轮对话记忆，生成了 ${factsCount} 条事实`);
      
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
      
      // 重置缓存
      this.messageCache[characterId][conversationId] = {
        messages: [],
        userMessageCount: 0
      };
      console.log(`[Mem0Service] 已重置消息缓存，准备下一轮收集`);
      
    } catch (error) {
      console.error('[Mem0Service] 处理消息缓存失败:', error);
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
      if (!this.initialized) {
        console.warn('[Mem0Service] 记忆服务尚未初始化，无法更新嵌入器API密钥');
        return;
      }
      
      if (!apiKey) {
        console.warn('[Mem0Service] API密钥为空，跳过更新');
        return;
      }
      
      console.log('[Mem0Service] 正在更新嵌入器API密钥', apiKey.length > 0 ? `长度: ${apiKey.length}` : '空API密钥');
      
      // 直接调用记忆实例的方法更新API密钥
      if (this.memoryRef && typeof this.memoryRef.updateEmbedderApiKey === 'function') {
        this.memoryRef.updateEmbedderApiKey(apiKey);
        console.log('[Mem0Service] 成功更新嵌入器API密钥');
        // Reset embedding availability flag
        this.isEmbeddingAvailable = true;
      } else if (this.memoryRef && this.memoryRef.embedder && typeof this.memoryRef.embedder.updateApiKey === 'function') {
        // 如果记忆实例没有专门的方法，尝试直接访问嵌入器
        this.memoryRef.embedder.updateApiKey(apiKey);
        console.log('[Mem0Service] 通过直接访问嵌入器更新API密钥');
        // Reset embedding availability flag
        this.isEmbeddingAvailable = true;
      } else {
        console.warn('[Mem0Service] 记忆实例或嵌入器不支持更新API密钥');
      }
      
      // 保存API密钥到AsyncStorage以便其他地方访问
      this.saveZhipuApiKeyToStorage(apiKey);
    } catch (error) {
      console.error('[Mem0Service] 更新嵌入器API密钥时出错:', error);
    }
  }
  
  /**
   * 将智谱API密钥保存到存储中
   * @param apiKey 智谱API密钥
   */
  private async saveZhipuApiKeyToStorage(apiKey: string): Promise<void> {
    try {
      if (typeof require !== 'undefined') {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const settingsStr = await AsyncStorage.getItem('user_settings');
        
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          if (!settings.chat) settings.chat = {};
          
          // 仅在密钥不同时更新
          if (settings.chat.zhipuApiKey !== apiKey) {
            settings.chat.zhipuApiKey = apiKey;
            await AsyncStorage.setItem('user_settings', JSON.stringify(settings));
            console.log('[Mem0Service] 已将智谱API密钥保存到AsyncStorage');
          }
        }
      }
    } catch (error) {
      console.error('[Mem0Service] 保存智谱API密钥到存储失败:', error);
    }
  }
  
  // 允许外部设置处理间隔
  public setProcessingInterval(interval: number): void {
    if (interval < 1) {
      console.warn('[Mem0Service] Invalid processing interval, must be at least 1');
      return;
    }
    
    this.processingInterval = interval;
    console.log(`[Mem0Service] 记忆处理间隔已更新为 ${interval} 轮`);
  }
  
  // 获取当前处理间隔
  public getProcessingInterval(): number {
    return this.processingInterval;
  }
  
  public setMemoryEnabled(enabled: boolean): void {
    this.memoryEnabled = enabled;
    console.log(`[Mem0Service] 记忆系统 ${enabled ? '已启用' : '已禁用'}`);
    
    // 如果禁用，清空所有缓存的消息
    if (!enabled) {
      this.messageCache = {};
      console.log('[Mem0Service] 已清空所有消息缓存');
    }
  }
  
  public isMemoryEnabled(): boolean {
    return this.memoryEnabled;
  }
  
  /**
   * 手动处理当前角色的记忆缓存
   * @param characterId 角色ID（可选，如果不提供则处理当前对话的角色）
   * @param conversationId 会话ID（可选，如果不提供则处理当前对话）
   */
  public async processCurrentMemories(characterId?: string, conversationId?: string): Promise<void> {
    try {
      // 如果没有提供角色ID和会话ID，尝试查找有缓存消息的第一个角色和会话
      if (!characterId || !conversationId) {
        for (const charId of Object.keys(this.messageCache)) {
          if (Object.keys(this.messageCache[charId]).length > 0) {
            characterId = charId;
            conversationId = Object.keys(this.messageCache[charId])[0];
            break;
          }
        }
      }
      
      // 检查指定的角色和会话是否有缓存的消息
      if (!characterId || !conversationId || !this.messageCache[characterId]?.[conversationId]) {
        console.log('[Mem0Service] 没有找到需要处理的消息缓存');
        return;
      }
      
      console.log(`[Mem0Service] 手动处理角色 ${characterId} 的记忆缓存`);
      await this.processMessageCache(characterId, conversationId);
      console.log(`[Mem0Service] 手动处理完成`);
    } catch (error) {
      console.error('[Mem0Service] 手动处理记忆缓存失败:', error);
      throw error;
    }
  }
  
  /**
   * 处理所有角色的记忆缓存
   */
  public async processAllCharacterMemories(): Promise<void> {
    try {
      const characterIds = Object.keys(this.messageCache);
      if (characterIds.length === 0) {
        console.log('[Mem0Service] 没有需要处理的记忆缓存');
        return;
      }
      
      console.log(`[Mem0Service] 开始处理所有角色的记忆缓存，共 ${characterIds.length} 个角色`);
      
      for (const characterId of characterIds) {
        const conversationIds = Object.keys(this.messageCache[characterId]);
        if (conversationIds.length === 0) continue;
        
        console.log(`[Mem0Service] 处理角色 ${characterId} 的记忆缓存，共 ${conversationIds.length} 个会话`);
        
        for (const conversationId of conversationIds) {
          if (this.messageCache[characterId][conversationId] && 
              this.messageCache[characterId][conversationId].messages.length > 0) {
            await this.processMessageCache(characterId, conversationId);
          }
        }
      }
      
      console.log('[Mem0Service] 所有角色的记忆缓存处理完成');
    } catch (error) {
      console.error('[Mem0Service] 处理所有角色记忆失败:', error);
      throw error;
    }
  }
}

export default Mem0Service;
