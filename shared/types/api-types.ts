export interface OpenRouterSettings {
    enabled: boolean;
    apiKey: string;
    model: string;
    autoRoute: boolean;
    useBackupModels: boolean;
    backupModels: string[];
    sortingStrategy: 'price' | 'speed' | 'latency';
    dataCollection: boolean;
    ignoredProviders: string[];
    quantizationLevel?: string;
}

export interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    context_length?: number;
    pricing?: {
        prompt?: number;
        completion?: number;
    };
    provider?: {
        id?: string;
        name?: string;
    };
}

export interface ApiSettings {
    provider: 'gemini' | 'openrouter';
    gemini: {
        apiKey: string;
    };
    openrouter: OpenRouterSettings;
}
