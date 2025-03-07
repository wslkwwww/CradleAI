import { SimpleContext, arrayBufferToBase64, getFileData, dataURLToBuffer } from './simple-context';
import { 
  crypto_generichash, 
  crypto_pwhash,
  crypto_pwhash_ALG_ARGON2ID13, 
  crypto_pwhash_SALTBYTES, 
  ready 
} from 'libsodium-wrappers-sumo';
import axios from 'axios';
import imageSize from 'image-size';

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

export function getImageSize(buffer: ArrayBuffer): Size {
  if (typeof Buffer !== 'undefined') {
    return imageSize(new Uint8Array(buffer)) as Size;
  }
  
  // 如果在浏览器环境，则创建一个Image对象
  const blob = new Blob([buffer]);
  const image = new Image();
  image.src = URL.createObjectURL(blob);
  return {
    width: image.width,
    height: image.height
  };
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
    const base64 = buffer.toString('base64');
    return { 
      buffer: buffer, 
      base64: base64, 
      dataUrl: `data:${mime};base64,${base64}` 
    };
  } else if (url.startsWith('file:')) {
    const filePath = url.slice(7);
    const { mime, data } = await getFileData(filePath);
    if (!ALLOWED_TYPES.includes(mime)) {
      throw new NetworkError('.unsupported-file-type');
    }
    const base64 = data.toString('base64');
    return { 
      buffer: data, 
      base64: base64, 
      dataUrl: `data:${mime};base64,${base64}` 
    };
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

export async function calcAccessKey(email: string, password: string) {
  await ready;
  return crypto_pwhash(
    64,
    new Uint8Array(Buffer.from(password)),
    crypto_generichash(
      crypto_pwhash_SALTBYTES,
      password.slice(0, 6) + email + 'novelai_data_access_key',
    ),
    2,
    2e6,
    crypto_pwhash_ALG_ARGON2ID13,
    'base64').slice(0, 64);
}

export async function calcEncryptionKey(email: string, password: string) {
  await ready;
  return crypto_pwhash(
    128,
    new Uint8Array(Buffer.from(password)),
    crypto_generichash(
      crypto_pwhash_SALTBYTES,
      password.slice(0, 6) + email + 'novelai_data_encryption_key'),
    2,
    2e6,
    crypto_pwhash_ALG_ARGON2ID13,
    'base64');
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
  } else if (config.type === 'login' && typeof process !== 'undefined') {
    try {
      const response = await ctx.http(config.apiEndpoint + '/user/login', {
        method: 'POST',
        timeout: 30000,
        data: {
          key: await calcAccessKey(config.email, config.password),
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
