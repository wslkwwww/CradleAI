/**
 * NovelAI API 规范
 * 
 * 本文件定义了 NovelAI API 提取库的接口规范，提供给其他应用集成使用。
 */

import { NovelAIConfig } from './features';
import { ImageData } from './types';

/**
 * 文本生成图像的参数
 */
export interface TextToImageParameters {
  /** 正向提示词，描述你想要生成的内容 */
  prompt: string;
  
  /** 负向提示词，描述你不想在图像中出现的内容 */
  negativePrompt?: string;
  
  /** 使用的模型名称 */
  model?: string;
  
  /** 采样器 */
  sampler?: string;
  
  /** 生成步数 */
  steps?: number;
  
  /** 提示词相关性，值越高越遵循提示词 */
  scale?: number;
  
  /** 随机种子，相同种子+参数会产生相似结果 */
  seed?: number;
  
  /** 
   * 图像分辨率
   * 可以是预设值 'portrait', 'landscape', 'square' 
   * 或自定义宽高 { width: number, height: number }
   */
  resolution?: { width: number, height: number } | string;
  
  /** 调度器 */
  scheduler?: string;
  
  /** 批量生成数量 */
  batchSize?: number;
  
  /** 用户ID，用于历史记录管理 */
  userId?: string;
}

/**
 * 图像生成图像的参数
 */
export interface ImageToImageParameters extends TextToImageParameters {
  /** 转换强度，值越低越接近原图 (0.0-1.0) */
  strength?: number;
  
  /** 噪声强度，影响细节的变化程度 (0.0-1.0) */
  noise?: number;
}

/**
 * 图像增强的参数
 */
export interface ImageEnhancementParameters {
  /** 放大倍数 */
  scale?: number;
  
  /** 使用的放大算法 */
  upscaler?: string;
  
  /** 辅助放大算法 */
  upscaler2?: string;
  
  /** 辅助算法可见度 */
  visibility?: number;
  
  /** 是否裁剪图像 */
  crop?: boolean;
  
  /** 用户ID，用于历史记录管理 */
  userId?: string;
}

/**
 * 生成结果
 */
export interface GenerationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 生成的图像URL（成功时提供） */
  imageUrl?: string;
  
  /** 生成参数（成功时提供） */
  parameters?: Record<string, any>;
  
  /** 错误信息（失败时提供） */
  error?: string;
}

/**
 * 历史记录项目
 */
export interface HistoryItem {
  /** 记录ID */
  id: string;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 记录类型 */
  type: 'text2img' | 'img2img' | 'enhance';
  
  /** 正向提示词 */
  prompt: string;
  
  /** 负向提示词 */
  negativePrompt: string;
  
  /** 生成的图像URL */
  imageUrl: string;
  
  /** 生成参数 */
  parameters: Record<string, any>;
  
  /** 用户ID */
  userId?: string;
}

/**
 * NovelAI API 接口定义
 */
export interface NovelAIAPI {
  /**
   * 从文本生成图像
   * @param params 生成参数
   * @returns 生成结果
   */
  generateFromText(params: TextToImageParameters): Promise<GenerationResult>;
  
  /**
   * 从图像生成新图像
   * @param sourceImage 源图像 (URL、Base64或文件路径)
   * @param params 生成参数
   * @returns 生成结果
   */
  generateFromImage(sourceImage: string, params: ImageToImageParameters): Promise<GenerationResult>;
  
  /**
   * 增强图像质量
   * @param sourceImage 源图像 (URL、Base64或文件路径)
   * @param params 增强参数
   * @returns 增强结果
   */
  enhanceImage(sourceImage: string, params: ImageEnhancementParameters): Promise<GenerationResult>;
  
  /**
   * 获取用户历史记录
   * @param userId 用户ID (可选，默认为'anonymous')
   * @param limit 限制返回记录数量 (可选)
   * @returns 历史记录项目数组
   */
  getHistory(userId?: string, limit?: number): HistoryItem[];
  
  /**
   * 获取特定历史记录
   * @param id 记录ID
   * @param userId 用户ID (可选)
   * @returns 历史记录项目，不存在则返回null
   */
  getHistoryItem(id: string, userId?: string): Promise<HistoryItem | null>;
  
  /**
   * 删除历史记录
   * @param id 记录ID
   * @param userId 用户ID (可选)
   * @returns 是否成功删除
   */
  deleteHistoryItem(id: string, userId?: string): Promise<boolean>;
  
  /**
   * 清空用户历史
   * @param userId 用户ID
   */
  clearHistory(userId: string): Promise<void>;
  
  /**
   * 获取可用模型列表
   * @returns 模型名称数组
   */
  getAvailableModels(): string[];
  
  /**
   * 获取可用采样器列表
   * @returns 采样器名称数组
   */
  getAvailableSamplers(): string[];
  
  /**
   * 获取可用调度器列表
   * @returns 调度器名称数组
   */
  getAvailableSchedulers(): string[];
  
  /**
   * 获取预设分辨率
   * @returns 分辨率配置对象
   */
  getAvailableResolutions(): Record<string, { width: number, height: number }>;
}
