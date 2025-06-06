// Matrix SDK配置 - ARM64兼容性

// 禁用Matrix SDK的某些可能导致ARM64问题的功能
const matrixConfig = {
  // 禁用WebRTC相关功能，可能在ARM64上有问题
  useWebRTC: false,
  
  // 使用更保守的同步设置
  syncSettings: {
    initialSyncLimit: 5, // 减少初始同步数量
    lazyLoadMembers: true,
    threadSupport: false, // 暂时禁用线程支持
  },
  
  // 网络设置
  networkSettings: {
    timeout: 30000, // 增加超时时间
    retryDelay: 2000,
    maxRetries: 3,
  },
  
  // 加密设置 - 禁用以避免WASM模块依赖
  cryptoSettings: {
    enableE2E: false, // 完全禁用端到端加密
    disableCrypto: true, // 禁用所有加密功能
  },
  
  // 调试设置
  debug: {
    enableLogging: true,
    logLevel: 'warn', // 减少日志输出
  }
};

// 设置Matrix SDK的全局配置
if (typeof global !== 'undefined') {
  (global as any).matrixConfig = matrixConfig;
}

// 导出配置供其他模块使用
export default matrixConfig; 