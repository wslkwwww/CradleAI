import { FeedData, FeedType, CharacterGeneratorService, CharacterInitialData, CharacterGenerationResult } from './character-generator-service';
import { GeminiAdapter } from '../utils/gemini-adapter';
import { OpenRouterAdapter } from '../utils/openrouter-adapter'; // Add OpenRouter adapter import
import { RoleCardJson, WorldBookJson } from '@/shared/types';

interface ProcessResult {
  success: boolean;
  errorMessage?: string;
  processedFeeds?: FeedData[];
}

/**
 * 摇篮系统服务 - 管理角色培育过程
 */
export class CradleService {
  private characterGenerator: CharacterGeneratorService | null = null;
  private pendingFeeds: FeedData[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private batchSize: number = 5; // 一次处理的最大投喂数量
  private processingDelay: number = 30000; // 30秒处理一次
  private initialized: boolean = false;
  private geminiAdapter: GeminiAdapter;
  private openRouterAdapter: OpenRouterAdapter | null = null;

  // Add apiSettings as an optional parameter
  constructor(apiKey: string, apiSettings?: {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }) {
    this.geminiAdapter = new GeminiAdapter(apiKey);
    
    // Initialize OpenRouter if settings are provided
    if (apiSettings?.apiProvider === 'openrouter' && 
        apiSettings.openrouter?.enabled && 
        apiSettings.openrouter?.apiKey) {
      this.openRouterAdapter = new OpenRouterAdapter(
        apiSettings.openrouter.apiKey,
        apiSettings.openrouter.model || 'openai/gpt-3.5-turbo'
      );
      console.log('[CradleService] OpenRouter adapter initialized');
    }
    
    // Get the appropriate adapter based on settings
    const adapter = this.getActiveAdapter();
    this.characterGenerator = new CharacterGeneratorService(adapter);
  }
  
  // Helper method to get the active adapter
  private getActiveAdapter() {
    if (this.openRouterAdapter) {
      console.log('[CradleService] Using OpenRouter adapter');
      return this.openRouterAdapter;
    }
    console.log('[CradleService] Using Gemini adapter');
    return this.geminiAdapter;
  }
  
  // Update API settings
  public updateApiSettings(apiSettings: {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }) {
    // Reinitialize OpenRouter if needed
    if (apiSettings.apiProvider === 'openrouter' && 
        apiSettings.openrouter?.enabled && 
        apiSettings.openrouter?.apiKey) {
      this.openRouterAdapter = new OpenRouterAdapter(
        apiSettings.openrouter.apiKey,
        apiSettings.openrouter.model || 'openai/gpt-3.5-turbo'
      );
      console.log('[CradleService] OpenRouter adapter updated');
    } else {
      this.openRouterAdapter = null;
      console.log('[CradleService] OpenRouter adapter disabled');
    }
    
    // Update the character generator with the new adapter
    const adapter = this.getActiveAdapter();
    this.characterGenerator = new CharacterGeneratorService(adapter);
  }

  /**
   * 初始化服务
   */
  initialize(): void {
    if (this.initialized) return;
    
    console.log("初始化摇篮系统服务...");
    this.startFeedProcessor();
    this.initialized = true;
  }

  /**
   * 停止服务
   */
  shutdown(): void {
    console.log("关闭摇篮系统服务...");
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.initialized = false;
  }

  /**
   * 创建初始角色
   * @param initialData 初始角色数据
   * @returns 生成结果
   */
  async createInitialCharacter(initialData: CharacterInitialData): Promise<CharacterGenerationResult> {
    console.log("创建初始角色...", initialData);
    if (!this.characterGenerator) {
      throw new Error('Character generator not initialized');
    }
    return await this.characterGenerator.generateInitialCharacter(initialData);
  }

  /**
   * 添加投喂数据到队列
   * @param feedData 投喂数据
   * @returns 成功添加的数据ID
   */
  addFeed(content: string, type: FeedType): string {
    const feedId = Date.now().toString();
    const feed: FeedData = {
      id: feedId,
      content,
      type,
      timestamp: Date.now(),
      processed: false
    };
    
    console.log(`添加投喂数据: ${type}, ID=${feedId}`);
    this.pendingFeeds.push(feed);
    return feedId;
  }

  /**
   * 获取当前所有投喂数据
   * @returns 投喂数据数组
   */
  getAllFeeds(): FeedData[] {
    return [...this.pendingFeeds];
  }

  /**
   * 手动触发处理待处理的投喂
   * @returns 处理结果
   */
  async processFeeds(): Promise<ProcessResult> {
    const unprocessedFeeds = this.pendingFeeds.filter(feed => !feed.processed);
    if (unprocessedFeeds.length === 0) {
      console.log("没有需要处理的投喂数据");
      return {
        success: true,
        processedFeeds: []
      };
    }

    console.log(`手动处理${unprocessedFeeds.length}条投喂数据...`);
    return await this.processUnprocessedFeeds();
  }

  /**
   * 获取当前角色数据
   */
  getCurrentCharacterData(): { roleCard?: RoleCardJson; worldBook?: WorldBookJson } {
    if (!this.characterGenerator) {
      return { roleCard: undefined, worldBook: undefined };
    }
    return this.characterGenerator.getCurrentCharacterData();
  }

  /**
   * 重置生成器状态
   */
  reset(): void {
    if (!this.characterGenerator) {
      throw new Error('Character generator not initialized');
    }
    this.characterGenerator.reset();
    this.pendingFeeds = [];
    console.log("摇篮系统服务已重置");
  }

  /**
   * 开始定期处理投喂数据
   */
  private startFeedProcessor(): void {
    console.log(`启动投喂处理器，每${this.processingDelay/1000}秒处理一次`);
    
    // 清除任何现有的定时器
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // 设置新的定时器
    this.processingInterval = setInterval(async () => {
      const unprocessedFeeds = this.pendingFeeds.filter(feed => !feed.processed);
      if (unprocessedFeeds.length === 0) {
        console.log("定时检查：没有需要处理的投喂数据");
        return;
      }
      
      console.log(`定时处理：发现${unprocessedFeeds.length}条未处理的投喂数据`);
      await this.processUnprocessedFeeds();
    }, this.processingDelay);
  }

  /**
   * 处理未处理的投喂数据
   */
  private async processUnprocessedFeeds(): Promise<ProcessResult> {
    if (!this.characterGenerator) {
      return {
        success: false,
        errorMessage: 'Character generator not initialized'
      };
    }
    
    console.log('[CradleService] Processing unprocessed feeds...');
    
    try {
      // Get all unprocessed feeds
      const unprocessedFeeds = this.pendingFeeds.filter(feed => !feed.processed);
      if (unprocessedFeeds.length === 0) {
        return {
          success: true,
          processedFeeds: []
        };
      }
      
      // Process the feeds through CharacterGeneratorService
      let generationResult: CharacterGenerationResult;
      
      // Check if we already have a character initialized
      const currentData = this.characterGenerator.getCurrentCharacterData();
      if (currentData.roleCard) {
        // Update existing character with new feeds
        console.log('[CradleService] Updating existing character with new feeds');
        generationResult = await this.characterGenerator.updateWithFeeds(unprocessedFeeds);
      } else {
        // Create initial character if this is our first processing
        console.log('[CradleService] Creating initial character from feeds');
        const initialData: CharacterInitialData = {
          name: "Cradle Character",
          description: "A character being developed in the Cradle System",
          personality: "Personality will be determined based on feed data"
        };
        generationResult = await this.characterGenerator.generateInitialCharacter(initialData);
      }
      
      // Check if processing was successful
      if (!generationResult.success) {
        console.error('[CradleService] Failed to process feeds:', generationResult.error);
        return {
          success: false,
          errorMessage: generationResult.error
        };
      }
      
      console.log('[CradleService] Character generation/update successful');
      
      // Mark all processed feeds
      unprocessedFeeds.forEach(feed => {
        const index = this.pendingFeeds.findIndex(f => f.id === feed.id);
        if (index !== -1) {
          this.pendingFeeds[index].processed = true;
        }
      });
      
      return {
        success: true,
        processedFeeds: unprocessedFeeds
      };
    } catch (error) {
      console.error('[CradleService] Error processing feeds:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 创建空的RoleCard对象
   */
  private createEmptyRoleCard(): RoleCardJson {
    return {
      name: "",
      first_mes: "你好，很高兴认识你。",
      description: "这是一个基础角色。",
      personality: "",
      scenario: "",
      mes_example: ""
    };
  }

  /**
   * 创建空的WorldBook对象
   */
  private createEmptyWorldBook(): WorldBookJson {
    return {
      entries: {
        "Alist": {
          comment: "Character Attributes List",
          content: "<attributes>\n  <personality>友好、开朗</personality>\n  <appearance>未指定</appearance>\n  <likes>未指定</likes>\n  <dislikes>未指定</dislikes>\n</attributes>",
          disable: false,
          position: 4,
          constant: true,
          key: [],
          order: 1,
          depth: 1,
          vectorized: false
        },
        "Plist": {
          comment: "Character Dialogue Examples",
          content: "用户: 你好\n角色: 你好！很高兴认识你！",
          disable: false,
          position: 4,
          constant: true,
          key: [],
          order: 2,
          depth: 1,
          vectorized: false
        }
      }
    };
  }
}