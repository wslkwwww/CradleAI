import { Character } from '@/shared/types';
import { StorageAdapter } from '@/NodeST/nodest/utils/storage-adapter';
import { DEFAULT_NEGATIVE_PROMPTS, DEFAULT_POSITIVE_PROMPTS } from '@/constants/defaultPrompts';
import NovelAIService from '@/components/NovelAIService';
import ImageManager from '@/utils/ImageManager';
import { getApiSettings } from '@/utils/settings-helper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedGenerateContent } from '@/services/unified-api';

export interface NovelAIGenerationConfig {
  seed?: number;
  positiveTags: string[];
  negativeTags: string[];
  sizePreset?: { width: number; height: number };
  model: string;
  steps: number;
  scale: number;
  sampler: string;
  noiseSchedule: string;
  characterPrompts: { prompt: string; positions: { x: number; y: number }[] }[];
  useCoords: boolean;
  useOrder: boolean;
}

export interface GenerationResult {
  success: boolean;
  imageId?: string; // Changed from imageUrl to imageId
  error?: string;
}

export class InputImagen {
  /**
   * Get NovelAI generation configuration from character
   */
  static getNovelAIConfig(character: Character): NovelAIGenerationConfig {
    // Default config
    const defaultConfig: NovelAIGenerationConfig = {
      positiveTags: [...DEFAULT_POSITIVE_PROMPTS],
      negativeTags: [...DEFAULT_NEGATIVE_PROMPTS],
      sizePreset: { width: 832, height: 1216 },
      model: 'NAI Diffusion V4 Curated',
      steps: 28,
      scale: 5,
      sampler: 'k_euler_ancestral',
      noiseSchedule: 'karras',
      characterPrompts: [],
      useCoords: false,
      useOrder: true
    };

    if (!character || !character.backgroundImageConfig) {
      return defaultConfig;
    }

    // Get NovelAI settings from character
    const novelaiConfig = character.backgroundImageConfig?.novelaiSettings || {};
    
    // Handle seed value
    let seed: number | undefined;
    if (
      character.backgroundImageConfig?.seed !== undefined &&
      character.backgroundImageConfig?.seed !== null &&
      character.backgroundImageConfig?.seed !== ''
    ) {
      seed = Number(character.backgroundImageConfig.seed);
    } else if (
      novelaiConfig.seed !== undefined &&
      novelaiConfig.seed !== null &&
      novelaiConfig.seed !== ''
    ) {
      seed = Number(novelaiConfig.seed);
    } else {
      seed = Math.floor(Math.random() * 2 ** 32);
    }

    // Merge tags
    const positiveTags = [
      ...(character.backgroundImageConfig?.genderTags || []),
      ...(character.backgroundImageConfig?.characterTags || []),
      ...(character.backgroundImageConfig?.qualityTags || []),
      ...(character.backgroundImageConfig?.positiveTags || []),
      ...DEFAULT_POSITIVE_PROMPTS
    ].filter(Boolean);

    const negativeTags = [
      ...DEFAULT_NEGATIVE_PROMPTS,
      ...(character.backgroundImageConfig?.negativeTags || [])
    ].filter(Boolean);

    // Add character prompts
    let characterPrompts: { prompt: string; positions: { x: number; y: number }[] }[] = [];
    if (character.backgroundImageConfig?.characterTags && character.backgroundImageConfig.characterTags.length > 0) {
      characterPrompts = [
        {
          prompt: character.backgroundImageConfig.characterTags.join(', '),
          positions: [{ x: 0, y: 0 }]
        }
      ];
    }

    // Size settings
    const sizePreset = character.backgroundImageConfig?.sizePreset || { width: 832, height: 1216 };

    return {
      seed,
      positiveTags,
      negativeTags,
      characterPrompts,
      model: novelaiConfig.model || 'NAI Diffusion V4 Curated',
      steps: novelaiConfig.steps || 28,
      scale: novelaiConfig.scale || 5,
      sampler: novelaiConfig.sampler || 'k_euler_ancestral',
      noiseSchedule: novelaiConfig.noiseSchedule || 'karras',
      sizePreset,
      useCoords: typeof novelaiConfig.useCoords === 'boolean' ? novelaiConfig.useCoords : false,
      useOrder: typeof novelaiConfig.useOrder === 'boolean' ? novelaiConfig.useOrder : true
    };
  }

  /**
   * Generate a scene description from the last bot message
   * Now uses the imagegen_prompt_config from UtilSettings and unified-api
   */
  static async generateSceneDescription(characterId: string): Promise<string> {
    try {
      // Get recent conversation context (last 10 messages)
      const contextMessages = await StorageAdapter.exportConversation(characterId);
      const recentMessages = contextMessages.slice(-10);

      if (recentMessages.length === 0) {
        return '';
      }

      // 读取UtilSettings中图像生成提示词配置
      const savedConfigStr = await AsyncStorage.getItem('imagegen_prompt_config');
      if (!savedConfigStr) {
        console.warn('[InputImagen] 未找到图像生成提示词配置');
        return '';
      }
      const savedConfig = JSON.parse(savedConfigStr);

      // 获取消息数组和inputText
      let { messageArray, inputText, adapterType } = savedConfig || {};
      if (!Array.isArray(messageArray) || messageArray.length === 0 || !inputText) {
        console.warn('[InputImagen] 图像生成提示词配置不完整');
        return '';
      }

      // 用recentMessages填充inputText变量（如有[recentMessages]或recentMessages变量）
      // 这里假定inputText中包含"recentMessages"变量，直接替换
      const recentMessagesStr = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
      const inputTextWithRecent = inputText.replace(/\[?recentMessages\]?/gi, recentMessagesStr);

      // 重新构建消息数组，将inputTextWithRecent作为第一个用户消息
      // 其余消息结构保持不变（如preset、worldbook等）
      // 只替换第一个user消息的内容
      let patchedMessageArray = messageArray.map((msg: any, idx: number) => {
        if (idx === 0 && msg.role === 'user') {
          if ('content' in msg) {
            return { ...msg, content: inputTextWithRecent };
          } else if ('parts' in msg) {
            return { ...msg, parts: [{ text: inputTextWithRecent }] };
          }
        }
        return msg;
      });

      // 获取API设置
      const apiSettings = getApiSettings();
      const options = {
        ...apiSettings,
        adapter: adapterType || apiSettings.apiProvider || 'gemini'
      };

      // 调用unified-api生成内容
      const result = await unifiedGenerateContent(patchedMessageArray, options);
      return (result || '').replace(/[\r\n]+/g, ' ').trim();
    } catch (error) {
      console.error('[InputImagen] Error generating scene description:', error);
      return '';
    }
  }

  /**
   * Generate an image using NovelAI with the provided parameters
   */
  static async generateImage(
    token: string,
    config: NovelAIGenerationConfig,
    customPrompt: string = '',
    customSeed?: number
  ): Promise<GenerationResult> {
    try {
      console.log('[InputImagen] Starting image generation with config:', {
        model: config.model,
        width: config.sizePreset?.width ?? 832, 
        height: config.sizePreset?.height ?? 1216,
        steps: config.steps, 
        scale: config.scale,
        sampler: config.sampler,
        seed: customSeed || config.seed,
        noiseSchedule: config.noiseSchedule,
        hasCharacterPrompts: config.characterPrompts?.length > 0,
        useCoords: config.useCoords,
        useOrder: config.useOrder
      });

      // Create the positive prompt combining all tags
      let positivePromptText = config.positiveTags.join(', ');
      if (customPrompt && customPrompt.trim()) {
        positivePromptText = positivePromptText + ', ' + customPrompt.trim();
      }

      // Create negative prompt
      const negativePromptText = config.negativeTags.join(', ');
      
      // Generate the image using NovelAIService
      const result = await NovelAIService.generateImage({
        token,
        prompt: positivePromptText,
        characterPrompts: config.characterPrompts?.length ? config.characterPrompts : undefined,
        negativePrompt: negativePromptText,
        model: config.model,
        width: config.sizePreset?.width ?? 832, 
        height: config.sizePreset?.height ?? 1216,
        steps: config.steps,
        scale: config.scale,
        sampler: config.sampler,
        seed: customSeed || config.seed,
        noiseSchedule: config.noiseSchedule,
        useCoords: config.useCoords,
        useOrder: config.useOrder
      });

      // 只处理本地PNG文件路径，不处理base64
      if (result && result.imageUrls) {
        const imagePath = result.imageUrls[0];
        if (typeof imagePath === 'string' && imagePath.startsWith('file://')) {
          console.log('[InputImagen] NovelAI returned local PNG file, caching image file...');
          const cacheResult = await ImageManager.cacheImageFile(
            imagePath,
            'image/png'
          );
          return {
            success: true,
            imageId: cacheResult.id
          };
        } else {
          return {
            success: false,
            error: 'NovelAI返回的不是本地PNG文件路径，无法缓存'
          };
        }
      } else {
        return {
          success: false,
          error: 'No image data returned from NovelAI'
        };
      }
    } catch (error: any) {
      console.error('[InputImagen] Error generating image:', error);
      
      // Check for 429 error and provide specific message
      if (error.message && typeof error.message === 'string' && error.message.includes('429')) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait before generating another image (Error 429)'
        };
      }
      
      return {
        success: false,
        error: error?.message || 'Unknown error generating image'
      };
    }
  }
}

export default InputImagen;
