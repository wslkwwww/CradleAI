import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Character } from '../shared/types';
import { Ionicons } from '@expo/vector-icons';

interface CharacterSelectorProps {
  characters: Character[];
  selectedCharacterId: string | null;
  onSelectCharacter: (id: string) => void;
  loading?: boolean;
}

const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  loading = false
}) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FF9ECD" />
      </View>
    );
  }

  if (characters.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No characters available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {characters.map(character => (
          <TouchableOpacity
            key={character.id}
            style={[
              styles.characterItem,
              selectedCharacterId === character.id && styles.selectedItem
            ]}
            onPress={() => onSelectCharacter(character.id)}
          >
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{character.name?.charAt(0) || '?'}</Text>
            </View>
            <Text 
              style={[
                styles.characterName,
                selectedCharacterId === character.id && styles.selectedText
              ]}
              numberOfLines={1}
            >
              {character.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  characterItem: {
    alignItems: 'center',
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
  },
  selectedItem: {
    backgroundColor: 'rgba(255, 158, 205, 0.2)',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 158, 205, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  characterName: {
    marginTop: 4,
    fontSize: 14,
    color: '#EEEEEE',
    maxWidth: 70,
    textAlign: 'center',
  },
  selectedText: {
    fontWeight: '600',
    color: '#FF9ECD',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
});

export default CharacterSelector;
