import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useCharacters } from '@/constants/CharactersContext';
import { useUser } from '@/constants/UserContext';
import { ChatInputProps, Character } from '@/shared/types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NodeSTManager } from '@/utils/NodeSTManager';

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  selectedCharacter
}) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const { user } = useUser();

  const handleSubmit = async () => {
    if (!message.trim() || !selectedCharacter) return;
    
    try {
      setIsLoading(true);
      const userMessage = message.trim();
      setMessage(''); // 提前清空输入框
      
      // 发送用户消息
      onSendMessage(userMessage, 'user');

      // 显示加载状态，使用固定的loading消息ID前缀
      const loadingMessageId = `loading-${Date.now()}`;
      onSendMessage('', 'bot', true);

      // 添加 API 设置信息传递
      const response = await NodeSTManager.processChatMessage({
        userMessage,
        conversationId: selectedCharacter.id,
        status: "同一角色继续对话",
        apiKey: user?.settings?.chat.characterApiKey || '',
        apiSettings: {
          apiProvider: user?.settings?.chat.apiProvider || 'gemini',
          openrouter: user?.settings?.chat.openrouter
        },
        character: selectedCharacter
      });

      if (response.success && response.text) {
        onSendMessage(response.text, 'bot');
      } else {
        throw new Error(response.error || 'No response received');
      }

    } catch (error) {
      console.error('Chat processing failed:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process chat');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            { height: Math.min(inputHeight, 120) }
          ]}
          value={message}
          onChangeText={setMessage}
          placeholder="输入消息..."
          placeholderTextColor="#666"
          multiline
          onContentSizeChange={(e) => {
            setInputHeight(e.nativeEvent.contentSize.height);
          }}
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, message.trim() ? styles.sendButtonActive : null]} 
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Icon name="send" size={24} color={message.trim() ? "#fff" : "#999"} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// 更新样式
const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#282828',
    borderRadius: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#282828',
    borderRadius: 20,
    fontSize: 16,
    color: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sendButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgb(255, 255, 255)',
  },
  sendButtonActive: {
    backgroundColor: 'rgb(255, 183, 116)',
  }
});

export default ChatInput;
