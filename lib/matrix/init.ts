// Matrix SDK 安全初始化器 - ARM64兼容性
import '@/lib/polyfills';
import matrixConfig from './config';

console.log('[Matrix Init] Starting safe Matrix SDK initialization for ARM64...');

// 检查环境兼容性
const checkEnvironmentCompatibility = (): boolean => {
  const requiredGlobals = ['Buffer', 'process', 'btoa', 'atob'];
  const missing: string[] = [];
  
  for (const global of requiredGlobals) {
    if (typeof (globalThis as any)[global] === 'undefined') {
      missing.push(global);
    }
  }
  
  if (missing.length > 0) {
    console.warn('[Matrix Init] Missing globals:', missing);
    return false;
  }
  
  return true;
};

// 设置Matrix SDK的错误处理
const setupErrorHandling = () => {
  // 捕获未处理的Promise错误
  if (typeof process !== 'undefined' && process.on) {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Matrix Init] Unhandled Promise Rejection:', reason);
    });
  }
  
  // 设置全局错误处理器
  if (typeof global !== 'undefined') {
    (global as any).matrixErrorHandler = (error: Error) => {
      console.error('[Matrix SDK Error]:', error.message);
      // 可以在这里添加错误上报逻辑
    };
  }
};

// 验证Matrix SDK功能
const validateMatrixSDKFeatures = async (): Promise<boolean> => {
  try {
    // 测试基本的Matrix SDK导入
    const { createClient } = await import('matrix-js-sdk');
    
    if (typeof createClient !== 'function') {
      console.error('[Matrix Init] createClient is not a function');
      return false;
    }
    
    console.log('[Matrix Init] ✓ Matrix SDK basic import successful');
    return true;
  } catch (error) {
    console.error('[Matrix Init] Matrix SDK validation failed:', error);
    return false;
  }
};

// 主初始化函数
export const initializeMatrixSDK = async (): Promise<boolean> => {
  try {
    console.log('[Matrix Init] Checking environment compatibility...');
    if (!checkEnvironmentCompatibility()) {
      console.error('[Matrix Init] Environment compatibility check failed');
      return false;
    }
    
    console.log('[Matrix Init] Setting up error handling...');
    setupErrorHandling();
    
    console.log('[Matrix Init] Validating Matrix SDK features...');
    if (!(await validateMatrixSDKFeatures())) {
      console.error('[Matrix Init] Matrix SDK feature validation failed');
      return false;
    }
    
    console.log('[Matrix Init] ✓ Matrix SDK initialization completed successfully');
    return true;
  } catch (error) {
    console.error('[Matrix Init] Initialization failed:', error);
    return false;
  }
};

// 立即执行初始化检查（但不阻塞）
setTimeout(() => {
  initializeMatrixSDK().then(success => {
    if (success) {
      console.log('[Matrix Init] ✓ Matrix SDK is ready for use');
    } else {
      console.error('[Matrix Init] ✗ Matrix SDK initialization failed - app may crash');
    }
  });
}, 100);

export default matrixConfig; 