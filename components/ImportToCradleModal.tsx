import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { Character } from '@/shared/types';

interface ImportToCradleModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function ImportToCradleModal({ visible, onClose, onImportSuccess }: ImportToCradleModalProps) {
  const { characters, getCradleCharacters, importCharacterToCradle } = useCharacters();
  
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // Filter out characters that are already in cradle system
  useEffect(() => {
    if (visible) {
      loadAvailableCharacters();
    }
  }, [visible, characters]);
  
  const loadAvailableCharacters = () => {
    try {
      const cradleChars = getCradleCharacters();
      // Get IDs of characters already in cradle system
      const cradleCharIds = cradleChars
        .filter(c => c.importedFromCharacter)
        .map(c => c.importedCharacterId);
      
      // Filter out characters already in cradle
      const available = characters.filter(char => 
        !cradleCharIds.includes(char.id)
      );
      
      setAvailableCharacters(available);
    } catch (error) {
      console.error("Error loading available characters:", error);
    }
  };
  
  const handleImport = async () => {
    if (!selectedCharacterId) return;
    
    setIsImporting(true);
    setImportError(null);
    
    try {
      await importCharacterToCradle(selectedCharacterId);
      onImportSuccess();
      onClose();
    } catch (error) {
      console.error("Import failed:", error);
      setImportError(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>导入角色到摇篮</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {availableCharacters.length > 0 ? (
            <>
              <Text style={styles.description}>
                选择要导入到摇篮系统的角色。导入后，您可以通过投喂数据来增强角色特性。
              </Text>
              
              <FlatList
                data={availableCharacters}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.characterItem,
                      selectedCharacterId === item.id && styles.selectedCharacter
                    ]}
                    onPress={() => setSelectedCharacterId(item.id)}
                  >
                    <View style={styles.characterAvatar}>
                      {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.placeholderAvatar}>
                          <Ionicons name="person" size={24} color="#ccc" />
                        </View>
                      )}
                    </View>
                    <View style={styles.characterInfo}>
                      <Text style={styles.characterName}>{item.name}</Text>
                      <Text style={styles.characterDescription} numberOfLines={2}>
                        {item.description || "无描述"}
                      </Text>
                    </View>
                    <View style={styles.radioButton}>
                      {selectedCharacterId === item.id && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
              
              {importError && (
                <Text style={styles.errorText}>{importError}</Text>
              )}
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.importButton,
                    (!selectedCharacterId || isImporting) && styles.disabledButton
                  ]}
                  onPress={handleImport}
                  disabled={!selectedCharacterId || isImporting}
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.importButtonText}>导入</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="information-circle-outline" size={48} color="#888" />
              <Text style={styles.emptyText}>没有可导入的角色</Text>
              <Text style={styles.emptySubText}>
                所有角色都已在摇篮系统中，或者您还没有创建任何角色。
              </Text>
              <TouchableOpacity
                style={styles.closeButtonFull}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modal: {
    backgroundColor: '#282828',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  description: {
    color: '#ccc',
    marginBottom: 16,
    lineHeight: 20,
  },
  characterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  selectedCharacter: {
    borderColor: '#4A90E2',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  characterAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
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
  characterDescription: {
    color: '#aaa',
    fontSize: 14,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90E2',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#aaa',
    fontWeight: 'bold',
  },
  importButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  importButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.7,
  },
  errorText: {
    color: '#ff6b6b',
    marginVertical: 10,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButtonFull: {
    backgroundColor: '#555',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
