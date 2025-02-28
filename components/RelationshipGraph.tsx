import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput,
  Alert
} from 'react-native';
import { Character } from '../shared/types';
import { 
  Relationship, 
  RelationshipType, 
  RelationshipMapData,
  createDefaultRelationship 
} from '../shared/types/relationship-types';
import { relationshipStyles as styles } from '../styles/relationship-styles';
import {Colors} from '../constants/Colors';
import { getCharacterById } from '../services/character-service';
import { RelationshipService } from '../services/relationship-service';
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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [relationshipStrength, setRelationshipStrength] = useState<string>('0');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('acquaintance');
  const [relationshipDescription, setRelationshipDescription] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('graph');

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