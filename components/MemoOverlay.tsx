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
  Dimensions,
  FlatList,
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
  
  useEffect(() => {
    if (isVisible) {
      loadMemos();
    }
  }, [isVisible]);
  
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
  
  const renderMemoItem = ({ item }: { item: Memo }) => (
    <View style={styles.memoItem}>
      <Text style={styles.memoContent} numberOfLines={2}>{item.content}</Text>
      <Text style={styles.memoDate}>{formatDate(item.updatedAt)}</Text>
      <View style={styles.toolActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleEditMemo(item)}>
          <Ionicons name="create-outline" size={22} color="#ccc" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteMemo(item.id)}>
          <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  return (
    <Modal
      transparent
      visible={isVisible}
      onRequestClose={onClose}
      animationType="slide"
    >
      <View style={styles.container}>
        <BlurView intensity={30} tint="dark" style={styles.blurView}>
          <View style={styles.header}>
            <Text style={styles.title}>备忘录</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {isEditing ? (
            <ScrollView style={styles.editorContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>内容</Text>
                <TextInput
                  style={styles.input}
                  value={memoContent}
                  onChangeText={setMemoContent}
                  placeholder="备忘录内容..."
                  placeholderTextColor="#999"
                  multiline
                  autoFocus
                />
              </View>
              
              <View style={styles.buttonGroup}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                  <Text style={styles.buttonText}>取消</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveMemo}>
                  <Text style={styles.buttonText}>保存</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <>
              <FlatList
                data={memos}
                renderItem={renderMemoItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={() => (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>暂无备忘录</Text>
                    <Text style={styles.emptySubtext}>点击下方按钮添加新备忘录</Text>
                  </View>
                )}
              />
              
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddMemo}
              >
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.addButtonText}>添加备忘录</Text>
              </TouchableOpacity>
            </>
          )}
        </BlurView>
      </View>
    </Modal>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  blurView: {
    width: '90%',
    height: height * 0.75, // 使用屏幕高度的75%
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  listContent: {
    padding: 16,
  },
  memoItem: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'rgb(255, 224, 195)',
  },
  memoContent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  memoDate: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 5,
  },
  toolActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    padding: 6,
    marginLeft: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: 'rgb(255, 224, 195)',
    borderRadius: 10,
    margin: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  editorContainer: {
    padding: 16,
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(70, 70, 70, 0.8)',
    padding: 12,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(100, 100, 100, 0.8)',
    borderRadius: 10,
    marginRight: 10,
  },
  saveButton: {
    flex: 2,
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgb(255, 224, 195)',
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default MemoOverlay;
