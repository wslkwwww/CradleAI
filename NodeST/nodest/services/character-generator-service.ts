import { RoleCardJson, WorldBookJson } from '@/shared/types';
import { GeminiAdapter } from '../utils/gemini-adapter';
import { OpenRouterAdapter } from '../utils/openrouter-adapter';

/**
 * 投喂数据类型
 */
export enum FeedType {
  ABOUT_ME = "aboutMe",     // 关于角色自身的信息
  MATERIAL = "material",    // 角色素材
  KNOWLEDGE = "knowledge"   // 角色知识
}

/**
 * 投喂数据
 */
export interface FeedData {
  id: string;               // 数据ID
  content: string;          // 内容
  type: FeedType;           // 类型
  timestamp: number;        // 时间戳
  processed: boolean;       // 是否已处理
}

/**
 * 初始角色数据
 */
export interface CharacterInitialData {
  name?: string;            // 角色名称
  description?: string;     // 描述
  personality?: string;     // 性格特点
  initialPrompt?: string;   // 初始提示词
}

/**
 * 角色生成结果
 */
export interface CharacterGenerationResult {
  success: boolean;         // 是否成功
  roleCard?: RoleCardJson;  // 角色卡
  worldBook?: WorldBookJson; // 世界书
  error?: string;           // 错误信息
}

/**
 * R框架条目
 */
interface RFrameworkEntry {
  name: string;
  content: string;
  role: string;
  identifier: string;
}

/**
 * 提示词构建服务
 * 处理提示词构建和文本处理
 */
export class PromptBuilderService {
  /**
   * 创建R框架条目
   */
  static createRFrameworkEntry(entry: {
    name: string;
    content: string;
    role: string;
    identifier: string;
  }): RFrameworkEntry {
    return {
      name: entry.name,
      content: entry.content,
      role: entry.role,
      identifier: entry.identifier
    };
  }

  /**
   * 构建提示词
   */
  static buildPrompt({
    rFramework
  }: {
    rFramework: RFrameworkEntry[];
  }): Array<{ role: string; parts: Array<{ text: string }> }> {
    const messages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    rFramework.forEach((entry) => {
      messages.push({
        role: entry.role,
        parts: [{ text: entry.content }]
      });
    });

    return messages;
  }

  /**
   * 消息转文本
   */
  static messagesToText(messages: Array<{ role: string; parts: Array<{ text: string }> }>): string {
    return messages
      .map((msg) => {
        const role = msg.role.toUpperCase();
        const text = msg.parts.map((part) => part.text).join('\n');
        return `${role}:\n${text}`;
      })
      .join('\n\n');
  }
}

/**
 * 角色生成器服务
 * 负责使用LLM生成角色设定
 */
export class CharacterGeneratorService {
  private llmAdapter: GeminiAdapter | OpenRouterAdapter;
  private roleCard: RoleCardJson | null = null;
  private worldBook: WorldBookJson | null = null;

  constructor(adapter: GeminiAdapter | OpenRouterAdapter) {
    this.llmAdapter = adapter;
  }

  /**
   * 生成初始角色
   */
  async generateInitialCharacter(initialData: CharacterInitialData): Promise<CharacterGenerationResult> {
    try {
      console.log("开始生成初始角色...", initialData);

      // 构建R框架条目
      const rFramework: RFrameworkEntry[] = [
        PromptBuilderService.createRFrameworkEntry({
          name: "Task Description",
          content: this.getGeneratorSystemPrompt(),
          role: "system",
          identifier: "task_description"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Character Initial Data",
          content: this.formatInitialData(initialData),
          role: "user",
          identifier: "initial_data"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Output Format",
          content: this.getOutputFormatPrompt(),
          role: "user",
          identifier: "output_format"
        })
      ];

      // 构建提示词
      const messages = PromptBuilderService.buildPrompt({ rFramework });
      console.log("构建的提示词:", messages);

      // 发送到LLM
      const response = await this.llmAdapter.generateContent(messages);
      console.log("LLM响应:", response);

      // 解析响应
      const result = this.parseGeminiResponse(response);
      
      if (result.success) {
        this.roleCard = result.roleCard ?? null;
        this.worldBook = result.worldBook ?? null;
      }
      
      return result;
    } catch (error) {
      console.error("生成角色时出错:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误"
      };
    }
  }

  /**
   * 使用投喂数据更新角色
   */
  async updateWithFeeds(feeds: FeedData[]): Promise<CharacterGenerationResult> {
    try {
      if (!this.roleCard) {
        return {
          success: false,
          error: "无法更新角色：未找到基础角色数据"
        };
      }

      console.log(`使用 ${feeds.length} 条投喂数据更新角色`);

      // 按类型分组投喂数据
      const feedsByType = this.groupFeedsByType(feeds);
      
      // 构建R框架条目
      const rFramework: RFrameworkEntry[] = [
        PromptBuilderService.createRFrameworkEntry({
          name: "Task Description",
          content: this.getUpdaterSystemPrompt(),
          role: "system",
          identifier: "task_description"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Current Character",
          content: this.formatCurrentCharacter(),
          role: "user",
          identifier: "current_character"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "New Feeds",
          content: this.formatFeedData(feedsByType),
          role: "user",
          identifier: "new_feeds"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Output Format",
          content: this.getOutputFormatPrompt(),
          role: "user",
          identifier: "output_format"
        })
      ];

      // 构建提示词
      const messages = PromptBuilderService.buildPrompt({ rFramework });
      
      // 发送到LLM
      const response = await this.llmAdapter.generateContent(messages);
      
      // 解析响应
      const result = this.parseGeminiResponse(response);
      
      if (result.success) {
        this.roleCard = result.roleCard ?? this.roleCard;
        this.worldBook = result.worldBook ?? this.worldBook;
      }
      
      return result;
    } catch (error) {
      console.error("更新角色时出错:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误"
      };
    }
  }

  /**
   * 获取当前角色数据
   */
  getCurrentCharacterData(): { roleCard?: RoleCardJson; worldBook?: WorldBookJson } {
    return {
      roleCard: this.roleCard || undefined,
      worldBook: this.worldBook || undefined
    };
  }

  /**
   * 重置角色生成器状态
   */
  reset(): void {
    this.roleCard = null;
    this.worldBook = null;
  }

  /**
   * 解析Gemini响应
   */
  private parseGeminiResponse(response: string): CharacterGenerationResult {
    try {
      // 查找JSON部分
      const roleCardMatch = response.match(/```json\s*\n*([\s\S]*?)\n*```/);
      
      if (!roleCardMatch || !roleCardMatch[1]) {
        return {
          success: false,
          error: "无法解析LLM响应：未找到有效JSON"
        };
      }
      
      const jsonStr = roleCardMatch[1].trim();
      const data = JSON.parse(jsonStr);
      
      // 检查必要字段
      if (!data.role_card || !data.world_book) {
        return {
          success: false,
          error: "无法解析LLM响应：缺少必要字段"
        };
      }
      
      return {
        success: true,
        roleCard: data.role_card,
        worldBook: data.world_book
      };
    } catch (error) {
      console.error("解析LLM响应时出错:", error);
      return {
        success: false,
        error: error instanceof Error ? `解析LLM响应失败: ${error.message}` : "未知解析错误"
      };
    }
  }

  /**
   * 获取角色生成系统提示词
   */
  private getGeneratorSystemPrompt(): string {
    return `你是一个专业的AI角色设计师，能够根据用户提供的初始数据创建独特、有深度的角色档案。
你的任务是生成一个格式化的角色卡片和相应的世界书，以便AI聊天机器人能够准确扮演这个角色。
必须为每个角色生成以下内容：
1. 角色卡片，包含基本信息、个性特征和初始消息
2. 世界书，包含详细的角色设定，以便AI更好地理解和扮演角色
请根据提供的初始数据进行创造性扩展，确保角色设定连贯、合理、有深度。`;
  }

  /**
   * 获取角色更新系统提示词
   */
  private getUpdaterSystemPrompt(): string {
    return `你是一个专业的AI角色设计师，能够根据新的投喂数据更新和改进现有角色设定。
你的任务是分析当前角色设定以及用户提供的新投喂数据，然后生成更新后的角色卡片和世界书。
在更新过程中，请遵循以下原则：
1. 保持角色核心特征和一致性
2. 整合新的投喂数据，丰富角色设定
3. 确保角色设定连贯、合理、有深度
4. 优先考虑"关于我"类型的投喂数据，这些通常是角色的核心信息
请根据新的投喂数据进行创造性扩展，生成更丰富、更有深度的角色设定。`;
  }

  /**
   * 获取输出格式提示词
   */
  private getOutputFormatPrompt(): string {
    return `请按照以下JSON格式输出你的角色设计结果，使用Markdown代码块包裹:

\`\`\`json
{
  "role_card": {
    "name": "角色名称",
    "first_mes": "角色的初始消息",
    "description": "角色简短描述",
    "personality": "角色性格描述",
    "scenario": "角色所处的情境/背景",
    "mes_example": "对话示例",
    "background": "背景故事（可选）"
  },
  "world_book": {
    "entries": {
      "Alist": {
        "comment": "Character Attributes List",
        "content": "在这里输出：\\n<attributes>\\n  <personality>性格特点</personality>\\n  <appearance>外观描述</appearance>\\n  <likes>喜好</likes>\\n  <dislikes>厌恶</dislikes>\\n</attributes>",
        "disable": false,
        "position": 4,
        "constant": true,
        "key": [],
        "order": 1,
        "depth": 1,
        "vectorized": false
      },
      "Plist": {
        "comment": "Character Dialogue Examples",
        "content": "在这里输出对话示例",
        "disable": false,
        "position": 4,
        "constant": true,
        "key": [],
        "order": 2,
        "depth": 1,
        "vectorized": false
      },
      "背景": {
        "comment": "Character Background",
        "content": "在这里输出详细的背景故事",
        "disable": false,
        "position": 3,
        "constant": true,
        "key": [],
        "order": 3,
        "depth": 1,
        "vectorized": false
      }
    }
  }
}
\`\`\`

请确保生成的JSON格式正确，避免任何格式错误或缺失字段。`;
  }
  
  /**
   * 分组投喂数据
   */
  private groupFeedsByType(feeds: FeedData[]): Record<FeedType, FeedData[]> {
    const result: Record<FeedType, FeedData[]> = {
      [FeedType.ABOUT_ME]: [],
      [FeedType.MATERIAL]: [],
      [FeedType.KNOWLEDGE]: []
    };
    
    feeds.forEach(feed => {
      if (result[feed.type]) {
        result[feed.type].push(feed);
      }
    });
    
    return result;
  }

  /**
   * 格式化初始数据
   */
  private formatInitialData(data: CharacterInitialData): string {
    const parts = [];
    
    if (data.name) {
      parts.push(`名称: ${data.name}`);
    }
    
    if (data.description) {
      parts.push(`描述: ${data.description}`);
    }
    
    if (data.personality) {
      parts.push(`性格: ${data.personality}`);
    }
    
    if (data.initialPrompt) {
      parts.push(`初始设定: ${data.initialPrompt}`);
    }
    
    return parts.join('\n\n');
  }

  /**
   * 格式化当前角色信息
   */
  private formatCurrentCharacter(): string {
    if (!this.roleCard) {
      return "当前没有角色数据";
    }
    
    const parts = [
      `名称: ${this.roleCard.name}`,
      `描述: ${this.roleCard.description}`,
      `性格: ${this.roleCard.personality}`,
      `背景: ${this.roleCard.scenario || this.roleCard.background || "无"}`
    ];
    
    return parts.join('\n\n');
  }

  /**
   * 格式化投喂数据
   */
  private formatFeedData(feedsByType: Record<FeedType, FeedData[]>): string {
    const parts = [];
    
    // 关于我
    if (feedsByType[FeedType.ABOUT_ME].length > 0) {
      parts.push("## 关于角色的信息");
      feedsByType[FeedType.ABOUT_ME].forEach(feed => {
        parts.push(feed.content);
      });
    }
    
    // 素材
    if (feedsByType[FeedType.MATERIAL].length > 0) {
      parts.push("## 角色素材");
      feedsByType[FeedType.MATERIAL].forEach(feed => {
        parts.push(feed.content);
      });
    }
    
    // 知识
    if (feedsByType[FeedType.KNOWLEDGE].length > 0) {
      parts.push("## 角色知识");
      feedsByType[FeedType.KNOWLEDGE].forEach(feed => {
        parts.push(feed.content);
      });
    }
    
    return parts.join('\n\n');
  }

  /**
   * 格式化投喂数据（按类型）
   */
  private formatFeedDataByType(feeds: FeedData[], type: FeedType): string {
    const typeFeeds = feeds.filter(feed => feed.type === type);
    
    if (typeFeeds.length === 0) {
      return "";
    }
    
    const contents = typeFeeds.map(feed => feed.content);
    return contents.join('\n\n');
  }
}
