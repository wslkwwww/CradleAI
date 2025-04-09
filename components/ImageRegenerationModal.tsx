import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Platform,
  SafeAreaView,
  TextInput,
  PanResponder,
  Animated
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CradleCharacter, CharacterImage } from '@/shared/types';
import TagSelector from './TagSelector';
import ArtistReferenceSelector from './ArtistReferenceSelector';
import { DEFAULT_NEGATIVE_PROMPTS } from '@/constants/defaultPrompts';
import { licenseService } from '@/services/license-service'; // 导入许可证服务

// 更新图片生成服务的基础URL常量
const IMAGE_SERVICE_BASE_URL = 'https://image.cradleintro.top';

interface ImageRegenerationModalProps {
  visible: boolean;
  character: CradleCharacter;
  onClose: () => void;
  onSuccess: (imageData: CharacterImage) => void;
  existingImageConfig?: {
    positiveTags: string[];
    negativeTags: string[];
    artistPrompt: string | null;
    customPrompt: string;
    useCustomPrompt: boolean;
  };
}

// Add a component for draggable tag items
interface DraggableTagProps {
  tag: string;
  index: number;
  moveTag: (dragIndex: number, hoverIndex: number) => void;
  onRemove: () => void;
  isPositive: boolean;
}

const DraggableTag: React.FC<DraggableTagProps> = ({
  tag,
  index,
  moveTag,
  onRemove,
  isPositive
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        // Start the drag animation - make it more pronounced
        Animated.timing(pan, {
          toValue: { x: 0, y: -5 },
          duration: 100,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        // Update animated values
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });

        // Lower the threshold for movement to make it more responsive
        const moveDistance = 20; // Reduced from 30
        if (Math.abs(gestureState.dy) > moveDistance) {
          // Calculate target index based on direction of movement
          const direction = gestureState.dy > 0 ? 1 : -1;
          const targetIndex = index + direction;

          // Perform the move if it's within bounds
          moveTag(index, targetIndex);

          // Reset pan values after move
          pan.setValue({ x: 0, y: 0 });
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        // Reset position with a smoother animation
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Make the tag more visually responsive when dragging
  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        isPositive ? styles.selectedPositiveTag : styles.selectedNegativeTag,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          elevation: isDragging ? 8 : 0, // Increased elevation for better visual feedback
          zIndex: isDragging ? 1000 : 1,
          shadowColor: "#000",
          shadowOffset: isDragging ? { width: 0, height: 3 } : { width: 0, height: 0 },
          shadowOpacity: isDragging ? 0.4 : 0,
          shadowRadius: isDragging ? 5 : 0,
          // Add scale effect when dragging
          scaleX: isDragging ? 1.05 : 1,
          scaleY: isDragging ? 1.05 : 1,
        },
        styles.draggableTag
      ]}
    >
      <MaterialIcons name="drag-indicator" size={16} color={isPositive ? "#333" : "#ddd"} style={styles.dragHandle} />
      <Text style={isPositive ? styles.tagText : styles.negativeTagText}>{tag}</Text>
      <TouchableOpacity onPress={onRemove} style={styles.tagRemoveButton}>
        <Ionicons
          name="close-circle"
          size={16}
          color={isPositive ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const ImageRegenerationModal: React.FC<ImageRegenerationModalProps> = ({
  visible,
  character,
  onClose,
  onSuccess,
  existingImageConfig
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [positiveTags, setPositiveTags] = useState<string[]>([]);
  const [negativeTags, setNegativeTags] = useState<string[]>([]);
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);
  const [replaceBackground, setReplaceBackground] = useState(true);
  const [replaceAvatar, setReplaceAvatar] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add state for artist reference
  const [selectedArtistPrompt, setSelectedArtistPrompt] = useState<string | null>(null);
  const [useExistingArtistPrompt, setUseExistingArtistPrompt] = useState(true);

  // Add state for custom prompt
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);

  // Add state for tag reordering
  const [reorderingPositive, setReorderingPositive] = useState(false);
  const [reorderingNegative, setReorderingNegative] = useState(false);

  // 添加许可证信息状态
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [licenseLoaded, setLicenseLoaded] = useState(false);

  // 组件挂载时加载许可证信息
  useEffect(() => {
    const loadLicense = async () => {
      try {
        // 先初始化许可证服务，使用公开方法检查初始化状态
        if (!licenseService.isInitialized()) {
          await licenseService.initialize();
        }

        // 获取许可证信息
        const info = await licenseService.getLicenseInfo();
        setLicenseInfo(info);
        setLicenseLoaded(true);

        console.log('[图片重生成] 许可证信息加载完成:', info ? '成功' : '未找到许可证');
      } catch (error) {
        console.error('[图片重生成] 加载许可证信息失败:', error);
        setLicenseLoaded(true);
      }
    };

    loadLicense();
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      // First check if we have existing config passed in
      if (existingImageConfig) {
        setPositiveTags(existingImageConfig.positiveTags || []);
        setNegativeTags(existingImageConfig.negativeTags || []);
        setSelectedArtistPrompt(existingImageConfig.artistPrompt);
        setUseExistingArtistPrompt(!!existingImageConfig.artistPrompt);
        setCustomPrompt(existingImageConfig.customPrompt || '');
        setUseCustomPrompt(existingImageConfig.useCustomPrompt || false);
      }
      // Otherwise use character generation data if available
      else if (character.generationData?.appearanceTags) {
        setPositiveTags(character.generationData.appearanceTags.positive || []);
        setNegativeTags(character.generationData.appearanceTags.negative || []);

        if (character.generationData.appearanceTags.artistPrompt) {
          setSelectedArtistPrompt(character.generationData.appearanceTags.artistPrompt);
          setUseExistingArtistPrompt(true);
        } else {
          setSelectedArtistPrompt(null);
        }
      } else {
        setPositiveTags([]);
        setNegativeTags([]);
        setSelectedArtistPrompt(null);
      }

      setGeneratedImageUrl(null);
      setError(null);
      setIsLoading(false);
      setReplaceBackground(true);
      setReplaceAvatar(false);
      if (!existingImageConfig) {
        setCustomPrompt('');
        setUseCustomPrompt(false);
      }

      // Reset reordering state
      setReorderingPositive(false);
      setReorderingNegative(false);
    }
  }, [visible, character, existingImageConfig]);

  // Function to move tags in the array (reordering)
  const movePositiveTag = (fromIndex: number, toIndex: number) => {
    // Prevent out of bounds moves
    if (toIndex < 0 || toIndex >= positiveTags.length) return;

    // Create a copy of the array and move the item
    const updatedTags = [...positiveTags];
    const [movedItem] = updatedTags.splice(fromIndex, 1);
    updatedTags.splice(toIndex, 0, movedItem);

    // Update state
    setPositiveTags(updatedTags);
  };

  const moveNegativeTag = (fromIndex: number, toIndex: number) => {
    // Prevent out of bounds moves
    if (toIndex < 0 || toIndex >= negativeTags.length) return;

    // Create a copy of the array and move the item
    const updatedTags = [...negativeTags];
    const [movedItem] = updatedTags.splice(fromIndex, 1);
    updatedTags.splice(toIndex, 0, movedItem);

    // Update state
    setNegativeTags(updatedTags);
  };

  // Toggle reordering mode
  const toggleReorderingPositive = () => {
    setReorderingPositive(!reorderingPositive);
    if (reorderingNegative) setReorderingNegative(false);
  };

  const toggleReorderingNegative = () => {
    setReorderingNegative(!reorderingNegative);
    if (reorderingPositive) setReorderingPositive(false);
  };

  // Submit image generation request with updated config saving
  const submitImageGeneration = async () => {
    if (positiveTags.length === 0 && !useCustomPrompt) {
      Alert.alert('无法生成', '请至少添加一个正面标签来描述角色外观，或使用自定义提示词');
      return;
    }

    if (useCustomPrompt && !customPrompt.trim()) {
      Alert.alert('无法生成', '启用了自定义提示词功能，但没有输入任何提示词');
      return;
    }

    // Set loading state just for UI feedback
    setIsLoading(true);
    setError(null);

    try {
      let positivePrompt = '';

      // If using custom prompt, use it directly
      if (useCustomPrompt) {
        // Process custom prompt to remove spaces after commas
        positivePrompt = customPrompt.trim().replace(/, /g, ',');
        console.log(`[图片重生成] 使用自定义提示词: ${positivePrompt}`);
      } else {
        // Prepare final positive tags list with artist prompt if selected
        let finalPositiveTags = [...positiveTags];

        // Only add artist prompt if one is selected and we're using it
        if (selectedArtistPrompt && useExistingArtistPrompt) {
          console.log(`[图片重生成] 使用画师风格提示词: ${selectedArtistPrompt}`);
          // Check if the artist prompt is already in the tags to avoid duplication
          if (!finalPositiveTags.includes(selectedArtistPrompt)) {
            finalPositiveTags.push(selectedArtistPrompt);
          }
        }

        // Join with commas but NO spaces after commas
        positivePrompt = finalPositiveTags.join(',');
      }

      // Combine negative tags with default negative prompts
      const finalNegativeTags = [...negativeTags, ...DEFAULT_NEGATIVE_PROMPTS];
      // Join with commas but NO spaces after commas
      const negativePrompt = finalNegativeTags.join(',');

      console.log(`[图片重生成] 正在为角色 "${character.name}" 生成新图像`);
      console.log(`[图片重生成] 正向提示词: ${positivePrompt}`);
      console.log(`[图片重生成] 负向提示词: ${negativePrompt} (包含默认负向提示词)`);

      // 验证许可证
      console.log(`[图片重生成] 验证许可证...`);

      // 确保许可证服务已初始化
      if (!licenseService.isInitialized()) {
        console.log(`[图片重生成] 初始化许可证服务...`);
        await licenseService.initialize();
      }

      // 检查许可证是否有效
      const isLicenseValid = await licenseService.hasValidLicense();
      if (!isLicenseValid) {
        console.error(`[图片重生成] 许可证验证失败: 无效的许可证`);
        throw new Error('需要有效的许可证才能生成图像，请先在API设置中激活您的许可证');
      }

      // 获取许可证信息，以获取email
      const licenseInfo = await licenseService.getLicenseInfo();
      const userEmail = licenseInfo?.email || licenseInfo?.customerEmail || '';
      
      // 构建请求参数，按照要求的格式
      const requestData = {
        prompt: positivePrompt,
        negative_prompt: negativePrompt,
        width: 576,  // 默认宽度
        height: 1024, // 默认高度
        steps: 28,    // 默认步数
        batch_size: 1, // 默认批量大小
        email: userEmail // 添加用户邮箱
      };

      // 获取许可证头信息
      console.log(`[图片重生成] 获取许可证头信息...`);
      const licenseHeaders = await licenseService.getLicenseHeaders();

      // 检查许可证头是否完整
      if (!licenseHeaders || !licenseHeaders['X-License-Key'] || !licenseHeaders['X-Device-ID']) {
        console.error(`[图片重生成] 许可证头信息不完整`);
        throw new Error('许可证信息不完整，请在API设置中重新激活您的许可证');
      }

      console.log(`[图片重生成] 使用许可证密钥: ${licenseHeaders['X-License-Key'].substring(0, 4)}****`);
      console.log(`[图片重生成] 使用设备ID: ${licenseHeaders['X-Device-ID'].substring(0, 4)}****`);
      if (userEmail) console.log(`[图片重生成] 使用用户邮箱: ${userEmail}`);

      // 发送请求到图片生成服务，并携带许可证信息
      console.log(`[图片重生成] 正在向服务器发送请求...`);
      const response = await fetch(`${IMAGE_SERVICE_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...licenseHeaders  // 添加许可证头信息
        },
        body: JSON.stringify(requestData),
      });

      console.log(`[图片重生成] 服务器响应状态: ${response.status}`);

      // 获取原始响应文本进行详细诊断
      const responseText = await response.text();
      console.log(`[图片重生成] 原始响应内容: ${responseText}`);
      
      let data;
      try {
        // 尝试解析JSON
        data = JSON.parse(responseText);
        console.log(`[图片重生成] 解析的响应数据:`, data);
      } catch (parseError) {
        console.error(`[图片重生成] 响应不是有效的JSON: ${parseError}`);
        throw new Error(`服务器返回的不是有效的JSON: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        console.error(`[图片重生成] 服务器响应错误: HTTP ${response.status}`);
        let errorDetail = '';
        try {
          const errorObj = JSON.parse(responseText);
          if (errorObj.error) {
            errorDetail = errorObj.error;
          }
        } catch (e) {
          errorDetail = responseText;
        }
        throw new Error(`服务器响应错误: ${response.status} - ${errorDetail || '未知错误'}`);
      }

      // 检查数据格式 - 更灵活的成功条件判断
      let taskId = '';
      let isSuccess = false;

      // 判断响应是否成功的条件 - 更加宽松和适应不同格式
      if (data.success === true) {
        isSuccess = true;
        // 修复: 确保正确从data.data中获取taskId
        taskId = data.data?.taskId || '';
        console.log(`[图片重生成] 任务提交成功，ID: ${taskId}`);
      } else if (data.error) {
        console.error(`[图片重生成] 请求失败: ${data.error}`);
        throw new Error(data.error);
      } else if (data.urls && Array.isArray(data.urls) && data.urls.length > 0) {
        console.log(`[图片重生成] 服务器直接返回了图片URL: ${data.urls[0]}`);
        const completedImage: CharacterImage = {
          id: `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          url: data.urls[0],
          characterId: character.id,
          createdAt: Date.now(),
          tags: {
            positive: useCustomPrompt ? [customPrompt.trim().replace(/, /g, ',')] : positiveTags,
            negative: negativeTags,
          },
          isFavorite: false,
          generationStatus: 'success',
          setAsBackground: replaceBackground,
          isAvatar: false,
          generationConfig: {
            positiveTags: positiveTags,
            negativeTags: negativeTags,
            artistPrompt: selectedArtistPrompt,
            customPrompt: customPrompt.trim().replace(/, /g, ','),
            useCustomPrompt: useCustomPrompt
          }
        };
        onSuccess(completedImage);
        onClose();
        return;
      }

      // 检查taskId是否存在
      if (isSuccess && taskId) {
        const generationConfig = {
          positiveTags: positiveTags,
          negativeTags: negativeTags,
          artistPrompt: selectedArtistPrompt,
          customPrompt: customPrompt.trim().replace(/, /g, ','),
          useCustomPrompt: useCustomPrompt
        };

        const placeholderImage: CharacterImage = {
          id: `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          url: '',
          characterId: character.id,
          createdAt: Date.now(),
          tags: {
            positive: useCustomPrompt ? [customPrompt.trim().replace(/, /g, ',')] : positiveTags,
            negative: negativeTags,
          },
          isFavorite: false,
          generationTaskId: taskId,
          generationStatus: 'pending',
          generationMessage: '正在生成图像...',
          setAsBackground: replaceBackground,
          isAvatar: false,
          generationConfig: generationConfig,
        };
        
        // Gracefully close the modal first and then trigger onSuccess
        onClose();
        setTimeout(() => {
          onSuccess(placeholderImage);
          
          console.log(`[图片重生成] 等待3秒后开始检查任务状态...`);
          setTimeout(() => {
            checkImageGenerationStatus(character.id, taskId, placeholderImage.id);
          }, 3000);
        }, 300);
        
        return;
      } else {
        throw new Error('未能获取有效的任务ID，服务器返回的数据格式不正确');
      }
    } catch (error) {
      console.error('[图片重生成] 生成失败:', error);
      setError(error instanceof Error ? error.message : '生成图像失败');
      setTimeout(() => {
        onClose();
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const checkImageGenerationStatus = async (characterId: string, taskId: string, imageId: string) => {
    console.log(`[图片重生成] 开始检查任务状态: ${taskId}`);
    
    const MAX_RETRIES = 60;
    let retries = 0;
    
    const poll = async () => {
      try {
        console.log(`[图片重生成] 检查 #${retries+1}, 任务: ${taskId}`);
        
        const licenseHeaders = await licenseService.getLicenseHeaders();
        
        const headers = {
          'Accept': 'application/json',
          ...(licenseHeaders || {})
        };
        
        // 更新API端点路径适应新的后端
        let response;
        try {
          response = await fetch(`${IMAGE_SERVICE_BASE_URL}/api/generate/task/${taskId}`, {
            headers: headers
          });
          
          console.log(`[图片重生成] 状态检查响应: ${response.status}`);
        } catch (fetchError) {
          console.error(`[图片重生成] 状态检查请求失败:`, fetchError);
          retries++;
          if (retries < MAX_RETRIES) {
            return setTimeout(poll, 15000);
          } else {
            throw fetchError;
          }
        }
        
        const responseText = await response.text();
        console.log(`[图片重生成] 状态检查原始响应: ${responseText}`);
        
        let data;
        try {
          data = JSON.parse(responseText);
          console.log(`[图片重生成] 解析的状态数据:`, data);
        } catch (parseError) {
          console.warn(`[图片重生成] 状态响应不是有效的JSON:`, parseError);
          retries++;
          if (retries < MAX_RETRIES) {
            return setTimeout(poll, 10000);
          } else {
            throw new Error(`无法解析服务器响应: ${responseText.substring(0, 100)}...`);
          }
        }
        
        // 适应新的API响应格式
        const taskData = data.data || {};
        const status = taskData.status || '';
        
        // 判断任务是否完成
        const isDone = status === 'succeeded' || status === 'failed' || taskData.completedAt;
        const isSuccess = status === 'succeeded';
        const imageUrls = taskData.urls || [];
        const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;
        const errorMessage = taskData.error || null;
        
        if (isDone) {
          if (isSuccess && imageUrl) {
            console.log(`[图片重生成] 图像生成成功: ${imageUrl}`);
            
            const completedImage: CharacterImage = {
              id: imageId,
              url: imageUrl,
              characterId: characterId,
              createdAt: Date.now(),
              tags: {
                positive: useCustomPrompt ? [customPrompt.trim().replace(/, /g, ',')] : positiveTags,
                negative: negativeTags,
              },
              isFavorite: false,
              generationStatus: 'success',
              generationTaskId: undefined,
              setAsBackground: replaceBackground,
              isAvatar: false,
              generationConfig: {
                positiveTags: positiveTags,
                negativeTags: negativeTags,
                artistPrompt: selectedArtistPrompt,
                customPrompt: customPrompt.trim().replace(/, /g, ','),
                useCustomPrompt: useCustomPrompt
              }
            };
            
            onSuccess(completedImage);
            return;
          } else if (errorMessage) {
            console.error(`[图片重生成] 任务失败: ${errorMessage}`);
            
            const failedImage: CharacterImage = {
              id: imageId,
              url: '',
              characterId: characterId,
              createdAt: Date.now(),
              tags: {
                positive: useCustomPrompt ? [customPrompt.trim().replace(/, /g, ',')] : positiveTags,
                negative: negativeTags,
              },
              isFavorite: false,
              generationStatus: 'error',
              generationError: errorMessage,
              generationTaskId: undefined,
              setAsBackground: false,
              isAvatar: false
            };
            
            onSuccess(failedImage);
            return;
          } else {
            console.warn(`[图片重生成] 任务标记为完成，但未返回图片URL或错误信息`);
          }
        } else {
          // 任务仍在处理中，显示状态
          console.log(`[图片重生成] 任务状态: ${status}`);
        }
        
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`[图片重生成] 将在10秒后再次检查`);
          setTimeout(poll, 10000);
        } else {
          console.log(`[图片重生成] 达到最大检查次数 (${MAX_RETRIES})，但任务仍未完成`);
          
          const timedOutImage: CharacterImage = {
            id: imageId,
            url: '',
            characterId: characterId,
            createdAt: Date.now(),
            tags: {
              positive: useCustomPrompt ? [customPrompt.trim().replace(/, /g, ',')] : positiveTags,
              negative: negativeTags,
            },
            isFavorite: false,
            generationStatus: 'error',
            generationError: '检查超时，请在设置中手动检查任务状态',
            generationTaskId: taskId,
            setAsBackground: false,
            isAvatar: false
          };
          
          onSuccess(timedOutImage);
        }
      } catch (error) {
        console.error('[图片重生成] 检查任务状态出错:', error);
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`[图片重生成] 将在15秒后重试...`);
          setTimeout(poll, 15000);
        } else {
          console.error(`[图片重生成] 达到最大重试次数 (${MAX_RETRIES})，停止检查`);
          
          const errorImage: CharacterImage = {
            id: imageId,
            url: '',
            characterId: characterId,
            createdAt: Date.now(),
            tags: {
              positive: useCustomPrompt ? [customPrompt.trim().replace(/, /g, ',')] : positiveTags,
              negative: negativeTags,
            },
            isFavorite: false,
            generationStatus: 'error',
            generationError: '检查状态时出错，请稍后在图库中查看结果',
            generationTaskId: taskId,
            setAsBackground: false,
            isAvatar: false
          };
          
          onSuccess(errorImage);
        }
      }
    };
    
    poll();
  };

  const handleConfirm = () => {
    onClose();
  };
  
  const toggleArtistPromptUsage = (value: boolean) => {
    setUseExistingArtistPrompt(value);
    console.log(`[图片重生成] ${value ? '启用' : '禁用'}画师风格提示词`);
  };
  
  const toggleCustomPromptMode = (value: boolean) => {
    setUseCustomPrompt(value);
  };

  const renderTagList = (tags: string[], isPositive: boolean, isReordering: boolean) => {
    if (tags.length === 0) {
      return <Text style={styles.noTagsText}>未选择{isPositive ? '正面' : '负面'}标签</Text>;
    }
    
    return (
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => (
          isReordering ? (
            <DraggableTag
              key={`${isPositive ? 'pos' : 'neg'}-${index}`}
              tag={tag}
              index={index}
              moveTag={isPositive ? movePositiveTag : moveNegativeTag}
              onRemove={() => {
                if (isPositive) {
                  setPositiveTags(currentTags => currentTags.filter((_, i) => i !== index));
                } else {
                  setNegativeTags(currentTags => currentTags.filter((_, i) => i !== index));
                }
              }}
              isPositive={isPositive}
            />
          ) : (
            <TouchableOpacity
              key={`${isPositive ? 'pos' : 'neg'}-${index}`}
              style={isPositive ? styles.selectedPositiveTag : styles.selectedNegativeTag}
              onPress={() => {
                if (isPositive) {
                  setPositiveTags(tags => tags.filter(t => t !== tag));
                } else {
                  setNegativeTags(tags => tags.filter(t => t !== tag));
                }
              }}
            >
              <Text style={isPositive ? styles.tagText : styles.negativeTagText}>{tag}</Text>
              <Ionicons 
                name="close-circle" 
                size={14} 
                color={isPositive ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"} 
              />
            </TouchableOpacity>
          )
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => {
        if (!isLoading) onClose();
      }}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>图像生成</Text>
            {!isLoading && (
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView 
            style={styles.modalContent} 
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.characterInfoSection}>
              <Text style={styles.sectionTitle}>
                为 "{character.name}" 生成新图像
              </Text>
              
              {character.avatar && (
                <Image 
                  source={{ uri: character.avatar }} 
                  style={styles.characterAvatar} 
                />
              )}
            </View>
            
            {generatedImageUrl && (
              <View style={styles.resultSection}>
                <Text style={styles.sectionTitle}>生成结果</Text>
                <Image 
                  source={{ uri: generatedImageUrl }}
                  style={styles.generatedImage}
                  resizeMode="contain"
                />
                
                <View style={styles.resultOptions}>
                  <Text style={styles.optionText}>设为角色背景图片</Text>
                  <Switch
                    value={replaceBackground}
                    onValueChange={setReplaceBackground}
                    trackColor={{ false: '#767577', true: '#bfe8ff' }}
                    thumbColor={replaceBackground ? '#007bff' : '#f4f3f4'}
                  />
                </View>
                
                <TouchableOpacity 
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>确认</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {!generatedImageUrl && (
              <>
                <View style={styles.tagSelectionSection}>
                  <Text style={styles.sectionTitle}>图像生成选项</Text>
                  
                  <View style={styles.customPromptContainer}>
                    <View style={styles.customPromptHeader}>
                      <Text style={styles.customPromptTitle}>自定义提示词</Text>
                      <Switch
                        value={useCustomPrompt}
                        onValueChange={toggleCustomPromptMode}
                        trackColor={{ false: '#767577', true: '#bfe8ff' }}
                        thumbColor={useCustomPrompt ? '#007bff' : '#f4f3f4'}
                      />
                    </View>
                    
                    {useCustomPrompt && (
                      <View style={styles.customPromptInputContainer}>
                        <TextInput
                          style={styles.customPromptInput}
                          value={customPrompt}
                          onChangeText={setCustomPrompt}
                          placeholder="输入详细的生成提示词（英文效果更好）"
                          placeholderTextColor="#888"
                          multiline={true}
                          numberOfLines={3}
                        />
                      </View>
                    )}
                  </View>
                  
                  <View style={[styles.artistReferenceContainer, {opacity: useCustomPrompt ? 0.5 : 1}]}>
                    {selectedArtistPrompt && !useCustomPrompt && (
                      <View style={styles.artistPromptContainer}>
                        <View style={styles.artistPromptHeader}>
                          <Text style={styles.artistPromptTitle}>使用原有画风</Text>
                          <Switch
                            value={useExistingArtistPrompt}
                            onValueChange={toggleArtistPromptUsage}
                            trackColor={{ false: '#767577', true: '#bfe8ff' }}
                            thumbColor={useExistingArtistPrompt ? '#007bff' : '#f4f3f4'}
                            disabled={useCustomPrompt}
                          />
                        </View>

                        {useExistingArtistPrompt && (
                          <View style={styles.artistPromptContent}>
                            <Text style={styles.artistPromptNote}>
                              保留原有画风: {selectedArtistPrompt}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    
                    {(!selectedArtistPrompt || !useExistingArtistPrompt) && !useCustomPrompt && (
                      <ArtistReferenceSelector 
                        selectedGender={(character.gender === 'male' || character.gender === 'female' || character.gender === 'other' ? character.gender : 'female')}
                        onSelectArtist={setSelectedArtistPrompt}
                        selectedArtistPrompt={selectedArtistPrompt}
                      />
                    )}
                  </View>
                  
                  {!useCustomPrompt && (
                    <View style={styles.tagSection}>
                      <View style={styles.tagSummaryContainer}>
                        <View style={styles.tagSectionHeader}>
                          <Text style={styles.tagSectionTitle}>正面标签</Text>
                          {positiveTags.length > 1 && (
                            <TouchableOpacity 
                              style={styles.reorderButton} 
                              onPress={toggleReorderingPositive}
                            >
                              <Ionicons 
                                name={reorderingPositive ? "checkmark-outline" : "reorder-three-outline"} 
                                size={18} 
                                color="#FFF" 
                              />
                              <Text style={styles.reorderButtonText}>
                                {reorderingPositive ? "完成排序" : "重新排序"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        
                        <View style={[
                          styles.tagsContainer, 
                          reorderingPositive && styles.tagsContainerReordering
                        ]}>
                          {renderTagList(positiveTags, true, reorderingPositive)}
                        </View>
                        
                        <View style={styles.tagSectionHeader}>
                          <Text style={styles.tagSectionTitle}>负面标签</Text>
                          {negativeTags.length > 1 && (
                            <TouchableOpacity 
                              style={styles.reorderButton} 
                              onPress={toggleReorderingNegative}
                            >
                              <Ionicons 
                                name={reorderingNegative ? "checkmark-outline" : "reorder-three-outline"} 
                                size={18} 
                                color="#FFF" 
                              />
                              <Text style={styles.reorderButtonText}>
                                {reorderingNegative ? "完成排序" : "重新排序"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        
                        <View style={[
                          styles.tagsContainer,
                          reorderingNegative && styles.tagsContainerReordering
                        ]}>
                          {renderTagList(negativeTags, false, reorderingNegative)}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
                
                {/* Button container for horizontally aligned buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.openTagSelectorButton,
                      (reorderingPositive || reorderingNegative) && styles.disabledButton
                    ]}
                    onPress={() => setTagSelectorVisible(true)}
                    disabled={reorderingPositive || reorderingNegative}
                  >
                    <Ionicons name="pricetag-outline" size={20} color="#fff" />
                    <Text style={styles.openTagSelectorText}>浏览标签</Text>
                  </TouchableOpacity>

                  {!isLoading ? (
                    <TouchableOpacity 
                      style={[
                        styles.generateButton,
                        (reorderingPositive || reorderingNegative) && styles.disabledButton
                      ]}
                      onPress={submitImageGeneration}
                      disabled={reorderingPositive || reorderingNegative}
                    >
                      <Ionicons name="image" size={20} color="#fff" />
                      <Text style={styles.generateButtonText}>生成图像</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.loadingButton}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.loadingButtonText}>生成中...</Text>
                    </View>
                  )}
                </View>
                
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#FF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          
          <Modal
            visible={tagSelectorVisible}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setTagSelectorVisible(false)}
          >
            <View style={styles.tagSelectorModalContainer}>
              <View style={styles.tagSelectorHeader}>
                <Text style={styles.tagSelectorTitle}>选择标签</Text>
                <TouchableOpacity 
                  style={styles.tagSelectorCloseButton}
                  onPress={() => setTagSelectorVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.tagSelectorContent}>
                <TagSelector 
                  onClose={() => setTagSelectorVisible(false)}
                  onAddPositive={(tag) => {
                    if (!positiveTags.includes(tag)) {
                      setPositiveTags(prev => [...prev, tag]);
                    }
                  }}
                  onAddNegative={(tag) => {
                    if (!negativeTags.includes(tag)) {
                      setNegativeTags(prev => [...prev, tag]);
                    }
                  }}
                  existingPositiveTags={positiveTags}
                  existingNegativeTags={negativeTags}
                  onPositiveTagsChange={(tags) => {
                    if (JSON.stringify(tags) !== JSON.stringify(positiveTags)) {
                      setPositiveTags(tags);
                    }
                  }}
                  onNegativeTagsChange={(tags) => {
                    if (JSON.stringify(tags) !== JSON.stringify(negativeTags)) {
                      setNegativeTags(tags);
                    }
                  }}
                  sidebarWidth={70}
                />
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#222',
  },
  tagSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  container: {
    flex: 1,
    backgroundColor: '#222',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  bottomPadding: {
    height: 60,
  },
  characterInfoSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  characterAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  tagSelectionSection: {
    marginBottom: 12,
  },
  tagSummaryContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  tagSectionTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 30,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tagsContainerReordering: {
    minHeight: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  selectedPositiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 224, 195, 0.8)',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedNegativeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.8)',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#000',
    fontSize: 14,
    marginRight: 6,
  },
  negativeTagText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 6,
  },
  noTagsText: {
    color: '#aaa',
    fontStyle: 'italic',
    padding: 8,
  },
  defaultTagsInfo: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  openTagSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginRight: 8,
  },
  openTagSelectorText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    padding: 12,
    borderRadius: 8,
    flex: 1.5,
  },
  generateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    flex: 1.5,
  },
  loadingButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  errorText: {
    color: '#FF4444',
    marginLeft: 8,
  },
  resultSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  generatedImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
    marginBottom: 20,
  },
  resultOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 10,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  artistPromptContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  artistPromptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  artistPromptTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  artistPromptContent: {
    borderRadius: 8,
    padding: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  artistPromptNote: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
  },
  tagSelectorModalContainer: {
    flex: 1,
    backgroundColor: '#222',
  },
  tagSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  tagSelectorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tagSelectorCloseButton: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 44 : 16,
    padding: 4,
  },
  tagSelectorContent: {
    flex: 1,
  },
  customPromptContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  customPromptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customPromptTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  customPromptInputContainer: {
    marginTop: 8,
  },
  customPromptInput: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  artistReferenceContainer: {
    marginBottom: 12,
  },
  tagSection: {
    marginBottom: 16,
  },
  draggableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
  },
  dragHandle: {
    marginRight: 6,
    padding: 2,
  },
  tagRemoveButton: {
    padding: 4,
  },
  reorderingInstructionsContainer: {
    backgroundColor: 'rgba(112, 161, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  reorderingInstructions: {
    color: '#70a1ff',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});

export default ImageRegenerationModal;
