import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { CradleCharacter } from '@/shared/types';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface CradleFeedModalProps {
  visible: boolean;
  onClose: () => void;
}

const CradleFeedModal: React.FC<CradleFeedModalProps> = ({ visible, onClose }) => {
  const { 
    getCradleCharacters,
    addCradleCharacter,
    updateCradleCharacter,
    addFeed,
    getCradleSettings
  } = useCharacters();
  
  const [feedText, setFeedText] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CradleCharacter[]>([]);
  const [isCreatingNewCharacter, setIsCreatingNewCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedHistory, setShowFeedHistory] = useState(false);
  
  const cradleSettings = getCradleSettings();

  // 加载角色列表
  useEffect(() => {
    if (visible) {
      loadCharacters();
    }
  }, [visible]);

  // 加载角色
  const loadCharacters = () => {
    const chars = getCradleCharacters();
    console.log('[摇篮系统] 加载到摇篮角色:', chars.length);
    setCharacters(chars);
    
    // 如果有角色，默认选中第一个
    if (chars.length > 0 && !selectedCharacterId) {
      setSelectedCharacterId(chars[0].id);
    }
  };

  // 投喂内容
  const handleFeed = async () => {
    if (!feedText.trim()) {
      Alert.alert('错误', '投喂内容不能为空');
      return;
    }

    // 如果在创建新角色模式
    if (isCreatingNewCharacter) {
      if (!newCharacterName.trim()) {
        Alert.alert('错误', '角色名称不能为空');
        return;
      }

      try {
        setIsLoading(true);
        // 创建新摇篮角色
        const newCharacter: CradleCharacter = {
          // Character base properties
          id: Date.now().toString(),
          name: newCharacterName.trim(),
          avatar: null,
          backgroundImage: null,
          description: '',
          personality: '',
          interests: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          
          // Cradle specific properties
          inCradleSystem: true,
          feedHistory: [],
          isCradleGenerated: true
        };
        
        await addCradleCharacter(newCharacter);
        
        // 添加投喂内容
        await addFeed(newCharacter.id, feedText.trim());
        
        // 重置表单并更新角色列表
        setNewCharacterName('');
        setFeedText('');
        setIsCreatingNewCharacter(false);
        loadCharacters();
        setSelectedCharacterId(newCharacter.id);
        
        Alert.alert('成功', '成功创建角色并投喂数据');
      } catch (error) {
        console.error('[摇篮系统] 创建角色失败:', error);
        Alert.alert('错误', '创建角色失败');
      } finally {
        setIsLoading(false);
      }
    } 
    // 向现有角色投喂
    else if (selectedCharacterId) {
      try {
        setIsLoading(true);
        await addFeed(selectedCharacterId, feedText.trim());
        setFeedText('');
        loadCharacters(); // 刷新列表
        Alert.alert('成功', '成功投喂数据');
      } catch (error) {
        console.error('[摇篮系统] 投喂失败:', error);
        Alert.alert('错误', '投喂失败');
      } finally {
        setIsLoading(false);
      }
    } else {
      Alert.alert('错误', '请先选择一个角色或创建新角色');
    }
  };

  // 选择图片投喂
  const handleImageFeed = async () => {
    if (!selectedCharacterId && !isCreatingNewCharacter) {
      Alert.alert('错误', '请先选择一个角色或创建新角色');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // 如果在创建新角色模式
        if (isCreatingNewCharacter) {
          if (!newCharacterName.trim()) {
            Alert.alert('错误', '角色名称不能为空');
            return;
          }

          try {
            setIsLoading(true);
            
            // 将图片压缩和处理为方形头像
            const manipResult = await ImageManipulator.manipulateAsync(
              result.assets[0].uri,
              [{ resize: { width: 400, height: 400 } }],
              { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
            );
            
            // 创建新摇篮角色，将图片作为头像
            const newCharacter: CradleCharacter = {
              id: Date.now().toString(),
              name: newCharacterName.trim(),
              createdAt: Date.now(),
              isCradleGenerated: true,
              avatar: manipResult.uri,
              backgroundImage: null, // Add missing field
              feedHistory: [],
              // 基本字段初始化
              personality: '',
              description: '',
              interests: [],
              updatedAt: Date.now(),
              inCradleSystem: true,
            };
            
            await addCradleCharacter(newCharacter);
            
            // 添加图片描述内容
            await addFeed(newCharacter.id, "图片投喂", 'image');
            
            // 重置表单并更新角色列表
            setNewCharacterName('');
            setIsCreatingNewCharacter(false);
            loadCharacters();
            setSelectedCharacterId(newCharacter.id);
            
            Alert.alert('成功', '成功创建角色并投喂图片');
          } catch (error) {
            console.error('[摇篮系统] 创建角色失败:', error);
            Alert.alert('错误', '创建角色失败');
          } finally {
            setIsLoading(false);
          }
        }
        // 向现有角色投喂图片
        else if (selectedCharacterId) {
          setIsLoading(true);
          
          try {
            // 添加图片描述投喂
            await addFeed(selectedCharacterId, "图片投喂", 'image');
            
            // 更新角色的头像（如果角色没有头像）
            const character = characters.find(c => c.id === selectedCharacterId);
            if (character && !character.avatar) {
              // 将图片压缩和处理为方形头像
              const manipResult = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 400, height: 400 } }],
                { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
              );
              
              const updatedCharacter = {
                ...character,
                avatar: manipResult.uri
              };
              
              await updateCradleCharacter(updatedCharacter);
            }
            
            loadCharacters(); // 刷新列表
            Alert.alert('成功', '成功投喂图片');
          } catch (error) {
            console.error('[摇篮系统] 图片投喂失败:', error);
            Alert.alert('错误', '图片投喂失败');
          } finally {
            setIsLoading(false);
          }
        }
      }
    } catch (error) {
      console.error('[摇篮系统] 选择图片失败:', error);
      Alert.alert('错误', '选择图片失败');
    }
  };

  // 渲染摇篮角色列表
  const renderCharacterList = () => {
    if (characters.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>尚未创建摇篮角色</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setIsCreatingNewCharacter(true)}
          >
            <Text style={styles.createButtonText}>创建新角色</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.characterList}
      >
        {characters.map(character => (
          <TouchableOpacity 
            key={character.id}
            style={[
              styles.characterItem,
              selectedCharacterId === character.id && styles.selectedCharacter
            ]}
            onPress={() => {
              setSelectedCharacterId(character.id);
              setIsCreatingNewCharacter(false);
            }}
          >
            <View style={styles.characterAvatar}>
              {character.avatar ? (
                <View style={styles.avatarContainer}>
                  <Ionicons name="person" size={20} color="#FFF" />
                </View>
              ) : (
                <Ionicons name="person-outline" size={24} color="#FFF" />
              )}
            </View>
            <Text style={styles.characterName} numberOfLines={1}>{character.name}</Text>
            <Text style={styles.feedCount}>
              {character.feedHistory?.length || 0} 条投喂
            </Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity 
          style={[
            styles.characterItem,
            styles.newCharacterButton,
            isCreatingNewCharacter && styles.selectedCharacter
          ]}
          onPress={() => {
            setIsCreatingNewCharacter(true);
            setSelectedCharacterId(null);
          }}
        >
          <View style={[styles.characterAvatar, styles.newCharacterAvatar]}>
            <Ionicons name="add" size={24} color="#FFF" />
          </View>
          <Text style={styles.characterName}>新角色</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // 渲染投喂历史
  const renderFeedHistory = () => {
    if (!selectedCharacterId) return null;
    
    const character = characters.find(c => c.id === selectedCharacterId);
    if (!character || !character.feedHistory || character.feedHistory.length === 0) {
      return (
        <View style={styles.emptyFeedHistory}>
          <Text style={styles.emptyFeedText}>暂无投喂历史</Text>
        </View>
      );
    }
    
    return (
      <ScrollView style={styles.feedHistoryContainer}>
        {character.feedHistory.map(feed => (
          <View 
            key={feed.id} 
            style={[
              styles.feedItem,
              feed.processed && styles.processedFeed
            ]}
          >
            <View style={styles.feedHeader}>
              <Text style={styles.feedType}>
                {feed.type === 'image' ? '图片' : '文字'}
              </Text>
              <Text style={styles.feedTime}>
                {new Date(feed.timestamp).toLocaleString()}
              </Text>
              {feed.processed && (
                <View style={styles.processedBadge}>
                  <Text style={styles.processedText}>已处理</Text>
                </View>
              )}
            </View>
            <Text style={styles.feedContent}>
              {feed.content}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  // 计算进度和状态
  const calculateProgress = () => {
    if (!cradleSettings.enabled || !cradleSettings.startDate) {
      return { progress: 0, status: '未开始培育' };
    }
    
    const startDate = new Date(cradleSettings.startDate);
    const currentDate = new Date();
    const elapsedDays = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const totalDuration = cradleSettings.duration || 7;
    
    const progress = Math.min(Math.round((elapsedDays / totalDuration) * 100), 100);
    const remainingDays = Math.max(0, totalDuration - elapsedDays);
    
    let status = `培育中: 还需 ${remainingDays.toFixed(1)} 天`;
    if (progress >= 100) {
      status = '培育完成，可以孵化';
    }
    
    return { progress, status };
  };

  const { progress, status } = calculateProgress();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>摇篮投喂</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.historyButton} 
              onPress={() => setShowFeedHistory(!showFeedHistory)}
            >
              <Ionicons 
                name={showFeedHistory ? "list" : "time-outline"} 
                size={22} 
                color="#FFF" 
              />
            </TouchableOpacity>
          </View>
          
          {/* 培育进度 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar,
                  { width: `${progress}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              培育进度: {progress}% | {status}
            </Text>
          </View>

          {/* 角色选择区域 */}
          {renderCharacterList()}
          
          {/* 投喂历史 */}
          {showFeedHistory ? (
            <View style={styles.feedHistorySection}>
              <Text style={styles.sectionTitle}>投喂历史</Text>
              {renderFeedHistory()}
            </View>
          ) : (
            <>
              {/* 新角色创建区域 */}
              {isCreatingNewCharacter && (
                <View style={styles.newCharacterForm}>
                  <Text style={styles.formLabel}>角色名称</Text>
                  <TextInput
                    style={styles.nameInput}
                    value={newCharacterName}
                    onChangeText={setNewCharacterName}
                    placeholder="输入角色名称..."
                    placeholderTextColor="#aaa"
                  />
                </View>
              )}
              
              {/* 投喂区域 */}
              <View style={styles.feedSection}>
                <Text style={styles.sectionTitle}>
                  {isCreatingNewCharacter ? '创建并投喂' : '投喂内容'}
                </Text>
                <TextInput
                  style={styles.feedInput}
                  value={feedText}
                  onChangeText={setFeedText}
                  placeholder="输入投喂内容..."
                  placeholderTextColor="#aaa"
                  multiline
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={styles.imageButton}
                    onPress={handleImageFeed}
                    disabled={isLoading}
                  >
                    <Ionicons name="image" size={20} color="#000" />
                    <Text style={styles.buttonText}>图片</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.feedButton}
                    onPress={handleFeed}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Ionicons name="send" size={20} color="#000" />
                        <Text style={styles.buttonText}>投喂</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  historyButton: {
    position: 'absolute',
    left: 0,
    padding: 8,
  },
  progressContainer: {
    marginVertical: 12,
    padding: 8,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    borderRadius: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4A90E2',
  },
  progressText: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
  },
  characterList: {
    flexGrow: 0,
    marginVertical: 16,
  },
  characterItem: {
    width: 80,
    alignItems: 'center',
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
  },
  selectedCharacter: {
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  characterAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#666',
  },
  characterName: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  feedCount: {
    fontSize: 12,
    color: '#AAA',
    textAlign: 'center',
  },
  newCharacterButton: {
    backgroundColor: 'rgba(80, 80, 80, 0.5)',
  },
  newCharacterAvatar: {
    backgroundColor: 'rgba(74, 144, 226, 0.5)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginVertical: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#AAA',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  newCharacterForm: {
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
  },
  feedSection: {
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  feedInput: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    flex: 1,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DDD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  feedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    marginLeft: 8,
    fontWeight: 'bold',
    color: '#000',
  },
  feedHistorySection: {
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    padding: 12,
    borderRadius: 8,
    flex: 1,
  },
  feedHistoryContainer: {
    flex: 1,
  },
  emptyFeedHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyFeedText: {
    fontSize: 16,
    color: '#AAA',
  },
  feedItem: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  processedFeed: {
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
  },
  feedHeader: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  feedType: {
    fontSize: 12,
    color: '#FFF',
    backgroundColor: '#555',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  feedTime: {
    fontSize: 12,
    color: '#AAA',
    flex: 1,
  },
  processedBadge: {
    backgroundColor: '#4A90E2',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  processedText: {
    fontSize: 10,
    color: '#FFF',
  },
  feedContent: {
    fontSize: 14,
    color: '#FFF',
  },
});

export default CradleFeedModal;
