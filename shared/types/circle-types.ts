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
  }
  