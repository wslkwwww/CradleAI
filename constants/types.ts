import { ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';
import { User, Character, Message, CirclePost } from '../shared/types';
// 只保留 Context 相关类型
export interface CradleSettingsProps {
  isVisible: boolean;
  onClose: () => void;
  onCradleToggle: (enabled: boolean) => void;
  onDurationChange: (days: number) => void;
  isCradleEnabled: boolean;
  cradleDuration: number;
}

export interface UserContextType {
    user: User | null;
    updateUser: (user: User) => Promise<void>;
    updateAvatar: (avatar: string) => Promise<void>;
}

export interface CharactersContextType {
    characters: Character[];
    addCharacter: (character: Character) => Promise<void>;
    updateCharacter: (character: Character) => Promise<void>;
    deleteCharacters: (ids: string[]) => Promise<void>;
    isLoading: boolean;
    conversations: SidebarItemProps[];
    addConversation: (conversation: SidebarItemProps) => void;
    getConversationId: (conversationId: string) => string;
    setConversationId: (conversationId: string, difyConversationId: string) => void;
    getApiKey: () => string;
    getCharacterConversationId: (characterId: string) => string | undefined;
    getMessages: (conversationId: string) => Message[];
    addMessage: (conversationId: string, message: Message) => Promise<void>;
    clearMessages: (conversationId: string) => Promise<void>;
    memos: Memo[];
    addMemo: (content: string) => Promise<void>;
    updateMemo: (id: string, content: string) => Promise<void>;
    deleteMemo: (id: string) => Promise<void>;
    rateMessage: (conversationId: string, messageId: string, isUpvote: boolean) => Promise<void>;
    toggleFavorite: (characterId: string, postId: string) => Promise<void>;
    getFavorites: () => CirclePost[];
    updateCradleSettings: (settings: CradleSettings) => Promise<void>;
    getCradleSettings: () => CradleSettings;
}

// UI 专用类型
export interface SidebarItemProps {
    id: string;
    title: string;
}

export interface Conversation {
    id: string;
    name: string;
    messages?: Message[];
}

export interface MemoSheetProps {
    isVisible: boolean;
    onClose: () => void;
    onSave: (content: string) => void;
    style?: StyleProp<ViewStyle>;
}

// Memo 相关类型
export interface Memo {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

// 摇篮系统专用类型
export interface CradleSettings {
  enabled: boolean;
  duration: number;
  startDate?: string;
  progress: number;
  lastInterruption?: string;
  cradleConversationId?: string;
}

export interface CradleAnimation {
    glowIntensity?: number;
    glowColor?: string;
    pulseSpeed?: number;
}

export interface CradleCharacter extends Character {
    isCradleGenerated: boolean;
    cradleAnimation?: CradleAnimation;
}

// 工具类型
export type ImageSource = { uri: string } | number;

// UI 配置类型
export interface PositionOption {
    label: string;
    value: number;
}

// 预设输入属性
export interface InputFieldProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    multiline?: boolean;
}

// UI 专用的预设条目类型
export interface PresetEntryUI {
    id: string;
    name: string;
    content: string;
    identifier: string;
    insertType: 'relative' | 'chat';
    role: 'user' | 'model';
    order: number;
    depth?: number;
    enable: boolean;
    injection_position?: number;
    injection_depth?: number;
    isDefault?: boolean;
    isEditable: boolean;
}

// UI 专用的世界书条目类型
export interface WorldBookEntryUI {
    id: string;
    name: string;
    comment: string;
    content: string;
    disable: boolean;
    position: 0 | 1 | 2 | 3 | 4;
    key?: string[];
    constant: boolean;
    order?: number;
    vectorized?: boolean;
    depth?: number;
}