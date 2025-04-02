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
  Image,
  Modal,
  Text,
} from 'react-native';
import { MaterialIcons, Ionicons, } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { useUser } from '@/constants/UserContext';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { theme } from '@/constants/theme';
import { BlurView } from 'expo-blur';
import { useRegex } from '@/constants/RegexContext';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { GeminiAdapter } from '@/NodeST/nodest/utils/gemini-adapter';
import Mem0Service from '@/src/memory/services/Mem0Service';
import ImageManager from '@/utils/ImageManager';

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
  const { applyRegexTools } = useRegex();
  
  // Add state for image handling
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);
  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);
  const [selectedImageType, setSelectedImageType] = useState<string | null>(null);
  
  // Add state for image generation
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Add state for image editing
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageType, setReferenceImageType] = useState<string | null>(null);
  const [showImageEditGenModal, setShowImageEditGenModal] = useState(false);
  
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
      // 应用正则工具处理用户消息
      const processedMessage = applyRegexTools(messageToSend, 'user');
      
      // Skip memory-related processing if message is image-related
      const isImageRelated = processedMessage.includes('![') && processedMessage.includes(')');
      
      // 在发送用户消息前，先尝试搜索相关记忆（不影响主流程）
      if (selectedCharacter?.id && !isImageRelated) {
        try {
          console.log('[ChatInput] 尝试检索与用户消息相关的记忆');
          const mem0Service = Mem0Service.getInstance();
          const memoryResults = await mem0Service.searchMemories(
            processedMessage,
            selectedCharacter.id,
            selectedConversationId,
            5 // 检索最相关的5条记忆
          );
          
          // 记录检索到的记忆
          const resultCount = memoryResults?.results?.length || 0;
          if (resultCount > 0) {
            console.log(`[ChatInput] 为用户消息找到 ${resultCount} 条相关记忆:`);
            
            interface MemoryResult {
              memory: string;
              score: number;
              metadata?: {
                aiResponse?: string;
              };
            }

            interface MemorySearchResults {
              results: MemoryResult[];
            }

                        (memoryResults as MemorySearchResults).results.forEach((item: MemoryResult, index: number) => {
                          console.log(`[ChatInput] 记忆 #${index + 1}:`);
                          console.log(`  内容: ${item.memory}`);
                          console.log(`  相似度: ${item.score}`);
                          if (item.metadata?.aiResponse) {
                            console.log(`  AI响应: ${item.metadata.aiResponse.substring(0, 100)}${item.metadata.aiResponse.length > 100 ? '...' : ''}`);
                          }
                        });
          } else {
            console.log('[ChatInput] 未找到相关记忆');
          }
        } catch (searchError) {
          console.warn('[ChatInput] 搜索相关记忆失败:', searchError);
          // 不阻断主流程
        }
      }
      
      // Send user message
      onSendMessage(processedMessage, 'user');
      
      // 添加到 Mem0 记忆系统，但仅当不是图片相关消息时
      let userMemoryAdded = false;
      if (selectedCharacter?.id && !isImageRelated) {
        try {
          const mem0Service = Mem0Service.getInstance();
          await mem0Service.addChatMemory(
            processedMessage,
            'user',
            selectedCharacter.id,
            selectedConversationId
          );
          userMemoryAdded = true;
          console.log('[ChatInput] 用户消息已成功添加到记忆系统的消息缓存');
        } catch (memoryError) {
          console.error('[ChatInput] 添加用户消息到记忆系统失败:', memoryError);
          // 继续处理消息，不阻断主流程
        }
      }
      
      // Create temp loading message for bot
      onSendMessage('', 'bot', true);
      
      // 使用 NodeST 处理消息
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
      
      // 处理 AI 响应
      if (result.success) {
        // 应用正则工具处理响应
        const processedResponse = applyRegexTools(result.text || '抱歉，未收到有效回复。', 'ai');
        onSendMessage(processedResponse, 'bot');
        
        // 只有在成功添加了用户记忆的情况下，才尝试更新AI响应，且不处理图片相关消息
        if (userMemoryAdded && selectedCharacter?.id && !isImageRelated) {
          try {
            const mem0Service = Mem0Service.getInstance();
            
            // 确保响应不为空
            if (processedResponse && processedResponse.trim() !== '') {
              // 通过传递bot角色触发添加到缓存，最终会触发updateAIResponseForMemories
              await mem0Service.addChatMemory(
                processedResponse,
                'bot',
                selectedCharacter.id,
                selectedConversationId
              );
              console.log('[ChatInput] 成功将AI回复添加到记忆系统缓存');
            } else {
              console.warn('[ChatInput] AI回复为空，跳过添加到记忆系统');
            }
          } catch (memoryError) {
            console.error('[ChatInput] 添加AI回复到记忆系统失败:', memoryError);
          }
        } else if (!userMemoryAdded) {
          console.log('[ChatInput] 由于用户消息未成功添加到记忆，跳过添加AI回复');
        }
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

  // Handle image sending
  const handleSendImage = async () => {
    if (!selectedConversationId || !selectedImage) {
      return;
    }

    try {
      setIsLoading(true);
      setShowImagePreviewModal(false);
      
      // Don't send base64 data directly to conversation
      // Instead, use a placeholder text
      onSendMessage("发送了一张图片", "user");
      
      // Create temp loading message for bot
      onSendMessage('', 'bot', true);
      
      // Get API key for Gemini
      const apiKey = user?.settings?.chat.characterApiKey || '';
      if (!apiKey) {
        throw new Error("API密钥未设置");
      }
      
      // Create a Gemini adapter instance
      const geminiAdapter = new GeminiAdapter(apiKey);
      
      let response: string;
      let imageCacheId: string;
      
      // Prepare the image based on its type
      if (selectedImageType === 'url') {
        // For URL images
        response = await geminiAdapter.analyzeImage(
          { url: selectedImage },
          `这是用户发送的一张图片。请分析这张图片并作出回应。注意保持${selectedCharacter.name}的人设口吻。`
        );
        
        // For URL images, we need to download and cache them
        try {
          const imageData = await geminiAdapter.fetchImageAsBase64(selectedImage);
          const cacheResult = await ImageManager.cacheImage(imageData.data, imageData.mimeType);
          imageCacheId = cacheResult.id;
        } catch (error) {
          console.error('[ChatInput] Error caching URL image:', error);
          // If caching fails, use URL directly
          imageCacheId = selectedImage;
        }
      } else {
        // For local/base64 images - process and cache them
        // Extract the actual base64 data without the prefix
        let base64Data = selectedImage;
        let mimeType = selectedImageType || 'image/jpeg';
        
        if (selectedImage.includes('base64,')) {
          base64Data = selectedImage.split('base64,')[1];
          mimeType = selectedImage.split(';')[0].replace('data:', '');
        }
        
        // Cache the image to file system and get the cache ID
        const cacheResult = await ImageManager.cacheImage(base64Data, mimeType);
        imageCacheId = cacheResult.id;
        
        // Send to Gemini for analysis
        response = await geminiAdapter.analyzeImage(
          { 
            data: base64Data,
            mimeType: mimeType
          },
          `这是用户发送的一张图片。请分析这张图片并作出回应。注意保持${selectedCharacter.name}的人设口吻。`
        );
      }
      
      // Update user message to show the image using local URI or URL
      // Make sure we're sending just the ID now, not the full path
      onSendMessage(`![用户图片](image:${imageCacheId})`, "user");
      
      // Send the AI's response
      if (response) {
        const processedResponse = applyRegexTools(response, 'ai');
        onSendMessage(processedResponse, 'bot');
      } else {
        onSendMessage('抱歉，无法解析这张图片。', 'bot');
      }
      
      // Reset image state
      setSelectedImage(null);
      setSelectedImageType(null);
      
    } catch (error) {
      console.error('Error sending image:', error);
      onSendMessage('抱歉，处理图片时出现了错误，请重试。', 'bot');
    } finally {
      setIsLoading(false);
      setShowActions(false);
    }
  };

  const handleImageGeneration = async () => {
    if (!imagePrompt.trim() || !selectedConversationId) {
      Alert.alert('错误', '请输入有效的图片描述');
      return;
    }

    try {
      setIsGeneratingImage(true);
      
      // Get API key for Gemini
      const apiKey = user?.settings?.chat.characterApiKey || '';
      if (!apiKey) {
        throw new Error("API密钥未设置");
      }
      
      // Create a Gemini adapter instance
      const geminiAdapter = new GeminiAdapter(apiKey);
      
      // First send a message showing what we're generating
      onSendMessage(`请为我生成图片: "${imagePrompt}"`, "user");
      
      // Create temp loading message for bot
      onSendMessage('', 'bot', true);
      
      // Generate the image
      const images = await geminiAdapter.generateImage(imagePrompt, {
        temperature: 0.8
      });
      
      if (images && images.length > 0) {
        try {
          // Store the generated image (use only first 100 characters for logging)
          const previewLogData = images[0].substring(0, 100) + '...';
          console.log(`[ChatInput] Image generated, data length: ${images[0].length}, preview: ${previewLogData}`);
          
          // Cache the image to file system (both original and WebP versions)
          const cacheResult = await ImageManager.cacheImage(
            images[0], // base64 data without prefix
            'image/png' // Gemini generates images that can be treated as PNG
          );
          
          // Create markdown format for display using image ID for lookup
          // Make sure we're using just the ID, not the full URI or path
          const imageMessage = `![Gemini生成的图像](image:${cacheResult.id})`;
          
          // Send the AI's response with the image
          onSendMessage(imageMessage, 'bot');
          
          // Alert user they can save the image
          setTimeout(() => {
            Alert.alert(
              '图片已生成',
              '是否保存图片到相册？',
              [
                { text: '取消', style: 'cancel' },
                { 
                  text: '保存', 
                  onPress: async () => {
                    const result = await ImageManager.saveToGallery(cacheResult.id);
                    Alert.alert(result.success ? '成功' : '错误', result.message);
                  }
                },
                {
                  text: '分享',
                  onPress: async () => {
                    const shared = await ImageManager.shareImage(cacheResult.id);
                    if (!shared) {
                      Alert.alert('错误', '分享功能不可用');
                    }
                  }
                }
              ]
            );
          }, 500);
        } catch (cacheError) {
          console.error('[ChatInput] Error caching generated image:', cacheError);
          onSendMessage('图像已生成，但保存过程中出现错误。', 'bot');
        }
      } else {
        // If no image was generated, show an error message
        onSendMessage('抱歉，我现在无法生成这个图片。可能是描述需要更具体，或者该内容不适合生成。', 'bot');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      onSendMessage('抱歉，生成图片时出现了错误，请重试。', 'bot');
    } finally {
      setIsGeneratingImage(false);
      setShowImageGenModal(false);
      setImagePrompt('');
    }
  };

  // Handle image editing with proper implementation
  const handleImageEditOperation = async () => {
    if (!imagePrompt.trim() || !selectedConversationId || !referenceImage) {
      Alert.alert('错误', '请输入有效的编辑指令和提供参考图片');
      return;
    }

    try {
      setIsGeneratingImage(true);
      
      // Get API key for Gemini
      const apiKey = user?.settings?.chat.characterApiKey || '';
      if (!apiKey) {
        throw new Error("API密钥未设置");
      }
      
      // Create a Gemini adapter instance
      const geminiAdapter = new GeminiAdapter(apiKey);
      
      // First send a message showing what we're editing
      onSendMessage(`请将这张图片${imagePrompt}`, "user");
      
      // Create temp loading message for bot
      onSendMessage('', "bot", true);
      
      // Prepare the reference image
      let imageInput;
      if (referenceImageType === 'url') {
        imageInput = { url: referenceImage };
      } else {
        // 处理base64数据，移除前缀
        const base64Data = referenceImage!.includes('base64,') 
          ? referenceImage!.split('base64,')[1] 
          : referenceImage;
        
        imageInput = {
          data: base64Data,
          mimeType: referenceImageType || 'image/jpeg'
        };
      }
      
      // 调用正确的editImage方法
      const editedImage = await geminiAdapter.editImage(imageInput, imagePrompt, {
        temperature: 0.8
      });
      
      if (editedImage) {
        try {
          // Cache the edited image to file system (both original and WebP versions)
          const cacheResult = await ImageManager.cacheImage(
            editedImage, // base64 data without prefix
            'image/png' // Edited images are treated as PNG
          );
          
          // Create markdown format for display using image ID
          // Make sure we're using just the ID, not the full URI or path
          const imageMessage = `![编辑后的图片](image:${cacheResult.id})`;
          
          // Send the AI's response with the edited image
          onSendMessage(imageMessage, 'bot');
          
          // Alert user they can save the image
          setTimeout(() => {
            Alert.alert(
              '图片已编辑完成',
              '是否保存编辑后的图片到相册？',
              [
                { text: '取消', style: 'cancel' },
                { 
                  text: '保存', 
                  onPress: async () => {
                    const result = await ImageManager.saveToGallery(cacheResult.id);
                    Alert.alert(result.success ? '成功' : '错误', result.message);
                  }
                },
                {
                  text: '分享',
                  onPress: async () => {
                    const shared = await ImageManager.shareImage(cacheResult.id);
                    if (!shared) {
                      Alert.alert('错误', '分享功能不可用');
                    }
                  }
                }
              ]
            );
          }, 500);
        } catch (cacheError) {
          console.error('[ChatInput] Error caching edited image:', cacheError);
          onSendMessage('图像已编辑，但保存过程中出现错误。', 'bot');
        }
      } else {
        // If no image was edited, show an error message
        onSendMessage('抱歉，我无法编辑这张图片。可能是因为编辑指令不够明确，或者模型暂不支持这种编辑操作。', 'bot');
      }
    } catch (error) {
      console.error('Error editing image:', error);
      onSendMessage('抱歉，编辑图片时出现了错误，请重试。', 'bot');
    } finally {
      setIsGeneratingImage(false);
      setShowImageEditGenModal(false);
      setImagePrompt('');
      setReferenceImage(null);
      setReferenceImageType(null);
    }
  };

  // Add cache management function
  const handleManageImageCache = async () => {
    try {
      // Get cache info
      const cacheInfo = await ImageManager.getCacheInfo();
      
      // Format size from bytes to MB
      const sizeMB = (cacheInfo.totalSize / (1024 * 1024)).toFixed(2);
      
      // Show alert with cache info and options
      Alert.alert(
        '图片缓存管理',
        `当前缓存了 ${cacheInfo.count} 张图片，占用 ${sizeMB} MB 存储空间。${
          cacheInfo.oldestImage ? `\n最早的图片缓存于 ${cacheInfo.oldestImage.toLocaleDateString()}` : ''
        }`,
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '清空缓存', 
            style: 'destructive',
            onPress: async () => {
              const result = await ImageManager.clearCache();
              Alert.alert(result.success ? '成功' : '错误', result.message);
            }
          }
        ]
      );
    } catch (error) {
      console.error('[ChatInput] Error managing cache:', error);
      Alert.alert('错误', '获取缓存信息失败');
    }
  };

  const toggleActionMenu = () => {
    Keyboard.dismiss();
    setShowActions(!showActions);
  };

  // Modified reset conversation handler that properly resets the chat history
  const handleResetConversation = () => {
    Alert.alert(
      '确定要重置对话吗？',
      '这将清除所有对话历史记录，但保留角色的开场白。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '重置', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              if (!selectedConversationId) {
                Alert.alert('错误', '请先选择一个角色');
                return;
              }
              
              // Ensure we have an API key
              const apiKey = user?.settings?.chat.characterApiKey || '';
              if (!apiKey) {
                Alert.alert('错误', '未设置API密钥，无法重置对话');
                setIsLoading(false);
                return;
              }
              
              console.log('[ChatInput] Resetting conversation:', selectedConversationId);
              
              // Update API settings before resetting
              NodeSTManager.updateApiSettings(apiKey, {
                apiProvider: user?.settings?.chat.apiProvider || 'gemini',
                openrouter: user?.settings?.chat.openrouter
              });
              
              // Call NodeSTManager to reset the chat history
              const success = await NodeSTManager.resetChatHistory(conversationId);
              
              if (success) {
                console.log('[ChatInput] Chat history reset successful');
                // Reset the conversation in the UI
                onResetConversation();
                // Send first_mes as the first message from bot
                if (selectedCharacter?.jsonData) {
                  try {
                    const jsonData = JSON.parse(selectedCharacter.jsonData);
                    if (jsonData.roleCard?.first_mes) {
                      // Wait a moment before sending first_mes to ensure UI is ready
                      setTimeout(() => {
                        onSendMessage(jsonData.roleCard.first_mes, 'bot');
                      }, 100);
                    }
                  } catch (e) {
                    console.error('[ChatInput] Error parsing character JSON after reset:', e);
                  }
                }
              } else {
                console.error('[ChatInput] Failed to reset chat history');
                Alert.alert('错误', '重置对话失败，请重试');
              }
              
              setShowActions(false);
            } catch (error) {
              console.error('[ChatInput] Error during conversation reset:', error);
              Alert.alert('错误', '重置对话时出现错误');
            } finally {
              setIsLoading(false);
            }
          }
        },
      ]
    );
  };

  // Combined image handling function
  const openImageOptions = () => {
    setShowActions(false);
    Alert.alert(
      '选择图片来源',
      '请选择如何添加图片',
      [
        {
          text: '从相册选择',
          onPress: pickImage
        },
        {
          text: '输入图片URL',
          onPress: () => setShowImageUrlModal(true)
        },
        {
          text: '取消',
          style: 'cancel'
        }
      ]
    );
  };

  // Image handling functions
  const pickImage = async () => {
    setShowActions(false);
    
    // Request permission to access the photo library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('需要权限', '需要照片库访问权限才能选择图片。');
      return;
    }
    
    try {
      // Launch the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Process the image to ensure it's not too large
        const manipResult = await manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: SaveFormat.JPEG, base64: true }
        );
        
        // Set the processed image
        setSelectedImage(`data:image/jpeg;base64,${manipResult.base64}`);
        setSelectedImageType('image/jpeg');
        setShowImagePreviewModal(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('错误', '选择图片时出现错误，请重试。');
    }
  };

  const handleImageUrlInput = () => {
    setShowActions(false);
    setShowImageUrlModal(true);
  };

  const handleImageUrlSubmit = () => {
    if (imageUrl.trim()) {
      setSelectedImage(imageUrl.trim());
      setSelectedImageType('url');
      setShowImageUrlModal(false);
      setShowImagePreviewModal(true);
    } else {
      Alert.alert('错误', '请输入有效的图片URL');
    }
  };

  const openImageGenModal = () => {
    setShowActions(false);
    setShowImageGenModal(true);
  };

  // Function to select reference image for image editing
  const pickReferenceImage = async () => {
    // Request permission to access the photo library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('需要权限', '需要照片库访问权限才能选择图片。');
      return;
    }
    
    try {
      // Launch the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Process the image to ensure it's not too large
        const manipResult = await manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: SaveFormat.JPEG, base64: true }
        );
        
        // Set the processed image as reference
        setReferenceImage(`data:image/jpeg;base64,${manipResult.base64}`);
        setReferenceImageType('image/jpeg');
      }
    } catch (error) {
      console.error('Error picking reference image:', error);
      Alert.alert('错误', '选择参考图片时出现错误，请重试。');
    }
  };
  
  const openImageEditGenModal = () => {
    setShowActions(false);
    setReferenceImage(null);
    setReferenceImageType(null);
    setImagePrompt('');
    setShowImageEditGenModal(true);
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

            {/* Combined Image Button - replaces separate buttons */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={openImageOptions}
            >
              <View style={[styles.actionIcon, styles.imageIcon]}>
                <Ionicons name="images" size={24} color="#fff" />
              </View>
              <Animated.Text style={styles.actionText}>
                添加图片
              </Animated.Text>
            </TouchableOpacity>

            {/* New Image Generation Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={openImageGenModal}
            >
              <View style={[styles.actionIcon, styles.generateIcon]}>
                <Ionicons name="brush" size={24} color="#fff" />
              </View>
              <Animated.Text style={styles.actionText}>
                生成图片
              </Animated.Text>
            </TouchableOpacity>

            {/* Image-to-Image Generation Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={openImageEditGenModal}
            >
              <View style={[styles.actionIcon, styles.editImageIcon]}>
                <Ionicons name="color-wand" size={24} color="#fff" />
              </View>
              <Animated.Text style={styles.actionText}>
                图片修改
              </Animated.Text>
            </TouchableOpacity>
            
            {/* New Image Cache Management Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleManageImageCache}
            >
              <View style={[styles.actionIcon, styles.cacheIcon]}>
                <Ionicons name="trash-bin" size={24} color="#fff" />
              </View>
              <Animated.Text style={styles.actionText}>
                图片缓存
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

      {/* Image URL Modal */}
      <Modal
        visible={showImageUrlModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageUrlModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>输入图片URL</Text>
            <TextInput
              style={styles.urlInput}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor="#999"
              value={imageUrl}
              onChangeText={setImageUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowImageUrlModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleImageUrlSubmit}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={showImagePreviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImagePreviewModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.imagePreviewContent}>
            <Text style={styles.modalTitle}>预览图片</Text>
            <View style={styles.imagePreviewWrapper}>
              {selectedImage && (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              )}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowImagePreviewModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSendImage}
                disabled={isLoading}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>
                  {isLoading ? '处理中...' : '发送图片'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Generation Modal */}
      <Modal
        visible={showImageGenModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageGenModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>生成图片</Text>
            <TextInput
              style={[styles.urlInput, {height: 100}]}
              placeholder="描述你想要生成的图片..."
              placeholderTextColor="#999"
              value={imagePrompt}
              onChangeText={setImagePrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowImageGenModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleImageGeneration}
                disabled={isGeneratingImage || imagePrompt.trim() === ''}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>
                  {isGeneratingImage ? '生成中...' : '开始生成'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Edit Generation Modal */}
      <Modal
        visible={showImageEditGenModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageEditGenModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.imageEditModalContent}>
            <Text style={styles.modalTitle}>图片编辑</Text>
            
            {/* Reference Image Preview */}
            <View style={styles.referenceImageSection}>
              <Text style={styles.modalSubtitle}>参考图片:</Text>
              <View style={styles.referenceImageContainer}>
                {referenceImage ? (
                  <Image 
                    source={{ uri: referenceImage }} 
                    style={styles.referenceImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.noImagePlaceholder}>
                    <Ionicons name="image-outline" size={40} color="#777" />
                    <Text style={styles.placeholderText}>未选择图片</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.button, styles.selectImageButton]}
                onPress={pickReferenceImage}
              >
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.selectImageButtonText}>
                  {referenceImage ? '更换参考图片' : '选择参考图片'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Prompt input */}
            <Text style={styles.modalSubtitle}>修改指令:</Text>
            <TextInput
              style={[styles.urlInput, {height: 100}]}
              placeholder="输入编辑指令 (例如：'转换成卡通风格', '改成黄色背景')"
              placeholderTextColor="#999"
              value={imagePrompt}
              onChangeText={setImagePrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            {/* Button row */}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowImageEditGenModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.modalButtonPrimary,
                  (!referenceImage || !imagePrompt.trim()) && styles.disabledButton
                ]}
                onPress={handleImageEditOperation}  // <- Updated to use the new function
                disabled={isGeneratingImage || !referenceImage || !imagePrompt.trim()}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>
                  {isGeneratingImage ? '处理中...' : '开始编辑'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexWrap: 'wrap',
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
  imageIcon: {
    backgroundColor: '#3498db',
  },
  urlIcon: {
    backgroundColor: '#e67e22',
  },
  generateIcon: {
    backgroundColor: '#9b59b6', // Purple for image generation
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  imagePreviewContent: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  urlInput: {
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#555',
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonText: {
    color: '#ddd',
    fontWeight: 'bold',
  },
  imagePreviewWrapper: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    marginBottom: 20,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageEditModalContent: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalSubtitle: {
    color: '#ddd',
    fontSize: 16,
    marginBottom: 8,
  },
  referenceImageSection: {
    marginBottom: 16,
  },
  referenceImageContainer: {
    height: 200,
    backgroundColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  referenceImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#777',
    marginTop: 8,
  },
  selectImageButton: {
    flexDirection: 'row',
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectImageButtonText: {
    color: '#fff',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  editImageIcon: {
    backgroundColor: '#8e44ad', // Different purple for edit image
  },
  cacheIcon: {
    backgroundColor: '#e74c3c', // Red for cache management
  },
});

export default ChatInput;
