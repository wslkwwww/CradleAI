import { ChatMessage } from '@/shared/types';

export class GeminiAdapter {
    private readonly BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    private readonly apiKey: string;
    private readonly model = "gemini-1.5-pro";  // Updated to use a more powerful model for characters
    private readonly headers = {
        "Content-Type": "application/json"
    };
    private conversationHistory: ChatMessage[] = [];

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("API key cannot be empty");
        }
        this.apiKey = apiKey;
    }

    async generateContent(contents: ChatMessage[]): Promise<string> {
        const url = `${this.BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`;
        
        const data = {
            contents,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,  // Increased token limit for character generation
            }
        };

        try {
            console.log(`[Gemini适配器] 发送请求到API: ${this.model}`);
            console.log(`[Gemini适配器] 请求包含 ${contents.length} 条消息`);
            
            // Enhanced logging for each message in the request
            contents.forEach((msg, index) => {
                const previewText = msg.parts?.[0]?.text || "";
                console.log(`[Gemini适配器] 消息 #${index + 1} (${msg.role}): ${previewText.substring(0, 100)}...`);
                
                // Special handling for messages that might contain VNDB data, appearance tags, or traits
                if (previewText.includes("VNDB") || 
                    previewText.includes("角色参考") || 
                    previewText.includes("外观参考") || 
                    previewText.includes("标签") || 
                    previewText.includes("特征")) {
                    
                    // Log a more complete version of important data
                    const importantDataPreview = previewText.substring(0, 300);
                    console.log(`[Gemini适配器] 重要数据预览 #${index + 1}: ${importantDataPreview}...`);
                    
                    // Check for specific sections and log them
                    if (previewText.includes("正向标签")) {
                        const positiveTagsMatch = previewText.match(/正向标签[：:]\s*([\s\S]*?)(?=负向标签|$)/);
                        if (positiveTagsMatch && positiveTagsMatch[1]) {
                            console.log(`[Gemini适配器] 正向标签: ${positiveTagsMatch[1].trim()}`);
                        }
                    }
                    
                    if (previewText.includes("负向标签")) {
                        const negativeTagsMatch = previewText.match(/负向标签[：:]\s*([\s\S]*?)(?=\n\n|$)/);
                        if (negativeTagsMatch && negativeTagsMatch[1]) {
                            console.log(`[Gemini适配器] 负向标签: ${negativeTagsMatch[1].trim()}`);
                        }
                    }
                    
                    if (previewText.includes("特征")) {
                        const traitsMatch = previewText.match(/特征[：:]\s*([\s\S]*?)(?=\n\n|$)/);
                        if (traitsMatch && traitsMatch[1]) {
                            console.log(`[Gemini适配器] 角色特征: ${traitsMatch[1].trim()}`);
                        }
                    }
                    
                    if (previewText.includes("性别")) {
                        const genderMatch = previewText.match(/[角色|用户]性别[：:]\s*([\s\S]*?)(?=\n\n|$)/);
                        if (genderMatch && genderMatch[1]) {
                            console.log(`[Gemini适配器] 性别信息: ${genderMatch[1].trim()}`);
                        }
                    }
                }
            });

            // Log messages before sending to API
            console.log('[GeminiAdapter] Sending request to Gemini API:');
            console.log(JSON.stringify(contents, null, 2));
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Gemini适配器] API响应错误 (${response.status}): ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }

            const result = await response.json();
            
            if (result.candidates?.[0]?.content) {
                const responseText = result.candidates[0].content.parts?.[0]?.text || "";
                if (responseText) {
                    console.log(`[Gemini适配器] 成功接收响应，长度: ${responseText.length}`);
                    console.log(`[Gemini适配器] 响应前100个字符: ${responseText.substring(0, 100)}...`);
                    
                    // Log potential JSON formatting issues
                    if (responseText.includes('"') && responseText.includes('\\')) {
                        console.warn('[Gemini适配器] 警告：响应中可能存在不正确的JSON转义字符');
                    }
                    
                    this.conversationHistory.push({
                        role: "assistant",
                        parts: [{ text: responseText }]
                    });
                } else {
                    console.warn(`[Gemini适配器] 接收到空响应`);
                }
                return responseText;
            }
            console.error(`[Gemini适配器] 无效的响应格式: ${JSON.stringify(result)}`);
            return "";

        } catch (error) {
            console.error("[Gemini适配器] 生成内容时出错:", error);
            throw error;
        }
    }

    getChatHistory(): Array<{ role: string; text: string }> {
        return this.conversationHistory.map(msg => ({
            role: msg.role,
            text: msg.parts[0]?.text || ""
        }));
    }
}
