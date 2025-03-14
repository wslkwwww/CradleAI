import { ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';
import { User, Character, Message, CirclePost } from '../shared/types';
import { CradleCharacter } from '../shared/types';
import { FeedType, FeedData } from '@/NodeST/nodest/services/character-generator-service';

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
    updateSettings: (settings: any) => Promise<void>;
}

export interface CharactersContextType {
  characters: Character[];
  isLoading: boolean;
  addCharacter: (character: Character) => Promise<void>;
  deleteCharacters: (ids: string[]) => Promise<void>;
  conversations: SidebarItemProps[];
  addConversation: (conversation: SidebarItemProps) => Promise<void>;
  getConversationId: (conversationId: string) => string;
  setConversationId: (conversationId: string, difyConversationId: string) => void;
  getApiKey: () => string;
  getCharacterConversationId: (characterId: string) => string | undefined;
  updateCharacter: (character: Character) => Promise<void>;
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
  setCharacters: (characters: Character[]) => void;
  setIsLoading : (isLoading: boolean) => void;
  // 摇篮系统相关方法
  updateCradleSettings: (settings: CradleSettings) => Promise<void>;
  getCradleSettings: () => CradleSettings;

  // 摇篮系统检查图片更新
  checkCradleGeneration: () => {
    readyCharactersCount: number;
    readyCharacters: CradleCharacter[];
  };
  // 摇篮角色相关方法
  getCradleCharacters: () => CradleCharacter[];
  addCradleCharacter: (character: CradleCharacter) => Promise<string>;
  updateCradleCharacter: (character: CradleCharacter) => Promise<void>;
  deleteCradleCharacter: (id: string) => Promise<void>;
  importCharacterToCradle: (characterId: string) => Promise<void>;

  // 投喂相关方法
  addFeed: (characterId: string, content: string, type?: 'text' | 'voice' | 'image' | 'aboutMe' | 'material' | 'knowledge') => Promise<void>;
  markFeedAsProcessed: (characterId: string, feedId: string) => Promise<void>;
  
  // 生成角色
  generateCharacterFromCradle: (cradleCharacterId: string) => Promise<Character>;

  // Add these new properties for cradle functionality:
  addFeedToCradle: (content: string, type: FeedType) => Promise<string>;
  getFeedHistory: () => FeedData[];
  processFeedsNow: () => Promise<void>;

  // Add these new methods for Cradle API functionality:
  getCradleApiSettings: () => {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  };
  updateCradleApiSettings: (settings: {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }) => Promise<void>;
}

// UI 专用类型
export interface SidebarItemProps {
  id: string;
  title: string;
  name ?: string;
  avatar?: ImageSourcePropType;
  backgroundImage?: ImageSourcePropType;
  description?: string;
  personality?: string;
  interests?: string[];
  createdAt?: string;
  updatedAt?: string;
  
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
export interface Feed {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image' | 'aboutMe'| 'material'| 'knowledge'; // 投喂类型Me' | 'material' | 'knowledge'; // 扩展投喂类型
  timestamp: number;                // 时间戳
  processed: boolean;               // 是否已处理
}

export interface CradleSettings {
  enabled: boolean;         // 摇篮系统是否启用
  duration: number;         // 培育周期（天）
  startDate?: string;       // 开始培育日期
  progress?: number;        // 培育进度（百分比）
  lastInterruption?: string; // 上次中断时间
  cradleConversationId?: string; // 关联的会话ID
  feedInterval: number;     // 投喂间隔（分钟）
}

export interface CradleAnimation {
  glowIntensity?: number;
  glowColor?: string;
  pulseSpeed?: number;
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
  identifier: string;
  content: string;
  isEditable: boolean;
  insertType: 'relative' | 'chat';
  role: 'user' | 'model';
  order: number;
  isDefault: boolean;
  enable: boolean;
  depth: number;
  injection_position?: number;
  injection_depth?: number;
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