/**
 * OpenRouter Adapter
 * 提供与OpenRouter API通信的功能
 */

type ChatMessage = {
  role: string;
  parts?: { text: string }[];
  content?: string;
};

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

export class OpenRouterAdapter {
  private apiKey: string;
  private model: string;
  private conversationHistory: ChatMessage[] = [];
  private baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string, model: string = "openai/gpt-3.5-turbo") {
    this.apiKey = apiKey;
    this.model = model;
    console.log(`【OpenRouterAdapter】初始化适配器，模型: ${model}`);
  }

  /**
   * 设置模型
   */
  setModel(model: string): void {
    console.log(`【OpenRouterAdapter】更新模型: ${this.model} -> ${model}`);
    this.model = model;
  }

  /**
   * 生成内容 - 与Gemini适配器接口保持一致
   */
  async generateContent(contents: ChatMessage[]): Promise<string> {
    console.log(`【OpenRouterAdapter】开始生成内容，使用模型: ${this.model}`);
    
    try {
      // 添加到历史记录
      contents.forEach(content => {
        // 如果消息使用的是Gemini格式，则转换为OpenRouter格式
        if (content.parts && !content.content) {
          this.conversationHistory.push({
            role: content.role,
            content: content.parts[0]?.text || ""
          });
        } else {
          this.conversationHistory.push(content);
        }
      });
      
      // 准备OpenRouter格式的消息
      const messages = this.conversationHistory.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role, // 确保role符合OpenRouter要求
        content: msg.content || (msg.parts && msg.parts[0]?.text) || ""
      }));

      // 构建请求体
      const requestBody = {
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024
      };

      // 发送API请求
      console.log(`【OpenRouterAdapter】发送请求到: ${this.baseUrl}/chat/completions`);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com', // 添加必要的请求头
          'X-Title': 'AI Chat App'  // 添加应用标识
        },
        body: JSON.stringify(requestBody)
      });
      
      // 如果响应不成功，处理错误情况
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = `OpenRouter API 错误(${response.status}): ${response.statusText}`;
        
        try {
          // 尝试解析错误JSON
          const errorData = JSON.parse(text);
          
          // 特别处理地理位置错误
          if (errorData.error?.message?.includes("User location is not supported") ||
              errorData.error?.metadata?.raw?.includes("User location is not supported")) {
            errorMessage = "当前地理位置不支持使用此API。请尝试使用VPN或代理服务器，或联系OpenRouter支持。";
            console.error(`【OpenRouterAdapter】地理位置限制错误:`, {
              status: response.status,
              error: errorData.error
            });
          } else {
            // 常规错误处理
            errorMessage = `OpenRouter API 错误: ${errorData.error?.message || JSON.stringify(errorData)}`;
            console.error(`【OpenRouterAdapter】API错误响应:`, {
              status: response.status,
              error: errorData.error
            });
          }
        } catch (e) {
          // 如果不是有效JSON，使用原始文本
          console.error(`【OpenRouterAdapter】非JSON错误响应: ${text}`);
        }
        
        throw new Error(errorMessage);
      }

      // 解析响应
      const result = await response.json();
      
      // 验证响应格式
      if (!result.choices?.[0]?.message?.content) {
        console.error('【OpenRouterAdapter】无效的响应格式:', result);
        throw new Error('收到无效的响应格式');
      }

      const responseText = result.choices[0].message.content;
      
      // 添加响应到历史
      this.conversationHistory.push({
        role: "assistant",
        content: responseText
      });
      
      console.log(`【OpenRouterAdapter】成功生成回复，长度: ${responseText.length}`);
      return responseText;

    } catch (error) {
      console.error(`【OpenRouterAdapter】生成内容失败:`, error);
      throw error;
    }
  }

  /**
   * 获取聊天历史
   */
  getChatHistory(): Array<{ role: string; text: string }> {
    return this.conversationHistory.map(msg => ({
      role: msg.role,
      text: msg.content || (msg.parts?.[0]?.text || "")
    }));
  }

  /**
   * 清除聊天历史
   */
  clearChatHistory(): void {
    console.log('【OpenRouterAdapter】清除聊天历史');
    this.conversationHistory = [];
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<OpenRouterModel[]> {
    console.log('【OpenRouterAdapter】获取可用模型列表');
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`【OpenRouterAdapter】获取模型列表失败(${response.status}): ${text}`);
        
        let errorMessage = `获取模型列表失败: ${response.statusText}`;
        
        try {
          // 尝试解析错误JSON
          const errorData = JSON.parse(text);
          if (errorData.error?.message) {
            errorMessage = `获取模型列表失败: ${errorData.error.message}`;
          }
        } catch (e) {
          // 保持原始错误信息
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // 模型数据结构调试日志
      console.log(`【OpenRouterAdapter】获取到 ${data.data?.length || 0} 个模型`);
      if (data.data?.length > 0) {
        console.log(`【OpenRouterAdapter】示例模型: ${data.data[0].id}`);
      }

      return data.data || [];
    } catch (error) {
      console.error('【OpenRouterAdapter】获取模型列表失败:', error);
      throw error;
    }
  }
}
