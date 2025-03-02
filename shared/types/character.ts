import { RelationshipMapData, MessageBoxItem } from './relationship-types';
import { RelationshipAction } from '@/services/action-service';

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
  iscradelGenerated?: boolean;
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

export interface CharacterMetadata {
  firstMeetingDate?: number;
  favoriteTopics?: string[];
  notes?: string;
  customTags?: string[];
  location?: string;
  occupation?: string;
  [key: string]: any; // Allow for additional custom metadata
}



// Any other existing types in this file...
