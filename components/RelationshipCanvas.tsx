import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { Character } from '../shared/types';
import { Relationship } from '../shared/types/relationship-types';
import { Colors } from '../constants/Colors';

const { width, height } = Dimensions.get('window');
const CENTER_X = width / 2;
const CENTER_Y = height / 3;
const RADIUS = Math.min(width, height) / 3;

interface RelationshipCanvasProps {
  character: Character;
  allCharacters: Character[];
  onSelectRelationship: (relationship: Relationship) => void;
}

export const RelationshipCanvas: React.FC<RelationshipCanvasProps> = ({ 
  character, 
  allCharacters, 
  onSelectRelationship 
}) => {
  const relationships = character.relationshipMap?.relationships || {};
  const relationshipEntries = Object.entries(relationships);

  if (relationshipEntries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>暂无关系数据</Text>
      </View>
    );
  }

  // Calculate positions in a circle
  const getNodePosition = (index: number, total: number) => {
    const angleStep = (2 * Math.PI) / total;
    const angle = index * angleStep - Math.PI / 2; // Start from top
    
    const x = CENTER_X + RADIUS * Math.cos(angle);
    const y = CENTER_Y + RADIUS * Math.sin(angle);
    
    return { x, y };
  };

  // Get color based on relationship strength
  const getRelationshipColor = (strength: number) => {
    if (strength <= -50) return Colors.negative;
    if (strength <= -20) return Colors.caution;
    if (strength <= 20) return Colors.neutral;
    if (strength <= 60) return Colors.positive;
    return Colors.veryPositive;
  };

  // Get line width based on relationship strength
  const getLineWidth = (strength: number) => {
    const absStrength = Math.abs(strength);
    return absStrength / 25 + 1; // 1-5 width range
  };

  return (
    <View style={styles.container}>
      <Svg width={width} height={height * 0.7}>
        {/* Central node (main character) */}
        <G>
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={30}
            fill={Colors.primary}
          />
          <SvgText
            x={CENTER_X}
            y={CENTER_Y + 5}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="12"
          >
            {character.name}
          </SvgText>
        </G>

        {/* Relationship lines and nodes */}
        {relationshipEntries.map(([id, rel], index) => {
          const { x, y } = getNodePosition(index, relationshipEntries.length);
          const targetChar = allCharacters.find(c => c.id === id);
          const relationship = rel as Relationship;
          const strength = relationship.strength;
          const color = getRelationshipColor(strength);
          const lineWidth = getLineWidth(strength);

          return (
            <G key={id}>
              {/* Relationship line */}
              <Line
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={x}
                y2={y}
                stroke={color}
                strokeWidth={lineWidth}
              />
              
              {/* Character node */}
              <Circle
                cx={x}
                cy={y}
                r={25}
                fill={Colors.cardBackground}
                strokeWidth={2}
                stroke={color}
                onPress={() => onSelectRelationship(relationship)}
              />
              <SvgText
                x={x}
                y={y + 5}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="10"
                onPress={() => onSelectRelationship(relationship)}
              >
                {targetChar?.name || 'Unknown'}
              </SvgText>
              
              {/* Relationship strength */}
              <SvgText
                x={(CENTER_X + x) / 2}
                y={(CENTER_Y + y) / 2 - 10}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="12"
                fontWeight="bold"
              >
                {strength}
              </SvgText>
              
              {/* Relationship type */}
              <SvgText
                x={(CENTER_X + x) / 2}
                y={(CENTER_Y + y) / 2 + 10}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="10"
                fontStyle="italic"
              >
                {relationship.type}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>关系图例</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendItem, { backgroundColor: Colors.negative }]} />
          <Text style={styles.legendText}>敌对 (≤ -50)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendItem, { backgroundColor: Colors.caution }]} />
          <Text style={styles.legendText}>不良 (≤ -20)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendItem, { backgroundColor: Colors.neutral }]} />
          <Text style={styles.legendText}>中性 (≤ 20)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendItem, { backgroundColor: Colors.positive }]} />
          <Text style={styles.legendText}>友好 (≤ 60)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendItem, { backgroundColor: Colors.veryPositive }]} />
          <Text style={styles.legendText}>亲密 ({'>'}60)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textDim,
    fontSize: 16,
  },
  legend: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  legendTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  legendItem: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    color: Colors.textDim,
    fontSize: 12,
  },
});
