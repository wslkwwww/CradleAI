const Replicate = require('replicate');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

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
  
  // 设置全局对象
  if (typeof global.fetch === 'undefined') global.fetch = fetch;
  if (typeof global.Headers === 'undefined') global.Headers = Headers;
  if (typeof global.Request === 'undefined') global.Request = Request;
  if (typeof global.Response === 'undefined') global.Response = Response;
} catch (error) {
  logger.warn('无法导入 node-fetch，将创建替代实现');
  
  // 提供基本的 Headers 实现
  Headers = class Headers {
    constructor(init = {}) {
      this.headers = {};
      if (init) {
        if (typeof init === 'object') {
          Object.keys(init).forEach(key => {
            this.append(key, init[key]);
          });
        }
      }
    }
    
    append(name, value) {
      const key = name.toLowerCase();
      this.headers[key] = String(value);
    }
    
    get(name) {
      return this.headers[name.toLowerCase()];
    }
    
    has(name) {
      return name.toLowerCase() in this.headers;
    }
    
    set(name, value) {
      this.headers[name.toLowerCase()] = String(value);
    }
    
    delete(name) {
      delete this.headers[name.toLowerCase()];
    }
    
    // 将 Headers 转换为普通对象以供 axios 使用
    toObject() {
      return {...this.headers};
    }
  };
  
  // 提供基本的 fetch 实现
  fetch = async (url, options = {}) => {
    logger.debug(`使用 axios 替代 fetch 发送请求到: ${url}`);
    
    try {
      // 处理 headers，确保它们是有效的字符串
      let headers = {};
      if (options.headers) {
        if (options.headers instanceof Headers) {
          headers = options.headers.toObject();
        } else {
          // 确保所有头部值都是字符串
          Object.keys(options.headers).forEach(key => {
            if (options.headers[key] !== undefined && options.headers[key] !== null) {
              headers[key] = String(options.headers[key]);
            }
          });
        }
      }
      
      const response = await axios({
        url,
        method: options.method || 'GET',
        headers: headers,
        data: options.body,
        responseType: 'arraybuffer',
        validateStatus: () => true // 允许所有状态码
      });
      
      const responseData = response.data;
      const isJsonResponse = (response.headers['content-type'] || '').includes('application/json');
      
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        json: async () => {
          if (isJsonResponse) {
            return JSON.parse(responseData.toString());
          }
          try {
            return JSON.parse(responseData.toString());
          } catch (e) {
            logger.error('Response is not JSON:', e);
            throw new Error('Response is not JSON');
          }
        },
        text: async () => responseData.toString(),
        buffer: async () => responseData
      };
    } catch (error) {
      logger.error('Fetch error:', error);
      throw error;
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
  
  // 设置全局对象
  if (typeof global.fetch === 'undefined') global.fetch = fetch;
  if (typeof global.Headers === 'undefined') global.Headers = Headers;
  if (typeof global.Request === 'undefined') global.Request = Request;
  if (typeof global.Response === 'undefined') global.Response = Response;
}

class ReplicateService {
  constructor() {
    try {
      logger.info('初始化 Replicate 服务...');
      logger.info(`API Token 是否设置: ${!!config.replicate.apiToken}`);
      if (!config.replicate.apiToken) {
        logger.error('错误: 未设置 Replicate API Token');
        throw new Error('Replicate API Token 未设置');
      }

      this.replicate = new Replicate({
        auth: config.replicate.apiToken,
      });
      
      if (typeof this.replicate._fetch !== 'function') {
        logger.info('设置 Replicate._fetch 函数');
        this.replicate._fetch = fetch;
      }
      
      this.modelId = `${config.replicate.modelId}:${config.replicate.modelVersion}`;
      logger.info(`模型 ID: ${this.modelId}`);
    } catch (error) {
      logger.error('初始化 Replicate 客户端出错:', error);
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
      logger.error('Error creating prediction:', error);
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
      logger.debug(`获取预测 ID: ${predictionId}`);
      const prediction = await this.replicate.predictions.get(predictionId);
      return prediction;
    } catch (error) {
      logger.error('Error getting prediction:', error);
      
      // 添加更详细的错误信息
      const errorMessage = error.response 
        ? `Status: ${error.response.status}, Message: ${JSON.stringify(error.response.data || {})}`
        : error.message;
        
      throw new Error(`Failed to get prediction: ${errorMessage}`);
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
      try {
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
      } catch (error) {
        if (attempts >= maxAttempts / 2) {
          throw error; // Only throw if we've tried several times
        }
        logger.warn(`Error polling prediction (attempt ${attempts}), will retry: ${error.message}`);
        // Increase wait time on error
        await new Promise(resolve => setTimeout(resolve, interval * 2));
        attempts++;
      }
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
      logger.error('Error downloading image:', error);
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }
}

module.exports = new ReplicateService();
