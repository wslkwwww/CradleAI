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

// 安全的全局对象访问
const getGlobalObject = (): any => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof global !== 'undefined') return global;
  if (typeof window !== 'undefined') return window;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
};

const globalObj: any = getGlobalObject();

// 安全初始化 polyfills
console.log('[Polyfills] Starting initialization for Matrix SDK compatibility...');

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

// React Native crypto polyfills - 安全初始化
try {
  require('react-native-get-random-values');
  console.log('[Polyfills] ✓ react-native-get-random-values loaded');
} catch (error) {
  console.warn('[Polyfills] Failed to load react-native-get-random-values:', error);
}

// URL polyfill
try {
  require('react-native-url-polyfill/auto');
  console.log('[Polyfills] ✓ react-native-url-polyfill loaded');
} catch (error) {
  console.warn('[Polyfills] Failed to load react-native-url-polyfill:', error);
}

// EventEmitter polyfill for React Native
try {
  const { EventEmitter } = require('events');
  if (!globalObj.EventEmitter) {
    globalObj.EventEmitter = EventEmitter;
    console.log('[Polyfills] ✓ EventEmitter polyfill loaded');
  }
} catch (error) {
  console.warn('[Polyfills] EventEmitter polyfill failed:', error);
}

// 添加TextEncoder/TextDecoder polyfill
try {
  require('text-encoding-polyfill');
  console.log('[Polyfills] ✓ text-encoding-polyfill loaded');
} catch (error) {
  console.warn('[Polyfills] text-encoding-polyfill failed:', error);
}

// Process polyfill - 安全初始化
try {
  if (!globalObj.process) {
    globalObj.process = require('process/browser');
    console.log('[Polyfills] ✓ process polyfill loaded');
  }
} catch (error) {
  console.warn('[Polyfills] Process polyfill failed:', error);
}

// 为Matrix SDK添加必要的Buffer支持
try {
  const { Buffer } = require('buffer');
  if (!globalObj.Buffer) {
    globalObj.Buffer = Buffer;
    console.log('[Polyfills] ✓ Buffer polyfill loaded');
  }
} catch (error) {
  console.warn('[Polyfills] Buffer polyfill failed:', error);
}

// 添加用于ARM64兼容性的额外检查
if (typeof globalObj.btoa === 'undefined') {
  try {
    const { encode } = require('base-64');
    globalObj.btoa = encode;
    console.log('[Polyfills] ✓ btoa polyfill loaded');
  } catch (error) {
    console.warn('[Polyfills] btoa polyfill failed:', error);
  }
}

if (typeof globalObj.atob === 'undefined') {
  try {
    const { decode } = require('base-64');
    globalObj.atob = decode;
    console.log('[Polyfills] ✓ atob polyfill loaded');
  } catch (error) {
    console.warn('[Polyfills] atob polyfill failed:', error);
  }
}

console.log('[Polyfills] Initialization completed');

export {}; // 使文件成为模块 