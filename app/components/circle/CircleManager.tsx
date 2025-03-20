import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useCharacters } from '@/constants/CharactersContext';
import { useUser } from '@/constants/UserContext';
import { CircleService } from '@/services/circle-service';
import { CirclePost } from '@/shared/types/circle-types';
import { Character } from '@/shared/types';

// Component for managing automatic circle post generation
export const CircleManager = () => {
  const { characters } = useCharacters();
  const { user } = useUser(); // Get user for API settings
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPostTimestamp, setLastPostTimestamp] = useState(Date.now());
  const INTERVAL_BETWEEN_POSTS = 30 * 60 * 1000; // 30 minutes
  
  // Get API settings from user context
  const getApiSettings = () => {
    const apiKey = user?.settings?.chat?.characterApiKey || '';
    
    // Extract OpenRouter settings if enabled
    const apiSettings = {
      apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
      openrouter: user?.settings?.chat?.apiProvider === 'openrouter' && user?.settings?.chat?.openrouter
        ? {
            enabled: true,
            apiKey: user?.settings?.chat?.openrouter.apiKey,
            model: user?.settings?.chat?.openrouter.model
          }
        : undefined
    };
    
    // Log API settings being used
    console.log(`【朋友圈管理器】获取API设置:`, {
      apiProvider: apiSettings.apiProvider,
      hasOpenRouter: !!apiSettings.openrouter,
      openRouterModel: apiSettings.openrouter?.model
    });
    
    return { apiKey, apiSettings };
  };
  
  // Create a test post
  const createTestPost = async () => {
    if (isProcessing) return;
    if (!characters || characters.length === 0) return;
    
    setIsProcessing(true);
    try {
      const { apiKey, apiSettings } = getApiSettings();
      console.log('【朋友圈管理器】创建测试帖子，使用API设置:', apiSettings);
      
      // Only select characters with circle interaction enabled
      const enabledCharacters = characters.filter(c => c.circleInteraction);
      
      if (enabledCharacters.length > 0) {
        const result = await CircleService.publishTestPost(
          enabledCharacters,
          apiKey,
          apiSettings
        );
        
        if (result.post) {
          console.log(`【朋友圈管理器】发布测试帖子成功，内容: "${result.post.content.substring(0, 30)}..."`);
          // Trigger character interactions with this post
          await triggerInteractions(result.post, enabledCharacters);
          setLastPostTimestamp(Date.now());
        }
      }
    } catch (error) {
      console.error('【朋友圈管理器】创建测试帖子失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Trigger character interactions with a post
  const triggerInteractions = async (post: CirclePost, enabledCharacters: Character[]) => {
    try {
      const { apiKey, apiSettings } = getApiSettings();
      console.log(`【朋友圈管理器】触发角色互动，使用API设置:`, apiSettings);
      
      // Filter out the author of the post
      const respondingCharacters = enabledCharacters.filter(c => 
        c.id !== post.characterId && c.circleInteraction
      );
      
      if (respondingCharacters.length > 0) {
        // Process at most 3 random characters to avoid too many API calls
        const sampleSize = Math.min(3, respondingCharacters.length);
        const selectedCharacters = respondingCharacters
          .sort(() => 0.5 - Math.random())
          .slice(0, sampleSize);
        
        console.log(`【朋友圈管理器】选择 ${selectedCharacters.length} 个角色进行互动`);
        
        // Process interactions
        await CircleService.processPostResponses(
          post,
          selectedCharacters,
          apiKey,
          apiSettings  // Pass the API settings
        );
      }
    } catch (error) {
      console.error('【朋友圈管理器】触发角色互动失败:', error);
    }
  };
  
  // Check if it's time to create a new post
  const checkSchedule = () => {
    const now = Date.now();
    const timeSinceLastPost = now - lastPostTimestamp;
    
    if (timeSinceLastPost >= INTERVAL_BETWEEN_POSTS && !isProcessing) {
      console.log('【朋友圈管理器】时间间隔已到，尝试创建新帖子');
      createTestPost();
    }
  };
  
  // Initialize and set up interval checks
  useEffect(() => {
    // Initial check when component mounts
    checkSchedule();
    
    // Set up interval to check regularly
    const intervalId = setInterval(() => {
      checkSchedule();
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => {
      clearInterval(intervalId);
    };
  }, [lastPostTimestamp, isProcessing, characters]);
  
  // Don't render anything visible
  return null;
};

export default CircleManager;
