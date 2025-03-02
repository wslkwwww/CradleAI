import { FeedData, FeedType, CharacterGeneratorService, CharacterInitialData, CharacterGenerationResult } from './character-generator-service';
import { GeminiAdapter } from '../utils/gemini-adapter';
import { RoleCardJson, WorldBookJson } from '../types/types';

/**
 * 摇篮系统服务 - 管理角色培育过程
 */
export class CradleService {
  private characterGenerator: CharacterGeneratorService;
  private pendingFeeds: FeedData[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private batchSize: number = 5; // 一次处理的最大投喂数量
  private processingDelay: number = 30000; // 30秒处理一次
  private initialized: boolean = false;

  constructor(apiKey: string) {
    this.characterGenerator = new CharacterGeneratorService(apiKey);
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
  async processFeeds(): Promise<CharacterGenerationResult | null> {
    const unprocessedFeeds = this.pendingFeeds.filter(feed => !feed.processed);
    if (unprocessedFeeds.length === 0) {
      console.log("没有需要处理的投喂数据");
      return null;
    }

    console.log(`手动处理${unprocessedFeeds.length}条投喂数据...`);
    return await this.processUnprocessedFeeds();
  }

  /**
   * 获取当前角色数据
   */
  getCurrentCharacterData(): { roleCard?: RoleCardJson; worldBook?: WorldBookJson } {
    return this.characterGenerator.getCurrentCharacterData();
  }

  /**
   * 重置生成器状态
   */
  reset(): void {
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
  private async processUnprocessedFeeds(): Promise<CharacterGenerationResult> {
    // 获取未处理的投喂
    const unprocessedFeeds = this.pendingFeeds.filter(feed => !feed.processed);
    
    // 如果没有未处理的投喂，返回当前状态
    if (unprocessedFeeds.length === 0) {
      const currentData = this.characterGenerator.getCurrentCharacterData();
      return {
        roleCard: currentData.roleCard || this.createEmptyRoleCard(),
        worldBook: currentData.worldBook || this.createEmptyWorldBook(),
        success: true
      };
    }
    
    // 限制批次大小
    const feedsToProcess = unprocessedFeeds.slice(0, this.batchSize);
    console.log(`处理${feedsToProcess.length}条投喂数据（总共${unprocessedFeeds.length}条未处理）`);
    
    // 调用字符生成器处理投喂
    const result = await this.characterGenerator.updateCharacterWithFeeds(feedsToProcess);
    
    // 更新已处理状态
    if (result.success) {
      feedsToProcess.forEach(feed => {
        const index = this.pendingFeeds.findIndex(item => item.id === feed.id);
        if (index !== -1) {
          this.pendingFeeds[index].processed = true;
        }
      });
      console.log(`成功处理${feedsToProcess.length}条投喂数据`);
    } else {
      console.error("处理投喂数据失败:", result.errorMessage);
    }
    
    return result;
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