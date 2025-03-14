import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { theme } from '@/constants/theme';
import CharacterSelectModal from '@/components/CharacterSelectModal';
import CharacterEditDialog from './CharacterEditDialog'; // 导入角色编辑对话框
import { useCharacters } from '@/constants/CharactersContext';

interface CharacterCardProps {
  character: Character;
  onLongPress?: (character: Character) => void;
  onPress?: (characterId: string) => void;
  isSelected?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width * 0.45, 180);

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onLongPress,
  onPress,
  isSelected = false,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false); // 添加显示编辑对话框状态
  const { updateCharacter } = useCharacters(); // 从上下文获取更新角色的函数
  
  // 处理更新角色
  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    try {
      await updateCharacter(updatedCharacter);
    } catch (error) {
      console.error('更新角色失败:', error);
    }
  };
  
  const handlePress = () => {
    if (onPress) {
      onPress(character.id);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.card, isSelected && styles.selectedCard]}
        onLongPress={() => onLongPress && onLongPress(character)}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {character.avatar ? (
            <Image 
              source={{ uri: character.avatar }} 
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <MaterialCommunityIcons name="account" size={40} color="#666" />
            </View>
          )}
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.name} numberOfLines={2}>
            {character.name}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {character.description?.substring(0, 30) || "无描述"}
          </Text>
          
          {/* 选项按钮 */}
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => setShowOptions(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
          </TouchableOpacity>
          
          {/* 添加对话式编辑按钮 */}
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setShowEditDialog(true)}
          >
            <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      
      {/* 选项模态框 */}
      <CharacterSelectModal
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        character={character}
      />
      
      {/* 角色编辑对话框 */}
      <CharacterEditDialog 
        isVisible={showEditDialog}
        character={character}
        onClose={() => setShowEditDialog(false)}
        onUpdateCharacter={handleUpdateCharacter}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: 220,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  imageContainer: {
    height: 140,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    padding: 8,
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  optionsButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    padding: 5,
  },
  // 编辑按钮样式
  editButton: {
    position: 'absolute',
    bottom: 5,
    right: 30, // 位于选项按钮左侧
    padding: 5,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default CharacterCard;
