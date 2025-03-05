import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { Character } from '@/shared/types';
import { Relationship, RelationshipType } from '@/shared/types/relationship-types';
import { useCharacters } from '@/constants/CharactersContext';
import { RelationshipService } from '@/services/relationship-service';
import { ApiServiceProvider } from '@/services/api-service-provider';
import { useUser } from '@/constants/UserContext';
import { RelationshipPromptService } from '@/services/relationship-prompt-service';

const { width } = Dimensions.get('window');

interface Props {
  character: Character;
  onUpdateCharacter?: (character: Character) => void;
  allCharacters: Character[];
}

const RelationshipGraph: React.FC<Props> = ({ character, onUpdateCharacter, allCharacters }) => {
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);
  const [relationshipDetails, setRelationshipDetails] = useState<Relationship | null>(null);
  const [updating, setUpdating] = useState(false);
  const [strengthDelta, setStrengthDelta] = useState(0);
  const { updateCharacter } = useCharacters();
  const { user } = useUser();
  const [generatingDescription, setGeneratingDescription] = useState(false);
  
  // Calculate relationships to display
  const relationships = character.relationshipMap?.relationships || {};
  const relationshipEntries = Object.entries(relationships);
  const CENTER_X = width / 2;
  const CENTER_Y = width / 2;
  const RADIUS = width * 0.35;

  // Define colors for relationship types
  const typeColors: Record<RelationshipType, string> = {
    'enemy': '#FF3B30',
    'rival': '#FF9500',
    'stranger': '#CCCCCC',
    'acquaintance': '#B3E5FC',
    'colleague': '#8BC34A',
    'friend': '#4CD964',
    'close_friend': '#34AADC',
    'best_friend': '#007AFF',
    'family': '#5856D6',
    'crush': '#FF2D55',
    'lover': '#AF52DE',
    'partner': '#E91E63',
    'ex': '#9C27B0',
    'mentor': '#673AB7',
    'student': '#3F51B5',
    'admirer': '#FF9ECD',
    'idol': '#FFC107'
  };

  // Calculate node positions in a circle
  const getNodePosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI;
    const x = CENTER_X + RADIUS * Math.cos(angle);
    const y = CENTER_Y + RADIUS * Math.sin(angle);
    return { x, y };
  };

  // Calculate line color based on relationship type and strength
  const getLineColor = (type: RelationshipType, strength: number) => {
    const baseColor = typeColors[type];
    if (strength < 0) {
      // For negative relationships, mix with red
      return baseColor;
    }
    return baseColor;
  };

  // Calculate line width based on relationship strength
  const getLineWidth = (strength: number) => {
    const absStrength = Math.abs(strength);
    return Math.max(1, Math.min(5, absStrength / 20));
  };

  // Show relationship details when a node is clicked
  const handleNodeClick = (relationshipId: string) => {
    const relationship = relationships[relationshipId];
    setSelectedRelationship(relationshipId);
    setRelationshipDetails(relationship);
    setStrengthDelta(0);
  };

  // Update relationship strength
  const handleUpdateStrength = async (delta: number) => {
    if (!selectedRelationship || !relationshipDetails) return;
    
    try {
      setUpdating(true);
      console.log(`【关系图谱】更新关系强度, 角色 ${character.name} 与 ${selectedRelationship}, 变化: ${delta}`);
      
      // Get target character name
      const targetCharacter = allCharacters.find(c => c.id === selectedRelationship);
      if (!targetCharacter) {
        console.error(`【关系图谱】未找到目标角色: ${selectedRelationship}`);
        return;
      }
      const targetName = targetCharacter.name || "未知角色";
      
      // Prepare to use OpenRouter if configured
      const apiKey = user?.settings?.chat?.characterApiKey;
      const apiSettings = {
        apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
        openrouter: user?.settings?.chat?.openrouter
      };
      
      // Basic relationship update
      const updatedCharacter = RelationshipService.processRelationshipUpdate(
        character,
        selectedRelationship,
        delta,
        undefined // Let the service determine the type based on new strength
      );

      // If OpenRouter is enabled, we could get better relationship descriptions
      if (apiKey && apiSettings.apiProvider === 'openrouter' && apiSettings.openrouter?.enabled) {
        setGeneratingDescription(true);
        try {
          console.log(`【关系图谱】使用OpenRouter生成关系描述...`);
          
          const relationship = updatedCharacter.relationshipMap?.relationships[selectedRelationship];
          if (!relationship) return;
          
          const description = await RelationshipPromptService.generateRelationshipDescription(
            character,
            targetCharacter,
            relationship,
            apiKey,
            apiSettings
          );
          
          // Update the relationship description
          if (description && updatedCharacter.relationshipMap?.relationships[selectedRelationship]) {
            updatedCharacter.relationshipMap.relationships[selectedRelationship].description = description;
          }
        } catch (error) {
          console.error(`【关系图谱】生成关系描述失败:`, error);
          // Continue with the update even if description generation fails
        } finally {
          setGeneratingDescription(false);
        }
      }
      
      // Update character relationship
      if (onUpdateCharacter) {
        onUpdateCharacter(updatedCharacter);
      } else {
        await updateCharacter(updatedCharacter);
      }
      
      // Update local state
      setRelationshipDetails(updatedCharacter.relationshipMap?.relationships[selectedRelationship] || null);
      
    } catch (error) {
      console.error(`【关系图谱】更新关系失败:`, error);
    } finally {
      setUpdating(false);
    }
  };

  const handleRegenerateDescription = async () => {
    if (!selectedRelationship || !relationshipDetails) return;
    
    try {
      setGeneratingDescription(true);
      
      // Get target character
      const targetCharacter = allCharacters.find(c => c.id === selectedRelationship);
      if (!targetCharacter) {
        console.error(`【关系图谱】未找到目标角色: ${selectedRelationship}`);
        return;
      }
      
      // Prepare API settings
      const apiKey = user?.settings?.chat?.characterApiKey;
      const apiSettings = {
        apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
        openrouter: user?.settings?.chat?.openrouter
      };
      
      // Check if API key exists
      if (!apiKey) {
        console.error(`【关系图谱】缺少API密钥，无法生成描述`);
        return;
      }
      
      console.log(`【关系图谱】重新生成${character.name}对${targetCharacter.name}的关系描述...`);
      
      // Use the new RelationshipPromptService
      const description = await RelationshipPromptService.generateRelationshipDescription(
        character,
        targetCharacter,
        relationshipDetails,
        apiKey,
        apiSettings
      );
      
      // Update character with new description
      const updatedCharacter = { ...character };
      if (updatedCharacter.relationshipMap?.relationships[selectedRelationship]) {
        updatedCharacter.relationshipMap.relationships[selectedRelationship].description = description;
        
        // Update character
        if (onUpdateCharacter) {
          onUpdateCharacter(updatedCharacter);
        } else {
          await updateCharacter(updatedCharacter);
        }
        
        // Update local state
        setRelationshipDetails(updatedCharacter.relationshipMap.relationships[selectedRelationship]);
      }
    } catch (error) {
      console.error(`【关系图谱】重新生成描述失败:`, error);
    } finally {
      setGeneratingDescription(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{character.name}的关系图谱</Text>
      
      {/* Visualization */}
      <View style={styles.graphContainer}>
        <Svg width={width} height={width}>
          {/* Draw connecting lines */}
          {relationshipEntries.map(([id, rel], index) => {
            const { x, y } = getNodePosition(index, relationshipEntries.length);
            const lineColor = getLineColor(rel.type, rel.strength);
            const lineWidth = getLineWidth(rel.strength);
            
            return (
              <Line
                key={`line-${id}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={x}
                y2={y}
                stroke={lineColor}
                strokeWidth={lineWidth}
                strokeDasharray={rel.strength < 0 ? "5,5" : "none"}
              />
            );
          })}
          
          {/* Draw center node (main character) */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={20}
            fill="#FF9ECD"
          />
          
          {/* Draw outer nodes (relationships) */}
          {relationshipEntries.map(([id, rel], index) => {
            const { x, y } = getNodePosition(index, relationshipEntries.length);
            const targetChar = allCharacters.find(c => c.id === id);
            const isSelected = id === selectedRelationship;
            
            return (
              <React.Fragment key={`node-${id}`}>
                <Circle
                  cx={x}
                  cy={y}
                  r={15}
                  fill={typeColors[rel.type]}
                  stroke={isSelected ? "white" : "transparent"}
                  strokeWidth={2}
                  onPress={() => handleNodeClick(id)}
                />
                <SvgText
                  x={x}
                  y={y + 25}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                >
                  {targetChar?.name || id.substring(0, 5)}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
      
      {/* Relationship Details */}
      {relationshipDetails && (
        <ScrollView style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>
            关系详情: {
              allCharacters.find(c => c.id === selectedRelationship)?.name || 
              selectedRelationship?.substring(0, 8)
            }
          </Text>
          
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>关系类型:</Text>
            <View style={[
              styles.typeTag, 
              { backgroundColor: typeColors[relationshipDetails.type] }
            ]}>
              <Text style={styles.typeText}>
                {relationshipDetails.type}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>关系强度:</Text>
            <Text style={[
              styles.strengthValue,
              relationshipDetails.strength > 0 ? styles.positiveStrength : 
              relationshipDetails.strength < 0 ? styles.negativeStrength :
              styles.neutralStrength
            ]}>
              {relationshipDetails.strength}
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>互动次数:</Text>
            <Text style={styles.detailsValue}>{relationshipDetails.interactions}</Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>上次更新:</Text>
            <Text style={styles.detailsValue}>
              {new Date(relationshipDetails.lastUpdated).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>描述:</Text>
            <Text style={styles.descriptionText}>{relationshipDetails.description}</Text>
            <TouchableOpacity 
              style={styles.regenerateButton} 
              onPress={handleRegenerateDescription}
              disabled={generatingDescription}
            >
              <Text style={styles.buttonText}>重新生成描述</Text>
            </TouchableOpacity>
          </View>
          
          {/* Relationship Strength Controls */}
          <View style={styles.strengthControls}>
            <TouchableOpacity 
              style={[styles.strengthButton, styles.decreaseButton]} 
              onPress={() => handleUpdateStrength(-10)}
              disabled={updating}
            >
              <Text style={styles.buttonText}>-10</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.strengthButton, styles.decreaseButton]} 
              onPress={() => handleUpdateStrength(-5)}
              disabled={updating}
            >
              <Text style={styles.buttonText}>-5</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.strengthButton, styles.increaseButton]} 
              onPress={() => handleUpdateStrength(5)}
              disabled={updating}
            >
              <Text style={styles.buttonText}>+5</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.strengthButton, styles.increaseButton]} 
              onPress={() => handleUpdateStrength(10)}
              disabled={updating}
            >
              <Text style={styles.buttonText}>+10</Text>
            </TouchableOpacity>
          </View>
          
          {updating && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF9ECD" />
              <Text style={styles.loadingText}>更新中...</Text>
            </View>
          )}
        </ScrollView>
      )}
      
      {/* No relationship selected state */}
      {!relationshipDetails && relationshipEntries.length > 0 && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            点击一个角色节点查看详细关系信息
          </Text>
        </View>
      )}
      
      {/* No relationships state */}
      {relationshipEntries.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            暂无关系数据，前往探索页面的朋友圈互动或使用关系测试功能来建立关系
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#222',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  graphContainer: {
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    maxHeight: 300,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsLabel: {
    color: '#ccc',
    fontSize: 14,
  },
  detailsValue: {
    color: 'white',
    fontSize: 14,
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  strengthValue: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  positiveStrength: {
    color: '#4CD964',
  },
  negativeStrength: {
    color: '#FF3B30',
  },
  neutralStrength: {
    color: '#CCCCCC',
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionLabel: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
  },
  descriptionText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  regenerateButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  strengthButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decreaseButton: {
    backgroundColor: '#FF3B30',
  },
  increaseButton: {
    backgroundColor: '#4CD964',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loadingText: {
    color: '#ccc',
    marginLeft: 8,
  },
  instructionsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#ccc',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  }
});

export default RelationshipGraph;