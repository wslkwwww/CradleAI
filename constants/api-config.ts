/**
 * API配置常量
 * 存储应用程序使用的所有API端点
 */

// 获取环境变量或使用默认值
const getEnvVar = (key: string, defaultValue: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  
  // React Native 环境
  if (typeof global !== 'undefined' && (global as any).__ENV && (global as any).__ENV[key]) {
    return (global as any).__ENV[key];
  }
  
  return defaultValue;
};

export const API_CONFIG = {
  // 图像生成服务
  IMAGE_GENERATION_URL: getEnvVar('IMAGE_GENERATION_URL', 'https://image.cradleintro.top/'),
  // License API endpoints - primary and fallbacks
  LICENSE_API_URL: getEnvVar('LICENSE_API_URL', 'https://cradleintro.top/api/v1/license/verify'),
  LICENSE_API_FALLBACKS: [
    'http://cradleintro.top/api/v1/license/verify',       // HTTP fallback
    'https://cradleintro.top:443/api/v1/license/verify',  // Explicit HTTPS port (matching curl)
    'https://cradleintro.top:5000/api/v1/license/verify', // Direct HTTPS port
    'http://cradleintro.top:5000/api/v1/license/verify',  // Direct HTTP port
    'https://172.67.219.110/api/v1/license/verify',       // Direct IP from curl
    'https://104.21.70.37/api/v1/license/verify',         // Alternate IP from curl
  ],
  // Base domain for connectivity testing
  LICENSE_SERVER_DOMAIN: 'cradleintro.top',
};
