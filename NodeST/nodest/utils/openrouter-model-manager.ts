import AsyncStorage from '@react-native-async-storage/async-storage';
import { OpenRouterModel } from '@/shared/types/api-types';
import { OpenRouterAdapter } from './openrouter-adapter';

/**
 * OpenRouter模型管理器 - 管理模型缓存和获取
 */
export class OpenRouterModelManager {
    private static CACHE_KEY = 'openrouter_models_cache';
    private static CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    /**
     * 获取可用模型列表，支持缓存
     * @param apiKey OpenRouter API Key
     * @param forceRefresh 是否强制刷新缓存
     * @returns 模型列表
     */
    static async getModels(apiKey: string, forceRefresh = false): Promise<OpenRouterModel[]> {
        try {
            if (!apiKey) {
                console.error('[OpenRouterModelManager] Cannot fetch models: API key is missing');
                return [];
            }

            // Try to get from cache unless forced refresh
            if (!forceRefresh) {
                const cachedData = await this.getCachedModels();
                if (cachedData && cachedData.models.length > 0) {
                    console.log('[OpenRouterModelManager] Using cached models');
                    return cachedData.models;
                }
            }

            // Fetch fresh data
            console.log('[OpenRouterModelManager] Fetching fresh model list');
            const adapter = new OpenRouterAdapter(apiKey);
            const models = await adapter.listModels();
            
            if (models.length > 0) {
                // Cache the result
                this.cacheModels(models);
                return models;
            } else {
                // If API call returned empty but we have cache, use that as fallback
                const cachedData = await this.getCachedModels();
                if (cachedData) {
                    console.log('[OpenRouterModelManager] API returned empty, using cached models as fallback');
                    return cachedData.models;
                }
            }
            
            return [];
        } catch (error) {
            console.error('[OpenRouterModelManager] Error fetching models:', error);
            
            // Try to use cache on error
            const cachedData = await this.getCachedModels();
            if (cachedData) {
                console.log('[OpenRouterModelManager] Error fetching, using cached models');
                return cachedData.models;
            }
            
            return [];
        }
    }

    // Cache models
    private static async cacheModels(models: OpenRouterModel[]): Promise<void> {
        try {
            const data = {
                models,
                timestamp: Date.now()
            };
            
            await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
            console.log('[OpenRouterModelManager] Models cached successfully');
        } catch (error) {
            console.error('[OpenRouterModelManager] Error caching models:', error);
        }
    }

    // Get cached models if not expired
    private static async getCachedModels(): Promise<{ models: OpenRouterModel[], timestamp: number } | null> {
        try {
            const data = await AsyncStorage.getItem(this.CACHE_KEY);
            if (!data) return null;
            
            const parsedData = JSON.parse(data) as { models: OpenRouterModel[], timestamp: number };
            
            // Check if cache is expired
            if (Date.now() - parsedData.timestamp > this.CACHE_EXPIRY) {
                console.log('[OpenRouterModelManager] Cache expired');
                return null;
            }
            
            return parsedData;
        } catch (error) {
            console.error('[OpenRouterModelManager] Error getting cached models:', error);
            return null;
        }
    }

    // Clear model cache
    static async clearCache(): Promise<void> {
        try {
            await AsyncStorage.removeItem(this.CACHE_KEY);
            console.log('[OpenRouterModelManager] Model cache cleared');
        } catch (error) {
            console.error('[OpenRouterModelManager] Error clearing model cache:', error);
        }
    }

    // Filter models by provider
    static filterModelsByProvider(models: OpenRouterModel[], providerId?: string): OpenRouterModel[] {
        if (!providerId) return models;
        return models.filter(model => model.provider?.id === providerId);
    }

    // Get popular models (helper function to get commonly used models)
    static getPopularModels(models: OpenRouterModel[]): OpenRouterModel[] {
        const popularModelIds = [
            'openai/gpt-3.5-turbo',
            'openai/gpt-4',
            'anthropic/claude-instant-v1',
            'anthropic/claude-2',
            'google/palm-2-chat-bison',
            'meta-llama/llama-2-70b-chat'
        ];
        
        return models.filter(model => popularModelIds.includes(model.id));
    }
}
