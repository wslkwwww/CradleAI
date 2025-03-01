/**
 * Types of actions that can be triggered by relationships
 */
export type ActionType = 'gift' | 'invitation' | 'challenge' | 'support' | 'confession';

/**
 * Status of a relationship action
 */
export type ActionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * Represents an action triggered by a relationship between characters
 */
export interface RelationshipAction {
  id: string;
  type: ActionType;
  sourceCharacterId: string;  // Character initiating the action
  targetCharacterId: string;  // Character receiving the action
  content: string;            // Description of the action
  createdAt: number;          // Creation timestamp
  expiresAt: number;          // Expiry timestamp
  status: ActionStatus;
  respondedAt?: number;       // When the action was responded to
  responseContent?: string;   // Optional response message
}

/**
 * Update Character type to include relationship actions
 */
declare module '../../shared/types' {
  interface Character {
    relationshipActions?: RelationshipAction[];
  }
}
