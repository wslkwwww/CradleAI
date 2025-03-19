# 更新日志

2025-0305: 合并了nodest/types下的types文件，到shared/types文件中。
2025-0306: 增强了角色创建流程，优化了D类条目插入规则，实现了摇篮角色生成系统。
2025-0307: 实现了记忆总结功能，在长对话中自动总结历史记录，减轻LLM记忆衰退问题。
2025-0308: 修复了对话历史恢复功能，解决了读取保存点后重复框架问题。

# NodeST 架构文档

## 概述

NodeST 是一个用于构建基于 Gemini LLM API 的 AI 角色交互框架。该系统包含几个核心组件，这些组件共同工作以创建逼真的角色人格、管理对话历史，并实现社交互动功能。

## 核心组件

### 1. NodeSTCore

核心组件，负责处理：
- 角色创建和初始化（常规和摇篮角色）
- 角色更新
- 聊天处理和会话管理
- D类条目处理和rframework构建
- 对话记忆总结和管理

NodeSTCore 整合了之前分散在 SessionManager 和 ChatManager 之间的功能，为所有角色操作提供统一接口。

### 2. CircleManager

处理所有社交圈互动：
- 初始化角色社交圈
- 处理发帖和响应
- 评论和点赞互动
- 社交上下文的记忆管理

### 3. NodeST (主接口)

应用程序交互的公共接口：
- 提供简化的聊天处理API
- 处理JSON解析和验证
- 将请求路由到适当的核心组件

### 4. MemoryService

记忆管理专用服务：
- 提供对话历史的自动总结功能
- 可配置的记忆总结阈值和长度
- 在长对话中保持上下文连贯性
- 防止LLM记忆衰退问题


## 数据流

### 聊天流程

1. 应用程序调用 `NodeST.processChatMessage()` 并提供：
   - 用户消息
   - 对话ID
   - 状态（新建角色、继续对话、更新角色）
   - API密钥
   - 角色JSON数据（用于新建/更新操作）
   - 摇篮角色标志（用于指示是否是摇篮生成的角色）
   - 角色ID（用于记忆总结功能）

2. NodeST处理请求：
   - 验证并解析输入数据
   - 根据状态调用适当的NodeSTCore方法
   - 返回响应给应用程序

3. NodeSTCore处理核心逻辑：
   - 管理角色数据和历史
   - 处理D类条目和rframework
   - 检查是否需要进行记忆总结
   - 发送请求到Gemini/OpenRouter API
   - 更新和保存对话状态

## 记忆总结系统

### 1. 概述

记忆总结系统旨在解决LLM在长对话中的记忆衰退问题，通过自动总结历史消息，保持对话的连贯性和上下文完整性。

### 2. 工作原理

- **总结触发机制**：
  - 系统根据配置的字符阈值（默认6000字符）自动检测对话长度
  - 当对话文本量超过阈值时，触发总结流程
  - 总结生成后插入到对话历史中，作为系统消息

- **总结内容范围**：
  - 保留前3条和后3条消息不被总结，确保对话头尾的完整性
  - 仅总结中间部分的消息，使模型始终能看到最新的对话内容
  - 生成的总结会替换被总结的消息，大幅降低上下文长度

- **总结质量控制**：
  - 总结长度可配置（默认1000字符）
  - 通过提示词引导LLM生成包含关键信息的高质量总结
  - 标记关键意图、情感和重要承诺，确保对话的连续性

### 3. 技术实现

- **MemoryService**：
  - 单例模式实现，全局访问同一记忆服务实例
  - 使用AsyncStorage存储角色的记忆总结设置
  - 提供API接口检查并在必要时执行总结操作

- **总结消息结构**：
  ```typescript
  interface SummaryData {
    summary: string;            // 总结内容
    isMemorySummary: true;      // 标记为记忆总结
    timestamp: number;          // 总结生成时间
    originalMessagesRange: {    // 原始消息范围
      start: number;
      end: number;
    };
  }
  ```

- **总结设置存储**：
  - 每个角色有单独的总结设置
  - 配置项包括启用状态、总结阈值和总结长度
  - 设置存储在AsyncStorage中，键格式为`memory_settings_${characterId}`

### 4. 用户界面

在角色设置侧边栏中提供记忆总结功能配置：
- 启用/禁用记忆总结
- 配置总结阈值（3000-10000字符）
- 配置总结长度（500-2000字符）
- 设置说明和帮助文本

## 保存点系统和历史恢复

### 1. 概述

保存点系统允许用户在对话过程中创建保存点，以便稍后恢复对话状态。这个系统不仅保存了UI显示的消息，还保存了完整的NodeST内部聊天历史，确保恢复后的对话可以无缝继续。

### 2. 保存点数据结构

保存点包含以下数据：
```typescript
interface ChatSave {
  id: string;                   // 唯一ID
  conversationId: string;       // 对话ID
  characterId: string;          // 角色ID
  timestamp: number;            // 创建时间戳
  description: string;          // 用户描述
  messages: Message[];          // UI消息副本
  nodestChatHistory?: ChatHistoryEntity; // NodeST聊天历史
  previewText: string;          // 预览文本
}
```

### 3. 保存点恢复流程

1. **用户界面恢复**：
   - 用户在SaveManager中选择要恢复的保存点
   - SaveManager预览保存的对话状态
   - 用户确认恢复选定的保存点

2. **NodeST内部恢复**：
   - 首先恢复NodeST的内部聊天历史状态
   - 同时更新框架内容，确保D类条目正确注入
   - 避免框架重复插入请求中

3. **恢复关键优化**：
   - 在`NodeSTCore.restoreChatHistory`中添加框架同步
   - 在`NodeSTCore.processChat`中检测并移除重复的聊天历史条目
   - 使用现有框架而不是每次都重建框架

### 4. 框架同步机制

为解决框架重复问题，进行了以下优化：

1. **框架/历史同步**：
   - 恢复历史时同时更新框架的聊天历史部分
   - 保持框架和聊天历史的一致性
   - 使用直接AsyncStorage操作提高性能

2. **重复检测与清理**：
   - 在处理请求前检测框架中是否存在多个聊天历史条目
   - 保留在正确位置的聊天历史，移除其他重复项
   - 通过标识符和placeholders正确定位聊天历史位置

3. **渐进式框架构建**：
   - 只在必要时重建框架（首次创建或框架缺失）
   - 尽可能重用现有框架减少资源消耗
   - 优先修改现有框架而非完全替换

## 角色创建系统

### 1. 常规角色创建

常规角色创建通过 `NodeSTCore.createNewCharacter()` 方法直接完成：
- 角色数据从前端界面收集
- 使用预设模板
- 系统自动构建rframework和D类条目
- 聊天历史在框架中按预设顺序放置

### 2. 摇篮角色生成系统

摇篮角色生成是一个特殊的角色创建流程，使角色通过数据培育成长：
- 角色先创建一个初步框架
- 用户向角色"投喂"各种类型数据（关于我、材料、知识）
- 系统处理投喂数据并更新角色设定
- 经过指定时长培育（默认7天），生成成熟角色
- 摇篮标志 `isCradleGeneration` 用于区分此类角色
- 摇篮生成的角色有特殊的chatHistory顺序规则

摇篮生成的流程：
1. CradleService 管理投喂数据
2. CharacterGeneratorService 负责生成角色
3. 生成后通过 NodeST 系统初始化框架





## rFramework 构建

### rFramework 的基本结构

rFramework是与LLM交互的结构化提示框架，通过 `CharacterUtils.buildRFramework` 构建：

1. 处理输入参数：
   - 预设配置 (PresetJson)
   - 角色卡数据 (RoleCardJson)
   - 世界书数据 (WorldBookJson)
   - 选项配置 (是否摇篮生成等)

2. 构建流程：
   - 从 preset.prompt_order 读取提示顺序
   - 处理 prompts 数组，创建框架条目
   - 确保所有角色卡字段都有对应条目
   - 按 prompt_order 排序条目
   - 为 chatHistory 创建占位符，保持正确位置
   - 处理position-based条目（世界书中的position 0/1条目）

3. 返回 [ChatMessage[], ChatHistoryEntity | null] 元组：
   - 排序后的框架条目数组
   - 聊天历史实体（如果存在）

### 常规角色与摇篮角色的rFramework差异

两者的主要区别在于：

- **chatHistory 的处理**：
  - 常规角色：chatHistory 按预设中定义的位置放置
  - 摇篮角色：chatHistory 需要特殊处理，在框架中使用占位符标记位置

无论哪种方式，都确保：
1. 框架中每个条目有正确的identifier
2. chatHistory作为聊天历史被正确注入到框架
3. 始终使用占位符确保chatHistory在框架中的正确位置

## D类条目处理

### D类条目的分类

1. **角色描述相关条目 (Position 0/1)**:
   - 在框架构建阶段处理
   - 成为固定框架的一部分
   - 不会随用户消息变化而改变位置
   - 使用 order 属性决定相对顺序

2. **作者注释相关条目 (Position 2/3)**:
   - 在消息处理阶段动态插入
   - 作为 D 类条目处理
   - 位置依赖于作者注释的位置
   - 必须存在作者注释才会被插入

3. **动态深度条目 (Position 4)**:
   - 基于最新用户消息动态计算位置
   - 每次用户发送新消息时重新计算
   - 使用 depth 属性决定相对位置

### D类条目插入规则

插入规则如下：

```
// 插入深度示意图（在chathistory中）
[用户消息 -1]  ← depth=1
[D类条目]
[基准消息]     ← 最新用户消息
[D类条目]      ← depth=0
```

具体流程：
1. 首先清除所有旧的D类条目（标记为`is_d_entry`的条目）
2. 找到基准消息（最新用户消息）
3. 过滤符合条件的D类条目
4. 根据注入深度(injection_depth)分组
5. 构建消息序列：
   - 对于深度>0的条目，插入到相应深度的用户消息前
   - 对于深度=0的条目，仅在基准消息后插入
6. 为每个插入的D类条目添加`is_d_entry: true`标记

### Preset 注入类型条目

在 Preset 预设中，injection_position=1 的条目有特殊的处理规则：

1. **定义方式**
```typescript
{
    name: string;
    content: string;
    enable: boolean;
    identifier: string;
    injection_position: 1;    // 关键标识
    injection_depth: number;  // 插入深度
    role: "user" | "model";
}
```

2. **处理规则**:
   - 这类条目会被 CharacterUtils.extractDEntries 转换为特殊的 D 类条目
   - 转换后的属性:
     ```typescript
     {
         name: item.name,
         parts: [{ text: item.content }],
         role: item.role || "user",
         injection_depth: item.injection_depth || 0,
         identifier: item.identifier,
         is_d_entry: true,
         position: 4,        // 强制设为 position=4
         constant: true      // 强制设为 constant=true
     }
     ```

3. **特殊性质**:
   - 虽然在 preset 中定义，但会被当作 D 类条目处理
   - 始终会被包含（constant=true）
   - 使用 position=4 和 injection_depth 来确定插入位置
   - 遵循与普通 D 类条目相同的深度计算规则
   - 不需要 key 匹配，因为 constant=true

## 存储模型

系统使用 AsyncStorage 进行结构化数据存储：
- `nodest_[conversationId]_role`: 角色卡数据
- `nodest_[conversationId]_world`: 世界书数据
- `nodest_[conversationId]_preset`: 预设提示数据
- `nodest_[conversationId]_note`: 作者注释
- `nodest_[conversationId]_history`: 对话历史
- `nodest_[conversationId]_contents`: rframework内容
- `nodest_[conversationId]_circle_framework`: 社交圈交互rframework
- `nodest_[conversationId]_circle_memory`: 社交圈记忆数据
- `memory_settings_[characterId]`: 角色记忆总结设置

## 集成指南

### 基本聊天集成

```typescript
import { NodeST } from '@/NodeST/nodest';

const nodest = new NodeST();

// 处理聊天消息
const result = await nodest.processChatMessage({
  userMessage: "你好!",
  conversationId: "character123",
  status: "同一角色继续对话",
  apiKey: "your-gemini-api-key"
});

if (result.success) {
  console.log(result.response);
} else {
  console.error(result.error);
}
```

### 记忆总结功能集成

```typescript
import { NodeST } from '@/NodeST/nodest';
import { memoryService } from '@/services/memory-service';

// 1. 在设置中配置记忆总结选项
await memoryService.saveSettings(characterId, {
  enabled: true,              // 启用记忆总结
  summaryThreshold: 6000,     // 6000字符触发总结
  summaryLength: 1000,        // 总结长度1000字符
  lastSummarizedAt: 0         // 上次总结时间戳
});

// 2. 在聊天流程中传递角色ID以启用记忆总结
const nodest = new NodeST();
const result = await nodest.processChatMessage({
  userMessage: "你好，我们继续之前的话题吧",
  conversationId: "conversation123",
  status: "同一角色继续对话",
  apiKey: "your-api-key",
  characterId: "character123"  // 关键参数：提供角色ID以启用记忆总结
});

if (result.success) {
  console.log(result.response);
} else {
  console.error(result.error);
}
```

### 摇篮角色创建和投喂

```typescript
import { CharactersContext } from '@/constants/CharactersContext';
import { FeedType } from '@/NodeST/nodest/services/character-generator-service';

// 创建摇篮角色
const cradleCharacter = {
  id: generateUniqueId(),
  name: "新角色",
  description: "这是一个摇篮系统中的角色",
  inCradleSystem: true,
  feedHistory: []
};

// 添加到摇篮系统
await addCradleCharacter(cradleCharacter);

// 向角色投喂内容
await addFeed(
  cradleCharacter.id,
  "这个角色喜欢读书和旅行",
  FeedType.ABOUT_ME
);

// 处理投喂数据
await processFeedsNow();

// 生成正式角色
const generatedCharacter = await generateCharacterFromCradle(cradleCharacter.id);
```

### 社交圈集成

```typescript
import { NodeST, CirclePostOptions } from '@/NodeST/nodest';

const nodest = new NodeST();

// 初始化角色社交圈
await nodest.initCharacterCircle("character123");

// 处理社交互动
const options: CirclePostOptions = {
  type: "post",
  content: {
    authorId: "character123",
    text: "今天在海滩度过了愉快的一天！",
    context: "这是一篇所有朋友可见的公开贴文"
  }
};

const result = await nodest.processCircleInteraction(options);

if (result.success) {
  console.log(result.action);  // 点赞/评论操作
} else {
  console.error(result.error);
}
```

## API支持拓展

NodeST现在支持多种LLM API：

1. **Gemini API**:
   - 默认API提供者
   - 使用GeminiAdapter处理请求
   - 每次调用前需要设置API Key

2. **OpenRouter API**:
   - 替代API提供者
   - 通过OpenRouterAdapter使用不同模型
   - 可在设置中配置:
     ```typescript
     nodest.updateApiSettings(apiKey, {
       apiProvider: 'openrouter',
       openrouter: {
         enabled: true,
         apiKey: 'your-openrouter-key',
         model: 'anthropic/claude-3-haiku'
       }
     });
     ```

可根据不同需求选择不同的API提供者，系统会自动处理转换过程。

## 性能考虑

- 大型对话历史会影响性能和LLM记忆能力
- 记忆总结功能可有效缓解长对话中的上下文限制问题
- 合理设置总结阈值可平衡API调用频率和记忆效果
- 对总结长度的配置影响上下文质量和API费用
- 监控API使用情况以保持在Gemini/OpenRouter的速率限制内
