import { SimpleContext, getFileData, dataURLToBuffer } from './simple-context';
import axios from 'axios';

// Import arrayBufferToBase64 from simple-context (where it's defined) and re-export it
import { arrayBufferToBase64 } from './simple-context';
export { arrayBufferToBase64 };  // Re-export for other modules

// 模拟简易版的图像大小获取函数
export function getImageSize(buffer: ArrayBuffer): { width: number, height: number } {
  // React Native环境下，创建一个Image对象来获取尺寸
  // 注意：这只是一个模拟实现，实际上不会立即工作，因为图像加载是异步的
  return { width: 512, height: 512 }; // 返回默认值
}

export interface Dict<T> {
  [key: string]: T;
}

export function project(object: { [key: string]: any }, mapping: { [key: string]: string }) {
  const result: { [key: string]: any } = {}
  for (const key in mapping) {
    result[key] = object[mapping[key]]
  }
  return result
}

export interface Size {
  width: number
  height: number
}

const MAX_OUTPUT_SIZE = 1048576;
const MAX_CONTENT_SIZE = 10485760;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

export interface ImageData {
  buffer: ArrayBuffer;
  base64: string;
  dataUrl: string;
}

export async function download(ctx: SimpleContext, url: string, headers = {}): Promise<ImageData> {
  if (url.startsWith('data:')) {
    const { buffer, mime } = dataURLToBuffer(url);
    if (!ALLOWED_TYPES.includes(mime)) {
      throw new NetworkError('.unsupported-file-type');
    }
    const base64 = arrayBufferToBase64(buffer);
    return { 
      buffer: buffer, 
      base64: base64, 
      dataUrl: `data:${mime};base64,${base64}` 
    };
  } else if (url.startsWith('file:')) {
    // 在 React Native 中处理 file:// URL
    try {
      const { mime, data } = await getFileData(url);
      if (!ALLOWED_TYPES.includes(mime)) {
        throw new NetworkError('.unsupported-file-type');
      }
      const base64 = arrayBufferToBase64(data);
      return { 
        buffer: data, 
        base64: base64, 
        dataUrl: `data:${mime};base64,${base64}` 
      };
    } catch (error) {
      console.error("文件处理失败:", error);
      throw new NetworkError('.file-processing-error');
    }
  } else {
    try {
      const response = await ctx.http(url, { 
        responseType: 'arraybuffer',
        headers
      });
      
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      if (contentLength > MAX_CONTENT_SIZE) {
        throw new NetworkError('.file-too-large');
      }
      
      const mimetype = response.headers['content-type'];
      if (!ALLOWED_TYPES.includes(mimetype)) {
        throw new NetworkError('.unsupported-file-type');
      }
      
      const buffer = response.data;
      const base64 = arrayBufferToBase64(buffer);
      return { 
        buffer, 
        base64, 
        dataUrl: `data:${mimetype};base64,${base64}` 
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new NetworkError('.network-error', { message: error.message });
      }
      throw error;
    }
  }
}

// 简化的轻量版认证函数，在React Native环境中可能不支持原加密功能
export async function calcAccessKey(email: string, password: string) {
  // 暂时返回一个模拟的key
  return btoa(`${email}:${password}`).slice(0, 64);
}

export async function calcEncryptionKey(email: string, password: string) {
  // 暂时返回一个模拟的key
  return btoa(`${email}:${password}:enc`).slice(0, 128);
}

export class NetworkError extends Error {
  constructor(message: string, public params = {}) {
    super(message);
  }

  static catch = (mapping: Dict<string>) => (e: any) => {
    if (axios.isAxiosError(e) && e.response) {
      const code = e.response.status;
      for (const key in mapping) {
        if (code === +key) {
          throw new NetworkError(mapping[key]);
        }
      }
    }
    throw e;
  }
}

export async function login(ctx: SimpleContext, config: any): Promise<string> {
  if (config.type === 'token') {
    try {
      await ctx.http(config.apiEndpoint + '/user/subscription', {
        timeout: 30000,
        headers: { authorization: 'Bearer ' + config.token },
      });
      return config.token;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new NetworkError('.invalid-token');
      }
      throw error;
    }
  } else if (config.type === 'login') {
    try {
      // 简化版登录逻辑，没有使用Node特定的加密函数
      const accessKey = await calcAccessKey(config.email, config.password);
      
      const response = await ctx.http(config.apiEndpoint + '/user/login', {
        method: 'POST',
        timeout: 30000,
        data: {
          key: accessKey,
        },
      });
      return response.data.accessToken;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new NetworkError('.invalid-password');
      }
      throw error;
    }
  } else {
    return config.token;
  }
}

export function closestMultiple(num: number, mult = 64) {
  const floor = Math.floor(num / mult) * mult;
  const ceil = Math.ceil(num / mult) * mult;
  const closest = num - floor < ceil - num ? floor : ceil;
  if (Number.isNaN(closest)) return 0;
  return closest <= 0 ? mult : closest;
}

export function resizeInput(size: Size): Size {
  // if width and height produce a valid size, use it
  const { width, height } = size;
  if (width % 64 === 0 && height % 64 === 0 && width * height <= MAX_OUTPUT_SIZE) {
    return { width, height };
  }

  // otherwise, set lower size as 512 and use aspect ratio to the other dimension
  const aspectRatio = width / height;
  if (aspectRatio > 1) {
    const height = 512;
    const width = closestMultiple(height * aspectRatio);
    // check that image is not too large
    if (width * height <= MAX_OUTPUT_SIZE) {
      return { width, height };
    }
  } else {
    const width = 512;
    const height = closestMultiple(width / aspectRatio);
    // check that image is not too large
    if (width * height <= MAX_OUTPUT_SIZE) {
      return { width, height };
    }
  }

  // if that fails set the higher size as 1024 and use aspect ratio to the other dimension
  if (aspectRatio > 1) {
    const width = 1024;
    const height = closestMultiple(width / aspectRatio);
    return { width, height };
  } else {
    const height = 1024;
    const width = closestMultiple(height * aspectRatio);
    return { width, height };
  }
}

export function forceDataPrefix(url: string, mime = 'image/png') {
  if (url.startsWith('data:')) return url;
  return `data:${mime};base64,` + url;
}

export function trimSlash(str: string): string {
  return str.replace(/\/$/, '');
}
