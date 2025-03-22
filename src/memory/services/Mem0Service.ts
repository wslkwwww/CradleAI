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
  
  private initialized = false;
  
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
   */
  public initialize(memoryActions: {
    add: (messages: string | Message[], options: AddMemoryOptions) => Promise<any>;
    search: (query: string, options: SearchMemoryOptions) => Promise<any>;
    get: (memoryId: string) => Promise<any>;
    update: (memoryId: string, data: string) => Promise<any>;
    delete: (memoryId: string) => Promise<any>;
    reset: () => Promise<any>;
  }): void {
    this.memoryActions = memoryActions;
    this.initialized = true;
    console.log('[Mem0Service] 记忆服务初始化成功');
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
   * 添加聊天记忆
   * @param message 消息内容
   * @param role 角色 (user/bot)
   * @param characterId 角色ID
   * @param conversationId 对话ID
   */
  public async addChatMemory(
    message: string,
    role: 'user' | 'bot',
    characterId: string,
    conversationId: string
  ): Promise<void> {
    this.checkInitialized();
    
    console.log(`[Mem0Service] 处理${role === 'user' ? '用户' : 'AI'}消息: ${message.substring(0, 50)}...`);
    
    if (!message || message.trim() === '') {
      console.log('[Mem0Service] 消息为空，跳过记忆处理');
      return;
    }
    
    try {
      // 转换为 Mem0 消息格式
      const memoryMessage: Message = {
        role: role === 'user' ? 'user' : 'assistant',
        content: message
      };
      
      // 添加到记忆系统
      // 修复: 传递 [memoryMessage] 数组而不是单个 memoryMessage 对象
      await this.memoryActions!.add(
        [memoryMessage],
        {
          userId: 'current-user', // 固定为当前用户
          agentId: characterId,   // 角色ID
          runId: conversationId,  // 对话ID
          metadata: {
            timestamp: new Date().toISOString(),
            role: role
          }
        }
      );
      
      console.log(`[Mem0Service] ${role === 'user' ? '用户' : 'AI'}消息已添加到记忆系统`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Mem0Service] 添加聊天记忆失败: ${errorMessage}`);
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
    
    console.log(`[Mem0Service] 搜索记忆: ${query}`);
    
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
      
      console.log(`[Mem0Service] 搜索结果: 找到 ${results.results.length} 条记忆`);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Mem0Service] 搜索记忆失败: ${errorMessage}`);
      return { results: [] };
    }
  }
}

export default Mem0Service;
