import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { useUser } from '@/constants/UserContext';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { theme } from '@/constants/theme';
import { BlurView } from 'expo-blur';

interface ChatInputProps {
  onSendMessage: (text: string, sender: 'user' | 'bot', isLoading?: boolean) => void;
  selectedConversationId: string | null;
  conversationId: string;
  onResetConversation: () => void;
  selectedCharacter: Character;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  selectedConversationId,
  conversationId,
  onResetConversation,
  selectedCharacter,
}) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { user } = useUser();
  const inputRef = useRef<TextInput>(null);
  
  // Animation states
  const actionMenuHeight = useRef(new Animated.Value(0)).current;
  const actionMenuOpacity = useRef(new Animated.Value(0)).current;

  // Keyboard listener effect
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setShowActions(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  // Toggle action menu animation
  useEffect(() => {
    if (showActions) {
      Animated.parallel([
        Animated.timing(actionMenuHeight, {
          toValue: 120,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(actionMenuOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(actionMenuHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(actionMenuOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [showActions]);

  const handleSendPress = async () => {
    if (text.trim() === '') return;
    if (!selectedConversationId) {
      Alert.alert('错误', '请先选择一个角色');
      return;
    }

    const messageToSend = text.trim();
    setText('');
    setIsLoading(true);
    
    try {
      // Send user message
      onSendMessage(messageToSend, 'user');
      
      // Create temp loading message for bot
      const tempId = `temp-${Date.now()}`;
      onSendMessage('', 'bot', true);
      
      // Log API settings before sending
      console.log('[ChatInput] Sending message with API settings:', {
        provider: user?.settings?.chat.apiProvider,
        openRouterEnabled: user?.settings?.chat.apiProvider === 'openrouter' && user?.settings?.chat.openrouter?.enabled,
        model: user?.settings?.chat.openrouter?.model || 'default'
      });
      
      // Use NodeST for actual processing with proper API settings
      const result = await NodeSTManager.processChatMessage({
        userMessage: messageToSend,
        status: '同一角色继续对话',
        conversationId: conversationId,
        apiKey: user?.settings?.chat.characterApiKey || '',
        apiSettings: {
          apiProvider: user?.settings?.chat.apiProvider || 'gemini',
          openrouter: user?.settings?.chat.openrouter
        },
        character: selectedCharacter
      });
      
      // Remove the temp loading message and add the real response
      if (result.success) {
        onSendMessage(result.text || '抱歉，未收到有效回复。', 'bot');
      } else {
        onSendMessage('抱歉，处理消息时出现了错误，请重试。', 'bot');
        console.error('NodeST error:', result.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      onSendMessage('抱歉，发送消息时出现了错误，请重试。', 'bot');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActionMenu = () => {
    Keyboard.dismiss();
    setShowActions(!showActions);
  };

  const handleResetConversation = () => {
    Alert.alert(
      '确定要重置对话吗？',
      '这将清除所有对话历史记录',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '重置', 
          style: 'destructive',
          onPress: () => {
            onResetConversation();
            setShowActions(false);
          }
        },
      ]
    );
  };

  const handleRegenerateResponse = async () => {
    if (!selectedConversationId) return;

    setIsLoading(true);
    setShowActions(false);
    
    try {
      // Create temp loading message
      onSendMessage('', 'bot', true);
      
      // Use NodeST for processing with regenerate flag
      const result = await NodeSTManager.processChatMessage({
        userMessage: "请重新生成上一条回复",
        conversationId: conversationId,
        status: "更新人设",
        apiKey: user?.settings?.chat.characterApiKey || '',
        character: selectedCharacter
      });
      
      if (result.success) {
        onSendMessage(result.text || '抱歉，未收到有效回复。', 'bot');
      } else {
        onSendMessage('抱歉，重新生成回复时出现了错误，请重试。', 'bot');
        console.error('NodeST regenerate error:', result.error);
      }
    } catch (error) {
      console.error('Error regenerating response:', error);
      onSendMessage('抱歉，重新生成回复时出现了错误，请重试。', 'bot');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Action Menu */}
      <Animated.View
        style={[
          styles.actionMenuContainer,
          {
            height: actionMenuHeight,
            opacity: actionMenuOpacity,
          },
        ]}
      >
        <BlurView
          intensity={50}
          tint="dark"
          style={styles.actionMenuBlur}
        >
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleResetConversation}
            >
              <View style={[styles.actionIcon, styles.resetIcon]}>
                <Ionicons name="refresh" size={24} color="#fff" />
              </View>
              <Animated.Text style={styles.actionText}>
                重置对话
              </Animated.Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRegenerateResponse}
            >
              <View style={[styles.actionIcon, styles.regenerateIcon]}>
                <Ionicons name="refresh-circle" size={24} color="#fff" />
              </View>
              <Animated.Text style={styles.actionText}>
                重新生成
              </Animated.Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // Implement continue generation
                Alert.alert('提示', '此功能即将推出');
              }}
            >
              <View style={[styles.actionIcon, styles.continueIcon]}>
                <Ionicons name="arrow-forward-circle" size={24} color="#fff" />
              </View>
              <Animated.Text style={styles.actionText}>
                继续生成
              </Animated.Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={[styles.button, styles.plusButton, showActions && styles.activeButton]}
          onPress={toggleActionMenu}
        >
          <MaterialIcons
            name={showActions ? "close" : "add"}
            size={24}
            color={showActions ? "#fff" : theme.colors.primary}
          />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="输入消息..."
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          numberOfLines={1}
          onFocus={() => setShowActions(false)}
        />

        <TouchableOpacity
          style={[styles.button, styles.sendButton]}
          onPress={handleSendPress}
          disabled={isLoading || text.trim() === ''}
        >
          {isLoading ? (
            <Ionicons name="ellipsis-horizontal" size={24} color="#777" />
          ) : (
            <MaterialIcons
              name="send"
              size={24}
              color={text.trim() === '' ? '#777' : theme.colors.primary}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 100,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeButton: {
    backgroundColor: theme.colors.primary,
  },
  sendButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionMenuContainer: {
    overflow: 'hidden',
    marginBottom: 8,
    borderRadius: 16,
  },
  actionMenuBlur: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  resetIcon: {
    backgroundColor: '#d9534f',
  },
  regenerateIcon: {
    backgroundColor: '#5bc0de',
  },
  continueIcon: {
    backgroundColor: '#5cb85c',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default ChatInput;
