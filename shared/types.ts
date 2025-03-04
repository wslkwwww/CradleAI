import { CharacterMetadata } from '../shared/types/circle-types';
import { RelationshipMapData, MessageBoxItem } from '../shared/types/relationship-types';
import { RelationshipAction } from '@/services/action-service';
import { CradleAnimation } from '@/constants/types';
import { OpenRouterSettings } from '@/shared/types/api-types';
// ============= 基础类型 =============
export interface User {
    id: string;
    avatar?: string;
    name?: string;
    settings?: GlobalSettings;
}
export interface Character {
    id: string;
    name: string;
    avatar?: string | null;
  }
  
  export interface ForwardDialogProps {
    isVisible: boolean;
    onClose: () => void;
    messages: any[];
    characters: Character[];
    onSelectCharacter: (character: Character) => void;
  }
export interface GlobalSettings {
    self: {
        nickname: string;
        gender: 'male' | 'female' | 'other';
        description: string;
    };
    chat: {
        // Legacy fields
        serverUrl: string;
        characterApiKey: string;
        memoryApiKey: string;
        xApiKey: string;
        
        // New API settings
        apiProvider: 'gemini' | 'openrouter';
        openrouter?: OpenRouterSettings;
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
    content?: string;
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


export interface SidebarItemProps {
    id: string;
    title: string;
  }

// ============= 角色类型 =============
export interface Character {
  id: string;
  name: string;
  avatar?: string | null;
  backgroundImage: string | null;
  description: string;
  personality: string;
  interests: string[];
  voiceType?: string;
  createdAt: number;
  updatedAt: number;
  isSystem?: boolean;
  isArchived?: boolean;
  metadata?: CharacterMetadata;
  age?: string;
  gender?: string;
  isCradleGenerated?: boolean;
  inCradleSystem?: boolean;
  apiProvider?: 'gemini' | 'openrouter';
  openrouter?: OpenRouterSettings;
  // Circle-related fields (existing)
  conversationId?: string;
  jsonData?: string;
  circlePosts?: any[];
  memX?: number;
  autoMessage?: boolean;
  circleInteraction?: boolean;
  circlePostFrequency?: 'low' | 'medium' | 'high';
  circleInteractionFrequency?: 'low' | 'medium' | 'high';
  circleStats?: {
    repliedToCharacters: Record<string, number>;
    repliedToPostsCount: number;
    repliedToCommentsCount: Record<string, number>;
  };
  
  // Relationship system fields
  relationshipMap?: RelationshipMapData;
  messageBox?: MessageBoxItem[];
  relationshipEnabled?: boolean;
  relationshipActions?: RelationshipAction[];
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

// Cradle-specific types
export type FeedType = 'about' | 'knowledge' | 'material' | 'image' | 'voice' | 'text';

export interface FeedQueue {
  characterId: string;
  feeds: Feed[];
  lastProcessed?: number;
  processing: boolean;
}


export interface Feed {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image';
  timestamp: number;
  processed: boolean;
}

// Fix the CradleCharacter interface, remove duplicate declarations and fix type issues
export interface CradleCharacter extends Omit<Character, 'backgroundImage'> {
    feedHistory: Feed[];             // 投喂历史
    inCradleSystem: boolean;         // 是否在摇篮系统中
    isCradleGenerated?: boolean;     // 是否由摇篮生成的角色
    cradleAnimation?: CradleAnimation;
    importedFromCharacter?: boolean; // 是否从常规角色导入
    importedCharacterId?: string;    // 导入来源的角色ID
    initialSettings?: {              // 初始设定
      axis?: {
        [key: string]: {
          x: number;
          y: number;
          xLabel?: string;
          yLabel?: string;
        }
      };
      sliders?: {
        [key: string]: number;
      };
      reference?: string;            // 参考角色ID
      description?: string;          // 描述
    };
    cradle?: {
      startDate?: string;
      progress?: number;
      stage?: 'egg' | 'growing' | 'mature';
      lastFeedTimestamp?: number;
    };
    // Explicitly define backgroundImage with the right type
    backgroundImage: string | null;
}








