import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet 
} from 'react-native';
import { Character } from '../shared/types/character';
import { relationshipStyles as styles } from '../styles/relationship-styles';
import { Colors } from '../constants/Colors';

interface RelationshipsOverviewProps {
  characters: Character[];
  onSelectCharacter: (character: Character) => void;
}

export const RelationshipsOverview: React.FC<RelationshipsOverviewProps> = ({
  characters,
  onSelectCharacter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter characters with relationships enabled
  const charactersWithRelationships = characters.filter(
    char => char.relationshipEnabled
  );
  
  // Further filter by search query if provided
  const filteredCharacters = searchQuery 
    ? charactersWithRelationships.filter(
        char => char.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : charactersWithRelationships;
  
  const getRelationshipStats = (character: Character) => {
    if (!character.relationshipMap?.relationships) {
      return { total: 0, positive: 0, negative: 0, neutral: 0 };
    }
    
    const relationships = Object.values(character.relationshipMap.relationships);
    const total = relationships.length;
    const positive = relationships.filter(r => r.strength > 20).length;
    const negative = relationships.filter(r => r.strength < -20).length;
    const neutral = total - positive - negative;
    
    return { total, positive, negative, neutral };
  };
  
  const renderCharacterItem = ({ item }: { item: Character }) => {
    const stats = getRelationshipStats(item);
    const unreadCount = item.messageBox?.filter(msg => !msg.read).length || 0;
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelectCharacter(item)}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.characterName}>{item.name}</Text>
          {unreadCount > 0 && (
            <View style={{ 
              backgroundColor: Colors.notification,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 10
            }}>
              <Text style={{ color: Colors.white, fontSize: 12 }}>{unreadCount} 未读</Text>
            </View>
          )}
        </View>
        
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: Colors.textDim }}>
            关系统计 ({stats.total}):
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <View style={{ flex: stats.positive, height: 8, backgroundColor: Colors.positive, borderRadius: 4, marginRight: 1 }} />
            <View style={{ flex: stats.neutral, height: 8, backgroundColor: Colors.neutral, borderRadius: 4, marginRight: 1 }} />
            <View style={{ flex: Math.max(1, stats.negative), height: 8, backgroundColor: Colors.negative, borderRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: Colors.textDim }}>正面: {stats.positive}</Text>
            <Text style={{ fontSize: 12, color: Colors.textDim }}>中立: {stats.neutral}</Text>
            <Text style={{ fontSize: 12, color: Colors.textDim }}>负面: {stats.negative}</Text>
          </View>
        </View>
        
        <Text style={{ fontSize: 12, color: Colors.textDim, marginTop: 8 }}>
          上次检视: {item.relationshipMap?.lastReviewed ? 
            new Date(item.relationshipMap.lastReviewed).toLocaleDateString() : 
            '从未'}
        </Text>
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>角色关系概览</Text>
        <Text style={styles.subtitle}>
          查看和管理所有角色的关系网络
        </Text>
      </View>
      
      <TextInput
        style={styles.searchInput}
        placeholder="搜索角色..."
        placeholderTextColor={Colors.textDim}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      
      {filteredCharacters.length > 0 ? (
        <FlatList
          data={filteredCharacters}
          renderItem={renderCharacterItem}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchQuery ? 
              `没有找到名称包含 "${searchQuery}" 的角色` : 
              '没有找到启用关系系统的角色。请在角色设置中启用关系系统。'}
          </Text>
        </View>
      )}
    </View>
  );
};
