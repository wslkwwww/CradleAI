import { ChatMessage } from '../../../shared/types';
import { OpenRouterModel } from '../../../shared/types/api-types';

export class OpenRouterAdapter {
    private readonly BASE_URL = "https://openrouter.ai/api/v1";
    private readonly apiKey: string;
    private readonly model: string;
    private readonly headers: Record<string, string>;
    private conversationHistory: ChatMessage[] = [];

    constructor(apiKey: string, model: string = "openai/gpt-3.5-turbo") {
        if (!apiKey) {
            throw new Error("API key cannot be empty");
        }
        this.apiKey = apiKey;
        this.model = model;
        this.headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://my-app.com", // Replace with your app's domain
            "X-Title": "My App" // Replace with your app's name
        };
    }

    async generateContent(contents: ChatMessage[]): Promise<string> {
        const url = `${this.BASE_URL}/chat/completions`;
        
        // Convert NodeST message format to OpenRouter format
        const messages = contents.map(content => ({
            role: content.role === "model" ? "assistant" : content.role,
            content: content.parts[0]?.text || ""
        }));

        const data = {
            model: this.model,
            messages,
            temperature: 0.7,
            max_tokens: 1024
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
            }

            const result = await response.json();
            
            if (result.choices?.[0]?.message?.content) {
                const responseText = result.choices[0].message.content;
                if (responseText) {
                    this.conversationHistory.push({
                        role: "assistant",
                        parts: [{ text: responseText }]
                    });
                }
                return responseText;
            }
            return "";

        } catch (error) {
            console.error("Error generating content with OpenRouter:", error);
            throw error;
        }
    }

    async listModels(): Promise<OpenRouterModel[]> {
        const url = `${this.BASE_URL}/models`;
        console.log('[OpenRouterAdapter] Fetching models from:', url);

        try {
            // 添加超时设置
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            const response = await fetch(url, {
                headers: this.headers,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            // Parse and validate response
            const result = await response.json();
            console.log('[OpenRouterAdapter] Models response data structure:', 
                      { hasData: !!result.data, itemCount: result.data?.length || 0 });
            
            // 确保返回的是数组
            if (!result.data || !Array.isArray(result.data)) {
                console.warn('[OpenRouterAdapter] Unexpected response format - missing or invalid data array');
                return [];
            }
            
            // 修复: 为 item 参数添加明确类型，并过滤掉 null 值
            const models = result.data
                .map((item: any) => this.normalizeModelData(item))
                .filter((model: OpenRouterModel | null): model is OpenRouterModel => 
                    model !== null && typeof model.id === 'string');
                                    
            console.log('[OpenRouterAdapter] Normalized models:', models.length);
            return models;

        } catch (error: unknown) {
            // 修复: 正确处理 unknown 类型的错误
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    console.error('[OpenRouterAdapter] Request timed out fetching models');
                } else {
                    console.error('[OpenRouterAdapter] Error fetching models:', error.message);
                }
            } else {
                console.error('[OpenRouterAdapter] Unknown error fetching models');
            }
            throw error;
        }
    }
    
    // 修改返回类型，允许返回 null
    private normalizeModelData(rawModel: any): OpenRouterModel | null {
        if (!rawModel || typeof rawModel !== 'object') {
            return null;
        }
        
        try {
            // 确保返回符合 OpenRouterModel 类型的对象
            const model: OpenRouterModel = {
                id: rawModel.id || '',
                name: rawModel.name || rawModel.id || 'Unknown Model',
                description: rawModel.description || '',
                context_length: rawModel.context_length || 4096,
                pricing: {
                    prompt: typeof rawModel.pricing?.prompt === 'number' ? rawModel.pricing.prompt : 0,
                    completion: typeof rawModel.pricing?.completion === 'number' ? rawModel.pricing.completion : 0,
                },
                provider: {
                    id: rawModel.provider?.id || 'unknown',
                    name: rawModel.provider?.name || 'Unknown Provider',
                }
            };
            return model;
        } catch (e) {
            console.error('[OpenRouterAdapter] Error normalizing model data:', e);
            return null;
        }
    }

    getChatHistory(): Array<{ role: string; text: string }> {
        return this.conversationHistory.map(msg => ({
            role: msg.role,
            text: msg.parts[0]?.text || ""
        }));
    }
}
