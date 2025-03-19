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
import { theme } from '@/constants/theme';
import TagSelector from './TagSelector';
import { downloadAndSaveImage } from '@/utils/imageUtils';
import ArtistReferenceSelector from './ArtistReferenceSelector';
import { DEFAULT_NEGATIVE_PROMPTS } from '@/constants/defaultPrompts';

// Get screen dimensions for modal sizing
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
        positivePrompt = customPrompt.trim();
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
        
        positivePrompt = finalPositiveTags.join(', ');
      }
      
      // Combine negative tags with default negative prompts
      const finalNegativeTags = [...negativeTags, ...DEFAULT_NEGATIVE_PROMPTS];
      const negativePrompt = finalNegativeTags.join(', ');
      
      console.log(`[图片重生成] 正在为角色 "${character.name}" 生成新图像`);
      console.log(`[图片重生成] 正向提示词: ${positivePrompt}`);
      console.log(`[图片重生成] 负向提示词: ${negativePrompt} (包含默认负向提示词)`);
      
      // 构建请求参数
      const requestData = {
        prompt: positivePrompt,
        negative_prompt: negativePrompt,
        model: 'nai-v4-full',
        sampler: 'k_euler_ancestral',
        steps: 28,
        scale: 11,
        resolution: 'portrait',
      };
      
      // 发送请求到服务器
      const response = await fetch('http://152.69.219.182:5000/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '图像生成请求失败');
      }
      
      // 获取任务ID
      const taskId = data.task_id;
      console.log(`[图片重生成] 已提交任务，ID: ${taskId}`);
      
      // Save generation configuration for future regeneration
      const generationConfig = {
        positiveTags: positiveTags,
        negativeTags: negativeTags,
        artistPrompt: selectedArtistPrompt,
        customPrompt: customPrompt,
        useCustomPrompt: useCustomPrompt
      };
      
      // Create a placeholder image record to track this generation task
      const placeholderImage: CharacterImage = {
        id: `img_${Date.now()}`,
        url: '',
        characterId: character.id,
        createdAt: Date.now(),
        tags: {
          positive: useCustomPrompt ? [customPrompt] : positiveTags,
          negative: negativeTags,
        },
        isFavorite: false,
        generationTaskId: taskId,
        generationStatus: 'pending',
        setAsBackground: replaceBackground,
        isAvatar: false,
        // Add generation configuration
        generationConfig: generationConfig
      };
      
      // Pass the placeholder to parent component
      onSuccess(placeholderImage);
      
      // Close the modal immediately after submitting the request
      onClose();
      
      // Start status check after closing
      setTimeout(() => {
        checkImageGenerationStatus(character.id, taskId, placeholderImage.id);
      }, 500);
      
    } catch (error) {
      console.error('[图片重生成] 生成失败:', error);
      setError(error instanceof Error ? error.message : '生成图像失败');
      // Show error for 2 seconds, then close
      setTimeout(() => {
        onClose();
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 添加图片生成状态检查函数
  const checkImageGenerationStatus = async (characterId: string, taskId: string, imageId: string) => {
    console.log(`[图片重生成] 开始检查任务状态: ${taskId}`);
    
    const MAX_RETRIES = 30;  // 最多检查30次，大约5分钟
    let retries = 0;
    
    // 创建轮询函数
    const poll = async () => {
      try {
        console.log(`[图片重生成] 检查 #${retries+1}, 任务: ${taskId}`);
        
        const response = await fetch(`http://152.69.219.182:5000/task_status/${taskId}`);
        if (!response.ok) {
          console.warn(`[图片重生成] 获取任务状态失败: HTTP ${response.status}`);
          return setTimeout(poll, 10000); // 10秒后重试
        }
        
        const data = await response.json();
        
        // 如果任务完成
        if (data.done) {
          if (data.success && data.image_url) {
            console.log(`[图片重生成] 图像生成成功: ${data.image_url}`);
            
            // 创建完整的图片对象，包含生成的URL
            const completedImage: CharacterImage = {
              id: imageId,
              url: data.image_url,
              characterId: characterId,
              createdAt: Date.now(),
              tags: {
                positive: useCustomPrompt ? [customPrompt] : positiveTags,
                negative: negativeTags,
              },
              isFavorite: false,
              generationStatus: 'success',
              setAsBackground: replaceBackground,
              isAvatar: false,
            };
            
            // 通知父组件更新图库
            onSuccess(completedImage);
          } else {
            console.error(`[图片重生成] 任务失败: ${data.error || '未知错误'}`);
          }
          return; // 结束轮询
        }
        
        // 如果任务仍在进行中且未超过最大重试次数
        retries++;
        if (retries < MAX_RETRIES) {
          setTimeout(poll, 10000); // 10秒后再次检查
        } else {
          console.log(`[图片重生成] 达到最大检查次数 (${MAX_RETRIES})，停止检查`);
        }
      } catch (error) {
        console.error('[图片重生成] 检查任务状态出错:', error);
        
        // 出错时仍然继续尝试，除非达到最大重试次数
        retries++;
        if (retries < MAX_RETRIES) {
          setTimeout(poll, 10000);
        }
      }
    };
    
    // 立即开始第一次检查
    poll();
  };

  // Handle confirming and saving the generated image
  const handleConfirm = () => {
    // Close the modal when user explicitly confirms
    onClose();
  };
  
  // Add a function to toggle artist reference usage
  const toggleArtistPromptUsage = (value: boolean) => {
    setUseExistingArtistPrompt(value);
    console.log(`[图片重生成] ${value ? '启用' : '禁用'}画师风格提示词`);
  };
  
  // Toggle custom prompt mode
  const toggleCustomPromptMode = (value: boolean) => {
    setUseCustomPrompt(value);
  };

  // Render tag list with reordering capabilities
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
          
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.scrollContentContainer}>
            {/* Character info */}
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
            
            {/* Result preview */}
            {generatedImageUrl && (
              <View style={styles.resultSection}>
                <Text style={styles.sectionTitle}>生成结果</Text>
                <Image 
                  source={{ uri: generatedImageUrl }}
                  style={styles.generatedImage}
                  resizeMode="contain"
                />
                
                {/* Only show background option, remove avatar option */}
                <View style={styles.resultOptions}>
                  <Text style={styles.optionText}>设为角色背景图片</Text>
                  <Switch
                    value={replaceBackground}
                    onValueChange={setReplaceBackground}
                    trackColor={{ false: '#767577', true: '#bfe8ff' }}
                    thumbColor={replaceBackground ? '#007bff' : '#f4f3f4'}
                  />
                </View>
                
                {/* Remove the avatar switch option */}
                
                <TouchableOpacity 
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>确认</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Tag selection */}
            {!generatedImageUrl && (
              <>
                <View style={styles.tagSelectionSection}>
                  <Text style={styles.sectionTitle}>图像生成选项</Text>
                  <Text style={styles.sectionDescription}>
                    请选择描述角色外观的标签或输入自定义提示词
                  </Text>
                  
                  {/* Custom Prompt Input */}
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
                        <Text style={styles.customPromptNote}>
                          自定义提示词将替代标签系统，可直接输入复杂提示词
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Artist Reference Selector */}
                  <View style={[styles.artistReferenceContainer, {opacity: useCustomPrompt ? 0.5 : 1}]}>
                    <Text style={styles.artistReferenceTitle}>画师风格参考</Text>
                    
                    {/* Show existing artist switch only if there's a previous artist */}
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
                    
                    {/* Show artist selector only if not using existing artist or no previous artist */}
                    {(!selectedArtistPrompt || !useExistingArtistPrompt) && !useCustomPrompt && (
                      <ArtistReferenceSelector 
                        selectedGender={(character.gender === 'male' || character.gender === 'female' || character.gender === 'other' ? character.gender : 'female')}
                        onSelectArtist={setSelectedArtistPrompt}
                        selectedArtistPrompt={selectedArtistPrompt}
                      />
                    )}
                  </View>
                  
                  {/* Tag selection section - only show if not using custom prompt */}
                  {!useCustomPrompt && (
                    <View style={styles.tagSection}>
                      {/* Tag summary with reordering feature */}
                      <View style={styles.tagSummaryContainer}>
                        {/* Positive tags section header with reorder button */}
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
                        
                        {/* Increase the size of the container when in reordering mode */}
                        <View style={[
                          styles.tagsContainer, 
                          reorderingPositive && styles.tagsContainerReordering
                        ]}>
                          {/* Render tags with or without drag functionality */}
                          {renderTagList(positiveTags, true, reorderingPositive)}
                        </View>
                        
                        {/* Negative tags section header with reorder button */}
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
                        
                        <Text style={styles.defaultTagsInfo}>
                          系统已添加默认的负面标签，以避免常见生成问题
                        </Text>
                        
                        {/* Add reordering instructions if active */}
                        {(reorderingPositive || reorderingNegative) && (
                          <View style={styles.reorderingInstructionsContainer}>
                            <Text style={styles.reorderingInstructions}>
                              <Ionicons name="information-circle" size={14} color="#70a1ff" /> 拖动标签调整顺序，前面的提示词权重更高
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Open tag selector button */}
                      <TouchableOpacity 
                        style={[
                          styles.openTagSelectorButton,
                          (reorderingPositive || reorderingNegative) && styles.disabledButton
                        ]}
                        onPress={() => setTagSelectorVisible(true)}
                        disabled={reorderingPositive || reorderingNegative}
                      >
                        <Ionicons name="pricetag-outline" size={20} color="#fff" />
                        <Text style={styles.openTagSelectorText}>浏览标签并添加</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                
                {/* Generate button */}
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
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                    <Text style={styles.loadingText}>正在生成图像，这可能需要几分钟...</Text>
                  </View>
                )}
                
                {/* Error message */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#FF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </>
            )}
            
            {/* Add some bottom padding for better scrolling */}
            <View style={styles.bottomPadding} />
          </ScrollView>
          
          {/* Tag selector modal */}
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
                    // Just add the tag to existing ones, don't replace everything
                    if (!positiveTags.includes(tag)) {
                      setPositiveTags(prev => [...prev, tag]);
                    }
                  }}
                  onAddNegative={(tag) => {
                    // Just add the tag to existing ones, don't replace everything
                    if (!negativeTags.includes(tag)) {
                      setNegativeTags(prev => [...prev, tag]);
                    }
                  }}
                  existingPositiveTags={positiveTags}
                  existingNegativeTags={negativeTags}
                  // Fix the infinite logging by using a wrapper function that doesn't log
                  onPositiveTagsChange={(tags) => {
                    // Update tags silently without logging
                    if (JSON.stringify(tags) !== JSON.stringify(positiveTags)) {
                      setPositiveTags(tags);
                    }
                  }}
                  onNegativeTagsChange={(tags) => {
                    // Update tags silently without logging
                    if (JSON.stringify(tags) !== JSON.stringify(negativeTags)) {
                      setNegativeTags(tags);
                    }
                  }}
                  sidebarWidth={70} // Reduced from 80 to make sidebar narrower
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
  },
  bottomPadding: {
    height: 60, // Additional padding at the bottom for better scrolling
  },
  characterInfoSection: {
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionDescription: {
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  tagSelectionSection: {
    marginBottom: 20,
  },
  tagSummaryContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  tagSectionTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 40,
    marginBottom: 12,
    paddingHorizontal: 4, // Add horizontal padding to prevent edge issues
  },
  tagsContainerReordering: {
    minHeight: 100, // Increase minimum height when reordering
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Add subtle background to highlight area
    borderRadius: 8,
    paddingVertical: 12, // Add more vertical padding
    paddingHorizontal: 8, // Add more horizontal padding
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16, // Add more margin at the bottom
  },
  selectedPositiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 224, 195, 0.8)',
    borderRadius: 16,
    paddingVertical: 6, // Increased from 4
    paddingHorizontal: 10, // Increased from 8
    marginRight: 10, // Increased from 8
    marginBottom: 10, // Increased from 8
  },
  selectedNegativeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.8)',
    borderRadius: 16,
    paddingVertical: 6, // Increased from 4
    paddingHorizontal: 10, // Increased from 8
    marginRight: 10, // Increased from 8
    marginBottom: 10, // Increased from 8
  },
  tagText: {
    color: '#000',
    fontSize: 14, // Increased from 12
    marginRight: 6, // Increased from 4
  },
  negativeTagText: {
    color: '#fff',
    fontSize: 14, // Increased from 12
    marginRight: 6, // Increased from 4
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
    marginBottom: 20,
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
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  generateButtonText: {
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
    marginBottom: 10, // Reduced margin to accommodate both options
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
  // Simplified artist prompt UI
  artistPromptContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
  // Tag selector modal styles
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
    // Add status bar height adjustment for iOS
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
    // Adjust for iOS status bar
    top: Platform.OS === 'ios' ? 44 : 16,
    padding: 4,
  },
  tagSelectorContent: {
    flex: 1, // This ensures the TagSelector fills the available space
  },
  // Add new styles for custom prompt and artist reference
  customPromptContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  customPromptNote: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  artistReferenceContainer: {
    marginBottom: 16,
  },
  artistReferenceTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagSection: {
    marginBottom: 16,
  },
  // New styles for draggable tags
  draggableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10, // Increased from 8
    marginBottom: 10, // Increased from 8
  },
  dragHandle: {
    marginRight: 6, // Increased from 4
    padding: 2, // Add some padding to make it easier to grab
  },
  tagRemoveButton: {
    padding: 4, // Add padding to make it easier to tap
  },
  reorderingInstructionsContainer: {
    backgroundColor: 'rgba(112, 161, 255, 0.1)', // Light blue background
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  reorderingInstructions: {
    color: '#70a1ff',
    fontSize: 13, // Increased from 12
    fontWeight: '500', // Added font weight to make it more visible
    textAlign: 'center',
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10, // Increased from 8
    paddingVertical: 6, // Increased from 4
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 13, // Increased from 12
    marginLeft: 6, // Increased from 4
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#666',
  },
});

export default ImageRegenerationModal;
