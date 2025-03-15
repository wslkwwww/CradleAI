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
  private roleCard: RoleCardJson | null = null;
  private worldBook: WorldBookJson | null = null;

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
      
      // Segregate feeds by type
      const knowledgeFeeds = unprocessedFeeds.filter(feed => feed.type === FeedType.KNOWLEDGE);
      const otherFeeds = unprocessedFeeds.filter(feed => feed.type !== FeedType.KNOWLEDGE);
      
      let result: CharacterGenerationResult | null = null;
      let knowledgeEntry = null;
      
      // Process knowledge feeds if any
      if (knowledgeFeeds.length > 0) {
        console.log(`[CradleService] 处理 ${knowledgeFeeds.length} 条知识投喂`);
        const knowledgeResult = await this.summarizeKnowledgeFeeds(knowledgeFeeds);
        
        if (knowledgeResult.success && knowledgeResult.knowledgeEntry) {
          knowledgeEntry = knowledgeResult.knowledgeEntry;
          console.log('[CradleService] 知识总结成功:', knowledgeEntry);
        } else {
          console.warn('[CradleService] 知识总结失败:', knowledgeResult.error);
        }
      }
      
      // Process regular feeds through the character generator
      if (otherFeeds.length > 0 || !this.roleCard) {
        // Check if we already have a character initialized
        const currentData = this.characterGenerator.getCurrentCharacterData();
        if (currentData.roleCard) {
          // Update existing character with new feeds
          console.log('[CradleService] Updating existing character with new feeds');
          result = await this.characterGenerator.updateWithFeeds(otherFeeds);
        } else {
          // Create initial character if this is our first processing
          console.log('[CradleService] Creating initial character from feeds');
          const initialData: CharacterInitialData = {
            name: "Cradle Character",
            description: "A character being developed in the Cradle System",
            personality: "Personality will be determined based on feed data"
          };
          result = await this.characterGenerator.generateInitialCharacter(initialData);
        }
      } else {
        result = {
          success: true,
          roleCard: this.roleCard,
          worldBook: this.worldBook || { entries: {} } 
        };
      }
      
      // If we have a knowledge entry, add it to the worldbook
      if (result && result.success && result.worldBook && knowledgeEntry) {
        // Create a unique key for the knowledge entry
        const knowledgeKey = `知识_${Date.now()}`;
        
        // Add the knowledge entry to the worldbook
        result.worldBook.entries["知识"] = {
          comment: "Character Knowledge",
          content: knowledgeEntry.content,
          disable: false,
          position: 4,
          constant: false, // Non-constant, triggered by keywords
          key: knowledgeEntry.keywords,
          order: 1,
          depth: 2,
          vectorized: false
        };
        
        console.log('[CradleService] 已添加知识条目到角色世界书', knowledgeEntry.keywords);
      }
      
      // Check if processing was successful
      if (!result || !result.success) {
        const errorMessage = result ? result.error : 'Unknown error in character generation';
        console.error('[CradleService] Failed to process feeds:', errorMessage);
        return {
          success: false,
          errorMessage
        };
      }
      
      console.log('[CradleService] Character generation/update successful');
      
      // Update internal state with processed character data
      this.roleCard = result.roleCard || this.roleCard;
      this.worldBook = result.worldBook || this.worldBook;
      
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

  // Add a new method for summarizing knowledge feeds
  async summarizeKnowledgeFeeds(feeds: FeedData[]): Promise<{
    success: boolean;
    knowledgeEntry?: {
      content: string;
      keywords: string[];
    };
    error?: string;
  }> {
    if (!feeds || feeds.length === 0) {
      return {
        success: false,
        error: "没有可用的知识投喂数据进行总结"
      };
    }
    
    try {
      console.log(`[CradleService] 开始总结 ${feeds.length} 条知识投喂`);
      
      // Select the adapter based on settings
      const adapter = this.getActiveAdapter();
      
      // Prepare prompt for knowledge summarization
      const knowledgeContent = feeds.map(feed => feed.content).join('\n\n');
      
      const systemPrompt = `你是一个专业的AI知识整理助手，你的任务是将用户输入的多条知识片段总结为一个连贯、精炼的知识条目。
  这个知识条目将被添加到角色的世界书(WorldBook)中，用于增强角色的行为和回应。
  请确保保留重要的事实、概念和关系，删除冗余和重复信息。
  同时，你需要生成3-5个关键词，这些关键词将触发这个知识在对话中被使用。
  关键词应该准确反映这些知识的核心主题，并在用户提及相关话题时触发。`;

      const userPrompt = `请帮我总结以下知识内容，并生成适当的关键词：

  ${knowledgeContent}

  请按照以下JSON格式输出：
  \`\`\`json
  {
    "summary": "这里是总结后的知识内容...",
    "keywords": ["关键词1", "关键词2", "关键词3"]
  }
  \`\`\`

  关键词应该是能触发这个知识应用的词组，比如主题、人名、概念名等。`;

      // Build messages array for API call
      const messages = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: adapter instanceof GeminiAdapter ? "model" : "assistant", parts: [{ text: "我明白了，我将帮您总结知识内容并生成关键词。请提供需要总结的知识片段。" }] },
        { role: "user", parts: [{ text: userPrompt }] }
      ];
      
      // Call the LLM API to generate the summary
      console.log("[CradleService] 调用LLM生成知识总结");
      const response = await adapter.generateContent(messages);
      
      // Extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/\{[\s\S]*"summary"[\s\S]*"keywords"[\s\S]*\}/);
                       
      if (!jsonMatch) {
        console.error("[CradleService] 无法从响应中提取JSON");
        return {
          success: false,
          error: "无法从LLM响应中提取知识总结JSON"
        };
      }
      
      // Parse the JSON
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsedData = JSON.parse(jsonStr);
      
      if (!parsedData.summary || !Array.isArray(parsedData.keywords) || parsedData.keywords.length === 0) {
        return {
          success: false,
          error: "生成的知识总结数据不完整"
        };
      }
      
      console.log("[CradleService] 知识总结成功，关键词:", parsedData.keywords);
      
      return {
        success: true,
        knowledgeEntry: {
          content: parsedData.summary,
          keywords: parsedData.keywords
        }
      };
    } catch (error) {
      console.error("[CradleService] 总结知识投喂失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误"
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