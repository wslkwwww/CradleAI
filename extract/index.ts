/**
 * NovelAI API 提取库入口文件
 * 
 * 这个文件导出所有公共 API，以便用户可以通过单一入口点访问所有功能。
 */

// 导出主要服务类
export { NovelAIApiService } from './api-service';
export { NovelAIFeatures } from './features';
export { SimpleContext } from './simple-context';
export { HistoryManager } from './history-manager';

// 导出配置和类型定义
export { NovelAIConfig } from './features';
export type { GenerationOptions, EnhanceOptions } from './api-service';
export type { GenerationHistoryItem } from './history-manager';
export type { ImageData } from './utils';

// 导出 API 规范相关类型
export type {
  NovelAIAPI,
  TextToImageParameters,
  ImageToImageParameters,
  ImageEnhancementParameters,
  GenerationResult,
  HistoryItem
} from './api-spec';

// 导出工具函数
export { download, forceDataPrefix, resizeInput } from './utils';

// 导出常量
export { models, sampler, scheduler, orientMap, upscalers, latentUpscalers } from './config';
