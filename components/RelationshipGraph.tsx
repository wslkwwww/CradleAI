import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { RelationshipType, Relationship } from '@/shared/types/relationship-types';
import { RelationshipService } from '@/services/relationship-service';

// Visualization component imports could be here
// import { ForceGraph } from './ForceGraph';

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
  // States for the component
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [editingRelationship, setEditingRelationship] = useState<boolean>(false);
  const [relationshipStrength, setRelationshipStrength] = useState<string>('0');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('stranger');
  const [relationshipDescription, setRelationshipDescription] = useState<string>('');

  // Initialize relationship map if needed
  useEffect(() => {
    if (!character.relationshipMap) {
      const initializedCharacter = RelationshipService.initializeRelationshipMap(character);
      onUpdateCharacter(initializedCharacter);
    }
  }, [character, onUpdateCharacter]);

  // Get relationship data for visualization
  const relationshipData = useMemo(() => {
    if (!character.relationshipMap?.relationships) {
      return [];
    }

    const relationships = Object.entries(character.relationshipMap.relationships)
      .map(([targetId, relationship]) => {
        const targetCharacter = allCharacters.find(c => c.id === targetId);
        return {
          source: character.id,
          target: targetId,
          targetName: targetCharacter?.name || 'Unknown Character',
          type: relationship.type,
          strength: relationship.strength
        };
      });

    return relationships;
  }, [character.relationshipMap?.relationships, allCharacters, character.id]);

  // Handle relationship selection
  const handleSelectRelationship = (targetId: string) => {
    // Reset form when selecting a different character
    if (selectedCharacterId !== targetId) {
      setEditingRelationship(false);
    }
    
    setSelectedCharacterId(targetId);
    
    // Populate form with existing relationship data if available
    if (character.relationshipMap?.relationships[targetId]) {
      const relationship = character.relationshipMap.relationships[targetId];
      setRelationshipStrength(relationship.strength.toString());
      setRelationshipType(relationship.type as RelationshipType);
      setRelationshipDescription(relationship.description);
    } else {
      // Default values for new relationship
      setRelationshipStrength('0');
      setRelationshipType('stranger');
      setRelationshipDescription('');
    }
  };

  // Handle relationship update
  const handleUpdateRelationship = () => {
    if (!selectedCharacterId || !character.relationshipMap) return;
    
    // Ensure we have a valid relationship map with lastUpdated field
    const updatedRelationshipMap = {
      ...character.relationshipMap,
      lastUpdated: Date.now(),
      relationships: { ...character.relationshipMap.relationships }
    };
    
    // Create or update the relationship
    const targetCharacter = allCharacters.find(c => c.id === selectedCharacterId);
    
    const updatedRelationship: Relationship = {
      targetId: selectedCharacterId,
      strength: parseInt(relationshipStrength, 10) || 0,
      type: relationshipType,
      description: relationshipDescription || `${character.name}对${targetCharacter?.name || '此角色'}的关系`,
      lastUpdated: Date.now(),
      interactions: character.relationshipMap.relationships[selectedCharacterId]?.interactions || 0
    };
    
    // Update the relationship in the map
    updatedRelationshipMap.relationships[selectedCharacterId] = updatedRelationship;
    
    // Update the character
    const updatedCharacter = {
      ...character,
      relationshipMap: updatedRelationshipMap
    };
    
    onUpdateCharacter(updatedCharacter);
    setEditingRelationship(false);
  };

  // Create new relationship with another character
  const handleCreateRelationship = (targetId: string) => {
    if (!character.relationshipMap) return;
    
    const targetCharacter = allCharacters.find(c => c.id === targetId);
    if (!targetCharacter) return;
    
    // Initialize the relationship map if needed
    const updatedCharacter = RelationshipService.initializeRelationshipMap(character);
    
    // Ensure the relationship map has all required fields
    const updatedRelationshipMap = {
      ...updatedCharacter.relationshipMap,
      lastUpdated: Date.now(),
      lastReviewed: Date.now(),
      relationships: { 
        ...(updatedCharacter.relationshipMap?.relationships || {}) 
      }
    };
    
    // Create the default relationship
    const newRelationship: Relationship = {
      targetId: targetId,
      strength: 0,
      type: 'stranger',
      description: `${character.name}对${targetCharacter.name}的初始印象`,
      lastUpdated: Date.now(),
      interactions: 0
    };
    
    // Add the relationship to the map
    updatedRelationshipMap.relationships[targetId] = newRelationship;
    
    // Update the character
    const characterWithNewRelationship = {
      ...updatedCharacter,
      relationshipMap: updatedRelationshipMap
    };
    
    onUpdateCharacter(characterWithNewRelationship);
    setSelectedCharacterId(targetId);
    handleSelectRelationship(targetId);
  };

  // Delete a relationship
  const handleDeleteRelationship = (targetId: string) => {
    if (!character.relationshipMap || !character.relationshipMap.relationships[targetId]) return;
    
    // Create a copy of the relationships without the target
    const { [targetId]: _, ...remainingRelationships } = character.relationshipMap.relationships;
    
    // Update the relationship map
    const updatedRelationshipMap = {
      ...character.relationshipMap,
      lastUpdated: Date.now(),
      relationships: remainingRelationships
    };
    
    // Update the character
    const updatedCharacter = {
      ...character,
      relationshipMap: updatedRelationshipMap
    };
    
    onUpdateCharacter(updatedCharacter);
    setSelectedCharacterId(null);
    setEditingRelationship(false);
  };

  // Get available characters for new relationships
  const availableCharacters = useMemo(() => {
    const existingRelationshipIds = character.relationshipMap 
      ? Object.keys(character.relationshipMap.relationships) 
      : [];
      
    return allCharacters.filter(c => 
      c.id !== character.id && 
      !existingRelationshipIds.includes(c.id)
    );
  }, [character, allCharacters]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => onUpdateCharacter(character)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{character.name}的关系图谱</Text>
      </View>

      {/* Relationship Visualization would go here */}
      <View style={styles.visualizationContainer}>
        <Text style={styles.visualizationPlaceholder}>
          关系图可视化区域
          {/* <ForceGraph data={relationshipData} /> */}
        </Text>
      </View>

      <ScrollView style={styles.relationshipsContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>现有关系</Text>
          {relationshipData.length > 0 ? (
            relationshipData.map(rel => (
              <TouchableOpacity
                key={rel.target}
                style={[
                  styles.relationshipItem,
                  selectedCharacterId === rel.target && styles.selectedRelationship
                ]}
                onPress={() => handleSelectRelationship(rel.target)}
              >
                <Text style={styles.relationshipName}>{rel.targetName}</Text>
                <Text style={styles.relationshipInfo}>
                  类型: {rel.type} | 强度: {rel.strength}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>暂无关系数据</Text>
          )}
        </View>

        {availableCharacters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>添加新关系</Text>
            {availableCharacters.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.availableCharacterItem}
                onPress={() => handleCreateRelationship(c.id)}
              >
                <Text style={styles.availableCharacterName}>{c.name}</Text>
                <Ionicons name="add-circle-outline" size={20} color="#FF9ECD" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedCharacterId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>关系详情</Text>
            <View style={styles.relationshipDetail}>
              {!editingRelationship ? (
                // View mode
                <>
                  <Text style={styles.detailLabel}>角色:</Text>
                  <Text style={styles.detailValue}>
                    {allCharacters.find(c => c.id === selectedCharacterId)?.name || '未知角色'}
                  </Text>
                  
                  <Text style={styles.detailLabel}>关系类型:</Text>
                  <Text style={styles.detailValue}>
                    {character.relationshipMap?.relationships[selectedCharacterId]?.type || '-'}
                  </Text>
                  
                  <Text style={styles.detailLabel}>关系强度:</Text>
                  <Text style={styles.detailValue}>
                    {character.relationshipMap?.relationships[selectedCharacterId]?.strength || 0}
                  </Text>
                  
                  <Text style={styles.detailLabel}>描述:</Text>
                  <Text style={styles.detailValue}>
                    {character.relationshipMap?.relationships[selectedCharacterId]?.description || '-'}
                  </Text>
                  
                  <Text style={styles.detailLabel}>互动次数:</Text>
                  <Text style={styles.detailValue}>
                    {character.relationshipMap?.relationships[selectedCharacterId]?.interactions || 0}
                  </Text>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setEditingRelationship(true)}
                    >
                      <Text style={styles.editButtonText}>编辑关系</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteRelationship(selectedCharacterId)}
                    >
                      <Text style={styles.deleteButtonText}>删除关系</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // Edit mode
                <>
                  <Text style={styles.detailLabel}>角色:</Text>
                  <Text style={styles.detailValue}>
                    {allCharacters.find(c => c.id === selectedCharacterId)?.name || '未知角色'}
                  </Text>
                  
                  <Text style={styles.detailLabel}>关系类型:</Text>
                  <View style={styles.pickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {['stranger', 'acquaintance', 'colleague', 'friend', 'close_friend', 'best_friend', 
                       'family', 'lover', 'partner', 'rival', 'enemy', 'ex', 'mentor', 'student'].map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.typeOption,
                            relationshipType === type && styles.selectedTypeOption
                          ]}
                          onPress={() => setRelationshipType(type as RelationshipType)}
                        >
                          <Text style={[
                            styles.typeOptionText,
                            relationshipType === type && styles.selectedTypeOptionText
                          ]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  
                  <Text style={styles.detailLabel}>关系强度 ({relationshipStrength}):</Text>
                  <View style={styles.sliderContainer}>
                    <TouchableOpacity
                      onPress={() => setRelationshipStrength(
                        Math.max(-100, parseInt(relationshipStrength) - 10).toString()
                      )}
                    >
                      <Text style={styles.sliderButton}>-</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.slider}>
                      <View 
                        style={[
                          styles.sliderFill,
                          { 
                            width: `${(parseInt(relationshipStrength) + 100) / 2}%`,
                            backgroundColor: parseInt(relationshipStrength) >= 0 ? '#5cb85c' : '#d9534f'
                          }
                        ]} 
                      />
                    </View>
                    
                    <TouchableOpacity
                      onPress={() => setRelationshipStrength(
                        Math.min(100, parseInt(relationshipStrength) + 10).toString()
                      )}
                    >
                      <Text style={styles.sliderButton}>+</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.detailLabel}>描述:</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    value={relationshipDescription}
                    onChangeText={setRelationshipDescription}
                    placeholder="输入关系描述"
                    placeholderTextColor="#888"
                    multiline
                    numberOfLines={3}
                  />
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleUpdateRelationship}
                    >
                      <Text style={styles.saveButtonText}>保存</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setEditingRelationship(false);
                        handleSelectRelationship(selectedCharacterId);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>取消</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  visualizationContainer: {
    height: 200,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizationPlaceholder: {
    color: '#888',
  },
  relationshipsContainer: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  relationshipItem: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedRelationship: {
    backgroundColor: '#444',
    borderColor: '#FF9ECD',
    borderWidth: 1,
  },
  relationshipName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  relationshipInfo: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
  availableCharacterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  availableCharacterName: {
    fontSize: 16,
    color: '#fff',
  },
  relationshipDetail: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  editButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  typeOption: {
    backgroundColor: '#444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTypeOption: {
    backgroundColor: '#FF9ECD',
  },
  typeOptionText: {
    color: '#fff',
  },
  selectedTypeOptionText: {
    fontWeight: 'bold',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderButton: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    width: 30,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 10,
    backgroundColor: '#444',
    borderRadius: 5,
    marginHorizontal: 8,
  },
  sliderFill: {
    height: '100%',
    borderRadius: 5,
  },
  descriptionInput: {
    backgroundColor: '#444',
    color: '#fff',
    padding: 10,
    borderRadius: 4,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    padding: 10,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#fff',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 16,
  },
});