import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character, User } from '@/shared/types';
import { Group } from '@/src/group/group-types';
import { GroupManager } from '@/src/group/group-manager';
import { theme } from '@/constants/theme';
import { GroupAvatar } from './GroupAvatar';

interface GroupManagementModalProps {
  visible: boolean;
  onClose: () => void;
  group: Group;
  groupMembers: Character[];
  allCharacters: Character[];
  currentUser: User;
  onGroupUpdated: () => void;
}

const GroupManagementModal: React.FC<GroupManagementModalProps> = ({
  visible,
  onClose,
  group,
  groupMembers,
  allCharacters,
  currentUser,
  onGroupUpdated,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'add'>('members');

  // Initialize available characters (characters not in the group)
  useEffect(() => {
    const memberIds = new Set(group.groupMemberIds);
    const available = allCharacters.filter(char => !memberIds.has(char.id));
    setAvailableCharacters(available);
  }, [group, allCharacters]);

  // Handle adding characters to the group
  const handleAddMembers = async () => {
    if (selectedCharacters.length === 0) {
      Alert.alert('Please select at least one character');
      return;
    }

    setIsLoading(true);
    try {
      const groupManager = new GroupManager(currentUser);
      const success = await groupManager.addMembersToGroup(group.groupId, selectedCharacters);
      
      if (success) {
        setSelectedCharacters([]);
        setActiveTab('members');
        onGroupUpdated();
        Alert.alert('Success', 'Characters added to the group successfully');
      } else {
        Alert.alert('Error', 'Failed to add characters to the group');
      }
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle removing a character from the group
  const handleRemoveMember = async (characterId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this character from the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const groupManager = new GroupManager(currentUser);
              const success = await groupManager.removeGroupMember(group.groupId, characterId);
              
              if (success) {
                onGroupUpdated();
              } else {
                Alert.alert('Error', 'Failed to remove character from the group');
              }
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Toggle character selection
  const toggleCharacterSelection = (characterId: string) => {
    setSelectedCharacters(prev => {
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId);
      } else {
        return [...prev, characterId];
      }
    });
  };

  // Render a member item
  const renderMemberItem = ({ item }: { item: Character }) => (
    <View style={styles.memberItem}>
      <Image
        source={
          item.avatar
            ? { uri: item.avatar }
            : require('@/assets/images/default-avatar.png')
        }
        style={styles.memberAvatar}
      />
      <Text style={styles.memberName}>{item.name}</Text>
      
      {item.id !== currentUser.id && item.id !== group.groupOwnerId && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveMember(item.id)}
          disabled={isLoading}
        >
          <Ionicons name="close-circle" size={24} color="#ff4d4f" />
        </TouchableOpacity>
      )}
      
      {item.id === group.groupOwnerId && (
        <View style={styles.ownerBadge}>
          <Text style={styles.ownerBadgeText}>Owner</Text>
        </View>
      )}
    </View>
  );

  // Render an available character item
  const renderAvailableCharacterItem = ({ item }: { item: Character }) => (
    <TouchableOpacity
      style={[
        styles.availableCharacterItem,
        selectedCharacters.includes(item.id) && styles.selectedCharacter
      ]}
      onPress={() => toggleCharacterSelection(item.id)}
      disabled={isLoading}
    >
      <Image
        source={
          item.avatar
            ? { uri: item.avatar }
            : require('@/assets/images/default-avatar.png')
        }
        style={styles.characterAvatar}
      />
      <Text style={styles.characterName}>{item.name}</Text>
      
      {selectedCharacters.includes(item.id) && (
        <Ionicons name="checkmark-circle" size={24} color="#52c41a" style={styles.checkIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <GroupAvatar members={groupMembers} size={40} maxDisplayed={4} />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>{group.groupName}</Text>
                <Text style={styles.headerSubtitle}>{group.groupTopic}</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'members' && styles.activeTab]}
              onPress={() => setActiveTab('members')}
            >
              <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
                Members ({groupMembers.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'add' && styles.activeTab]}
              onPress={() => setActiveTab('add')}
            >
              <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>
                Add Characters
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          {activeTab === 'members' ? (
            <FlatList
              data={groupMembers}
              keyExtractor={item => item.id}
              renderItem={renderMemberItem}
              style={styles.list}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No members found</Text>
                </View>
              }
            />
          ) : (
            <>
              <FlatList
                data={availableCharacters}
                keyExtractor={item => item.id}
                renderItem={renderAvailableCharacterItem}
                style={styles.list}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No available characters</Text>
                  </View>
                }
              />
              
              {availableCharacters.length > 0 && (
                <TouchableOpacity
                  style={[styles.addButton, selectedCharacters.length === 0 && styles.disabledButton]}
                  onPress={handleAddMembers}
                  disabled={selectedCharacters.length === 0 || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.addButtonText}>
                      Add Selected ({selectedCharacters.length})
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 12,
    ...theme.shadows.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bbbbbb',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgb(255, 224, 195)',
  },
  tabText: {
    color: '#bbbbbb',
    fontWeight: '500',
  },
  activeTabText: {
    color: 'rgb(255, 224, 195)',
  },
  list: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  memberName: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  removeButton: {
    padding: 8,
  },
  ownerBadge: {
    backgroundColor: 'rgba(255, 224, 195, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  ownerBadgeText: {
    color: 'rgb(255, 224, 195)',
    fontSize: 12,
  },
  availableCharacterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedCharacter: {
    backgroundColor: 'rgba(255, 224, 195, 0.1)',
  },
  characterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  characterName: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 8,
  },
  addButton: {
    backgroundColor: 'rgb(255, 224, 195)',
    borderRadius: 8,
    padding: 12,
    margin: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#333333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.5)',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#bbbbbb',
    fontSize: 16,
  },
});

export default GroupManagementModal;
