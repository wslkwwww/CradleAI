const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * 调用 OpenRouter Chat Completion API
 * @param {Object} requestData - 请求数据
 * @returns {Promise<Object>} - API 响应
 */
async function chatCompletion(requestData) {
  try {
    logger.info('Calling OpenRouter API', { 
      model: requestData.model,
      messageCount: requestData.messages?.length || 0
    });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openRouter.apiKey}`
    };

    // 添加可选请求头
    if (config.openRouter.httpReferer) {
      headers['HTTP-Referer'] = config.openRouter.httpReferer;
    }

    if (config.openRouter.xTitle) {
      headers['X-Title'] = config.openRouter.xTitle;
    }

    const response = await axios.post(OPENROUTER_API_URL, requestData, { headers });
    
    logger.info('OpenRouter API call successful', {
      model: requestData.model,
      usage: response.data?.usage,
      id: response.data?.id
    });
    
    return response.data;
  } catch (error) {
    logger.error('OpenRouter API call failed', {
      error: error.message,
      statusCode: error.response?.status,
      data: error.response?.data
    });
    
    // 重新抛出错误，添加更多上下文信息
    if (error.response) {
      throw {
        status: error.response.status,
        message: error.response.data?.error?.message || error.message,
        data: error.response.data
      };
    } else {
      throw {
        status: 500,
        message: error.message,
        error: error
      };
    }
  }
}

module.exports = {
  chatCompletion
};
