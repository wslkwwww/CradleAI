import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalSettings } from '@/shared/types';

// Storage keys used throughout the app
export const STORAGE_KEYS = {
  USER_SETTINGS: 'user',
  CHARACTERS: 'characters',
  CONVERSATIONS: 'conversations',
};

/**
 * Utility class for consistent AsyncStorage access across the app
 */
export class StorageUtils {
  /**
   * Get user settings from AsyncStorage
   * @returns User settings object or null if not found
   */
  static async getUserSettings(): Promise<{settings: GlobalSettings} | null> {
    try {
      const userSettingsStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      if (userSettingsStr) {
        return JSON.parse(userSettingsStr);
      }
      return null;
    } catch (error) {
      console.error('[StorageUtils] Error getting user settings:', error);
      return null;
    }
  }
  
  /**
   * Save user settings to AsyncStorage
   * @param settings User settings to save
   * @returns Whether save was successful
   */
  static async saveUserSettings(userData: {settings: GlobalSettings}): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(userData));
      console.log('[StorageUtils] User settings saved successfully');
      return true;
    } catch (error) {
      console.error('[StorageUtils] Error saving user settings:', error);
      return false;
    }
  }

  /**
   * Get API settings from AsyncStorage
   * These are extracted from user settings for convenience
   */
  static async getApiSettings(): Promise<Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'> | null> {
    try {
      const userData = await this.getUserSettings();
      if (userData?.settings?.chat) {
        return {
          apiProvider: userData.settings.chat.apiProvider,
          openrouter: userData.settings.chat.openrouter
        };
      }
      return null;
    } catch (error) {
      console.error('[StorageUtils] Error getting API settings:', error);
      return null;
    }
  }
}
