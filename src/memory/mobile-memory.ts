import { v4 as uuidv4 } from 'uuid';
import { md5 } from './utils/polyfills';
import { 
  MemoryConfig, 
  MemoryItem, 
  Message, 
  SearchFilters, 
  SearchResult 
} from './types';
import { 
  EmbedderFactory, 
  LLMFactory, 
  VectorStoreFactory 
} from './utils/factory';
import { 
  getFactRetrievalMessages, 
  getUpdateMemoryMessages, 
  removeCodeBlocks 
} from './prompts';
import { MobileSQLiteManager } from './storage/MobileSQLiteManager';
import { ConfigManager } from './config/manager';
import { 
  AddMemoryOptions, 
  SearchMemoryOptions, 
  DeleteAllMemoryOptions, 
  GetAllMemoryOptions 
} from './memory.types';
import {VectorStoreResult } from '@/src/memory/vector-stores/base';
import {LLMConfig} from '@/src/memory/types';
/**
 * 移动端记忆管理类
 */
export class MobileMemory {
  private config: MemoryConfig;
  private customPrompt: string | undefined;
  public embedder: any; // Make the embedder accessible
  private vectorStore: any;
  public llm: any; // 改为公共属性以便更新配置
  private db: MobileSQLiteManager;
  private collectionName: string;
  private apiVersion: string;

  constructor(config: Partial<MemoryConfig> = {}) {
    // 合并和验证配置
    this.config = ConfigManager.mergeConfig(config);

    this.customPrompt = this.config.customPrompt;
    this.embedder = EmbedderFactory.create(
      this.config.embedder.provider,
      this.config.embedder.config,
    );
    this.vectorStore = VectorStoreFactory.create(
      this.config.vectorStore.provider,
      this.config.vectorStore.config,
    );
    this.llm = LLMFactory.create(
      this.config.llm.provider,
      this.config.llm.config,
    );
    // 使用移动端 SQLite 管理器
    this.db = new MobileSQLiteManager(this.config.historyDbPath || "memory_history.db");
    this.collectionName = this.config.vectorStore.config.collectionName;
    this.apiVersion = this.config.version || "v1.0";
  }

  /**
   * 更新LLM配置
   * @param llmConfig 新的LLM配置
   */
  public updateLLMConfig(llmConfig: LLMConfig): void {
    // 确保API密钥有值
    if (!llmConfig.apiKey) {
      console.warn('[MobileMemory] 尝试用空API密钥更新LLM配置，忽略更新');
      return;
    }
    
    console.log('[MobileMemory] 正在更新LLM配置:', {
      provider: llmConfig.apiProvider,
      model: llmConfig.model,
      apiKeyLength: llmConfig.apiKey?.length || 0,
      apiKeyFirstChars: llmConfig.apiKey ? `${llmConfig.apiKey.substring(0, 3)}...` : 'none'
    });
    
    try {
      // 检查LLM实例是否存在
      if (!this.llm) {
        console.warn('[MobileMemory] LLM实例不存在，重新创建');
        this.llm = LLMFactory.create(
          this.config.llm.provider,
          llmConfig
        );
      } else if (typeof this.llm.updateConfig === 'function') {
        // 使用实例方法更新配置
        this.llm.updateConfig(llmConfig);
        console.log('[MobileMemory] LLM配置已通过updateConfig方法更新成功');
      } else {
        // 如果没有更新方法，重新创建实例
        console.log('[MobileMemory] LLM实例不支持updateConfig，重新创建实例');
        this.llm = LLMFactory.create(
          this.config.llm.provider,
          llmConfig
        );
      }
      
      // 更新内部配置引用
      this.config.llm.config = {
        ...this.config.llm.config,
        ...llmConfig
      };
      
      console.log('[MobileMemory] LLM配置已更新成功，当前API密钥长度:', llmConfig.apiKey?.length || 0);
      
      // 注意：智谱嵌入器不会基于LLM API密钥更新
      // 它需要单独的智谱API密钥，通过MemoryProvider配置提供
    } catch (error) {
      console.error('[MobileMemory] 更新LLM配置时出错:', error);
    }
  }

  /**
   * 更新嵌入器API密钥
   * @param apiKey 新的API密钥
   */
  public updateEmbedderApiKey(apiKey: string): void {
    if (!apiKey) {
      console.warn('[MobileMemory] 尝试用空API密钥更新嵌入器配置，忽略更新');
      return;
    }
    
    console.log('[MobileMemory] 正在更新嵌入器API密钥，长度:', apiKey.length);
    
    try {
      // 检查嵌入器实例是否存在
      if (!this.embedder) {
        console.warn('[MobileMemory] 嵌入器实例不存在，重新创建');
        this.embedder = EmbedderFactory.create(
          this.config.embedder.provider,
          { ...this.config.embedder.config, apiKey }
        );
      } else if (typeof this.embedder.updateApiKey === 'function') {
        // 使用实例方法更新API密钥
        this.embedder.updateApiKey(apiKey);
        console.log('[MobileMemory] 嵌入器API密钥已通过updateApiKey方法更新成功');
      } else {
        // 如果没有更新方法，重新创建实例
        console.log('[MobileMemory] 嵌入器实例不支持updateApiKey，重新创建实例');
        this.embedder = EmbedderFactory.create(
          this.config.embedder.provider,
          { ...this.config.embedder.config, apiKey }
        );
      }
      
      // 更新内部配置引用
      this.config.embedder.config.apiKey = apiKey;
      
      console.log('[MobileMemory] 嵌入器API密钥已更新成功');
    } catch (error) {
      console.error('[MobileMemory] 更新嵌入器API密钥时出错:', error);
    }
  }

  /**
   * 添加记忆
   * @param messages 消息内容（字符串或消息数组）
   * @param config 添加选项
   * @returns 搜索结果
   */
  async add(
    messages: string | Message[],
    config: AddMemoryOptions,
  ): Promise<SearchResult> {
    const {
      userId,
      agentId,
      runId,
      metadata = {},
      filters = {},
    } = config;

    if (userId) filters.userId = metadata.userId = userId;
    if (agentId) filters.agentId = metadata.agentId = agentId;
    if (runId) filters.runId = metadata.runId = runId;

    if (!filters.userId && !filters.agentId && !filters.runId) {
      throw new Error(
        "必须提供过滤条件之一: userId, agentId 或 runId!"
      );
    }

    const parsedMessages = Array.isArray(messages)
      ? messages
      : [{ role: "user" as const, content: messages }];

    // 对于简单实现，跳过视觉消息处理
    // 如果需要视觉支持，可以适配相关功能

    // 添加到向量存储
    const vectorStoreResult = await this.addToVectorStore(
      parsedMessages,
      metadata,
      filters,
    );

    return {
      results: vectorStoreResult,
    };
  }

  /**
   * 添加到向量存储
   * @param messages 消息数组
   * @param metadata 元数据
   * @param filters 过滤条件
   * @returns 记忆项数组
   */
  private async addToVectorStore(
    messages: Message[],
    metadata: Record<string, any>,
    filters: SearchFilters,
  ): Promise<MemoryItem[]> {
    // 检查消息的发送者，只处理用户消息
    if (metadata.role !== 'user') {
      console.log('[MobileMemory] 跳过处理非用户消息，不提取事实');
      return [];
    }

    console.log('[MobileMemory] 开始从用户消息中提取事实');
    
    // 获取消息内容
    const parsedMessages = messages.map((m) => 
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('\n');
    
    // 尝试获取最近的聊天上下文
    let recentMessages: string[] = [];
    let recentConversation: string = '';
    try {
      // 从index页面获取最近的5条消息作为上下文
      // 搜索最近的消息以提供上下文
      console.log('[MobileMemory] 搜索最近的消息作为上下文...');
      console.log('[MobileMemory] 使用过滤条件:', JSON.stringify(filters));
      
      const searchStartTime = Date.now();
      const searchResults = await this.vectorStore.search(
        await this.embedder.embed(parsedMessages),
        10, // 增加搜索数量以确保能获取到足够的用户-AI对话对
        filters,
      );
      const searchEndTime = Date.now();
      
      console.log(`[MobileMemory] 上下文搜索完成，耗时: ${searchEndTime - searchStartTime}ms`);
      console.log(`[MobileMemory] 上下文搜索结果数量: ${searchResults?.length || 0}`);
      
      if (searchResults && searchResults.length > 0) {
        // 记录一些详细的搜索结果信息
        console.log('[MobileMemory] 上下文搜索结果详情:');
        interface SearchResultPayload {
          id: string;
          data?: string;
          aiResponse?: string;
          score?: number;
        }

        interface SearchResult {
          id: string;
          payload: SearchResultPayload;
          score?: number;
        }

                searchResults.slice(0, 3).forEach((result: SearchResult, idx: number) => {
                  console.log(`  结果 #${idx + 1} - ID: ${result.id}, 相似度: ${result.score?.toFixed(4) || 'N/A'}`);
                  console.log(`    内容: ${result.payload.data?.substring(0, 50)}${(result.payload.data?.length ?? 0) > 50 ? '...' : ''}`);
                  if (result.payload.aiResponse) {
                    console.log(`    AI响应: ${result.payload.aiResponse?.substring(0, 50)}${result.payload.aiResponse?.length > 50 ? '...' : ''}`);
                  }
                });
        
        // 按时间戳排序，确保我们获取最新的消息
        interface SearchResultPayload {
          timestamp: string;
          [key: string]: any;
        }

        interface SearchResultItem {
          payload: SearchResultPayload;
          [key: string]: any;
        }

        const sortedResults = searchResults
          .filter((result: SearchResultItem) => result.payload && result.payload.timestamp)
          .sort((a: SearchResultItem, b: SearchResultItem) => {
            const dateA = new Date(a.payload.timestamp).getTime();
            const dateB = new Date(b.payload.timestamp).getTime(); 
            return dateB - dateA; // 降序排列，最新的在前
          });
        
        // 从排序后的结果中取前5条消息
        const latestResults = sortedResults.slice(0, 5);
        
        if (latestResults.length > 0) {
          console.log(`[MobileMemory] 获取到 ${latestResults.length} 条最近消息作为上下文`);
          
          // 将消息按时间升序重新排序，形成自然对话流
          // Define interfaces for the payload and message
          interface MessagePayload {
            timestamp: string;
            role?: string;
            data?: string;
            aiResponse?: string;
            [key: string]: any;
          }

          interface ConversationMessage {
            payload: MessagePayload;
            [key: string]: any;
          }

          const conversationMessages: ConversationMessage[] = latestResults.sort((a: ConversationMessage, b: ConversationMessage) => {
            const dateA: number = new Date(a.payload.timestamp).getTime();
            const dateB: number = new Date(b.payload.timestamp).getTime();
            return dateA - dateB; // 升序排列，按时间顺序排列对话
          });
          
          // 构建对话历史格式
          const conversationPieces = [];
          
          for (const result of conversationMessages) {
            const role = result.payload.role || 'unknown';
            const content = result.payload.data;
            const aiResponse = result.payload.aiResponse || '';
            
            if (role === 'user') {
              conversationPieces.push(`用户: ${content}`);
              // 如果这条记录有关联的AI响应，立即添加
              if (aiResponse) {
                conversationPieces.push(`AI: ${aiResponse}`);
              }
            }
          }
          
          if (conversationPieces.length > 0) {
            recentConversation = `最近的对话历史:\n${conversationPieces.join('\n')}\n\n`;
            console.log(`[MobileMemory] 构建了对话历史上下文，包含 ${conversationPieces.length} 条消息记录`);
            console.log('[MobileMemory] 对话历史内容预览:');
            console.log(recentConversation.substring(0, 200) + (recentConversation.length > 200 ? '...' : ''));
          }
        }
      } else {
        console.log('[MobileMemory] 未找到任何相关的历史记忆用于上下文');
      }
    } catch (error) {
      console.warn('[MobileMemory] 获取聊天上下文失败，将使用单条消息进行事实提取:', error);
    }

    // 构建上下文字符串，包含对话历史
    const contextString = recentConversation 
      ? `${recentConversation}当前用户消息:\n${parsedMessages}`
      : parsedMessages;

    // 获取提示词
    const [systemPrompt, userPrompt] = this.customPrompt
      ? [this.customPrompt, `输入:\n${contextString}`]
      : getFactRetrievalMessages(contextString);

    // 使用 LLM 提取事实
    const response = await this.llm.generateResponse(
      [
        { role: "user", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { type: "json_object" },
    );

    const cleanResponse = removeCodeBlocks(response);
    let facts = [];
    try {
      const parsed = JSON.parse(cleanResponse);
      facts = parsed.facts || [];
      // 记录提取的事实
      console.log(`[MobileMemory] 从用户消息中提取到 ${facts.length} 条事实:`);
      facts.forEach((fact: string, index: number) => {
        console.log(`  事实 #${index + 1}: ${fact}`);
      });
    } catch (e) {
      console.error("[MobileMemory] 解析 LLM 响应失败:", e);
      return [];
    }

    // 如果没有提取到事实，提前返回
    if (facts.length === 0) {
      console.log("[MobileMemory] 未从用户消息中提取到任何事实，跳过后续处理");
      return [];
    }

    // 为新事实获取嵌入
    const newMessageEmbeddings: Record<string, number[]> = {};
    const retrievedOldMemory: Array<{ id: string; text: string }> = [];

    // 创建嵌入并搜索类似的记忆
    for (const fact of facts) {
      const embedding = await this.embedder.embed(fact);
      newMessageEmbeddings[fact] = embedding;

      const existingMemories = await this.vectorStore.search(
        embedding,
        5,
        filters,
      );
      
      // 记录查找到的现有记忆
      console.log(`[MobileMemory] 为事实"${fact.substring(0, 30)}..."查找到 ${existingMemories.length} 条相关记忆`);
      
      for (const mem of existingMemories) {
        retrievedOldMemory.push({ id: mem.id, text: mem.payload.data });
        // 完整打印检索到的记忆内容
        console.log(`  记忆ID: ${mem.id}, 内容: ${mem.payload.data}, 相似度: ${mem.score}`);
      }
    }

    // 从旧记忆中移除重复项
    const uniqueOldMemories = retrievedOldMemory.filter(
      (mem, index) =>
        retrievedOldMemory.findIndex((m) => m.id === mem.id) === index,
    );

    // 创建 UUID 映射，处理 UUID 幻觉
    const tempUuidMapping: Record<string, string> = {};
    uniqueOldMemories.forEach((item, idx) => {
      tempUuidMapping[String(idx)] = item.id;
      uniqueOldMemories[idx].id = String(idx);
    });
    
    console.log(`[MobileMemory] 共有 ${uniqueOldMemories.length} 条唯一记忆需要处理`);

    // 获取记忆更新决策
    const updatePrompt = getUpdateMemoryMessages(uniqueOldMemories, facts);
    const updateResponse = await this.llm.generateResponse(
      [{ role: "user", content: updatePrompt }],
      { type: "json_object" },
    );

    const cleanUpdateResponse = removeCodeBlocks(updateResponse);
    let memoryActions = [];
    try {
      const parsed = JSON.parse(cleanUpdateResponse);
      memoryActions = parsed.memory || [];
      
      // 记录内存操作决策
      console.log(`[MobileMemory] LLM决定执行 ${memoryActions.length} 个记忆操作:`);
    } catch (e) {
      console.error("[MobileMemory] 解析 LLM 更新响应失败:", e);
      return [];
    }

    // 处理记忆操作
    const results: MemoryItem[] = [];
    for (const action of memoryActions) {
      try {
        console.log(`[MobileMemory] 执行操作: ${action.event}, 内容: ${action.text?.substring(0, 30)}...`);
        
        // 添加空的AI响应字段到每条记忆中
        const memoryMetadata = { ...metadata, aiResponse: '' };
        
        switch (action.event) {
          case "ADD": {
            const memoryId = await this.createMemory(
              action.text,
              newMessageEmbeddings,
              memoryMetadata,
            );
            results.push({
              id: memoryId,
              memory: action.text,
              metadata: { 
                event: action.event,
                aiResponse: '', // 初始为空，稍后可能会被更新
              },
            });
            console.log(`[MobileMemory] 添加新记忆成功, ID: ${memoryId}`);
            break;
          }
          case "UPDATE": {
            const realMemoryId = tempUuidMapping[action.id];
            await this.updateMemory(
              realMemoryId,
              action.text,
              newMessageEmbeddings,
              memoryMetadata,
            );
            results.push({
              id: realMemoryId,
              memory: action.text,
              metadata: {
                event: action.event,
                previousMemory: action.old_memory,
                aiResponse: '', // 初始为空，稍后可能会被更新
              },
            });
            console.log(`[MobileMemory] 更新记忆成功, ID: ${realMemoryId}, 旧内容: ${action.old_memory?.substring(0, 30)}...`);
            break;
          }
          case "DELETE": {
            const realMemoryId = tempUuidMapping[action.id];
            await this.deleteMemory(realMemoryId);
            results.push({
              id: realMemoryId,
              memory: action.text,
              metadata: { event: action.event },
            });
            console.log(`[MobileMemory] 删除记忆成功, ID: ${realMemoryId}`);
            break;
          }
          case "NONE": {
            // 添加对NONE操作的处理
            const realMemoryId = tempUuidMapping[action.id];
            console.log(`[MobileMemory] 无需更改记忆, ID: ${realMemoryId}, 内容: ${action.text?.substring(0, 30)}...`);
            results.push({
              id: realMemoryId,
              memory: action.text,
              metadata: { event: action.event },
            });
            break;
          }
        }
      } catch (error) {
        console.error(`[MobileMemory] 处理记忆操作错误:`, error);
      }
    }

    // 结果摘要
    const addCount = results.filter(r => r.metadata?.event === 'ADD').length;
    const updateCount = results.filter(r => r.metadata?.event === 'UPDATE').length;
    const deleteCount = results.filter(r => r.metadata?.event === 'DELETE').length;
    const noneCount = results.filter(r => r.metadata?.event === 'NONE').length;
    
    console.log(`[MobileMemory] 记忆处理完成: 添加=${addCount}, 更新=${updateCount}, 删除=${deleteCount}, 无变更=${noneCount}`);
    
    return results;
  }

  /**
   * 获取记忆
   * @param memoryId 记忆ID
   * @returns 记忆项
   */
  async get(memoryId: string): Promise<MemoryItem | null> {
    const memory = await this.vectorStore.get(memoryId);
    if (!memory) return null;

    const filters = {
      ...(memory.payload.userId && { userId: memory.payload.userId }),
      ...(memory.payload.agentId && { agentId: memory.payload.agentId }),
      ...(memory.payload.runId && { runId: memory.payload.runId }),
    };

    const memoryItem: MemoryItem = {
      id: memory.id,
      memory: memory.payload.data,
      hash: memory.payload.hash,
      createdAt: memory.payload.createdAt,
      updatedAt: memory.payload.updatedAt,
      metadata: {},
    };

    // 添加额外元数据
    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    for (const [key, value] of Object.entries(memory.payload)) {
      if (!excludedKeys.has(key)) {
        memoryItem.metadata![key] = value;
      }
    }

    return { ...memoryItem, ...filters };
  }

  /**
   * 搜索记忆
   * @param query 搜索查询
   * @param config 搜索选项
   * @returns 搜索结果
   */
  async search(
    query: string,
    config: SearchMemoryOptions,
  ): Promise<SearchResult> {
    const { userId, agentId, runId, limit = 100, filters = {} } = config;

    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    if (!filters.userId && !filters.agentId && !filters.runId) {
      throw new Error(
        "必须提供过滤条件之一: userId, agentId 或 runId!"
      );
    }

    console.log(`[MobileMemory] 开始搜索记忆: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    console.log(`[MobileMemory] 搜索过滤条件: ${JSON.stringify(filters)}, 限制: ${limit}条`);
    
    const searchStartTime = Date.now();
    
    // 搜索向量存储
    const queryEmbedding = await this.embedder.embed(query);
    const memories = await this.vectorStore.search(
      queryEmbedding,
      limit,
      filters,
    );
    
    const searchEndTime = Date.now();
    console.log(`[MobileMemory] 搜索完成，耗时: ${searchEndTime - searchStartTime}ms`);
    console.log(`[MobileMemory] 搜索结果数量: ${memories?.length || 0}`);

    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    interface VectorStorePayload {
      data: string;
      hash: string;
      createdAt: string;
      updatedAt: string;
      userId?: string;
      agentId?: string;
      runId?: string;
      [key: string]: any;
    }

    interface VectorStoreResult {
      id: string;
      payload: VectorStorePayload;
      score: number;
    }

    interface MemorySearchResult {
      id: string;
      memory: string;
      hash: string;
      createdAt: string;
      updatedAt: string;
      score: number;
      metadata: Record<string, any>;
      userId?: string;
      agentId?: string;
      runId?: string;
    }

    const results: MemorySearchResult[] = memories.map((mem: VectorStoreResult) => ({
      id: mem.id,
      memory: mem.payload.data,
      hash: mem.payload.hash,
      createdAt: mem.payload.createdAt,
      updatedAt: mem.payload.updatedAt,
      score: mem.score,
      metadata: Object.entries(mem.payload)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      ...(mem.payload.userId && { userId: mem.payload.userId }),
      ...(mem.payload.agentId && { agentId: mem.payload.agentId }),
      ...(mem.payload.runId && { runId: mem.payload.runId }),
    }));

    // 详细记录搜索结果
    if (memories && memories.length > 0) {
      console.log('[MobileMemory] 搜索结果详情:');
      interface MemorySearchPayload {
        id: string;
        data?: string;
        aiResponse?: string;
        timestamp?: string;
        createdAt?: string;
      }

      interface MemorySearchResult {
        id: string;
        score?: number;
        payload: MemorySearchPayload;
      }

      
      if (memories.length > 5) {
        console.log(`  ...以及另外 ${memories.length - 5} 条结果`);
      }
    } else {
      console.log('[MobileMemory] 没有找到符合条件的记忆');
    }

    return { results };
  }

  /**
   * 更新记忆
   * @param memoryId 记忆ID
   * @param data 新记忆内容
   * @returns 成功消息
   */
  async update(memoryId: string, data: string): Promise<{ message: string }> {
    const embedding = await this.embedder.embed(data);
    await this.updateMemory(memoryId, data, { [data]: embedding });
    return { message: "记忆更新成功!" };
  }

  /**
   * 删除记忆
   * @param memoryId 记忆ID
   * @returns 成功消息
   */
  async delete(memoryId: string): Promise<{ message: string }> {
    await this.deleteMemory(memoryId);
    return { message: "记忆删除成功!" };
  }

  /**
   * 删除所有记忆
   * @param config 删除选项
   * @returns 成功消息
   */
  async deleteAll(
    config: DeleteAllMemoryOptions,
  ): Promise<{ message: string }> {
    const { userId, agentId, runId } = config;

    const filters: SearchFilters = {};
    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    if (!Object.keys(filters).length) {
      throw new Error(
        "删除所有记忆需要至少一个过滤条件。如果想删除所有记忆，请使用 `reset()` 方法。"
      );
    }

    const [memories] = await this.vectorStore.list(filters);
    for (const memory of memories) {
      await this.deleteMemory(memory.id);
    }

    return { message: "记忆删除成功!" };
  }

  /**
   * 获取记忆历史
   * @param memoryId 记忆ID
   * @returns 历史记录
   */
  async history(memoryId: string): Promise<any[]> {
    return this.db.getHistory(memoryId);
  }

  /**
   * 重置记忆系统
   */
  async reset(): Promise<void> {
    await this.db.reset();
    await this.vectorStore.deleteCol();
    this.vectorStore = VectorStoreFactory.create(
      this.config.vectorStore.provider,
      this.config.vectorStore.config,
    );
  }

  /**
   * 获取所有记忆
   * @param config 获取选项
   * @returns 搜索结果
   */
  async getAll(config: GetAllMemoryOptions): Promise<SearchResult> {
    const { userId, agentId, runId, limit = 100 } = config;

    const filters: SearchFilters = {};
    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    const [memories] = await this.vectorStore.list(filters, limit);

    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    // 修复: 添加显式类型定义，解决 mem 隐式 any 类型问题
    const results = memories.map((mem: VectorStoreResult) => ({
      id: mem.id,
      memory: mem.payload.data,
      hash: mem.payload.hash,
      createdAt: mem.payload.createdAt,
      updatedAt: mem.payload.updatedAt,
      metadata: Object.entries(mem.payload)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      ...(mem.payload.userId && { userId: mem.payload.userId }),
      ...(mem.payload.agentId && { agentId: mem.payload.agentId }),
      ...(mem.payload.runId && { runId: mem.payload.runId }),
    }));

    return { results };
  }

  /**
   * 创建记忆
   * @param data 记忆内容
   * @param existingEmbeddings 已有嵌入
   * @param metadata 元数据
   * @returns 记忆ID
   */
  private async createMemory(
    data: string,
    existingEmbeddings: Record<string, number[]>,
    metadata: Record<string, any>,
  ): Promise<string> {
    const memoryId = uuidv4();
    const embedding =
      existingEmbeddings[data] || (await this.embedder.embed(data));

    const memoryMetadata = {
      ...metadata,
      data,
      hash: md5(data),
      createdAt: new Date().toISOString(),
      aiResponse: metadata.aiResponse || '', // 确保包含aiResponse字段
    };

    await this.vectorStore.insert([embedding], [memoryId], [memoryMetadata]);
    await this.db.addHistory(
      memoryId,
      null,
      data,
      "ADD",
      memoryMetadata.createdAt,
    );

    return memoryId;
  }

  /**
   * 更新记忆
   * @param memoryId 记忆ID
   * @param data 新记忆内容
   * @param existingEmbeddings 已有嵌入
   * @param metadata 元数据
   * @returns 记忆ID
   */
  private async updateMemory(
    memoryId: string,
    data: string,
    existingEmbeddings: Record<string, number[]>,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const existingMemory = await this.vectorStore.get(memoryId);
    if (!existingMemory) {
      throw new Error(`记忆 ID ${memoryId} 不存在`);
    }

    const prevValue = existingMemory.payload.data;
    const embedding =
      existingEmbeddings[data] || (await this.embedder.embed(data));

    const newMetadata = {
      ...metadata,
      data,
      hash: md5(data),
      createdAt: existingMemory.payload.createdAt,
      updatedAt: new Date().toISOString(),
      aiResponse: metadata.aiResponse || existingMemory.payload.aiResponse || '', // 保留或设置aiResponse
      ...(existingMemory.payload.userId && {
        userId: existingMemory.payload.userId,
      }),
      ...(existingMemory.payload.agentId && {
        agentId: existingMemory.payload.agentId,
      }),
      ...(existingMemory.payload.runId && {
        runId: existingMemory.payload.runId,
      }),
    };

    await this.vectorStore.update(memoryId, embedding, newMetadata);
    await this.db.addHistory(
      memoryId,
      prevValue,
      data,
      "UPDATE",
      newMetadata.createdAt,
      newMetadata.updatedAt,
    );

    return memoryId;
  }

  /**
   * 删除记忆
   * @param memoryId 记忆ID
   * @returns 记忆ID
   */
  private async deleteMemory(memoryId: string): Promise<string> {
    const existingMemory = await this.vectorStore.get(memoryId);
    if (!existingMemory) {
      throw new Error(`记忆 ID ${memoryId} 不存在`);
    }

    const prevValue = existingMemory.payload.data;
    await this.vectorStore.delete(memoryId);
    await this.db.addHistory(
      memoryId,
      prevValue,
      null,
      "DELETE",
      undefined,
      undefined,
      1,
    );

    return memoryId;
  }

  /**
   * 更新向量存储中的AI响应
   * @param memoryIds 需要更新的记忆ID数组
   * @param aiResponse AI响应文本
   */
  public async updateAIResponse(memoryIds: string[], aiResponse: string): Promise<void> {
    if (!memoryIds || memoryIds.length === 0 || !aiResponse) {
      console.log('[MobileMemory] 无需更新AI响应，跳过');
      return;
    }

    console.log(`[MobileMemory] 正在为 ${memoryIds.length} 条记忆更新AI响应`);
    
    for (const memoryId of memoryIds) {
      try {
        const existingMemory = await this.vectorStore.get(memoryId);
        if (!existingMemory) {
          console.warn(`[MobileMemory] 记忆ID ${memoryId} 不存在，跳过更新AI响应`);
          continue;
        }

        // 创建新的元数据，保留原有内容，更新aiResponse字段
        const newMetadata = {
          ...existingMemory.payload,
          aiResponse: aiResponse,
          updatedAt: new Date().toISOString(),
        };

        try {
          // 使用null作为embedding参数，让向量存储器保持原有向量
          await this.vectorStore.update(memoryId, null, newMetadata);
          console.log(`[MobileMemory] 成功更新记忆ID ${memoryId} 的AI响应`);
        } catch (error: unknown) {
          // 如果使用null向量更新失败，尝试使用原向量或空数组
          const updateError = error instanceof Error ? error.message : String(error);
          console.warn(`[MobileMemory] 使用null向量更新失败，尝试保持原向量: ${updateError}`);
          
          // 尝试重新获取原向量（如果存储引擎支持）
          let originalVector = null;
          if (existingMemory.vector) {
            originalVector = existingMemory.vector;
            console.log('[MobileMemory] 找到原始向量，使用原始向量更新');
          } else {
            // 如果找不到原始向量，尝试重新嵌入记忆内容
            try {
              if (existingMemory.payload && existingMemory.payload.data) {
                console.log(`[MobileMemory] 原始向量不可用，为记忆ID ${memoryId} 重新生成向量`);
                originalVector = await this.embedder.embed(existingMemory.payload.data);
              }
            } catch (embedError) {
              console.error(`[MobileMemory] 无法为记忆ID ${memoryId} 重新生成向量:`, embedError);
            }
          }

          // 使用原向量或空数组更新
          await this.vectorStore.update(
            memoryId, 
            originalVector || [], 
            newMetadata
          );
          console.log(`[MobileMemory] 成功使用${originalVector ? '原始' : '空'}向量更新记忆ID ${memoryId} 的AI响应`);
        }
      } catch (error) {
        console.error(`[MobileMemory] 更新记忆ID ${memoryId} 的AI响应失败:`, error);
      }
    }
  }
}
