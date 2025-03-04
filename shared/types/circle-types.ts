// Social circle types for interactions between characters

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

export interface CirclePostOptions {
    type: 'newPost' | 'replyToComment' | 'replyToPost';
    content: {
        authorId: string;  // 帖子作者ID
        text: string;
        context?: string;
    };
    responderId: string;  // 响应者ID
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
