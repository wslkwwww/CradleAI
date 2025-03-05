# 更新日志

2025 0305 ：合并了nodest/types下的types文件，到shared/types文件中。

# NodeST Architecture Documentation

## Overview

NodeST is a framework for building AI-powered character interactions using the Gemini LLM API. The system consists of several core components that work together to create believable character personalities, manage conversation histories, and enable social interactions.

## Core Components

### 1. NodeSTCore

The central component that handles:
- Character creation and initialization
- Character updating
- Chat processing and conversation management
- D-entry handling and rframework building

NodeSTCore consolidates the functionality previously split between SessionManager and ChatManager, providing a unified interface for all character-based operations.

### 2. CircleManager

Handles all social circle interactions:
- Circle initialization for characters
- Post handling and responses
- Comment and like interactions
- Memory management for social contexts

### 3. NodeST (Main interface)

The public interface that applications interact with:
- Provides simplified API for chat processing
- Handles JSON parsing and validation
- Routes requests to appropriate core components

## Data Flow

### Chat Flow

1. Application calls `NodeST.processChatMessage()` with:
   - User message
   - Conversation ID
   - Status (new character, continue chat, update character)
   - API key
   - Character JSON data (for new/update operations)

2. NodeST processes the request:
   - Validates and parses input data
   - Calls appropriate NodeSTCore methods based on status
   - Returns response to application

3. NodeSTCore handles the core logic:
   - Managing character data and history
   - Processing D-entries and rframework
   - Sending requests to Gemini API
   - Updating and saving conversation state

### Social Circle Flow

1. Application calls `NodeST.processCircleInteraction()` with:
   - Interaction type (post, comment, like)
   - Content details
   - Author ID and context

2. NodeST routes the request to CircleManager

3. CircleManager:
   - Loads character rframework and personality
   - Builds appropriate prompt
   - Gets response from LLM
   - Updates circle memory
   - Returns formatted response

## Key Classes and Responsibilities

### NodeSTCore
- Character creation and management
- Chat history management
- D-entry processing
- rframework building
- Gemini API interaction

### CircleManager
- Social interaction processing
- Circle memory management
- Character social behavior modeling

### NodeST
- Public API exposure
- Request routing
- Input validation
- Error handling

## Storage Model

The system uses AsyncStorage with a structured key system:
- `nodest_[conversationId]_role`: Role card data
- `nodest_[conversationId]_world`: World book data
- `nodest_[conversationId]_preset`: Preset prompts data
- `nodest_[conversationId]_note`: Author notes
- `nodest_[conversationId]_history`: Conversation history
- `nodest_[conversationId]_contents`: rframework contents
- `nodest_[conversationId]_circle_framework`: Circle interaction rframework
- `nodest_[conversationId]_circle_memory`: Circle memory data

## Integration Guidelines

### Basic Chat Integration

```typescript
import { NodeST } from '@/NodeST/nodest';

const nodest = new NodeST();

// Process a chat message
const result = await nodest.processChatMessage({
  userMessage: "Hello!",
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

### Social Circle Integration

```typescript
import { NodeST, CirclePostOptions } from '@/NodeST/nodest';

const nodest = new NodeST();

// Initialize character for circle interactions
await nodest.initCharacterCircle("character123");

// Process a social interaction
const options: CirclePostOptions = {
  type: "post",
  content: {
    authorId: "character123",
    text: "Just had a wonderful day at the beach!",
    context: "This is a public post visible to all friends"
  }
};

const result = await nodest.processCircleInteraction(options);

if (result.success) {
  console.log(result.action);  // Like/comment actions
} else {
  console.error(result.error);
}
```

### 重要区别说明
1. 角色描述相关条目 (Position 0/1):
   - 在框架构建阶段处理
   - 成为固定框架的一部分
   - 不会随用户消息变化而改变位置
   - 使用 order 属性决定相对顺序

2. 作者注释相关条目 (Position 2/3):
   - 在消息处理阶段动态插入
   - 作为 D 类条目处理
   - 位置依赖于作者注释的位置
   - 必须存在作者注释才会被插入

3. 动态深度条目 (Position 4):
   - 基于最新用户消息动态计算位置
   - 每次用户发送新消息时重新计算
   - 使用 depth 属性决定相对位置

### Preset 注入类型条目
在 Preset 预设中，injection_position=1 的条目有特殊的处理规则：

我来添加关于 preset 中 injection_position=1 条目的处理说明：

```markdown

// ...existing code...

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

4. **与普通 D 类条目的区别**:
   - 来源于 preset 而不是 worldBook
   - 强制 constant=true，不支持条件触发
   - 保持原始的 injection_depth 值
   - 可以通过 identifier 追踪来源

5. **插入位置计算**:
   - 与其他 position=4 的 D 类条目一样处理
   - 基于最新用户消息计算插入位置
   - injection_depth 决定相对于基准消息的插入位置
   - 每次新消息时重新计算位置

示例：
```typescript
// preset 中的定义
{
    name: "特殊提示",
    content: "这是一个重要提示",
    enable: true,
    identifier: "special_hint",
    injection_position: 1,
    injection_depth: 2,
    role: "user"
}

// 转换后的 D 类条目
{
    name: "特殊提示",
    parts: [{ text: "这是一个重要提示" }],
    role: "user",
    injection_depth: 2,
    identifier: "special_hint",
    is_d_entry: true,
    position: 4,
    constant: true
}
```

这个条目会始终被包含，并且按照 depth=2 的规则插入到倒数第二条消息之前。


## Extending The System

### Adding New Interaction Types

1. Define new interaction types in `circle-types.ts`
2. Implement handling logic in CircleManager
3. Expose new methods through NodeST interface

### Enhancing Character Memory

1. Modify the framework building process in NodeSTCore
2. Add additional memory structures in storage
3. Update the prompt generation to include new memory contexts

## Performance Considerations

- Large conversation histories can impact performance
- Consider implementing conversation summarization for long chats
- Use proper error handling to prevent data corruption
- Monitor API usage to stay within Gemini's rate limits
