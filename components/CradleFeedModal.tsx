import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { Picker } from '@react-native-picker/picker';
import { FeedType } from '@/NodeST/nodest/services/character-generator-service';
import { CradleCharacter } from '@/shared/types';

interface CradleFeedModalProps {
  visible: boolean;
  onClose: () => void;
  characterId?: string; // Optional - if provided, will pre-select this character
}

export default function CradleFeedModal({ visible, onClose, characterId }: CradleFeedModalProps) {
  const { addFeed, getCradleCharacters } = useCharacters();
  const [feedContent, setFeedContent] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | undefined>(characterId);
  const [feedType, setFeedType] = useState<FeedType>(FeedType.ABOUT_ME);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [characters, setCharacters] = useState<CradleCharacter[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load characters data when modal opens
  useEffect(() => {
    if (visible) {
      const cradleCharacters = getCradleCharacters();
      setCharacters(cradleCharacters);
      
      // If characterId is provided, use it; otherwise select first character if available
      if (characterId) {
        setSelectedCharacterId(characterId);
      } else if (cradleCharacters.length > 0 && !selectedCharacterId) {
        setSelectedCharacterId(cradleCharacters[0].id);
      }
      
      // Reset form fields
      setFeedContent('');
      setSubmitting(false);
    }
  }, [visible, getCradleCharacters, characterId]);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleSubmit = async () => {
    if (!feedContent.trim()) {
      Alert.alert('请输入内容', '投喂内容不能为空');
      return;
    }

    if (!selectedCharacterId) {
      Alert.alert('请选择角色', '请选择一个角色进行投喂');
      return;
    }

    try {
      setSubmitting(true);
      await addFeed(selectedCharacterId, feedContent, feedType as any);
      Alert.alert('投喂成功', '数据已成功投喂到摇篮系统');
      setFeedContent('');
      onClose();
    } catch (error) {
      console.error('投喂失败:', error);
      Alert.alert('投喂失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedCharacter = () => {
    return characters.find(c => c.id === selectedCharacterId);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>摇篮系统 - 数据投喂</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
          >
            {/* Selected Character Display Area */}
            {getSelectedCharacter() && (
              <View style={styles.selectedCharacterContainer}>
                <View style={styles.avatarContainer}>
                  {getSelectedCharacter()?.avatar ? (
                    <Image 
                      source={{ uri: getSelectedCharacter()?.avatar || undefined }} 
                      style={styles.avatar} 
                    />
                  ) : (
                    <View style={styles.placeholderAvatar}>
                      <Ionicons name="person" size={30} color="#ccc" />
                    </View>
                  )}
                </View>
                <View style={styles.characterInfo}>
                  <Text style={styles.characterName}>
                    {getSelectedCharacter()?.name || '未命名角色'}
                  </Text>
                  <Text style={styles.characterMeta}>
                    投喂数据: {getSelectedCharacter()?.feedHistory?.length || 0} 条
                  </Text>
                </View>
              </View>
            )}
          
            {/* Only show character selection if no specific character was passed */}
            {!characterId && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>选择角色</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedCharacterId}
                    onValueChange={(itemValue) => setSelectedCharacterId(itemValue)}
                    style={styles.picker}
                    dropdownIconColor="#4A90E2"
                  >
                    {characters.map(character => (
                      <Picker.Item 
                        key={character.id}
                        label={character.name || '未命名角色'} 
                        value={character.id} 
                        color="#fff"
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>投喂类型</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={feedType}
                  onValueChange={(itemValue) => setFeedType(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#4A90E2"
                >
                  <Picker.Item label="关于我" value={FeedType.ABOUT_ME} color="#fff" />
                  <Picker.Item label="素材" value={FeedType.MATERIAL} color="#fff" />
                  <Picker.Item label="知识" value={FeedType.KNOWLEDGE} color="#fff" />
                </Picker>
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>投喂内容</Text>
              <TextInput
                style={styles.textInput}
                multiline={true}
                numberOfLines={8}
                value={feedContent}
                onChangeText={setFeedContent}
                placeholder="输入投喂内容..."
                placeholderTextColor="#888"
                textAlignVertical="top"
              />
            </View>
            
            <TouchableOpacity
              style={[styles.submitButton, !feedContent.trim() && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={submitting || !feedContent.trim() || !selectedCharacterId}
            >
              {submitting ? (
                <Text style={styles.submitButtonText}>投喂中...</Text>
              ) : (
                <Text style={styles.submitButtonText}>投喂到摇篮</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.tipContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#aaa" />
              <Text style={styles.tipText}>
                {feedType === FeedType.ABOUT_ME && "「关于我」类型适合投喂角色的个性、性格、背景故事等内容"}
                {feedType === FeedType.MATERIAL && "「素材」类型适合投喂各种参考资料、文献、小说片段等内容"}
                {feedType === FeedType.KNOWLEDGE && "「知识」类型适合投喂角色需要掌握的专业知识、常识等内容"}
              </Text>
            </View>
            
            {/* Extra space at bottom when keyboard is visible */}
            {keyboardVisible && <View style={{ height: 150 }} />}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#282828',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    minHeight: '70%',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#444',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  picker: {
    height: 50,
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#444',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    height: 150,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#555',
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  tipText: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  selectedCharacterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  placeholderAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterInfo: {
    flex: 1,
  },
  characterName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  characterMeta: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 4,
  },
});
