import { GeminiAdapter } from '../utils/gemini-adapter';
import { PromptBuilderService, RFrameworkEntry, DEntry } from './prompt-builder-service';
import { RoleCardJson, WorldBookJson, WorldBookEntry } from '../types/types';

/**
 * 摇篮投喂类型枚举
 */
export enum FeedType {
  ABOUT_ME = "aboutMe",     // 关于我的信息
  MATERIAL = "material",    // 素材信息
  KNOWLEDGE = "knowledge"   // 知识信息
}

/**
 * 投喂数据结构
 */
export interface FeedData {
  id: string;
  content: string;
  type: FeedType;
  timestamp: number;
  processed?: boolean;
}

/**
 * 角色初始数据
 */
export interface CharacterInitialData {
  name?: string;
  description?: string;
  personality?: string;
  preferences?: string;
  appearance?: string; 
  scenario?: string;
}

/**
 * 角色生成结果
 */
export interface CharacterGenerationResult {
  roleCard: RoleCardJson;
  worldBook: WorldBookJson;
  success: boolean;
  errorMessage?: string;
}

/**
 * 角色生成器服务 - 为摇篮系统提供角色生成和更新功能
 */
export class CharacterGeneratorService {
  private geminiAdapter: GeminiAdapter;
  private lastCharacterData?: {
    roleCard?: RoleCardJson;
    worldBook?: WorldBookJson;
  };

  constructor(apiKey: string) {
    this.geminiAdapter = new GeminiAdapter(apiKey);
    this.lastCharacterData = undefined;
  }

  /**
   * 初始角色生成
   * @param initialData 初始数据
   * @returns 生成的角色数据
   */
  async generateInitialCharacter(initialData: CharacterInitialData): Promise<CharacterGenerationResult> {
    console.log("开始生成初始角色...", initialData);

    try {
      // 构建R框架条目
      const rFramework: RFrameworkEntry[] = [
        PromptBuilderService.createRFrameworkEntry({
          name: "Task Description",
          content: this.getGeneratorSystemPrompt(),
          role: "system",
          identifier: "task_description"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Initial Character Data",
          content: this.formatInitialData(initialData),
          role: "user",
          identifier: "initial_data"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Output Format",
          content: this.getOutputFormatPrompt(),
          role: "system",
          identifier: "output_format"
        })
      ];

      // 构建提示词
      const messages = PromptBuilderService.buildPrompt({ rFramework });
      const prompt = PromptBuilderService.messagesToText(messages);
      
      // 发送到Gemini
      console.log("向Gemini发送初始生成请求...");
      const response = await this.geminiAdapter.generateContent([{
        role: "user", 
        parts: [{ text: prompt }]
      }]);

      // 解析响应
      const result = this.parseGeminiResponse(response);
      
      // 更新最后生成的角色数据
      if (result.success) {
        this.lastCharacterData = {
          roleCard: result.roleCard,
          worldBook: result.worldBook
        };
        console.log("初始角色生成成功");
      } else {
        console.error("初始角色生成失败:", result.errorMessage);
      }

      return result;
    } catch (error) {
      console.error("角色生成过程中出现错误:", error);
      return {
        roleCard: this.createEmptyRoleCard(),
        worldBook: this.createEmptyWorldBook(),
        success: false,
        errorMessage: `生成过程错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 根据投喂数据更新角色
   * @param feedData 投喂数据批次
   * @returns 更新后的角色数据
   */
  async updateCharacterWithFeeds(feedData: FeedData[]): Promise<CharacterGenerationResult> {
    if (!this.lastCharacterData) {
      return {
        roleCard: this.createEmptyRoleCard(),
        worldBook: this.createEmptyWorldBook(),
        success: false,
        errorMessage: "无法更新角色：缺少初始角色数据"
      };
    }

    console.log(`开始处理${feedData.length}条投喂数据...`);

    try {
      // 按投喂类型分类数据
      const aboutMeFeeds = feedData.filter(feed => feed.type === FeedType.ABOUT_ME);
      const materialFeeds = feedData.filter(feed => feed.type === FeedType.MATERIAL);
      const knowledgeFeeds = feedData.filter(feed => feed.type === FeedType.KNOWLEDGE);

      // 构建R框架
      const rFramework: RFrameworkEntry[] = [
        PromptBuilderService.createRFrameworkEntry({
          name: "Task Description",
          content: this.getUpdaterSystemPrompt(),
          role: "system",
          identifier: "task_description"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Previous Character Data",
          content: this.formatPreviousCharacterData(),
          role: "system",
          identifier: "previous_data"
        })
      ];

      // 添加各类型的投喂内容
      if (aboutMeFeeds.length > 0) {
        rFramework.push(PromptBuilderService.createRFrameworkEntry({
          name: "About Me Input",
          content: this.formatFeedDataByType(aboutMeFeeds),
          role: "user",
          identifier: "about_me_input"
        }));
      }

      if (materialFeeds.length > 0) {
        rFramework.push(PromptBuilderService.createRFrameworkEntry({
          name: "Material Input",
          content: this.formatFeedDataByType(materialFeeds),
          role: "user",
          identifier: "material_input"
        }));
      }

      if (knowledgeFeeds.length > 0) {
        rFramework.push(PromptBuilderService.createRFrameworkEntry({
          name: "Knowledge Input",
          content: this.formatFeedDataByType(knowledgeFeeds),
          role: "user",
          identifier: "knowledge_input"
        }));
      }

      // 添加输出格式要求
      rFramework.push(PromptBuilderService.createRFrameworkEntry({
        name: "Output Format",
        content: this.getOutputFormatPrompt(),
        role: "system",
        identifier: "output_format"
      }));

      // 构建提示词
      const messages = PromptBuilderService.buildPrompt({ rFramework });
      const prompt = PromptBuilderService.messagesToText(messages);
      
      // 发送到Gemini
      console.log("向Gemini发送角色更新请求...");
      const response = await this.geminiAdapter.generateContent([{
        role: "user", 
        parts: [{ text: prompt }]
      }]);

      // 解析响应
      const result = this.parseGeminiResponse(response);
      
      // 更新最后生成的角色数据
      if (result.success) {
        this.lastCharacterData = {
          roleCard: result.roleCard,
          worldBook: result.worldBook
        };
        console.log("角色更新成功");
      } else {
        console.error("角色更新失败:", result.errorMessage);
      }

      return result;
    } catch (error) {
      console.error("角色更新过程中出现错误:", error);
      return {
        roleCard: this.lastCharacterData.roleCard || this.createEmptyRoleCard(),
        worldBook: this.lastCharacterData.worldBook || this.createEmptyWorldBook(),
        success: false,
        errorMessage: `更新过程错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 解析Gemini的响应
   * @param response Gemini响应文本
   * @returns 解析后的角色数据
   */
  private parseGeminiResponse(response: string): CharacterGenerationResult {
    console.log("解析Gemini响应...");
    
    try {
      // 查找JSON部分
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                        response.match(/(\{[\s\S]*\})/) ||
                        response.match(/```(\{[\s\S]*?\})```/);
      
      if (!jsonMatch || !jsonMatch[1]) {
        console.error("无法在响应中找到JSON内容");
        return {
          roleCard: this.lastCharacterData?.roleCard || this.createEmptyRoleCard(),
          worldBook: this.lastCharacterData?.worldBook || this.createEmptyWorldBook(),
          success: false,
          errorMessage: "无法解析响应：未找到JSON内容"
        };
      }

      // 解析JSON字符串
      const jsonContent = jsonMatch[1].trim();
      const parsedData = JSON.parse(jsonContent);

      // 验证结果是否符合预期格式
      if (!parsedData.roleCard || !parsedData.worldBook) {
        console.error("响应缺少必要的roleCard或worldBook字段");
        return {
          roleCard: this.lastCharacterData?.roleCard || this.createEmptyRoleCard(),
          worldBook: this.lastCharacterData?.worldBook || this.createEmptyWorldBook(),
          success: false,
          errorMessage: "响应格式错误：缺少roleCard或worldBook字段"
        };
      }

      // 确保生成的字段符合类型要求
      const roleCard = this.validateRoleCard(parsedData.roleCard);
      const worldBook = this.validateWorldBook(parsedData.worldBook);

      return {
        roleCard,
        worldBook,
        success: true
      };
    } catch (error) {
      console.error("解析响应时出错:", error);
      return {
        roleCard: this.lastCharacterData?.roleCard || this.createEmptyRoleCard(),
        worldBook: this.lastCharacterData?.worldBook || this.createEmptyWorldBook(),
        success: false,
        errorMessage: `响应解析错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 验证并修复RoleCard数据
   */
  private validateRoleCard(data: any): RoleCardJson {
    const roleCard: RoleCardJson = { 
      name: data.name || "",
      first_mes: data.first_mes || "你好，很高兴认识你。",
      description: data.description || "",
      personality: data.personality || "",
      scenario: data.scenario || "",
      mes_example: data.mes_example || ""
    };

    // 添加可选字段（如果存在）
    if (data.data?.extensions?.regex_scripts) {
      roleCard.data = {
        extensions: {
          regex_scripts: data.data.extensions.regex_scripts
        }
      };
    }

    return roleCard;
  }

  /**
   * 验证并修复WorldBook数据
   */
  private validateWorldBook(data: any): WorldBookJson {
    const worldBook: WorldBookJson = { entries: {} };
    
    // 确保entries字段有效
    if (typeof data.entries !== 'object' || data.entries === null) {
      console.warn("WorldBook entries无效，创建空对象");
      return worldBook;
    }
    
    // 处理每个条目
    Object.keys(data.entries).forEach(key => {
      const entry = data.entries[key];
      
      // 确保每个条目包含必要字段
      worldBook.entries[key] = {
        comment: entry.comment || "",
        content: entry.content || "",
        disable: entry.disable !== undefined ? entry.disable : false,
        position: entry.position !== undefined ? entry.position : 4,
        constant: entry.constant !== undefined ? entry.constant : true,
        key: Array.isArray(entry.key) ? entry.key : [],
        order: entry.order !== undefined ? entry.order : 0,
        depth: entry.depth !== undefined ? entry.depth : 1,
        vectorized: entry.vectorized || false
      };
    });
    
    // 确保包含标准的Alist和Plist条目
    if (!worldBook.entries["Alist"]) {
      worldBook.entries["Alist"] = this.createDefaultAlistEntry();
    }
    
    if (!worldBook.entries["Plist"]) {
      worldBook.entries["Plist"] = this.createDefaultPlistEntry();
    }
    
    return worldBook;
  }

  /**
   * 创建默认的角色属性列表条目
   */
  private createDefaultAlistEntry(): WorldBookEntry {
    return {
      comment: "Character Attributes List",
      content: "<attributes>\n  <personality>友好、开朗</personality>\n  <appearance>未指定</appearance>\n  <likes>未指定</likes>\n  <dislikes>未指定</dislikes>\n</attributes>",
      disable: false,
      position: 4,
      constant: true,
      key: [],
      order: 1,
      depth: 1,
      vectorized: false
    };
  }

  /**
   * 创建默认的角色对话示例列表条目
   */
  private createDefaultPlistEntry(): WorldBookEntry {
    return {
      comment: "Character Dialogue Examples",
      content: "用户: 你好\n角色: 你好！很高兴认识你！",
      disable: false,
      position: 4,
      constant: true,
      key: [],
      order: 2,
      depth: 1,
      vectorized: false
    };
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
        "Alist": this.createDefaultAlistEntry(),
        "Plist": this.createDefaultPlistEntry()
      }
    };
  }

  /**
   * 格式化初始数据
   */
  private formatInitialData(initialData: CharacterInitialData): string {
    let result = "【初始角色信息】\n\n";
    
    if (initialData.name) result += `名称: ${initialData.name}\n`;
    if (initialData.description) result += `描述: ${initialData.description}\n`;
    if (initialData.personality) result += `性格: ${initialData.personality}\n`;
    if (initialData.preferences) result += `偏好: ${initialData.preferences}\n`;
    if (initialData.appearance) result += `外观: ${initialData.appearance}\n`;
    if (initialData.scenario) result += `场景: ${initialData.scenario}\n`;
    
    return result;
  }

  /**
   * 格式化之前的角色数据
   */
  private formatPreviousCharacterData(): string {
    if (!this.lastCharacterData?.roleCard) {
      return "【当前无可用的角色数据】";
    }
    
    const { roleCard, worldBook } = this.lastCharacterData;
    
    let result = "【上一次生成的角色设定】\n\n";
    result += `描述: ${roleCard.description || "无"}\n`;
    result += `性格: ${roleCard.personality || "无"}\n`;
    result += `场景: ${roleCard.scenario || "无"}\n\n`;
    
    // 添加Alist信息（如果有）
    if (worldBook?.entries?.["Alist"]) {
      result += `【角色属性列表】\n${worldBook.entries["Alist"].content}\n\n`;
    }
    
    // 添加Plist信息（如果有）
    if (worldBook?.entries?.["Plist"]) {
      result += `【对话示例列表】\n${worldBook.entries["Plist"].content}\n\n`;
    }
    
    // 添加知识条目（如果有）
    const knowledgeEntries = Object.entries(worldBook?.entries || {})
      .filter(([key, entry]) => 
        key !== "Alist" && key !== "Plist" && !entry.disable);
    
    if (knowledgeEntries.length > 0) {
      result += "【已知的知识条目】\n";
      knowledgeEntries.forEach(([key, entry]) => {
        result += `${entry.comment || key}: ${entry.content.substring(0, 100)}${entry.content.length > 100 ? "..." : ""}\n`;
      });
    }
    
    return result;
  }

  /**
   * 格式化按类型分类的投喂数据
   */
  private formatFeedDataByType(feedData: FeedData[]): string {
    if (feedData.length === 0) return "";
    
    let typeLabel = "";
    switch (feedData[0].type) {
      case FeedType.ABOUT_ME:
        typeLabel = "关于我";
        break;
      case FeedType.MATERIAL:
        typeLabel = "素材";
        break;
      case FeedType.KNOWLEDGE:
        typeLabel = "知识";
        break;
    }
    
    let result = `【${typeLabel}投喂内容】\n\n`;
    
    // 按时间戳排序并拼接内容
    const sortedFeeds = [...feedData].sort((a, b) => a.timestamp - b.timestamp);
    sortedFeeds.forEach((feed, index) => {
      result += `[${index + 1}] ${feed.content}\n\n`;
    });
    
    return result;
  }

  /**
   * 生成器系统提示词
   */
  private getGeneratorSystemPrompt(): string {
    return `你是一个角色生成器AI，负责创建有深度的AI角色设定。你的任务是根据初始信息，生成符合以下JSON格式的完整角色设定：

1. 你需要生成两个主要结构：roleCard和worldBook
2. roleCard包含角色的基本设定，包括first_mes（初次见面的问候语），description（角色描述），personality（性格特点），scenario（场景设定）和mes_example（对话示例）
3. worldBook包含以下重要条目：
   - "Alist"：结构化的角色属性列表，使用XML格式，包含personality（性格）、appearance（外观）、likes（喜好）、dislikes（厌恶）等信息
   - "Plist"：角色对话示例，展示角色如何回应各种问题

请确保生成的内容丰富、有深度，并保持与初始信息的一致性。输出必须是严格的JSON格式，便于系统解析。`;
  }

  /**
   * 更新器系统提示词
   */
  private getUpdaterSystemPrompt(): string {
    return `你是一个角色生成器AI，负责根据新的投喂数据更新现有的角色设定。你的任务是分析新的投喂内容，结合现有角色设定，生成更新后的完整角色设定。

投喂内容分为三类：
1. "关于我"：用户的个人信息和偏好，用于让角色了解用户并个性化互动
2. "素材"：角色设定的参考素材，用于塑造角色的性格、外观、言行举止等
3. "知识"：角色需要记住的特定知识，通常作为独立的worldBook条目保存

请根据不同类型的投喂内容，更新roleCard和worldBook：
- "关于我"内容应影响角色如何与用户互动的设定
- "素材"内容应影响角色的基本设定，包括Alist和Plist
- "知识"内容应创建新的worldBook条目，或更新现有条目

确保输出是严格的JSON格式，包含完整更新后的roleCard和worldBook结构。`;
  }

  /**
   * 输出格式提示词
   */
  private getOutputFormatPrompt(): string {
    return `请使用以下JSON格式输出你的响应，确保格式严格符合要求：

\`\`\`json
{
  "roleCard": {
    "name": "",
    "first_mes": "角色的第一句话",
    "description": "详细的角色描述",
    "personality": "性格特点描述",
    "scenario": "角色所在场景描述",
    "mes_example": "对话示例"
  },
  "worldBook": {
    "entries": {
      "Alist": {
        "comment": "Character Attributes List",
        "content": "<attributes>\\n  <personality>性格特点</personality>\\n  <appearance>外观描述</appearance>\\n  <likes>喜好</likes>\\n  <dislikes>厌恶</dislikes>\\n</attributes>",
        "disable": false,
        "position": 4,
        "constant": true,
        "key": [],
        "order": 1,
        "depth": 1
      },
      "Plist": {
        "comment": "Character Dialogue Examples",
        "content": "用户: 问题示例\\n角色: 回答示例",
        "disable": false,
        "position": 4,
        "constant": true,
        "key": [],
        "order": 2,
        "depth": 1
      }
    }
  }
}
\`\`\`

对于知识类投喂内容，请在worldBook.entries中创建额外条目，格式如下：

\`\`\`json
"条目名称": {
  "comment": "条目描述",
  "content": "条目内容",
  "disable": false,
  "position": 4,
  "constant": true,
  "key": ["关键词1", "关键词2"],
  "order": 序号,
  "depth": 1
}
\`\`\`

请确保JSON格式完全正确，没有格式错误。`;
  }

  /**
   * 获取当前生成的角色数据
   * @returns 当前角色数据
   */
  getCurrentCharacterData(): { roleCard?: RoleCardJson; worldBook?: WorldBookJson } {
    return this.lastCharacterData || { roleCard: undefined, worldBook: undefined };
  }

  /**
   * 重置角色生成器状态
   */
  reset(): void {
    this.lastCharacterData = undefined;
    console.log("角色生成器状态已重置");
  }
}
