import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  Dimensions,
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { theme } from '@/constants/theme';
import { useCharacters } from '@/constants/CharactersContext';
import { useRouter } from 'expo-router';

interface CharacterSelectModalProps {
  visible: boolean;
  onClose: () => void;
  character: Character;
}

const CharacterSelectModal: React.FC<CharacterSelectModalProps> = ({ 
  visible, 
  onClose, 
  character 
}) => {
  const { deleteCharacters, importCharacterToCradle } = useCharacters();
  const router = useRouter();
  
  // 处理删除角色
  const handleDeleteCharacter = () => {
    Alert.alert(
      '删除角色',
      `确定要删除角色 "${character.name}" 吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCharacters([character.id]);
              onClose();
            } catch (error) {
              console.error('删除角色失败:', error);
              Alert.alert('错误', '删除角色失败');
            }
          }
        }
      ]
    );
  };
  
  // 处理编辑角色
  const handleEditCharacter = () => {
    onClose();
    router.push(`../pages/edit_character?id=${character.id}`);
  };
  
  // 处理聊天
  const handleChat = () => {
    onClose();
    router.push(`/?characterId=${character.id}`);
  };
  
  // 处理查看详情
  const handleViewDetails = () => {
    onClose();
    router.push(`/character-detail?id=${character.id}`);
  };
  
  // 处理导入到摇篮系统
  const handleImportToCradle = async () => {
    try {
      // 检查角色是否已经在摇篮系统中
      if (character.inCradleSystem) {
        Alert.alert('提示', '该角色已在摇篮系统中');
        return;
      }
      
      // 确认导入
      Alert.alert(
        '导入到摇篮系统',
        `确定要将角色 "${character.name}" 导入到摇篮系统吗？`,
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '导入', 
            onPress: async () => {
              try {
                await importCharacterToCradle(character.id);
                onClose();
                Alert.alert('成功', `角色 "${character.name}" 已成功导入到摇篮系统`);
              } catch (error) {
                console.error('导入角色到摇篮系统失败:', error);
                Alert.alert('错误', '导入角色到摇篮系统失败');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('处理导入到摇篮系统失败:', error);
      Alert.alert('错误', '处理导入到摇篮系统失败');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>角色选项</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            {/* 角色信息 */}
            <View style={styles.characterInfoContainer}>
              <Text style={styles.characterName}>{character.name}</Text>
              <Text style={styles.characterDescription} numberOfLines={2}>
                {character.description || "无描述"}
              </Text>
            </View>
            
            <ScrollView style={styles.optionsContainer}>
              {/* 聊天选项 */}
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={handleChat}
              >
                <Ionicons name="chatbubble-outline" size={24} color="#fff" style={styles.optionIcon} />
                <Text style={styles.optionText}>开始聊天</Text>
              </TouchableOpacity>
              
              {/* 编辑选项 */}
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={handleEditCharacter}
              >
                <Ionicons name="create-outline" size={24} color="#fff" style={styles.optionIcon} />
                <Text style={styles.optionText}>编辑角色</Text>
              </TouchableOpacity>
              
              {/* 查看详情选项 */}
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={handleViewDetails}
              >
                <Ionicons name="information-circle-outline" size={24} color="#fff" style={styles.optionIcon} />
                <Text style={styles.optionText}>查看详情</Text>
              </TouchableOpacity>
              
              {/* 导入到摇篮系统选项 */}
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={handleImportToCradle}
              >
                <Ionicons name="egg-outline" size={24} color="#fff" style={styles.optionIcon} />
                <Text style={styles.optionText}>导入到摇篮系统</Text>
              </TouchableOpacity>
              
              {/* 删除选项 */}
              <TouchableOpacity 
                style={[styles.optionItem, styles.deleteOption]}
                onPress={handleDeleteCharacter}
              >
                <Ionicons name="trash-outline" size={24} color="#ff4d4d" style={styles.optionIcon} />
                <Text style={[styles.optionText, styles.deleteText]}>删除角色</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 0,
  },
  characterInfoContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  characterName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  characterDescription: {
    color: '#ccc',
    fontSize: 14,
  },
  optionsContainer: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  optionIcon: {
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#fff',
  },
  deleteOption: {
    backgroundColor: 'rgba(255,77,77,0.1)',
  },
  deleteText: {
    color: '#ff4d4d',
  },
});

export default CharacterSelectModal;
