import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Alert,
  KeyboardAvoidingView,
  AppState,
} from 'react-native';

import ChatDialog from '@/components/ChatDialog';
import ChatInput from '@/components/ChatInput';
import Sidebar from '@/components/Sidebar';
import SettingsSidebar from '@/components/SettingsSidebar';
import MemoOverlay from '@/components/MemoOverlay';  // 替换原来的 MemoSheet 导入
import SaveManager from '@/components/SaveManager'; // Import the SaveManager component
import NovelAITestModal from '@/components/NovelAITestModal'; // 导入 NovelAI 测试组件
import VNDBTestModal from '@/src/components/VNDBTestModal'; // 导入 VNDB 测试组件
import { Message, Character, ChatSave } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { useUser } from '@/constants/UserContext'; // 添加 useUser 导入
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBarWithBackground from '@/components/TopBarWithBackground';
import { NodeSTManager } from '@/utils/NodeSTManager';  // 导入 NodeSTManager
import { chatSaveService } from '@/services/ChatSaveService';
import { EventRegister } from 'react-native-event-listeners';
import RichTextRenderer from '@/components/RichTextRenderer';
import { containsComplexHtml } from '@/utils/textParser';

const App = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const characterId = params.characterId as string;
  const { user } = useUser(); // 获取用户设置

  // 简化状态管理，只保留必要的状态
  const {
    conversations,
    characters,
    getMessages,
    addMessage,
    clearMessages,
  } = useCharacters();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI state
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isSettingsSidebarVisible, setIsSettingsSidebarVisible] = useState(false);
  const [isMemoSheetVisible, setIsMemoSheetVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isNovelAITestVisible, setIsNovelAITestVisible] = useState(false);
  const [isVNDBTestVisible, setIsVNDBTestVisible] = useState(false);

  // Save/Load system states
  const [isSaveManagerVisible, setIsSaveManagerVisible] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<Message[] | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentPreviewSave, setCurrentPreviewSave] = useState<ChatSave | null>(null);
  const [previewBannerVisible, setPreviewBannerVisible] = useState(false);

  // 添加一个跟踪处理过的图片URL的集合
  const [processedImageUrls, setProcessedImageUrls] = useState<Set<string>>(new Set());
  // 添加一个引用来跟踪处理中的任务ID
  const processingTaskIds = useRef<Set<string>>(new Set());

  // Add ref to track if first message needs to be sent
  const firstMessageSentRef = useRef<Record<string, boolean>>({});

  // Add auto-message feature variables
  const [autoMessageEnabled, setAutoMessageEnabled] = useState(true);
  const autoMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoMessageIntervalRef = useRef<number>(5); // Default 5 minutes
  const lastMessageTimeRef = useRef<number>(Date.now());
  const waitingForUserReplyRef = useRef<boolean>(false); // Track if bot is waiting for user reply

  // Add state to preserve chat scroll positions
  const [chatScrollPositions, setChatScrollPositions] = useState<Record<string, number>>({});

  const toggleSettingsSidebar = () => {
    setIsSettingsSidebarVisible(!isSettingsSidebarVisible);
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const toggleSaveManager = () => {
    // If in preview mode, ask user if they want to exit
    if (isPreviewMode) {
      Alert.alert(
        'Exit Preview Mode',
        'You are currently previewing a saved chat. Do you want to exit preview mode?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Exit Preview', 
            onPress: () => {
              exitPreviewMode();
              setIsSaveManagerVisible(!isSaveManagerVisible);
            }
          }
        ]
      );
    } else {
      setIsSaveManagerVisible(!isSaveManagerVisible);
    }
  };

  const handleSaveMemo = (content: string) => {
    // 这里可以添加保存备忘录的逻辑
    console.log('Saving memo:', content);
    // TODO: 将备忘录保存到本地存储或发送到服务器
  };

  // Preview a save
  const handlePreviewSave = (save: ChatSave) => {
    if (!isPreviewMode) {
      // Store current messages for later
      setPreviewMessages(messages);
    }
    
    // Enter preview mode and show the saved messages
    setIsPreviewMode(true);
    setCurrentPreviewSave(save);
    setMessages(save.messages);
    setIsSaveManagerVisible(false);
    
    // Show preview banner
    setPreviewBannerVisible(true);
    
    // Hide banner after 5 seconds
    setTimeout(() => {
      setPreviewBannerVisible(false);
    }, 5000);
  };

  // Exit preview mode and restore original messages
  const exitPreviewMode = () => {
    if (isPreviewMode && previewMessages) {
      setMessages(previewMessages);
      setIsPreviewMode(false);
      setCurrentPreviewSave(null);
      setPreviewMessages(null);
      setPreviewBannerVisible(false);
    }
  };

  // Load a saved chat state
  const handleLoadSave = (save: ChatSave) => {
    if (!selectedConversationId) return;
    
    // First clear all messages
    clearMessages(selectedConversationId)
      .then(async () => {
        // Add each message from the save
        for (const msg of save.messages) {
          await addMessage(selectedConversationId, msg);
        }
        
        // Update local state
        setMessages(save.messages);
        setIsSaveManagerVisible(false);
        setIsPreviewMode(false);
        setPreviewMessages(null);
        setCurrentPreviewSave(null);
        
        Alert.alert('Success', 'Chat restored successfully to saved point!');
      })
      .catch(error => {
        console.error('Error restoring chat:', error);
        Alert.alert('Error', 'Failed to restore chat state.');
        
        // Exit preview mode on error
        exitPreviewMode();
      });
  };

  // Handle chat save creation
  const handleSaveCreated = (save: ChatSave) => {
    console.log('Save created:', save.id);
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
    // If in preview mode, exit it first
    if (isPreviewMode) {
      Alert.alert(
        'Exit Preview Mode',
        'You\'re currently previewing a saved chat. Sending a new message will exit preview mode.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Send & Exit Preview', 
            onPress: () => {
              exitPreviewMode();
              sendMessageInternal(newMessage, sender, isLoading);
            }
          }
        ]
      );
    } else {
      await sendMessageInternal(newMessage, sender, isLoading);
    }

    // If user is sending a message, clear the "waiting for reply" flag
    if (sender === 'user' && !isLoading) {
      waitingForUserReplyRef.current = false;
      console.log('[App] User sent a message, no longer waiting for reply');
      
      // Clear unread messages count when user sends a message
      updateUnreadMessagesCount(0);
    }

    // Reset the auto message timer after any message is sent
    if (!isLoading) {
      lastMessageTimeRef.current = Date.now();
      setupAutoMessageTimer();
    }
  };

  // Internal helper function to actually send the message
  const sendMessageInternal = async (newMessage: string, sender: 'user' | 'bot', isLoading = false) => {
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
      timestamp: Date.now(), // Make sure timestamp is included
    };

    // 只在Context中更新消息，本地状态通过useEffect自动更新
    await addMessage(selectedConversationId, newMessageObj);
  };

  const handleRegenerateMessage = async (messageId: string, messageIndex: number) => {
    if (!selectedConversationId) {
      console.warn('No conversation selected for regeneration');
      return;
    }
    
    try {
      console.log('Regenerating message at index:', messageIndex);
      
      // Find all AI messages and their corresponding user messages
      const currentMessages = [...messages];
      const aiMessages: Message[] = [];
      const userMessages: Message[] = [];
      const messagePairs: { aiMessage: Message, userMessage: Message }[] = [];
      
      // First, collect all messages by type
      for (const msg of currentMessages) {
        if (msg.sender === 'bot' && !msg.isLoading) {
          aiMessages.push(msg);
        } else if (msg.sender === 'user') {
          userMessages.push(msg);
        }
      }
      
      // Now build the pairs by looking at the sequence
      let currentUserMessage: Message | null = null;
      
      for (const msg of currentMessages) {
        if (msg.sender === 'user') {
          currentUserMessage = msg;
        } else if (msg.sender === 'bot' && !msg.isLoading && currentUserMessage) {
          messagePairs.push({
            userMessage: currentUserMessage,
            aiMessage: msg
          });
        }
      }
      
      console.log(`Found ${messagePairs.length} user-AI message pairs`);
      
      // Find the target message pair
      if (messageIndex < 0 || messageIndex >= messagePairs.length) {
        console.warn('Invalid message index for regeneration:', messageIndex);
        return;
      }
      
      const targetPair = messagePairs[messageIndex];
      
      if (!targetPair) {
        console.warn('Target message pair not found for regeneration');
        return;
      }
      
      console.log('Target user message:', targetPair.userMessage.text.substring(0, 30) + '...');
      console.log('Target AI message:', targetPair.aiMessage.text.substring(0, 30) + '...');
      
      // Find the index of the AI message to regenerate
      const targetAiIndex = currentMessages.findIndex(m => m.id === targetPair.aiMessage.id);
      
      if (targetAiIndex === -1) {
        console.warn('Target AI message not found in current messages');
        return;
      }
      
      // Mark all messages after and including the AI message for removal
      const messagesToRemove = currentMessages
        .slice(targetAiIndex)
        .map(msg => msg.id);
      
      // Add a loading message
      const loadingMessageId = `loading-${Date.now()}`;
      await addMessage(selectedConversationId, {
        id: loadingMessageId,
        text: '', 
        sender: 'bot',
        isLoading: true,
        timestamp: Date.now(),
      });
      
      // Call NodeSTManager to handle the regeneration
      const result = await NodeSTManager.regenerateFromMessage({
        messageIndex: messageIndex,
        conversationId: selectedConversationId,
        apiKey: user?.settings?.chat.characterApiKey || '',
        apiSettings: {
          apiProvider: user?.settings?.chat.apiProvider || 'gemini',
          openrouter: user?.settings?.chat.openrouter
        },
        character: selectedCharacter || undefined
      });
      
      // Completely replace the context's messages with the updated messages from NodeST
      if (result.success) {
        // First, remove all messages after and including the regenerated one
        await Promise.all(messagesToRemove.map(id => {
          return Promise.resolve();
        }));
        
        // Now remove the loading message and build the updated message list
        const currentMessagesAfterLoading = getMessages(selectedConversationId).filter(
          msg => msg.id !== loadingMessageId && !messagesToRemove.includes(msg.id)
        );
        
        // Then add the regenerated message
        const regeneratedMessage: Message = {
          id: `regenerated-${Date.now()}`,
          text: result.text || 'No response generated',
          sender: 'bot',
          isLoading: false,
          timestamp: Date.now(),
        };
        
        // Build new message list
        const updatedMessages = [...currentMessagesAfterLoading, regeneratedMessage];
        
        // Save this to the context (this will replace all messages for this conversation)
        await clearMessages(selectedConversationId);
        
        // Add the updated messages one by one
        for (const msg of updatedMessages) {
          await addMessage(selectedConversationId, msg);
        }
        
        // Update local state
        setMessages(getMessages(selectedConversationId));
      } else {
        // In case of error, just remove the loading indicator and add error message
        const currentMessagesAfterLoading = getMessages(selectedConversationId).filter(
          msg => msg.id !== loadingMessageId
        );
        
        // Add error message instead
        await addMessage(selectedConversationId, {
          id: `error-${Date.now()}`,
          text: '抱歉，无法重新生成回复。请稍后再试。',
          sender: 'bot',
          isLoading: false,
          timestamp: Date.now(),
        });
        
        // Update local state
        setMessages(getMessages(selectedConversationId));
      }
    } catch (error) {
      console.error('Error regenerating message:', error);
      
      // Clean up loading indicator in case of error
      const updatedMessages = messages.filter(msg => !msg.isLoading);
      setMessages([...updatedMessages, {
        id: `error-${Date.now()}`,
        text: '发生错误，无法重新生成消息。',
        sender: 'bot',
        isLoading: false,
        timestamp: Date.now(),
      }]);
    }
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
    
    // Add a check - if we're switching to a different conversation that has no messages,
    // we need to ensure the first message is sent
    const currentMessages = getMessages(id);
    if (currentMessages.length === 0 && !firstMessageSentRef.current[id]) {
      // We don't need to do anything here - the effect will handle sending the first message
      console.log('[App] Selected conversation has no messages, will send first message');
    }
  };

  // 修改处理图像的函数
  const handleImageGenerated = async (imageUrl: string, taskId?: string) => {
    // If in preview mode, exit first
    if (isPreviewMode) {
      exitPreviewMode();
    }

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
    // If in preview mode, ask user if they want to exit before navigating
    if (isPreviewMode) {
      Alert.alert(
        'Exit Preview Mode',
        'You\'re currently previewing a saved chat. Navigating to character details will exit preview mode.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => {
              exitPreviewMode();
              router.push(`/pages/character-detail?id=${selectedConversationId}`);
            }
          }
        ]
      );
    } else {
      router.push(`/pages/character-detail?id=${selectedConversationId}`);
    }
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

  // Add functionality to send first message when conversation starts
  useEffect(() => {
    const sendFirstMessage = async () => {
      // Only proceed if we have a selected conversation and character
      if (!selectedConversationId || !selectedCharacter?.id) return;
      
      // Check if we've already sent a first message for this conversation
      if (firstMessageSentRef.current[selectedConversationId]) return;

      // Check if the conversation is empty (no messages yet)
      const currentMessages = getMessages(selectedConversationId);
      if (currentMessages.length > 0) {
        // Mark as sent since conversation already has messages
        firstMessageSentRef.current[selectedConversationId] = true;
        return;
      }

      try {
        // Try to parse character data to get first_mes
        if (selectedCharacter.jsonData) {
          const characterData = JSON.parse(selectedCharacter.jsonData);
          if (characterData.roleCard?.first_mes) {
            // Send the first message
            console.log('[App] Sending first message for character:', selectedCharacter.name);
            await addMessage(selectedConversationId, {
              id: `first-${Date.now()}`,
              text: characterData.roleCard.first_mes,
              sender: 'bot',
              timestamp: Date.now()
            });
            
            // Mark as sent for this conversation
            firstMessageSentRef.current[selectedConversationId] = true;
          }
        }
      } catch (error) {
        console.error('[App] Error sending first message:', error);
      }
    };

    sendFirstMessage();
  }, [selectedConversationId, selectedCharacter]);

  // Update handleResetConversation to send first_mes after reset
  const handleResetConversation = async () => {
    if (selectedConversationId) {
      // Reset the conversation
      await clearMessages(selectedConversationId);
      
      // Clear the "first message sent" flag for this conversation
      if (firstMessageSentRef.current[selectedConversationId]) {
        delete firstMessageSentRef.current[selectedConversationId];
      }
      
      // After a short delay, trigger the first message effect
      setTimeout(() => {
        if (selectedCharacter?.jsonData) {
          try {
            const characterData = JSON.parse(selectedCharacter.jsonData);
            if (characterData.roleCard?.first_mes) {
              addMessage(selectedConversationId, {
                id: `first-reset-${Date.now()}`,
                text: characterData.roleCard.first_mes,
                sender: 'bot',
                timestamp: Date.now()
              });
              firstMessageSentRef.current[selectedConversationId] = true;
              
              // Reset auto-message timer
              lastMessageTimeRef.current = Date.now();
              setupAutoMessageTimer();
            }
          } catch (e) {
            console.error('Error adding first message after reset:', e);
          }
        }
      }, 300);
    }
  };

  // Function to set up auto message timer
  const setupAutoMessageTimer = useCallback(() => {
    // Clear any existing timer
    if (autoMessageTimerRef.current) {
      clearTimeout(autoMessageTimerRef.current);
      autoMessageTimerRef.current = null;
    }
    
    // If auto messaging is disabled, no character selected, or waiting for user reply, don't set up timer
    if (!autoMessageEnabled || !selectedCharacter?.id || waitingForUserReplyRef.current) {
      console.log(`[App] Auto message timer not set: enabled=${autoMessageEnabled}, hasCharacter=${!!selectedCharacter}, waitingForUserReply=${waitingForUserReplyRef.current}`);
      return;
    }

    // Check character-specific settings:
    // 1. autoMessage must be explicitly enabled
    if (selectedCharacter.autoMessage !== true) {
      console.log('[App] Auto message disabled for this character in settings');
      return;
    }

    // Use character-specific interval or default to 5 minutes
    const interval = selectedCharacter.autoMessageInterval || 5;
    autoMessageIntervalRef.current = interval;

    // Set up new timer
    const intervalMs = autoMessageIntervalRef.current * 60 * 1000; // Convert minutes to ms
    
    console.log(`[App] Auto message timer set for ${autoMessageIntervalRef.current} minutes`);
    
    autoMessageTimerRef.current = setTimeout(async () => {
      console.log('[App] Auto message timer triggered');
      
      // Only send auto message if we have a selected character and conversation
      if (selectedCharacter && selectedConversationId) {
        // Reset timer reference since it's been triggered
        autoMessageTimerRef.current = null;
        
        try {
          // Create a loading message first
          await addMessage(selectedConversationId, {
            id: `auto-loading-${Date.now()}`,
            text: '',
            sender: 'bot',
            isLoading: true,
            timestamp: Date.now(),
          });
          
          // Call NodeST with special auto-message instruction
          const result = await NodeSTManager.processChatMessage({
            userMessage: "[AUTO_MESSAGE] 用户已经一段时间没有回复了。请基于上下文和你的角色设定，主动发起一条合适的消息。这条消息应该自然，不要直接提及用户长时间未回复的事实。",
            status: "同一角色继续对话",
            conversationId: selectedConversationId,
            apiKey: user?.settings?.chat.characterApiKey || '',
            apiSettings: {
              apiProvider: user?.settings?.chat.apiProvider || 'gemini',
              openrouter: user?.settings?.chat.openrouter
            },
            character: selectedCharacter
          });
          
          // Remove loading message
          const currentMessages = getMessages(selectedConversationId).filter(
            msg => !msg.isLoading
          );
          
          // Clear all messages
          await clearMessages(selectedConversationId);
          
          // Re-add all messages
          for (const msg of currentMessages) {
            await addMessage(selectedConversationId, msg);
          }
          
          // Add the auto message
          if (result.success && result.text) {
            // Always add the message to the chat regardless of notification settings
            await addMessage(selectedConversationId, {
              id: `auto-${Date.now()}`,
              text: result.text,
              sender: 'bot',
              timestamp: Date.now(),
            });
            
            // Update last message time
            lastMessageTimeRef.current = Date.now();
            
            // Set waitingForUserReply to true to prevent further auto-messages until user responds
            waitingForUserReplyRef.current = true;
            console.log('[App] Auto message sent, now waiting for user reply');
            
            // IMPORTANT: Only update notification badge if notificationEnabled is true
            // This change ensures the message still appears in chat, just without a notification badge
            if (selectedCharacter.notificationEnabled === true) {
              console.log('[App] Notifications enabled for this character, updating unread count');
              updateUnreadMessagesCount(1);
            } else {
              console.log('[App] Notifications disabled for this character, not showing badge');
            }
          } else {
            console.error('[App] Failed to generate auto message:', result.error);
          }
        } catch (error) {
          console.error('[App] Error generating auto message:', error);
        }
      }
    }, intervalMs);
    
    console.log(`[App] Auto message timer set for ${autoMessageIntervalRef.current} minutes`);
  }, [selectedCharacter, selectedConversationId, autoMessageEnabled, user?.settings]);

  // Add unread messages counter function
  const updateUnreadMessagesCount = (count: number) => {
    // Use AsyncStorage to persist unread message count
    AsyncStorage.setItem('unreadMessagesCount', String(count)).catch(err => 
      console.error('[App] Failed to save unread messages count:', err)
    );
    
    // Use EventRegister instead of window.dispatchEvent for React Native
    EventRegister.emit('unreadMessagesUpdated', count);
  };

  // Reset timer whenever a new message is sent
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Update last message time
      lastMessageTimeRef.current = Date.now();
      
      // Set up new timer
      setupAutoMessageTimer();
    }
  }, [messages, setupAutoMessageTimer]);
  
  // Set up timer when character changes
  useEffect(() => {
    // Initialize auto message interval from character settings if available
    if (selectedCharacter) {
      // Use explicit boolean check for autoMessage setting
      setAutoMessageEnabled(selectedCharacter.autoMessage === true);
      
      // Get the interval directly from the character settings
      autoMessageIntervalRef.current = selectedCharacter.autoMessageInterval || 5;
      
      setupAutoMessageTimer();
    }
    
    // Clean up timer on unmount or character change
    return () => {
      if (autoMessageTimerRef.current) {
        clearTimeout(autoMessageTimerRef.current);
        autoMessageTimerRef.current = null;
      }
    };
  }, [selectedCharacter, setupAutoMessageTimer]);

  // Save scroll positions on app pause/background
  useEffect(() => {
    const saveScrollPositions = async () => {
      try {
        if (Object.keys(chatScrollPositions).length > 0) {
          await AsyncStorage.setItem('chatScrollPositions', JSON.stringify(chatScrollPositions));
        }
      } catch (error) {
        console.error('Failed to save scroll positions:', error);
      }
    };
    
    // Add app state change listener
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        saveScrollPositions();
      }
    });
    
    // Load saved scroll positions on mount
    const loadScrollPositions = async () => {
      try {
        const savedPositions = await AsyncStorage.getItem('chatScrollPositions');
        if (savedPositions) {
          setChatScrollPositions(JSON.parse(savedPositions));
        }
      } catch (error) {
        console.error('Failed to load scroll positions:', error);
      }
    };
    
    loadScrollPositions();
    
    return () => {
      subscription.remove();
      saveScrollPositions();
    };
  }, [chatScrollPositions]);

  // Update ChatDialog props to include scroll position handling
  const handleScrollPositionChange = (characterId: string, position: number) => {
    setChatScrollPositions(prev => ({
      ...prev,
      [characterId]: position
    }));
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar translucent backgroundColor="transparent" />
      <ImageBackground
        source={selectedCharacter ? getBackgroundImage() : require('@/assets/images/default-background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidView}
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
              onSaveManagerPress={toggleSaveManager} // Add save manager button handler
              showBackground={false} // 不在 TopBar 中显示背景，因为我们已经在整个屏幕上设置了背景
            />

            <SafeAreaView style={[
              styles.safeArea,
              selectedCharacter && styles.transparentBackground
            ]}>
              {/* Preview Mode Banner */}
              {isPreviewMode && previewBannerVisible && (
                <View style={styles.previewBanner}>
                  <Text style={styles.previewBannerText}>
                    You are previewing a saved chat state
                  </Text>
                  <View style={styles.previewBannerButtons}>
                    <TouchableOpacity 
                      style={styles.previewBannerButton}
                      onPress={exitPreviewMode}
                    >
                      <Text style={styles.previewBannerButtonText}>Exit Preview</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.previewBannerButton, styles.restoreButton]}
                      onPress={() => currentPreviewSave && handleLoadSave(currentPreviewSave)}
                    >
                      <Text style={styles.previewBannerButtonText}>Restore This State</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              <View style={[
                styles.contentContainer,
                selectedCharacter && styles.transparentBackground
              ]}>
                <ChatDialog
                  messages={messages}
                  style={styles.chatDialog}
                  selectedCharacter={selectedCharacter}
                  onRateMessage={handleRateMessage}
                  onRegenerateMessage={handleRegenerateMessage}
                  savedScrollPosition={selectedCharacter?.id ? chatScrollPositions[selectedCharacter.id] : undefined}
                  onScrollPositionChange={handleScrollPositionChange}
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
            
            {/* Save Manager */}
            {selectedCharacter && (
              <SaveManager
                visible={isSaveManagerVisible}
                onClose={() => setIsSaveManagerVisible(false)}
                conversationId={selectedConversationId || ''}
                characterId={selectedCharacter.id}
                characterName={selectedCharacter.name}
                characterAvatar={selectedCharacter.avatar || undefined}
                messages={messages}
                onSaveCreated={handleSaveCreated}
                onLoadSave={handleLoadSave}
                onPreviewSave={handlePreviewSave}
              />
            )}
          </View>
        </KeyboardAvoidingView>
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
  previewBanner: {
    backgroundColor: 'rgba(52, 152, 219, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  previewBannerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  previewBannerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  previewBannerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    marginHorizontal: 8,
  },
  previewBannerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: 'rgba(46, 204, 113, 0.4)',
  },
  keyboardAvoidView: {
    flex: 1,
  },
});

export default App;