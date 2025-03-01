import { Character } from '../types';

// Define relationship types
export type RelationshipType = 
  'enemy' | 'rival' | 'stranger' | 'acquaintance' | 'colleague' | 
  'friend' | 'close_friend' | 'best_friend' | 'family' | 'crush' | 
  'lover' | 'partner' | 'ex' | 'mentor' | 'student' | 'admirer' | 'idol';

// Define relationship structure
export interface Relationship {
  targetId: string;         // Target character ID
  strength: number;         // Relationship strength (-100 to 100)
  type: RelationshipType;   // Relationship type
  description: string;      // Relationship description
  lastUpdated: number;      // Last update timestamp
  interactions: number;     // Interaction count
}

// Define relationship map data structure
export interface RelationshipMapData {
  relationships: Record<string, RelationshipData>;  // Relationship mapping
  lastReviewed: number;                        // Last review timestamp
  lastUpdated: number;                         // Last update timestamp
}

// Define message box item structure - exported for use in character.ts
export interface MessageBoxItem {
  id: string;               // Message ID
  senderId: string;         // Sender ID
  senderName: string;       // Sender name
  content: string;          // Message content
  timestamp: number;        // Send timestamp
  read: boolean;            // Read status
  type: 'message' | 'like' | 'comment' | 'reply';  // Message type
  contextId?: string;       // Related content ID
  contextContent?: string;  // Related content summary
  recipientId: string;      // Recipient ID
}

export interface RelationshipData {
  type: string;
  strength: number;
  lastUpdated: number;
  description: string;
  interactions: number;
}

/**
 * Create a default relationship for a character
 */
export function createDefaultRelationship(
  targetId: string,
  targetName: string
): Relationship {
  return {
    targetId,
    strength: 0,
    type: 'stranger',
    description: `${targetName}是一个陌生人`,
    lastUpdated: Date.now(),
    interactions: 0
  };
}

/**
 * Get a relationship between two characters
 */
export function getRelationship(
  character: Character,
  targetId: string
): Relationship | undefined {
  return character.relationshipMap?.relationships[targetId];
}
