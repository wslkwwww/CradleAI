import { ChatMessage } from '@/shared/types';

export class GeminiAdapter {
    private readonly BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    private readonly apiKey: string;
    private readonly model = "gemini-2.0-flash";
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
                maxOutputTokens: 1024,
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.candidates?.[0]?.content) {
                const responseText = result.candidates[0].content.parts?.[0]?.text || "";
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
            console.error("Error generating content:", error);
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
