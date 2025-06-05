// TypeScript 类型声明
declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: any) => void;
    };
  }
}

// Polyfill for Promise.withResolvers for React Native compatibility
if (!Promise.withResolvers) {
  Promise.withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

// EventEmitter polyfill for React Native
import { EventEmitter } from 'events';

// 确保全局EventEmitter可用
const globalObj = global as any;
if (typeof globalObj !== 'undefined') {
  if (!globalObj.EventEmitter) {
    globalObj.EventEmitter = EventEmitter;
  }
}

// 添加TextEncoder/TextDecoder polyfill
try {
  require('text-encoding-polyfill');
} catch (e) {
  // 如果模块不存在，忽略错误
}

// 为Matrix SDK添加必要的Buffer支持
try {
  const { Buffer } = require('buffer');
  if (typeof globalObj !== 'undefined') {
    globalObj.Buffer = globalObj.Buffer || Buffer;
  }
} catch (e) {
  // 如果模块不存在，忽略错误
}

export {}; // 使文件成为模块 