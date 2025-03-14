import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character, CradleCharacter } from '@/shared/types';
import { useUser } from '@/constants/UserContext';
import { theme } from '@/constants/theme';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { parseCharacterJson } from '../utils/characterUtils';

interface CharacterEditDialogProps {
  isVisible: boolean;
  character: Character | CradleCharacter;
  onClose: () => void;
  onUpdateCharacter: (updatedCharacter: Character | CradleCharacter) => Promise<void>;
}

const CharacterEditDialog: React.FC<CharacterEditDialogProps> = ({
  isVisible,
  character,
  onClose,
  onUpdateCharacter
}) => {
  const { user } = useUser();
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp: number }>>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [updatedJsonData, setUpdatedJsonData] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize with system prompt when dialog opens
  useEffect(() => {
    if (isVisible) {
      // Add system prompt as the first message
      const systemPrompt = createSystemPrompt(character);
      setMessages([
        {
          role: 'system',
          content: systemPrompt,
          timestamp: Date.now()
        },
        {
          role: 'assistant',
          content: `我是角色设计助手，可以帮你修改"${character.name}"的人设。请告诉我你想如何调整这个角色？例如：\n\n- 改变性格特点\n- 修改背景故事\n- 调整对话风格\n- 添加新的技能或爱好\n\n请直接描述你的需求，我会基于当前角色设定进行修改。`,
          timestamp: Date.now()
        }
      ]);
      
      // Reset states
      setUpdatedJsonData(null);
      setIsPreviewing(false);
      setPreviewError(null);
    }
  }, [isVisible, character]);

  // Create the system prompt for LLM
  const createSystemPrompt = (character: Character | CradleCharacter): string => {
    // Original character JSON data
    const originalData = character.jsonData || '{}';
    
    return `你是一位专业的AI角色设计师，擅长根据用户需求修改角色设定。

正在编辑的角色：${character.name}

你的任务是：
1. 理解用户对角色的修改需求
2. 基于当前角色设定和用户的指示，生成修改后的角色数据
3. 使用正确的格式输出角色数据，确保JSON结构完整且有效

当前角色数据：
${originalData}

请注意：
- 只修改用户明确要求改变的部分，保留其他原有设定
- 输出必须是有效的JSON格式
- 结构必须与原始数据保持一致（包括roleCard、worldBook、preset等关键字段）
- 请保持原有的数据结构，避免添加或删除顶级字段

当用户要求查看修改结果或应用修改时，请以以下格式输出修改后的完整角色数据：

\`\`\`json
{
  "roleCard": { ... },
  "worldBook": { ... },
  "preset": { ... },
  "authorNote": { ... }
}
\`\`\`

在输出JSON前，请先用1-2句话简单总结你做了哪些修改。`;
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (inputText.trim() === '') return;
    
    const userMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    try {
      // Get API settings
      const apiKey = user?.settings?.chat?.characterApiKey || '';
      const apiProvider = user?.settings?.chat?.apiProvider || 'gemini';
      
      if (!apiKey) {
        throw new Error('API密钥未设置，请在全局设置中配置');
      }
      
      // Prepare messages for API
      const apiMessages = messages.concat(userMessage).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      
      // Send to LLM via NodeSTManager
      const response = await NodeSTManager.generateText(apiMessages, apiKey, {
        apiProvider,
        openrouter: user?.settings?.chat?.openrouter
      });
      
      // Add LLM response to messages
      const assistantMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Check if response contains JSON data for preview
      if (response.includes('```json')) {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          setUpdatedJsonData(jsonMatch[1].trim());
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `发生错误：${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
      
      // Scroll to bottom after message is added
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Handle previewing character changes
  const handlePreviewChanges = async () => {
    if (!updatedJsonData) return;
    
    setIsLoading(true);
    setPreviewError(null);
    
    try {
      // Parse and validate the JSON data
      const parsedData = parseCharacterJson(updatedJsonData);
      
      if (!parsedData.roleCard || !parsedData.worldBook) {
        throw new Error('数据结构不完整，缺少roleCard或worldBook字段');
      }
      
      // Update preview state
      setIsPreviewing(true);
      
      // Add a confirmation message
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: '⚠️ 注意：这只是预览效果，角色数据尚未保存。请点击"确认应用"按钮来保存更改，或点击"取消修改"返回编辑状态。',
          timestamp: Date.now()
        }
      ]);
    } catch (error) {
      console.error('预览修改失败:', error);
      setPreviewError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle applying character changes
  const handleApplyChanges = async () => {
    if (!updatedJsonData) return;
    
    setIsLoading(true);
    
    try {
      // Parse the updated JSON data
      const parsedData = parseCharacterJson(updatedJsonData);
      
      // Create updated character object
      const updatedCharacter = {
        ...character,
        jsonData: updatedJsonData,
        name: parsedData.roleCard.name,
        description: parsedData.roleCard.description,
        personality: parsedData.roleCard.personality,
        // Update any other fields from the JSON data
        interests: extractInterestsFromWorldBook(parsedData.worldBook) || character.interests
      };
      
      // Call the parent's update function
      await onUpdateCharacter(updatedCharacter);
      
      // Add success message
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: '✅ 修改已成功应用并保存！',
          timestamp: Date.now()
        }
      ]);
      
      // Reset states
      setUpdatedJsonData(null);
      setIsPreviewing(false);
    } catch (error) {
      console.error('应用修改失败:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `❌ 应用修改失败：${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle canceling changes
  const handleCancelChanges = () => {
    setIsPreviewing(false);
    setUpdatedJsonData(null);
    setMessages(prev => [
      ...prev,
      {
        role: 'system',
        content: '🔄 已取消修改，可以继续编辑。',
        timestamp: Date.now()
      }
    ]);
  };

  // Handle resetting the conversation
  const handleResetConversation = () => {
    const systemPrompt = createSystemPrompt(character);
    setMessages([
      {
        role: 'system',
        content: systemPrompt,
        timestamp: Date.now()
      },
      {
        role: 'assistant',
        content: `我是角色设计助手，可以帮你修改"${character.name}"的人设。请告诉我你想如何调整这个角色？`,
        timestamp: Date.now()
      }
    ]);
    setUpdatedJsonData(null);
    setIsPreviewing(false);
    setPreviewError(null);
  };

  // Extract interests from world book
  const extractInterestsFromWorldBook = (worldBook: any): string[] => {
    if (!worldBook?.entries?.Alist?.content) return [];
    
    try {
      const content = worldBook.entries.Alist.content;
      const likesMatch = content.match(/<likes>(.*?)<\/likes>/s);
      
      if (likesMatch && likesMatch[1]) {
        return likesMatch[1]
          .split(/[,，]/)
          .map((item: string): string => item.trim())
          .filter((item: string): boolean => item.length > 0 && item !== "未指定");
      }
      
      return [];
    } catch (error) {
      console.error('[角色创作助手] 从世界书提取兴趣爱好时出错:', error);
      return [];
    }
  };

  // Render a message bubble
  const renderMessage = (message: { role: string; content: string; timestamp: number }, index: number) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    
    if (isSystem) {
      return (
        <View key={index} style={styles.systemMessageContainer}>
          <Text style={styles.systemMessage}>{message.content}</Text>
        </View>
      );
    }
    
    return (
      <View
        key={index}
        style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.assistantMessage
        ]}
      >
        <Text style={styles.messageText}>{message.content}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>编辑"{character.name}"</Text>
          <TouchableOpacity onPress={handleResetConversation} style={styles.resetButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Chat messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.filter(msg => msg.role !== 'system' || msg.role === 'system' && messages.indexOf(msg) > 0).map(renderMessage)}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          )}
        </ScrollView>
        
        {/* Preview error message */}
        {previewError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{previewError}</Text>
          </View>
        )}
        
        {/* Action buttons */}
        {updatedJsonData && !isPreviewing && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.previewButton]}
              onPress={handlePreviewChanges}
              disabled={isLoading}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>预览修改</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Preview action buttons */}
        {isPreviewing && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.applyButton]}
              onPress={handleApplyChanges}
              disabled={isLoading}
            >
              <Ionicons name="checkmark" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>确认应用</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancelChanges}
              disabled={isLoading}
            >
              <Ionicons name="close" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>取消修改</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Input area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={100}
          style={styles.inputContainer}
        >
          <TextInput
            style={styles.input}
            placeholder="描述你想对角色做的修改..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!isLoading && !isPreviewing}
          />
          <TouchableOpacity
            style={[styles.sendButton, (isLoading || inputText.trim() === '' || isPreviewing) && styles.disabledButton]}
            onPress={handleSendMessage}
            disabled={isLoading || inputText.trim() === '' || isPreviewing}
          >
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#444',
  },
  systemMessageContainer: {
    padding: 8,
    marginVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  systemMessage: {
    color: '#ccc',
    fontSize: 14,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#333',
  },
  input: {
    flex: 1,
    backgroundColor: '#444',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  previewButton: {
    backgroundColor: '#2196F3',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
});

export default CharacterEditDialog;
