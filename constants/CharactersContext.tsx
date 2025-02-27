import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import {  SidebarItemProps, CharactersContextType, Memo,CradleSettings } from '@/constants/types';
import * as FileSystem from 'expo-file-system';
import { useUser } from './UserContext';
import { Character, Message, CirclePost } from '@/shared/types';
const CharactersContext = createContext<CharactersContextType | undefined>(undefined);

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
  const { user } = useUser();

  useEffect(() => {
    loadCharacters();
    loadConversations();
    loadMessages();
    loadMemos();
    loadFavorites();;
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
      // 1. 删除基本信息
      const updatedCharacters = characters.filter(char => !ids.includes(char.id));
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'characters.json',
        JSON.stringify(updatedCharacters),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      // 2. 删除角色设定文件夹
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
    const updatedCharacter = {
      ...character,
      circlePosts: character.circlePosts || []
    };
  
    // 查找要更新的帖子
    const postIndex = updatedCharacter.circlePosts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
  
    // 创建更新后的帖子对象
    const post = updatedCharacter.circlePosts[postIndex];
    const isFavorited = !post.isFavorited;
  
    // 更新帖子的收藏状态
    updatedCharacter.circlePosts = updatedCharacter.circlePosts.map(p =>
      p.id === postId ? { ...p, isFavorited } : p
    );
  
    // 更新收藏列表
    if (isFavorited) {
      setFavorites(prev => [...prev, post]);
    } else {
      setFavorites(prev => prev.filter(p => p.id !== postId));
    }
  
    // 保存更新
    await updateCharacter(updatedCharacter);
    await saveFavorites(favorites);
  };

  const getFavorites = () => favorites;
  
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
        updateCradleSettings: async () => {}, // Add empty implementation
        getCradleSettings: () => ({ enabled: false, duration: 30, progress: 0 }), // Add default implementation
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
