// Debug script for build issues
// 用于诊断构建版本中的应用回到后台问题

// 在应用启动时添加这些调试日志

// 1. 检查应用状态变化
console.log('[DEBUG] App initialization started');

// 2. 监听所有可能导致应用后台的事件
if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => {
    console.log('[DEBUG] Window blur event');
  });
  
  window.addEventListener('focus', () => {
    console.log('[DEBUG] Window focus event');
  });
  
  window.addEventListener('pagehide', () => {
    console.log('[DEBUG] Page hide event');
  });
  
  window.addEventListener('pageshow', () => {
    console.log('[DEBUG] Page show event');
  });
}

// 3. 检查React Navigation状态
export const debugNavigationState = () => {
  console.log('[DEBUG] Navigation state check');
};

// 4. 检查异步操作
export const debugAsyncOperations = () => {
  console.log('[DEBUG] Async operations check');
};

// 5. 检查Native模块
export const debugNativeModules = () => {
  console.log('[DEBUG] Native modules check');
  
  // 检查关键模块是否可用
  const modules = [
    'AsyncStorage',
    'EventRegister', 
    'FileSystem',
    'Video'
  ];
  
  modules.forEach(moduleName => {
    try {
      const module = require(`@react-native-async-storage/async-storage`);
      console.log(`[DEBUG] ${moduleName}: Available`);
    } catch (error) {
      console.log(`[DEBUG] ${moduleName}: Error -`, error.message);
    }
  });
};

export default {
  debugNavigationState,
  debugAsyncOperations,
  debugNativeModules
}; 