import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Switch,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character, CradleCharacter } from '@/shared/types';
import { useUser } from '@/constants/UserContext';
import { NodeSTManager } from '@/utils/NodeSTManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCharacters } from '@/constants/CharactersContext';
import { theme } from '@/constants/theme';

interface CharacterEditDialogProps {
  isVisible: boolean;
  character: Character | CradleCharacter;
  onClose: () => void;
  onUpdateCharacter?: (updatedCharacter: Character | CradleCharacter) => Promise<void>;
}

// Define a message type for our chat
interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: number;
}

export default function CharacterEditDialog({
  isVisible,
  character,
  onClose,
  onUpdateCharacter
}: CharacterEditDialogProps) {
  const { user } = useUser();
  const { updateCharacter, characters } = useCharacters(); // Add characters to get the full list
  const apiKey = user?.settings?.chat?.characterApiKey || '';
  const apiSettings = {
    apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
    openrouter: user?.settings?.chat?.openrouter
  };
  
  // State for chat UI
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Character update related states
  const [updatedCharacter, setUpdatedCharacter] = useState<Character | CradleCharacter | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isGeneratingUpdate, setIsGeneratingUpdate] = useState(false);
  
  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Keep track of the character's dialog history key for storage
  const dialogHistoryKey = `character_edit_dialog_${character.id}`;
  
  // Log when hasChanges or updatedCharacter changes
  useEffect(() => {
    console.log('[CharacterEditDialog] hasChanges:', hasChanges);
    console.log('[CharacterEditDialog] updatedCharacter exists:', !!updatedCharacter);
  }, [hasChanges, updatedCharacter]);
  
  // Add new state for tracking character relationships
  const [characterRelationships, setCharacterRelationships] = useState<{
    isCradleCharacter: boolean;
    hasGeneratedVersion: boolean;
    generatedCharacterId: string | null;
    normalCharacter: Character | null;
  }>({
    isCradleCharacter: false,
    hasGeneratedVersion: false,
    generatedCharacterId: null,
    normalCharacter: null
  });
  
  // Initialize when dialog opens with character data and load chat history
  useEffect(() => {
    if (isVisible && character) {
      // Reset states when dialog opens
      setHasChanges(false);
      setUpdatedCharacter(null);
      setShowPreview(false);
      
      // Check character relationships
      const isCradleCharacter = 'inCradleSystem' in character && character.inCradleSystem === true;
      const generatedCharacterId = (character as CradleCharacter).generatedCharacterId || null;
      let normalCharacter: Character | null = null;
      
      if (isCradleCharacter && generatedCharacterId) {
        // Try to find the generated character in the characters array
        normalCharacter = characters.find(c => c.id === generatedCharacterId) || null;
      }
      
      // Update relationship state
      setCharacterRelationships({
        isCradleCharacter,
        hasGeneratedVersion: generatedCharacterId !== null,
        generatedCharacterId,
        normalCharacter
      });
      
      // Log the character data we received directly
      console.log('[CharacterEditDialog] Received character data:', {
        id: character.id,
        name: character.name,
        isCradleCharacter,
        generatedCharacterId,
        hasNormalCharacter: !!normalCharacter,
        hasJsonData: !!character.jsonData,
        jsonDataLength: character.jsonData?.length || 0
      });
      
      // Load saved chat history for this character
      loadChatHistory();
      
      // If we don't have any messages yet, send a welcome message
      if (messages.length === 0) {
        // Send initial system message
        const initialMessage = getInitialSystemMessage();
        
        setMessages([
          {
            id: 'system-1',
            text: initialMessage,
            sender: 'bot' as const,
            timestamp: Date.now()
          }
        ]);
      }
    }
  }, [isVisible, character.id, characters]);
  
  // Load chat history from AsyncStorage
  const loadChatHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem(dialogHistoryKey);
      
      if (savedHistory) {
        const parsedMessages = JSON.parse(savedHistory) as ChatMessage[];
        setMessages(parsedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };
  
  // Save chat history to AsyncStorage
  const saveChatHistory = async (updatedMessages: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(dialogHistoryKey, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // Save messages to AsyncStorage
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  // Handle user message send
  const handleSendMessage = async () => {
    if (input.trim() === '') return;
    
    const trimmedInput = input.trim();
    setInput('');
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: trimmedInput,
      sender: 'user' as const,
      timestamp: Date.now()
    };
    
    // Create a new messages array with the user message
    const updatedMessages = [...messages, userMessage as ChatMessage];
    setMessages(updatedMessages);
    
    // Show loading state
    setIsProcessing(true);
    
    try {
      // Format messages for the LLM
      const formattedMessages = formatMessagesForLLM(updatedMessages);
      
      // Verify character data was included in the system prompt
      const systemPrompt = formattedMessages[0].parts[0].text;
      const hasCharacterJson = systemPrompt.includes('```') && 
                              (systemPrompt.includes('roleCard') || 
                               systemPrompt.includes('worldBook'));
      
      console.log('[CharacterEditDialog] System prompt contains character JSON data:', hasCharacterJson);
      
      if (!hasCharacterJson) {
        // Add a warning message if no JSON data was included
        setMessages(prev => [
          ...prev,
          {
            id: `warning-${Date.now()}`,
            text: '⚠️ 警告: 无法加载完整的角色数据。编辑功能可能受限。请尝试关闭并重新打开编辑对话框，或联系技术支持。',
            sender: 'bot',
            timestamp: Date.now()
          }
        ]);
      }
      
      // Send to LLM
      const response = await NodeSTManager.generateText(
        formattedMessages,
        apiKey,
        apiSettings
      );
      
      // Add bot response to chat
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        text: response,
        sender: 'bot',
        timestamp: Date.now()
      };
      
      const finalMessages: ChatMessage[] = [...updatedMessages, botMessage];
      setMessages(finalMessages);
      
      // Check if the response contains update instructions
      checkForUpdateInstructions(response);
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message to chat
      setMessages([
        ...updatedMessages,
        {
          id: `error-${Date.now()}`,
          text: `错误: ${error instanceof Error ? error.message : '处理请求时出错，请稍后再试。'}`,
          sender: 'bot',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Format messages for LLM - convert our chat messages to the LLM API format
  const formatMessagesForLLM = (chatMessages: ChatMessage[]) => {
    // First, create a system prompt that includes the character data
    console.log('[CharacterEditDialog] Formatting messages for LLM, character:', character.name);
    
    const systemPrompt = getSystemPrompt();
    console.log('[CharacterEditDialog] System prompt created, length:', systemPrompt.length);
    
    // Convert our messages to LLM format
    const formattedMessages = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: '我理解了。我会检查角色设定并帮助你修改。请告诉我你想要如何更改角色设定。' }]
      },
      // Then include all user messages and bot responses
      ...chatMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }))
    ];
    
    console.log('[CharacterEditDialog] Formatted', formattedMessages.length, 'messages for LLM');
    return formattedMessages;
  };
  
  // Build system prompt that includes character data
  const getSystemPrompt = () => {
    let characterJsonData: any = null;
    let jsonDataLog = '未找到JSON数据';
    
    try {
      if (character.jsonData) {
        console.log('[CharacterEditDialog] Parsing JSON data, length:', character.jsonData.length);
        characterJsonData = JSON.parse(character.jsonData);
        jsonDataLog = `成功解析, 包含字段: ${Object.keys(characterJsonData).join(', ')}`;
        console.log('[CharacterEditDialog] Successfully parsed character JSON data');
      } else {
        console.warn('[CharacterEditDialog] Character does not have jsonData property');
      }
    } catch (error) {
      console.error('[CharacterEditDialog] Failed to parse character JSON data:', error);
      jsonDataLog = `解析失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
    
    // Add debug info at the end of prompt for development
    const debugInfo = `
DEBUG INFO (仅开发使用):
- 角色ID: ${character.id}
- JSON数据: ${jsonDataLog}
- 创建时间: ${new Date(character.createdAt).toLocaleString()}
- 更新时间: ${new Date(character.updatedAt).toLocaleString()}
`;
    
    return `你是一位专业的角色设计师助手，负责帮助用户修改和改进角色设定。你现在需要检查一个名为"${character.name}"的角色，并根据用户的要求帮助修改角色设定。

当前角色数据：
角色名称: ${character.name}
描述: ${character.description}
性格: ${character.personality || '未指定'}
性别: ${character.gender || '未指定'}
兴趣爱好: ${character.interests?.join(', ') || '未指定'}

${characterJsonData ? `角色的详细设定JSON数据如下:
\`\`\`
${JSON.stringify(characterJsonData, null, 2)}
\`\`\`
` : '角色没有详细的JSON数据或数据无法解析。请根据其他可用信息来帮助用户。'}

你的任务是：
1. 仔细分析角色的现有设定
2. 根据对话上下文，主动提出改进建议
3. 当用户请求特定修改时，帮助实现并提供具体建议
4. 当有合理的变更请求时，提供符合要求的更新代码

重要规则：
- 对角色设定的更改应保持基本结构不变
- 在用户没有明确指令时，主动提供有建设性的建议，比如丰富角色背景、完善设定细节等
- 当用户请求修改时，给出具体的实施方案和预期效果
- 使用<CHARACTER_JSON_UPDATE>标签包裹JSON更新代码
- 仅生成必要的内容字段，无需生成技术参数，系统会自动补充其他参数
- 使用口语化、友好的语气与用户交流
- 禁止生成有害、违规或不适当的内容${__DEV__ ? debugInfo : ''}

当需要提供更新时，请使用以下简化格式：
<CHARACTER_JSON_UPDATE>
{
  "roleCard": {
    "name": "角色名称",
    "first_mes": "初始消息",
    "description": "角色描述",
    "personality": "角色性格",
    "scenario": "场景设定",
    "mes_example": "对话示例"
  },
  "worldBook": {
    "entries": {
      "条目名称1": {
        "comment": "条目说明",
        "content": "条目内容"
      },
      "条目名称2": {
        "comment": "条目说明",
        "content": "条目内容"
      }
    }
  },
  "preset": {
    "prompts": [
      {
        "name": "提示名称",
        "content": "提示内容",
        "role": "user或model"
      }
    ]
  }
}
</CHARACTER_JSON_UPDATE>

注意：只需提供roleCard的完整信息和worldBook条目的comment和content属性，以及preset中prompts的name、content和role属性。系统会自动补充其他所需参数。`;
  };
  
  // Get initial system message for welcoming the user
  const getInitialSystemMessage = () => {
    return `👋 你好！我是角色设计助手。我已经加载了"${character.name}"的角色数据。

我可以帮你：
• 修改角色个性、背景故事或对话风格
• 调整角色设定中的具体细节
• 提出改进建议以丰富角色
• 实现你想要的任何合理变更

有什么我可以帮你修改的吗？或者需要我对当前角色设定进行分析并提供改进建议吗？`;
  };
  
  // Check if the response contains update instructions
  const checkForUpdateInstructions = (response: string): { success: boolean } => {
    // Look for special tags that indicate JSON update instructions
    const regex = /<CHARACTER_JSON_UPDATE>([\s\S]*?)<\/CHARACTER_JSON_UPDATE>/;
    const match = response.match(regex);
    console.log('[CharacterEditDialog] Checking for JSON updates:', !!match);
    
    if (match && match[1]) {
      try {
        // Parse the JSON update
        const jsonString = match[1].trim();
        console.log('[CharacterEditDialog] Found JSON update, length:', jsonString.length);
        let updatedData: any;
        
        try {
          updatedData = JSON.parse(jsonString);
          console.log('[CharacterEditDialog] Successfully parsed JSON update');
          
          // Debug log for checking worldBook data
          console.log('[CharacterEditDialog] Update contains worldBook:', !!updatedData.worldBook);
          if (updatedData.worldBook) {
            console.log('[CharacterEditDialog] worldBook entries count:', 
              Object.keys(updatedData.worldBook.entries || {}).length);
          }
        } catch (parseError) {
          console.error('[CharacterEditDialog] Failed to parse JSON update:', parseError);
          throw new Error(`无法解析JSON更新内容: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
        }
        
        // Ensure we have a valid JSON structure
        if (!updatedData || typeof updatedData !== 'object') {
          throw new Error('生成的JSON格式无效，缺少必要的角色数据');
        }
        
        // Get original JSON data if available
        let originalData: any = {};
        if (character.jsonData) {
          try {
            originalData = JSON.parse(character.jsonData);
            console.log('[CharacterEditDialog] Loaded original character JSON data');
            console.log('[CharacterEditDialog] Original worldBook entries count:', 
              Object.keys(originalData.worldBook?.entries || {}).length);
          } catch (err) {
            console.warn('[CharacterEditDialog] Could not parse original character JSON:', err);
            // Continue with empty originalData if parsing fails
          }
        }
        
        // Keep track of the top-level fields in both objects for debugging
        console.log('[CharacterEditDialog] Original data fields:', Object.keys(originalData));
        console.log('[CharacterEditDialog] Updated data fields:', Object.keys(updatedData));
        
        // Process and enhance worldBook entries with default parameters
        let enhancedWorldBook: any = { entries: {} };
        
        // First, keep all original entries that aren't being updated
        if (originalData.worldBook && originalData.worldBook.entries) {
          Object.keys(originalData.worldBook.entries).forEach(key => {
            if (updatedData.worldBook?.entries && !updatedData.worldBook.entries[key]) {
              enhancedWorldBook.entries[key] = originalData.worldBook.entries[key];
            }
          });
        }
        
        // Now add all updated entries with default parameters
        if (updatedData.worldBook && updatedData.worldBook.entries) {
          Object.keys(updatedData.worldBook.entries).forEach(key => {
            const entry = updatedData.worldBook.entries[key];
            
            // Enhance entry with default parameters if they're missing
            enhancedWorldBook.entries[key] = {
              comment: entry.comment || "Character Information",
              content: entry.content || "",
              disable: false,
              position: 4,
              constant: true,
              key: [],
              order: Object.keys(enhancedWorldBook.entries).length, // Use incrementing order
              depth: 4,
              vectorized: false
            };
          });
        }
        
        // Process and enhance preset prompts with default parameters
        let enhancedPreset: any = {
          prompts: [],
          prompt_order: originalData.preset?.prompt_order || []
        };
        
        // Keep original prompts that aren't being updated
        if (originalData.preset && originalData.preset.prompts) {
          enhancedPreset.prompts = [...originalData.preset.prompts];
        }
        
        // Add updated prompts with default parameters
        if (updatedData.preset && updatedData.preset.prompts) {
          const timestamp = Date.now();
          updatedData.preset.prompts.forEach((prompt: any, index: number) => {
            const newPrompt = {
              name: prompt.name || "Custom Prompt",
              content: prompt.content || "",
              identifier: `cradle-edition-${timestamp}-${index}`,
              isEditable: true,
              insertType: 'relative',
              role: (prompt.role as 'user' | 'model') || 'user',
              order: enhancedPreset.prompts.length + index,
              isDefault: false,
              enable: true,
              depth: 4
            };
            
            enhancedPreset.prompts.push(newPrompt);
          });
        }
        
        // Create a proper merged JSON structure
        const mergedData = {
          ...originalData,
          ...updatedData,
          roleCard: updatedData.roleCard || originalData.roleCard || {},
          worldBook: enhancedWorldBook,
          preset: enhancedPreset,
          authorNote: updatedData.authorNote || originalData.authorNote || {},
          chatHistory: updatedData.chatHistory || originalData.chatHistory || {}
        };
        
        // Ensure critical fields are present in roleCard
        if (mergedData.roleCard) {
          const roleCard = mergedData.roleCard;
          roleCard.name = roleCard.name || character.name;
          roleCard.description = roleCard.description || character.description;
          roleCard.personality = roleCard.personality || character.personality;
          roleCard.first_mes = roleCard.first_mes || "你好，很高兴认识你！";
        }
        
        // Convert the merged data back to JSON string
        const mergedJsonString = JSON.stringify(mergedData);
        console.log('[CharacterEditDialog] Created merged JSON data, length:', mergedJsonString.length);
        console.log('[CharacterEditDialog] Final worldBook entries count:', 
          Object.keys(mergedData.worldBook.entries || {}).length);
        
        // Create an updated character with the new data
        const newCharacter = {
          ...character,
          id: character.id, // Explicitly ensure same ID
          jsonData: mergedJsonString,
          name: mergedData.roleCard?.name || character.name,
          description: mergedData.roleCard?.description || character.description,
          personality: mergedData.roleCard?.personality || character.personality
        };
        
        // Set the updated character and show preview
        setUpdatedCharacter(newCharacter);
        setHasChanges(true); // Explicitly set hasChanges to true
        console.log('[CharacterEditDialog] Set hasChanges to true');
        
        // Alert the user that changes are ready to preview
        Alert.alert(
          '角色设定更新准备就绪',
          '已根据你的要求生成了角色设定更新。请点击"预览更改"按钮查看更新内容，并决定是否应用这些更改。',
          [
            { text: '确定', style: 'default' }
          ]
        );
        
        return { success: true };
      } catch (error) {
        console.error('[CharacterEditDialog] Failed to process character update:', error);
        // Add error message to chat
        setMessages(prevMessages => [
          ...prevMessages,
          {
            id: `error-${Date.now()}`,
            text: `错误: 处理角色更新失败: ${error instanceof Error ? error.message : '未知错误'}`,
            sender: 'bot',
            timestamp: Date.now()
          }
        ]);
        return { success: false };
      }
    }
    return { success: false };
  };
  
  // Apply the character updates using NodeSTManager with "更新人设" status
  const handleApplyChanges = async () => {
    // If we already have an updated character, apply it
    if (updatedCharacter) {
      try {
        console.log('[CharacterEditDialog] Applying character changes');
        console.log('[CharacterEditDialog] Updated character JSON data length:', updatedCharacter.jsonData?.length || 0);
        
        // Verify the JSON is valid before applying
        if (updatedCharacter.jsonData) {
          try {
            const parsedJson = JSON.parse(updatedCharacter.jsonData);
            if (!parsedJson.roleCard || !parsedJson.worldBook) {
              throw new Error('角色数据缺少必要的roleCard或worldBook结构');
            }
          } catch (parseError) {
            console.error('[CharacterEditDialog] Invalid JSON data:', parseError);
            Alert.alert(
              '更新失败',
              '角色数据格式无效，无法应用更改。请重试或联系支持。',
              [{ text: '确定', style: 'default' }]
            );
            return;
          }
        } else {
          throw new Error('角色数据为空，无法应用更改');
        }
        
        // UPDATED LOGIC: Handle different character types properly
        console.log('[CharacterEditDialog] Character relationships:', characterRelationships);
        setIsProcessing(true);
        
        // 1. Determine which characters need to be updated
        if (characterRelationships.isCradleCharacter && characterRelationships.hasGeneratedVersion) {
          // This is a cradle character that has a generated version
          // We need to update both the cradle character and the generated character
          console.log('[CharacterEditDialog] This is a cradle character with a generated version');
          
          // 1a. First, update the generated character if it exists
          if (characterRelationships.normalCharacter) {
            const generatedCharacter = characterRelationships.normalCharacter;
            console.log('[CharacterEditDialog] Updating generated character:', generatedCharacter.id);
            
            // Create updated version of the generated character with the new JSON data
            const updatedGeneratedCharacter = {
              ...generatedCharacter,
              jsonData: updatedCharacter.jsonData,
              name: updatedCharacter.name,
              description: updatedCharacter.description,
              personality: updatedCharacter.personality || generatedCharacter.personality,
              updatedAt: Date.now()
            };
            
            // Send to NodeSTManager with "更新人设" status
            console.log('[CharacterEditDialog] Sending normal character update to NodeSTManager');
            const response = await NodeSTManager.processChatMessage({
              userMessage: "",
              conversationId: updatedGeneratedCharacter.id,
              status: "更新人设",
              apiKey,
              apiSettings,
              character: updatedGeneratedCharacter
            });
            
            if (!response.success) {
              console.error('[CharacterEditDialog] NodeSTManager update failed for normal character:', response.error);
              throw new Error(`更新普通角色失败: ${response.error}`);
            }
            
            console.log('[CharacterEditDialog] Successfully updated normal character via NodeSTManager');
            
            // Update in storage
            await updateCharacter(updatedGeneratedCharacter);
            console.log('[CharacterEditDialog] Successfully updated normal character in storage');
          }
          
          // 1b. Then, update the cradle character too
          console.log('[CharacterEditDialog] Now updating cradle character:', character.id);
          
          // Create final cradle character with updated data but preserve cradle-specific fields
          const finalCradleCharacter: CradleCharacter = {
            ...(character as CradleCharacter),
            jsonData: updatedCharacter.jsonData,
            name: updatedCharacter.name,
            description: updatedCharacter.description,
            personality: updatedCharacter.personality || character.personality,
            updatedAt: Date.now(),
            cradleUpdatedAt: Date.now(),
            inCradleSystem: true, // Ensure it stays in cradle system
            isCradleGenerated: true
          };
          
          // Use onUpdateCharacter which was passed from cradle.tsx
          if (onUpdateCharacter) {
            await onUpdateCharacter(finalCradleCharacter);
            console.log('[CharacterEditDialog] Successfully updated cradle character via onUpdateCharacter');
          } else {
            console.warn('[CharacterEditDialog] onUpdateCharacter not provided, cannot update cradle character');
          }
        } else if (characterRelationships.isCradleCharacter) {
          // This is a regular cradle character without a generated version
          console.log('[CharacterEditDialog] This is a regular cradle character without a generated version');
          
          // Create final cradle character with updated data
          const finalCradleCharacter: CradleCharacter = {
            ...(character as CradleCharacter),
            jsonData: updatedCharacter.jsonData,
            name: updatedCharacter.name,
            description: updatedCharacter.description,
            personality: updatedCharacter.personality || character.personality,
            updatedAt: Date.now(),
            cradleUpdatedAt: Date.now(),
            inCradleSystem: true // Ensure it stays in cradle system
          };
          
          // Send update to NodeSTManager
          console.log('[CharacterEditDialog] Sending cradle character update to NodeSTManager');
          const response = await NodeSTManager.processChatMessage({
            userMessage: "",
            conversationId: finalCradleCharacter.id,
            status: "更新人设",
            apiKey,
            apiSettings,
            character: finalCradleCharacter
          });
          
          if (!response.success) {
            console.error('[CharacterEditDialog] NodeSTManager update failed for cradle character:', response.error);
            throw new Error(`NodeSTManager处理失败: ${response.error}`);
          }
          
          // Use onUpdateCharacter from props
          if (onUpdateCharacter) {
            await onUpdateCharacter(finalCradleCharacter);
            console.log('[CharacterEditDialog] Successfully updated cradle character via onUpdateCharacter');
          } else {
            console.warn('[CharacterEditDialog] onUpdateCharacter not provided, falling back to updateCharacter');
            // Fall back to context's updateCharacter
            await updateCharacter(finalCradleCharacter as Character);
          }
        } else {
          // This is a regular character, not a cradle character
          console.log('[CharacterEditDialog] This is a regular character, not a cradle character');
          
          // Create the final character for update
          const finalCharacter = {
            ...character,
            jsonData: updatedCharacter.jsonData,
            name: updatedCharacter.name,
            description: updatedCharacter.description,
            personality: updatedCharacter.personality || character.personality,
            updatedAt: Date.now()
          };
          
          // Send to NodeSTManager
          console.log('[CharacterEditDialog] Sending regular character update to NodeSTManager');
          const response = await NodeSTManager.processChatMessage({
            userMessage: "",
            conversationId: finalCharacter.id,
            status: "更新人设",
            apiKey,
            apiSettings,
            character: finalCharacter
          });
          
          if (!response.success) {
            console.error('[CharacterEditDialog] NodeSTManager update failed for regular character:', response.error);
            throw new Error(`NodeSTManager处理失败: ${response.error}`);
          }
          
          // Update in storage
          await updateCharacter(finalCharacter);
          console.log('[CharacterEditDialog] Successfully updated regular character in storage');
        }
        
        // Reset states after successful update
        setShowPreview(false);
        setHasChanges(false);
        
        // Add a success message to the chat
        setMessages(prev => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            text: '✅ 已成功应用角色更改！你可以继续修改角色或关闭此对话框。',
            sender: 'bot',
            timestamp: Date.now()
          }
        ]);
        
        Alert.alert(
          '更新成功',
          `角色 "${updatedCharacter.name}" 已成功更新！`,
          [{ text: '确定', style: 'default' }]
        );
      } catch (error) {
        console.error('[CharacterEditDialog] Error applying changes:', error);
        Alert.alert(
          '更新失败',
          `应用角色更改时出错: ${error instanceof Error ? error.message : '未知错误'}`,
          [{ text: '确定', style: 'default' }]
        );
      } finally {
        setIsProcessing(false);
      }
    } 
    // If no updated character exists yet, but we have chat messages, try to generate one first
    else if (messages.length > 2) {
      Alert.alert(
        '需要生成更改',
        '需要先根据对话生成角色更改，然后才能应用。是否现在生成更改？',
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '生成更改', 
            style: 'default',
            onPress: requestCharacterUpdate
          }
        ]
      );
    } 
    // If we don't have enough chat history yet
    else {
      Alert.alert(
        '无法更新角色',
        '请先与AI助手进行一些对话，讨论您希望对角色进行的修改。',
        [{ text: '我明白了', style: 'default' }]
      );
      console.log('[CharacterEditDialog] No updated character to apply, and not enough chat history');
    }
  };
  
  // Toggle preview mode
  const togglePreview = () => {
    // If we have character updates, toggle preview
    if (updatedCharacter) {
      setShowPreview(!showPreview);
    }
    // If no updates but we have chat history, offer to generate updates
    else if (messages.length > 2) {
      Alert.alert(
        '需要生成更改',
        '需要先根据对话生成角色更改，然后才能预览。是否现在生成更改？',
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '生成更改', 
            style: 'default',
            onPress: async () => {
              await requestCharacterUpdate();
              // When updates are successfully generated, show preview
              if (updatedCharacter) {
                setShowPreview(true);
              }
            }
          }
        ]
      );
    }
    // Not enough chat history
    else {
      Alert.alert(
        '无法预览更改',
        '请先与AI助手进行一些对话，讨论您希望对角色进行的修改。',
        [{ text: '我明白了', style: 'default' }]
      );
    }
  };
  
  // Reset chat history
  const resetChatHistory = async () => {
    Alert.alert(
      '清除聊天记录',
      '确定要清除所有聊天记录吗？这将不会影响已保存的角色设定。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          style: 'destructive',
          onPress: async () => {
            setMessages([]);
            await AsyncStorage.removeItem(dialogHistoryKey);
            
            // Send initial system message
            const initialMessage = getInitialSystemMessage();
            setMessages([
              {
                id: 'system-1',
                text: initialMessage,
                sender: 'bot',
                timestamp: Date.now()
              }
            ]);
          }
        }
      ]
    );
  };

  // Function to request character updates from LLM
  const requestCharacterUpdate = async () => {
    if (isGeneratingUpdate || messages.length < 2) {
      Alert.alert(
        '无法生成更新',
        '请先与AI助手进行对话，讨论您希望对角色进行的修改。',
        [{ text: '我知道了', style: 'default' }]
      );
      return;
    }
    
    setIsGeneratingUpdate(true);
    setIsProcessing(true);
    
    try {
      // Add a system message to request summary
      const summarizeMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        text: "请根据我们的对话，总结所有应该对角色进行的修改，并生成更新后的角色数据。请只提供roleCard的完整信息，worldBook条目的comment和content属性，以及preset中prompts的name、content和role属性。系统会自动补充其他所需参数。请使用<CHARACTER_JSON_UPDATE>标签包裹JSON代码。",
        sender: 'user',
        timestamp: Date.now()
      };
      
      // Add the message to chat
      const updatedMessages = [...messages, summarizeMessage];
      setMessages(updatedMessages);
      
      // Format messages for LLM
      const formattedMessages = formatMessagesForLLM(updatedMessages);
      
      // Send to LLM
      console.log('[CharacterEditDialog] 请求生成角色更新');
      const response = await NodeSTManager.generateText(
        formattedMessages,
        apiKey,
        apiSettings
      );
      
      // Add bot response to chat
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        text: response,
        sender: 'bot',
        timestamp: Date.now()
      };
      
      setMessages([...updatedMessages, botMessage]);
      
      // Check if the response contains update instructions
      const updateResult = checkForUpdateInstructions(response);
      
      if (!updateResult.success) {
        // If no proper JSON was detected, try to create a basic update
        console.log('[CharacterEditDialog] 未检测到有效的JSON更新，尝试生成基础更新');
        await createBasicCharacterUpdate();
      }
    } catch (error) {
      console.error('[CharacterEditDialog] 生成角色更新失败:', error);
      
      // Add error message to chat
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: `error-${Date.now()}`,
          text: `错误: 生成角色更新失败: ${error instanceof Error ? error.message : '未知错误'}`,
          sender: 'bot',
          timestamp: Date.now()
        }
      ]);
      
      Alert.alert(
        '生成更新失败',
        '无法生成角色更新，请重试或手动编辑。',
        [{ text: '确定', style: 'default' }]
      );
    } finally {
      setIsGeneratingUpdate(false);
      setIsProcessing(false);
    }
  };
  
  // Create a basic character update from chat history if JSON update fails
  const createBasicCharacterUpdate = async () => {
    try {
      console.log('[CharacterEditDialog] 创建基础角色更新');
      
      // Get original character data
      let originalData: any = {};
      try {
        if (character.jsonData) {
          originalData = JSON.parse(character.jsonData);
        }
      } catch (err) {
        console.warn('[CharacterEditDialog] Cannot parse original character JSON:', err);
      }
      
      // If we have no original data, we can't update
      if (!originalData.roleCard || !originalData.worldBook) {
        throw new Error('无法读取原始角色数据，无法进行更新');
      }
      
      // Send a request to LLM to extract key changes from the conversation
      const extractionPrompt = `
请分析我们的对话，提取关键的角色修改信息，格式如下:

\`\`\`json
{
  "roleCard": {
    "name": "角色名称（如有变化）",
    "description": "角色描述（如有变化）",
    "personality": "角色性格（如有变化）",
    "scenario": "角色场景（如有变化）",
    "first_mes": "初始消息（如有变化）",
    "background": "背景故事（如有变化）"
  }
}
\`\`\`
      `;
      
      // Create extraction message
      const extractionMessage = {
        role: 'user',
        parts: [{ text: extractionPrompt }]
      };
      
      // Create a simplified message history for extraction
      const simpleHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      
      // Send to LLM
      const extractionResponse = await NodeSTManager.generateText(
        [...simpleHistory, extractionMessage],
        apiKey,
        apiSettings
      );
      
      // Extract JSON from response
      const jsonMatch = extractionResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('无法提取角色修改信息');
      }
      
      const extractedData = JSON.parse(jsonMatch[1]);
      
      // Merge extracted data with original data - FIX: Be careful with worldBook
      const mergedData = {
        ...originalData,
        roleCard: {
          ...originalData.roleCard,
          ...extractedData.roleCard
        },
        // Explicitly keep the original worldBook
        worldBook: originalData.worldBook
      };
      
      // Convert the merged data back to JSON string
      const mergedJsonString = JSON.stringify(mergedData);
      console.log('[CharacterEditDialog] Created merged JSON data, length:', mergedJsonString.length);
      console.log('[CharacterEditDialog] Basic update worldBook entries count:', 
        Object.keys(mergedData.worldBook?.entries || {}).length);
      
      // Create an updated character with the new data
      const newCharacter = {
        ...character,
        jsonData: mergedJsonString,
        name: mergedData.roleCard?.name || character.name,
        description: mergedData.roleCard?.description || character.description,
        personality: mergedData.roleCard?.personality || character.personality
      };
      
      // Set the updated character and show preview
      setUpdatedCharacter(newCharacter);
      setHasChanges(true); // Explicitly set hasChanges to true
      console.log('[CharacterEditDialog] Set hasChanges to true');
      
      // Alert the user that changes are ready to preview
      Alert.alert(
        '角色设定更新准备就绪',
        '已根据你的要求生成了角色设定更新。请点击"预览更改"按钮查看更新内容，并决定是否应用这些更改。',
        [
          { text: '确定', style: 'default' }
        ]
      );
    } catch (error) {
      console.error('[CharacterEditDialog] 创建基础角色更新失败:', error);
      // Add error message to chat
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: `error-${Date.now()}`,
          text: `错误: 创建基础角色更新失败: ${error instanceof Error ? error.message : '未知错误'}`,
          sender: 'bot',
          timestamp: Date.now()
        }
      ]);
    }
  };

  // Render chat bubbles
  const renderChatBubbles = () => {
    return messages.map((message) => {
      const isUser = message.sender === 'user';
      
      return (
        <View
          key={message.id}
          style={[
            styles.messageBubbleContainer,
            isUser ? styles.userMessageContainer : styles.botMessageContainer
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userMessageBubble : styles.botMessageBubble
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        </View>
      );
    });
  };
  
  // Render preview of updated character - Enhanced to show more character details
  const renderPreview = () => {
    if (!updatedCharacter) return null;
    
    let jsonData: any = null;
    try {
      jsonData = JSON.parse(updatedCharacter.jsonData || '{}');
    } catch (error) {
      console.error('Failed to parse updated character data:', error);
    }
    
    return (
      <View style={styles.previewContainer}>
        <ScrollView style={styles.previewScroll}>
          <Text style={styles.previewTitle}>预览角色更改</Text>
          
          {/* Role Card Basic Information Section */}
          <View style={styles.previewSectionContainer}>
            <Text style={styles.previewSectionTitle}>基本信息</Text>
            
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>名称:</Text>
              <Text style={styles.previewValue}>{updatedCharacter.name}</Text>
            </View>
            
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>描述:</Text>
              <Text style={styles.previewValue}>{updatedCharacter.description}</Text>
            </View>
            
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>性格:</Text>
              <Text style={styles.previewValue}>{updatedCharacter.personality || "未设置"}</Text>
            </View>
            
            {jsonData?.roleCard?.scenario && (
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>场景:</Text>
                <Text style={styles.previewValue}>{jsonData.roleCard.scenario}</Text>
              </View>
            )}
          </View>
          
          {/* Initial Message Section */}
          {jsonData?.roleCard?.first_mes && (
            <View style={styles.previewSectionContainer}>
              <Text style={styles.previewSectionTitle}>初始消息</Text>
              <View style={styles.previewSection}>
                <Text style={styles.previewValue}>{jsonData.roleCard.first_mes}</Text>
              </View>
            </View>
          )}
          
          {/* Message Examples Section */}
          {jsonData?.roleCard?.mes_example && (
            <View style={styles.previewSectionContainer}>
              <Text style={styles.previewSectionTitle}>对话示例</Text>
              <View style={styles.previewSection}>
                <Text style={styles.previewValue}>{jsonData.roleCard.mes_example}</Text>
              </View>
            </View>
          )}
          
          {/* World Book Section */}
          {jsonData?.worldBook?.entries && Object.keys(jsonData.worldBook.entries).length > 0 && (
            <View style={styles.previewSectionContainer}>
              <Text style={styles.previewSectionTitle}>世界书条目</Text>
              
              {Object.entries(jsonData.worldBook.entries).map(([key, entry]: [string, any]) => (
                <View key={key} style={styles.previewSection}>
                  <View style={styles.worldBookEntryHeader}>
                    <Text style={styles.worldBookEntryTitle}>{key}</Text>
                    <Text style={styles.worldBookEntryType}>{entry.comment}</Text>
                  </View>
                  <Text style={styles.previewValue}>{entry.content}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Prompts Section */}
          {jsonData?.preset?.prompts && jsonData.preset.prompts.length > 0 && (
            <View style={styles.previewSectionContainer}>
              <Text style={styles.previewSectionTitle}>自定义提示</Text>
              
              {jsonData.preset.prompts.map((prompt: any, index: number) => (
                <View key={index} style={styles.previewSection}>
                  <View style={styles.promptHeader}>
                    <Text style={styles.promptTitle}>{prompt.name}</Text>
                    <Text style={[
                      styles.promptRole, 
                      prompt.role === 'user' ? styles.userRole : styles.modelRole
                    ]}>
                      {prompt.role === 'user' ? '用户' : '模型'}
                    </Text>
                  </View>
                  <Text style={styles.previewValue}>{prompt.content}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Action Buttons */}
          <View style={styles.previewButtonContainer}>
            <TouchableOpacity
              style={styles.cancelPreviewButton}
              onPress={togglePreview}
            >
              <Text style={styles.cancelPreviewButtonText}>关闭预览</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.applyChangesButton}
              onPress={handleApplyChanges}
            >
              <Text style={styles.applyChangesButtonText}>应用更改</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>编辑角色：{character.name}</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={resetChatHistory}
              >
                <Ionicons name="refresh" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Action buttons bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                hasChanges ? styles.actionButtonActive : styles.actionButtonDisabled
              ]}
              onPress={togglePreview}
              disabled={!hasChanges && !updatedCharacter}
            >
              <Ionicons 
                name="eye-outline" 
                size={18} 
                color={hasChanges ? "#fff" : "#888"} 
                style={styles.actionButtonIcon} 
              />
              <Text style={[
                styles.actionButtonText, 
                hasChanges ? styles.actionButtonTextActive : styles.actionButtonTextDisabled
              ]}>
                预览更改{hasChanges ? ' ✓' : ''}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton,
                hasChanges ? styles.actionButtonActive : styles.actionButtonDisabled
              ]}
              onPress={handleApplyChanges}
              disabled={!hasChanges && !updatedCharacter}
            >
              <Ionicons 
                name="checkmark-circle-outline" 
                size={18} 
                color={hasChanges ? "#fff" : "#888"} 
                style={styles.actionButtonIcon} 
              />
              <Text style={[
                styles.actionButtonText, 
                hasChanges ? styles.actionButtonTextActive : styles.actionButtonTextDisabled
              ]}>
                应用更改{hasChanges ? ' ✓' : ''}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton,
                messages.length > 2 ? styles.actionButtonActive : styles.actionButtonDisabled
              ]}
              onPress={requestCharacterUpdate}
              disabled={messages.length <= 2 || isGeneratingUpdate}
            >
              <Ionicons 
                name="refresh-outline" 
                size={18} 
                color={messages.length > 2 ? "#fff" : "#888"} 
                style={styles.actionButtonIcon} 
              />
              <Text style={[
                styles.actionButtonText, 
                messages.length > 2 ? styles.actionButtonTextActive : styles.actionButtonTextDisabled
              ]}>
                {isGeneratingUpdate ? '生成中...' : '生成更改'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Preview (conditionally rendered) */}
          {showPreview ? renderPreview() : (
            <>
              {/* Chat area */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.chatArea}
                contentContainerStyle={styles.chatContainer}
              >
                {renderChatBubbles()}
                {isProcessing && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#4CAF50" />
                    <Text style={styles.loadingText}>处理中...</Text>
                  </View>
                )}
              </ScrollView>

              {/* Input area */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="输入要修改的内容..."
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={3}
                  maxLength={1000}
                  editable={!isProcessing}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!input.trim() || isProcessing) && styles.sendButtonDisabled]}
                  disabled={!input.trim() || isProcessing}
                  onPress={handleSendMessage}
                >
                  <Ionicons 
                    name="send" 
                    size={24} 
                    color={input.trim() && !isProcessing ? "#4CAF50" : "#666"} 
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    margin: 0,
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#333',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#282828',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  actionButtonActive: {
    backgroundColor: '#4A90E2',
  },
  actionButtonDisabled: {
    backgroundColor: '#444',
  },
  actionButtonIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#fff',
  },
  actionButtonTextDisabled: {
    color: '#888',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  chatContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubbleContainer: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    maxWidth: '80%',
  },
  userMessageBubble: {
    backgroundColor: '#4A90E2',
  },
  botMessageBubble: {
    backgroundColor: '#444',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#2A2A2A',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    marginLeft: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  loadingText: {
    color: '#ccc',
    marginLeft: 8,
  },
  previewContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1E1E1E',
  },
  previewScroll: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  previewSectionContainer: {
    marginBottom: 24,
    borderRadius: 8,
    backgroundColor: '#262626',
    padding: 12,
  },
  previewSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 8,
  },
  previewSection: {
    marginBottom: 16,
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 16,
    color: '#fff',
  },
  worldBookEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  worldBookEntryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  worldBookEntryType: {
    fontSize: 12,
    color: '#aaa',
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  promptRole: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userRole: {
    backgroundColor: '#2C5282',
    color: '#fff',
  },
  modelRole: {
    backgroundColor: '#276749',
    color: '#fff',
  },
  previewButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 32,
  },
  cancelPreviewButton: {
    backgroundColor: '#555',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelPreviewButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  applyChangesButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  applyChangesButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
