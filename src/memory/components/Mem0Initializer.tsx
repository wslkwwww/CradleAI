import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMemoryContext } from '../providers/MemoryProvider';
import Mem0Service from '../services/Mem0Service';
import { checkInitialState, logApiConfig } from '../utils/debug-helper';
import { useUser } from '@/constants/UserContext';

/**
 * Mem0 初始化组件
 * 用于在应用启动时初始化 Mem0 记忆服务
 * 并在API设置变更时同步更新
 */
const Mem0Initializer: React.FC = () => {
  const { 
    loading, 
    error, 
    addMemory, 
    searchMemory, 
    getMemory,
    updateMemory,
    deleteMemory,
    resetMemory,
    memory // 添加memory引用以便更新配置
  } = useMemoryContext();
  
  const { user } = useUser();
  const [initialized, setInitialized] = useState(false);
  const previousApiKey = useRef<string | null>(null);
  const previousApiProvider = useRef<string | null>(null);
  const previousZhipuApiKey = useRef<string | null>(null);
  
  // 监测API配置变更并更新LLM配置
  useEffect(() => {
    if (!user?.settings?.chat) return;
    
    // 获取当前API提供商和密钥
    const currentApiProvider = user.settings.chat.apiProvider;
    const currentApiKey = currentApiProvider === 'openrouter' 
      ? user.settings.chat.openrouter?.apiKey
      : user.settings.chat.characterApiKey;
    
    // 获取智谱嵌入设置
    const currentZhipuApiKey = user.settings.chat.zhipuApiKey;
    
    // 获取准确的模型信息 - 根据API提供商选择对应的模型
    const currentModel = currentApiProvider === 'openrouter' 
      ? user.settings.chat.openrouter?.model || 'openai/gpt-3.5-turbo'
      : 'gemini-2.0-flash-exp'; // Gemini默认模型
    
    // 在初始化后或配置变更时更新LLM配置
    if (initialized && memory && (
        previousApiKey.current !== currentApiKey || 
        previousApiProvider.current !== currentApiProvider ||
        previousZhipuApiKey.current !== currentZhipuApiKey
    )) {
      console.log('[Mem0Initializer] 检测到API配置变更:');
      console.log(`LLM提供商: ${previousApiProvider.current || 'none'} -> ${currentApiProvider}`);
      console.log(`LLM API密钥状态: ${previousApiKey.current ? '已设置' : '未设置'} -> ${currentApiKey ? '已设置' : '未设置'}`);
      console.log(`智谱API密钥状态: ${previousZhipuApiKey.current ? '已设置' : '未设置'} -> ${currentZhipuApiKey ? '已设置' : '未设置'}`);
      console.log(`API密钥长度: ${currentApiKey?.length || 0}`);
      console.log(`模型: ${currentModel}`);
      
      // 更新LLM配置
      if (memory.updateLLMConfig) {
        memory.updateLLMConfig({
          apiKey: currentApiKey || '',
          model: currentModel,
          apiProvider: currentApiProvider,
          openrouter: user.settings.chat.openrouter
        });
        console.log('[Mem0Initializer] LLM配置已同步更新', {
          provider: currentApiProvider,
          model: currentModel,
          keyLength: currentApiKey?.length || 0
        });
      } else {
        console.warn('[Mem0Initializer] memory对象缺少updateLLMConfig方法');
      }
    }
    
    // 保存当前配置以便下次比较
    previousApiKey.current = currentApiKey || null;
    previousApiProvider.current = currentApiProvider || null;
    previousZhipuApiKey.current = currentZhipuApiKey || null;
  }, [user?.settings?.chat, memory, initialized]);
  
  // 初始化Mem0Service
  useEffect(() => {
    if (!loading && !error && memory) {
      try {
        console.log('[Mem0Initializer] 初始化记忆服务...');
        
        if (user?.settings?.chat) {
          checkInitialState(user.settings.chat);
          logApiConfig(user.settings.chat);
          
          // 获取准确的API设置
          const apiProvider = user.settings.chat.apiProvider;
          const apiKey = apiProvider === 'openrouter' 
            ? user.settings.chat.openrouter?.apiKey 
            : user.settings.chat.characterApiKey;
          
          // 获取嵌入设置
          const zhipuApiKey = user.settings.chat.zhipuApiKey;
          
          // 根据API提供商选择合适的模型
          const model = apiProvider === 'openrouter'
            ? user.settings.chat.openrouter?.model || 'openai/gpt-3.5-turbo'
            : 'gemini-2.0-flash-exp'; // Gemini默认模型
            
          console.log('[Mem0Initializer] 当前用户API设置:');
          console.log(`API提供商: ${apiProvider}`);
          console.log(`OpenRouter启用: ${apiProvider === 'openrouter'}`);
          console.log(`使用模型: ${model}`);
          console.log(`API密钥状态: ${apiKey ? '已设置' : '未设置'}, 长度: ${apiKey?.length || 0}`);
          console.log(`智谱API密钥状态: ${zhipuApiKey ? '已设置' : '未设置'}, 长度: ${zhipuApiKey?.length || 0}`);
          
          // 保存初始配置
          previousApiKey.current = apiKey || null;
          previousApiProvider.current = apiProvider || null;
          previousZhipuApiKey.current = zhipuApiKey || null;
        }
        
        const mem0Service = Mem0Service.getInstance();
        
        mem0Service.initialize({
          add: addMemory,
          search: searchMemory,
          get: getMemory,
          update: updateMemory,
          delete: deleteMemory,
          reset: resetMemory
        }, memory); // 传递memory实例引用
        
        // 如果有API密钥，立即更新LLM配置
        if (user?.settings?.chat) {
          const apiProvider = user.settings.chat.apiProvider || 'gemini';
          const apiKey = apiProvider === 'openrouter' 
            ? user.settings.chat.openrouter?.apiKey 
            : user.settings.chat.characterApiKey;
            
          const model = apiProvider === 'openrouter'
            ? user.settings.chat.openrouter?.model || 'openai/gpt-3.5-turbo'
            : 'gemini-2.0-flash-exp';
            
          if (apiKey) {
            mem0Service.updateLLMConfig({
              apiKey,
              model,
              apiProvider,
              openrouter: user.settings.chat.openrouter
            });
            console.log('[Mem0Initializer] 已初始化LLM配置:', {
              provider: apiProvider,
              model: model,
              keyLength: apiKey.length
            });
          }
        }
        
        console.log('[Mem0Initializer] Mem0 记忆服务初始化完成');
        setInitialized(true);
      } catch (err) {
        console.error('[Mem0Initializer] Mem0 记忆服务初始化失败', err);
      }
    }
  }, [loading, error, memory]);
  
  // 组件仅用于初始化，不需要实际渲染内容
  return null;
};

export default Mem0Initializer;
