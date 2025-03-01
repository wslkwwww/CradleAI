import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
  TextInput
} from 'react-native';
import { Character } from '@/shared/types';
import { RelationshipService } from '@/services/relationship-service';
import { 
  Relationship, 
  RelationshipType, 
  RelationshipMapData,
  createDefaultRelationship 
} from '../shared/types/relationship-types';
import {Colors} from '../constants/Colors';
import { getCharacterById } from '../services/character-service';
import { RelationshipCanvas } from './RelationshipCanvas';

interface RelationshipGraphProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
  allCharacters: Character[];
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ 
  character, 
  onUpdateCharacter,
  allCharacters 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [relationshipStrength, setRelationshipStrength] = useState<string>('0');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('acquaintance');
  const [relationshipDescription, setRelationshipDescription] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('graph');

  // Check if relationship system is enabled for this character
  const isRelationshipSystemEnabled = !!character.relationshipMap;

  // Function to initialize the relationship system
  const handleEnableRelationshipSystem = async () => {
    setIsLoading(true);
    try {
      // Initialize relationship map using RelationshipService
      const updatedCharacter = RelationshipService.initializeRelationshipMap(character);
      
      // 修复：明确设置 relationshipEnabled 标志
      updatedCharacter.relationshipEnabled = true;
      
      // Update the character with the newly initialized relationship map
      await onUpdateCharacter(updatedCharacter);
      
      Alert.alert(
        "关系系统已启用",
        `成功为${character.name}启用了关系系统！`
      );
    } catch (error) {
      console.error("启用关系系统失败:", error);
      Alert.alert(
        "启用失败",
        "无法为此角色启用关系系统，请稍后再试。"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // If no relationship system is enabled yet, show activation UI
  if (!isRelationshipSystemEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateTitle}>关系系统未启用</Text>
          <Text style={styles.emptyStateDescription}>
            {character.name}还没有启用关系系统。启用后，角色将能够建立和管理与其他角色的关系，并记忆互动历史。
          </Text>
          
          <TouchableOpacity 
            style={styles.enableButton}
            onPress={handleEnableRelationshipSystem}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.enableButtonText}>启用关系系统</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Initialize component with proper relationship data
  const initializedCharacter = RelationshipService.initializeRelationshipMap(character);
  const relationshipMap = initializedCharacter.relationshipMap || { relationships: {}, lastReviewed: Date.now() };
  const relationships = relationshipMap.relationships || {};

  const getRelationshipColor = (strength: number) => {
    if (strength <= -50) return Colors.negative;
    if (strength <= -20) return Colors.caution;
    if (strength <= 20) return Colors.neutral;
    if (strength <= 60) return Colors.positive;
    return Colors.veryPositive;
  };

  // Fix for the width string issue in strengthBar
  const renderRelationshipItem = (relationship: Relationship, targetChar?: Character) => {
    const strength = relationship.strength;
    const barWidth = Math.abs(strength); // Use number instead of string percentage
    const barColor = getRelationshipColor(strength);
    
    return (
      <TouchableOpacity 
        key={relationship.targetId}
        style={styles.relationshipItem}
        onPress={() => {
          setSelectedRelationship(relationship);
          setRelationshipStrength(relationship.strength.toString());
          setRelationshipType(relationship.type);
          setRelationshipDescription(relationship.description);
          setEditModalVisible(true);
        }}
      >
        <View style={styles.characterInfo}>
          <Image 
            source={
              targetChar?.avatar 
                ? { uri: targetChar.avatar } 
                : require('../assets/images/default-avatar.png')
            } 
            style={styles.avatar}
          />
          <View>
            <Text style={styles.characterName}>
              {targetChar?.name || `Unknown (${relationship.targetId})`}
            </Text>
            <Text style={styles.relationshipType}>
              {relationship.type}
            </Text>
            <View style={styles.strengthIndicator}>
              <View 
                style={[
                  styles.strengthBar, 
                  { 
                    width: `${barWidth}%`, // Convert to percentage string
                    backgroundColor: barColor, 
                    alignSelf: strength < 0 ? 'flex-start' : 'flex-end' 
                  }
                ]}
              />
            </View>
            <Text style={styles.strengthText}>
              强度: {strength}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleUpdateRelationship = () => {
    if (!selectedRelationship) return;

    const strength = parseInt(relationshipStrength);
    if (isNaN(strength) || strength < -100 || strength > 100) {
      Alert.alert('错误', '关系强度必须在-100到100之间');
      return;
    }

    const updatedRelationship: Relationship = {
      ...selectedRelationship,
      strength,
      type: relationshipType,
      description: relationshipDescription,
      lastUpdated: Date.now()
    };

    const updatedRelationships = {
      ...relationships,
      [selectedRelationship.targetId]: updatedRelationship
    };

    // Make sure to include lastReviewed property
    const updatedCharacter = {
      ...character,
      relationshipMap: {
        relationships: updatedRelationships,
        lastReviewed: character.relationshipMap?.lastReviewed || Date.now()
      }
    };

    onUpdateCharacter(updatedCharacter);
    setEditModalVisible(false);
  };

  const handleAddRelationship = () => {
    if (!selectedCharacterId) {
      Alert.alert('错误', '请选择一个角色');
      return;
    }

    const strength = parseInt(relationshipStrength);
    if (isNaN(strength) || strength < -100 || strength > 100) {
      Alert.alert('错误', '关系强度必须在-100到100之间');
      return;
    }

    // Check if relationship already exists
    if (relationships[selectedCharacterId]) {
      Alert.alert('错误', '与该角色的关系已存在');
      return;
    }

    const newRelationship: Relationship = {
      targetId: selectedCharacterId,
      strength,
      type: relationshipType,
      description: relationshipDescription || '新建的关系',
      lastUpdated: Date.now(),
      interactions: 0
    };

    const updatedRelationships = {
      ...relationships,
      [selectedCharacterId]: newRelationship
    };

    // Make sure to include lastReviewed property
    const updatedCharacter = {
      ...initializedCharacter,
      relationshipMap: {
        relationships: updatedRelationships,
        lastReviewed: initializedCharacter.relationshipMap?.lastReviewed || Date.now()
      }
    };

    onUpdateCharacter(updatedCharacter);
    setAddModalVisible(false);
    setSelectedCharacterId('');
    setRelationshipStrength('0');
    setRelationshipType('acquaintance');
    setRelationshipDescription('');
  };

  const handleDeleteRelationship = () => {
    if (!selectedRelationship) return;

    Alert.alert(
      '删除关系',
      `确定要删除与 ${getCharacterById(allCharacters, selectedRelationship.targetId)?.name || 'Unknown'} 的关系吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            const updatedRelationships = { ...relationships };
            delete updatedRelationships[selectedRelationship.targetId];

            // Make sure to include lastReviewed property
            const updatedCharacter = {
              ...character,
              relationshipMap: {
                relationships: updatedRelationships,
                lastReviewed: character.relationshipMap?.lastReviewed || Date.now()
              }
            };

            onUpdateCharacter(updatedCharacter);
            setEditModalVisible(false);
          }
        }
      ]
    );
  };

  const relationshipTypes: RelationshipType[] = [
    'stranger', 'acquaintance', 'friend', 'close_friend', 'best_friend',
    'family', 'crush', 'lover', 'partner', 'ex', 'rival', 'enemy',
    'mentor', 'student', 'colleague', 'admirer', 'idol'
  ];

  // Get list of characters for adding relationships
  const availableCharacters = allCharacters.filter(
    c => c.id !== character.id && !relationships[c.id]
  );

  // Handle selection of relationship from the canvas
  const handleCanvasRelationshipSelect = (relationship: Relationship) => {
    setSelectedRelationship(relationship);
    setRelationshipStrength(relationship.strength.toString());
    setRelationshipType(relationship.type);
    setRelationshipDescription(relationship.description);
    setEditModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{character.name}的关系图谱</Text>
        <Text style={styles.subtitle}>
          管理角色与其他人的关系强度和类型
        </Text>
      </View>

      <View style={styles.viewToggleContainer}>
        <TouchableOpacity 
          style={[styles.viewToggleButton, viewMode === 'graph' && styles.activeViewToggleButton]}
          onPress={() => setViewMode('graph')}
        >
          <Text style={[styles.viewToggleText, viewMode === 'graph' && styles.activeViewToggleText]}>
            图形视图
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.viewToggleButton, viewMode === 'list' && styles.activeViewToggleButton]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewToggleText, viewMode === 'list' && styles.activeViewToggleText]}>
            列表视图
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => {
          setSelectedCharacterId('');
          setRelationshipStrength('0');
          setRelationshipType('acquaintance');
          setRelationshipDescription('');
          setAddModalVisible(true);
        }}
      >
        <Text style={styles.buttonText}>添加新关系</Text>
      </TouchableOpacity>

      {viewMode === 'list' ? (
        <ScrollView style={{ flex: 1 }}>
          {Object.entries(relationships).length > 0 ? (
            Object.entries(relationships).map(([id, relationship]) => {
              const targetChar = getCharacterById(allCharacters, id);
              return renderRelationshipItem(relationship as Relationship, targetChar);
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                没有找到关系数据。点击"添加新关系"按钮创建新的关系。
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <RelationshipCanvas 
          character={character}
          allCharacters={allCharacters}
          onSelectRelationship={handleCanvasRelationshipSelect}
        />
      )}

      {/* Edit Relationship Modal */} 
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>编辑关系</Text>
            <Text style={styles.subtitle}>
              {getCharacterById(allCharacters, selectedRelationship?.targetId || '')?.name || 'Unknown'}
            </Text>

            <Text>关系强度 (-100 到 100):</Text>
            <TextInput
              style={styles.input}
              value={relationshipStrength}
              onChangeText={setRelationshipStrength}
              keyboardType="number-pad"
            />

            <Text>关系类型:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {relationshipTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.relationshipBadge,
                    {
                      backgroundColor: type === relationshipType 
                        ? Colors.primary 
                        : Colors.inputBackground
                    }
                  ]}
                  onPress={() => setRelationshipType(type)}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: type === relationshipType ? Colors.white : Colors.text }
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text>描述:</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={relationshipDescription}
              onChangeText={setRelationshipDescription}
              multiline
              numberOfLines={4}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.deleteButton]}
                onPress={handleDeleteRelationship}
              >
                <Text style={styles.buttonText}>删除</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdateRelationship}
              >
                <Text style={styles.buttonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Relationship Modal */} 
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>添加新关系</Text>

            <Text>选择角色:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {availableCharacters.map((char) => (
                <TouchableOpacity
                  key={char.id}
                  style={[
                    styles.characterBadge,
                    {
                      backgroundColor: char.id === selectedCharacterId 
                        ? Colors.primary 
                        : Colors.inputBackground
                    }
                  ]}
                  onPress={() => setSelectedCharacterId(char.id)}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: char.id === selectedCharacterId ? Colors.white : Colors.text }
                    ]}
                  >
                    {char.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text>关系强度 (-100 到 100):</Text>
            <TextInput
              style={styles.input}
              value={relationshipStrength}
              onChangeText={setRelationshipStrength}
              keyboardType="number-pad"
            />

            <Text>关系类型:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {relationshipTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.relationshipBadge,
                    {
                      backgroundColor: type === relationshipType 
                        ? Colors.primary 
                        : Colors.inputBackground
                    }
                  ]}
                  onPress={() => setRelationshipType(type)}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: type === relationshipType ? Colors.white : Colors.text }
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text>描述:</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={relationshipDescription}
              onChangeText={setRelationshipDescription}
              multiline
              numberOfLines={4}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]}
                onPress={handleAddRelationship}
              >
                <Text style={styles.buttonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#282828',
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgb(255, 224, 195)',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
    marginBottom: 12,
    width: '100%',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgb(255, 224, 195)',
    marginBottom: 12,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#AAAAAA',
    textAlign: 'center',
    marginBottom: 24,
  },
  enableButton: {
    backgroundColor: '#1a237e',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 150,
    alignItems: 'center',
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  relationshipItem: {
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'rgb(255, 224, 195)',
  },
  relationshipName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  relationshipDetails: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 4,
  },
  relationshipDescription: {
    fontSize: 14,
    color: '#AAAAAA',
    fontStyle: 'italic',
    marginTop: 8,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  viewToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 8,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
  },
  activeViewToggleButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.9)',
  },
  viewToggleText: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: '500',
  },
  activeViewToggleText: {
    color: '#282828',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#1a237e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#AAAAAA',
    fontSize: 16,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  input: {
    backgroundColor: '#444',
    color: '#FFF',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#666',
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: '#B71C1C',
    flex: 1,
    marginHorizontal: 8,
  },
  saveButton: {
    backgroundColor: '#1a237e',
    flex: 1,
    marginLeft: 8,
  },
  characterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  characterName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  relationshipType: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  strengthIndicator: {
    height: 6,
    backgroundColor: '#444',
    borderRadius: 3,
    width: '100%',
    marginBottom: 8,
  },
  strengthBar: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  relationshipBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginRight: 8,
  },
  characterBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 14,
  },
});