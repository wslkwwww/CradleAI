import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Character } from '@/shared/types';
import { theme } from '@/constants/theme';

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
        <ActivityIndicator color={theme.colors.primary} size="small" />
        <Text style={styles.loadingText}>加载角色...</Text>
      </View>
    );
  }

  if (characters.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>没有可用的角色</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {characters.map((character) => (
        <TouchableOpacity
          key={character.id}
          style={[
            styles.characterItem,
            selectedCharacterId === character.id && styles.selectedItem
          ]}
          onPress={() => onSelectCharacter(character.id)}
        >
          <Image
            source={
              character.avatar
                ? { uri: character.avatar }
                : require('@/assets/images/default-avatar.png')
            }
            style={styles.avatar}
          />
          <Text 
            style={[
              styles.characterName,
              selectedCharacterId === character.id && styles.selectedName
            ]}
            numberOfLines={1}
          >
            {character.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  characterItem: {
    alignItems: 'center',
    marginRight: 12,
    width: 72,
  },
  selectedItem: {
    backgroundColor: 'rgba(255, 224, 195, 0.2)',
    borderRadius: 12,
    padding: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  characterName: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    width: 60,
  },
  selectedName: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginLeft: 8,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
});

export default CharacterSelector;
