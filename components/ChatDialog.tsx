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
import { Message, Character } from '@/shared/types';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { parseHtmlText } from '@/utils/textParser';

interface ChatDialogProps {
  messages: Message[];
  style?: ViewStyle;
  selectedCharacter?: Character | null;
  onRateMessage?: (messageId: string, isUpvote: boolean) => void;
  onRegenerateMessage?: (messageId: string, messageIndex: number) => void;
}

const { width } = Dimensions.get('window');
const MAX_WIDTH = width * 0.8; // Maximum width for chat bubbles
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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
    // 检查是否是图片 Markdown 语法，支持 HTTP URL 和 data URL
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

  // Render message actions (rating buttons and regenerate button)
  const renderMessageActions = (message: Message, index: number) => {
    if (message.isLoading) return null;
    
    const isLastMessage = index === messages.length - 1 || 
                         (index === messages.length - 2 && messages[messages.length - 1].isLoading);
    
    return (
      <View style={styles.messageActions}>
        {onRegenerateMessage && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onRegenerateMessage(message.id, getAiMessageIndex(index))}
          >
            <Ionicons name="refresh-circle-outline" size={20} color="#999" />
          </TouchableOpacity>
        )}
        
        {onRateMessage && (
          <>
            <TouchableOpacity
              style={styles.rateButton}
              onPress={() => onRateMessage(message.id, true)}
            >
              <Ionicons name="thumbs-up-outline" size={18} color="#999" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.rateButton}
              onPress={() => onRateMessage(message.id, false)}
            >
              <Ionicons name="thumbs-down-outline" size={18} color="#999" />
            </TouchableOpacity>
          </>
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
                    {!isUser && (
                      <View style={styles.avatarContainer}>
                        <Image
                          source={
                            selectedCharacter?.avatar
                              ? { uri: String(selectedCharacter.avatar) }
                              : require('@/assets/images/default-avatar.png')
                          }
                          style={styles.avatar}
                        />
                      </View>
                    )}
                    
                    <View style={[
                      styles.messageContent,
                      isUser ? styles.userMessageContent : styles.botMessageContent,
                      isLoading && styles.loadingMessage
                    ]}>
                      {isUser ? (
                        <LinearGradient
                          colors={['rgb(255, 224, 195)', 'rgb(255, 200, 170)']}
                          style={styles.userGradient}
                        >
                          {processMessageContent(message.text, true)}
                        </LinearGradient>
                      ) : (
                        <View style={styles.botMessageTextContainer}>
                          {isLoading ? (
                            <View style={styles.loadingContainer}>
                              <View style={styles.loadingDot} />
                              <View style={[styles.loadingDot, { animationDelay: '0.2s' }]} />
                              <View style={[styles.loadingDot, { animationDelay: '0.4s' }]} />
                            </View>
                          ) : (
                            processMessageContent(message.text, false)
                          )}
                          
                          {!isLoading && !isUser && renderMessageActions(message, index)}
                        </View>
                      )}
                    </View>
                    
                    {isUser && (
                      <View style={styles.avatarContainer}>
                        <Image
                          source={require('@/assets/images/default-user-avatar.png')}
                          style={styles.avatar}
                        />
                      </View>
                    )}
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
    maxWidth: MAX_WIDTH,
    marginHorizontal: 8,
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
    backgroundColor: '#444',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 12,
    paddingHorizontal: 16,
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
    backgroundColor: '#999',
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
    padding: 4,
    marginLeft: 12,
  },
  timeGroup: {
    alignItems: 'center',
    marginVertical: 8,
  },
  timeText: {
    color: '#999',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  endSpacer: {
    height: 40,
  },
  // 新增样式
  imageWrapper: {
    marginVertical: 8,
    alignItems: 'center',
  },
  messageImage: {
    width: '100%',
    height: 200,
    maxHeight: MAX_IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  imageCaption: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  imageDataUrlWarning: {
    backgroundColor: '#333',
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
    backgroundColor: 'rgba(0,0,0,0.9)',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    padding: 6,
    marginRight: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
  },
});

export default ChatDialog;