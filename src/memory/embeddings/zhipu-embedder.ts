import { Embedder } from './base';
import { EmbeddingConfig } from '../types';

/**
 * 智谱清言嵌入器实现
 * 用于将文本转换为向量表示
 */
export class ZhipuEmbedder implements Embedder {
  private config: EmbeddingConfig;
  private dimensions: number;
  private apiUrl: string;
  private fallbackVector: number[] | null = null;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.dimensions = config.dimensions || 1024; // 默认使用1024维度
    this.apiUrl = config.url || 'https://open.bigmodel.cn/api/paas/v4/embeddings';
    
    // 验证API密钥
    if (!this.config.apiKey) {
      console.warn('[ZhipuEmbedder] 警告：API密钥未设置，将使用随机向量作为备用');
      // 创建一个0.5附近的随机向量作为备用
      this.createFallbackVector();
    } else {
      console.log(`[ZhipuEmbedder] 初始化完成，使用模型: ${this.config.model || 'embedding-3'}, 维度: ${this.dimensions}`);
    }
  }

  /**
   * 创建备用向量（在API调用失败时使用）
   */
  private createFallbackVector(): void {
    if (!this.fallbackVector) {
      this.fallbackVector = Array(this.dimensions).fill(0).map(() => 0.4 + Math.random() * 0.2);
      // 归一化向量
      const magnitude = Math.sqrt(this.fallbackVector.reduce((sum, val) => sum + val * val, 0));
      this.fallbackVector = this.fallbackVector.map(val => val / magnitude);
      console.log(`[ZhipuEmbedder] 已创建${this.dimensions}维备用向量`);
    }
  }

  /**
   * 更新API密钥
   * @param apiKey 新的API密钥
   */
  updateApiKey(apiKey: string): void {
    const prevKeyStatus = this.config.apiKey ? '已设置' : '未设置';
    const newKeyStatus = apiKey ? '已设置' : '未设置';
    
    console.log(`[ZhipuEmbedder] 更新API密钥: ${prevKeyStatus} -> ${newKeyStatus}`);
    
    // Skip if the same key is provided
    if (this.config.apiKey === apiKey) {
      console.log('[ZhipuEmbedder] 相同的API密钥，跳过更新');
      return;
    }
    
    this.config.apiKey = apiKey;
    
    // Reset fallback vector when we get a valid key
    if (apiKey && this.fallbackVector) {
      console.log('[ZhipuEmbedder] 有效的API密钥已设置，清除备用向量');
      this.fallbackVector = null;
    }
  }

  /**
   * 尝试从用户设置中获取智谱API密钥
   * 这是一个紧急修复方案，用于处理配置未正确传递的情况
   */
  private async tryGetApiKeyFromSettings(): Promise<string | null> {
    try {
      // 尝试从localStorage获取用户设置
      if (typeof localStorage !== 'undefined') {
        const settingsStr = localStorage.getItem('user_settings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          const zhipuApiKey = settings?.chat?.zhipuApiKey;
          if (zhipuApiKey) {
            console.log('[ZhipuEmbedder] 已从localStorage获取智谱API密钥');
            // 更新当前实例的配置
            this.config.apiKey = zhipuApiKey;
            return zhipuApiKey;
          }
        }
      }
      
      // 如果在React Native环境中，尝试从AsyncStorage获取
      if (typeof require !== 'undefined') {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const settingsStr = await AsyncStorage.getItem('user_settings');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            const zhipuApiKey = settings?.chat?.zhipuApiKey;
            if (zhipuApiKey) {
              console.log('[ZhipuEmbedder] 已从AsyncStorage获取智谱API密钥');
              // 更新当前实例的配置
              this.config.apiKey = zhipuApiKey;
              return zhipuApiKey;
            }
          }
        } catch (e) {
          console.log('[ZhipuEmbedder] 尝试从AsyncStorage获取密钥失败:', e);
        }
      }
    } catch (error) {
      console.error('[ZhipuEmbedder] 尝试从设置获取API密钥失败:', error);
    }
    return null;
  }

  /**
   * 嵌入单个文本
   * @param text 要嵌入的文本
   * @returns 嵌入向量
   */
  async embed(text: string): Promise<number[]> {
    // 如果API密钥未设置，尝试从设置中获取
    if (!this.config.apiKey) {
      console.log('[ZhipuEmbedder] API密钥未设置，尝试从设置获取');
      const apiKey = await this.tryGetApiKeyFromSettings();
      if (!apiKey) {
        console.warn('[ZhipuEmbedder] 无法获取智谱API密钥，使用备用向量');
        this.createFallbackVector();
        return this.fallbackVector!;
      } else {
        console.log('[ZhipuEmbedder] 成功从设置获取智谱API密钥');
      }
    }

    try {
      // 只打印前50个字符，避免日志过长
      const textPreview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      console.log(`[ZhipuEmbedder] 开始嵌入文本: "${textPreview}"`);
      
      // 构建请求体
      const requestBody = {
        model: this.config.model || 'embedding-3',
        input: text,
        dimensions: this.dimensions
      };

      // 发送嵌入请求
      console.log(`[ZhipuEmbedder] 发送嵌入请求到: ${this.apiUrl}, 使用模型: ${requestBody.model}, 维度: ${this.dimensions}`);
      
      const startTime = Date.now();
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      const endTime = Date.now();
      
      console.log(`[ZhipuEmbedder] 接收到响应, HTTP状态码: ${response.status}, 耗时: ${endTime - startTime}ms`);

      // 处理响应
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`智谱API错误: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      // 智谱API返回格式: { data: [{ embedding: number[], index: 0, object: 'embedding' }], ... }
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('智谱API响应格式无效: 缺少嵌入向量');
      }

      const embedding = data.data[0].embedding;
      console.log(`[ZhipuEmbedder] 成功获取嵌入向量, 维度: ${embedding.length}`);
      
      return embedding;
    } catch (error) {
      console.error('[ZhipuEmbedder] 嵌入文本失败:', error);
      // 在出错时使用备用向量
      console.log('[ZhipuEmbedder] 使用备用向量');
      this.createFallbackVector();
      return this.fallbackVector!;
    }
  }

  /**
   * 批量嵌入多个文本
   * @param texts 要嵌入的文本数组
   * @returns 嵌入向量数组
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // 如果API密钥未设置，尝试从设置中获取
    if (!this.config.apiKey) {
      console.log('[ZhipuEmbedder] 批量嵌入: API密钥未设置，尝试从设置获取');
      const apiKey = await this.tryGetApiKeyFromSettings();
      if (!apiKey) {
        console.warn('[ZhipuEmbedder] 无法获取智谱API密钥，批量使用备用向量');
        this.createFallbackVector();
        return texts.map(() => this.fallbackVector!);
      } else {
        console.log('[ZhipuEmbedder] 成功从设置获取智谱API密钥');
      }
    }

    try {
      console.log(`[ZhipuEmbedder] 开始批量嵌入 ${texts.length} 条文本`);
      
      // 智谱API支持批量嵌入，一次请求最大64条
      const batchSize = 64;
      const results: number[][] = [];

      // 分批处理请求
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        console.log(`[ZhipuEmbedder] 处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}, 包含 ${batch.length} 条文本`);
        
        // 构建请求体
        const requestBody = {
          model: this.config.model || 'embedding-3',
          input: batch,
          dimensions: this.dimensions
        };

        // 发送嵌入请求
        const startTime = Date.now();
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        const endTime = Date.now();
        
        console.log(`[ZhipuEmbedder] 批次处理完成, HTTP状态码: ${response.status}, 耗时: ${endTime - startTime}ms`);

        // 处理响应
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
          throw new Error(`智谱API错误: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        // 校验响应格式
        if (!data.data || !Array.isArray(data.data)) {
          throw new Error('智谱API响应格式无效: 缺少嵌入向量数组');
        }

        // 按顺序获取每个文本的嵌入向量
        const batchResults = data.data.map((item: any) => {
          if (!item.embedding) {
            throw new Error('智谱API响应缺少嵌入向量');
          }
          return item.embedding;
        });

        results.push(...batchResults);
        console.log(`[ZhipuEmbedder] 成功处理批次，获取 ${batchResults.length} 个嵌入向量`);
      }

      console.log(`[ZhipuEmbedder] 批量嵌入完成，共生成 ${results.length} 个嵌入向量`);
      return results;
    } catch (error) {
      console.error('[ZhipuEmbedder] 批量嵌入文本失败:', error);
      // 在出错时，为每个文本生成一个备用向量
      console.log('[ZhipuEmbedder] 使用备用向量');
      this.createFallbackVector();
      return texts.map(() => this.fallbackVector!);
    }
  }
}
