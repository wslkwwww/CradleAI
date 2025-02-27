// ============= 基础类型 =============
export interface User {
    id: string;
    avatar?: string;
    name?: string;
    settings?: GlobalSettings;
}

export interface GlobalSettings {
    self: {
        nickname: string;
        gender: 'male' | 'female' | 'other';
        description: string;
    };
    chat: {
        serverUrl: string;
        characterApiKey: string;
        memoryApiKey: string;
        xApiKey: string;
    };
}

// ============= NodeST 核心类型 =============
export interface RoleCardJson {
    name: string;
    first_mes: string;
    description: string;
    personality: string;
    scenario: string;
    mes_example: string;
    background?: string;
    data?: {
        extensions?: {
            regex_scripts?: RegexScript[];
        };
    };
}

export interface RegexScript {
    scriptName: string;
    findRegex: string;
    replaceString: string;
    flags?: string;
}

export interface WorldBookJson {
    entries: {
        [key: string]: WorldBookEntry;
    };
}

export interface WorldBookEntry {
    comment: string;
    content: string;
    disable: boolean;
    position: 0 | 1 | 2 | 3 | 4;
    key?: string[];
    constant: boolean;
    order: number;
    depth: number;
    vectorized?: boolean;
}

export interface PresetJson {
    prompts: Array<{
        name: string;
        content: string;
        enable: boolean;
        identifier: string;
        injection_position?: 0 | 1;
        injection_depth?: number;
        role: "user" | "model";
    }>;
    prompt_order: PromptOrder[];
}

export interface PromptOrder {
    order: Array<{
        identifier: string;
        enabled: boolean;
    }>;
}

export interface AuthorNoteJson {
    charname: string;
    username: string;
    content: string;
    role?: string;
    injection_depth: number;
}

// ============= 聊天消息类型 =============
export interface MessagePart {
    text?: string;
    role?: string;
    injection_depth?: number;
    position?: number;
    parts?: MessagePart[]; // 递归结构，消息是否包含子消息
    is_d_entry?: boolean; // 是否是世界书条目
}

export interface ChatMessage {
    role: string;
    parts: MessagePart[]  ;
    is_first_mes?: boolean;
    is_author_note?: boolean;
    is_d_entry?: boolean;
    name?: string;
    identifier?: string;
    injection_depth?: number;
    constant?: boolean;
    key?: string[];
    position?: number;
    insertion_order?: number;
    timestamp?: number;
}

export interface ChatHistoryEntity {
    name: string;
    role: string;
    parts: ChatMessage[];
    identifier?: string;
}

export interface GeminiMessage {
    role: "user" | "model";
    parts: MessagePart[];
    position?: number;
    is_d_entry?: boolean;
    is_author_note?: boolean;
    injection_depth?: number;
}

// ============= UI 组件类型 =============
export interface Character {
    id: string;
    name: string;
    avatar: string | null;
    backgroundImage: string | null;
    conversationId: string;
    jsonData?: string;
    circlePosts?: CirclePost[];
    memX?: number;
    autoMessage?: boolean;
    circleInteraction?: boolean;
    circlePostFrequency?: 'low' | 'medium' | 'high'; // 发布频率
    circleInteractionFrequency?: 'low' | 'medium' | 'high'; // 互动频率
    circleStats?: {
        repliedToCharacters: Record<string, number>; // 已回复角色ID和次数
        repliedToPostsCount: number; // 已回复的不同角色帖子数
        repliedToCommentsCount: Record<string, number>; // 已回复评论ID和次数
    };
}

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    isLoading?: boolean;
    timestamp?: number;
    rating?: number;
}

export interface MessageItemProps {
    message: Message;
    selectedCharacter?: Character;
    user?: User;
}

export interface ChatInputProps {
    onSendMessage: (message: string, sender: 'user' | 'bot', isLoading?: boolean) => void;
    extraHeight?: number;
    selectedConversationId: string | null;
    conversationId?: string;
    onResetConversation?: (newConversationId: string) => void;
    selectedCharacter?: Character | null;
}

// ============= 社交圈功能类型 =============
export interface CirclePost {
    id: string;
    characterId: string;
    characterName: string;
    characterAvatar?: string | null;
    content: string;
    images?: string[];
    createdAt: string;
    comments: CircleComment[];
    likes: number;
    hasLiked: boolean;
    likedBy?: CircleLike[];
    hasTriggeredResponse?: boolean;
    isFavorited?: boolean;
}

export interface CircleComment {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    createdAt: string;
    type: 'user' | 'character';
    replyTo?: {
        userId: string;
        userName: string;
    };
}

export interface CircleLike {
    userId: string;
    userName: string;
    userAvatar?: string;
    isCharacter: boolean;
    createdAt: string;
  }
// ============= 功能选项类型 =============
export interface ProcessChatOptions {
    userMessage: string;
    conversationId: string;
    status: "更新人设" | "新建角色" | "同一角色继续对话";
    apiKey: string;
    character?: Character;
    jsonString?: string;
}

// ... 其他现有类型保持不变
