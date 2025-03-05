import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal
} from 'react-native';
import { Svg, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { Relationship, RelationshipType } from '@/shared/types/relationship-types';
import { RelationshipService } from '@/services/relationship-service';

interface RelationshipNodeProps {
  x: number;
  y: number;
  character: Character;
  relationship: Relationship;
  onPress: () => void;
}

interface RelationshipGraphProps {
  character: Character;
  allCharacters: Character[];
  onUpdateCharacter: (character: Character) => void;
}

// Color mapping for relationship types
const COLOR_MAP: Record<RelationshipType, string> = {
  'enemy': '#FF4444',
  'rival': '#FF7744',
  'stranger': '#AAAAAA',
  'acquaintance': '#88AAFF',
  'colleague': '#44AAFF',
  'friend': '#44DDFF',
  'close_friend': '#44FFDD',
  'best_friend': '#44FF88',
  'family': '#DDFF44',
  'crush': '#FF88DD',
  'lover': '#FF44AA',
  'partner': '#FF4488',
  'ex': '#FF8888',
  'mentor': '#DDAA44',
  'student': '#AA88FF',
  'admirer': '#FF88AA',
  'idol': '#FFAA44'
};

// Node component for each relationship
const RelationshipNode: React.FC<RelationshipNodeProps> = ({ x, y, character, relationship, onPress }) => {
  const color = COLOR_MAP[relationship.type] || '#AAAAAA';
  const radius = 20 + (Math.abs(relationship.strength) / 10);
  const opacity = 0.6 + (Math.abs(relationship.strength) / 250);
  
  return (
    <>
      <Circle
        cx={x}
        cy={y}
        r={radius}
        fill={color}
        opacity={opacity}
        onPress={onPress}
      />
      <SvgText
        x={x}
        y={y + 3}
        fontSize="12"
        fontWeight="bold"
        fill="#282828"
        textAnchor="middle"
        onPress={onPress}
      >
        {character.name.substring(0, 4)}
      </SvgText>
    </>
  );
};

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ 
  character, 
  allCharacters, 
  onUpdateCharacter 
}) => {
  const [relationships, setRelationships] = useState<Record<string, { 
    relationship: Relationship, 
    character: Character,
    x: number,
    y: number
  }>>({});
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedStrength, setEditedStrength] = useState('0');
  const [editedDescription, setEditedDescription] = useState('');
  const svgWidth = Dimensions.get('window').width;
  const svgHeight = 400;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  
  // Position calculation for nodes
  const calculatePositions = (relationshipMap: Record<string, Relationship>) => {
    const relationshipCount = Object.keys(relationshipMap).length;
    const result: Record<string, { 
      relationship: Relationship, 
      character: Character,
      x: number,
      y: number
    }> = {};
    
    // Calculate positions in a circle around the center
    Object.entries(relationshipMap).forEach(([targetId, rel], index) => {
      const targetCharacter = allCharacters.find(c => c.id === targetId);
      if (!targetCharacter) return;
      
      // Calculate angle, radius based on relationship strength
      const angle = (2 * Math.PI * index) / relationshipCount;
      const radius = 120 + (rel.strength / 2); // Stronger relationships are closer
      
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      result[targetId] = {
        relationship: rel,
        character: targetCharacter,
        x,
        y
      };
    });
    
    return result;
  };
  
  // Initialize relationships
  useEffect(() => {
    if (character.relationshipMap?.relationships) {
      const positions = calculatePositions(character.relationshipMap.relationships);
      setRelationships(positions);
    }
  }, [character, allCharacters]);
  
  // Handle relationship node press
  const handleNodePress = (targetId: string) => {
    setSelectedRelationship(targetId);
    const rel = relationships[targetId]?.relationship;
    if (rel) {
      setEditedStrength(rel.strength.toString());
      setEditedDescription(rel.description);
    }
  };
  
  // Save edited relationship
  const handleSaveRelationship = () => {
    if (!selectedRelationship || !character.relationshipMap) return;
    
    const strength = Math.max(-100, Math.min(100, parseInt(editedStrength) || 0));
    const updatedRelationship = {
      ...character.relationshipMap.relationships[selectedRelationship],
      strength,
      description: editedDescription,
      lastUpdated: Date.now(),
      // Update the relationship type based on strength
      type: RelationshipService.getRelationshipTypeFromStrength(strength)
    };
    
    // Update character's relationship map
    const updatedRelationships = {
      ...character.relationshipMap.relationships,
      [selectedRelationship]: updatedRelationship
    };
    
    const updatedCharacter = {
      ...character,
      relationshipMap: {
        ...character.relationshipMap,
        relationships: updatedRelationships,
        lastUpdated: Date.now()
      }
    };
    
    // Save changes
    onUpdateCharacter(updatedCharacter);
    
    // Update local state
    setRelationships(calculatePositions(updatedRelationships));
    setEditMode(false);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{character.name} 的关系图谱</Text>
      
      {/* Display number of relationships */}
      <Text style={styles.subtitle}>
        共有 {Object.keys(relationships).length} 个角色关系
      </Text>
      
      {/* Relationship Graph Visualization */}
      <View style={styles.graphContainer}>
        <Svg width={svgWidth} height={svgHeight}>
          {/* Center node (main character) */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={35}
            fill="#FF9ECD"
            opacity={0.9}
          />
          <SvgText
            x={centerX}
            y={centerY + 5}
            fontSize="14"
            fontWeight="bold"
            fill="#282828"
            textAnchor="middle"
          >
            {character.name.substring(0, 5)}
          </SvgText>
          
          {/* Relationship connections */}
          {Object.entries(relationships).map(([targetId, data]) => (
            <React.Fragment key={`line-${targetId}`}>
              <Line
                x1={centerX}
                y1={centerY}
                x2={data.x}
                y2={data.y}
                stroke={COLOR_MAP[data.relationship.type]}
                strokeWidth={Math.abs(data.relationship.strength) / 20 + 1}
                opacity={0.6}
              />
            </React.Fragment>
          ))}
          
          {/* Relationship nodes */}
          {Object.entries(relationships).map(([targetId, data]) => (
            <RelationshipNode
              key={`node-${targetId}`}
              x={data.x}
              y={data.y}
              character={data.character}
              relationship={data.relationship}
              onPress={() => handleNodePress(targetId)}
            />
          ))}
        </Svg>
      </View>
      
      {/* Relationship Legend */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendContainer}>
        {Object.entries(COLOR_MAP).map(([type, color]) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{type}</Text>
          </View>
        ))}
      </ScrollView>
      
      {/* Selected Relationship Details */}
      {selectedRelationship && relationships[selectedRelationship] && (
        <View style={styles.detailsContainer}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>
              与 {relationships[selectedRelationship].character.name} 的关系
            </Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditMode(!editMode)}
            >
              <Ionicons 
                name={editMode ? "close-outline" : "create-outline"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
          
          {editMode ? (
            <View style={styles.editContainer}>
              <Text style={styles.editLabel}>关系强度 (-100 到 100):</Text>
              <TextInput
                style={styles.editInput}
                value={editedStrength}
                onChangeText={setEditedStrength}
                keyboardType="number-pad"
                maxLength={4}
              />
              
              <Text style={styles.editLabel}>关系描述:</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                multiline={true}
                numberOfLines={3}
              />
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveRelationship}
              >
                <Text style={styles.saveButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.relationshipInfo}>
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>类型: </Text>
                <Text style={{
                  color: COLOR_MAP[relationships[selectedRelationship].relationship.type]
                }}>
                  {relationships[selectedRelationship].relationship.type}
                </Text>
              </Text>
              
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>强度: </Text>
                {relationships[selectedRelationship].relationship.strength}
              </Text>
              
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>互动次数: </Text>
                {relationships[selectedRelationship].relationship.interactions}
              </Text>
              
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>描述: </Text>
                {relationships[selectedRelationship].relationship.description}
              </Text>
              
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>上次更新: </Text>
                {new Date(relationships[selectedRelationship].relationship.lastUpdated).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* No Relationships Message */}
      {Object.keys(relationships).length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#888" />
          <Text style={styles.emptyStateText}>
            {character.name} 还没有建立任何关系
          </Text>
          <Text style={styles.emptyStateSubtext}>
            通过朋友圈互动或聊天来建立关系
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 16,
  },
  graphContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    color: '#eee',
    fontSize: 12,
  },
  detailsContainer: {
    padding: 16,
    backgroundColor: '#333',
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    padding: 8,
    backgroundColor: '#444',
    borderRadius: 16,
  },
  relationshipInfo: {
    padding: 8,
  },
  infoText: {
    color: '#fff',
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: 'bold',
    color: '#aaa',
  },
  editContainer: {
    padding: 8,
  },
  editLabel: {
    color: '#aaa',
    marginBottom: 4,
  },
  editInput: {
    backgroundColor: '#444',
    borderRadius: 4,
    padding: 8,
    color: '#fff',
    marginBottom: 12,
  },
  editTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#FF9ECD',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#282828',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  }
});

export default RelationshipGraph;