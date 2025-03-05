// Social circle types for interactions between characters

import { ChatMessage, WorldBookEntry, Character } from '../types';

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

export interface CharacterMetadata {
    firstMeetingDate?: number;
    favoriteTopics?: string[];
    notes?: string;
    customTags?: string[];
    location?: string;
    occupation?: string;
    [key: string]: any; // Allow for additional custom metadata
    age?: string;
    gender?: string;
    height?: string;
    weight?: string;
    background?: string;
    personalityTraits?: string[];
    interests?: string[];
    roleInStory?: string;
    appearances?: string;
    clothes?: string;
    speechPattern?: string;
    relationships?: string;
    eyeColor?: string;
    hairColor?: string;
    mbti?: string;
    birthday?: string;
    zodiac?: string;
    specialAbilities?: string;
}


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
        authorId: string;
        authorName?: string;  // Add this field
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
    relationshipUpdates?: Array<{
        targetId: string;
        strengthDelta: number;
        newType?: string;
    }>;
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

// Add InteractionResult interface for Circle Service
export interface InteractionResult {
  characterId: string;
  success: boolean;
  error?: string;
  response?: {
    action?: {
      like?: boolean;
      comment?: string;
    },
    emotion?: {
      type: string;
      intensity: number;
    }
  };
}