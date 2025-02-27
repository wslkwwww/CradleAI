export interface RoleCardJson {
    name: string;
    first_mes: string;
    description: string;
    personality: string;
    scenario: string;
    mes_example: string;
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
    position: number;
    constant: boolean;
    key: string[];
    order: number;
    depth: number;
    vectorized?: boolean;
}

export interface PresetJson {
    prompts: PresetPrompt[];
    prompt_order: PromptOrder[];
}

export interface PresetPrompt {
    name: string;
    content: string;
    enable: boolean;
    identifier: string;
    injection_position?: number;
    injection_depth?: number;
    role?: string;
}

export interface PromptOrder {
    order: {
        identifier: string;
        enabled: boolean;
    }[];
}

export interface AuthorNoteJson {
    charname: string;
    username: string;
    content: string;
    role?: string;
    injection_depth: number;
}

// 基础消息部分
export interface MessagePart {
    text: string;
}

// 基础消息格式
export interface ChatMessage {
    role: string;
    parts: MessagePart[];
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

// Chat History专用类型
export interface ChatHistoryEntity {
    name: string;
    role: string;
    parts: ChatMessage[];  // 存储完整的消息对象
    identifier?: string;
}

// Gemini API请求消息格式
export interface GeminiMessage {
    role: "user" | "model";
    parts: MessagePart[];
    position?: number;
    is_d_entry?: boolean;
    is_author_note?: boolean;
    injection_depth?: number;
}