import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ViewStyle,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { Message, ChatDialogProps } from '@/shared/types';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { parseHtmlText, containsComplexHtml, optimizeHtmlForRendering } from '@/utils/textParser';
import { ratingService } from '@/services/ratingService';
import RichTextRenderer from '@/components/RichTextRenderer';
import ImageManager, { ImageInfo } from '@/utils/ImageManager';
import { ttsService, AudioState } from '@/services/ttsService'; // Import the TTS service
import { useDialogMode } from '@/constants/DialogModeContext';

// Update ChatDialogProps interface in the file or in shared/types.ts to include messageMemoryState
interface ExtendedChatDialogProps extends ChatDialogProps {
  messageMemoryState?: Record<string, string>;
}

const { width } = Dimensions.get('window');
// Adjust the maximum width to ensure proper margins
const MAX_WIDTH = width * 0.88; // Decreased from 0.9 to 0.88 to add more margin
const MAX_IMAGE_HEIGHT = 300; // Maximum height for images in chat

const ChatDialog: React.FC<ExtendedChatDialogProps> = ({
  messages,
  style,
  selectedCharacter,
  onRateMessage,
  onRegenerateMessage,
  savedScrollPosition,
  onScrollPositionChange,
  messageMemoryState = {} // Default to empty object
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useSharedValue(0);
  const translateAnim = useSharedValue(20);
  const dot1Scale = useSharedValue(1);
  const dot2Scale = useSharedValue(1);
  const dot3Scale = useSharedValue(1);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [fullscreenImageId, setFullscreenImageId] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [ratedMessages, setRatedMessages] = useState<Record<string, boolean>>({});
  
  // Add state to track scroll position for different conversations
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const isInitialScrollRestored = useRef(false);
  
  // Add state for TTS functionality
  const [audioStates, setAudioStates] = useState<Record<string, AudioState>>({});
  
  // Add state for TTS enhancer settings
  const [ttsEnhancerEnabled, setTtsEnhancerEnabled] = useState(false);
  
  // Get dialog mode from context
  const { mode, visualNovelSettings, isHistoryModalVisible, setHistoryModalVisible } = useDialogMode();
  
  // State to track last AI message for visual novel mode
  const [lastAiMessage, setLastAiMessage] = useState<Message | null>(null);
  
  // Check TTS enhancer status when component mounts
  useEffect(() => {
    const checkTtsEnhancerStatus = () => {
      const settings = ttsService.getEnhancerSettings();
      setTtsEnhancerEnabled(settings.enabled);
    };
    
    checkTtsEnhancerStatus();
    
    // Set up interval to periodically check enhancer status
    const intervalId = setInterval(checkTtsEnhancerStatus, 5000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Update current conversation ID when it changes
  useEffect(() => {
    if (selectedCharacter?.id && selectedCharacter.id !== currentConversationId) {
      setCurrentConversationId(selectedCharacter.id);
      isInitialScrollRestored.current = false;
    }
  }, [selectedCharacter?.id, currentConversationId]);

  // Track scroll position changes
  const handleScroll = (event: any) => {
    const yOffset = event.nativeEvent.contentOffset.y;
    if (currentConversationId) {
      setScrollPositions(prev => ({
        ...prev,
        [currentConversationId]: yOffset
      }));
      
      // Report scroll position to parent if callback provided
      if (onScrollPositionChange) {
        onScrollPositionChange(currentConversationId, yOffset);
      }
    }
  };

  // Animate new messages
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 300 });
    translateAnim.value = withTiming(0, { duration: 300 });
  }, [messages, fadeAnim, translateAnim]);

  const messagesAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
      transform: [{ translateY: translateAnim.value }]
    };
  });

  const animateDots = () => {
    const setupDotAnimation = (dotScale: Animated.SharedValue<number>, delay: number) => {
      dotScale.value = withDelay(
        delay,
        withSequence(
          withTiming(1.5, { duration: 300 }),
          withTiming(1, { duration: 300 })
        )
      );
    };
    
    setupDotAnimation(dot1Scale, 0);
    setupDotAnimation(dot2Scale, 200);
    setupDotAnimation(dot3Scale, 400);
    
    const interval = setInterval(() => {
      setupDotAnimation(dot1Scale, 0);
      setupDotAnimation(dot2Scale, 200);
      setupDotAnimation(dot3Scale, 400);
    }, 1200);
    
    return () => clearInterval(interval);
  };
  
  useEffect(() => {
    const cleanup = animateDots();
    return cleanup;
  }, []);
  
  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }]
  }));
  
  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }]
  }));
  
  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot3Scale.value }]
  }));

  // Auto-scroll to bottom when new messages arrive, but only if already at bottom
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialScrollRestored.current || !currentConversationId || 
          !(currentConversationId in scrollPositions)) {
        // Auto-scroll to bottom only for new messages
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }
  }, [messages.length]);
  
  // Restore scroll position when conversation changes
  useEffect(() => {
    // Don't run on first render
    if (!currentConversationId || isInitialScrollRestored.current) return;
    
    // Use the saved position from props if provided, otherwise use local state
    const positionToRestore = savedScrollPosition !== undefined ? 
                             savedScrollPosition : 
                             scrollPositions[currentConversationId];
                             
    if (positionToRestore !== undefined) {
      // Delay scrolling to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: positionToRestore, animated: false });
        isInitialScrollRestored.current = true;
      }, 300);
    } else if (messages.length > 0) {
      // If no saved position but messages exist, scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
        isInitialScrollRestored.current = true;
      }, 300);
    }
  }, [currentConversationId, messages, scrollPositions, savedScrollPosition]);

  // Load rated messages on mount and when character changes
  useEffect(() => {
    const loadRatedMessages = async () => {
      if (selectedCharacter?.id) {
        const ratings = await ratingService.getRatingsForCharacter(selectedCharacter.id);
        setRatedMessages(ratings);
      }
    };
    
    loadRatedMessages();
  }, [selectedCharacter?.id]);

  // Update last AI message when messages change (for visual novel mode)
  useEffect(() => {
    if (mode === 'visual-novel' && messages.length > 0) {
      // Find the last non-loading AI message
      const lastBotMessage = [...messages]
        .reverse()
        .find(msg => msg.sender === 'bot' && !msg.isLoading);
      
      if (lastBotMessage) {
        setLastAiMessage(lastBotMessage);
      }
    }
  }, [messages, mode]);

  // Enhanced rate message handler with animations and persistence
  const handleRateMessage = async (messageId: string, isUpvote: boolean) => {
    // Update local state
    setRatedMessages(prev => ({
      ...prev,
      [messageId]: isUpvote
    }));
    
    // Store the rating
    if (selectedCharacter?.id) {
      await ratingService.saveRating(selectedCharacter.id, messageId, isUpvote);
    }
    
    // Call the parent handler if provided
    if (onRateMessage) {
      onRateMessage(messageId, isUpvote);
    }
  };

  // Update audio states when they change in the service
  const updateAudioState = (messageId: string) => {
    const state = ttsService.getAudioState(messageId);
    setAudioStates(prev => ({
      ...prev,
      [messageId]: state
    }));
  };
  
  // Handle TTS button press
  const handleTTSButtonPress = async (messageId: string, text: string) => {
    try {
      // Get the template ID from the selected character, falling back to a default if not set
      const templateId = selectedCharacter?.voiceType || 'template1';
      
      console.log(`[ChatDialog] Using voice template: ${templateId} for character: ${selectedCharacter?.name}`);
      
      // Update UI immediately to show loading state
      setAudioStates(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          isLoading: true,
          error: null
        }
      }));
      
      // Generate TTS for this message with the character's voice template
      const result = await ttsService.generateTTS(messageId, text, templateId);
      
      // Update the audio state based on the result
      updateAudioState(messageId);
      
      // Auto-play the audio if generation was successful
      if (result.hasAudio && !result.error) {
        await handlePlayAudio(messageId);
      } else if (result.error) {
        // Only show an error alert if there was a definite error (not just still processing)
        if (result.error !== 'Audio generation timed out after 30 seconds') {
          Alert.alert('语音生成失败', '无法生成语音，请稍后再试。');
        }
      }
    } catch (error) {
      console.error('Failed to generate TTS:', error);
      // Update local state to show error
      setAudioStates(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          isLoading: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }));
    }
  };
  
  // Handle play audio button press
  const handlePlayAudio = async (messageId: string) => {
    try {
      const state = ttsService.getAudioState(messageId);
      
      if (state.isPlaying) {
        // If already playing, stop it
        await ttsService.stopAudio(messageId);
      } else {
        // Otherwise start playback
        await ttsService.playAudio(messageId);
      }
      
      // Update state after action
      updateAudioState(messageId);
    } catch (error) {
      console.error('Failed to play audio:', error);
      Alert.alert('播放失败', '无法播放语音，请稍后再试。');
    }
  };
  
  // Clean up audio resources when component unmounts
  useEffect(() => {
    return () => {
      ttsService.cleanup();
    };
  }, []);

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        <Image
          source={
            selectedCharacter?.avatar
              ? { uri: String(selectedCharacter.avatar) }
              : require('@/assets/images/default-avatar.png')
          }
          style={styles.emptyStateAvatar}
        />
        <Text style={styles.emptyStateTitle}>
          {selectedCharacter
            ? `开始与 ${selectedCharacter.name} 的对话`
            : '选择一个角色开始对话'}
        </Text>
        <Text style={styles.emptyStateSubtitle}>
          {selectedCharacter
            ? '发送一条消息，开始聊天吧！'
            : '点击左上角菜单选择角色'}
        </Text>
      </View>
    );
  };

  const renderTimeGroup = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return (
      <View style={styles.timeGroup}>
        <Text style={styles.timeText}>{`${hours}:${minutes}`}</Text>
      </View>
    );
  };

  // 检测并处理消息中的图片链接
  const processMessageContent = (text: string, isUser: boolean) => {
    // If text is empty, return a placeholder
    if (!text || text.trim() === '') {
      return (
        <Text style={isUser ? styles.userMessageText : styles.botMessageText}>
          (Empty message)
        </Text>
      );
    }

    // Check if text is raw markdown for an image with our special image:id format
    const rawImageMarkdownRegex = /^!\[(.*?)\]\(image:([a-f0-9]+)\)$/;
    const rawImageMatch = text.trim().match(rawImageMarkdownRegex);
    
    if (rawImageMatch) {
      // This is a raw image markdown string, extract the parts and render directly
      const alt = rawImageMatch[1] || "图片";
      const imageId = rawImageMatch[2];

      
      const imageInfo = ImageManager.getImageInfo(imageId);
      if (imageInfo) {
        return (
          <View style={styles.imageWrapper}>
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => handleOpenFullscreenImage(imageId)}
            >
              <Image
                source={{ uri: imageInfo.thumbnailPath }}
                style={styles.messageImage}
                resizeMode="contain"
                onError={(e) => console.error(`Error loading image: ${e.nativeEvent.error}`, imageInfo.thumbnailPath)}
              />
            </TouchableOpacity>
            <Text style={styles.imageCaption}>{alt}</Text>
          </View>
        );
      } else {
        console.error(`No image info found for ID: ${imageId}`);
        return (
          <View style={styles.imageError}>
            <Ionicons name="alert-circle" size={36} color="#e74c3c" />
            <Text style={styles.imageErrorText}>图片无法加载 (ID: {imageId.substring(0, 8)}...)</Text>
          </View>
        );
      }
    }

    // More comprehensive check for custom tags with various formats and spaces
    const hasCustomTags = (
      /<\s*(thinking|think|status|mem|websearch)[^>]*>([\s\S]*?)<\/\s*(thinking|think|status|mem|websearch)\s*>/i.test(text) || 
      /<\s*char\s+think\s*>([\s\S]*?)<\/\s*char\s+think\s*>/i.test(text)
    );
    
    const hasMarkdown = /```[\w]*\s*([\s\S]*?)```/.test(text) || 
                       /!\[[\s\S]*?\]\([\s\S]*?\)/.test(text) ||
                       /\*\*([\s\S]*?)\*\*/.test(text) ||
                       /\*([\s\S]*?)\*/.test(text);

    // Check for HTML content or interactive elements
    const hasHtml = /<\/?[a-z][^>]*>/i.test(text);
    
    // Remove excessive logging
    // console.log(`Message content checks: customTags=${hasCustomTags}, markdown=${hasMarkdown}, html=${hasHtml}`);

    // If it contains any special formatting that needs rich rendering
    if (hasCustomTags || hasMarkdown || hasHtml || containsComplexHtml(text)) {
      let processedText = text;
      
      // Process markdown formatting first
      if (hasMarkdown) {
        // Fix regex to correctly handle code blocks with or without language specification
        processedText = processedText.replace(/```([\w]*)\s*([\s\S]*?)```/g, 
          (match, lang, code) => {
            return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
        });
        
        // Convert markdown bold to HTML
        processedText = processedText.replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>');
        
        // Convert markdown italic to HTML
        processedText = processedText.replace(/\*([\s\S]*?)\*/g, '<i>$1</i>');
      }
      
      // Process custom tags with more flexible regex patterns to handle various spacing
      if (hasCustomTags) {
        // Convert <thinking> tags with flexible spacing
        processedText = processedText.replace(
          /<\s*thinking[^>]*>([\s\S]*?)<\/\s*thinking\s*>/gi, 
          '<div class="character-thinking">$1</div>'
        );
        
        // Convert <think> tags with flexible spacing
        processedText = processedText.replace(
          /<\s*think[^>]*>([\s\S]*?)<\/\s*think\s*>/gi, 
          '<div class="character-thinking">$1</div>'
        );
        
        // Convert <char think> tags with flexible spacing
        processedText = processedText.replace(
          /<\s*char\s+think[^>]*>([\s\S]*?)<\/\s*char\s+think\s*>/gi, 
          '<div class="character-thinking">$1</div>'
        );
        
        // Convert <status> tags with flexible spacing
        processedText = processedText.replace(
          /<\s*status[^>]*>([\s\S]*?)<\/\s*status\s*>/gi, 
          '<div class="character-status">$1</div>'
        );
        
        // Convert <mem> tags with flexible spacing
        processedText = processedText.replace(
          /<\s*mem[^>]*>([\s\S]*?)<\/\s*mem\s*>/gi, 
          '<div class="character-memory">$1</div>'
        );
        
        // Convert <websearch> tags with flexible spacing
        processedText = processedText.replace(
          /<\s*websearch[^>]*>([\s\S]*?)<\/\s*websearch\s*>/gi, 
          '<div class="websearch-result">$1</div>'
        );

        // Remove excessive logging
        // console.log("After custom tag processing:", processedText.substring(0, 100));
      }
      
      // Optimize HTML before rendering
      const optimizedHtml = optimizeHtmlForRendering(processedText);
      
      // Remove excessive logging
      // console.log("Final HTML to render:", optimizedHtml.substring(0, 100));
      
      return (
        <View style={styles.richContentWrapper}>
          <RichTextRenderer 
            html={optimizedHtml} 
            baseStyle={{ color: isUser ? '#333' : '#fff' }}
            onImagePress={(url) => setFullscreenImage(url)}
            maxImageHeight={MAX_IMAGE_HEIGHT}
          />
        </View>
      );
    }

    // First, check for image markdown with our special format
    const imageIdRegex = /!\[(.*?)\]\(image:([^\s)]+)\)/g;
    let match: RegExpExecArray | null;
    const matches: { alt: string, id: string }[] = [];
    
    while ((match = imageIdRegex.exec(text)) !== null) {
      matches.push({
        alt: match[1] || "图片",
        id: match[2]
      });
    }
    
    // If we found image:id format, render them directly
    if (matches.length > 0) {
      // Debug image paths
      console.log(`Found ${matches.length} images with IDs in message`);

      return (
        <View>
          {matches.map((img, idx) => {
            const imageInfo = ImageManager.getImageInfo(img.id);
            console.log(`Image ${idx} ID: ${img.id}, info:`, imageInfo);

            if (imageInfo) {
              return (
                <TouchableOpacity 
                  key={idx}
                  style={styles.imageWrapper}
                  onPress={() => handleOpenFullscreenImage(img.id)}
                >
                  <Image
                    source={{ uri: imageInfo.thumbnailPath }}
                    style={styles.messageImage}
                    resizeMode="contain"
                    onError={(e) => console.error(`Error loading image: ${e.nativeEvent.error}`, imageInfo.thumbnailPath)}
                  />
                  <Text style={styles.imageCaption}>{img.alt}</Text>
                </TouchableOpacity>
              );
            } else {
              console.error(`No image info found for ID: ${img.id}`);
              return (
                <View key={idx} style={styles.imageError}>
                  <Ionicons name="alert-circle" size={36} color="#e74c3c" />
                  <Text style={styles.imageErrorText}>图片无法加载 (ID: {img.id.substring(0, 8)}...)</Text>
                </View>
              );
            }
          })}
        </View>
      );
    }

    // Handle image markdown with our custom image:id syntax
    const imageMarkdownRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g;
    let urlMatches: { alt: string, url: string }[] = [];
    
    // Reset lastIndex for regex since we're reusing it
    imageMarkdownRegex.lastIndex = 0;
    
    while ((match = imageMarkdownRegex.exec(text)) !== null) {
      urlMatches.push({
        alt: match[1] || "图片",
        url: match[2]
      });
    }
    
    // 如果找到图片链接
    if (urlMatches.length > 0) {
      console.log(`Found ${urlMatches.length} images with URLs in message`);
      
      return (
        <View>
          {urlMatches.map((img, idx) => {
            // 检查是否为数据 URL 或 HTTP URL
            const isDataUrl = img.url.startsWith('data:');
            const isLargeDataUrl = isDataUrl && img.url.length > 100000;
            
            console.log(`Image ${idx} URL type: ${isDataUrl ? 'data URL' : 'HTTP URL'}, large: ${isLargeDataUrl}`);
            
            // 处理大型数据 URL
            if (isLargeDataUrl) {
              return (
                <View key={idx} style={styles.imageWrapper}>
                  <TouchableOpacity
                    style={styles.imageDataUrlWarning}
                    onPress={() => setFullscreenImage(img.url)}
                  >
                    <Ionicons name="image" size={36} color="#999" />
                    <Text style={styles.imageDataUrlWarningText}>
                      {img.alt} (点击查看)
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
            
            // 正常显示图片，包括 HTTP URL 和小型数据 URL
            return (
              <TouchableOpacity 
                key={idx}
                style={styles.imageWrapper}
                onPress={() => setFullscreenImage(img.url)}
              >
                <Image
                  source={{ uri: img.url }}
                  style={styles.messageImage}
                  resizeMode="contain"
                  onError={(e) => console.error(`Error loading image URL: ${e.nativeEvent.error}`)}
                />
                <Text style={styles.imageCaption}>{img.alt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    
    // 检查是否是普通的链接说明
    const linkRegex = /\[(.*?)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g;
    let linkMatches: { text: string, url: string }[] = [];
    
    while ((match = linkRegex.exec(text)) !== null) {
      linkMatches.push({
        text: match[1],
        url: match[2]
      });
    }
    
    // 如果找到链接
    if (linkMatches.length > 0) {
      return (
        <View>
          {linkMatches.map((link, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.linkButton}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open(link.url, '_blank');
                } else {
                  setFullscreenImage(link.url);
                }
              }}
            >
              <Ionicons name="link" size={16} color="#3498db" style={styles.linkIcon} />
              <Text style={styles.linkText}>{link.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    
    // 处理普通文本
    return renderMessageText(text, isUser);
  };

  const renderMessageText = (text: string, isUser: boolean) => {
    const segments = parseHtmlText(text);
    return (
      <Text style={isUser ? styles.userMessageText : styles.botMessageText}>
        {segments.map((segment, index) => (
          <Text key={index} style={segment.style}>
            {segment.text}
          </Text>
        ))}
      </Text>
    );
  };

  // Count the number of AI messages up to a specific index for regenerate functionality
  const getAiMessageIndex = (index: number): number => {
    let aiMessageCount = 0;
    for (let i = 0; i <= index; i++) {
      if (messages[i].sender === 'bot' && !messages[i].isLoading) {
        aiMessageCount++;
      }
    }
    return aiMessageCount - 1; // 0-based index
  };

  // Check if a message has been rated
  const getMessageRating = (messageId: string): boolean | null => {
    if (messageId in ratedMessages) {
      return ratedMessages[messageId];
    }
    return null; // Not rated
  };

  // Render TTS buttons for a message
  const renderTTSButtons = (message: Message) => {
    // Only show TTS buttons for bot messages
    if (message.sender !== 'bot' || message.isLoading) return null;
    
    const audioState = audioStates[message.id] || ttsService.getAudioState(message.id);
    const isVisualNovel = mode === 'visual-novel';
    
    return (
      <View style={isVisualNovel ? styles.visualNovelTTSContainer : styles.ttsButtonContainer}>
        {audioState.isLoading ? (
          // Loading indicator with text showing it's generating
          <View style={isVisualNovel ? styles.visualNovelTTSButtonWithLabel : styles.ttsButtonWithLabel}>
            <View style={isVisualNovel ? styles.visualNovelTTSButton : styles.ttsButton}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
            {!isVisualNovel && <Text style={styles.ttsLoadingText}>生成中...</Text>}
          </View>
        ) : audioState.hasAudio ? (
          // If audio is available, show appropriate button based on playback state
          <TouchableOpacity
            style={[
              isVisualNovel ? styles.visualNovelTTSButton : styles.ttsButton, 
              audioState.isPlaying && (isVisualNovel ? styles.visualNovelTTSButtonActive : styles.ttsButtonActive),
              // Add special style for enhanced audio
              ttsEnhancerEnabled && (isVisualNovel ? styles.visualNovelTTSButtonEnhanced : styles.ttsButtonEnhanced)
            ]}
            onPress={() => handlePlayAudio(message.id)}
          >
            {audioState.isPlaying ? (
              // Playing - show pause button
              <Ionicons name="pause" size={isVisualNovel ? 22 : 18} color="#fff" />
            ) : audioState.isComplete ? (
              // Completed playing - show replay button
              <Ionicons name="refresh" size={isVisualNovel ? 22 : 18} color="#fff" />
            ) : (
              // Has audio but not playing - show play button
              <Ionicons name="play" size={isVisualNovel ? 22 : 18} color="#fff" />
            )}
            
            {/* Add indicator for enhanced audio */}
            {ttsEnhancerEnabled && (
              <View style={isVisualNovel ? styles.visualNovelTTSEnhancerIndicator : styles.ttsEnhancerIndicator}>
                <Ionicons name="sparkles-outline" size={isVisualNovel ? 12 : 10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ) : (
          // If no audio yet, show generate button
          <TouchableOpacity
            style={[
              isVisualNovel ? styles.visualNovelTTSButton : styles.ttsButton,
              // Add special style for enhanced mode
              ttsEnhancerEnabled && (isVisualNovel ? styles.visualNovelTTSButtonEnhanced : styles.ttsButtonEnhanced)
            ]}
            onPress={() => handleTTSButtonPress(message.id, message.text)}
          >
            <Ionicons name="volume-high" size={isVisualNovel ? 22 : 18} color="#fff" />
            
            {/* Add indicator for enhanced mode */}
            {ttsEnhancerEnabled && (
              <View style={isVisualNovel ? styles.visualNovelTTSEnhancerIndicator : styles.ttsEnhancerIndicator}>
                <Ionicons name="sparkles-outline" size={isVisualNovel ? 12 : 10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        )}
        
        {/* Show error message if there was an error */}
        {audioState.error && !audioState.isLoading && !audioState.hasAudio && !isVisualNovel && (
          <TouchableOpacity 
            style={styles.ttsRetryButton}
            onPress={() => handleTTSButtonPress(message.id, message.text)}
          >
            <Ionicons name="refresh" size={16} color="#ff6666" />
            <Text style={styles.ttsErrorText}>重试</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Add state for memory tooltips
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  // Render memory status indicator
  const renderMemoryStatusIndicator = (messageId: string) => {
    const memoryState = messageMemoryState[messageId];
    
    if (!memoryState) return null;
    
    let iconName: typeof Ionicons.prototype.props.name = 'cellular-outline';
    let iconColor = '#aaa';
    let tooltipText = 'Not processed by memory system';
    
    switch (memoryState) {
      case 'processing':
        iconName = 'time-outline';
        iconColor = '#f39c12';
        tooltipText = 'Processing message for memories...';
        break;
      case 'saved':
        iconName = 'cloud-done'; // Changed from 'brain'
        iconColor = '#2ecc71';
        tooltipText = 'Message saved to memory system';
        break;
      case 'updated':
        iconName = 'refresh-circle';
        iconColor = '#3498db';
        tooltipText = 'Existing memory was updated';
        break;
      case 'failed':
        iconName = 'alert-circle-outline';
        iconColor = '#e74c3c';
        tooltipText = 'Failed to process memory';
        break;
      default:
        break;
    }
    
    return (
      <View style={styles.memoryIndicatorContainer}>
        <TouchableOpacity
          onPress={() => setActiveTooltipId(activeTooltipId === messageId ? null : messageId)}
          style={styles.memoryIndicator}
        >
          <Ionicons name={iconName} size={16} color={iconColor} />
        </TouchableOpacity>
        
        {activeTooltipId === messageId && (
          <View style={styles.memoryTooltip}>
            <Text style={styles.memoryTooltipText}>{tooltipText}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderMessageContent = (message: Message, isUser: boolean, index: number) => {
    return (
      <View style={[
        styles.messageContent,
        isUser ? styles.userMessageContent : styles.botMessageContent,
        message.isLoading && styles.loadingMessage
      ]}>
        {!isUser && (
          <Image
            source={
              selectedCharacter?.avatar
                ? { uri: String(selectedCharacter.avatar) }
                : require('@/assets/images/default-avatar.png')
            }
            style={styles.messageAvatar}
          />
        )}
        {isUser ? (
          <LinearGradient
            colors={['rgba(255, 224, 195, 0.85)', 'rgba(255, 200, 170, 0.85)']}
            style={styles.userGradient}
          >
            {processMessageContent(message.text, true)}
            {/* Add memory status indicator for user messages */}
            {renderMemoryStatusIndicator(message.id)}
          </LinearGradient>
        ) : (
          <View style={styles.botMessageTextContainer}>
            {message.isLoading ? (
              <View style={styles.loadingContainer}>
                <Animated.View style={[styles.loadingDot, dot1Style]} />
                <Animated.View style={[styles.loadingDot, dot2Style]} />
                <Animated.View style={[styles.loadingDot, dot3Style]} />
              </View>
            ) : (
              processMessageContent(message.text, false)
            )
            }
            {!message.isLoading && !isUser && renderMessageActions(message, index)}
          </View>
        )}
      </View>
    );
  };

  // Render message actions (rating buttons and regenerate button)
  const renderMessageActions = (message: Message, index: number) => {
    if (message.isLoading) return null;
    
    const isLastMessage = index === messages.length - 1 || 
                         (index === messages.length - 2 && messages[messages.length - 1].isLoading);
    
    const messageRating = getMessageRating(message.id);
    
    return (
      <View style={styles.messageActions}>
        {/* Add TTS buttons */}
        {message.sender === 'bot' && renderTTSButtons(message)}
        
        {onRegenerateMessage && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onRegenerateMessage(message.id, getAiMessageIndex(index))}
          >
            <Ionicons name="refresh-circle-outline" size={22} color="#ddd" />
          </TouchableOpacity>
        )}
        
        {onRateMessage && (
          <>
            <TouchableOpacity
              style={[
                styles.rateButton, 
                messageRating === true && styles.rateButtonActive
              ]}
              onPress={() => handleRateMessage(message.id, true)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={messageRating === true ? "thumbs-up" : "thumbs-up-outline"} 
                size={20} 
                color={messageRating === true ? theme.colors.primary : "#ddd"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.rateButton, 
                messageRating === false && styles.rateButtonActive
              ]}
              onPress={() => handleRateMessage(message.id, false)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={messageRating === false ? "thumbs-down" : "thumbs-down-outline"}
                size={20} 
                color={messageRating === false ? "#e74c3c" : "#ddd"} 
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // New function to handle opening a fullscreen image by ID
  const handleOpenFullscreenImage = (imageId: string | null) => {
    if (imageId) {
      setFullscreenImageId(imageId);
      const imageInfo = ImageManager.getImageInfo(imageId);
      
      if (imageInfo) {
        console.log(`Opening fullscreen image: ${imageId}`);
        console.log(`Thumbnail path: ${imageInfo.thumbnailPath}`);
        console.log(`Original path: ${imageInfo.originalPath}`);
        
        // First set the thumbnail to show immediately while the full one loads
        setFullscreenImage(imageInfo.thumbnailPath);
        setImageLoading(true);
        
        // Then after a short delay, load the high-res original image
        setTimeout(() => {
          setFullscreenImage(imageInfo.originalPath);
          setImageLoading(false);
        }, 100);
      } else {
        console.error(`No image info found for ID: ${imageId}`);
        setFullscreenImage(null);
        Alert.alert('错误', '无法加载图片');
      }
    }
  };

  // Function to save image to gallery
  const handleSaveImage = async () => {
    try {
      if (fullscreenImageId) {
        // Save using the image ID
        const result = await ImageManager.saveToGallery(fullscreenImageId);
        Alert.alert(result.success ? '成功' : '错误', result.message);
      } else if (fullscreenImage) {
        // Save using the direct image URI
        const result = await ImageManager.saveToGallery(fullscreenImage);
        Alert.alert(result.success ? '成功' : '错误', result.message);
      }
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('错误', '保存图片失败');
    }
  };

  // Function to share image
  const handleShareImage = async () => {
    try {
      let success = false;
      
      if (fullscreenImageId) {
        // Share using image ID
        success = await ImageManager.shareImage(fullscreenImageId);
      } else if (fullscreenImage) {
        // Share using direct URI
        success = await ImageManager.shareImage(fullscreenImage);
      }
      
      if (!success) {
        Alert.alert('错误', '分享功能不可用');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('错误', '分享图片失败');
    }
  };

  // Render visual novel dialog box
  const renderVisualNovelDialog = () => {
    if (!lastAiMessage || !selectedCharacter) return null;
    
    return (
      <View style={[
        styles.visualNovelContainer,
        { backgroundColor: visualNovelSettings.backgroundColor }
      ]}>
        <View style={styles.visualNovelHeader}>
          <Image
            source={
              selectedCharacter?.avatar
                ? { uri: String(selectedCharacter.avatar) }
                : require('@/assets/images/default-avatar.png')
            }
            style={styles.visualNovelAvatar}
          />
          <Text style={[
            styles.visualNovelCharacterName,
            { color: visualNovelSettings.textColor }
          ]}>
            {selectedCharacter.name}
          </Text>
          
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setHistoryModalVisible(true)}
          >
            <Ionicons name="time-outline" size={20} color="#fff" />
            <Text style={styles.historyButtonText}>查看历史</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.visualNovelTextContainer}>
          {/* Replace the plain text with processed content */}
          <View style={styles.visualNovelTextWrapper}>
            {containsComplexHtml(lastAiMessage.text) || /<\/?[a-z][^>]*>/i.test(lastAiMessage.text) ? (
              <RichTextRenderer 
                html={optimizeHtmlForRendering(lastAiMessage.text)}
                baseStyle={{ 
                  color: visualNovelSettings.textColor,
                  fontFamily: visualNovelSettings.fontFamily,
                  fontSize: 16,
                  lineHeight: 22
                }}
                onImagePress={(url) => setFullscreenImage(url)}
                maxImageHeight={MAX_IMAGE_HEIGHT}
              />
            ) : (
              <Text style={[
                styles.visualNovelText,
                { 
                  fontFamily: visualNovelSettings.fontFamily, 
                  color: visualNovelSettings.textColor 
                }
              ]}>
                {lastAiMessage.text}
              </Text>
            )}
          </View>
        </ScrollView>
        
        {/* Add message action buttons in visual novel style */}
        <View style={styles.visualNovelActions}>
          {/* TTS buttons */}
          {renderTTSButtons(lastAiMessage)}
          
          {/* Regenerate button */}
          {onRegenerateMessage && (
            <TouchableOpacity
              style={styles.visualNovelActionButton}
              onPress={() => onRegenerateMessage(lastAiMessage.id, messages.filter(m => m.sender === 'bot' && !m.isLoading).length - 1)}
            >
              <Ionicons name="refresh-circle" size={26} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          )}
          
          {/* Rating buttons */}
          {onRateMessage && (
            <View style={styles.visualNovelRateButtons}>
              <TouchableOpacity
                style={[
                  styles.visualNovelRateButton, 
                  getMessageRating(lastAiMessage.id) === true && styles.visualNovelRateButtonActive
                ]}
                onPress={() => handleRateMessage(lastAiMessage.id, true)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={getMessageRating(lastAiMessage.id) === true ? "thumbs-up" : "thumbs-up-outline"} 
                  size={22} 
                  color={getMessageRating(lastAiMessage.id) === true ? "rgb(255, 224, 195)" : "rgba(255,255,255,0.9)"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.visualNovelRateButton, 
                  getMessageRating(lastAiMessage.id) === false && styles.visualNovelRateButtonActive
                ]}
                onPress={() => handleRateMessage(lastAiMessage.id, false)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={getMessageRating(lastAiMessage.id) === false ? "thumbs-down" : "thumbs-down-outline"}
                  size={22} 
                  color={getMessageRating(lastAiMessage.id) === false ? "#e74c3c" : "rgba(255,255,255,0.9)"} 
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };
  
  // Render history modal for visual novel mode
  const renderHistoryModal = () => {
    return (
      <Modal
        visible={isHistoryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.historyModalContainer}>
          <View style={styles.historyModalHeader}>
            <Text style={styles.historyModalTitle}>对话历史</Text>
            <TouchableOpacity
              style={styles.historyModalCloseButton}
              onPress={() => setHistoryModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.historyModalContent}>
            {messages.map((message, index) => {
              const isUser = message.sender === 'user';
              const showTime = index === 0 || 
                              (index > 0 && new Date(message.timestamp || 0).getMinutes() !== 
                                new Date(messages[index-1].timestamp || 0).getMinutes());
              
              return (
                <View key={message.id} style={styles.historyMessageContainer}>
                  {showTime && message.timestamp && (
                    <Text style={styles.historyTimeText}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Text>
                  )}
                  
                  <View style={[
                    styles.historyMessage,
                    isUser ? styles.historyUserMessage : styles.historyBotMessage
                  ]}>
                    <Text style={[
                      styles.historyMessageText,
                      isUser ? styles.historyUserMessageText : styles.historyBotMessageText
                    ]}>
                      {message.text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <>
      {/* If in visual novel mode, render novel dialog */}
      {mode === 'visual-novel' ? (
        <>
          {/* Empty space for background display */}
          <View style={[styles.container, style, styles.backgroundFocusContainer]} />
          {/* Fixed position dialog at bottom */}
          {renderVisualNovelDialog()}
          {/* History modal */}
          {renderHistoryModal()}
        </>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={[
            styles.container, 
            style,
            // Apply position settings for background focus mode instead of height limit
            mode === 'background-focus' && styles.backgroundFocusContainer
          ]}
          contentContainerStyle={[
            messages.length === 0 ? styles.emptyContent : styles.content,
            // Add padding to content when in background focus mode
            mode === 'background-focus' && styles.backgroundFocusPadding
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            renderEmptyState()
          ) : (
            <Animated.View
              style={[
                styles.messagesContainer,
                messagesAnimatedStyle
              ]}
            >
              {messages.map((message, index) => {
                const isUser = message.sender === 'user';
                const showTime = index === 0 || index % 5 === 0;
                const isLoading = message.isLoading;
                
                return (
                  <View key={message.id} style={styles.messageWrapper}>
                    {showTime && message.timestamp && renderTimeGroup(message.timestamp)}
                    
                    <View
                      style={[
                        styles.messageContainer,
                        isUser ? styles.userMessageContainer : styles.botMessageContainer,
                      ]}
                    >
                      {renderMessageContent(message, isUser, index)}
                    </View>
                  </View>
                );
              })}
              
              <View style={styles.endSpacer} />
            </Animated.View>
          )}
        </ScrollView>
      )}
      
      {/* Fullscreen image modal and other modals remain unchanged */}
      <Modal
        visible={!!fullscreenImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setFullscreenImage(null);
          setFullscreenImageId(null);
        }}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity 
            style={styles.fullscreenCloseButton}
            onPress={() => {
              setFullscreenImage(null);
              setFullscreenImageId(null);
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          {imageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.imageLoadingText}>加载原始图片...</Text>
            </View>
          )}
          
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
          
          <View style={styles.imageActionButtons}>
            <TouchableOpacity
              style={styles.imageActionButton}
              onPress={handleSaveImage}
            >
              <Ionicons name="download" size={24} color="#fff" />
              <Text style={styles.imageActionButtonText}>保存</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.imageActionButton}
              onPress={handleShareImage}
            >
              <Ionicons name="share" size={24} color="#fff" />
              <Text style={styles.imageActionButtonText}>分享</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingVertical: 16,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  messagesContainer: {
    paddingHorizontal: 12,
  },
  messageWrapper: {
    marginBottom: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#444',
  },
  messageContent: {
    flex: 1,
    maxWidth: MAX_WIDTH + 30, // Increased width since we removed side avatars
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  userMessageContent: {
    alignSelf: 'flex-end',
  },
  botMessageContent: {
    alignSelf: 'flex-start',
  },
  userGradient: {
    borderRadius: 18,
    borderTopRightRadius: 4,
    padding: 12,
    paddingHorizontal: 16,
  },
  userMessageText: {
    color: '#333',
    fontSize: 16,
  },
  botMessageTextContainer: {
    backgroundColor: 'rgba(68, 68, 68, 0.85)', // Semi-transparent background
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 12,
    paddingHorizontal: 16,
    width: '100%', // Ensure content takes full width available
    paddingTop: 20, // Extra padding at top to accommodate avatar
    maxWidth: '98%', // Ensure it doesn't exceed parent width
    marginTop: 15, // Space for the avatar
  },
  botMessageText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingMessage: {
    minWidth: 80,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 24,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#bbb',
    marginHorizontal: 2,
    opacity: 0.7,
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    alignItems: 'center',
  },
  rateButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  rateButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  timeGroup: {
    alignItems: 'center',
    marginVertical: 8,
  },
  timeText: {
    color: '#ddd',
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: '#bbb',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  endSpacer: {
    height: 40,
  },
  imageWrapper: {
    marginVertical: 8,
    alignItems: 'center',
  },
  messageImage: {
    width: '100%',
    height: 200,
    maxHeight: MAX_IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 42, 42, 0.5)', // Semi-transparent background
  },
  imageCaption: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
    textAlign: 'center',
  },
  imageDataUrlWarning: {
    backgroundColor: 'rgba(51, 51, 51, 0.8)', // Semi-transparent background
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  imageDataUrlWarningText: {
    color: '#ddd',
    fontSize: 14,
    marginTop: 8,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkIcon: {
    marginRight: 8,
  },
  linkText: {
    color: '#3498db',
    textDecorationLine: 'underline',
    fontSize: 16,
  },
  actionButton: {
    padding: 8,
    marginRight: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
  },
  // Add a new style for rich content
  richContentWrapper: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 4,
    marginBottom: 5, // Add some margin at the bottom
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    position: 'absolute',
    left: 10,
    top: -15,
    zIndex: 2,
    backgroundColor: '#444',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  // Add new styles for memory indicators
  memoryIndicatorContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  memoryIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryTooltip: {
    position: 'absolute',
    top: 25,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    width: 150,
    zIndex: 100,
  },
  memoryTooltipText: {
    color: 'white',
    fontSize: 12,
  },
  imageError: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 20,
    borderRadius: 8,
    marginVertical: 8,
  },
  imageErrorText: {
    color: '#e74c3c',
    marginTop: 8,
    textAlign: 'center',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  imageLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  imageActionButtons: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  imageActionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageActionButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  // Add styles for TTS buttons
  ttsButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  ttsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(52, 152, 219, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  ttsButtonActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.7)',
  },
  ttsButtonWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ttsLoadingText: {
    color: '#ddd',
    fontSize: 12,
    marginLeft: 4,
  },
  ttsRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 102, 102, 0.1)',
    borderRadius: 12,
    marginLeft: 4,
  },
  ttsErrorText: {
    color: '#ff6666',
    fontSize: 12,
    marginLeft: 4,
  },
  // Add new styles for TTS enhancer
  ttsButtonEnhanced: {
    backgroundColor: 'rgba(255, 193, 7, 0.7)', // More golden color for enhanced mode
  },
  ttsEnhancerIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Update background focus mode styles to show top half of image
  backgroundFocusContainer: {
    position: 'absolute',
    top: '50%', // Position the scroll view halfway down the screen
    left: 0,
    right: 0,
    bottom: 0,  // Extend to bottom of screen
    maxHeight: '50%', // Take up bottom 50% of screen
  },
  backgroundFocusPadding: {
    paddingTop: 20, // Add some padding to the top for better appearance
  },
  
  // Add styles for visual novel mode
  visualNovelContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    minHeight: 200,
    maxHeight: 320,
    borderRadius: 16,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  visualNovelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  visualNovelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  visualNovelCharacterName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  visualNovelTextContainer: {
    maxHeight: 220,
  },
  visualNovelTextWrapper: {
    marginBottom: 8, // Add space for buttons
  },
  visualNovelText: {
    fontSize: 16,
    lineHeight: 22,
  },
  
  // Add styles for visual novel action buttons
  visualNovelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  visualNovelActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  visualNovelRateButtons: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  visualNovelRateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  visualNovelRateButtonActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  
  // Visual novel TTS button styles
  visualNovelTTSContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto', // Push to the start/left
  },
  visualNovelTTSButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(52, 152, 219, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  visualNovelTTSButtonWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visualNovelTTSButtonActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.7)',
  },
  visualNovelTTSButtonEnhanced: {
    backgroundColor: 'rgba(255, 193, 7, 0.7)',
  },
  visualNovelTTSEnhancerIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // History modal styles
  historyModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 40,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
  },
  historyModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyModalCloseButton: {
    padding: 8,
  },
  historyModalContent: {
    flex: 1,
    padding: 16,
  },
  historyMessageContainer: {
    marginBottom: 16,
  },
  historyTimeText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  historyMessage: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  historyUserMessage: {
    backgroundColor: 'rgba(255, 224, 195, 0.85)',
    alignSelf: 'flex-end',
    borderTopRightRadius: 4,
  },
  historyBotMessage: {
    backgroundColor: 'rgba(68, 68, 68, 0.85)',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
  },
  historyMessageText: {
    fontSize: 16,
  },
  historyUserMessageText: {
    color: '#333',
  },
  historyBotMessageText: {
    color: '#fff',
  },
  // Add the missing styles for history button
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  historyButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
  },
  imageContainer: {
    width: '100%',
  },
});

export default ChatDialog;