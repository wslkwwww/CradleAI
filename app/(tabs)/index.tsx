import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  Keyboard,
} from 'react-native';

import ChatDialog from '@/components/ChatDialog';
import ChatInput from '@/components/ChatInput';
import Sidebar from '@/components/Sidebar';
import SettingsSidebar from '@/components/SettingsSidebar';
import MemoOverlay from '@/components/MemoOverlay';  // 替换原来的 MemoSheet 导入
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

  const handleSelectConversation = useCallback((id: string) => {
    console.log(`[Index] handleSelectConversation called with ID: ${id}`);
    
    if (id === selectedConversationId) {
      console.log(`[Index] Character ${id} is already selected, no change needed`);
      return; // No need to update if already selected
    }
    
    console.log(`[Index] Switching to character: ${id}`);
    setSelectedConversationId(id); // Update the state directly
    setIsSidebarVisible(false); // Close the sidebar
    
    // Manually load the messages
    const characterMessages = getMessages(id);
    setMessages(characterMessages);
    
    // Save to AsyncStorage for persistence
    AsyncStorage.setItem('lastConversationId', id)
      .catch(err => console.error('[Index] Failed to save lastConversationId:', err));
    
    // Update URL params in a way that doesn't cause a loop
    // This uses replace instead of setParams
    router.replace({
      pathname: "/(tabs)",
      params: { characterId: id }
    });
  }, [selectedConversationId, getMessages]);

  const handleResetConversation = async () => {
    if (selectedConversationId) {
      await clearMessages(selectedConversationId);
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

  // Create the ref outside of any effects
  const hasProcessedCharacterId = useRef(false);
  
  // Fix the effect that loads characters from URL parameters
  useEffect(() => {
    if (characterId && !hasProcessedCharacterId.current) {
      console.log('[Index] Processing character ID from params:', characterId);
      
      // Mark as processed to prevent re-processing
      hasProcessedCharacterId.current = true;
      
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
        
        // Save this as the last conversation
        AsyncStorage.setItem('lastConversationId', characterId)
          .catch(err => console.error('[Index] Failed to save lastConversationId:', err));
      } else {
        console.warn('[Index] Character not found in characters array:', characterId);
        
        // Try to load a default character
        if (characters.length > 0) {
          const defaultCharacter = characters[0];
          console.log('[Index] Switching to default character:', defaultCharacter.name);
          setSelectedConversationId(defaultCharacter.id);
          setMessages(getMessages(defaultCharacter.id));
          
          // Update URL without triggering a navigation cycle
          setTimeout(() => {
            router.setParams({ characterId: defaultCharacter.id });
          }, 100);
        }
      }
      
      setIsSidebarVisible(false); // Close the sidebar
    }
  }, [characterId, characters]); // Note: we removed other dependencies
  
  // Reset the ref when characterId changes
  useEffect(() => {
    // When characterId changes, we want to process it again
    hasProcessedCharacterId.current = false;
  }, [characterId]);

  function getCharacterConversationId(selectedConversationId: string): string | undefined {
    // Since we're already using the character ID as the conversation ID throughout the app,
    // we can simply return the selectedConversationId if it exists
    return selectedConversationId || undefined;
  }


  return (
    <View style={styles.container}>
      <TopBarWithBackground
        selectedCharacter={selectedCharacter}
        onAvatarPress={handleAvatarPress}
        onMemoPress={() => setIsMemoSheetVisible(true)}
        onSettingsPress={toggleSettingsSidebar}
        onMenuPress={toggleSidebar}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>
          <ChatDialog
            messages={messages}
            style={styles.chatDialog}
            selectedCharacter={selectedCharacter}
            onRateMessage={handleRateMessage}
          />
        </View>

        <View style={styles.inputBar}>
          <ChatInput
            onSendMessage={handleSendMessage}
            selectedConversationId={selectedConversationId}
            conversationId={selectedConversationId ? getCharacterConversationId(selectedConversationId) : ''}
            onResetConversation={handleResetConversation}
            selectedCharacter={selectedCharacter}
          />
        </View>

        {/* Sidebars and overlays */}
        <Sidebar
          isVisible={isSidebarVisible}
          conversations={conversations}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative', // 确保容器使用相对定位
  },
  safeArea: {
    flex: 1,
    marginTop: 90,
  },
  contentContainer: {
    flex: 1,
    padding: 10,
    position: 'relative', // 添加相对定位
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
});

export default App;