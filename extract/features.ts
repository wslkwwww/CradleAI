import { SimpleContext } from './simple-context';
import { models, sampler, scheduler, orientMap } from './config';
import { download, NetworkError, forceDataPrefix, trimSlash, login } from './utils';
import { ImageData } from './types';
import { arrayBufferToBase64 } from './simple-context';
/**
 * NovelAI功能配置接口
 */
export interface NovelAIConfig {
  type: 'login' | 'token' | 'naifu' | 'sd-webui' | 'stable-horde' | 'comfyui';
  token?: string;
  email?: string;
  password?: string;
  endpoint?: string;
  apiEndpoint?: string;
  model?: string;
  sampler?: string;
  textSteps?: number;
  imageSteps?: number;
  scale?: number;
  strength?: number;
  noise?: number;
  headers?: Record<string, string>;
  requestTimeout?: number;
  pollInterval?: number;
  trustedWorkers?: boolean;
  nsfw?: 'disallow' | 'censor' | 'allow';
  upscaler?: string;
  smea?: boolean;
  smeaDyn?: boolean;
  scheduler?: string;
  workflowText2Image?: string;
  workflowImage2Image?: string;
}

/**
 * Core Features for NovelAI Integration
 */
export class NovelAIFeatures {
  constructor(private ctx: SimpleContext, private config: NovelAIConfig) {}

  /**
   * Text to Image Generation
   * @param prompt Positive prompt describing desired image
   * @param negativePrompt Optional negative prompt to exclude elements
   * @param options Additional generation options
   * @returns Generated image data URL
   */
  async textToImage(prompt: string, negativePrompt: string = '', options: {
    model?: string,
    sampler?: string,
    steps?: number,
    scale?: number,
    seed?: number,
    resolution?: { width: number, height: number },
    scheduler?: string,
    batchSize?: number,
  } = {}) {
    try {
      // Get authentication token
      const token = (await this.getAuthToken()) || '';
      
      // Prepare generation parameters
      const parameters = this.buildTextToImageParameters(prompt, negativePrompt, options);
      
      // Execute API request based on backend type
      const imageData = await this.executeRequest(token, parameters, false);
      
      return {
        success: true,
        imageUrl: imageData,
        parameters: {
          prompt,
          negativePrompt,
          ...options
        }
      };
    } catch (err) {
      this.ctx.logger.error(err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Image to Image Generation
   * @param sourceImage Source image data (base64 or URL)
   * @param prompt Positive prompt describing desired changes
   * @param negativePrompt Optional negative prompt to exclude elements
   * @param options Additional generation options
   * @returns Generated image data URL
   */
  async imageToImage(sourceImage: string, prompt: string, negativePrompt: string = '', options: {
    model?: string,
    sampler?: string,
    steps?: number,
    scale?: number,
    seed?: number,
    strength?: number,
    noise?: number,
    resolution?: { width: number, height: number },
    scheduler?: string,
  } = {}) {
    try {
      // Get authentication token
      const token = await this.getAuthToken();
      
      // Download and process source image
      let image: ImageData;
      try {
        image = await download(this.ctx, sourceImage);
      } catch (err) {
        if (err instanceof NetworkError) {
          return { success: false, error: err.message };
        }
        throw err;
      }
      
      // Prepare generation parameters with image
      const parameters = this.buildImageToImageParameters(prompt, negativePrompt, image, options);
      
      // Execute API request
      const imageData = await this.executeRequest(token || '', parameters, true);
      
      return {
        success: true,
        imageUrl: imageData,
        parameters: {
          prompt,
          negativePrompt,
          ...options
        }
      };
    } catch (err) {
      this.ctx.logger.error(err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Image Enhancement (Upscale)
   * @param sourceImage Source image to enhance
   * @param options Enhancement options
   * @returns Enhanced image data URL
   */
  async enhanceImage(sourceImage: string, options: {
    scale?: number,
    upscaler?: string,
    upscaler2?: string,
    visibility?: number,
    crop?: boolean,
  } = {}) {
    try {
      if (this.config.type !== 'sd-webui') {
        return { success: false, error: 'Image enhancement is only supported with sd-webui backend' };
      }
      
      // Download and process source image
      let image: ImageData;
      try {
        image = await download(this.ctx, sourceImage);
      } catch (err) {
        if (err instanceof NetworkError) {
          return { success: false, error: err.message };
        }
        throw err;
      }
      
      const payload = {
        image: image.dataUrl,
        resize_mode: 0,
        show_extras_results: true,
        upscaling_resize: options.scale || 2,
        upscaling_crop: options.crop !== false,
        upscaler_1: options.upscaler || this.config.upscaler || 'Lanczos',
        upscaler_2: options.upscaler2 || 'None',
        extras_upscaler_2_visibility: options.visibility || 1,
      };
      
      const endpoint = this.config.endpoint || 'http://localhost:7860';
      const response = await this.ctx.http({
        url: `${endpoint.replace(/\/$/, '')}/sdapi/v1/extra-single-image`,
        method: 'POST',
        timeout: this.config.requestTimeout || 60000,
        headers: {
          ...this.config.headers,
        },
        data: payload,
      });
      
      const data = response.data;
      return {
        success: true,
        imageUrl: data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`,
      };
    } catch (err) {
      this.ctx.logger.error(err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred during enhancement'
      };
    }
  }
  
  /**
   * Get available models based on current backend
   */
  getAvailableModels() {
    switch (this.config.type) {
      case 'login':
      case 'token':
        return models;
      case 'stable-horde':
        try {
          return require('../data/horde-models.json');
        } catch {
          return ['stable_diffusion'];
        }
      case 'sd-webui':
        // For SD-WebUI, we would need to query the API for available models
        return ['stable_diffusion']; // placeholder
      default:
        return models;
    }
  }
  
  /**
   * Get available samplers based on current backend
   */
  getAvailableSamplers() {
    switch (this.config.type) {
      case 'login':
      case 'token':
        return Object.keys(sampler.nai);
      case 'sd-webui':
        return Object.keys(sampler.sd);
      case 'stable-horde':
        return Object.keys(sampler.horde);
      default:
        return Object.keys(sampler.nai);
    }
  }
  
  /**
   * Get available schedulers based on current backend
   */
  getAvailableSchedulers() {
    switch (this.config.type) {
      case 'login':
      case 'token':
        return scheduler.nai;
      case 'sd-webui':
        return scheduler.sd;
      case 'stable-horde':
        return scheduler.horde;
      default:
        return scheduler.nai;
    }
  }
  
  /**
   * Get available preset resolutions
   */
  getAvailableResolutions() {
    return {
      portrait: orientMap.portrait,
      landscape: orientMap.landscape,
      square: orientMap.square
    };
  }

  // Private methods
  
  private async getAuthToken() {
    if (this.config.type === 'token') {
      return this.config.token;
    } else if (this.config.type === 'login') {
      return await login(this.ctx, this.config);
    } else {
      return this.config.token || '';
    }
  }
  
  private buildTextToImageParameters(prompt: string, negativePrompt: string, options: any) {
    const seed = options.seed || Math.floor(Math.random() * Math.pow(2, 32));
    const resolution = options.resolution || orientMap.portrait;
    
    const parameters: Record<string, any> = {
      seed,
      prompt,
      n_samples: options.batchSize || 1,
      uc: negativePrompt,
      ucPreset: 2,
      qualityToggle: false,
      scale: options.scale || this.config.scale || 11,
      steps: options.steps || this.config.textSteps || 28,
      height: resolution.height,
      width: resolution.width,
    };
    
    return parameters;
  }
  
  private buildImageToImageParameters(prompt: string, negativePrompt: string, image: ImageData, options: any) {
    const parameters = this.buildTextToImageParameters(prompt, negativePrompt, options);
    
    // Add image-specific parameters
    parameters.image = image.base64;
    parameters.strength = options.strength || this.config.strength || 0.7;
    parameters.noise = options.noise || this.config.noise || 0.2;
    
    return parameters;
  }
  
  private async executeRequest(token: string, parameters: any, isImageToImage: boolean) {
    // 定义 API 路径基于后端类型
    const path = (() => {
      switch (this.config.type) {
        case 'sd-webui':
          return isImageToImage ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img';
        case 'stable-horde':
          return '/api/v2/generate/async';
        case 'naifu':
          return '/generate-stream';
        default:
          // 修改为正确的图像生成端点
          return '/ai/generate-image';
      }
    })();
    
    // 准备载荷基于后端类型
    const payload = await this.preparePayload(parameters, isImageToImage);
    
    // 准备头部
    const headers = { ...this.config.headers };
    if (['login', 'token', 'naifu'].includes(this.config.type)) {
      headers.Authorization = `Bearer ${token}`;
    } else if (this.config.type === 'stable-horde') {
      headers.apikey = token;
    }
    
    // 执行请求
    let endpoint;
    if (this.config.type === 'token' || this.config.type === 'login') {
      // 对于官方 NovelAI API，使用正确的图像生成端点
      endpoint = this.config.apiEndpoint?.replace('api.novelai.net', 'image.novelai.net') || 'https://image.novelai.net';
    } else {
      endpoint = this.config.endpoint || 'https://api.novelai.net';
    }
    
    this.ctx.logger.debug(`使用端点: ${endpoint}${path}`);
    
    const response = await this.ctx.http({
      url: `${trimSlash(endpoint)}${path}`,
      method: 'POST',
      timeout: this.config.requestTimeout || 60000,
      responseType: this.config.type === 'naifu' ? 'text' : ['login', 'token'].includes(this.config.type) ? 'arraybuffer' : 'json',
      headers,
      data: payload,
    });
    
    return this.processResponse(response);
  }
  
  private async preparePayload(parameters: any, isImageToImage: boolean) {
    // Logic differs based on backend type
    switch (this.config.type) {
      case 'login':
      case 'token':
        return {
          model: parameters.model || this.config.model,
          input: parameters.prompt,
          action: 'generate',
          parameters: {
            ...parameters,
            sampler: parameters.sampler || this.config.sampler,
          },
        };
        
      case 'sd-webui':
        return {
          prompt: parameters.prompt,
          negative_prompt: parameters.uc,
          seed: parameters.seed,
          cfg_scale: parameters.scale,
          steps: parameters.steps,
          width: parameters.width,
          height: parameters.height,
          sampler_index: parameters.sampler || this.config.sampler,
          init_images: isImageToImage ? [parameters.image] : undefined,
          denoising_strength: isImageToImage ? parameters.strength : undefined,
        };
        
      case 'stable-horde':
        return {
          prompt: parameters.prompt,
          params: {
            sampler_name: parameters.sampler || this.config.sampler,
            cfg_scale: parameters.scale,
            seed: parameters.seed.toString(),
            height: parameters.height,
            width: parameters.width,
            steps: parameters.steps,
            n: parameters.n_samples || 1,
          },
          nsfw: this.config.nsfw !== 'disallow',
          trusted_workers: this.config.trustedWorkers,
          models: [parameters.model || this.config.model],
          source_image: isImageToImage ? parameters.image : undefined,
          source_processing: isImageToImage ? 'img2img' : undefined,
        };
        
      default:
        return parameters;
    }
  }
  
  private async processResponse(response: any) {
    // Process response based on backend type
    if (this.config.type === 'sd-webui') {
      const images = response.data.images;
      return images && images.length > 0 
        ? (images[0].startsWith('data:') ? images[0] : `data:image/png;base64,${images[0]}`)
        : null;
    } else if (this.config.type === 'stable-horde') {
      // For Stable Horde we need to poll for completion
      const uuid = response.data.id;

      const pollInterval = this.config.pollInterval || 1000;
      const checkStatus = async () => {
        const statusResponse = await this.ctx.http({
          url: `${this.config.endpoint}/api/v2/generate/check/${uuid}`,
          method: 'GET',
          headers: { apikey: this.config.token || '0000000000' }
        });
        return statusResponse.data?.done || false;
      };

      // 等待生成完成
      let isDone = false;
      while (!isDone) {
        isDone = await checkStatus();
        if (!isDone) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      // 获取结果
      const resultResponse = await this.ctx.http({
        url: `${this.config.endpoint}/api/v2/generate/status/${uuid}`,
        method: 'GET',
        headers: { apikey: this.config.token || '0000000000' }
      });
      
      const imgUrl = resultResponse.data.generations[0].img;
      if (!imgUrl.startsWith('http')) {
        // r2 upload
        return forceDataPrefix(imgUrl, 'image/webp');
      }
      
      const imgResponse = await this.ctx.http(imgUrl, { responseType: 'arraybuffer' });
      const b64 = arrayBufferToBase64(imgResponse.data);
      return forceDataPrefix(b64, imgResponse.headers['content-type']);
    } else if (this.config.type === 'naifu') {
      // 处理naifu的响应
      return forceDataPrefix(response.data?.trimEnd().slice(27));
    } else {
      // NovelAI 官方API返回
      try {
        // 在React Native环境中，无法处理zip格式，这里简化处理
        if (response.headers['content-type'] === 'application/x-zip-compressed' || 
            response.headers['content-disposition']?.includes('.zip')) {
          
          this.ctx.logger.warn('React Native环境中不支持处理ZIP响应格式');
          
          // 直接返回原始数据
          const b64 = arrayBufferToBase64(response.data);
          return forceDataPrefix(b64, 'image/png');
        }
      } catch (error) {
        this.ctx.logger.error('Error processing response:', error);
      }
      
      // 正常的图像数据返回
      return forceDataPrefix(arrayBufferToBase64(response.data), 'image/png');
    }
  }
}
