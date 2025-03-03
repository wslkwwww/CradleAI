import { ChatMessage } from "@/shared/types";
import { OpenRouterModel } from "@/shared/types/api-types";

/**
 * OpenRouter API Adapter - 处理与OpenRouter API的通信
 */
export class OpenRouterAdapter {
  private apiKey: string;
  private model: string;
  private conversationHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor(apiKey: string, model: string = "openai/gpt-3.5-turbo") {
    this.apiKey = apiKey;
    this.model = model;
    console.log(`[OpenRouterAdapter] 初始化，使用模型: ${model}`);
  }

  /**
   * 设置要使用的模型
   * @param model 模型ID
   */
  setModel(model: string) {
    this.model = model;
    console.log(`[OpenRouterAdapter] 设置模型: ${model}`);
  }

  /**
   * 生成内容
   * @param messages 消息列表
   * @returns 生成的内容
   */
  async generateContent(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API Key不能为空");
    }

    // Convert NodeST messages format to OpenRouter format
    const openRouterMessages = messages.map(msg => {
      let role = msg.role === 'model' ? 'assistant' : msg.role;
      
      // Make sure we use valid role values for OpenRouter
      if (!['user', 'assistant', 'system'].includes(role)) {
        role = 'user';
      }

      // Extract text from parts
      let content = '';
      if (msg.parts && msg.parts.length > 0) {
        // Combine all text parts into one string
        content = msg.parts
          .filter(part => part.text)
          .map(part => part.text)
          .join('\n');
      }

      return { role, content };
    });

    console.log(`[OpenRouterAdapter] 生成内容，消息数: ${openRouterMessages.length}`);
    
    try {
      // Prepare the request body
      const body = {
        model: this.model,
        messages: openRouterMessages,
      };

      // Make the request to OpenRouter API
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://myaiapp.com', // Replace with your app's URL
          'X-Title': 'My AI Character App'      // Replace with your app's name
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OpenRouterAdapter] API Error (${response.status}): ${errorText}`);
        throw new Error(`OpenRouter API返回错误 ${response.status}: ${errorText}`);
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

      throw new Error("OpenRouter API响应格式错误");
    } catch (error) {
      console.error("[OpenRouterAdapter] 生成内容时出错:", error);
      throw error;
    }
  }

  /**
   * 获取模型列表
   */
  async listModels(): Promise<OpenRouterModel[]> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API Key不能为空");
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://myaiapp.com', // Replace with your app's URL
          'X-Title': 'My AI Character App'      // Replace with your app's name
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API返回错误 ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error("[OpenRouterAdapter] 获取模型列表时出错:", error);
      throw error;
    }
  }

  /**
   * 获取当前对话历史
   */
  getChatHistory(): Array<{ role: string; text: string }> {
    return this.conversationHistory.map(msg => ({
      role: msg.role,
      text: msg.parts.map(part => part.text).join('')
    }));
  }

  /**
   * 清除对话历史
   */
  clearChatHistory(): void {
    this.conversationHistory = [];
  }
}
