import AsyncStorage from '@react-native-async-storage/async-storage';
import { OpenRouterModel } from '../../../shared/types/api-types';
import { OpenRouterAdapter } from './openrouter-adapter';

export class OpenRouterModelManager {
    private static CACHE_KEY = 'openrouter_models_cache';
    private static CACHE_EXPIRY_KEY = 'openrouter_models_expiry';
    private static CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

    static async getModels(apiKey: string, forceRefresh = false): Promise<OpenRouterModel[]> {
        try {
            if (!apiKey) {
                console.warn('[OpenRouterModelManager] Missing API key');
                return [];
            }

            if (!forceRefresh) {
                const cachedModels = await this.getCachedModels();
                if (cachedModels && cachedModels.length > 0) {
                    console.log('[OpenRouterModelManager] Returning cached models:', 
                                { count: cachedModels.length });
                    return cachedModels;
                }
            }

            const adapter = new OpenRouterAdapter(apiKey);
            console.log('[OpenRouterModelManager] Fetching models from API');
            const models = await adapter.listModels();
            
            // 检查模型数据的有效性
            const validModels = this.validateModels(models);
            console.log('[OpenRouterModelManager] Fetched models:', 
                        { total: models.length, valid: validModels.length });
            
            if (validModels.length > 0) {
                await this.cacheModels(validModels);
            }
            
            return validModels;
        } catch (error) {
            console.error("[OpenRouterModelManager] Error fetching OpenRouter models:", error);
            
            // 尝试返回缓存的模型，即使在强制刷新模式下
            const cachedModels = await this.getCachedModels();
            if (cachedModels && cachedModels.length > 0) {
                console.log('[OpenRouterModelManager] Falling back to cached models after error');
                return cachedModels;
            }
            
            // 如果完全没有模型可用，则返回空数组而不是抛出错误
            console.warn('[OpenRouterModelManager] No models available - returning empty array');
            return [];
        }
    }

    // 验证模型数据的有效性
    private static validateModels(models: any[]): OpenRouterModel[] {
        if (!Array.isArray(models)) {
            console.warn('[OpenRouterModelManager] Models data is not an array');
            return [];
        }

        return models.filter(model => {
            const isValid = model && 
                            typeof model === 'object' && 
                            typeof model.id === 'string' && 
                            typeof model.name === 'string';
            
            if (!isValid) {
                console.warn('[OpenRouterModelManager] Filtered invalid model:', model);
            }
            
            return isValid;
        });
    }

    private static async getCachedModels(): Promise<OpenRouterModel[] | null> {
        try {
            const expiryStr = await AsyncStorage.getItem(this.CACHE_EXPIRY_KEY);
            const expiry = expiryStr ? parseInt(expiryStr) : 0;

            if (expiry && Date.now() < expiry) {
                const modelsStr = await AsyncStorage.getItem(this.CACHE_KEY);
                if (modelsStr) {
                    const models = JSON.parse(modelsStr);
                    return Array.isArray(models) ? models : null;
                }
            }
            return null;
        } catch (error) {
            console.error("[OpenRouterModelManager] Error getting cached models:", error);
            return null;
        }
    }

    private static async cacheModels(models: OpenRouterModel[]): Promise<void> {
        try {
            const expiry = Date.now() + this.CACHE_DURATION;
            await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(models));
            await AsyncStorage.setItem(this.CACHE_EXPIRY_KEY, expiry.toString());
            console.log('[OpenRouterModelManager] Models cached successfully');
        } catch (error) {
            console.error("[OpenRouterModelManager] Error caching models:", error);
        }
    }

    static async clearCache(): Promise<void> {
        try {
            await AsyncStorage.removeItem(this.CACHE_KEY);
            await AsyncStorage.removeItem(this.CACHE_EXPIRY_KEY);
            console.log('[OpenRouterModelManager] Cache cleared successfully');
        } catch (error) {
            console.error("[OpenRouterModelManager] Error clearing model cache:", error);
        }
    }
}
