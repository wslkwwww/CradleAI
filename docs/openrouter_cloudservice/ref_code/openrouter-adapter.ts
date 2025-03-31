import { mcpAdapter } from './mcp-adapter';
import { CloudServiceProvider } from '@/services/cloud-service-provider';

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
    console.log(`【OpenRouterAdapter】API密钥: ${this.maskApiKey(apiKey)}`);
  }

  /**
   * Mask API key for logging
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey) return '';
    return apiKey.substring(0, 4) + '****';
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
    console.log(`【OpenRouterAdapter】本次调用可能涉及角色关系更新`);
    
    try {
      // 添加到历史记录
      contents.forEach(content => {
        // 检查消息内容是否包含关系相关关键词
        const messageText = content.parts?.[0]?.text || content.content || "";
        if (messageText.includes("关系") || 
            messageText.includes("互动") || 
            messageText.includes("朋友圈")) {
          console.log(`【OpenRouterAdapter】检测到关系系统相关请求: ${messageText.substring(0, 50)}...`);
        }
        
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
      
      // Check if cloud service is enabled and use it if available
      let response;
      const requestUrl = `${this.baseUrl}/chat/completions`;
      
      if (CloudServiceProvider.isEnabled()) {
        console.log('【OpenRouterAdapter】检测到云服务已启用');
        console.log(`【OpenRouterAdapter】原始请求URL: ${requestUrl}`);
        console.log(`【OpenRouterAdapter】开始时间: ${new Date().toISOString()}`);
        console.log(`【OpenRouterAdapter】请求模型: ${this.model}`);
        console.log(`【OpenRouterAdapter】请求体大小: ${JSON.stringify(requestBody).length} 字节`);
        console.log(`【OpenRouterAdapter】消息数量: ${messages.length}`);
        
        // 记录每条消息的角色和内容预览，但不记录API密钥
        messages.forEach((msg, index) => {
          let contentPreview = typeof msg.content === 'string' 
            ? msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '') 
            : '[复杂内容]';
          
          // Mask potential API keys in message content
          contentPreview = contentPreview.replace(/([A-Za-z0-9_-]{20,})/g, match => {
            if (match.length >= 20 && /^[A-Za-z0-9_-]+$/.test(match)) {
              return match.substring(0, 4) + '****';
            }
            return match;
          });
          
          console.log(`【OpenRouterAdapter】消息 #${index+1}: ${msg.role} - ${contentPreview}`);
        });
        
        // Forward the request through the cloud service
        console.log('【OpenRouterAdapter】准备调用云服务转发接口...');
        
        try {
          const startTime = Date.now();
          response = await CloudServiceProvider.forwardRequest(
            requestUrl,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://github.com', // 添加必要的请求头
                'X-Title': 'AI Chat App'  // 添加应用标识
              },
              body: JSON.stringify(requestBody)
            },
            'openrouter'
          );
          
          const endTime = Date.now();
          console.log(`【OpenRouterAdapter】云服务请求完成，耗时: ${endTime - startTime}ms`);
          console.log(`【OpenRouterAdapter】云服务响应状态: ${response.status} ${response.statusText}`);
          
          // 记录响应头信息
          console.log('【OpenRouterAdapter】云服务响应头:');
            response.headers.forEach((value: string, name: string): void => {
              if (name.toLowerCase() === 'content-type' || 
                name.toLowerCase() === 'content-length' || 
                name.toLowerCase() === 'x-request-id' ||
                name.toLowerCase().startsWith('openrouter-')) {
                console.log(`【OpenRouterAdapter】- ${name}: ${value}`);
              }
            });
          
          // 检查内容类型
          const contentType = response.headers.get('content-type');
          console.log(`【OpenRouterAdapter】响应内容类型: ${contentType}`);
          
          // 检查响应大小
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
              console.log(`【OpenRouterAdapter】响应内容大小: ${contentLength} 字节`);
          }
        } catch (cloudError) {
          console.error('【OpenRouterAdapter】云服务转发失败:', cloudError);
          console.error('【OpenRouterAdapter】尝试回退到直接API调用...');
          throw cloudError; // 重新抛出以便后续处理
        }
      } else {
        // Use direct API call if cloud service is not enabled
        console.log('【OpenRouterAdapter】云服务未启用，使用直接API调用');
        console.log(`【OpenRouterAdapter】直接调用URL: ${requestUrl}`);
        console.log(`【OpenRouterAdapter】开始时间: ${new Date().toISOString()}`);
        
        const startTime = Date.now();
        response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://github.com', // 添加必要的请求头
            'X-Title': 'AI Chat App'  // 添加应用标识
          },
          body: JSON.stringify(requestBody)
        });
        const endTime = Date.now();
        
        console.log(`【OpenRouterAdapter】直接API调用完成，耗时: ${endTime - startTime}ms`);
        console.log(`【OpenRouterAdapter】API响应状态: ${response.status} ${response.statusText}`);
      }
      
      // 如果响应不成功，处理错误情况
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = `OpenRouter API 错误(${response.status}): ${response.statusText}`;
        
        console.error(`【OpenRouterAdapter】API响应错误: ${response.status} ${response.statusText}`);
        console.error(`【OpenRouterAdapter】错误响应内容: ${text}`);
        
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
      console.log(`【OpenRouterAdapter】开始解析API响应JSON`);
      const startParseTime = Date.now();
      const result = await response.json();
      const endParseTime = Date.now();
      console.log(`【OpenRouterAdapter】JSON解析完成，耗时: ${endParseTime - startParseTime}ms`);
      
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
      console.log(`【OpenRouterAdapter】回复前100个字符: ${responseText.substring(0, 100)}...`);
      
      // 检查是否有用量信息
      if (result.usage) {
        console.log(`【OpenRouterAdapter】令牌用量: 提示=${result.usage.prompt_tokens || 0}, 完成=${result.usage.completion_tokens || 0}, 总计=${result.usage.total_tokens || 0}`);
      }
      
      // 检查响应是否包含关系操作指令
      if (responseText.includes("关系更新") || 
          responseText.includes("互动") || 
          responseText.includes("关系强度")) {
        console.log(`【OpenRouterAdapter】检测到响应包含关系系统指令: ${responseText.substring(0, 100).replace(/\n/g, ' ')}...`);
      }
      
      return responseText;

    } catch (error) {
      console.error(`【OpenRouterAdapter】生成内容失败:`, error);
      throw error;
    }
  }

  /**
   * 生成支持工具调用的内容
   * @param contents 消息内容
   * @param memoryResults 记忆搜索结果 (可选)
   * @returns 生成的内容
   */
  async generateContentWithTools(contents: ChatMessage[], memoryResults?: any): Promise<string> {
    // 检查最后一条消息中是否需要搜索功能
    const lastMessage = contents[contents.length - 1];
    const messageText = lastMessage.content || (lastMessage.parts && lastMessage.parts[0]?.text) || "";
    const needsSearching = this.messageNeedsSearching(messageText);
    
    try {
      // 如果判断需要搜索，先尝试搜索
      if (needsSearching) {
        console.log(`【OpenRouterAdapter】 检测到搜索意图，尝试使用工具调用`);
        return await this.handleSearchIntent(contents, memoryResults);
      }
      
      // 否则使用普通对话方式
      console.log(`【OpenRouterAdapter】 使用标准对话方式生成回复`);
      return await this.generateContent(contents);
    } catch (error) {
      console.error(`【OpenRouterAdapter】 工具调用失败，回退到标准对话:`, error);
      // 如果工具调用失败，回退到标准对话
      return await this.generateContent(contents);
    }
  }
  
  /**
   * 判断消息是否需要搜索
   * @param messageText 消息文本
   * @returns 是否需要搜索
   */
  private messageNeedsSearching(messageText: string): boolean {
    // 检查消息是否包含搜索意图的关键词
    const searchKeywords = [
      '搜索', '查询', '查找', '寻找', '检索', '了解', '信息', 
      '最新', '新闻', '什么是', '谁是', '哪里',
      'search', 'find', 'lookup', 'query', 'information about',
      'latest', 'news', 'what is', 'who is', 'where'
    ];
    
    // 提问型关键词
    const questionPatterns = [
      /是什么/, /有哪些/, /如何/, /怎么/, /怎样/, 
      /什么时候/, /为什么/, /哪些/, /多少/,
      /what is/i, /how to/i, /when is/i, /why is/i, /where is/i
    ];
    
    // 检查关键词
    const hasSearchKeyword = searchKeywords.some(keyword => 
      messageText.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // 检查提问模式
    const isQuestion = questionPatterns.some(pattern => 
      pattern.test(messageText)
    ) || messageText.includes('?') || messageText.includes('？');
    
    // 如果同时满足以下条件，则判断需要搜索:
    // 1. 消息包含搜索关键词或者是一个问题
    // 2. 消息长度不超过200个字符 (太长的消息可能不是搜索意图)
    return (hasSearchKeyword || isQuestion) && messageText.length < 200;
  }
  
  /**
   * 处理搜索意图
   * @param contents 消息内容
   * @param memoryResults 记忆搜索结果 (可选)
   * @returns 搜索结果和回复
   */
  private async handleSearchIntent(contents: ChatMessage[], memoryResults?: any): Promise<string> {
    // 获取最后一条消息的内容
    const lastMessage = contents[contents.length - 1];
    const searchQuery = lastMessage.content || (lastMessage.parts && lastMessage.parts[0]?.text) || "";
    
    try {
      // 确保MCP适配器已连接
      if (!mcpAdapter.isReady()) {
        await mcpAdapter.connect();
      }
      
      // 构建工具调用消息
      const toolCallMessages = [
        {
          role: "user",
          content: `请帮我提取以下问题的搜索关键词，只返回核心关键词，不要有其他解释：\n\n${searchQuery}`
        }
      ];

      // 提取搜索关键词
      console.log(`【OpenRouterAdapter】正在提取搜索关键词...`);
      
      const extractionResult = await this.askLLM(toolCallMessages);
      const refinedQuery = extractionResult.trim() || searchQuery;

      console.log(`【OpenRouterAdapter】提取的搜索关键词: ${refinedQuery}`);
      
      // 使用MCP适配器执行搜索
      const searchResults = await mcpAdapter.search({
        query: refinedQuery,
        count: 5
      });
      
      // 格式化搜索结果为可读文本
      const formattedResults = mcpAdapter.formatSearchResults(searchResults);
      
      console.log(`【OpenRouterAdapter】获取到搜索结果，正在生成回复`);
      
      // 构建包含记忆和网络搜索结果的修改版提示
      let combinedPrompt = `${searchQuery}\n\n`;
      
      // 添加记忆搜索结果（如果有）
      if (memoryResults && memoryResults.results && memoryResults.results.length > 0) {
        console.log(`【OpenRouterAdapter】添加记忆搜索结果，包含 ${memoryResults.results.length} 条记忆`);
        combinedPrompt += `<mem>\n系统检索到的记忆内容：\n`;
        
        // 格式化记忆结果
        memoryResults.results.forEach((item: any, index: number) => {
          combinedPrompt += `${index + 1}. ${item.memory}\n`;
        });
        combinedPrompt += `</mem>\n\n`;
      }
      
      // 添加网络搜索结果
      combinedPrompt += `<websearch>\n搜索引擎返回的联网检索结果：\n${formattedResults}\n</websearch>\n\n`;
      
      // 添加响应指南
      combinedPrompt += `<response_guidelines>
  - 除了对用户消息的回应之外，**务必** 结合记忆内容和联网搜索内容进行回复。
  - **根据角色设定，聊天上下文和记忆内容**，输出你对检索记忆的回忆过程，并用<mem></mem>包裹。
    - 示例: <mem>我想起起您上次提到过类似的问题，当时...</mem>
  - **根据角色设定，聊天上下文和记忆内容**，输出你对联网检索结果的解释，并用<websearch></websearch>包裹。
    - 示例: <websearch>根据网络信息，[相关领域的专家]认为... 这可能对您有帮助。</websearch>
</response_guidelines>`;
      
      // 将搜索结果转换为适当的格式
      let formattedContents = [];
      
      // 转换历史消息
      for (let i = 0; i < contents.length - 1; i++) {
        const msg = contents[i];
        if (msg.content || (msg.parts && msg.parts[0]?.text)) {
          formattedContents.push({
            role: msg.role,
            content: msg.content || (msg.parts && msg.parts[0]?.text) || ""
          });
        }
      }
      
      // 添加最后的用户查询和搜索结果
      formattedContents.push({
        role: "user",
        content: combinedPrompt
      });
      
      // 使用工具调用结果生成最终回复
      return await this.askLLM(formattedContents);
    } catch (error) {
      console.error(`【OpenRouterAdapter】搜索处理失败:`, error);
      
      // 如果搜索失败，通知用户并使用标准方式回答
      let formattedContents = [];
      
      // 转换历史消息
      for (let i = 0; i < contents.length - 1; i++) {
        const msg = contents[i];
        if (msg.content || (msg.parts && msg.parts[0]?.text)) {
          formattedContents.push({
            role: msg.role,
            content: msg.content || (msg.parts && msg.parts[0]?.text) || ""
          });
        }
      }
      
      // 添加带有错误通知的最后查询
      formattedContents.push({
        role: "user",
        content: `${searchQuery}\n\n(注意：我尝试搜索相关信息，但搜索功能暂时不可用。请根据你已有的知识回答我的问题。)`
      });
      
      return await this.askLLM(formattedContents);
    }
  }
  
  /**
   * 辅助方法：用于发送简单的LLM请求并获取回答
   * @param messages 消息
   * @returns LLM的回答
   */
  private async askLLM(messages: any[]): Promise<string> {
    try {
      // 准备OpenRouter格式的消息
      const requestBody = {
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024
      };

      // 发送API请求
      const requestUrl = `${this.baseUrl}/chat/completions`;
      
      // Check if cloud service is enabled and use it if available
      let response;
      if (CloudServiceProvider.isEnabled()) {
        console.log('【OpenRouterAdapter】LLM请求 - 使用云服务转发');
        console.log(`【OpenRouterAdapter】LLM请求URL: ${requestUrl}`);
        console.log(`【OpenRouterAdapter】LLM请求开始时间: ${new Date().toISOString()}`);
        
        // 记录消息概要
        console.log(`【OpenRouterAdapter】LLM请求包含 ${messages.length} 条消息`);
        const lastMessagePreview = messages[messages.length - 1]?.content || '';
        console.log(`【OpenRouterAdapter】LLM最后一条消息预览: ${typeof lastMessagePreview === 'string' ? lastMessagePreview.substring(0, 50) + '...' : '[复杂内容]'}`);
        
        // Forward the request through the cloud service
        const startTime = Date.now();
        response = await CloudServiceProvider.forwardRequest(
          requestUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://github.com',
              'X-Title': 'AI Chat App'
            },
            body: JSON.stringify(requestBody)
          },
          'openrouter'
        );
        const endTime = Date.now();
        
        console.log(`【OpenRouterAdapter】LLM云服务请求完成，耗时: ${endTime - startTime}ms`);
        console.log(`【OpenRouterAdapter】LLM云服务响应状态: ${response.status} ${response.statusText}`);
      } else {
        // Use direct API call if cloud service is not enabled
        console.log('【OpenRouterAdapter】LLM请求 - 使用直接API调用');
        console.log(`【OpenRouterAdapter】LLM请求URL: ${requestUrl}`);
        
        const startTime = Date.now();
        response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://github.com',
            'X-Title': 'AI Chat App'
          },
          body: JSON.stringify(requestBody)
        });
        const endTime = Date.now();
        
        console.log(`【OpenRouterAdapter】LLM直接API调用完成，耗时: ${endTime - startTime}ms`);
      }
      
      if (!response.ok) {
        console.error(`【OpenRouterAdapter】LLM请求失败: ${response.status} ${response.statusText}`);
        throw new Error(`OpenRouter API 错误(${response.status}): ${response.statusText}`);
      }

      console.log(`【OpenRouterAdapter】开始解析LLM响应`);
      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        console.error(`【OpenRouterAdapter】LLM响应格式无效:`, data);
        throw new Error('收到无效的响应格式');
      }

      const responseContent = data.choices[0].message.content;
      console.log(`【OpenRouterAdapter】LLM响应成功，内容长度: ${responseContent.length}`);
      
      // 打印令牌用量（如果有）
      if (data.usage) {
        console.log(`【OpenRouterAdapter】LLM令牌用量: 提示=${data.usage.prompt_tokens || 0}, 完成=${data.usage.completion_tokens || 0}, 总计=${data.usage.total_tokens || 0}`);
      }

      return responseContent;
    } catch (error) {
      console.error(`【OpenRouterAdapter】LLM请求失败:`, error);
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
    console.log(`【OpenRouterAdapter】使用API密钥: ${this.maskApiKey(this.apiKey)}`);
    
    try {
      // Check if cloud service is enabled and use it if available
      let response;
      const requestUrl = `${this.baseUrl}/models`;
      
      if (CloudServiceProvider.isEnabled()) {
        console.log('【OpenRouterAdapter】使用云服务获取模型列表');
        
        // Forward the request through the cloud service
        response = await CloudServiceProvider.forwardRequest(
          requestUrl,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://github.com', // Required header
              'X-Title': 'AI Chat App'  // Add application identifier
            }
          },
          'openrouter'
        );
      } else {
        // Use direct API call if cloud service is not enabled
        response = await fetch(requestUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://github.com', // Required header
            'X-Title': 'AI Chat App'  // Add application identifier
          }
        });
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`【OpenRouterAdapter】获取模型列表失败(${response.status}): ${text}`);
        
        let errorMessage = `获取模型列表失败: ${response.statusText}`;
        
        try {
          // Try to parse error JSON
          const errorData = JSON.parse(text);
          if (errorData.error?.message) {
            errorMessage = `获取模型列表失败: ${errorData.error.message}`;
          }
        } catch (e) {
          // Keep original error message
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Log model data structure for debugging
      console.log(`【OpenRouterAdapter】获取到 ${data.data?.length || 0} 个模型`);
      if (data.data?.length > 0) {
        console.log(`【OpenRouterAdapter】示例模型: ${data.data[0].id}`);
      }

      // Ensure we return an array even if the API response is unexpected
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('【OpenRouterAdapter】获取模型列表失败:', error);
      // Return empty array instead of throwing to make UI more resilient
      return [];
    }
  }
}
