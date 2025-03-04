export interface Character {
  // ...existing code...
  relationshipMap?: {
    relationships: Record<string, any>;
    lastReviewed: number;
  };
  messageBox?: Array<{
    id: string;
    senderId: string;
    senderName?: string;
    content: string;
    timestamp: number;
    read: boolean;
    type: string;
    contextId?: string;
    contextContent?: string;
  }>;
  relationshipActions?: Array<{
    id: string;
    type: string;
    sourceCharacterId: string;
    targetCharacterId: string;
    content: string;
    createdAt: number;
    expiresAt: number;
    status: string;
    respondedAt?: number;
    responseContent?: string;
  }>;
  relationshipEnabled?: boolean;
  // ...existing code...
}

// Re-export Character and its related types
export * from './character';

// Re-export API types
export * from './api-types';

// Re-export Circle types
;

// Re-export Relationship types
export * from './relationship-types';

// Define GlobalSettings type for API configuration
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
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
      autoRoute?: boolean;
      useBackupModels?: boolean;
      backupModels?: string[];
      sortingStrategy?: 'price' | 'speed' | 'latency';
      dataCollection?: boolean;
      ignoredProviders?: string[];
    }
  };
}

// Add any other shared types needed
export interface MessageBoxItem {
  id: string;
  senderName: string;
  senderId: string;
  receiverId: string;
  type: string;
  content: string;
  contextContent?: string;
  timestamp: number;
  read: boolean;
}

export interface RelationshipMapData {
  relationships: Record<string, {
    type: string;
    strength: number;
    description: string;
    lastUpdated: number;
    interactions: number;
  }>;
}
