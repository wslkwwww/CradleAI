````markdown
# PromptBuilderService 技术文档

## 设计理念

`PromptBuilderService` 是一个用于构建 AI 请求体的核心服务，设计遵循以下核心原则：

### 1. 结构化提示词管理

提示词工程（Prompt Engineering）是 AI 应用的关键，但在复杂应用中，提示词往往变得冗长且难以维护。`PromptBuilderService` 通过将提示词组织为两种核心结构：

- **R框架（Relative Framework）**: "R"取自"relative"，表示框架中各组件的相对位置保持不变。R框架作为提示词的骨架，可适配不同场景。
- **D类条目（Depth Entries）**: "D"取自"depth"，表示这些条目可根据深度参数插入到不同位置，增强LLM对重要信息的注意力。

### 2. 解决长文本上下文窗口问题

LLM 在处理长文本时，注意力机制往往偏向文本的开头和结尾，中间部分容易被忽略。通过 D 类条目的策略性插入，`PromptBuilderService` ,确保重要信息总是出现在 LLM 注意力最集中的位置。

### 3. 统一接口，降低开发复杂度

为各种 AI 交互场景提供统一的提示词构建接口，使开发者无需重复实现提示词组装逻辑，提高代码可维护性和开发效率。

### 4. 可扩展性设计

服务采用组合式设计模式，允许灵活组合 R 框架和 D 类条目，轻松适配不同 AI 交互场景，支持未来扩展新功能而无需大规模重构。

## 核心组件

`PromptBuilderService` 由以下核心组件组成：

### 1. 数据结构

#### DEntry（D类条目）
```typescript
interface DEntry {
  name: string;                  // 条目名称 
  content: string;               // 条目内容
  role?: "user" | "model";       // 条目角色
  position?: number;             // 条目位置（0-4）
  depth?: number;                // 插入深度
  constant?: boolean;            // 是否始终包含
  key?: string[];                // 触发关键词
  identifier?: string;           // 条目唯一标识
}
```

#### RFrameworkEntry（R框架条目）
```typescript
interface RFrameworkEntry {
  name: string;                  // 条目名称
  content: string;               // 条目内容
  role?: "user" | "model" | "system";  // 条目角色
  identifier?: string;           // 条目唯一标识
  isChatHistory?: boolean;       // 是否为聊天历史容器
}
```

### 2. 主要方法

#### buildPrompt
构建完整的请求体，整合 R框架、D类条目、聊天历史和用户消息。

```typescript
static buildPrompt(options: PromptBuilderOptions): any[]
```

#### insertDEntriesToHistory
将 D 类条目插入到历史消息中，根据深度参数决定位置。

每次插入时，将以最新的用户消息为位置参考，重新根据深度参数决定插入位置。

不保留基于旧用户消息而存在的D类条目。


```typescript
private static insertDEntriesToHistory(
  history: any[],
  dEntries: DEntry[],
  baseMessage: string
): any[]
```

#### messagesToText
将消息数组转换为文本格式，适用于发送给 API。

```typescript
static messagesToText(messages: any[]): string
```

## 使用方法

### 基础用法

```typescript
// 1. 创建R框架条目
const rFramework = [
  PromptBuilderService.createRFrameworkEntry({
    name: "Description",
    content: "你是一个助手，可以帮助用户...",
    identifier: "assistantDescription"
  }),
  PromptBuilderService.createChatHistoryContainer() // 添加聊天历史容器
];

// 2. 创建D类条目（如果需要）
const dEntries = [
  PromptBuilderService.createDEntry({
    name: "Important Context",
    content: "这是用户必须知道的重要信息...",
    depth: 1,
    constant: true
  })
];

// 3. 构建请求体
const messages = PromptBuilderService.buildPrompt({
  rFramework,
  dEntries,
  userMessage: "需要传递的任务指令"
});

// 4. 转换为文本格式（如果需要）
const prompt = PromptBuilderService.messagesToText(messages);

// 5. 发送到AI服务
const response = await aiAdapter.generateContent(prompt);
```

### 高级用法：位置和深度控制

```typescript
// 在特定深度插入D类条目
const dEntries = [
  // 在基准消息之前插入
  PromptBuilderService.createDEntry({
    name: "Context Before",
    content: "这些信息会出现在倒数第二条用户消息之前", 
    depth: 2
  }),

  PromptBuilderService.createDEntry({
    name: "Context Before",
    content: "这些信息会出现在最新的用户消息之前",
    depth: 1
  }),
  
  // 在基准消息之后插入
  PromptBuilderService.createDEntry({
    name: "Context After",
    content: "这些信息会出现在最新的用户消息",
    depth: 0
  }),
];

```
D类条目插入示例

[R框架条目1]
[R框架条目2]
[Chathistory]
  -[用户消息1]
  -[AI回复1] 
  -[用户消息2]
  -[depth=2的D类条目]     
  -[AI回复2] 
  -[depth=1的D类条目]   
  -[用户最新消息] ////以最新消息为坐标原点来插入D类条目
  -[depth=0的D类条目]       
[R框架条目3]
....其他R框架条目

```


## 支持的使用场景

`PromptBuilderService` 可以支持多种 AI 交互场景，包括但不限于：

### 1. 对话系统

- 聊天机器人
- 虚拟助手
- 角色扮演聊天

### 2. 知识问答系统

- 知识库问答
- 上下文感知的问题解答
- 专业领域咨询

### 3. 特定领域工具

- 日程管理助手
- 写作辅助工具
- 编程协助

### 4. 社交互动系统

- 朋友圈互动
- 角色关系管理
- 社交内容生成

### 5. 创意生成

- 故事创作
- 角色背景生成
- 对话场景模拟

## 系统集成示例

### 日程管理功能集成

```typescript
// 来自 scheduler-manager.ts 的示例
async processSchedulerQuery(userQuery: string, userId: string, apiKey?: string): Promise<string> {
  // 1. 构建R框架
  const rFramework: RFrameworkEntry[] = [
    PromptBuilderService.createRFrameworkEntry({
      name: "Scheduler Description",
      content: "你是一个专业的日程管理助手...",
      identifier: "schedulerDescription"
    }),
    // ...其他框架条目
    PromptBuilderService.createChatHistoryContainer("schedulerHistory")
  ];
  
  // 2. 构建D类条目（待办任务作为重要上下文）
  const dEntries: DEntry[] = [
    PromptBuilderService.createDEntry({
      name: "Pending Tasks",
      content: `【待处理任务】\n${tasksText}`,
      depth: 1,
      constant: true
    })
  ];
  
  // 3. 构建请求并获取响应
  const messages = PromptBuilderService.buildPrompt({
    rFramework,
    dEntries,
    userMessage: userQuery
  });
  
  const prompt = PromptBuilderService.messagesToText(messages);
  const response = await this.geminiAdapter.generateContent([{
    role: "user", 
    parts: [{ text: prompt }]
  }]);
  
  return response;
}
```

### 朋友圈互动集成

```typescript
// 来自 circle-manager.ts 的示例
async circlePost(options: CirclePostOptions, apiKey?: string): Promise<CircleResponse> {
  // 1. 构建R框架条目
  const rFramework: RFrameworkEntry[] = [
    PromptBuilderService.createRFrameworkEntry({
      name: "Character Description",
      content: framework.base.charDescription,
      identifier: "charDescription"
    }),
    // ...其他框架条目
  ];
  
  // 2. 构建D类条目（关系数据为重要上下文）
  const dEntries: DEntry[] = [
    // 关系图谱D类条目
    PromptBuilderService.createDEntry({
      name: "Relationship Map",
      content: `【关系图谱数据】\n${relationshipsText}`,
      depth: 1,
      constant: true
    })
  ];
  
  // 3. 构建请求并获取响应
  const messages = PromptBuilderService.buildPrompt({
    rFramework,
    dEntries,
    userMessage: `【内容】${options.content.text}\n【上下文】${options.content.context || ''}`
  });
  
  const prompt = PromptBuilderService.messagesToText(messages);
  const response = await this.getChatResponse(prompt, apiKey);
  
  return this.parseCircleResponse(response);
}
```

## D类条目深度和位置详解

理解D类条目的插入机制对正确使用本服务至关重要：

### 深度（Depth）
深度值决定了D类条目相对于基准消息（通常是最新的用户消息）的位置：

- **depth=0**: 在基准消息之后立即插入
- **depth=1**: 在基准消息之前立即插入
- **depth=2**: 在倒数第二条消息之前插入
- **depth=3**: 在倒数第三条消息之前插入

### 位置（Position）
位置值决定了特殊处理规则：

- **position=4 或 undefined**: 动态深度条目，使用depth值计算插入位置
- **position=2**: 在作者注释之前插入
- **position=3**: 在作者注释之后插入

```
// 深度示意图
[用户消息 -3]  ← depth=3
[D类条目]
[用户消息 -2]  ← depth=2
[D类条目]
[用户消息 -1]  ← depth=1
[D类条目]
[基准消息]     ← 最新用户消息
[D类条目]      ← depth=0
```

## 开发规范

为确保系统的一致性和可维护性，我们规定**所有**基于AI对话的扩展工具和功能**必须**使用`PromptBuilderService`构建请求体，并遵循以下规范：

### 1. 使用前置声明

在任何使用`PromptBuilderService`的模块头部进行导入和工具声明：

```typescript
import { PromptBuilderService, DEntry, RFrameworkEntry } from '../services/prompt-builder-service';
```

### 2. 坚持使用创建方法

始终使用提供的创建方法构建条目，而不是手动创建对象：

```typescript
// 正确做法
const entry = PromptBuilderService.createDEntry({
  name: "Context",
  content: "重要信息"
});

// 错误做法
const entry = {
  name: "Context",
  content: "重要信息",
  depth: 1
};
```

### 3. 明确条目分类

清晰区分R框架条目和D类条目，不要混用：

```typescript
// 正确做法
const rFramework = [
  PromptBuilderService.createRFrameworkEntry({ /* ... */ })
];
const dEntries = [
  PromptBuilderService.createDEntry({ /* ... */ })
];

// 错误做法
const entries = [
  PromptBuilderService.createRFrameworkEntry({ /* ... */ }),
  PromptBuilderService.createDEntry({ /* ... */ })
];
```

### 4. 文档化条目用途

为每个条目添加清晰的名称和标识符，并在代码中注释其用途：

```typescript
// 用户偏好条目 - 用于个性化推荐
const prefsEntry = PromptBuilderService.createDEntry({
  name: "User Preferences",
  content: preferencesText,
  identifier: "user_prefs",
  depth: 1
});
```

### 5. 遵循核心流程

所有实现必须遵循以下基本流程：

1. 构建R框架
2. 创建必要的D类条目
3. 使用`buildPrompt`生成请求体
4. 必要时使用`messagesToText`转换为文本

## 未来发展

`PromptBuilderService`的设计允许以下方向的扩展：

1. **多模态支持**: 扩展以支持图像、音频等多模态输入
2. **高级条目类型**: 增加更复杂的条目类型，如条件逻辑条目
3. **提示词模板库**: 构建预设R框架模板库，适用于常见场景
4. **性能优化**: 针对大规模消息历史的优化处理
5. **分析工具**: 提供提示词有效性分析和优化建议

## 总结

`PromptBuilderService`是一个强大且灵活的工具，通过结构化和标准化AI提示词构建过程，降低了开发复杂度，提高了代码可维护性。它解决了长文本上下文管理的关键挑战，并为各种AI交互场景提供了统一的接口。

所有基于AI对话的功能都应该利用这一服务，以确保系统的一致性，并从其优化的提示词管理机制中受益。
````