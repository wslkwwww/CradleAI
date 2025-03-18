import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ViewStyle,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Message, Character,ChatDialogProps } from '@/shared/types';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { parseHtmlText, containsComplexHtml, extractCodeBlocks, reinsertCodeBlocks } from '@/utils/textParser';
import { ratingService } from '@/services/ratingService';
import RichTextRenderer from './RichTextRenderer';


const { width } = Dimensions.get('window');
// Adjust the maximum width to ensure proper margins
const MAX_WIDTH = width * 0.88; // Decreased from 0.9 to 0.88 to add more margin
const MAX_IMAGE_HEIGHT = 300; // Maximum height for images in chat

const ChatDialog: React.FC<ChatDialogProps> = ({
  messages,
  style,
  selectedCharacter,
  onRateMessage,
  onRegenerateMessage,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(20)).current;
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [ratedMessages, setRatedMessages] = useState<Record<string, boolean>>({});
  
  // Add state to track scroll position for different conversations
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const isInitialScrollRestored = useRef(false);
  
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
    }
  };

  // Animate new messages
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [messages]);

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
    
    const savedPosition = scrollPositions[currentConversationId];
    if (savedPosition !== undefined) {
      // Delay scrolling to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: savedPosition, animated: false });
        isInitialScrollRestored.current = true;
      }, 300);
    } else if (messages.length > 0) {
      // If no saved position but messages exist, scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
        isInitialScrollRestored.current = true;
      }, 300);
    }
  }, [currentConversationId, messages, scrollPositions]);

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

  // Enhanced rate message handler with animations and persistence
  const handleRateMessage = async (messageId: string, isUpvote: boolean) => {
    // Create animation for feedback
    const buttonScale = new Animated.Value(1);
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 1.5,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
    
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
    // Check for HTML content or interactive elements
    const hasInteractive = text.includes('<button') || 
                          text.includes('onclick=') || 
                          text.includes('<audio') || 
                          text.includes('<video') ||
                          text.includes('<details') ||
                          text.includes('<summary');
    
    const hasHtmlDocument = text.includes('<!DOCTYPE html>') || 
                          text.includes('<html') || 
                          text.includes('<head');
                          
    // If it's a complete HTML document, use WebView rendering with priority
    if (hasHtmlDocument || hasInteractive) {
      return (
        <View style={styles.richContentWrapper}>
          <RichTextRenderer 
            content={text} 
            isUserMessage={isUser} 
            maxWidth={width - 80} // Provide more space for HTML content (increased margin)
          />
        </View>
      );
    }

    // Handle code blocks in markdown format
    if (text.includes('```')) {
      return (
        <RichTextRenderer 
          content={text} 
          isUserMessage={isUser} 
          maxWidth={MAX_WIDTH - 32} // Add more padding for code blocks
        />
      );
    }
                          
    if (containsComplexHtml(text)) {
      // Extract any code blocks first
      const { codeBlocks, newText } = extractCodeBlocks(text);
      
      // Check if we have code blocks that need special handling
      if (codeBlocks.length > 0) {
        // Process the text and reinsert code blocks
        const processedText = reinsertCodeBlocks(newText, codeBlocks);
        return (
          <RichTextRenderer 
            content={processedText} 
            isUserMessage={isUser} 
            maxWidth={MAX_WIDTH - 24} 
          />
        );
      }
      
      // No code blocks, just render the HTML directly
      return (
        <RichTextRenderer 
          content={text} 
          isUserMessage={isUser} 
          maxWidth={MAX_WIDTH - 24} 
        />
      );
    }
  
    // For plain text with newlines but no HTML, render with WebView to preserve formatting
    if (text.includes('\n') && !text.includes('<')) {
      return (
        <RichTextRenderer 
          content={text}
          isUserMessage={isUser}
          maxWidth={MAX_WIDTH - 24}
        />
      );
    }
    
    // Handle existing image markdown and links
    const imageMarkdownRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+)\)|!\[(.*?)\]\((data:image\/[^\s)]+)\)/g;
    let match: RegExpExecArray | null;
    let matches: { alt: string, url: string }[] = [];
    
    while ((match = imageMarkdownRegex.exec(text)) !== null) {
      matches.push({
        alt: match[1] || match[3] || "图片",
        url: match[2] || match[4]
      });
    }
    
    // 如果找到图片链接
    if (matches.length > 0) {
      return (
        <View>
          {matches.map((img, idx) => {
            // 检查是否为数据 URL 或 HTTP URL
            const isDataUrl = img.url.startsWith('data:');
            const isLargeDataUrl = isDataUrl && img.url.length > 100000;
            
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

  // Render message actions (rating buttons and regenerate button)
  const renderMessageActions = (message: Message, index: number) => {
    if (message.isLoading) return null;
    
    const isLastMessage = index === messages.length - 1 || 
                         (index === messages.length - 2 && messages[messages.length - 1].isLoading);
    
    const messageRating = getMessageRating(message.id);
    
    return (
      <View style={styles.messageActions}>
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

  // Update renderMessageContent to include avatar at the top of bot messages
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
          </LinearGradient>
        ) : (
          <View style={styles.botMessageTextContainer}>
            {message.isLoading ? (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingDot} />
                <View style={[styles.loadingDot, { animationDelay: '0.2s' }]} />
                <View style={[styles.loadingDot, { animationDelay: '0.4s' }]} />
              </View>
            ) : (
              processMessageContent(message.text, false)
            )}
            
            {!message.isLoading && !isUser && renderMessageActions(message, index)}
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, style]}
        contentContainerStyle={
          messages.length === 0 ? styles.emptyContent : styles.content
        }
        onScroll={handleScroll}
        scrollEventThrottle={16} // For more accurate scroll tracking
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <Animated.View
            style={[
              styles.messagesContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateAnim }],
              },
            ]}
          >
            {messages.map((message, index) => {
              const isUser = message.sender === 'user';
              const showTime = index === 0 || index % 5 === 0; // Show time every 5 messages
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
                    {/* Remove avatar containers here as they're now inside the message content */}
                    {renderMessageContent(message, isUser, index)}
                  </View>
                </View>
              );
            })}
            
            <View style={styles.endSpacer} />
          </Animated.View>
        )}
      </ScrollView>
      
      {/* 全屏查看图片的模态框 */}
      <Modal
        visible={!!fullscreenImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity 
            style={styles.fullscreenCloseButton}
            onPress={() => setFullscreenImage(null)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
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
    paddingHorizontal: 2, // Add small padding to ensure margins
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
});

export default ChatDialog;