export type RelationshipType = 
  | 'stranger' 
  | 'acquaintance' 
  | 'friend' 
  | 'close_friend' 
  | 'best_friend'
  | 'family'
  | 'crush'
  | 'lover'
  | 'partner'
  | 'ex'
  | 'rival'
  | 'enemy'
  | 'mentor'
  | 'student'
  | 'colleague'
  | 'admirer'
  | 'romantic_interest'
  | 'idol'
  | 'business_partner';
    

export interface Relationship {
  targetId: string;           // ID of the character this relationship points to
  strength: number;           // -100 to 100
  type: RelationshipType;     // Type of relationship
  description: string;        // Description or impression
  lastUpdated: number;        // Timestamp of last update
  interactions: number;       // Count of interactions 
}

// Make lastReviewed non-optional to fix the TypeScript errors
export interface RelationshipMapData {
  relationships: { [characterId: string]: Relationship };
  lastReviewed: number; // Remove the optional flag
}

export interface MessageBoxItem {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  read: boolean;
  type: 'post' | 'comment' | 'like' | 'reply' | 'action';
  contextId?: string;         // ID of the related post/comment
  contextContent?: string;    // Content of the related post/comment
}

// Export a function to create an empty relationship map
export const createEmptyRelationshipMap = (): RelationshipMapData => ({
  relationships: {},
  lastReviewed: Date.now()
});

// Export a function to create a default relationship
export const createDefaultRelationship = (targetId: string): Relationship => ({
  targetId,
  strength: 0,
  type: 'stranger',
  description: 'Just met this character.',
  lastUpdated: Date.now(),
  interactions: 0
});
