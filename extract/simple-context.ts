import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as FileSystem from 'expo-file-system';

/**
 * 简单的Context类，替代Koishi的Context
 */
export class SimpleContext {
  baseDir: string;

  constructor(options: { baseDir?: string } = {}) {
    // 使用 React Native 中的缓存目录作为默认路径
    this.baseDir = options.baseDir || FileSystem.cacheDirectory || '';
  }

  logger = {
    debug: (...args: any[]) => console.debug('[Debug]', ...args),
    info: (...args: any[]) => console.info('[Info]', ...args),
    warn: (...args: any[]) => console.warn('[Warn]', ...args),
    error: (...args: any[]) => console.error('[Error]', ...args),
  };

  /**
   * 简化的HTTP请求函数，替代Koishi的ctx.http
   * 移除了对 file:// 协议的处理，仅支持网络请求
   */
  async http<T = any>(url: string | AxiosRequestConfig, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      if (typeof url === 'string') {
        // 移除对 file:// 协议的支持
        if (url.startsWith('file://')) {
          console.warn('React Native 环境不支持 file:// 协议');
          return { data: [] } as any;
        }
        return await axios(url, options);
      } else {
        return await axios(url);
      }
    } catch (error) {
      // 添加与Koishi类似的错误属性
      if (axios.isAxiosError(error) && error.response) {
        (error as any).response = {
          status: error.response.status,
          data: error.response.data,
        };
      }
      throw error;
    }
  }
}

// 帮助函数，用于从数据URL提取二进制数据
export function dataURLToBuffer(dataURL: string): { buffer: ArrayBuffer, mime: string } {
  const matches = dataURL.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL');
  }
  
  const mime = matches[1];
  // 使用 base64 字符串转换为 ArrayBuffer
  const binaryStr = atob(matches[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  
  return { buffer: bytes.buffer, mime };
}

// 帮助函数，用于将ArrayBuffer转换为base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 为 React Native 环境重新实现的文件函数
// 注意：这在实际应用中可能功能非常有限
export async function getFileData(filePath: string): Promise<{ mime: string, data: ArrayBuffer }> {
  try {
    // 检查文件是否存在
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    // 读取文件内容
    const base64Data = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 根据扩展名确定 MIME 类型
    const ext = filePath.split('.').pop()?.toLowerCase();
    let mime = 'application/octet-stream';
    
    if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    else if (ext === 'png') mime = 'image/png';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'webp') mime = 'image/webp';
    
    // 将 base64 转换为 ArrayBuffer
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    return { mime, data: bytes.buffer };
  } catch (error) {
    console.error('读取文件失败:', error);
    throw error;
  }
}
