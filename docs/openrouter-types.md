# OpenRouter 类型定义文档

## 基本类型

本文档提供了与 OpenRouter API 集成相关的主要类型定义，这些类型定义在 `/shared/types/api-types.ts` 文件中。

### OpenRouterSettings

用于存储和管理 OpenRouter 的配置设置。

```typescript
interface OpenRouterSettings {
    enabled: boolean;          // 是否启用 OpenRouter
    apiKey: string;            // OpenRouter API Key
    model: string;             // 当前选择的模型 ID
    autoRoute: boolean;        // 是否启用自动路由
    useBackupModels: boolean;  // 在主模型不可用时使用备用模型
    backupModels: string[];    // 备用模型列表
    sortingStrategy: 'price' | 'speed' | 'latency';  // 排序策略
    dataCollection: boolean;   // 是否允许数据收集
    ignoredProviders: string[];  // 忽略的提供商列表
    quantizationLevel?: string;  // 量化级别 (可选)
}
```

### OpenRouterModel

表示从 OpenRouter API 获取的模型信息。

```typescript
interface OpenRouterModel {
    id: string;               // 模型的唯一标识符
    name: string;             // 模型的显示名称
    description?: string;     // 模型描述 (可选)
    context_length?: number;  // 模型的上下文长度 (可选)
    pricing?: {               // 价格信息 (可选)
        prompt?: number;      // 每 1K tokens 的输入价格
        completion?: number;  // 每 1K tokens 的输出价格
    };
    provider?: {              // 提供商信息 (可选)
        id?: string;          // 提供商 ID
        name?: string;        // 提供商名称
    };
}
```

### ApiSettings

API 设置的整体结构，包含不同提供商的配置。

```typescript
interface ApiSettings {
    provider: 'gemini' | 'openrouter';  // 当前选择的 API 提供商
    gemini: {
        apiKey: string;                 // Gemini API Key
    };
    openrouter: OpenRouterSettings;     // OpenRouter 设置
}
```

## 适配器接口

### OpenRouterAdapter 方法

`OpenRouterAdapter` 类提供与 OpenRouter API 交互的核心功能。

```typescript
class OpenRouterAdapter {
    // 构造函数
    constructor(apiKey: string, model: string = "openai/gpt-3.5-turbo")

    // 生成内容 - 与 Gemini 适配器接口一致
    async generateContent(contents: ChatMessage[]): Promise<string>

    // 获取可用模型列表
    async listModels(): Promise<OpenRouterModel[]>

    // 获取聊天历史
    getChatHistory(): Array<{ role: string; text: string }>
}
```

### OpenRouterModelManager 方法

`OpenRouterModelManager` 类管理模型缓存和获取。

```typescript
class OpenRouterModelManager {
    // 获取可用模型列表，支持缓存
    static async getModels(apiKey: string, forceRefresh = false): Promise<OpenRouterModel[]>

    // 清除缓存
    static async clearCache(): Promise<void>
}
```

## 请求和响应类型

### OpenRouter API 请求结构

```typescript
// 请求结构
{
  model: string,           // 模型 ID
  messages: Array<{        // 消息数组
    role: "user" | "assistant" | "system",  // 消息角色
    content: string        // 消息内容
  }>,
  temperature?: number,    // 温度（控制随机性）
  max_tokens?: number,     // 最大生成的标记数
  // 其他可选参数...
}
```

### OpenRouter API 响应结构

```typescript
// 响应结构
{
  id: string,              // 回复 ID
  choices: [               // 选择数组
    {
      message: {
        role: "assistant", // 角色
        content: string    // 生成的内容
      },
      finish_reason: string  // 完成原因
    }
  ],
  usage: {                 // 使用情况
    prompt_tokens: number, // 输入标记数
    completion_tokens: number, // 输出标记数
    total_tokens: number   // 总标记数
  },
  // 其他字段...
}
```

## 集成示例

### 向 NodeSTCore 添加 API 提供商设置

```typescript
// 初始化适配器
private initAdapters(apiKey: string, apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>) {
    // 始终初始化 Gemini 作为后备选项
    this.geminiAdapter = new GeminiAdapter(apiKey);
    
    // 如果启用了 OpenRouter 且提供了 API 密钥，初始化 OpenRouter
    if (apiSettings?.apiProvider === 'openrouter' && 
        apiSettings.openrouter?.enabled && 
        apiSettings.openrouter?.apiKey) {
        this.openRouterAdapter = new OpenRouterAdapter(
            apiSettings.openrouter.apiKey,
            apiSettings.openrouter.model || 'openai/gpt-3.5-turbo'
        );
    }
    
    // 存储设置以供后续使用
    if (apiSettings) {
        this.apiSettings = apiSettings;
    }
}

// 根据设置获取活跃适配器
private getActiveAdapter() {
    if (this.apiSettings.apiProvider === 'openrouter' && 
        this.apiSettings.openrouter?.enabled && 
        this.openRouterAdapter) {
        return this.openRouterAdapter;
    }
    return this.geminiAdapter;
}
```

### 在 ChatInput 中传递 API 设置

```typescript
const response = await NodeSTManager.processChatMessage({
  userMessage,
  conversationId: selectedCharacter.id,
  status: "同一角色继续对话",
  apiKey: user?.settings?.chat.characterApiKey || '',
  apiSettings: {
    apiProvider: user?.settings?.chat.apiProvider || 'gemini',
    openrouter: user?.settings?.chat.openrouter
  },
  character: selectedCharacter
});
```
