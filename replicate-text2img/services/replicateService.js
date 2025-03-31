const Replicate = require('replicate');
const axios = require('axios');
const config = require('../config');

// 导入 node-fetch
let fetch;
let Headers;
let Request;
let Response;

try {
  // 尝试导入 node-fetch@2 (CommonJS 方式)
  const nodeFetch = require('node-fetch');
  fetch = nodeFetch.default || nodeFetch;
  Headers = nodeFetch.Headers;
  Request = nodeFetch.Request;
  Response = nodeFetch.Response;
} catch (error) {
  console.warn('无法导入 node-fetch，将创建替代实现');
  
  // 提供基本的 fetch 实现
  fetch = async (url, options = {}) => {
    console.log(`使用 axios 替代 fetch 发送请求到: ${url}`);
    const response = await axios({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      data: options.body,
      responseType: 'arraybuffer'
    });
    
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: async () => JSON.parse(response.data.toString()),
      text: async () => response.data.toString(),
      buffer: async () => response.data
    };
  };
  
  // 提供基本的 Headers 实现
  Headers = class Headers {
    constructor(init = {}) {
      this.headers = {};
      Object.keys(init).forEach(key => {
        this.headers[key.toLowerCase()] = init[key];
      });
    }
    
    append(name, value) {
      this.headers[name.toLowerCase()] = value;
    }
    
    get(name) {
      return this.headers[name.toLowerCase()];
    }
    
    has(name) {
      return name.toLowerCase() in this.headers;
    }
    
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
    }
    
    delete(name) {
      delete this.headers[name.toLowerCase()];
    }
  };
  
  // 基本的 Request 和 Response 类
  Request = class Request {
    constructor(input, init = {}) {
      this.url = input;
      this.options = init;
    }
  };
  
  Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || '';
      this.headers = new Headers(init.headers);
    }
    
    async json() {
      return JSON.parse(this.body);
    }
    
    async text() {
      return this.body.toString();
    }
  };
}

class ReplicateService {
  constructor() {
    // 确保所有 fetch API 相关的类都在全局可用
    if (typeof global.fetch === 'undefined') {
      global.fetch = fetch;
      console.log('全局 fetch 已设置');
    }
    
    if (typeof global.Headers === 'undefined') {
      global.Headers = Headers;
      console.log('全局 Headers 已设置');
    }
    
    if (typeof global.Request === 'undefined') {
      global.Request = Request;
      console.log('全局 Request 已设置');
    }
    
    if (typeof global.Response === 'undefined') {
      global.Response = Response;
      console.log('全局 Response 已设置');
    }
    
    // 修复 _fetch 错误
    if (Replicate.prototype && !Replicate.prototype._fetch) {
      Replicate.prototype._fetch = fetch;
      console.log('Replicate._fetch 已修复');
    }
    
    try {
      console.log('初始化 Replicate 服务...');
      console.log(`API Token 是否设置: ${!!config.replicate.apiToken}`);
      if (config.replicate.apiToken) {
        console.log(`API Token 长度: ${config.replicate.apiToken.length}`);
      } else {
        console.warn('警告: 未设置 API Token');
      }
      
      this.replicate = new Replicate({
        auth: config.replicate.apiToken,
        fetch: fetch
      });
      
      this.modelId = `${config.replicate.modelId}:${config.replicate.modelVersion}`;
      console.log(`模型 ID: ${this.modelId}`);
    } catch (error) {
      console.error('初始化 Replicate 客户端出错:', error);
      throw new Error(`无法初始化 Replicate 客户端: ${error.message}`);
    }
  }

  /**
   * Create a new image generation prediction
   * @param {Object} input - Input parameters for the model
   * @returns {Promise<Object>} - Prediction object
   */
  async createPrediction(input) {
    try {
      const prediction = await this.replicate.predictions.create({
        version: config.replicate.modelVersion,
        input: input,
      });
      return prediction;
    } catch (error) {
      console.error('Error creating prediction:', error);
      throw new Error(`Failed to create prediction: ${error.message}`);
    }
  }

  /**
   * Get a prediction by ID
   * @param {string} predictionId - The ID of the prediction
   * @returns {Promise<Object>} - The prediction object
   */
  async getPrediction(predictionId) {
    try {
      const prediction = await this.replicate.predictions.get(predictionId);
      return prediction;
    } catch (error) {
      console.error('Error getting prediction:', error);
      throw new Error(`Failed to get prediction: ${error.message}`);
    }
  }

  /**
   * Wait for a prediction to complete
   * @param {string} predictionId - The ID of the prediction
   * @param {number} maxAttempts - Maximum number of polling attempts
   * @param {number} interval - Polling interval in milliseconds
   * @returns {Promise<Object>} - The completed prediction object
   */
  async waitForPrediction(predictionId, maxAttempts = 60, interval = 2000) {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const prediction = await this.getPrediction(predictionId);
      
      if (prediction.status === 'succeeded') {
        return prediction;
      }
      
      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(`Prediction ${prediction.status}: ${prediction.error || 'Unknown error'}`);
      }
      
      // Wait before the next polling attempt
      await new Promise(resolve => setTimeout(resolve, interval));
      attempts++;
    }
    
    throw new Error('Prediction timed out');
  }

  /**
   * Download an image from a URL
   * @param {string} imageUrl - The URL of the image to download
   * @returns {Promise<Buffer>} - The image data as buffer
   */
  async downloadImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading image:', error);
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }
}

module.exports = new ReplicateService();
