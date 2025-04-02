/**
 * Settings Helper
 * 
 * Provides utilities to make user settings accessible globally
 */

import { GlobalSettings } from '@/shared/types';

let cloudServiceEnabled = false;
const cloudServiceListeners: Array<(enabled: boolean) => void> = [];

/**
 * Update the cloud service status and notify listeners.
 */
export function updateCloudServiceStatus(enabled: boolean): void {
  cloudServiceEnabled = enabled;
  console.log(`[CloudServiceTracker] 云服务状态更新为: ${enabled ? '启用' : '禁用'}`);
  cloudServiceListeners.forEach(listener => listener(enabled));
}

/**
 * Get the current cloud service status.
 */
export function getCloudServiceStatus(): boolean {
  return cloudServiceEnabled;
}

/**
 * Add a listener for cloud service status changes.
 */
export function addCloudServiceStatusListener(listener: (enabled: boolean) => void): () => void {
  cloudServiceListeners.push(listener);
  return () => {
    const index = cloudServiceListeners.indexOf(listener);
    if (index !== -1) {
      cloudServiceListeners.splice(index, 1);
    }
  };
}

/**
 * Store user settings in a global variable for easy access
 * across the application, especially for services
 */
export function storeUserSettingsGlobally(settings: GlobalSettings): void {
  try {
    // Store in global object for React Native environment
    if (typeof global !== 'undefined') {
      (global as any).__USER_SETTINGS = settings;
    }
    
    // Store in localStorage for web environment
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user_settings', JSON.stringify(settings));
    }
    
    console.log('[SettingsHelper] User settings stored globally');
  } catch (error) {
    console.error('[SettingsHelper] Failed to store settings globally:', error);
  }
}

/**
 * Get user settings from global storage
 */
export function getUserSettingsGlobally(): GlobalSettings | null {
  try {
    // Try to get from global object first (React Native)
    if (typeof global !== 'undefined' && (global as any).__USER_SETTINGS) {
      return (global as any).__USER_SETTINGS;
    }
    
    // Try to get from localStorage (web)
    if (typeof localStorage !== 'undefined') {
      const settingsStr = localStorage.getItem('user_settings');
      if (settingsStr) {
        return JSON.parse(settingsStr);
      }
    }
    
    console.warn('[SettingsHelper] No user settings found in global storage');
    return null;
  } catch (error) {
    console.error('[SettingsHelper] Failed to get global settings:', error);
    return null;
  }
}
