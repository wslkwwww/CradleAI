import React, { createContext, useContext, ReactNode, useState, useEffect, useRef } from 'react';
import { useMemory } from '../hooks/useMemory';
import { MemoryConfig } from '../types';
import { useUser } from '@/constants/UserContext';

// 记忆上下文类型
type MemoryContextType = ReturnType<typeof useMemory>;

// 创建上下文
const MemoryContext = createContext<MemoryContextType | null>(null);

// Provider 属性接口
interface MemoryProviderProps {
  children: ReactNode;
  config?: Partial<MemoryConfig>;
}

/**
 * 记忆系统 Context Provider
 * @param props Provider 属性
 * @returns Provider 组件
 */
export function MemoryProvider({ children, config = {} }: MemoryProviderProps) {
  const { user } = useUser();
  const [memoryConfig, setMemoryConfig] = useState<Partial<MemoryConfig>>(config);
  
  // 使用ref跟踪上一次的API设置，避免无限循环
  const prevApiKeyRef = useRef<string | null>(null);
  const prevApiProviderRef = useRef<string | null>(null);
  
  // 当用户设置变化时更新配置
  useEffect(() => {
    // 确保 user 和 user.settings 和 user.settings.chat 存在
    if (!user?.settings?.chat) return;
    
    const apiProvider = user.settings.chat.apiProvider;
    
    // 从正确的地方获取API密钥 - 确保从settings中获取并且保持一致
    const apiKey = apiProvider === 'openrouter' 
      ? user.settings.chat.openrouter?.apiKey 
      : user.settings.chat.characterApiKey;
      
    // 获取正确的模型，根据API提供商选择
    const model = apiProvider === 'openrouter'
      ? user.settings.chat.openrouter?.model || 'openai/gpt-3.5-turbo'
      : 'gemini-2.0-flash-exp'; // 默认Gemini模型
    
    // 输出更详细的日志，方便调试
    console.log(`[MemoryProvider] 开始更新配置检查，当前设置:`, { 
      apiProvider, 
      currentKey: apiKey ? `${apiKey.substring(0, 3)}...` : 'undefined',
      prevKey: prevApiKeyRef.current ? `${prevApiKeyRef.current.substring(0, 3)}...` : 'null',
      model
    });
    
    // 检查API配置是否发生变化，避免无限循环
    if (apiKey === prevApiKeyRef.current && apiProvider === prevApiProviderRef.current) {
      console.log('[MemoryProvider] 配置无变化，跳过更新');
      return;
    }
    
    // 更新refs以便下次比较
    prevApiKeyRef.current = apiKey || null;
    prevApiProviderRef.current = apiProvider || null;
    
    // 使用类型断言来解决类型不兼容问题
    const newConfig: Partial<MemoryConfig> = {
      ...memoryConfig,
      llm: {
        ...(memoryConfig.llm || {}),
        provider: 'mobile_llm',
        config: {
          ...(memoryConfig.llm?.config || {}),
          apiKey: apiKey || '',
          model: model,
          apiProvider: apiProvider,
          openrouter: user.settings.chat.openrouter
        }
      },
      embedder: {
        ...(memoryConfig.embedder || {}),
        provider: 'mobile_openai',
        config: {
          ...(memoryConfig.embedder?.config || {}),
          apiKey: apiKey || '',
          model: 'text-embedding-3-small',
        }
      }
    };
    
    console.log(`[MemoryProvider] 确认新配置:`, {
      apiProvider: newConfig.llm?.config?.apiProvider,
      model: newConfig.llm?.config?.model,
      apiKeyLength: newConfig.llm?.config?.apiKey?.length || 0
    });
    
    setMemoryConfig(newConfig);
    
    console.log(`[MemoryProvider] 配置已更新: apiProvider=${apiProvider}, model=${model}`);
    console.log(`[MemoryProvider] API密钥状态: ${apiKey ? '已设置' : '未设置'}, 长度: ${apiKey?.length || 0}`);
  }, [user?.settings?.chat]); // 移除memoryConfig依赖项，避免无限循环
  
  const memoryUtils = useMemory(memoryConfig);
  
  return (
    <MemoryContext.Provider value={memoryUtils}>
      {children}
    </MemoryContext.Provider>
  );
}

/**
 * 记忆系统 Hook
 * @returns 记忆系统操作对象
 */
export function useMemoryContext() {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemoryContext 必须在 MemoryProvider 内部使用');
  }
  return context;
}
