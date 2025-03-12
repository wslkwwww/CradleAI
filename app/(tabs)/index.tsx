import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  Keyboard,
  ImageBackground,
  StatusBar,
  TouchableOpacity,
  Text,
} from 'react-native';

import ChatDialog from '@/components/ChatDialog';
import ChatInput from '@/components/ChatInput';
import Sidebar from '@/components/Sidebar';
import SettingsSidebar from '@/components/SettingsSidebar';
import MemoOverlay from '@/components/MemoOverlay';  // 替换原来的 MemoSheet 导入
import NovelAITestModal from '@/components/NovelAITestModal'; // 导入 NovelAI 测试组件
import VNDBTestModal from '@/src/components/VNDBTestModal'; // 导入 VNDB 测试组件
import { Message, Character } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBarWithBackground from '@/components/TopBarWithBackground';

const App = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const characterId = params.characterId as string;

  // 简化状态管理，只保留必要的状态
  const {
    conversations,
    characters,
    getMessages,
    addMessage,
    clearMessages,  // Add this
  } = useCharacters();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);


  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isSettingsSidebarVisible, setIsSettingsSidebarVisible] = useState(false);
  const [isMemoSheetVisible, setIsMemoSheetVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // 新增 NovelAI 测试模态框状态
  const [isNovelAITestVisible, setIsNovelAITestVisible] = useState(false);

  // 新增 VNDB 测试模态框状态
  const [isVNDBTestVisible, setIsVNDBTestVisible] = useState(false);

  // 添加一个跟踪处理过的图片URL的集合
  const [processedImageUrls, setProcessedImageUrls] = useState<Set<string>>(new Set());
  // 添加一个引用来跟踪处理中的任务ID
  const processingTaskIds = useRef<Set<string>>(new Set());

  const toggleSettingsSidebar = () => {
    setIsSettingsSidebarVisible(!isSettingsSidebarVisible);
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const handleSaveMemo = (content: string) => {
    // 这里可以添加保存备忘录的逻辑
    console.log('Saving memo:', content);
    // TODO: 将备忘录保存到本地存储或发送到服务器
  };

  useEffect(() => {
    setSelectedConversationId(conversations.length > 0 ? conversations[0].id : null);
  }, [conversations]);

  // 确保每次消息更新时重新获取消息
  const currentMessages = selectedConversationId ? getMessages(selectedConversationId) : [];

  // 添加调试日志
  // useEffect(() => {
  //   console.log('Current messages:', currentMessages);
  // }, [currentMessages]);

  const handleSendMessage = async (newMessage: string, sender: 'user' | 'bot', isLoading = false) => {
    if (!selectedConversationId) {
      console.warn('No conversation selected.');
      return;
    }

    const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const newMessageObj: Message = {
      id: messageId, // 使用预生成的唯一ID
      text: newMessage,
      sender: sender,
      isLoading: isLoading,
      timestamp: Date.now(),
    };

    // 只在Context中更新消息，本地状态通过useEffect自动更新
    await addMessage(selectedConversationId, newMessageObj);
  };

  // 监听 messagesMap 的变化, 移除多余的本地状态更新
  useEffect(() => {
    if (selectedConversationId) {
      const currentMessages = getMessages(selectedConversationId);
      setMessages(currentMessages);
    }
  }, [selectedConversationId, getMessages]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setIsSidebarVisible(false);
  };

  const handleResetConversation = async () => {
    if (selectedConversationId) {
      await clearMessages(selectedConversationId);
    }
  };

  // 修改处理图像的函数
  const handleImageGenerated = async (imageUrl: string, taskId?: string) => {
    if (!selectedConversationId) {
      console.warn('未选择对话，无法添加图片消息');
      return;
    }

    console.log('接收到生成的图片URL:', imageUrl.substring(0, 50) + '...');
    
    // 如果提供了任务ID，检查是否正在处理该任务
    if (taskId && processingTaskIds.current.has(taskId)) {
      console.log(`任务 ${taskId} 正在处理中，跳过重复处理`);
      return;
    }
    
    // 如果已经处理过这个URL，避免重复添加
    if (processedImageUrls.has(imageUrl)) {
      console.log('图片URL已经被处理过，跳过:', imageUrl.substring(0, 50) + '...');
      return;
    }
    
    try {
      // 如果提供了任务ID，标记为正在处理
      if (taskId) {
        processingTaskIds.current.add(taskId);
      }
      
      // 创建图像消息
      let imageMessage: string;
      
      // 直接使用图像URL
      if (imageUrl.startsWith('http')) {
        // 如果是HTTP URL，使用基本的markdown图片语法
        imageMessage = `![NovelAI生成的图像](${imageUrl})`;
      } else if (imageUrl.length > 200000) {
        // 如果是非常大的data URL，提供警告
        imageMessage = `[NovelAI生成了一张图像，但数据量太大无法直接显示。点击查看](${imageUrl})`;
      } else {
        // 普通data URL
        imageMessage = `![NovelAI生成的图像](${imageUrl})`;
      }
      
      // 添加消息
      console.log('添加NovelAI图片到对话', selectedConversationId);
      await handleSendMessage(imageMessage, 'bot');
      
      // 将URL添加到已处理集合中
      setProcessedImageUrls(prev => new Set([...prev, imageUrl]));
      
      // 如果任务处理完成，从处理中集合移除
      if (taskId) {
        processingTaskIds.current.delete(taskId);
      }
    } catch (error) {
      console.error('添加图片消息失败:', error);
      // 确保即使出错也从处理中集合移除任务
      if (taskId) {
        processingTaskIds.current.delete(taskId);
      }
    }
  };

  const selectedCharacter: Character | undefined | null = selectedConversationId ? characters.find((char: Character) => char.id === selectedConversationId) : null;

  const handleAvatarPress = () => {
    router.push(`/pages/character-detail?id=${selectedConversationId}`);
  };

  const handleRateMessage = async (messageId: string, isUpvote: boolean) => {
    // Rating functionality removed as it's not implemented in the current version
    console.log('Message rating not implemented:', { messageId, isUpvote });
  };

  // Add keyboard listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      'keyboardWillShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      'keyboardWillHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Pass keyboard state to tab layout
  useEffect(() => {
    if (Platform.OS === 'ios') {
      router.setParams({ hideTabBar: isKeyboardVisible ? 'true' : 'false' });
    }
  }, [isKeyboardVisible]);

  // 添加持久化状态
  useEffect(() => {
    const loadLastConversation = async () => {
      try {
        const lastId = await AsyncStorage.getItem('lastConversationId');
        if (lastId) {
          // 确保角色存在
          const characterExists = characters.some(char => char.id === lastId);
          if (characterExists) {
            setSelectedConversationId(lastId);
            // 更新消息列表
            const messagesForConversation = getMessages(lastId);
            setMessages(messagesForConversation);
          } else if (conversations.length > 0) {
            // 如果找不到上次的会话，使用第一个可用的会话
            setSelectedConversationId(conversations[0].id);
            const messagesForConversation = getMessages(conversations[0].id);
            setMessages(messagesForConversation);
          }
        }
      } catch (error) {
        console.error('Failed to load last conversation:', error);
      }
    };

    loadLastConversation();
  }, [conversations, characters]); // 添加 characters 作为依赖

  // 当选中的会话改变时更新消息
  useEffect(() => {
    if (selectedConversationId) {
      const currentMessages = getMessages(selectedConversationId);
      setMessages(currentMessages);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (characterId) {
      console.log('[Index] Character ID from params:', characterId);
      // Validate the character exists
      const characterExists = characters.some(char => char.id === characterId);
      console.log('[Index] Character exists in characters array:', characterExists);
      
      if (characterExists) {
        // Set the selected conversation ID
        setSelectedConversationId(characterId);
        console.log('[Index] Selected conversation set to:', characterId);
        
        // Load messages for this character
        const characterMessages = getMessages(characterId);
        console.log('[Index] Loaded messages count:', characterMessages.length);
        setMessages(characterMessages);
      } else {
        console.warn('[Index] Character not found in characters array:', characterId);
      }
      
      setIsSidebarVisible(false); // Ensure sidebar is closed
    }
  }, [characterId, characters, getMessages]);

  useEffect(() => {
    if (selectedConversationId) {
      console.log('[Index] Saving selectedConversationId to AsyncStorage:', selectedConversationId);
      AsyncStorage.setItem('lastConversationId', selectedConversationId)
        .catch(err => console.error('[Index] Failed to save lastConversationId:', err));
    }
  }, [selectedConversationId]);

  function getCharacterConversationId(selectedConversationId: string): string | undefined {
    // Since we're already using the character ID as the conversation ID throughout the app,
    // we can simply return the selectedConversationId if it exists
    return selectedConversationId || undefined;
  }

  // 获取角色的背景图片
  const getBackgroundImage = () => {
    if (selectedCharacter?.backgroundImage) {
      return { uri: selectedCharacter.backgroundImage };
    } else if (selectedCharacter?.backgroundImage) {
      // 如果没有专门的聊天背景图，则使用普通背景图
      return { uri: selectedCharacter.backgroundImage };
    }
    return require('@/assets/images/default-background.jpg');
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar translucent backgroundColor="transparent" />
      <ImageBackground
        source={selectedCharacter ? getBackgroundImage() : require('@/assets/images/default-background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[
          styles.container,
          selectedCharacter ? styles.transparentBackground : styles.darkBackground
        ]}>
          <TopBarWithBackground
            selectedCharacter={selectedCharacter}
            onAvatarPress={handleAvatarPress}
            onMemoPress={() => setIsMemoSheetVisible(true)}
            onSettingsPress={toggleSettingsSidebar}
            onMenuPress={toggleSidebar}
            showBackground={false} // 不在 TopBar 中显示背景，因为我们已经在整个屏幕上设置了背景
          />

          <SafeAreaView style={[
            styles.safeArea,
            selectedCharacter && styles.transparentBackground
          ]}>
            <View style={[
              styles.contentContainer,
              selectedCharacter && styles.transparentBackground
            ]}>
              <ChatDialog
                messages={messages}
                style={styles.chatDialog}
                selectedCharacter={selectedCharacter}
                onRateMessage={handleRateMessage}
              />
              
              {/* 测试按钮容器 */}
              <View style={styles.testButtonContainer}>
                {/* NovelAI 测试按钮 */}
                <TouchableOpacity 
                  style={styles.testButton}
                  onPress={() => setIsNovelAITestVisible(true)}
                >
                  <Text style={styles.testButtonText}>NovelAI 图像测试</Text>
                </TouchableOpacity>
                
                {/* VNDB 测试按钮 */}
                <TouchableOpacity 
                  style={[styles.testButton, styles.vndbButton]}
                  onPress={() => setIsVNDBTestVisible(true)}
                >
                  <Text style={styles.testButtonText}>VNDB 角色查询</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[
              styles.inputBar,
              selectedCharacter && styles.transparentBackground
            ]}>
              {selectedCharacter && (
                <ChatInput
                  onSendMessage={handleSendMessage}
                  selectedConversationId={selectedConversationId}
                  conversationId={selectedConversationId ? getCharacterConversationId(selectedConversationId) ?? '' : ''}
                  onResetConversation={handleResetConversation}
                  selectedCharacter={selectedCharacter}
                />
              )}
            </View>

            {/* Sidebars and overlays */}
            <Sidebar
              isVisible={isSidebarVisible}
              conversations={characters}
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              onClose={toggleSidebar}
            />
            <SettingsSidebar
              isVisible={isSettingsSidebarVisible}
              onClose={toggleSettingsSidebar}
              selectedCharacter={selectedCharacter}
            />
            {isSettingsSidebarVisible && <View style={styles.modalOverlay} />}
          </SafeAreaView>

          {/* 直接在主视图中渲染 MemoOverlay */}
          <MemoOverlay
            isVisible={isMemoSheetVisible}
            onClose={() => setIsMemoSheetVisible(false)}
          />
          
          {/* VNDB测试模态框 */}
          <VNDBTestModal
            visible={isVNDBTestVisible}
            onClose={() => setIsVNDBTestVisible(false)}
          />

          {/* NovelAI测试模态框 */}
          <NovelAITestModal
            visible={isNovelAITestVisible}
            onClose={() => setIsNovelAITestVisible(false)}
            onImageGenerated={handleImageGenerated}
          />
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  darkBackground: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
  },
  safeArea: {
    flex: 1,
    marginTop: 90,
  },
  contentContainer: {
    flex: 1,
    padding: 10,
    position: 'relative',
  },
  chatDialog: {
    flex: 1,
  },
  inputBar: {
    padding: 10,
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 900,
  },
  transparentBackground: {
    backgroundColor: 'transparent',
  },
  // 更新测试按钮容器样式
  testButtonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 100,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 10,
  },
  testButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)', // 半透明蓝色
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  vndbButton: {
    backgroundColor: 'rgba(155, 89, 182, 0.9)', // 半透明紫色，区分不同按钮
  },
});

export default App;