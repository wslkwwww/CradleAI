// debug-startup.js - 用于调试应用启动问题的脚本

import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class StartupDebugger {
  constructor() {
    this.logs = [];
    this.startTime = Date.now();
  }

  log(message, data = null) {
    const timestamp = Date.now() - this.startTime;
    const logEntry = {
      timestamp,
      message,
      data,
      appState: AppState.currentState
    };
    
    this.logs.push(logEntry);
    console.log(`[StartupDebug ${timestamp}ms] ${message}`, data || '');
  }

  async checkCriticalServices() {
    this.log('开始检查关键服务');
    
    try {
      // 检查 AsyncStorage
      await AsyncStorage.setItem('debug_test', 'test');
      await AsyncStorage.getItem('debug_test');
      await AsyncStorage.removeItem('debug_test');
      this.log('✓ AsyncStorage 正常');
    } catch (error) {
      this.log('✗ AsyncStorage 异常', error.message);
    }

    try {
      // 检查 AppState
      const currentState = AppState.currentState;
      this.log('✓ AppState 正常', currentState);
    } catch (error) {
      this.log('✗ AppState 异常', error.message);
    }

    try {
      // 检查平台信息
      this.log('✓ Platform 信息', {
        OS: Platform.OS,
        Version: Platform.Version,
        isDev: __DEV__
      });
    } catch (error) {
      this.log('✗ Platform 信息异常', error.message);
    }
  }

  async generateReport() {
    const report = {
      summary: {
        totalTime: Date.now() - this.startTime,
        logsCount: this.logs.length,
        platform: Platform.OS,
        isDevelopment: __DEV__,
        finalAppState: AppState.currentState
      },
      logs: this.logs
    };

    console.log('=== 启动调试报告 ===');
    console.log(JSON.stringify(report, null, 2));
    
    try {
      await AsyncStorage.setItem('startup_debug_report', JSON.stringify(report));
      this.log('调试报告已保存');
    } catch (error) {
      this.log('保存调试报告失败', error.message);
    }

    return report;
  }

  // 监听应用状态变化
  startAppStateMonitoring() {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      this.log(`应用状态变化: ${nextAppState}`);
    });

    return subscription;
  }
}

export default StartupDebugger; 