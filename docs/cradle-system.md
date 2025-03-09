# 摇篮系统 (Cradle System) 文档

## 更新日志

**2023-07-01: 初始版本**
- 创建前端UI界面
- 定义基础数据结构

**2023-08-15: 版本更新**
- 实现角色生成器核心功能
- 集成Gemini LLM
- 完成投喂类型分类功能
- 实现消息队列处理机制

**2023-10-20: OpenRouter集成及UI优化**
- 集成OpenRouter API支持，扩展LLM选项
- 重新设计摇篮培育详情展示区，支持背景图片
- 改进角色选择交互，实现角色选择与详情联动
- 优化键盘处理，解决页面偏移问题
- 修复角色列表刷新和投喂计数更新问题

## 概述

摇篮系统是一种创新的AI角色生成机制，通过让用户在一段时间内"投喂"数据给未成熟的角色，来培育和塑造具有独特个性的AI角色。与传统的直接创建角色方法相比，摇篮系统能够形成更加丰富、自然且个性化的角色设定。

## 核心概念

### 摇篮培育周期

摇篮系统基于培育周期概念，用户可以设置1-30天的培育周期。培育期间，角色处于"成长"状态，通过用户提供的各类数据逐渐形成自己的个性和知识库。

### 角色成熟阶段

角色培育分为三个阶段：
- **孵化期 (Egg)**: 初始阶段，角色个性尚未形成
- **成长期 (Growing)**: 正在吸收和处理投喂的数据
- **成熟期 (Mature)**: 角色个性已经形成，准备"毕业"为正式角色

### 数据投喂

用户可以投喂多种类型的数据：
- **关于我类型**: 角色的基本设定、背景故事、性格特点等
- **知识类型**: 角色应该掌握的专业知识、常识、观点等
- **素材类型**: 参考材料、灵感来源、文化背景等
- **文本类型**: 一般文本内容，将被分类处理
- **图片类型**: 图片数据（需要可用的视觉模型支持）
- **语音类型**: 语音数据（需要可用的语音模型支持）

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
│   ├── CradleApiSettings.tsx       // 新增 - 摇篮API设置组件
│   └── ImportToCradleModal.tsx     // 导入现有角色到摇篮系统组件
├── constants/
│   ├── types.ts                    // 摇篮系统相关类型定义
│   └── CharactersContext.tsx       // 包含摇篮系统的业务逻辑和数据管理
├── shared/
│   ├── types.ts                    // 摇篮角色的定义，继承自常规角色
│   └── types/
│       └── api-types.ts           // 新增 - API相关类型定义
├── NodeST/nodest/
│   ├── services/
│   │   ├── character-generator-service.ts // 角色生成器服务
│   │   ├── cradle-service.ts            // 摇篮系统核心服务
│   │   └── prompt-builder-service.ts    // 提示词构建服务
│   ├── utils/
│   │   ├── gemini-adapter.ts           // Gemini API适配器
│   │   ├── openrouter-adapter.ts       // 新增 - OpenRouter API适配器
│   │   └── openrouter-model-manager.ts // 新增 - OpenRouter模型管理器
│   └── types/
│       └── types.ts                    // NodeST相关类型定义
├── assets/
│   └── images/
│       └── default-cradle-bg.jpg       // 新增 - 默认摇篮背景图
├── docs/
│   ├── cradle-system.md                // 摇篮系统开发文档
│   ├── cradle-requirement.md           // 摇篮系统需求文档
│   └── issue.md                        // 问题追踪和修复文档
├── tests/
│   └── cradle-service.test.ts          // 摇篮服务测试
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
interface CradleCharacter extends Omit<Character, 'backgroundImage'> {
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
  backgroundImage: string | null;  // 角色背景图片
}
```

## OpenRouter API 集成

OpenRouter API是一项服务，它允许通过统一的API访问多种AI大模型，包括OpenAI的GPT模型、Anthropic的Claude以及其他知名AI提供商的模型。我们的摇篮系统现在支持通过OpenRouter API访问这些模型，为用户提供更多选择。

### OpenRouterAdapter

`OpenRouterAdapter` 类提供与OpenRouter API的接口，主要功能包括：

- 文本生成请求处理
- 模型列表获取
- 对话历史管理

```typescript
export class OpenRouterAdapter {
  // 核心方法
  async generateContent(messages: ChatMessage[]): Promise<string> { ... }
  async listModels(): Promise<OpenRouterModel[]> { ... }
}
```

### OpenRouterModelManager

`OpenRouterModelManager` 类提供模型缓存和管理功能，以减少API调用和提高响应速度：

```typescript
export class OpenRouterModelManager {
  // 核心方法
  static async getModels(apiKey: string, forceRefresh = false): Promise<OpenRouterModel[]> { ... }
  static async clearCache(): Promise<void> { ... }
}
```

### CradleApiSettings 组件

新增的 `CradleApiSettings` 组件提供了友好的用户界面，允许用户：

- 在Gemini API和OpenRouter API之间切换
- 配置OpenRouter API密钥
- 从可用模型列表中选择特定模型
- 测试API连接

## UI/UX优化

### 重新设计的摇篮培育详情区

"摇篮培育进行中"区域改造为"摇篮培育详情区"，具有以下改进：

- 支持角色背景图片显示
- 使用LinearGradient提供更好的文本可见度
- 突出显示选中角色的头像和信息
- 实现角色状态的实时更新
- 更清晰地展示培育进度

### 角色选择交互优化

- 选择角色后自动显示在详情区域
- 对当前选择的角色提供视觉反馈（高亮显示）
- 只有在选择了角色后才能执行特定操作（如投喂）
- 角色列表和详情区保持数据同步

### 键盘处理优化

解决了键盘弹出/隐藏引起的UI问题：

- 使用`KeyboardAvoidingView`适当调整布局
- 添加键盘事件监听器以跟踪键盘状态
- 在键盘弹出时滚动到相关输入区域
- 在键盘隐藏时恢复正常布局

### 数据刷新优化

解决了数据刷新相关的问题：

- 导入角色后立即刷新摇篮角色列表
- 投喂数据后立即更新投喂计数显示
- 模态框关闭后自动刷新相关数据
- 角色选择状态在数据刷新后保持一致

## 核心服务实现更新

### 摇篮服务 (CradleService)

摇篮服务已更新以支持OpenRouter API：

```typescript
export class CradleService {
  // 支持API设置更新
  public updateApiSettings(apiSettings: {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }) { ... }

  // 根据设置选择合适的适配器
  private getActiveAdapter() { ... }
}
```

### 角色生成器 (CharacterGeneratorService)

角色生成器现在支持多LLM提供商：

```typescript
export class CharacterGeneratorService {
  private llmAdapter: GeminiAdapter | OpenRouterAdapter;
  
  constructor(adapter: GeminiAdapter | OpenRouterAdapter) {
    this.llmAdapter = adapter;
  }
  
  // 生成和更新方法保持不变，但现在可以使用不同的适配器
}
```

## 已实现功能更新

除了之前已实现的功能外，现在还包括：

1. ✅ **多LLM提供商支持**: 通过OpenRouter API支持多种LLM
2. ✅ **角色详情展示优化**: 使用背景图片增强视觉体验
3. ✅ **角色选择交互**: 实现了角色选择与详情展示的联动
4. ✅ **UI/UX优化**: 改进了键盘处理和数据刷新机制
5. ✅ **即时数据更新**: 导入和投喂后立即更新相关数据
6. ✅ **API设置管理**: 新增了API设置管理界面

## 待实现功能

除了之前的待实现功能外，新增：

1. ❌ **更细粒度的模型参数控制**: 允许用户调整温度、top-p等模型参数
2. ❌ **模型与角色的兼容性匹配**: 根据角色类型推荐适合的模型
3. ❌ **多API费用跟踪**: 跟踪不同API提供商的使用成本
4. ❌ **自定义二元对立模块**: 实现角色创建时的性格滑块自定义功能

## 开发者指南

### 如何添加新的API提供商

要添加新的API提供商，请按以下步骤操作：

1. 创建新的适配器类，实现与`GeminiAdapter`和`OpenRouterAdapter`相同的接口
2. 更新`CradleService`以支持新的适配器
3. 在`CharactersContext`中添加相关设置和方法
4. 创建对应的设置UI组件
5. 更新`CradleApiSettings`组件以包含新提供商

### 如何扩展角色详情区

详情区可以进一步扩展以显示更多信息：

1. 添加角色情绪动画
2. 实现点击角色头像显示更多详细信息
3. 在详情区域增加培育过程可视化
4. 添加快速操作按钮

## 问题排查指南

### 1. API连接问题

**可能原因**:
- API密钥无效或过期
- 网络连接问题
- 请求格式错误

**排查步骤**:
1. 使用"测试连接"功能验证API密钥
2. 检查控制台中的请求/响应日志
3. 确认API提供商服务状态
4. 验证请求体格式是否符合API要求

### 2. 模型加载失败

**可能原因**:
- API密钥权限不足
- 网络请求超时
- 返回数据格式变更

**排查步骤**:
1. 检查`OpenRouterModelManager`缓存
2. 尝试使用`forceRefresh`参数强制刷新模型列表
3. 验证API响应格式是否符合预期

## 未来规划

### 短期目标

1. 完成自定义二元对立模块的实现
2. 优化角色背景图片的裁剪和显示
3. 增强投喂类型的处理逻辑

### 中期目标

1. 实现模型参数的精细控制
2. 添加培育过程的可视化展示
3. 支持更多的媒体类型投喂

### 长期目标

1. 实现社区分享功能
2. 开发角色融合机制
3. 提供模板库以快速创建特定类型的角色
