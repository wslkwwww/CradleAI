import { CharacterMetadata } from '../shared/types/circle-types';
import { RelationshipMapData, } from '../shared/types/relationship-types';
import { RelationshipAction } from '@/services/action-service';
import { CradleAnimation } from '@/constants/types';
import { OpenRouterSettings } from '@/shared/types/api-types';
import { MessageBoxItem } from '@/shared/types/relationship-types';
import { VNDBCharacter } from '@/src/services/vndb/types';

// ============= 基础类型 =============
export interface User {
    id: string;
    avatar?: string;
    name?: string;
    settings?: GlobalSettings;
    coverImage? : string | null;
}

export interface GlobalSettings {
    self: {
        nickname: string;
        gender: 'male' | 'female' | 'other';
        description: string;
    };
    chat: {
        // Legacy fields
        serverUrl: string | null | undefined; 
        characterApiKey: string;
        memoryApiKey: string;
        xApiKey: string;
        
        // New API settings
        apiProvider: 'gemini' | 'openrouter';
        openrouter?: OpenRouterSettings;
        typingDelay: number;
        maxtokens: number;
        temperature: number;
        maxTokens: number;
    };
    app?: {
        darkMode?: boolean;
        autoSave?: boolean;
        notifications?: {
          enabled?: boolean;
        };
    }
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
        role: "user" | "model" | "assistant";
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
    injection_position?: number;
    injection_depth?: number;
    constant?: boolean;
    key?: string[];
    position?: number;
    insertion_order?: number;
    timestamp?: number; 
    is_chat_history_placeholder ?: boolean;
}

export interface SidebarItemProps {
    id: string;
    title: string;
    avatar: string;
    description: string;
  }

// ============= 角色类型 =============
export interface Character {
  id: string;
  name: string;
  avatar: string | null;
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
  
  // Add unified cradle fields directly to Character
  inCradleSystem?: boolean; // Whether this character is in the cradle system
  cradleStatus?: 'growing' | 'mature' | 'ready'; // The status of the character in the cradle
  cradleCreatedAt?: number; // When the character was added to cradle
  cradleUpdatedAt?: number; // Last time cradle status was updated
  cradleProgress?: number; // Progress percentage (0-100)
  feedHistory?: Feed[]; // History of feeds to this character
  imageGenerationTaskId?: string | null; // Reference to image generation task
  imageGenerationStatus?: 'idle' | 'pending' | 'success' | 'error'; 
  imageGenerationError?: string | null;
  localBackgroundImage?: string | null;  // Local filesystem image URI
  generatedCharacterId?: string;
  isCradleGenerated?: boolean;
  cradleCharacterId?: string; // Reference to a Cradle character if this character was generated from one
  
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
  messages?: Array<{
    sender: string;
    text: string;
    metadata?: {
      targetId?: string;
    };
  }>;
  generationData?: {
    appearanceTags?: { positive: string[]; negative: string[];artistPrompt?: string;   };
    traits?: string[];
    vndbResults?: any;
    description?: string;
    userGender?: string
  };
  initialSettings?: {
    userGender?: 'male' | 'female' | 'other';
    characterGender?: 'male' | 'female' | 'other';
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
    reference?: string;
    description?: string;
    traits?: any;
    characterAge?: string;
    selectedTraits?: string[];
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
    metadata?: {
        senderId?: string;
        type?: 'relationship_request' | 'invitation' | 'alert' | 'message';
      };
    read?: boolean;
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
  type: 'text' | 'voice' | 'image' | 'aboutMe'| 'material'| 'knowledge';
  timestamp: number;
  processed: boolean;
}

// Add CharacterImage type
export interface CharacterImage {
  id: string;
  url: string;
  localUri?: string;
  createdAt: number;
  characterId?: string;
  mimeType?: string;
  tags?: {
    positive?: string[];
    negative?: string[];
  };
  isFavorite: boolean;
  isEdited?: boolean;  // Flag to mark if this image has been edited
  originalImageId?: string; // Reference to the original image if this is an edited version
  editHistory?: string[]; // Store prompts used to edit this image
  data?: string; // Base64 encoded image data
}

// Fix the CradleCharacter interface by making it extend Character
// Now it's just an extension with some specialized cradle fields
export interface CradleCharacter extends Character {
  inCradleSystem: boolean; // Must be true for cradle characters
  importedFromCharacter?: boolean; // Was this imported from a normal character
  importedCharacterId?: string; // ID of the original character if imported
  cradleAnimation?: CradleAnimation;
  cradle?: {
    startDate?: string;
    progress?: number;
    stage?: 'egg' | 'growing' | 'mature';
    lastFeedTimestamp?: number;
  };
  
  // Add VNDB search results property (move from specific implementation to interface)
  vndbSearchResults?: VNDBCharacter[];
  
  // Add image history array
  imageHistory?: CharacterImage[];
  }

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
    constant: boolean;
    key?: string[];
    order: number;
    depth: number;
    vectorized?: boolean;
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

export interface RegexTool {
    id: string;
    name: string;
    pattern: string;
    replacement: string;
    target: 'ai' | 'user';
    enabled: boolean;
  }