import React, { useRef, useEffect } from 'react';
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
}

const { width } = Dimensions.get('window');
const MAX_WIDTH = width * 0.8; // Maximum width for chat bubbles

const ChatDialog: React.FC<ChatDialogProps> = ({
  messages,
  style,
  selectedCharacter,
  onRateMessage,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(20)).current;

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

  return (
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
                        {renderMessageText(message.text, true)}
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
                          renderMessageText(message.text, false)
                        )}
                        
                        {!isLoading && onRateMessage && (
                          <View style={styles.messageActions}>
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
                          </View>
                        )}
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
});

export default ChatDialog;