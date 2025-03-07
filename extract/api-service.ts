import { SimpleContext } from './simple-context';
import { NovelAIConfig, NovelAIFeatures } from './features';
import { HistoryManager } from './history-manager';

export interface GenerationOptions {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  sampler?: string;
  steps?: number;
  scale?: number;
  seed?: number;
  resolution?: { width: number, height: number } | string;
  scheduler?: string;
  strength?: number;
  noise?: number;
  batchSize?: number;
  userId?: string;
}

export interface EnhanceOptions {
  scale?: number;
  upscaler?: string;
  upscaler2?: string;
  visibility?: number;
  crop?: boolean;
  userId?: string;
}

export class NovelAIApiService {
  private features: NovelAIFeatures;
  private historyManager: HistoryManager;
  
  constructor(private ctx: SimpleContext, private config: NovelAIConfig) {
    this.features = new NovelAIFeatures(ctx, config);
    this.historyManager = new HistoryManager(ctx, {
      maxItems: 50, // 可配置
    });
  }
  
  /**
   * 从文本生成图像
   */
  async generateFromText(options: GenerationOptions) {
    const { prompt, negativePrompt = '', userId, ...genOptions } = options;
    
    // 处理分辨率
    let resolution = genOptions.resolution;
    if (typeof resolution === 'string' && ['portrait', 'landscape', 'square'].includes(resolution)) {
      const orientMap = {
        portrait: { height: 768, width: 512 },
        landscape: { height: 512, width: 768 },
        square: { height: 640, width: 640 },
      };
      resolution = orientMap[resolution as 'portrait' | 'landscape' | 'square'];
    }
    
    const result = await this.features.textToImage(prompt, negativePrompt, {
      ...genOptions,
      resolution: resolution as { width: number, height: number },
    });
    
    if (result.success) {
      // 保存到历史记录
      await this.historyManager.addItem({
        type: 'text2img',
        prompt,
        negativePrompt,
        imageUrl: result.imageUrl,
        parameters: genOptions,
        userId,
      });
    }
    
    return result;
  }
  
  /**
   * 从图像生成新图像
   */
  async generateFromImage(sourceImage: string, options: GenerationOptions) {
    const { prompt, negativePrompt = '', userId, ...genOptions } = options;
    
    // 处理分辨率
    let resolution = genOptions.resolution;
    if (typeof resolution === 'string' && ['portrait', 'landscape', 'square'].includes(resolution)) {
      const orientMap = {
        portrait: { height: 768, width: 512 },
        landscape: { height: 512, width: 768 },
        square: { height: 640, width: 640 },
      };
      resolution = orientMap[resolution as keyof typeof orientMap];
    }
    
    const result = await this.features.imageToImage(sourceImage, prompt, negativePrompt, {
      ...genOptions,
      resolution: resolution as { width: number, height: number },
    });
    
    if (result.success) {
      // 保存到历史记录
      await this.historyManager.addItem({
        type: 'img2img',
        prompt,
        negativePrompt,
        imageUrl: result.imageUrl,
        parameters: genOptions,
        userId,
      });
    }
    
    return result;
  }
  
  /**
   * 增强/放大图像
   */
  async enhanceImage(sourceImage: string, options: EnhanceOptions) {
    const { userId, ...enhanceOptions } = options;
    
    const result = await this.features.enhanceImage(sourceImage, enhanceOptions);
    
    if (result.success) {
      // 保存到历史记录
      await this.historyManager.addItem({
        type: 'enhance',
        prompt: '图像增强',
        negativePrompt: '',
        imageUrl: result.imageUrl,
        parameters: enhanceOptions,
        userId,
      });
    }
    
    return result;
  }
  
  /**
   * 获取用户的生成历史
   */
  getHistory(userId?: string, limit?: number) {
    return this.historyManager.getHistory(userId, limit);
  }
  
  /**
   * 获取特定历史记录项
   */
  getHistoryItem(id: string, userId?: string) {
    return this.historyManager.getItem(id, userId);
  }
  
  /**
   * 删除特定历史记录项
   */
  deleteHistoryItem(id: string, userId?: string) {
    return this.historyManager.deleteItem(id, userId);
  }
  
  /**
   * 清空用户历史
   */
  clearHistory(userId: string) {
    return this.historyManager.clearHistory(userId);
  }
  
  /**
   * 获取可用模型
   */
  getAvailableModels() {
    return this.features.getAvailableModels();
  }
  
  /**
   * 获取可用采样器
   */
  getAvailableSamplers() {
    return this.features.getAvailableSamplers();
  }
  
  /**
   * 获取可用调度器
   */
  getAvailableSchedulers() {
    return this.features.getAvailableSchedulers();
  }
  
  /**
   * 获取可用预设分辨率
   */
  getAvailableResolutions() {
    return this.features.getAvailableResolutions();
  }
}
