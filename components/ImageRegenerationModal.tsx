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
import CharacterTagSelector from './CharacterTagSelector';
import ArtistReferenceSelector from './ArtistReferenceSelector';
import { DEFAULT_NEGATIVE_PROMPTS, DEFAULT_POSITIVE_PROMPTS } from '@/constants/defaultPrompts';
import { licenseService } from '@/services/license-service';
import tagData from '@/app/data/tag.json';

const IMAGE_SERVICE_BASE_URL = 'https://image.cradleintro.top';

const DEFAULT_GENERATION_SETTINGS = {
  width: 576,
  height: 1024,
  steps: 28,
  batch_size: 1
};

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
    characterTags?: string[];
  };
}

interface TagItem {
  tag: string;
  type: 'positive' | 'negative';
}

// Helper function to identify gender tags
const getGenderTagsFromTagData = () => {
  const genderCategory = tagData.general_categories.find(
    (category: any) => category.name === "性别"
  );
  
  if (!genderCategory || !genderCategory.sub_categories) {
    return { maleGenderTags: [], femaleGenderTags: [] };
  }
  
  const maleGenderTags = genderCategory.sub_categories['男性'] || [];
  const femaleGenderTags = genderCategory.sub_categories['女性'] || [];
  
  return { maleGenderTags, femaleGenderTags };
};

const { maleGenderTags, femaleGenderTags } = getGenderTagsFromTagData();

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
  const [selectedArtistPrompt, setSelectedArtistPrompt] = useState<string | null>(null);
  const [useExistingArtistPrompt, setUseExistingArtistPrompt] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [customPromptModalVisible, setCustomPromptModalVisible] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [licenseLoaded, setLicenseLoaded] = useState(false);
  const [characterTagSelectorVisible, setCharacterTagSelectorVisible] = useState(false);
  const [characterTags, setCharacterTags] = useState<string[]>([]);
  const [artistReferenceSelectorVisible, setArtistReferenceSelectorVisible] = useState(false);
  const [generationSettingsVisible, setGenerationSettingsVisible] = useState(false);
  const [generationSettings, setGenerationSettings] = useState({ ...DEFAULT_GENERATION_SETTINGS });

  useEffect(() => {
    const loadLicense = async () => {
      try {
        if (!licenseService.isInitialized()) {
          await licenseService.initialize();
        }
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

  useEffect(() => {
    if (visible) {
      if (existingImageConfig) {
        setPositiveTags(existingImageConfig.positiveTags || []);
        setNegativeTags(existingImageConfig.negativeTags || []);
        setSelectedArtistPrompt(existingImageConfig.artistPrompt);
        setUseExistingArtistPrompt(!!existingImageConfig.artistPrompt);
        setCustomPrompt(existingImageConfig.customPrompt || '');
        setCharacterTags(existingImageConfig.characterTags || []);
      } else if (character.generationData?.appearanceTags) {
        setPositiveTags(character.generationData.appearanceTags.positive || []);
        setNegativeTags(character.generationData.appearanceTags.negative || []);
        if (character.generationData.appearanceTags.artistPrompt) {
          setSelectedArtistPrompt(character.generationData.appearanceTags.artistPrompt);
          setUseExistingArtistPrompt(true);
        } else {
          setSelectedArtistPrompt(null);
        }
        setCharacterTags([]);
      } else {
        setPositiveTags([]);
        setNegativeTags([]);
        setSelectedArtistPrompt(null);
        setCharacterTags([]);
      }
      setGeneratedImageUrl(null);
      setError(null);
      setIsLoading(false);
      setReplaceBackground(true);
      setReplaceAvatar(false);
      if (!existingImageConfig) {
        setCustomPrompt('');
      }
      setGenerationSettings({ ...DEFAULT_GENERATION_SETTINGS });
    }
  }, [visible, character, existingImageConfig]);

  const handleAddCharacterTag = (tagString: string) => {
    if (!characterTags.includes(tagString)) {
      setCharacterTags(prev => [...prev, tagString]);
    }
  };

  const removeCharacterTag = (tagToRemove: string) => {
    setCharacterTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleAddCustomPrompt = () => {
    if (customPrompt.trim()) {
      const customTag = customPrompt.trim();
      if (!positiveTags.includes(customTag)) {
        setPositiveTags(prev => [...prev, customTag]);
      }
      setCustomPrompt('');
      setCustomPromptModalVisible(false);
    }
  };

  // Helper function to organize tags for prompt building
  const organizeTagsForPrompt = () => {
    // 1. Extract gender tags
    const genderTags = positiveTags.filter(tag => 
      maleGenderTags.includes(tag) || femaleGenderTags.includes(tag)
    );
    
    // 2. Character tags are already separate in characterTags state
    
    // 3. Artist tag is in selectedArtistPrompt state
    
    // 4. Rating tag - always "safe"
    const ratingTag = "safe";
    
    // 5. Normal tags - all positive tags that are not gender tags
    const normalTags = positiveTags.filter(tag => 
      !maleGenderTags.includes(tag) && !femaleGenderTags.includes(tag)
    );

    // 6. Quality tags from DEFAULT_POSITIVE_PROMPTS
    const qualityTags = DEFAULT_POSITIVE_PROMPTS;
    
    return {
      genderTags,
      characterTags,
      artistTag: selectedArtistPrompt && useExistingArtistPrompt ? selectedArtistPrompt : null,
      ratingTag,
      normalTags,
      qualityTags
    };
  };

  // Build the final prompt in the specified order
  const buildFinalPrompt = () => {
    const {
      genderTags,
      characterTags,
      artistTag,
      ratingTag,
      normalTags,
      qualityTags
    } = organizeTagsForPrompt();
    
    // Build the prompt in the specified order
    const promptParts = [
      ...genderTags,               // 1. Gender tags
      ...characterTags,            // 2. Character and work tags
      artistTag,                   // 3. Artist style tag
      ratingTag,                   // 4. Rating tag (always "safe")
      ...normalTags,               // 5. Normal tags + custom prompts
      ...qualityTags               // 6. Quality tags
    ].filter(Boolean); // Remove any null/undefined values
    
    return promptParts.join(',');
  };

  const submitImageGeneration = async () => {
    if ((positiveTags.length === 0 && characterTags.length === 0)) {
      Alert.alert('无法生成', '请至少添加一个正面标签或角色标签来描述角色外观');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the new prompt building function to create properly ordered prompt
      const positivePrompt = buildFinalPrompt();
      
      // Always use default negative prompts
      const negativePrompt = DEFAULT_NEGATIVE_PROMPTS.join(',');

      console.log(`[图片重生成] 正在为角色 "${character.name}" 生成新图像`);
      console.log(`[图片重生成] 正向提示词: ${positivePrompt}`);
      console.log(`[图片重生成] 负向提示词: ${negativePrompt} (使用默认负向提示词)`);
      console.log(`[图片重生成] 图像生成设置:`, generationSettings);

      if (!licenseService.isInitialized()) {
        console.log(`[图片重生成] 初始化许可证服务...`);
        await licenseService.initialize();
      }

      const isLicenseValid = await licenseService.hasValidLicense();
      if (!isLicenseValid) {
        console.error(`[图片重生成] 许可证验证失败: 无效的许可证`);
        throw new Error('需要有效的许可证才能生成图像，请先在API设置中激活您的许可证');
      }

      const licenseInfo = await licenseService.getLicenseInfo();
      const userEmail = licenseInfo?.email || licenseInfo?.customerEmail || '';

      const requestData = {
        prompt: positivePrompt,
        negative_prompt: negativePrompt,
        width: generationSettings.width,
        height: generationSettings.height,
        steps: generationSettings.steps,
        batch_size: generationSettings.batch_size,
        email: userEmail
      };

      const licenseHeaders = await licenseService.getLicenseHeaders();

      if (!licenseHeaders || !licenseHeaders['X-License-Key'] || !licenseHeaders['X-Device-ID']) {
        console.error(`[图片重生成] 许可证头信息不完整`);
        throw new Error('许可证信息不完整，请在API设置中重新激活您的许可证');
      }

      console.log(`[图片重生成] 使用许可证密钥: ${licenseHeaders['X-License-Key'].substring(0, 4)}****`);
      console.log(`[图片重生成] 使用设备ID: ${licenseHeaders['X-Device-ID'].substring(0, 4)}****`);
      if (userEmail) console.log(`[图片重生成] 使用用户邮箱: ${userEmail}`);

      const response = await fetch(`${IMAGE_SERVICE_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...licenseHeaders
        },
        body: JSON.stringify(requestData),
      });

      console.log(`[图片重生成] 服务器响应状态: ${response.status}`);

      const responseText = await response.text();
      console.log(`[图片重生成] 原始响应内容: ${responseText}`);

      let data;
      try {
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

      let taskId = '';
      let isSuccess = false;

      if (data.success === true) {
        isSuccess = true;
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
            positive: [...characterTags, ...positiveTags],
            negative: DEFAULT_NEGATIVE_PROMPTS,
          },
          isFavorite: false,
          generationStatus: 'success',
          setAsBackground: replaceBackground,
          isAvatar: false,
          generationConfig: {
            positiveTags: positiveTags,
            negativeTags: negativeTags,
            artistPrompt: selectedArtistPrompt,
            customPrompt: '',
            useCustomPrompt: false,
            characterTags: characterTags
          }
        };
        onSuccess(completedImage);
        onClose();
        return;
      }

      if (isSuccess && taskId) {
        const generationConfig = {
          positiveTags: positiveTags,
          negativeTags: negativeTags,
          artistPrompt: selectedArtistPrompt,
          customPrompt: '',
          useCustomPrompt: false,
          characterTags: characterTags
        };

        const placeholderImage: CharacterImage = {
          id: `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          url: '',
          characterId: character.id,
          createdAt: Date.now(),
          tags: {
            positive: [...characterTags, ...positiveTags],
            negative: DEFAULT_NEGATIVE_PROMPTS,
          },
          isFavorite: false,
          generationTaskId: taskId,
          generationStatus: 'pending',
          generationMessage: '正在生成图像...',
          setAsBackground: replaceBackground,
          isAvatar: false,
          generationConfig: generationConfig,
        };

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
        console.log(`[图片重生成] 检查 #${retries + 1}, 任务: ${taskId}`);

        const licenseHeaders = await licenseService.getLicenseHeaders();

        const headers = {
          'Accept': 'application/json',
          ...(licenseHeaders || {})
        };

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

        const taskData = data.data || {};
        const status = taskData.status || '';

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
                positive: [...characterTags, ...positiveTags],
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
                customPrompt: '',
                useCustomPrompt: false,
                characterTags: characterTags
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
                positive: [...characterTags, ...positiveTags],
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
              positive: [...characterTags, ...positiveTags],
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
              positive: [...characterTags, ...positiveTags],
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

  const renderCharacterTags = () => {
    if (characterTags.length === 0) {
      return (
        <Text style={styles.noTagsText}>未选择角色标签</Text>
      );
    }

    return (
      <View style={styles.tagsContainer}>
        {characterTags.map((tag, index) => (
          <TouchableOpacity
            key={`char-tag-${index}`}
            style={styles.characterTag}
            onPress={() => removeCharacterTag(tag)}
          >
            <Text style={styles.characterTagText}>{tag}</Text>
            <Ionicons 
              name="close-circle" 
              size={14} 
              color="rgba(255,255,255,0.7)" 
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderUnifiedTagDisplay = () => {
    if (positiveTags.length === 0 && negativeTags.length === 0) {
      return (
        <Text style={styles.noTagsText}>未添加任何标签</Text>
      );
    }

    return (
      <View style={styles.unifiedTagsContainer}>
        {positiveTags.map((tag, index) => (
          <TouchableOpacity
            key={`pos-tag-${index}`}
            style={styles.selectedPositiveTag}
            onPress={() => {
              setPositiveTags(tags => tags.filter(t => t !== tag));
            }}
          >
            <Text style={styles.tagText}>{tag}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(0,0,0,0.5)" />
          </TouchableOpacity>
        ))}
        
        {negativeTags.map((tag, index) => (
          <TouchableOpacity
            key={`neg-tag-${index}`}
            style={styles.selectedNegativeTag}
            onPress={() => {
              setNegativeTags(tags => tags.filter(t => t !== tag));
            }}
          >
            <Text style={styles.negativeTagText}>{tag}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderActionButtonsBar = () => {
    return (
      <View style={styles.actionButtonsBar}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setTagSelectorVisible(true)}
        >
          <Ionicons name="pricetag-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>浏览标签</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setCharacterTagSelectorVisible(true)}
        >
          <Ionicons name="person-add-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>角色标签</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setArtistReferenceSelectorVisible(true)}
        >
          <Ionicons name="color-palette-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>画风参考</Text>
        </TouchableOpacity>
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
                  onPress={onClose}
                >
                  <Text style={styles.confirmButtonText}>确认</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {!generatedImageUrl && (
              <>
                <View style={styles.tagSelectionSection}>
                  <Text style={styles.sectionTitle}>图像生成选项</Text>
                  
                  <View style={styles.tagSection}>
                    <View style={styles.unifiedTagSummaryContainer}>
                      <View style={styles.tagSectionHeader}>
                        <Text style={styles.tagSectionTitle}>标签</Text>
                      </View>
                      
                      <View style={styles.expandedTagDisplayContainer}>
                        {renderUnifiedTagDisplay()}
                        
                        <View style={styles.tagActionButtonsContainer}>
                          <TouchableOpacity
                            style={styles.tagActionButton}
                            onPress={() => setGenerationSettingsVisible(true)}
                          >
                            <Ionicons name="options-outline" size={16} color="#ddd" />
                            <Text style={styles.tagActionButtonText}>生成设置</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.tagActionButton}
                            onPress={() => setCustomPromptModalVisible(true)}
                          >
                            <Ionicons name="pencil-outline" size={16} color="#ddd" />
                            <Text style={styles.tagActionButtonText}>自定义提示词</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
                
                {characterTags.length > 0 && (
                  <View style={styles.selectedCharacterTagsContainer}>
                    <Text style={styles.tagSectionTitle}>已选角色</Text>
                    {renderCharacterTags()}
                  </View>
                )}
                
                {renderActionButtonsBar()}
                
                <View style={styles.infoContainer}>
                  <Text style={styles.infoText}>
                    注意：提示词优先级已固定为：性别 → 角色 → 画风 → 安全级别 → 普通标签 → 质量词
                  </Text>
                </View>
                
                <View style={styles.buttonContainer}>
                  {!isLoading ? (
                    <TouchableOpacity 
                      style={styles.generateButton}
                      onPress={submitImageGeneration}
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
          
          {/* Artist Reference Selector Modal */}
          <Modal
            visible={artistReferenceSelectorVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setArtistReferenceSelectorVisible(false)}
          >
            <ArtistReferenceSelector 
              selectedGender={(character.gender === 'male' || character.gender === 'female' || character.gender === 'other' ? character.gender : 'female')}
              onSelectArtist={(artistPrompt) => {
                if (artistPrompt) {
                  setSelectedArtistPrompt(artistPrompt);
                  setUseExistingArtistPrompt(true);
                }
                setArtistReferenceSelectorVisible(false);
              }}
              selectedArtistPrompt={selectedArtistPrompt}
            />
          </Modal>
          
          {/* Tag Selector Modal */}
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
          
          {/* Character Tag Selector Modal */}
          <CharacterTagSelector
            visible={characterTagSelectorVisible}
            onClose={() => setCharacterTagSelectorVisible(false)}
            onAddCharacter={handleAddCharacterTag}
          />

          {/* Custom Prompt Modal */}
          <Modal
            visible={customPromptModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setCustomPromptModalVisible(false)}
          >
            <View style={styles.customPromptModalOverlay}>
              <View style={styles.customPromptModalContent}>
                <View style={styles.customPromptModalHeader}>
                  <Text style={styles.customPromptModalTitle}>自定义提示词</Text>
                </View>
                
                <View style={styles.customPromptInputContainer}>
                  <TextInput
                    style={styles.customPromptInput}
                    value={customPrompt}
                    onChangeText={setCustomPrompt}
                    placeholder="输入详细的生成提示词（英文效果更好）"
                    placeholderTextColor="#888"
                    multiline={true}
                    numberOfLines={4}
                  />
                </View>
                
                <View style={styles.customPromptModalActions}>
                  <TouchableOpacity
                    style={styles.customPromptCancelButton}
                    onPress={() => setCustomPromptModalVisible(false)}
                  >
                    <Text style={styles.customPromptCancelButtonText}>取消</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.customPromptConfirmButton,
                      !customPrompt.trim() && styles.disabledButton
                    ]}
                    onPress={handleAddCustomPrompt}
                    disabled={!customPrompt.trim()}
                  >
                    <Text style={styles.customPromptConfirmButtonText}>确认</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Generation Settings Modal */}
          <Modal
            visible={generationSettingsVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setGenerationSettingsVisible(false)}
          >
            <View style={styles.customPromptModalOverlay}>
              <View style={styles.customPromptModalContent}>
                <View style={styles.customPromptModalHeader}>
                  <Text style={styles.customPromptModalTitle}>图像生成设置</Text>
                </View>
                
                <View style={styles.generationSettingsContainer}>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>宽度:</Text>
                    <TextInput
                      style={styles.settingInput}
                      value={String(generationSettings.width)}
                      onChangeText={(text) => {
                        const width = parseInt(text);
                        if (!isNaN(width)) {
                          setGenerationSettings(prev => ({ ...prev, width }));
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                  
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>高度:</Text>
                    <TextInput
                      style={styles.settingInput}
                      value={String(generationSettings.height)}
                      onChangeText={(text) => {
                        const height = parseInt(text);
                        if (!isNaN(height)) {
                          setGenerationSettings(prev => ({ ...prev, height }));
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                  
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>步数:</Text>
                    <TextInput
                      style={styles.settingInput}
                      value={String(generationSettings.steps)}
                      onChangeText={(text) => {
                        const steps = parseInt(text);
                        if (!isNaN(steps)) {
                          setGenerationSettings(prev => ({ ...prev, steps }));
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                  </View>
                  
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>批次:</Text>
                    <TextInput
                      style={styles.settingInput}
                      value={String(generationSettings.batch_size)}
                      onChangeText={(text) => {
                        const batch_size = parseInt(text);
                        if (!isNaN(batch_size) && batch_size > 0 && batch_size <= 4) {
                          setGenerationSettings(prev => ({ ...prev, batch_size }));
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={1}
                    />
                  </View>

                  <Text style={styles.settingNote}>
                    注意: 过高的参数会消耗更多积分，步数推荐20~30，批次最高为4
                  </Text>
                </View>
                
                <View style={styles.customPromptModalActions}>
                  <TouchableOpacity
                    style={styles.customPromptCancelButton}
                    onPress={() => {
                      setGenerationSettings({ ...DEFAULT_GENERATION_SETTINGS });
                      setGenerationSettingsVisible(false);
                    }}
                  >
                    <Text style={styles.customPromptCancelButtonText}>重置</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.customPromptConfirmButton}
                    onPress={() => setGenerationSettingsVisible(false)}
                  >
                    <Text style={styles.customPromptConfirmButtonText}>确认</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  infoContainer: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  infoText: {
    color: '#70A1FF',
    fontSize: 13,
    textAlign: 'center',
  },
  
  // Add all the other styles
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
    minHeight: 120,
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
    textAlign: 'center',
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
  characterTagsContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  characterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 149, 237, 0.8)',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  characterTagText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 6,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 149, 237, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addTagButtonText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  disabledModeText: {
    color: '#888',
    fontStyle: 'italic',
    padding: 8,
  },
  unifiedTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 4,
    minHeight: 30,
    marginBottom: 8,
  },
  unifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  unifiedTagSummaryContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  actionButtonsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
    fontSize: 13,
  },
  tagTypeLabel: {
    color: '#ddd',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  selectedCharacterTagsContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  expandedTagDisplayContainer: {
    minHeight: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  tagActionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
  },
  tagActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 16,
  },
  tagActionButtonText: {
    color: '#ddd',
    marginLeft: 6,
    fontSize: 12,
  },
  customPromptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  customPromptModalContent: {
    width: '100%',
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    maxWidth: 500,
  },
  customPromptModalHeader: {
    marginBottom: 16,
  },
  customPromptModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  customPromptModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  customPromptCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(80, 80, 80, 0.8)',
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  customPromptCancelButtonText: {
    color: '#ddd',
    fontWeight: '500',
  },
  customPromptConfirmButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  customPromptConfirmButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  generationSettingsContainer: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  settingInput: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    width: '60%',
    textAlign: 'center',
  },
  settingNote: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ImageRegenerationModal;
