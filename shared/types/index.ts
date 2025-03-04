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
