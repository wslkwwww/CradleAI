// Matrix SDK加密模块的空实现 - 避免WASM构建问题
console.warn('[Matrix Crypto Stub] Using crypto stub - encryption is disabled');

// 提供Matrix SDK期望的基本接口
export default {};

// 常见的导出函数的空实现
export const initCrypto = () => {
  console.warn('Crypto disabled - initCrypto called');
  return Promise.resolve();
};

export const createCrypto = () => {
  console.warn('Crypto disabled - createCrypto called');
  return null;
};

// Olm相关的空实现
export const Olm = {
  init: () => Promise.resolve(),
};

// 空的类实现
export class OlmMachine {
  constructor() {
    console.warn('Crypto disabled - OlmMachine created as stub');
  }
}

export class RustSdkCryptoJs {
  constructor() {
    console.warn('Crypto disabled - RustSdkCryptoJs created as stub');
  }
}

// 防止出现错误的通用导出
export const wasmPath = '';
export const wasmURL = '';
export const loadWasm = () => Promise.resolve();
export const setupWasm = () => Promise.resolve(); 