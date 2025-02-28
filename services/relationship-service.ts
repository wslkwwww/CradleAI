import { Character } from '../shared/types';
import { 
  RelationshipMapData, 
  Relationship, 
  RelationshipType, 
  MessageBoxItem,
  createEmptyRelationshipMap,
  createDefaultRelationship
} from '../shared/types/relationship-types';

export class RelationshipService {
  private static DEFAULT_RELATIONSHIP_STRENGTH = 0;
  private static DEFAULT_RELATIONSHIP_TYPE: RelationshipType = 'stranger';
  private static MAX_MESSAGE_BOX_ITEMS = 50;
  private static RELATIONSHIP_TYPE_THRESHOLDS: Record<RelationshipType, number> = {
    'enemy': -80,
    'rival': -40,
    'stranger': -10,
    'acquaintance': 10,
    'colleague': 20,
    'friend': 40,
    'close_friend': 60,
    'best_friend': 80,
    'family': 90,
    'admirer': 50,
    'romantic_interest': 70,
    'partner': 85,
    'mentor': 60,
    'student': 40,
    'business_partner': 30,
    'crush': 65,
    'lover': 95,
    'ex': -30,
    'idol': 75
  };

  // Initialize relationship map for a character if not already initialized
  static initializeRelationshipMap(character: Character): Character {
    if (!character.relationshipEnabled) {
      return character;
    }
    
    return {
      ...character,
      relationshipMap: character.relationshipMap || createEmptyRelationshipMap(),
      messageBox: character.messageBox || []
    };
  }

  // Add message to a character's message box
  static addToMessageBox(
    character: Character,
    message: Omit<MessageBoxItem, 'id' | 'read'>
  ): Character {
    if (!character.relationshipEnabled) {
      return character;
    }

    const updatedCharacter = this.initializeRelationshipMap(character);
    const messageBox = updatedCharacter.messageBox || [];
    
    const newMessage: MessageBoxItem = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      read: false
    };
    
    // Keep only last 50 messages
    const updatedMessageBox = [newMessage, ...messageBox].slice(0, 50);
    
    return {
      ...updatedCharacter,
      messageBox: updatedMessageBox
    };
  }

  // Process post interaction (like, comment)
  static processPostInteraction(
    character: Character,
    interactorId: string,
    interactorName: string,
    interactionType: 'like' | 'comment',
    content: string,
    postId: string,
    postContent: string
  ): Character {
    if (!character.relationshipEnabled) {
      return character;
    }

    // Add to message box
    const updatedWithMessage = this.addToMessageBox(character, {
      senderId: interactorId,
      senderName: interactorName,
      content: interactionType === 'like' ? '点赞了你的帖子' : content,
      timestamp: Date.now(),
      type: interactionType,
      contextId: postId,
      contextContent: postContent
    });

    // Update relationship with this character
    return this.updateRelationship(
      updatedWithMessage, 
      interactorId, 
      interactionType === 'like' ? 1 : 2, // Like gives +1, comment gives +2
      interactionType === 'like' ? '点赞了帖子' : '评论了帖子'
    );
  }

  // Process comment reply interaction
  static processCommentReply(
    character: Character,
    replierId: string,
    replierName: string,
    replyContent: string,
    commentId: string,
    commentContent: string
  ): Character {
    if (!character.relationshipEnabled) {
      return character;
    }

    // Add to message box
    const updatedWithMessage = this.addToMessageBox(character, {
      senderId: replierId,
      senderName: replierName,
      content: replyContent,
      timestamp: Date.now(),
      type: 'reply',
      contextId: commentId,
      contextContent: commentContent
    });

    // Update relationship with this character (+3 for reply)
    return this.updateRelationship(
      updatedWithMessage,
      replierId,
      3,
      '回复了评论'
    );
  }

  // Update relationship with another character
  static updateRelationship(
    character: Character,
    targetId: string,
    strengthDelta: number,
    interactionDescription: string
  ): Character {
    if (!character.relationshipEnabled || targetId === character.id) {
      return character;
    }

    const updatedCharacter = this.initializeRelationshipMap(character);
    const relationshipMap = { ...updatedCharacter.relationshipMap! };
    const relationships = { ...relationshipMap.relationships };
    
    // Get or create relationship entry
    const currentRelationship = relationships[targetId] || 
      createDefaultRelationship(targetId);
    
    // Update relationship
    const updatedStrength = Math.max(-100, Math.min(100, 
      currentRelationship.strength + strengthDelta));
    
    relationships[targetId] = {
      ...currentRelationship,
      strength: updatedStrength,
      type: this.determineRelationshipType(updatedStrength),
      description: interactionDescription 
        ? `${currentRelationship.description} ${interactionDescription}` 
        : currentRelationship.description,
      lastUpdated: Date.now(),
      interactions: currentRelationship.interactions + 1
    };

    return {
      ...updatedCharacter,
      relationshipMap: {
        ...relationshipMap,
        relationships
      }
    };
  }

  // Get relationship between two characters
  static getRelationship(
    character: Character,
    targetId: string
  ): Relationship | null {
    if (!character.relationshipEnabled || !character.relationshipMap) {
      return null;
    }
    
    return character.relationshipMap.relationships[targetId] || null;
  }

  // Mark all messages as read
  static markAllMessagesAsRead(character: Character): Character {
    if (!character.messageBox?.length) {
      return character;
    }

    return {
      ...character,
      messageBox: character.messageBox.map(msg => ({
        ...msg,
        read: true
      }))
    };
  }

  // Determine relationship type based on strength
  static determineRelationshipType(strength: number): RelationshipType {
    if (strength <= -80) return 'enemy';
    if (strength <= -50) return 'rival';
    if (strength <= -20) return 'stranger';
    if (strength <= 20) return 'acquaintance';
    if (strength <= 50) return 'friend';
    if (strength <= 80) return 'close_friend';
    return 'best_friend';
  }
  
  // Check if relationship needs review
  static needsRelationshipReview(character: Character): boolean {
    if (!character.relationshipEnabled || !character.relationshipMap) {
      return false;
    }
    
    const lastReviewed = character.relationshipMap.lastReviewed;
    if (!lastReviewed) return true;
    
    // Check if last review was more than 1 day ago
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - lastReviewed > oneDayMs;
  }
}
