export interface OpenRouterSettings {
    enabled: boolean;          // 是否启用 OpenRouter
    apiKey: string;            // OpenRouter API Key
    model: string;             // 当前选择的模型 ID
    autoRoute?: boolean;       // 是否启用自动路由
    useBackupModels?: boolean; // 在主模型不可用时使用备用模型
    backupModels?: string[];   // 备用模型列表
    sortingStrategy?: 'price' | 'speed' | 'latency';  // 排序策略
    dataCollection?: boolean;  // 是否允许数据收集
    ignoredProviders?: string[]; // 忽略的提供商列表
    quantizationLevel?: string;  // 量化级别 (可选)
}

export interface OpenRouterModel {
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

export interface ApiSettings {
    provider: 'gemini' | 'openrouter';
    gemini: {
        apiKey: string;
    };
    openrouter: OpenRouterSettings;
}

// OpenRouter API 请求
export interface OpenRouterRequest {
    model: string;           // 模型 ID
    messages: Array<{        // 消息数组
        role: "user" | "assistant" | "system";  // 消息角色
        content: string;       // 消息内容
    }>;
    temperature?: number;    // 温度（控制随机性）
    max_tokens?: number;     // 最大生成的标记数
    top_p?: number;          // Top P 采样
    top_k?: number;          // Top K 采样
    stream?: boolean;        // 是否启用流式响应
    stop?: string[];         // 停止序列
}

// OpenRouter API 响应
export interface OpenRouterResponse {
    id: string;              // 回复 ID
    choices: Array<{         // 选择数组
        message: {
            role: "assistant";   // 角色
            content: string;     // 生成的内容
        };
        finish_reason: string; // 完成原因
    }>;
    usage?: {                // 使用情况
        prompt_tokens: number; // 输入标记数
        completion_tokens: number; // 输出标记数
        total_tokens: number;  // 总标记数
    };
    model: string;           // 实际使用的模型
    cached?: boolean;        // 是否使用了缓存
}

// OpenRouter 流式响应中的 Delta 对象
export interface OpenRouterDelta {
    role?: string;
    content?: string;
}

// OpenRouter 错误响应
export interface OpenRouterError {
    error: {
        message: string;
        type?: string;
        param?: string;
        code?: string;
    };
}

// OpenRouter 模型列表响应
export interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}
