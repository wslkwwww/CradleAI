import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character, CirclePost, Message } from '@/shared/types';
import { useUser } from '@/constants/UserContext';
import { useRouter } from 'expo-router';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { useCharacters } from '@/constants/CharactersContext';

interface ForwardSheetProps {
  isVisible: boolean;
  onClose: () => void;
  characters: Character[];
  post: CirclePost;
  onForward: (characterId: string, additionalMessage: string) => void;
}

const ForwardSheet: React.FC<ForwardSheetProps> = ({
  isVisible,
  onClose,
  characters,
  post,
  onForward,
}) => {
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const { user } = useUser();
  const { addMessage } = useCharacters();
  const router = useRouter();
  
  // 过滤可转发的角色
  const filteredCharacters = characters.filter(character => {
    if (!searchQuery) return true;
    return character.name.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  // 处理转发动作，并添加处理聊天响应的逻辑
  const handleForward = async () => {
    if (!selectedCharacter) return;
    
    try {
      setIsForwarding(true);
      
      // 构建转发消息
      const forwardMessage = `${additionalMessage ? additionalMessage + '\n\n' : ''}转发自 ${post.characterName} 的朋友圈：\n${post.content}`;
      
      // 创建用户消息并添加到聊天记录
      const userMessage: Message = {
        id: `user-msg-${Date.now()}`,
        text: forwardMessage,
        sender: 'user',
        timestamp: Date.now(),
      };
      
      // 先添加用户消息
      await addMessage(selectedCharacter.id, userMessage);
      
      // 使用onForward回调
      await onForward(selectedCharacter.id, additionalMessage);
      
      // 添加临时的加载消息
      const loadingMessage: Message = {
        id: `loading-${Date.now()}`,
        text: '',
        sender: 'bot',
        timestamp: Date.now(),
        isLoading: true
      };
      
      await addMessage(selectedCharacter.id, loadingMessage);
      
      // 直接使用NodeSTManager处理聊天响应
      const response = await NodeSTManager.processChatMessage({
        userMessage: forwardMessage,
        conversationId: selectedCharacter.id,
        status: "同一角色继续对话",
        apiKey: user?.settings?.chat.characterApiKey || '',
        apiSettings: {
          apiProvider: user?.settings?.chat.apiProvider || 'gemini',
          openrouter: user?.settings?.chat.openrouter
        },
        character: selectedCharacter
      });
      
      // 添加AI回复消息
      if (response && response.success && response.text) {
        const botMessage: Message = {
          id: `bot-msg-${Date.now()}`,
          text: response.text,
          sender: 'bot',
          timestamp: Date.now(),
        };
        
        await addMessage(selectedCharacter.id, botMessage);
      } else {
        // 处理错误情况
        Alert.alert('转发失败', '无法获取角色回复');
      }
      
      // 转发完成，关闭对话框
      onClose();
      
      // 导航到聊天页面
      router.push({
        pathname: '/(tabs)',
        params: { id: selectedCharacter.id }
      });
      
    } catch (error) {
      console.error('Error forwarding post:', error);
      Alert.alert('转发失败', '处理消息时出现错误');
    } finally {
      setIsForwarding(false);
    }
  };

  // 当弹窗关闭时重置状态
  useEffect(() => {
    if (!isVisible) {
      setAdditionalMessage('');
      setSearchQuery('');
      setSelectedCharacter(null);
    }
  }, [isVisible]);

  const renderCharacterItem = ({ item }: { item: Character }) => (
    <TouchableOpacity
      style={[
        styles.characterItem,
        selectedCharacter?.id === item.id && styles.selectedCharacterItem
      ]}
      onPress={() => setSelectedCharacter(item)}
    >
      <Image
        source={item.avatar ? { uri: item.avatar } : require('@/assets/images/default-avatar.png')}
        style={styles.characterAvatar}
      />
      <Text style={styles.characterName}>{item.name}</Text>
      {selectedCharacter?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#FF9ECD" style={styles.checkIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>转发</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.postPreview}>
            <View style={styles.postHeader}>
              <Image
                source={post.characterAvatar ? { uri: post.characterAvatar } : require('@/assets/images/default-avatar.png')}
                style={styles.postAvatar}
              />
              <Text style={styles.postAuthor}>{post.characterName}</Text>
            </View>
            <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
          </View>

          <TextInput
            style={styles.additionalInput}
            placeholder="添加评论..."
            placeholderTextColor="#999"
            multiline
            value={additionalMessage}
            onChangeText={setAdditionalMessage}
          />
          
          <TextInput
            style={styles.searchInput}
            placeholder="搜索角色..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          <Text style={styles.sectionTitle}>选择角色</Text>
          
          <FlatList
            data={filteredCharacters}
            renderItem={renderCharacterItem}
            keyExtractor={item => item.id}
            style={styles.characterList}
          />
          
          <TouchableOpacity
            style={[
              styles.forwardButton,
              (!selectedCharacter || isForwarding) && styles.disabledButton
            ]}
            onPress={handleForward}
            disabled={!selectedCharacter || isForwarding}
          >
            {isForwarding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.forwardButtonText}>转发</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#282828',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    height: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#393939',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  postPreview: {
    backgroundColor: '#333',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  postAuthor: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  postContent: {
    color: '#DDD',
    fontSize: 14,
  },
  additionalInput: {
    backgroundColor: '#333',
    color: '#FFF',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  searchInput: {
    backgroundColor: '#333',
    color: '#FFF',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  characterList: {
    flex: 1,
  },
  characterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#393939',
  },
  selectedCharacterItem: {
    backgroundColor: 'rgba(255, 158, 205, 0.1)',
  },
  characterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  characterName: {
    color: '#FFF',
    fontSize: 16,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 8,
  },
  forwardButton: {
    backgroundColor: '#FF9ECD',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  forwardButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ForwardSheet;