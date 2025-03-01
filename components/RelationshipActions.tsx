import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { RelationshipAction } from '@/shared/types/action-types';
import { ActionService } from '../services/action-service';
import { Character } from '@/shared/types';

interface RelationshipActionsProps {
  character: Character;
  allCharacters: Record<string, Character>;
  onUpdateCharacters: (updatedCharacters: Character[]) => void;
}

const RelationshipActions: React.FC<RelationshipActionsProps> = ({ 
  character, 
  allCharacters,
  onUpdateCharacters 
}) => {
  const [pendingActions, setPendingActions] = useState<RelationshipAction[]>([]);
  const [completedActions, setCompletedActions] = useState<RelationshipAction[]>([]);
  
  // Filter and sort actions when character or allCharacters change
  useEffect(() => {
    const now = Date.now();
    
    // Get actions targeting this character
    const allActions = (character.relationshipActions || []).filter(
      action => action.targetCharacterId === character.id
    );
    
    // Split into pending and completed
    const pending = allActions.filter(
      action => action.status === 'pending' && action.expiresAt > now
    ).sort((a, b) => a.createdAt - b.createdAt);
    
    const completed = allActions.filter(
      action => action.status !== 'pending' || action.expiresAt <= now
    ).sort((a, b) => (b.respondedAt || b.createdAt) - (a.respondedAt || a.createdAt));
    
    setPendingActions(pending);
    setCompletedActions(completed);
  }, [character, allCharacters]);
  
  // Handle action response (accept/reject)
  const handleActionResponse = (action: RelationshipAction, response: 'accept' | 'reject') => {
    const updatedCharacters = ActionService.processActionResponse(
      action, 
      response, 
      allCharacters
    );
    
    onUpdateCharacters(Object.values(updatedCharacters));
  };
  
  // Render an action item
  const renderActionItem = (action: RelationshipAction, isPending: boolean) => {
    const sourceCharacter = allCharacters[action.sourceCharacterId];
    const sourceCharacterName = sourceCharacter?.name || 'Unknown';
    
    return (
      <View style={styles.actionItem}>
        <View style={styles.actionHeader}>
          <Text style={styles.actionType}>
            {action.type.charAt(0).toUpperCase() + action.type.slice(1)}
          </Text>
          <Text style={styles.actionDate}>
            {new Date(action.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        <Text style={styles.actionSource}>From: {sourceCharacterName}</Text>
        <Text style={styles.actionContent}>{action.content}</Text>
        
        {isPending ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleActionResponse(action, 'accept')}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleActionResponse(action, 'reject')}
            >
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionStatus}>
            <Text style={[
              styles.statusText,
              action.status === 'accepted' ? styles.acceptedText : 
              action.status === 'rejected' ? styles.rejectedText :
              styles.expiredText
            ]}>
              {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
            </Text>
            
            {action.respondedAt && (
              <Text style={styles.responseDate}>
                {new Date(action.respondedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>角色关系行动</Text>
      
      <View style={styles.content}>
        {/* 待处理行动 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>待处理行动</Text>
          {pendingActions.length > 0 ? (
            pendingActions.map(action => renderActionItem(action, true))
          ) : (
            <Text style={styles.emptyText}>没有待处理行动</Text>
          )}
        </View>
        
        {/* 历史行动 */}
        {completedActions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>历史行动</Text>
            {completedActions.slice(0, 10).map(action => 
              renderActionItem(action, false)
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  actionItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionDate: {
    fontSize: 14,
    color: '#666',
  },
  actionSource: {
    fontSize: 15,
    marginBottom: 4,
  },
  actionContent: {
    fontSize: 15,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  acceptedText: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
  },
  rejectedText: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
  },
  expiredText: {
    backgroundColor: '#ECEFF1',
    color: '#546E7A',
  },
  responseDate: {
    fontSize: 12,
    color: '#757575',
  },
  emptyText: {
    fontSize: 16,
    color: '#9E9E9E',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
});

export default RelationshipActions;