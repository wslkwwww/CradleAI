import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 简单的Context类，替代Koishi的Context
 */
export class SimpleContext {
  baseDir: string;

  constructor(options: { baseDir?: string } = {}) {
    this.baseDir = options.baseDir || process.cwd();
  }

  logger = {
    debug: (...args: any[]) => console.debug('[Debug]', ...args),
    info: (...args: any[]) => console.info('[Info]', ...args),
    warn: (...args: any[]) => console.warn('[Warn]', ...args),
    error: (...args: any[]) => console.error('[Error]', ...args),
  };

  /**
   * 简化的HTTP请求函数，替代Koishi的ctx.http
   */
  async http<T = any>(url: string | AxiosRequestConfig, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      if (typeof url === 'string') {
        // 处理file://协议
        if (url.startsWith('file://')) {
          const filePath = url.slice(7);
          const files = await fs.promises.readdir(filePath);
          return { data: files } as any;
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
export function dataURLToBuffer(dataURL: string): { buffer: Buffer, mime: string } {
  const matches = dataURL.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL');
  }
  
  const mime = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  return { buffer, mime };
}

// 帮助函数，用于将ArrayBuffer转换为base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

// 帮助函数，用于获取文件数据
export async function getFileData(filePath: string): Promise<{ mime: string, data: Buffer }> {
  const data = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let mime = 'application/octet-stream';
  
  if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
  else if (ext === '.png') mime = 'image/png';
  else if (ext === '.gif') mime = 'image/gif';
  else if (ext === '.webp') mime = 'image/webp';
  
  return { mime, data };
}
