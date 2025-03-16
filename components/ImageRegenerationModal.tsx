import React, { useState, useEffect } from 'react';
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
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

const ImageRegenerationModal: React.FC<ImageRegenerationModalProps> = ({
  visible,
  character,
  onClose,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [positiveTags, setPositiveTags] = useState<string[]>([]);
  const [negativeTags, setNegativeTags] = useState<string[]>([]);
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);
  const [replaceBackground, setReplaceBackground] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Add state for artist reference
  const [selectedArtistPrompt, setSelectedArtistPrompt] = useState<string | null>(null);
  const [useExistingArtistPrompt, setUseExistingArtistPrompt] = useState(true);
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      // If the character already has tags from previous generation, use them as defaults
      if (character.generationData?.appearanceTags) {
        // Use existing positive tags but exclude artist prompts
        const filteredPositiveTags = character.generationData.appearanceTags.positive?.filter(tag => 
          !tag.includes('artist:') && !tag.includes('artist(') && !tag.startsWith('artist')
        ) || [];
        
        setPositiveTags(filteredPositiveTags);
        setNegativeTags(character.generationData.appearanceTags.negative || []);
        
        // Get artist prompt from character if available
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
    }
  }, [visible, character]);
  
  // Submit image generation request
  const submitImageGeneration = async () => {
    if (positiveTags.length === 0) {
      Alert.alert('无法生成', '请至少添加一个正面标签来描述角色外观');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
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
      
      // Combine negative tags with default negative prompts
      const finalNegativeTags = [...negativeTags, ...DEFAULT_NEGATIVE_PROMPTS];
      
      const positivePrompt = finalPositiveTags.join(', ');
      const negativePrompt = finalNegativeTags.join(', ');
      
      console.log(`[图片重生成] 正在为角色 "${character.name}" 生成新图像`);
      console.log(`[图片重生成] 正向提示词: ${positivePrompt}`);
      console.log(`[图片重生成] 负向提示词: ${negativePrompt} (包含默认负向提示词)`);
      
      // 构建请求参数
      const requestData = {
        prompt: positivePrompt,
        negative_prompt: negativePrompt,
        model: 'nai-v4-full', // 默认使用NAI动漫v4完整版
        sampler: 'k_euler_ancestral',
        steps: 28,
        scale: 11,
        resolution: 'portrait', // 竖图，适合角色卡
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
      
      // 获取任务ID并等待结果
      const taskId = data.task_id;
      console.log(`[图片重生成] 已提交任务，ID: ${taskId}`);
      
      // 开始轮询任务状态
      await waitForGenerationResult(taskId);
      
    } catch (error) {
      console.error('[图片重生成] 生成失败:', error);
      setError(error instanceof Error ? error.message : '生成图像失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Wait for generation task to complete with exponential backoff
  const waitForGenerationResult = async (taskId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // Maximum number of attempts (10 minutes total with backoff)
    
    while (attempts < maxAttempts) {
      try {
        // Calculate backoff time - starts at 5s and increases
        const backoffTime = Math.min(5000 * Math.pow(1.2, attempts), 20000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        console.log(`[图片重生成] 检查任务状态 (尝试 ${attempts + 1}/${maxAttempts})...`);
        
        // Request status from server
        const statusResponse = await fetch(`http://152.69.219.182:5000/task_status/${taskId}`);
        if (!statusResponse.ok) {
          throw new Error(`获取任务状态失败: HTTP ${statusResponse.status}`);
        }
        
        const statusData = await statusResponse.json();
        
        // If task is complete
        if (statusData.done) {
          if (statusData.success && statusData.image_url) {
            console.log(`[图片重生成] 图像生成成功: ${statusData.image_url}`);
            setGeneratedImageUrl(statusData.image_url);
            
            // Download image and save locally
            const localImageUri = await downloadAndSaveImage(
              statusData.image_url,
              character.id,
              'avatar'
            );
            
            // Create image record
            const newImage: CharacterImage = {
              id: `img_${Date.now()}`,
              url: statusData.image_url,
              localUri: localImageUri || statusData.image_url,
              createdAt: Date.now(),
              characterId: character.id,
              tags: {
                positive: positiveTags,
                negative: negativeTags
              },
              isFavorite: false
            };
            
            // Pass to parent component
            onSuccess(newImage);
            return;
            
          } else {
            throw new Error(statusData.error || '图像生成失败');
          }
        } 
        // Task is still in progress
        else if (statusData.queue_info) {
          console.log(`[图片重生成] 仍在队列中: 位置 ${statusData.queue_info.position}, 预计等待 ${Math.round(statusData.queue_info.estimated_wait / 60)} 分钟`);
        }
        
        attempts++;
      } catch (error) {
        console.error('[图片重生成] 检查任务状态出错:', error);
        attempts++;
        
        // If we've exhausted all attempts, set the error
        if (attempts >= maxAttempts) {
          setError('图像生成超时，请稍后再试');
        }
      }
    }
  };
  
  // Handle confirming and saving the generated image
  const handleConfirm = () => {
    onClose();
  };
  
  // Add a function to toggle artist reference usage
  const toggleArtistPromptUsage = (value: boolean) => {
    setUseExistingArtistPrompt(value);
    console.log(`[图片重生成] ${value ? '启用' : '禁用'}画师风格提示词`);
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
            
            {/* Tag selection */}
            {!generatedImageUrl && (
              <>
                <View style={styles.tagSelectionSection}>
                  <Text style={styles.sectionTitle}>外观标签</Text>
                  <Text style={styles.sectionDescription}>
                    请选择描述角色外观的正面和负面标签，以指导图像生成
                  </Text>
                  
                  {/* Add Artist reference option if available - simplified UI */}
                  {selectedArtistPrompt && (
                    <View style={styles.artistPromptContainer}>
                      <View style={styles.artistPromptHeader}>
                        <Text style={styles.artistPromptTitle}>画风参考</Text>
                        <Switch
                          value={useExistingArtistPrompt}
                          onValueChange={toggleArtistPromptUsage}
                          trackColor={{ false: '#767577', true: '#bfe8ff' }}
                          thumbColor={useExistingArtistPrompt ? '#007bff' : '#f4f3f4'}
                        />
                      </View>

                      {useExistingArtistPrompt && (
                        <View style={styles.artistPromptContent}>
                          <Text style={styles.artistPromptNote}>
                            使用与角色原始生成相同的画风可以保持一致的视觉风格
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* Tag summary */}
                  <View style={styles.tagSummaryContainer}>
                    <Text style={styles.tagSectionTitle}>正面标签</Text>
                    <View style={styles.tagsContainer}>
                      {positiveTags.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {positiveTags.map((tag, index) => (
                            <TouchableOpacity
                              key={`pos-${index}`}
                              style={styles.selectedPositiveTag}
                              onPress={() => {
                                setPositiveTags(tags => tags.filter(t => t !== tag));
                              }}
                            >
                              <Text style={styles.tagText}>{tag}</Text>
                              <Ionicons name="close-circle" size={14} color="rgba(0,0,0,0.5)" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={styles.noTagsText}>未选择正面标签</Text>
                      )}
                    </View>
                    
                    <Text style={styles.tagSectionTitle}>负面标签</Text>
                    <View style={styles.tagsContainer}>
                      {negativeTags.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {negativeTags.map((tag, index) => (
                            <TouchableOpacity
                              key={`neg-${index}`}
                              style={styles.selectedNegativeTag}
                              onPress={() => {
                                setNegativeTags(tags => tags.filter(t => t !== tag));
                              }}
                            >
                              <Text style={styles.negativeTagText}>{tag}</Text>
                              <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={styles.noTagsText}>未选择负面标签</Text>
                      )}
                    </View>
                    
                    <Text style={styles.defaultTagsInfo}>
                      系统已添加默认的负面标签，以避免常见生成问题
                    </Text>
                  </View>
                  
                  {/* Open tag selector button */}
                  <TouchableOpacity 
                    style={styles.openTagSelectorButton}
                    onPress={() => setTagSelectorVisible(true)}
                  >
                    <Ionicons name="pricetag-outline" size={20} color="#fff" />
                    <Text style={styles.openTagSelectorText}>浏览标签并添加</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Generate button */}
                {!isLoading ? (
                  <TouchableOpacity 
                    style={styles.generateButton}
                    onPress={submitImageGeneration}
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
                  onAddPositive={(tag) => setPositiveTags(prev => [...prev, tag])}
                  onAddNegative={(tag) => setNegativeTags(prev => [...prev, tag])}
                  existingPositiveTags={positiveTags}
                  existingNegativeTags={negativeTags}
                  onPositiveTagsChange={setPositiveTags}
                  onNegativeTagsChange={setNegativeTags}
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
    fontSize: 12,
    marginRight: 4,
  },
  negativeTagText: {
    color: '#fff',
    fontSize: 12,
    marginRight: 4,
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
    marginBottom: 20,
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
});

export default ImageRegenerationModal;
