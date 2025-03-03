import { Character } from '../shared/types';
import { generateUniqueId } from '../utils/id-utils';
import { Relationship } from '../shared/types/relationship-types';

// Define action types
export type ActionType = 'gift' | 'invitation' | 'challenge' | 'support' | 'confession';

// Define action status
export type ActionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

// Define relationship action structure
export interface RelationshipAction {
  id: string;               // Action ID
  type: ActionType;         // Action type
  sourceCharacterId: string;// Source character ID
  targetCharacterId: string;// Target character ID
  content: string;          // Action description
  createdAt: number;        // Creation time
  expiresAt: number;        // Expiration time
  status: ActionStatus;     // Action status
  respondedAt?: number;     // Response time
  responseContent?: string; // Response content
}

/**
 * Service for managing relationship-triggered actions
 */
export class ActionService {
  /**
   * Checks for potential relationship-triggered actions
   * @param character The character to check for potential actions
   * @returns A list of generated relationship actions
   */
  static checkForPotentialActions(character: Character): RelationshipAction[] {
    if (!character.relationshipMap || !character.relationshipEnabled) {
      return [];
    }
    
    const actions: RelationshipAction[] = [];
    const relationships = character.relationshipMap.relationships;
    
    // Check each relationship for potential action triggers
    Object.entries(relationships).forEach(([targetId, relationship]: [string, Relationship]) => {
      // 移除过滤条件或减少限制，让更多行动有机会被触发
      // 如果有上次检查时间则判断是否过了24小时，否则允许触发
      const lastActionCheck = relationship.lastActionCheck || 0;
      const hasRecentCheck = Date.now() - lastActionCheck < 24 * 60 * 60 * 1000;
      
      if (hasRecentCheck) {
        return; // 如果最近检查过，跳过此关系
      }
      
      // 更新最后检查时间
      relationships[targetId].lastActionCheck = Date.now();
      
      // 放宽生成行动的条件，让好友关系也能触发
      // 礼物行动
      if ((relationship.type === 'close_friend' || relationship.type === 'best_friend') && 
          relationship.strength >= 70) {
        actions.push({
          id: generateUniqueId(),
          type: 'gift' as ActionType,
          sourceCharacterId: character.id,
          targetCharacterId: targetId,
          content: `${character.name}想要送你一件礼物，表达友谊。`,
          createdAt: Date.now(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiry
          status: 'pending' as ActionStatus
        });
      }
      
      // 邀请行动 - 降低触发门槛
      if (relationship.type !== 'enemy' && relationship.type !== 'rival' &&
          relationship.strength >= 40 && relationship.interactions >= 3) {
        actions.push({
          id: generateUniqueId(),
          type: 'invitation' as ActionType,
          sourceCharacterId: character.id,
          targetCharacterId: targetId,
          content: `${character.name}想邀请你一起参加活动。`,
          createdAt: Date.now(),
          expiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days expiry
          status: 'pending' as ActionStatus
        });
      }
      
      // 简化的邀请行动，几乎都可以触发
      if (relationship.interactions >= 5) {
        actions.push({
          id: generateUniqueId(),
          type: 'support' as ActionType,
          sourceCharacterId: character.id,
          targetCharacterId: targetId,
          content: `${character.name}想要表达对你的支持。`,
          createdAt: Date.now(),
          expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days expiry
          status: 'pending' as ActionStatus
        });
      }
      
      // 其他行动条件...
    });
    
    return actions;
  }
  
  /**
   * Processes a relationship action (accept/reject)
   * @param action The action to process
   * @param response The response (accept/reject)
   * @param characters Map of all relevant characters
   * @returns Updated map of characters
   */
  static processActionResponse(
    action: RelationshipAction, 
    response: 'accept' | 'reject',
    characters: Record<string, Character>
  ): Record<string, Character> {
    const updatedCharacters = { ...characters };
    const sourceCharacter = updatedCharacters[action.sourceCharacterId];
    const targetCharacter = updatedCharacters[action.targetCharacterId];
    
    if (!sourceCharacter || !targetCharacter) {
      return updatedCharacters;
    }
    
    // Update action status
    const updatedAction: RelationshipAction = {
      ...action,
      status: response === 'accept' ? 'accepted' as ActionStatus : 'rejected' as ActionStatus,
      respondedAt: Date.now()
    };
    
    // Store the action in character histories
    sourceCharacter.relationshipActions = [
      ...(sourceCharacter.relationshipActions || []),
      updatedAction
    ];
    
    targetCharacter.relationshipActions = [
      ...(targetCharacter.relationshipActions || []),
      updatedAction
    ];
    
    // Update relationship based on response
    if (sourceCharacter.relationshipMap && targetCharacter.relationshipMap) {
      const strengthDelta = response === 'accept' ? 10 : -5;
      const reason = response === 'accept' ? 
        `接受了${action.type}行动` : 
        `拒绝了${action.type}行动`;
      
      // Update source -> target relationship
      if (sourceCharacter.relationshipMap.relationships[targetCharacter.id]) {
        const sourceRel = sourceCharacter.relationshipMap.relationships[targetCharacter.id];
        sourceCharacter.relationshipMap.relationships[targetCharacter.id] = {
          ...sourceRel,
          strength: Math.max(-100, Math.min(100, sourceRel.strength + strengthDelta)),
          lastUpdated: Date.now(),
          interactions: sourceRel.interactions + 1
        };
      }
      
      // Update target -> source relationship
      if (targetCharacter.relationshipMap.relationships[sourceCharacter.id]) {
        const targetRel = targetCharacter.relationshipMap.relationships[sourceCharacter.id];
        targetCharacter.relationshipMap.relationships[sourceCharacter.id] = {
          ...targetRel,
          strength: Math.max(-100, Math.min(100, targetRel.strength + strengthDelta)),
          lastUpdated: Date.now(),
          interactions: targetRel.interactions + 1
        };
      }
    }
    
    return updatedCharacters;
  }
}
