import React, { useEffect, useRef } from 'react';
import { useMemoryContext } from '../providers/MemoryProvider';
import Mem0Service from '../services/Mem0Service';
import { useUser } from '@/constants/UserContext';

// Global initialization flag
let isServiceInitialized = false;

const Mem0Initializer: React.FC = React.memo(() => {
  const context = useMemoryContext();
  const { 
    loading, 
    error, 
    addMemory, 
    searchMemory, 
    getMemory,
    updateMemory,
    deleteMemory,
    resetMemory,
    memory 
  } = context;
  
  const { user } = useUser();
  
  // Use refs to track settings changes without triggering re-renders
  const apiConfigRef = useRef({
    apiProvider: '',
    apiKey: '',
    zhipuApiKey: '',
    model: ''
  });
  
  // Main initialization effect - runs only once
  useEffect(() => {
    if (isServiceInitialized || loading || !memory) {
      return;
    }
    
    try {
      console.log('[Mem0Initializer] Initializing memory service (once)');
      const mem0Service = Mem0Service.getInstance();
      
      mem0Service.initialize({
        add: addMemory,
        search: searchMemory,
        get: getMemory,
        update: updateMemory,
        delete: deleteMemory,
        reset: resetMemory
      }, memory);
      
      // Set global flag to prevent re-initialization
      isServiceInitialized = true;
      console.log('[Mem0Initializer] Memory service initialization complete');
      
      // Store initial API settings
      apiConfigRef.current = {
        apiProvider: user?.settings?.chat?.apiProvider || '',
        apiKey: user?.settings?.chat?.characterApiKey || user?.settings?.chat?.openrouter?.apiKey || '',
        zhipuApiKey: user?.settings?.chat?.zhipuApiKey || '',
        model: user?.settings?.chat?.openrouter?.model || ''
      };
    } catch (err) {
      console.error('[Mem0Initializer] Failed to initialize memory service:', err);
    }
  }, [memory, loading]);
  
  // Update LLM config only when settings change
  useEffect(() => {
    if (!isServiceInitialized || !memory || !user?.settings?.chat) return;
    
    // Get current API settings
    const currentApiProvider = user.settings.chat.apiProvider || '';
    const currentApiKey = currentApiProvider === 'openrouter' 
      ? user.settings.chat.openrouter?.apiKey
      : user.settings.chat.characterApiKey;
    const currentZhipuApiKey = user.settings.chat.zhipuApiKey || '';
    const currentModel = user.settings.chat.openrouter?.model || '';
    
    // Check if settings have actually changed
    const apiProviderChanged = currentApiProvider !== apiConfigRef.current.apiProvider;
    const apiKeyChanged = currentApiKey !== apiConfigRef.current.apiKey;
    const zhipuApiKeyChanged = currentZhipuApiKey !== apiConfigRef.current.zhipuApiKey;
    const modelChanged = currentModel !== apiConfigRef.current.model;
    
    // Only update if something important has changed
    if (apiProviderChanged || apiKeyChanged || modelChanged) {
      console.log('[Mem0Initializer] API settings changed, updating LLM config');
      
      // Get the model based on provider
      const model = currentApiProvider === 'openrouter' 
        ? user.settings.chat.openrouter?.model || 'openai/gpt-3.5-turbo'
        : 'gemini-2.0-flash-exp';
      
      // Update the memory's LLM config
      if (currentApiKey) {
        memory.updateLLMConfig({
          apiKey: currentApiKey,
          model: model,
          apiProvider: currentApiProvider,
          openrouter: user.settings.chat.openrouter
        });
        
        // Update ref for future comparisons
        apiConfigRef.current = {
          apiProvider: currentApiProvider,
          apiKey: currentApiKey || '',
          zhipuApiKey: currentZhipuApiKey,
          model: currentModel
        };
      }
    }
  }, [
    user?.settings?.chat?.apiProvider,
    user?.settings?.chat?.characterApiKey,
    user?.settings?.chat?.openrouter?.apiKey,
    user?.settings?.chat?.openrouter?.model
  ]);
  
  return null;
}, () => true); // Never re-render this component

Mem0Initializer.displayName = 'Mem0Initializer';
export default Mem0Initializer;
