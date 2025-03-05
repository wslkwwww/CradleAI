import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MemoOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

interface Memo {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

const MemoOverlay: React.FC<MemoOverlayProps> = ({ isVisible, onClose }) => {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [currentMemo, setCurrentMemo] = useState<Memo | null>(null);
  const [memoContent, setMemoContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  
  useEffect(() => {
    if (isVisible) {
      loadMemos();
      fadeIn();
      Keyboard.dismiss();
    } else {
      fadeOut();
    }
  }, [isVisible]);
  
  const fadeIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const fadeOut = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const loadMemos = async () => {
    try {
      const memosData = await AsyncStorage.getItem('memos');
      if (memosData) {
        const parsedMemos = JSON.parse(memosData) as Memo[];
        setMemos(parsedMemos.sort((a, b) => b.updatedAt - a.updatedAt));
      }
    } catch (error) {
      console.error('Failed to load memos:', error);
      Alert.alert('错误', '加载备忘录失败');
    }
  };
  
  const saveMemos = async (updatedMemos: Memo[]) => {
    try {
      await AsyncStorage.setItem('memos', JSON.stringify(updatedMemos));
    } catch (error) {
      console.error('Failed to save memos:', error);
      Alert.alert('错误', '保存备忘录失败');
    }
  };
  
  const handleAddMemo = () => {
    const newMemo: Memo = {
      id: Date.now().toString(),
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setCurrentMemo(newMemo);
    setMemoContent('');
    setIsEditing(true);
  };
  
  const handleEditMemo = (memo: Memo) => {
    setCurrentMemo(memo);
    setMemoContent(memo.content);
    setIsEditing(true);
  };
  
  const handleSaveMemo = async () => {
    if (!currentMemo) return;
    
    const trimmedContent = memoContent.trim();
    if (!trimmedContent) {
      Alert.alert('提示', '备忘录内容不能为空');
      return;
    }
    
    const updatedMemo: Memo = {
      ...currentMemo,
      content: trimmedContent,
      updatedAt: Date.now(),
    };
    
    const isNewMemo = !memos.some(m => m.id === currentMemo.id);
    const updatedMemos = isNewMemo
      ? [updatedMemo, ...memos]
      : memos.map(m => (m.id === currentMemo.id ? updatedMemo : m));
    
    setMemos(updatedMemos.sort((a, b) => b.updatedAt - a.updatedAt));
    await saveMemos(updatedMemos);
    
    setCurrentMemo(null);
    setMemoContent('');
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setCurrentMemo(null);
    setMemoContent('');
    setIsEditing(false);
  };
  
  const handleDeleteMemo = async (memoId: string) => {
    Alert.alert(
      '删除备忘录',
      '确定要删除这条备忘录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            const updatedMemos = memos.filter(m => m.id !== memoId);
            setMemos(updatedMemos);
            await saveMemos(updatedMemos);
            
            if (currentMemo?.id === memoId) {
              setCurrentMemo(null);
              setMemoContent('');
              setIsEditing(false);
            }
          },
        },
      ]
    );
  };
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  if (!isVisible) return null;
  
  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={isVisible}
      onRequestClose={onClose}
      animationType="none"
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.contentContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <BlurView intensity={15} tint="dark" style={styles.blurContainer}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <View style={styles.header}>
                <Text style={styles.title}>备忘录</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {isEditing ? (
                <View style={styles.editorContainer}>
                  <TextInput
                    style={styles.editor}
                    value={memoContent}
                    onChangeText={setMemoContent}
                    placeholder="输入备忘录内容..."
                    placeholderTextColor="#777"
                    multiline
                    autoFocus
                  />
                  
                  <View style={styles.editorButtons}>
                    <TouchableOpacity
                      style={[styles.editorButton, styles.cancelButton]}
                      onPress={handleCancelEdit}
                    >
                      <Text style={styles.editorButtonText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editorButton, styles.saveButton]}
                      onPress={handleSaveMemo}
                    >
                      <Text style={styles.editorButtonText}>保存</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <ScrollView style={styles.memoList}>
                  {memos.map(memo => (
                    <TouchableOpacity
                      key={memo.id}
                      style={styles.memoItem}
                      onPress={() => handleEditMemo(memo)}
                    >
                      <Text style={styles.memoContent}>{memo.content}</Text>
                      <Text style={styles.memoDate}>{formatDate(memo.updatedAt)}</Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteMemo(memo.id)}
                      >
                        <Ionicons name="trash" size={24} color="#FF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          </BlurView>
        </Animated.View>
      </Animated.View>
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
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  contentContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 15,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  editorContainer: {
    flex: 1,
  },
  editor: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editorButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  editorButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#FF4444',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  editorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memoList: {
    flex: 1,
  },
  memoItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  memoContent: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  memoDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
});

export default MemoOverlay;
