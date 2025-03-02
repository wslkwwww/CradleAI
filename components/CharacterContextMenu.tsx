import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCharacters } from '@/constants/CharactersContext';
import { Character, CradleCharacter } from '@/shared/types';

interface CharacterContextMenuProps {
  character: Character;
  isVisible: boolean;
  onClose: () => void;
}

const CharacterContextMenu: React.FC<CharacterContextMenuProps> = ({
  character,
  isVisible,
  onClose
}) => {
  const router = useRouter();
  const { getCradleCharacters, importCharacterToCradle, deleteCharacters } = useCharacters();
  
  // 检查角色是否已经在摇篮系统中
  const cradleCharacters: CradleCharacter[] = getCradleCharacters();
  const isInCradle = cradleCharacters.some(
    char => char.importedFromCharacter && char.importedCharacterId === character.id
  );
  
  // 菜单选项
  const menuItems = [
    {
      id: 'view',
      icon: 'eye-outline',
      label: '查看角色',
      onPress: () => {
        onClose();
        router.push({
          pathname: '/Character',
          params: { characterId: character.id }
        });
      }
    },
    {
      id: 'chat',
      icon: 'chatbubble-outline',
      label: '开始聊天',
      onPress: () => {
        onClose();
        router.push({
          pathname: '/(tabs)',
          params: { characterId: character.id }
        });
      }
    },
    {
      id: 'edit',
      icon: 'create-outline',
      label: '编辑角色',
      onPress: () => {
        onClose();
        router.push({
          pathname: '/pages/character-detail',
          params: { characterId: character.id }
        });
      }
    },
    // 如果角色不在摇篮系统中，显示导入选项
    ...(!isInCradle ? [{
      id: 'import-to-cradle',
      icon: 'leaf-outline',
      label: '导入到摇篮系统',
      onPress: async () => {
        onClose();
        try {
          await importCharacterToCradle(character.id);
          router.push('/(tabs)/cradle');
        } catch (error) {
          console.error('导入到摇篮失败:', error);
        }
      }
    }] : []),
    // 如果角色在摇篮系统中，显示查看培育状态选项
    ...(isInCradle ? [{
      id: 'view-cradle',
      icon: 'leaf',
      label: '查看培育状态',
      onPress: () => {
        onClose();
        router.push('/(tabs)/cradle');
      }
    }] : []),
    {
      id: 'delete',
      icon: 'trash-outline',
      label: '删除角色',
      onPress: () => {
        onClose();
        deleteCharacters([character.id]);
      },
      danger: true
    }
  ];

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>角色选项</Text>
          </View>
          
          <FlatList
            data={menuItems}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <Ionicons 
                  name={item.icon as any} 
                  size={20} 
                  color={item.danger ? '#FF5252' : '#fff'} 
                />
                <Text style={[
                  styles.menuItemText,
                  item.danger && styles.dangerText
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#fff',
  },
  dangerText: {
    color: '#FF5252',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default CharacterContextMenu;
