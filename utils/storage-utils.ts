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
  private static API_SETTINGS_KEY = 'api_settings';

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
      const data = await AsyncStorage.getItem(this.API_SETTINGS_KEY);
      if (!data) return null;
      
      return JSON.parse(data);
    } catch (error) {
      console.error('[StorageUtils] Error getting API settings:', error);
      return null;
    }
  }

  /**
   * Save API settings to storage
   * @param settings API settings object
   */
  static async saveApiSettings(settings: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.API_SETTINGS_KEY, 
        JSON.stringify(settings)
      );
      console.log('[StorageUtils] API settings saved successfully');
    } catch (error) {
      console.error('[StorageUtils] Error saving API settings:', error);
      throw error;
    }
  }
}
