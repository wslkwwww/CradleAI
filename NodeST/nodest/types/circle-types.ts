import { ChatMessage, WorldBookEntry } from './types';

export interface CircleRFramework {
    base: {
        charDescription: string;
        charPersonality: string;
    };
    circle: {
        scenePrompt: string;
        responseFormat: {
            action: {
                like: boolean;
                comment?: string;
            };
            emotion: {
                type: "positive" | "neutral" | "negative";
                intensity: number; // 0-1
            };
        };
    };
}

export interface CirclePostOptions {
    type: 'newPost' | 'replyToComment' | 'replyToPost';
    content: {
        authorId: string;  // 帖子作者ID
        text: string;
        context?: string;
    };
    responderId: string;  // 添加响应者ID字段，用于加载正确的框架
}

export interface CircleResponse {
    success: boolean;
    action?: {
        like: boolean;
        comment?: string;
    };
    error?: string;
}

export interface CircleMemorySystem {
    realtime: ChatMessage[];
    summary: WorldBookEntry & {
        key: ['circle_memory'];
        updateInterval: number;
    };
}

export interface CircleMemory extends ChatMessage {
    timestamp: number;
    type: 'newPost' | 'replyToComment' | 'replyToPost';
}
