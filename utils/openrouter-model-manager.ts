import AsyncStorage from '@react-native-async-storage/async-storage';

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
  provider?: {
    id?: string;
    name?: string;
  };
}

export class OpenRouterModelManager {
  private static CACHE_KEY = 'openrouter_models_cache';
  private static CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  /**
   * Get models from OpenRouter API or cache
   * @param apiKey OpenRouter API key
   * @param forceRefresh Whether to force a refresh from API
   * @returns Array of models
   */
  static async getModels(apiKey: string, forceRefresh = false): Promise<OpenRouterModel[]> {
    try {
      if (!apiKey) {
        console.error('[OpenRouterModelManager] No API key provided');
        return [];
      }
      
      // If not forcing refresh, try to get from cache first
      if (!forceRefresh) {
        const cachedData = await this.getFromCache();
        if (cachedData) {
          return cachedData.models;
        }
      }
      
      // No cache or forced refresh, fetch from API
      console.log('[OpenRouterModelManager] Fetching models from API');
      
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://app.roleverse.ai', // Replace with your app's domain
          'X-Title': 'Roleverse AI' // Replace with your app name
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Map API response to our model format
      const models: OpenRouterModel[] = data.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
        context_length: model.context_length,
        pricing: {
          prompt: model.pricing?.prompt,
          completion: model.pricing?.completion
        },
        provider: {
          id: model.provider?.id,
          name: model.provider?.name
        }
      }));
      
      // Cache the models
      await this.saveToCache(models);
      
      return models;
    } catch (error) {
      console.error('[OpenRouterModelManager] Error fetching models:', error);
      
      // If API fetch fails, attempt to use cached data even if forceRefresh was true
      const cachedData = await this.getFromCache();
      if (cachedData) {
        return cachedData.models;
      }
      
      return [];
    }
  }
  
  /**
   * Save models to cache
   * @param models Models to cache
   */
  private static async saveToCache(models: OpenRouterModel[]): Promise<void> {
    try {
      const cacheData = {
        timestamp: Date.now(),
        models
      };
      
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      console.log('[OpenRouterModelManager] Models saved to cache');
    } catch (error) {
      console.error('[OpenRouterModelManager] Error saving to cache:', error);
    }
  }
  
  /**
   * Get models from cache if available and not expired
   * @returns Cached data or null if not available
   */
  private static async getFromCache(): Promise<{ timestamp: number, models: OpenRouterModel[] } | null> {
    try {
      const cacheJson = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cacheJson) return null;
      
      const cacheData = JSON.parse(cacheJson);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - cacheData.timestamp > this.CACHE_EXPIRY) {
        console.log('[OpenRouterModelManager] Cache expired');
        return null;
      }
      
      console.log('[OpenRouterModelManager] Using cached models');
      return cacheData;
    } catch (error) {
      console.error('[OpenRouterModelManager] Error reading from cache:', error);
      return null;
    }
  }
  
  /**
   * Clear the model cache
   */
  static async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
      console.log('[OpenRouterModelManager] Cache cleared');
    } catch (error) {
      console.error('[OpenRouterModelManager] Error clearing cache:', error);
    }
  }
}
