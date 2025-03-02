import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { Character,} from '@/shared/types';

interface ImportToCradleModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const ImportToCradleModal: React.FC<ImportToCradleModalProps> = ({
  visible,
  onClose,
  onImportSuccess
}) => {
  const { characters, getCradleCharacters, importCharacterToCradle } = useCharacters();
  const [loading, setLoading] = useState(false);
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);

  // 加载角色列表，过滤掉已经在摇篮系统中的角色
  useEffect(() => {
    if (visible) {
      const loadAvailableCharacters = () => {
        try {
          // 获取摇篮系统中的角色
          const cradleChars = getCradleCharacters();
          
          // 获取已经导入到摇篮系统的角色ID
          const importedCharacterIds = cradleChars
            .filter(char => char.importedFromCharacter)
            .map(char => char.importedCharacterId);
          
          // 过滤掉已在摇篮系统中的角色
          const available = characters.filter(char => 
            !importedCharacterIds.includes(char.id)
          );
          
          setAvailableCharacters(available);
        } catch (error) {
          console.error('[摇篮导入] 加载可用角色失败:', error);
          Alert.alert('错误', '加载角色列表失败');
        }
      };
      
      loadAvailableCharacters();
    }
  }, [visible, characters, getCradleCharacters]);

  // 导入角色到摇篮系统
  const handleImport = async (characterId: string) => {
    setLoading(true);
    try {
      await importCharacterToCradle(characterId);
      Alert.alert(
        '导入成功', 
        '角色已成功导入到摇篮系统，可以开始投喂数据进行培育',
        [{ text: '确定', onPress: () => {
          onImportSuccess();
          onClose();
        }}]
      );
    } catch (error) {
      console.error('[摇篮导入] 导入角色失败:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '导入失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染角色项
  const renderCharacterItem = ({ item }: { item: Character }) => (
    <TouchableOpacity 
      style={styles.characterItem}
      onPress={() => handleImport(item.id)}
      disabled={loading}
    >
      <Image 
        source={item.avatar ? { uri: item.avatar } : require('@/assets/images/default-avatar.png')} 
        style={styles.avatar} 
      />
      <View style={styles.characterInfo}>
        <Text style={styles.characterName}>{item.name}</Text>
        <Text style={styles.characterDesc} numberOfLines={2}>
          {item.description || '没有描述'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#aaa" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>导入现有角色</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>导入中...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.infoText}>
                选择一个角色导入到摇篮系统进行培育
              </Text>
              
              {availableCharacters.length > 0 ? (
                <FlatList
                  data={availableCharacters}
                  renderItem={renderCharacterItem}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listContainer}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="alert-circle-outline" size={48} color="#aaa" />
                  <Text style={styles.emptyText}>没有可导入的角色</Text>
                  <Text style={styles.emptySubtext}>所有角色都已在摇篮系统中或无可用角色</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#282828',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  infoText: {
    color: '#ccc',
    fontSize: 14,
    padding: 16,
    textAlign: 'center',
  },
  listContainer: {
    padding: 12,
  },
  characterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  characterInfo: {
    flex: 1,
  },
  characterName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  characterDesc: {
    color: '#aaa',
    fontSize: 13,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ImportToCradleModal;
