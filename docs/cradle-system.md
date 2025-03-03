
# 摇篮系统 (Cradle System) 开发文档

## 更新日志

**2023-07-01: 初始版本**
- 创建前端UI界面
- 定义基础数据结构

**2023-08-15: 版本更新**
- 实现角色生成器核心功能
- 集成Gemini LLM
- 完成投喂类型分类功能
- 实现消息队列处理机制

## 概述

摇篮系统是一个用于培育和生成更具个性化AI角色的功能模块。通过让用户在一段时间内"投喂"数据（文本、图片等）给未成熟的角色，系统可以根据这些输入来塑造和生成具有独特个性的AI角色。这种方式比直接创建角色更能形成有深度和个性的角色设定。

## 文件结构

摇篮系统的实现涉及以下文件：

```
/f:/my-app/
├── app/
│   ├── (tabs)/
│   │   └── cradle.tsx              // 摇篮系统主页面
│   ├── pages/
│   │   ├── create_char_cradle.tsx  // 摇篮角色创建独立页面
│   │   └── create_character_tabs.tsx // 角色创建页面（包含摇篮标签页）
├── components/
│   ├── CradleCreateForm.tsx        // 摇篮角色创建表单组件
│   ├── CradleFeedModal.tsx         // 摇篮数据投喂模态框
│   ├── CradleSettings.tsx          // 摇篮系统设置组件
│   └── ImportToCradleModal.tsx     // 导入现有角色到摇篮系统组件
├── constants/
│   ├── types.ts                    // 摇篮系统相关类型定义
│   └── CharactersContext.tsx       // 包含摇篮系统的业务逻辑和数据管理
├── shared/
│   └── types.ts                    // 摇篮角色的定义，继承自常规角色
├── NodeST/nodest/
│   ├── services/
│   │   ├── character-generator-service.ts // 角色生成器服务
│   │   ├── cradle-service.ts            // 摇篮系统核心服务
│   │   └── prompt-builder-service.ts    // 提示词构建服务
│   ├── utils/
│   │   └── gemini-adapter.ts            // Gemini API适配器
│   └── types/
│       └── types.ts                     // NodeST相关类型定义
├── docs/
│   ├── cradle-system.md                 // 摇篮系统开发文档
│   └── cradle-requirement.md            // 摇篮系统需求文档
├── tests/
│   └── cradle-service.test.ts           // 摇篮服务测试
```

## 核心类型定义

摇篮系统的核心数据结构定义在 `shared/types.ts` 和 `constants/types.ts` 中：

### CradleSettings

```typescript
interface CradleSettings {
  enabled: boolean;         // 摇篮系统是否启用
  duration: number;         // 培育周期（天）
  startDate?: string;       // 开始培育日期
  progress?: number;        // 培育进度（百分比）
  lastInterruption?: string; // 上次中断时间
  cradleConversationId?: string; // 关联的会话ID
}
```

### Feed

```typescript
interface Feed {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image'; // 投喂类型
  timestamp: number;                // 时间戳
  processed: boolean;               // 是否已处理
}
```

### FeedType (角色生成器专用)

```typescript
enum FeedType {
  ABOUT_ME = "aboutMe",     // 关于我的信息
  MATERIAL = "material",    // 素材信息
  KNOWLEDGE = "knowledge"   // 知识信息
}
```

### CradleCharacter

```typescript
interface CradleCharacter extends Character {
  feedHistory: Feed[];             // 投喂历史
  inCradleSystem: boolean;         // 是否在摇篮系统中
  isCradleGenerated?: boolean;     // 是否由摇篮生成的角色
  cradleAnimation?: CradleAnimation;
  importedFromCharacter?: boolean; // 是否从常规角色导入
  importedCharacterId?: string;    // 导入来源的角色ID
  initialSettings?: {              // 初始设定
    axis?: {...};                  // 性格坐标轴
    sliders?: {...};               // 属性滑块
    reference?: string;            // 参考角色ID
    description?: string;          // 描述
  };
  cradle?: {                       // 摇篮特定数据
    startDate?: string;
    progress?: number;
    stage?: 'egg' | 'growing' | 'mature';
    lastFeedTimestamp?: number;
  };
}
```

## 核心服务实现

### 摇篮服务 (CradleService)

摇篮服务是连接前端和角色生成器的中间层，负责管理投喂数据队列和处理流程。

#### 主要功能

- **投喂数据管理**: 存储和跟踪用户提供的各种类型投喂数据
- **批量处理**: 定期批量处理投喂数据，而不是每次投喂都即时处理
- **状态管理**: 跟踪哪些投喂已被处理，哪些仍在等待处理
- **角色数据持久化**: 保存和更新角色数据

#### 代码示例

```typescript
// 添加投喂内容到队列
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

// 定期处理投喂数据
startFeedProcessor(): void {
  this.processingInterval = setInterval(async () => {
    const unprocessedFeeds = this.pendingFeeds.filter(feed => !feed.processed);
    if (unprocessedFeeds.length === 0) return;
    
    await this.processUnprocessedFeeds();
  }, this.processingDelay);
}
```

### 角色生成器 (CharacterGeneratorService)

负责使用LLM生成和更新角色设定，是摇篮系统的核心AI组件。

#### 主要功能

- **初始角色生成**: 根据用户提供的初始数据生成基础角色设定
- **角色迭代更新**: 根据投喂数据更新和完善角色设定
- **LLM交互**: 构建提示词并与Gemini LLM交互
- **JSON响应解析**: 处理和清洗LLM返回的JSON数据

#### 代码示例

```typescript
// 初始角色生成
async generateInitialCharacter(initialData: CharacterInitialData): Promise<CharacterGenerationResult> {
  // 构建R框架条目
  const rFramework: RFrameworkEntry[] = [
    PromptBuilderService.createRFrameworkEntry({
      name: "Task Description",
      content: this.getGeneratorSystemPrompt(),
      role: "system",
      identifier: "task_description"
    }),
    // ...more framework entries...
  ];

  // 构建提示词
  const messages = PromptBuilderService.buildPrompt({ rFramework });
  const prompt = PromptBuilderService.messagesToText(messages);
  
  // 发送到Gemini
  const response = await this.geminiAdapter.generateContent([{
    role: "user", 
    parts: [{ text: prompt }]
  }]);

  // 解析响应
  const result = this.parseGeminiResponse(response);
  return result;
}
```

## 前端实现

### 摇篮主页面 (cradle.tsx)

主页面展示摇篮系统状态和角色列表，提供投喂、导入和生成角色的功能入口。

### 投喂模态框 (CradleFeedModal.tsx)

允许用户为角色投喂不同类型的数据，包括：

- **关于我**: 用户个人信息和偏好
- **素材**: 角色设定的参考素材
- **知识**: 角色需要记住的特定信息

### 导入模态框 (ImportToCradleModal.tsx)

允许用户将现有角色导入摇篮系统进行培育和增强。

### 设置组件 (CradleSettings.tsx)

提供摇篮系统的全局设置，如培育周期和系统启用/禁用。

## 数据流

摇篮系统的数据流如下：

1. **投喂数据收集**
   ```
   用户输入 -> 分类(关于我/素材/知识) -> 投喂队列
   ```

2. **批量处理**
   ```
   投喂队列 -> 定期处理 -> 角色生成器
   ```

3. **角色生成**
   ```
   角色生成器 -> Gemini LLM -> JSON响应 -> 解析 -> 更新角色数据
   ```

4. **角色导出**
   ```
   摇篮角色数据 -> 转换 -> 标准角色 -> 应用到系统
   ```

## 已实现功能

目前已实现的功能包括：

1. ✅ **投喂类型分类**: 支持"关于我"、"素材"和"知识"三种类型
2. ✅ **消息队列处理**: 实现了投喂数据的队列管理和批处理
3. ✅ **角色生成器核心**: 使用Gemini LLM生成角色设定
4. ✅ **角色导入功能**: 支持将现有角色导入摇篮系统
5. ✅ **JSON响应处理**: 解析和清洗LLM返回的JSON数据
6. ✅ **培育周期管理**: 支持设置培育周期和进度跟踪

## 待实现功能

还需要实现的功能包括：

1. ❌ **图片投喂处理**: 目前仅支持文本投喂，需要增加对图片数据的处理
2. ❌ **实时反馈系统**: 为用户提供投喂处理状态和效果的实时反馈
3. ❌ **性格发展可视化**: 展示角色随投喂变化的个性发展轨迹
4. ❌ **多设备同步**: 实现摇篮数据的云同步功能
5. ❌ **投喂推荐系统**: 基于角色当前发展状态推荐适合的投喂内容

## 开发者指南

### 1. 如何扩展投喂类型

要添加新的投喂类型，请按以下步骤操作：

1. 在 `character-generator-service.ts` 中的 `FeedType` 枚举中添加新类型
2. 在 `CradleFeedModal.tsx` 中更新UI以支持新类型
3. 在 `updateCharacterWithFeeds` 方法中添加新类型的处理逻辑
4. 更新 `formatFeedDataByType` 以正确格式化新类型的投喂数据

### 2. 优化LLM提示词

要优化角色生成的质量，可以修改以下方法中的提示词：

- `getGeneratorSystemPrompt`: 初始角色生成提示词
- `getUpdaterSystemPrompt`: 角色更新提示词
- `getOutputFormatPrompt`: 输出格式控制提示词

### 3. 添加新测试用例

在扩展功能时，应在 `cradle-service.test.ts` 中添加相应的测试用例：

```typescript
test('should process new feed type correctly', () => {
  cradleService.addFeed("Test content", FeedType.NEW_TYPE);
  // ...assertions...
});
```

## 问题排查指南

### 1. 角色生成失败

**可能原因**:
- Gemini API密钥无效或已过期
- 提示词格式有误
- JSON响应解析失败

**排查步骤**:
1. 检查API密钥和网络连接
2. 查看控制台日志中的完整错误信息
3. 检查 `parseGeminiResponse` 方法中的正则表达式匹配

### 2. 投喂数据未被处理

**可能原因**:
- 处理间隔设置过长
- 处理器未启动
- 数据标记为已处理但未实际更新

**排查步骤**:
1. 检查 `processingDelay` 值
2. 确认 `startFeedProcessor` 被正确调用
3. 查看 `processUnprocessedFeeds` 中的日志输出

## 未来规划

### 短期目标

1. 完善图片数据处理
2. 实现投喂效果预览
3. 优化角色生成提示词

### 中期目标

1. 添加角色发展轨迹可视化
2. 实现更精细的特性合并逻辑
3. 增强批处理机制的智能性

### 长期目标

1. 多模态投喂支持（语音、视频）
2. 角色融合功能
3. 社区分享功能

## 贡献指南

当添加新功能或修改现有功能时，请遵循以下准则：

1. 保持与现有代码风格一致
2. 添加详细日志输出，以便于调试
3. 为新功能编写测试用例
4. 更新此文档以反映更改

## 结语

摇篮系统是一个功能丰富的个性化角色培育平台，通过Gemini LLM提供自然语言处理能力。目前系统已实现核心功能，但仍有改进空间。后续开发者应关注多模态支持、用户反馈和性能优化等方面的工作。
