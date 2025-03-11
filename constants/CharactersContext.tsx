import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import {  SidebarItemProps, CharactersContextType, Memo,CradleSettings, } from '@/constants/types';
import { CradleCharacter } from '@/shared/types';
import * as FileSystem from 'expo-file-system';
import { useUser } from './UserContext';
import { Character, Message, CirclePost } from '@/shared/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedType } from '@/NodeST/nodest/services/character-generator-service';
import { CradleService } from '@/NodeST/nodest/services/cradle-service';
import { downloadAndSaveImage, deleteCharacterImages } from '@/utils/imageUtils';
import { Feed } from '@/constants/types';
const CharactersContext = createContext<CharactersContextType | undefined>(undefined);

// Initialize CradleService with API key from environment or settings
const API_KEY = "YOUR_API_KEY_HERE"; // In production, load from secure storage
const cradleService = new CradleService(API_KEY);

// Initialize the service when app starts
cradleService.initialize();

interface InteractionStats {
  messageFrequency: Record<string, number>;
  messageRatings: Record<string, Array<{ messageId: string; rating: number }>>;
  circleInteractions: Record<string, {
    likes: number;
    favorites: number;
    comments: Array<{ postId: string; content: string }>;
  }>;
}

export const CharactersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conversations, setConversations] = useState<SidebarItemProps[]>([]);
  const [conversationIdMap, setConversationIdMap] = useState<{ [key: string]: string }>({});
  const [messagesMap, setMessagesMap] = useState<{ [conversationId: string]: Message[] }>({});
  const [memos, setMemos] = useState<Memo[]>([]);
  const [favorites, setFavorites] = useState<CirclePost[]>([]);
  
  // 添加摇篮系统相关状态
  const [cradleSettings, setCradleSettings] = useState<CradleSettings>({
    enabled: false,
    duration: 7,
    progress: 0,
    feedInterval: 1
  });
  const [cradleCharacters, setCradleCharacters] = useState<CradleCharacter[]>([]);
  
  // Add state for Cradle API settings
  const [cradleApiSettings, setCradleApiSettings] = useState<{
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }>({
    apiProvider: 'gemini'
  });
  
  const { user } = useUser();

  useEffect(() => {
    loadCharacters();
    loadConversations();
    loadMessages();
    loadMemos();
    loadFavorites();
    loadCradleSettings();
    loadCradleCharacters();
    loadCradleApiSettings(); // Add loading API settings
  }, []);

  const loadMessages = async () => {
    try {
      const messagesStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'messages.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => '{}');

      const loadedMessages = JSON.parse(messagesStr);
      setMessagesMap(loadedMessages);
    } catch (error) {
      console.error('加载消息数据失败:', error);
      setMessagesMap({});
    }
  };

  const saveMessages = async (newMessagesMap: { [conversationId: string]: Message[] }) => {
    try {
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'messages.json',
        JSON.stringify(newMessagesMap),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('保存消息数据失败:', error);
    }
  };

  const loadCharacters = async () => {
    try {
      setIsLoading(true);
      const charactersStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => '[]');

      const basicCharacters: Character[] = JSON.parse(charactersStr);
      setCharacters(basicCharacters);
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const conversationsStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'conversations.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => '[]');

      const loadedConversations: SidebarItemProps[] = JSON.parse(conversationsStr);
      const fixedConversations = loadedConversations.map(conversation => {
        if (!conversation.id || typeof conversation.id !== 'string') {
          return { ...conversation, id: String(Date.now()) + Math.random().toString(36).substring(2, 15) };
        }
        return conversation;
      });

      setConversations(fixedConversations);

      const conversationIdMapStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'conversationIdMap.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => '{}');
      const loadedConversationIdMap: { [key: string]: string } = JSON.parse(conversationIdMapStr);
      setConversationIdMap(loadedConversationIdMap);
    } catch (error) {
      console.error('加载对话或 conversationIdMap 数据失败:', error);
    }
  };

  const addCharacter = async (character: Character): Promise<void> => {
    console.log('[Context 1] Starting addCharacter...');
    
    if (!character) {
      const error = new Error('Invalid character: received null/undefined');
      console.error('[Context Error 1]', error);
      throw error;
    }
  
    try {
      // 验证字段
      if (!character.id || !character.name) {
        const error = new Error('Invalid character data: missing id or name');
        console.error('[Context Error 2]', error, character);
        throw error;
      }
  
      // 读取现有角色
      console.log('[Context 2] Reading existing characters...');
      let existingCharacters: Character[] = [];
      try {
        const existingDataStr = await FileSystem.readAsStringAsync(
          FileSystem.documentDirectory + 'characters.json'
        ).catch(() => '[]');
        existingCharacters = JSON.parse(existingDataStr);
        console.log('[Context 3] Loaded existing characters:', existingCharacters.length);
      } catch (e) {
        console.log('[Context Warning] No existing characters found:', e);
      }
  
      // 检查重复 ID
      console.log('[Context 4] Checking for duplicate ID...');
      const existingCharacter = existingCharacters.find(c => c.id === character.id);
      if (existingCharacter) {
        const error = new Error(`Character with ID ${character.id} already exists`);
        console.error('[Context Error 3]', error);
        throw error;
      }
  
      // 保存到文件系统
      console.log('[Context 5] Saving to filesystem...');
      const updatedCharacters = [...existingCharacters, character];
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        JSON.stringify(updatedCharacters)
      ).catch(error => {
        console.error('[Context Error 4] Filesystem write failed:', error);
        throw error;
      });
  
      // 验证保存
console.log('[Context 6] Verifying save...');
console.log('[Context 6] character.id:', character.id); // 打印 character.id

const savedContent = await FileSystem.readAsStringAsync(
  FileSystem.documentDirectory + 'characters.json'
);
console.log('[Context 6] savedContent:', savedContent); // 打印文件内容

const savedCharacters = JSON.parse(savedContent);
console.log('[Context 6] savedCharacters:', savedCharacters); // 打印解析后的对象

const savedCharacter = savedCharacters.find((c: Character) => {
    console.log('[Context 6] Comparing: c.id=', c.id, 'character.id=', character.id, 'c.id === character.id', c.id === character.id ); //增加比较的log
    return c.id === character.id;
});

if (!savedCharacter) {
  const error = new Error('Failed to verify character save');
  console.error('[Context Error 5]', error);
  throw error;
}
  
      // 更新状态
      console.log('[Context 7] Updating state...');
      setCharacters(updatedCharacters);
      
      console.log('[Context 8] Character added successfully');
  
    } catch (error) {
      console.error('[Context Error Final]', error);
      throw error;
    }
  };

  const updateCharacter = async (character: Character) => {
    Alert.alert('更新角色',
      `正在更新角色:\n` +
      `ID: ${character.id}\n` +
      `名称: ${character.name}\n` +
      `朋友圈数量: ${character.circlePosts?.length || 0}`
    );

    try {
      const updatedCharacters = characters.map(char =>
        char.id === character.id ? character : char
      );
      
      Alert.alert('写入存储', '正在保存角色数据到文件系统...');
      
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        JSON.stringify(updatedCharacters),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      const savedContent = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      const savedCharacters = JSON.parse(savedContent);
      const savedCharacter = savedCharacters.find((c: Character) => c.id === character.id);
      
      if (!savedCharacter) {
        throw new Error('Failed to verify character save');
      }

      Alert.alert('保存成功',
        `成功保存角色 ${character.name} 的数据\n` +
        `朋友圈数量: ${savedCharacter.circlePosts?.length || 0}`
      );

      setCharacters(updatedCharacters);
    } catch (error) {
      Alert.alert('错误',
        `更新角色时发生错误:\n${error}\n\n` +
        `正在尝试修复...\n`
      );

      try {
        const currentContent = await FileSystem.readAsStringAsync(
          FileSystem.documentDirectory + 'characters.json',
          { encoding: FileSystem.EncodingType.UTF8 }
        );
        const currentCharacters = JSON.parse(currentContent);
        const currentCharacter = currentCharacters.find((c: Character) => c.id === character.id);

        Alert.alert('当前存储状态',
          `角色: ${currentCharacter?.name}\n` +
          `朋友圈数量: ${currentCharacter?.circlePosts?.length || 0}\n` +
          `保存状态: ${currentCharacter ? '已找到' : '未找到'}`
        );
      } catch (readError) {
        Alert.alert('读取失败',
          `无法读取当前存储状态:\n${readError}`
        );
      }
      
      throw error;
    }
  };

  const deleteCharacters = async (ids: string[]) => {
    try {
      // 1. 删除本地图片资源
      for (const id of ids) {
        await deleteCharacterImages(id);
      }
      console.log('[CharactersContext] 已删除角色本地图片资源');

      // 2. 删除基本信息
      const updatedCharacters = characters.filter(char => !ids.includes(char.id));
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        JSON.stringify(updatedCharacters),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      // 3. 删除角色设定文件夹
      for (const id of ids) {
        const charDir = `${FileSystem.documentDirectory}app/characters/${id}`;
        await FileSystem.deleteAsync(charDir, { idempotent: true });
      }

      setCharacters(updatedCharacters);
      
      // 清理其他相关数据...
      setConversationIdMap(prevMap => {
        const updatedMap = { ...prevMap };
        ids.forEach(id => delete updatedMap[id]);
        FileSystem.writeAsStringAsync(
          FileSystem.documentDirectory + 'conversationIdMap.json',
          JSON.stringify(updatedMap),
          { encoding: FileSystem.EncodingType.UTF8 }
        ).catch(error => console.error('删除 conversationIdMap 条目失败:', error));
        return updatedMap;
      });

      // Clear messages for deleted characters
      setMessagesMap(prevMessages => {
        const updatedMessages = { ...prevMessages };
        ids.forEach(id => delete updatedMessages[id]);
        saveMessages(updatedMessages);
        return updatedMessages;
      });

    } catch (error) {
      console.error('Failed to delete characters:', error);
      throw error;
    }
  };

  const addConversation = async (conversation: SidebarItemProps) => {
    setConversations(prevConversations => {
      const updatedConversations = [...prevConversations, conversation];
      FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'conversations.json',
        JSON.stringify(updatedConversations),
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(error => console.error('保存对话数据失败:', error));

      setConversationIdMap(prevMap => {
        const updatedMap = { ...prevMap, [conversation.id]: '' };
        FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'conversationIdMap.json',
        JSON.stringify(updatedMap),
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(error => console.error('保存 conversationIdMap 失败:', error));
        return updatedMap;
      });

      return updatedConversations;
    });
  };

  const getConversationId = (conversationId: string) => {
    return conversationIdMap[conversationId] || '';
  };

  const setConversationId = (conversationId: string, difyConversationId: string) => {
    setConversationIdMap(prevMap => {
      const updatedMap = { ...prevMap, [conversationId]: difyConversationId };
      FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'conversationIdMap.json',
        JSON.stringify(updatedMap),
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(error => console.error('保存 conversationIdMap 失败:', error));
      return updatedMap;
    });
  };

  const getApiKey = () => {
    return user?.settings?.chat.characterApiKey || '';
  };

  const getCharacterConversationId = (characterId: string) => {
    const character = characters.find(char => char.id === characterId);
    return character?.conversationId;
  };

  // New message management functions
  const getMessages = (conversationId: string) => {
    return messagesMap[conversationId] || [];
  };

  const addMessage = async (conversationId: string, message: Message) => {
    setMessagesMap(prevMap => {
      const currentMessages = prevMap[conversationId] || [];
      
      if (message.sender === 'bot' && !message.isLoading) {
        // 移除所有加载状态的消息
        const filteredMessages = currentMessages.filter(msg => !msg.isLoading);
        // 检查消息是否已存在
        const messageExists = filteredMessages.some(msg => msg.id === message.id);
        if (!messageExists) {
          filteredMessages.push(message);
        }
        
        const updatedMap = {
          ...prevMap,
          [conversationId]: filteredMessages
        };
        
        saveMessages(updatedMap);
        return updatedMap;
      } else {
        // 检查消息是否已存在
        const messageExists = currentMessages.some(msg => msg.id === message.id);
        if (messageExists) {
          return prevMap; // 如果消息已存在，返回原状态
        }
        
        const newMessages = [...currentMessages, message];
        const updatedMap = {
          ...prevMap,
          [conversationId]: newMessages
        };
        
        saveMessages(updatedMap);
        return updatedMap;
      }
    });
  };

  const clearMessages = async (conversationId: string) => {
    const newMessagesMap = { ...messagesMap };
    delete newMessagesMap[conversationId];
    setMessagesMap(newMessagesMap);
    await saveMessages(newMessagesMap);
  };

  // Add loadMemos function
  const loadMemos = async () => {
    try {
      const memosStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'memos.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => '[]');

      const loadedMemos: Memo[] = JSON.parse(memosStr);
      setMemos(loadedMemos);
    } catch (error) {
      console.error('Failed to load memos:', error);
      setMemos([]);
    }
  };

  // Add saveMemos function
  const saveMemos = async (newMemos: Memo[]) => {
    try {
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'memos.json',
        JSON.stringify(newMemos),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Failed to save memos:', error);
      throw error;
    }
  };

  // Add memo management functions
  const addMemo = async (content: string) => {
    const firstLine = content.split('\n')[0];
    const newMemo: Memo = {
      id: String(Date.now()),
      title: firstLine,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedMemos = [...memos, newMemo];
    await saveMemos(updatedMemos);
    setMemos(updatedMemos);
  };

  const updateMemo = async (id: string, content: string) => {
    const updatedMemos = memos.map(memo =>
      memo.id === id
        ? { ...memo, content, updatedAt: new Date().toISOString() }
        : memo
    );
    await saveMemos(updatedMemos);
    setMemos(updatedMemos);
  };

  const deleteMemo = async (id: string) => {
    const updatedMemos = memos.filter(memo => memo.id !== id);
    await saveMemos(updatedMemos);
    setMemos(updatedMemos);
  };

  const rateMessage = async (conversationId: string, messageId: string, isUpvote: boolean) => {
    const currentMessages = messagesMap[conversationId] || [];
    const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) return;

    const message = currentMessages[messageIndex];
    let newRating = message.rating || 0;

    // 如果当前评分与新评分方向相反，先重置评分
    if ((isUpvote && newRating < 0) || (!isUpvote && newRating > 0)) {
      newRating = 0;
    }

    // 根据评分方向更新评分，确保在 [-3, 3] 范围内
    if (isUpvote && newRating < 3) {
      newRating += 1;
    } else if (!isUpvote && newRating > -3) {
      newRating -= 1;
    }

    const updatedMessage = { ...message, rating: newRating };
    const updatedMessages = [...currentMessages];
    updatedMessages[messageIndex] = updatedMessage;

    setMessagesMap(prev => ({
      ...prev,
      [conversationId]: updatedMessages
    }));

    await saveMessages({
      ...messagesMap,
      [conversationId]: updatedMessages
    });
  };

  const loadFavorites = async () => {
    try {
      const favoritesStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'favorites.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => '[]');

      setFavorites(JSON.parse(favoritesStr));
    } catch (error) {
      console.error('Failed to load favorites:', error);
      setFavorites([]);
    }
  };

  const saveFavorites = async (newFavorites: CirclePost[]) => {
    try {
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'favorites.json',
        JSON.stringify(newFavorites),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  };

  const toggleFavorite = async (characterId: string, postId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
  
    // 创建更新后的角色对象，确保 circlePosts 存在
    if (!character.circlePosts) {
      character.circlePosts = [];
    }
  
    // 查找要更新的帖子
    const postIndex = character.circlePosts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
  
    // 创建更新后的帖子对象
    const post = character.circlePosts[postIndex];
    const isFavorited = !post.isFavorited;
  
    // 更新帖子的收藏状态
    character.circlePosts = character.circlePosts.map(p =>
      p.id === postId ? { ...p, isFavorited } : p
    );
  
    // 更新收藏列表
    if (isFavorited) {
      setFavorites(prev => [...prev, post]);
    } else {
      setFavorites(prev => prev.filter(p => p.id !== postId));
    }
  
    // 保存更新
    await updateCharacter(character);
    await saveFavorites(favorites);
  };

  const getFavorites = () => favorites;
  
  // 摇篮系统相关功能实现
  const loadCradleSettings = async () => {
    try {
      console.log('[摇篮系统] 开始加载摇篮设置');
      const settingsStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'cradle_settings.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => JSON.stringify({
        enabled: false,
        duration: 7,
        progress: 0
      }));

      const settings = JSON.parse(settingsStr);
      console.log('[摇篮系统] 加载的设置:', settings);
      
      // 如果摇篮已启用，计算当前进度
      if (settings.enabled && settings.startDate) {
        const startDate = new Date(settings.startDate);
        const currentDate = new Date();
        const elapsedDays = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const totalDuration = settings.duration || 7;
        
        // 计算进度百分比，最大100%
        settings.progress = Math.min(Math.round((elapsedDays / totalDuration) * 100), 100);
        console.log(`[摇篮系统] 计算进度: 已过${elapsedDays.toFixed(1)}天，总共${totalDuration}天，进度${settings.progress}%`);
      }
      
      setCradleSettings(settings);
    } catch (error) {
      console.error('[摇篮系统] 加载摇篮设置失败:', error);
      setCradleSettings({
        enabled: false,
        duration: 7,
        progress: 0,
        feedInterval: 1
      });
    }
  };
  
  const saveCradleSettings = async (settings: CradleSettings) => {
    try {
      console.log('[摇篮系统] 保存摇篮设置:', settings);
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'cradle_settings.json',
        JSON.stringify(settings),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('[摇篮系统] 保存摇篮设置失败:', error);
    }
  };
  
  const updateCradleSettings = async (settings: CradleSettings) => {
    console.log('[摇篮系统] 更新摇篮设置:', settings);
    await saveCradleSettings(settings);
    setCradleSettings(settings);
    
    // 重新初始化 CradleService
    if (settings.enabled) {
      console.log('[摇篮系统] 摇篮系统已启用，初始化服务');
      cradleService.initialize();
    } else {
      console.log('[摇篮系统] 摇篮系统已禁用，关闭服务');
      cradleService.shutdown();
    }
    
    // 如果启用了摇篮系统，但没有设置开始日期，则设置为当前日期
    if (settings.enabled && !settings.startDate) {
      settings.startDate = new Date().toISOString();
      await saveCradleSettings(settings);
      setCradleSettings(settings);
    }
  };
  
  const getCradleSettings = () => {
    return cradleSettings;
  };
  
  // 加载摇篮角色列表
  const loadCradleCharacters = async () => {
    try {
      console.log('[摇篮系统] 开始加载摇篮角色');
      const charactersStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'cradle_characters.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => '[]');

      const loadedCharacters: CradleCharacter[] = JSON.parse(charactersStr);
      console.log('[摇篮系统] 加载了', loadedCharacters.length, '个摇篮角色');
      setCradleCharacters(loadedCharacters);
    } catch (error) {
      console.error('[摇篮系统] 加载摇篮角色失败:', error);
      setCradleCharacters([]);
    }
  };
  
  // 保存摇篮角色列表
  const saveCradleCharacters = async (newCradleCharacters: CradleCharacter[]) => {
    try {
      console.log('[摇篮系统] 保存摇篮角色列表，数量:', newCradleCharacters.length);
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'cradle_characters.json',
        JSON.stringify(newCradleCharacters),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('[摇篮系统] 保存摇篮角色列表失败:', error);
    }
  };
  
  // 获取摇篮角色列表
  const getCradleCharacters = () => {
    // Filter characters to get only those in the cradle system and cast them to CradleCharacter
    const cradleChars = characters
      .filter(char => char.inCradleSystem)
      .map(char => ({
        ...char,
        feedHistory: (char as CradleCharacter).feedHistory || [],
        inCradleSystem: true,
        isCradleGenerated: (char as CradleCharacter).isCradleGenerated || false,
        importedFromCharacter: (char as CradleCharacter).importedFromCharacter || false,
        importedCharacterId: (char as CradleCharacter).importedCharacterId || null
      } as CradleCharacter));
    
    console.log(`[CharactersContext] 获取摇篮角色列表, 共 ${cradleChars.length} 个角色`);
    return cradleChars;
  };
  
  // 添加摇篮角色
  const addCradleCharacter = async (character: CradleCharacter) => {
    try {
      console.log(`[CharactersContext] 开始添加摇篮角色: ${character.name}, ID: ${character.id}`);
      
      // 确保circlePosts有唯一键
      if (character.circlePosts && character.circlePosts.length > 0) {
        character.circlePosts = character.circlePosts.map(post => ({
          ...post,
          id: post.id.includes('post-') ? post.id : `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` // 确保唯一ID
        }));
      }
      
      // Ensure the character has all required fields
      const completeCharacter: CradleCharacter = {
        ...character,
        createdAt: character.createdAt || Date.now(),
        updatedAt: Date.now(),
        inCradleSystem: true,
        isCradleGenerated: character.isCradleGenerated || false,
        feedHistory: character.feedHistory || [],
        imageGenerationStatus: character.imageGenerationStatus || 'idle',
        imageGenerationTaskId: character.imageGenerationTaskId || null,
      };
  
      // Add to characters state and persist to storage
      setCharacters(prevChars => [...prevChars, completeCharacter]);
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        JSON.stringify([...characters, completeCharacter]),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      console.log(`[CharactersContext] 摇篮角色添加成功: ${character.name}, ID: ${character.id}`);
      return character.id;
    } catch (error) {
      console.error('[CharactersContext] 添加摇篮角色失败:', error);
      throw error;
    }
  };
  
  // 更新摇篮角色
  const updateCradleCharacter = async (updatedCharacter: CradleCharacter): Promise<void> => {
    try {
      console.log(`[CharactersContext] 开始更新摇篮角色: ${updatedCharacter.name}, ID: ${updatedCharacter.id}`);
      
      // Update character in state
      setCharacters(prevChars => prevChars.map(char => 
        char.id === updatedCharacter.id ? { ...updatedCharacter, updatedAt: Date.now() } : char
      ));
      
      // Update character in storage
      const updatedCharacters = characters.map(char => 
        char.id === updatedCharacter.id ? { ...updatedCharacter, updatedAt: Date.now() } : char
      );
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        JSON.stringify(updatedCharacters),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      console.log(`[CharactersContext] 摇篮角色更新成功: ${updatedCharacter.name}, ID: ${updatedCharacter.id}`);
    } catch (error) {
      console.error('[CharactersContext] 更新摇篮角色失败:', error);
      throw error;
    }
  };
  
  // 删除摇篮角色
  const deleteCradleCharacter = async (id: string) => {
    console.log('[摇篮系统] 删除摇篮角色:', id);
    
    try {
      // Delete local images for this character
      await deleteCharacterImages(id);
      console.log('[摇篮系统] 已删除角色本地图片资源');
      
      // Remove character from state
      const updatedCharacters = characters.filter(char => char.id !== id);
      setCharacters(updatedCharacters);
      
      // Save updated character list to storage
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        JSON.stringify(updatedCharacters),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      console.log('[摇篮系统] 摇篮角色删除成功');
    } catch (error) {
      console.error('[摇篮系统] 删除摇篮角色失败:', error);
      throw error;
    }
  };
  
  // 添加投喂内容
const addFeed = async (characterId: string, content: string, type: 'text' | 'voice' | 'image' | 'aboutMe' | 'material' | 'knowledge' = 'text') => {
  console.log(`[摇篮系统] 向角色 ${characterId} 投喂内容，类型: ${type}`);
  
  // 修复: 直接从characters数组中查找该角色，而不是从cradleCharacters中查找
  // 这样可以确保我们能找到所有标记为inCradleSystem的角色
  const character = characters.find(char => char.id === characterId && char.inCradleSystem);
  
  if (!character) {
    console.error('[摇篮系统] 未找到目标摇篮角色');
    throw new Error('未找到目标摇篮角色');
  }
  
  // 将character转换为CradleCharacter类型，确保feedHistory存在
  const cradleCharacter = character as CradleCharacter;
  if (!cradleCharacter.feedHistory) {
    cradleCharacter.feedHistory = [];
  }
  
  // 创建新的投喂记录
  const newFeed: Feed = {
    id: Date.now().toString(),
    content,
    timestamp: Date.now(),
    type,
    processed: false
  };
  
  // 添加到角色的投喂历史
  const updatedCharacter: CradleCharacter = {
    ...cradleCharacter,
    feedHistory: [...cradleCharacter.feedHistory, newFeed]
  };
  
  // 更新角色
  await updateCradleCharacter(updatedCharacter);
  console.log('[摇篮系统] 投喂内容添加成功');
};

// 标记投喂内容为已处理 - 也需要同样的修复
const markFeedAsProcessed = async (characterId: string, feedId: string) => {
  console.log(`[摇篮系统] 标记角色 ${characterId} 的投喂内容 ${feedId} 为已处理`);
  
  // 同样修复查找逻辑
  const character = characters.find(char => char.id === characterId && char.inCradleSystem) as CradleCharacter;
  if (!character || !character.feedHistory) {
    console.error('[摇篮系统] 未找到目标摇篮角色或投喂历史');
    return;
  }
  
  // 更新投喂状态
  const updatedFeedHistory = character.feedHistory.map(feed => 
    feed.id === feedId ? { ...feed, processed: true } : feed
  );
  
  // 更新角色
  const updatedCharacter: CradleCharacter = {
    ...character,
    feedHistory: updatedFeedHistory
  };
  
  await updateCradleCharacter(updatedCharacter);
  console.log('[摇篮系统] 投喂内容已标记为已处理');
};

  // 从摇篮生成正式角色
const generateCharacterFromCradle = async (cradleCharacterId: string): Promise<Character> => {
  console.log('[摇篮系统] 开始从摇篮生成正式角色', cradleCharacterId);
  
  const cradleCharacter = characters.find(char => char.id === cradleCharacterId) as CradleCharacter;
  if (!cradleCharacter) {
    console.error('[摇篮系统] 未找到目标摇篮角色');
    throw new Error('未找到目标摇篮角色');
  }
  
  try {
    // 使用处理过的投喂内容构建角色个性
    const processedFeeds = cradleCharacter.feedHistory?.filter(feed => feed.processed) || [];
    console.log(`[摇篮系统] 共有 ${processedFeeds.length} 条已处理的投喂内容`);
    
    if (processedFeeds.length === 0) {
      console.warn('[摇篮系统] 该角色没有处理过的投喂内容，可能会导致性格不完整');
    }
    
    // 处理角色个性和设定 - 基于已处理的投喂数据生成
    let personality = cradleCharacter.personality || "";
    let description = cradleCharacter.description || "";
    let interests = [...(cradleCharacter.interests || [])];
    let tags: string[] = [];
    
    // 根据投喂数据生成更丰富的性格描述
    if (processedFeeds.length > 0) {
      // 简单合并所有投喂的文本来生成一个性格概要
      const feedTexts = processedFeeds.map(feed => feed.content).join(' ');
      
      // 简单的关键词提取来增强性格描述
      const keywords = extractKeywordsFromFeeds(feedTexts);
      if (keywords.length > 0) {
        personality = `${personality}${personality ? '。' : ''} 
        性格特点包括: ${keywords.join('、')}。基于用户的投喂内容形成的独特个性。`;
        
        // 增强描述
        if (!description.includes('投喂')) {
          description = `${description}${description ? '。' : ''}通过摇篮系统培育，基于${processedFeeds.length}条用户投喂数据生成的定制AI角色。`;
        }
        
        // 从投喂数据中提取可能的兴趣爱好
        const extractedInterests = extractInterestsFromFeeds(feedTexts);
        if (extractedInterests.length > 0) {
          interests = [...new Set([...interests, ...extractedInterests])];
        }
      }
      
      // 提取标签
      tags = extractTagsFromFeeds(processedFeeds);
    }
    
    // 获取API设置的角色数据
    // 如果 cradleService 处理了投喂数据，尝试获取生成的角色数据
    const generatedCharacterData = cradleService.getCurrentCharacterData();
    
    // 准备角色JSON数据 (类似create_char.tsx中的结构)
    const jsonData: any = {
      roleCard: {
        name: cradleCharacter.name || "新角色",
        first_mes: "你好，很高兴认识你！",
        description: description || `这是一个通过摇篮系统培育的AI角色，基于${processedFeeds.length}条投喂数据生成。`,
        personality: personality || "友好、随和，喜欢与人交流。基于投喂的内容动态生成的性格。",
        scenario: "",
        mes_example: "",
        data: {
          extensions: {
            regex_scripts: []
          }
        }
      },
      worldBook: {
        entries: {}
      },
      preset: {
        prompts: [],
        prompt_order: [{ order: [] }]
      },
      authorNote: {
        charname: cradleCharacter.name || "新角色",
        username: "用户",
        content: "",
        injection_depth: 0
      }
    };
    
    // 使用生成的角色数据更新jsonData
    if (generatedCharacterData.roleCard) {
      console.log('[摇篮系统] 使用生成服务产生的角色卡片数据');
      jsonData.roleCard = {
        ...jsonData.roleCard,
        ...generatedCharacterData.roleCard
      };
      
      // 确保基本字段从roleCard同步到Character主属性
      personality = jsonData.roleCard.personality || personality;
      description = jsonData.roleCard.description || description;
    }
    
    // 处理世界书数据
    if (generatedCharacterData.worldBook && generatedCharacterData.worldBook.entries) {
      jsonData.worldBook = generatedCharacterData.worldBook;
    } else {
      // 如果没有生成的世界书，创建基本的世界书条目
      const worldBookEntries = generateWorldInfoEntriesFromFeeds(processedFeeds);
      
      // 把生成的条目转换为worldBook格式
      worldBookEntries.forEach((entry, index) => {
        jsonData.worldBook.entries[`entry_${index}`] = {
          comment: entry.comment,
          content: entry.content,
          disable: false,
          position: entry.position || 4,
          constant: true,
          key: entry.key || [],
          order: index,
          depth: entry.depth || 1,
          vectorized: false
        };
      });
      
      // 如果有Alist条目，尝试提取更多信息
      const alistEntry = jsonData.worldBook.entries["Alist"];
      if (alistEntry && alistEntry.content) {
        // 从Alist中提取兴趣爱好
        const likesMatch = alistEntry.content.match(/<likes>(.*?)<\/likes>/);
        if (likesMatch && likesMatch[1] && likesMatch[1] !== "未指定") {
          const extractedLikes = likesMatch[1].split('、').map((item: string) => item.trim());
          if (extractedLikes.length > 0) {
            interests = [...new Set([...interests, ...extractedLikes])];
          }
        }
      }
    }
    
    // 构建角色基本信息 - 确保使用新的唯一ID
    const characterId = Date.now().toString();
    console.log('[摇篮系统] 为新角色生成ID:', characterId);
    
    // 确保所有必要的展示字段都存在
    const newCharacter: Character = {
      id: characterId,
      name: cradleCharacter.name || "新角色",
      avatar: cradleCharacter.avatar || null,
      backgroundImage: cradleCharacter.backgroundImage || null,
      description: description,
      personality: personality,
      interests: interests.length > 0 ? interests : ["聊天", "社交"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      conversationId: characterId, // 确保设置conversationId与角色ID相同
      // 添加标记，表明这是从摇篮生成的角色
      isSystem: false,
      isCradleGenerated: true,
      
      // 确保这些关键展示字段存在
      circlePosts: [],
      tags: tags,

      // 将JSON数据序列化为字符串保存
      jsonData: JSON.stringify(jsonData),
      
      // 可选字段
      age: extractAgeFromFeeds(processedFeeds) || "未知",
      gender: extractGenderFromFeeds(processedFeeds) || "未指定",
    };
    
    console.log('[摇篮系统] 准备添加角色:', newCharacter.id, newCharacter.name);
    
    try {
      // 从摇篮系统中移除该角色 - 在添加新角色之前先删除，避免状态冲突
      await deleteCradleCharacter(cradleCharacterId);
      console.log('[摇篮系统] 从摇篮系统中移除角色成功:', cradleCharacterId);
      
      // 添加到角色列表 - 确保这个操作完成
      await addCharacter(newCharacter);
      console.log('[摇篮系统] 成功添加角色到角色库:', characterId, newCharacter.name);
      
      // 为角色创建对话 - 确保有完整的会话数据
      const conversation: SidebarItemProps = {
        id: characterId,
        title: newCharacter.name,
        name: newCharacter.name,
        avatar: newCharacter.avatar ? { uri: newCharacter.avatar } : undefined,
        description: newCharacter.description || "",
      };
      
      await addConversation(conversation);
      console.log('[摇篮系统] 成功创建角色对话:', characterId, newCharacter.name);
      
      // 确保角色已添加到state中
      setCharacters(prevChars => {
        const exists = prevChars.some(c => c.id === characterId);
        if (!exists) {
          console.log('[摇篮系统] 手动更新角色状态以确保UI刷新');
          return [...prevChars, newCharacter];
        }
        return prevChars;
      });
      
      console.log('[摇篮系统] 成功生成角色:', newCharacter.name);
      
      return newCharacter;
    } catch (error) {
      console.error('[摇篮系统] 添加角色过程中出错:', error);
      throw new Error(`添加角色失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  } catch (error) {
    console.error('[摇篮系统] 生成角色时出错:', error);
    throw new Error(`生成角色失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 从投喂数据生成世界设定条目
const generateWorldInfoEntriesFromFeeds = (feeds: Feed[]): Array<{
  comment: string;
  content: string;
  position?: number;
  key?: string[];
  depth?: number;
}> => {
  // 创建世界设定条目数组
  const worldInfo = [];
  
  // 合并所有投喂内容进行分析
  const allContent = feeds.map(feed => feed.content).join('\n\n');
  
  // 提取关键词和兴趣爱好
  const traits = extractKeywordsFromFeeds(allContent);
  const interests = extractInterestsFromFeeds(allContent);
  const gender = extractGenderFromFeeds(feeds) || '未指定';
  const age = extractAgeFromFeeds(feeds) || '未知';
  
  // 创建基本角色属性条目
  worldInfo.push({
    comment: '基本属性',
    content: `<attributes>
  <personality>${traits.join('、')}</personality>
  <gender>${gender}</gender>
  <age>${age}</age>
  <likes>${interests.length > 0 ? interests.join('、') : '未指定'}</likes>
</attributes>`,
    position: 4,
    key: [],
    depth: 1
  });
  
  // 尝试提取角色背景故事
  if (allContent.length > 200) {
    worldInfo.push({
      comment: '角色背景',
      content: `这个角色是基于用户提供的${feeds.length}条投喂数据生成的。
根据这些数据，可以推断该角色${gender}，年龄约为${age}岁。
性格特点包括：${traits.join('、')}。
兴趣爱好包括：${interests.length > 0 ? interests.join('、') : '尚未明确'}。`,
      position: 3,
      key: [],
      depth: 1
    });
  }
  
  // 创建对话示例条目
  worldInfo.push({
    comment: '对话示例',
    content: `用户：你好！
角色：你好！很高兴认识你！我是一个通过摇篮系统培育的AI角色，很期待和你交流！`,
    position: 4,
    key: [],
    depth: 1
  });
  
  return worldInfo;
};

  // 新增方法: 导入常规角色到摇篮系统
  const importCharacterToCradle = async (characterId: string): Promise<void> => {
    console.log('[摇篮系统] 导入常规角色到摇篮:', characterId);
    
    // 查找要导入的角色
    const character = characters.find(char => char.id === characterId);
    if (!character) {
      console.error('[摇篮系统] 未找到指定角色');
      throw new Error('未找到指定角色');
    }
    
    // 检查该角色是否已在摇篮系统中
    const existingCradleChar = cradleCharacters.find(
      char => char.importedCharacterId === characterId
    );
    
    if (existingCradleChar) {
      console.error('[摇篮系统] 该角色已在摇篮系统中');
      throw new Error('该角色已在摇篮系统中');
    }
    
    // 创建一个摇篮角色版本并确保唯一ID
    const uniqueCradleId = `cradle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // 确保circlePosts有唯一键
    let modifiedCirclePosts = [];
    if (character.circlePosts && character.circlePosts.length > 0) {
      modifiedCirclePosts = character.circlePosts.map(post => ({
        ...post,
        id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` // 确保唯一ID
      }));
    }
    
    // 下载并本地保存角色的图像
    let localAvatarUri = null;
    let localBackgroundUri = null;
    
    try {
      // 下载头像
      if (character.avatar) {
        localAvatarUri = await downloadAndSaveImage(character.avatar, uniqueCradleId, 'avatar');
        console.log('[摇篮系统] 头像已保存到本地:', localAvatarUri);
      }
      
      // 下载背景图片
      if (character.backgroundImage) {
        localBackgroundUri = await downloadAndSaveImage(character.backgroundImage, uniqueCradleId, 'background');
        console.log('[摇篮系统] 背景图片已保存到本地:', localBackgroundUri);
      }
    } catch (error) {
      console.error('[摇篮系统] 保存图片时出错:', error);
      // 继续导入流程，即使图片保存失败
    }
    
    const cradleCharacter: CradleCharacter = {
      ...character,                         
      id: uniqueCradleId,                   // 使用确保唯一的ID
      inCradleSystem: true,                 
      feedHistory: [],                      
      importedFromCharacter: true,          
      importedCharacterId: character.id,
      circlePosts: modifiedCirclePosts,     // 使用修改过的circlePosts
      backgroundImage: character.backgroundImage, // 保留原始URL
      localBackgroundImage: localBackgroundUri, // 保存本地文件URI
      avatar: localAvatarUri || character.avatar, // 优先使用本地头像
      updatedAt: Date.now()
    };
    
    // 添加到摇篮系统
    await addCradleCharacter(cradleCharacter);
    
    console.log('[摇篮系统] 成功导入角色到摇篮:', character.name);
  };

  // Add feed to cradle service
  const addFeedToCradle = async (content: string, type: FeedType): Promise<string> => {
    console.log('[摇篮系统] 添加投喂内容到摇篮系统', type);
    
    try {
      // Update the cradle service API settings before adding feed
      if (cradleApiSettings.apiProvider === 'openrouter' && 
          cradleApiSettings.openrouter?.enabled) {
        cradleService.updateApiSettings(cradleApiSettings);
      }
      
      // Use the cradle service to add the feed
      const feedId = cradleService.addFeed(content, type);
      
      // Return the feed ID
      return feedId;
    } catch (error) {
      console.error('[摇篮系统] 添加投喂内容失败:', error);
      throw error;
    }
  };
  
  // Get feed history from cradle service
  const getFeedHistory = () => {
    return cradleService.getAllFeeds();
  };
  
  // Process feeds now (manually triggered)
  const processFeedsNow = async (): Promise<void> => {
    console.log('[摇篮系统] 手动处理投喂数据');
    
    try {
      // Update the cradle service API settings before processing
      if (cradleApiSettings.apiProvider === 'openrouter' && 
          cradleApiSettings.openrouter?.enabled) {
        cradleService.updateApiSettings(cradleApiSettings);
      }
      
      const result = await cradleService.processFeeds();
      if (!result) {
        console.log('[摇篮系统] 没有需要处理的投喂数据');
        return;
      }
      
      console.log('[摇篮系统] 处理结果:', result.success ? '成功' : '失败');
      
      if (!result.success) {
        throw new Error(result.errorMessage || '处理投喂数据失败');
      }
    } catch (error) {
      console.error('[摇篮系统] 处理投喂数据时出错:', error);
      throw error;
    }
  };

  // Load Cradle API settings
  const loadCradleApiSettings = async () => {
    try {
      console.log('[摇篮系统] 开始加载摇篮API设置');
      const settingsStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'cradle_api_settings.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => JSON.stringify({
        apiProvider: 'gemini'
      }));

      const settings = JSON.parse(settingsStr);
      console.log('[摇篮系统] 加载的API设置:', settings);
      
      setCradleApiSettings(settings);
      
      // Update the cradle service with the loaded settings
      if (settings.apiProvider === 'openrouter' && 
          settings.openrouter?.enabled &&
          settings.openrouter?.apiKey) {
        cradleService.updateApiSettings(settings);
      }
      
    } catch (error) {
      console.error('[摇篮系统] 加载摇篮API设置失败:', error);
      setCradleApiSettings({
        apiProvider: 'gemini'
      });
    }
  };
  
  // Save Cradle API settings
  const saveCradleApiSettings = async (settings: {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }) => {
    try {
      console.log('[摇篮系统] 保存摇篮API设置:', settings);
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'cradle_api_settings.json',
        JSON.stringify(settings),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      // Update the cradle service with the new settings
      cradleService.updateApiSettings(settings);
      
    } catch (error) {
      console.error('[摇篮系统] 保存摇篮API设置失败:', error);
    }
  };
  
  // Update Cradle API settings
  const updateCradleApiSettings = async (settings: {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }) => {
    console.log('[摇篮系统] 更新摇篮API设置:', settings);
    await saveCradleApiSettings(settings);
    setCradleApiSettings(settings);
  };
  
  // Get Cradle API settings
  const getCradleApiSettings = () => {
    return cradleApiSettings;
  };

  // Add this function before the return statement in CharactersProvider
const checkCradleGeneration = (): {
  readyCharactersCount: number;
  readyCharacters: CradleCharacter[];
} => {
  console.log('[摇篮系统] 检查摇篮角色的生成状态');
  
  const readyCharacters: CradleCharacter[] = [];
  
  // Get all cradle characters
  const allCradleCharacters = getCradleCharacters();
  const duration = cradleSettings.duration || 7; // Default duration: 7 days
  
  // Check which characters are ready based on creation time and cradle duration
  for (const character of allCradleCharacters) {
    if (character.isCradleGenerated) {
      // Skip characters that are already marked as generated
      continue;
    }
    
    const createdAt = character.createdAt;
    const now = Date.now();
    const elapsedDays = (now - createdAt) / (24 * 60 * 60 * 1000); // Convert ms to days
    
    if (elapsedDays >= duration) {
      // This character is ready for generation
      readyCharacters.push(character);
      console.log(`[摇篮系统] 角色 "${character.name}" 已经培育了 ${elapsedDays.toFixed(1)} 天，准备好生成`);
    } else {
      console.log(`[摇篮系统] 角色 "${character.name}" 培育中，已经 ${elapsedDays.toFixed(1)} 天，总共需要 ${duration} 天`);
    }
  }
  
  return {
    readyCharactersCount: readyCharacters.length,
    readyCharacters
  };
};

// 从投喂数据中提取关键词
const extractKeywordsFromFeeds = (text: string): string[] => {
  const result: string[] = [];
  
  // 常见性格关键词列表
  const commonTraits = [
    '友好', '开朗', '温柔', '活泼', '安静', '内向', '外向', 
    '耐心', '热情', '认真', '细心', '幽默', '聪明', '文艺'
  ];
  
  // 检查文本中是否包含这些关键词
  for (const trait of commonTraits) {
    if (text.toLowerCase().includes(trait.toLowerCase())) {
      result.push(trait);
    }
  }
  
  // 如果没有找到任何关键词，返回一些默认值
  return result.length > 0 ? result : ['友好', '个性化'];
};

// 从投喂数据中提取兴趣爱好
const extractInterestsFromFeeds = (text: string): string[] => {
  // 常见兴趣爱好列表
  const commonInterests = [
    '阅读', '写作', '音乐', '电影', '绘画', '摄影', '旅行', '烹饪', 
    '游戏', '体育', '舞蹈', '园艺', '编程', '手工', '收藏', '徒步',
    '瑜伽', '冥想', '宠物', '时尚', '科技', '历史', '科学', '艺术'
  ];
  
  const result = [];
  // 遍历兴趣列表，检查文本中是否包含这些关键词
  for (const interest of commonInterests) {
    if (text.toLowerCase().includes(interest.toLowerCase())) {
      result.push(interest);
    }
  }
  
  return result;
};

// 从投喂数据中提取年龄
const extractAgeFromFeeds = (feeds: Feed[]): string | undefined => {
  for (const feed of feeds) {
    const ageMatch = feed.content.match(/年龄[：:]\s*(\d+)/i) || 
                    feed.content.match(/(\d+)\s*岁/i);
    if (ageMatch && ageMatch[1]) {
      return ageMatch[1];
    }
  }
  return undefined;
};

// 从投喂数据中提取性别
const extractGenderFromFeeds = (feeds: Feed[]): string | undefined => {
  for (const feed of feeds) {
    if (feed.content.includes('女') || 
        feed.content.toLowerCase().includes('female') || 
        feed.content.toLowerCase().includes('girl')) {
      return '女';
    }
    if (feed.content.includes('男') || 
        feed.content.toLowerCase().includes('male') || 
        feed.content.toLowerCase().includes('boy')) {
      return '男';
    }
  }
  return undefined;
};

// 从投喂数据中提取标签
const extractTagsFromFeeds = (feeds: Feed[]): string[] => {
  // 合并所有投喂内容
  const allContent = feeds.map(feed => feed.content).join(' ');
  
  // 常见标签列表
  const commonTags = [
    'AI', '摇篮生成', '虚拟角色', '聊天伙伴', '助手', '定制角色'
  ];
  
  const extractedTags = [];
  // 添加"摇篮生成"和"AI"作为默认标签
  extractedTags.push('摇篮生成', 'AI');
  
  // 根据性别添加标签
  const gender = extractGenderFromFeeds(feeds);
  if (gender === '女') {
    extractedTags.push('女性角色');
  } else if (gender === '男') {
    extractedTags.push('男性角色');
  }
  
  // 添加基于兴趣的标签
  const interests = extractInterestsFromFeeds(allContent);
  if (interests.length > 0) {
    interests.slice(0, 2).forEach(interest => {
      extractedTags.push(`${interest}爱好者`);
    });
  }
  
  return extractedTags;
};

  return (
    <CharactersContext.Provider
      value={{
        characters,
        addCharacter,
        deleteCharacters,
        isLoading,
        conversations,
        addConversation,
        getConversationId,
        setConversationId,
        getApiKey,
        getCharacterConversationId,
        updateCharacter,
        getMessages,
        addMessage,
        clearMessages,
        memos,
        addMemo,
        updateMemo,
        deleteMemo,
        rateMessage,
        toggleFavorite,
        getFavorites,
        setCharacters,
        setIsLoading,
        // 摇篮系统相关方法
        updateCradleSettings,
        getCradleSettings,
        getCradleCharacters,
        checkCradleGeneration,
        addCradleCharacter,
        updateCradleCharacter,
        deleteCradleCharacter,
        importCharacterToCradle,   // 新增方法
        addFeed,
        markFeedAsProcessed,
        generateCharacterFromCradle,
        
        // Add these new methods to the context value:
        addFeedToCradle,
        getFeedHistory,
        processFeedsNow,


        // Add new methods for Cradle API settings
        getCradleApiSettings,
        updateCradleApiSettings,


      }}
    >
      {children}
    </CharactersContext.Provider>
  );
};

export const useCharacters = () => {
  const context = useContext(CharactersContext);
  if (!context) {
    throw new Error('useCharacters must be used within a CharactersProvider');
  }
  return context;
};
