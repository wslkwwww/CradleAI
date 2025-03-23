import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { MobileMemory } from '../mobile-memory';
import { 
  MemoryConfig, 
  MemoryItem, 
  SearchFilters, 
  SearchResult,
  LLMConfig
} from '../types';
import {
  AddMemoryOptions,
  SearchMemoryOptions,
  DeleteAllMemoryOptions,
  GetAllMemoryOptions
} from '../memory.types';
import { ConfigManager } from '../config/manager';
import { useUser } from '@/constants/UserContext';

interface MemoryContextType {
  loading: boolean;
  error: Error | null;
  memory?: MobileMemory; // 暴露 memory 引用以便访问 updateLLMConfig
  addMemory: (messages: string | any[], options: AddMemoryOptions) => Promise<SearchResult>;
  searchMemory: (query: string, options: SearchMemoryOptions) => Promise<SearchResult>;
  getMemory: (memoryId: string) => Promise<MemoryItem | null>;
  updateMemory: (memoryId: string, data: string) => Promise<{ message: string }>;
  deleteMemory: (memoryId: string) => Promise<{ message: string }>;
  deleteAllMemory: (options: DeleteAllMemoryOptions) => Promise<{ message: string }>;
  resetMemory: () => Promise<void>;
  getAllMemory: (options: GetAllMemoryOptions) => Promise<SearchResult>;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

interface MemoryProviderProps {
  children: React.ReactNode;
  config?: Partial<MemoryConfig>;
}

export const MemoryProvider: React.FC<MemoryProviderProps> = ({ children, config }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [memory, setMemory] = useState<MobileMemory | undefined>(undefined);
  const { user } = useUser();
  
  // 追踪嵌入配置变更
  const zhipuApiKeyRef = useRef<string>('');
  
  // Track LLM config changes
  const llmConfigRef = useRef<LLMConfig | null>(null);
  
  // Add a ref to track if we've logged the "skip initialization" message
  const hasLoggedSkipMessage = useRef(false);
  
  useEffect(() => {
    const initializeMemory = async () => {
      try {
        setLoading(true);
        
        // 获取智谱API密钥
        const zhipuApiKey = user?.settings?.chat?.zhipuApiKey || '';
        
        // 检查API密钥是否变更
        const apiKeyChanged = zhipuApiKeyRef.current !== zhipuApiKey;
        
        // 如果API密钥未变更且记忆实例已存在，则跳过重新初始化
        if (memory && !apiKeyChanged) {
          // Only log this message once to avoid repetition
          if (!hasLoggedSkipMessage.current) {
            console.log('[MemoryProvider] API密钥未变更，跳过重新初始化');
            hasLoggedSkipMessage.current = true;
          }
          setLoading(false);
          return;
        }
        
        // Reset the log tracking if we're actually initializing
        hasLoggedSkipMessage.current = false;
        
        // 更新API密钥引用
        zhipuApiKeyRef.current = zhipuApiKey;
        
        // 保存API密钥到存储中，确保它在整个应用中可用
        try {
          // 尝试使用localStorage（Web）
          if (typeof localStorage !== 'undefined') {
            // 先获取现有设置
            const existingSettingsStr = localStorage.getItem('user_settings');
            const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
            
            // 更新智谱API密钥
            const updatedSettings = {
              ...existingSettings,
              chat: {
                ...(existingSettings.chat || {}),
                zhipuApiKey
              }
            };
            
            // 保存回localStorage
            localStorage.setItem('user_settings', JSON.stringify(updatedSettings));
            console.log('[MemoryProvider] 已保存智谱API密钥到localStorage');
          }
          
          // 尝试使用AsyncStorage（React Native）
          if (typeof require !== 'undefined') {
            try {
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              const existingSettingsStr = await AsyncStorage.getItem('user_settings');
              const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
              
              const updatedSettings = {
                ...existingSettings,
                chat: {
                  ...(existingSettings.chat || {}),
                  zhipuApiKey
                }
              };
              
              await AsyncStorage.setItem('user_settings', JSON.stringify(updatedSettings));
              console.log('[MemoryProvider] 已保存智谱API密钥到AsyncStorage');
            } catch (e) {
              console.log('[MemoryProvider] 保存到AsyncStorage失败:', e);
            }
          }
        } catch (storageError) {
          console.warn('[MemoryProvider] 保存API密钥到存储失败:', storageError);
          // 继续执行，不中断主流程
        }
        
        // 合并用户提供的配置和默认配置
        const mergedConfig = ConfigManager.mergeConfig(config || {});

        // 配置智谱嵌入服务
        console.log('[MemoryProvider] 配置智谱清言嵌入服务');
        mergedConfig.embedder = {
          provider: 'zhipu',
          config: {
            apiKey: zhipuApiKey,
            model: 'embedding-3',
            dimensions: 1024, // 使用1024维度
            url: 'https://open.bigmodel.cn/api/paas/v4/embeddings'
          }
        };
        
        // 设置向量存储维度
        mergedConfig.vectorStore.config.dimension = 1024;
        console.log('[MemoryProvider] 向量存储维度设置为1024（智谱模型）');
        
        // 记录嵌入配置
        console.log(`[MemoryProvider] 使用嵌入提供商: zhipu, API密钥长度: ${zhipuApiKey?.length || 0}`);

        // 重置旧的记忆实例（如果存在）
        if (memory) {
          try {
            console.log('[MemoryProvider] 重置现有记忆实例');
            await memory.reset();
          } catch (resetErr) {
            console.warn('[MemoryProvider] 重置记忆实例失败:', resetErr);
          }
        }

        // 创建新记忆实例
        console.log('[MemoryProvider] 创建新的记忆实例');
        const memoryInstance = new MobileMemory(mergedConfig);
        setMemory(memoryInstance);
        console.log('[MemoryProvider] 记忆系统初始化完成');
        setLoading(false);
      } catch (err) {
        console.error('[MemoryProvider] 初始化记忆系统失败:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    };

    initializeMemory();
  }, [config, user?.settings?.chat?.zhipuApiKey]); // 只在API密钥变更时重新初始化

  // New effect to update LLM config when API settings change
  // Also add log tracking to this effect
  const hasLoggedConfigChange = useRef(false);
  
  useEffect(() => {
    if (!memory || !user?.settings?.chat) return;
    
    // Get current API settings
    const apiProvider = user.settings.chat.apiProvider || 'gemini';
    const apiKey = apiProvider === 'openrouter' 
      ? user.settings.chat.openrouter?.apiKey 
      : user.settings.chat.characterApiKey;
    
    // Get the model based on the provider
    const model = apiProvider === 'openrouter'
      ? user.settings.chat.openrouter?.model || 'openai/gpt-3.5-turbo'
      : 'gemini-2.0-flash-exp';
    
    // Check if the configuration has changed
    const hasChanged = 
      llmConfigRef.current?.apiKey !== apiKey ||
      llmConfigRef.current?.apiProvider !== apiProvider ||
      llmConfigRef.current?.model !== model;
    
    if (hasChanged && apiKey) {
      // Reset log tracking when config changes
      hasLoggedConfigChange.current = false;
      
      console.log('[MemoryProvider] API配置已变更，更新LLM配置:', {
        provider: apiProvider,
        model,
        apiKeyLength: apiKey?.length || 0
      });
      
      // Create the new config
      const newLLMConfig: LLMConfig = {
        apiKey,
        model,
        apiProvider,
        openrouter: apiProvider === 'openrouter' ? {
          enabled: true,
          apiKey: user.settings.chat.openrouter?.apiKey || '',
          model: user.settings.chat.openrouter?.model || 'openai/gpt-3.5-turbo',
          useBackupModels: user.settings.chat.openrouter?.useBackupModels || false,
          backupModels: user.settings.chat.openrouter?.backupModels || []
        } : undefined
      };
      
      // Update memory's LLM config
      memory.updateLLMConfig(newLLMConfig);
      
      // Save the current config for future comparison
      llmConfigRef.current = newLLMConfig;
    } else if (!hasLoggedConfigChange.current) {
      // Log only once that config hasn't changed
      console.log('[MemoryProvider] LLM配置未变更，跳过更新');
      hasLoggedConfigChange.current = true;
    }
  }, [
    memory, 
    user?.settings?.chat?.apiProvider,
    user?.settings?.chat?.characterApiKey,
    user?.settings?.chat?.openrouter?.apiKey,
    user?.settings?.chat?.openrouter?.model
  ]);

  // 记忆系统操作方法
  const addMemory = async (messages: string | any[], options: AddMemoryOptions) => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.add(messages, options);
  };

  const searchMemory = async (query: string, options: SearchMemoryOptions) => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.search(query, options);
  };

  const getMemory = async (memoryId: string) => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.get(memoryId);
  };

  const updateMemory = async (memoryId: string, data: string) => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.update(memoryId, data);
  };

  const deleteMemory = async (memoryId: string) => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.delete(memoryId);
  };

  const deleteAllMemory = async (options: DeleteAllMemoryOptions) => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.deleteAll(options);
  };

  const resetMemory = async () => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.reset();
  };

  const getAllMemory = async (options: GetAllMemoryOptions) => {
    if (!memory) throw new Error('记忆系统未初始化');
    return await memory.getAll(options);
  };

  const value = {
    loading,
    error,
    memory,
    addMemory,
    searchMemory,
    getMemory,
    updateMemory,
    deleteMemory,
    deleteAllMemory,
    resetMemory,
    getAllMemory,
  };

  return (
    <MemoryContext.Provider value={value}>
      {children}
    </MemoryContext.Provider>
  );
};

export const useMemoryContext = () => {
  const context = useContext(MemoryContext);
  if (context === undefined) {
    throw new Error('useMemoryContext must be used within a MemoryProvider');
  }
  return context;
};
