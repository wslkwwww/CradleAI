const axios = require('axios');
const logger = require('../utils/logger');
const spaceManager = require('../models/spaceManager');
const config = require('../config');

/**
 * 调用 Hugging Face Space API
 * @param {String} url - Hugging Face Space URL
 * @param {String} password - Hugging Face Space 密码
 * @param {Object} requestData - 请求数据，包含model和messages
 * @returns {Promise<Object>} - API 响应
 */
async function callHuggingFaceSpace(url, password, requestData) {
  try {
    logger.info('Calling Hugging Face Space', { 
      url,
      model: requestData.model,
      messageCount: requestData.messages?.length || 0
    });

    // 确保URL有效
    if (!url || url.includes('/example/')) {
      throw new Error('Invalid Hugging Face Space URL');
    }

    // 在发送到HF Space之前，确保将所有消息中的'model'角色转换为'assistant'
    // 这是因为HF Space API期望'assistant'角色，而不是'model'角色
    const mappedMessages = requestData.messages.map(msg => ({
      ...msg,
      role: msg.role === 'model' ? 'assistant' : msg.role
    }));

    const spaceRequestData = {
      ...requestData,
      messages: mappedMessages
    };

    // 记录转换后的消息，便于调试
    logger.debug('Role mapping for Hugging Face Space', {
      originalMessages: requestData.messages.map(m => ({role: m.role})),
      mappedMessages: mappedMessages.map(m => ({role: m.role}))
    });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${password}`
    };

    logger.debug('Debug - Full request details', { 
      url, 
      headers: { 
        'Content-Type': headers['Content-Type'],
        'Authorization': 'Bearer ****' // 隐藏实际密码
      }, 
      data: spaceRequestData
    });

    const response = await axios.post(url, spaceRequestData, { headers });
    
    logger.info('Hugging Face Space call successful', {
      url,
      model: requestData.model,
      status: response.status
    });
    
    return response.data;
  } catch (error) {
    logger.error('Hugging Face Space call failed', {
      url,
      error: error.message,
      statusCode: error.response?.status,
      data: error.response?.data
    });
    
    // 重新抛出错误，添加更多上下文信息
    if (error.response) {
      throw {
        status: error.response.status,
        message: `Request failed with status code ${error.response.status}`,
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

/**
 * 处理 Hugging Face Space 请求
 * @param {String} licenseKey - 许可证密钥
 * @param {Object} requestData - 请求数据
 * @returns {Promise<Object>} - 处理结果
 */
async function processHuggingFaceRequest(licenseKey, requestData) {
  // 现在我们直接从配置中获取第一个可用的空间，而不是使用空间管理器
  // 这是一个临时的解决方案，稍后可以重新实现空间分配逻辑
  if (!config.huggingFace.spaces || config.huggingFace.spaces.length === 0) {
    logger.error('No Hugging Face Spaces configured');
    throw {
      status: 503,
      message: 'No available Hugging Face Space'
    };
  }
  
  // 使用第一个配置的空间
  const spaceInfo = config.huggingFace.spaces[0];
  
  logger.info('Using Hugging Face Space', { 
    url: spaceInfo.url, 
    licenseKey: licenseKey.substring(0, 4) + '****' 
  });
  
  // 调用 Hugging Face Space
  const result = await callHuggingFaceSpace(
    spaceInfo.url,
    spaceInfo.password,
    requestData
  );
  
  return result;
}

/**
 * 获取所有配置的Hugging Face Spaces
 */
function getConfiguredSpaces() {
  return config.huggingFace.spaces.map((space, index) => ({
    id: index,
    url: space.url,
    active: space.active !== false
  }));
}

module.exports = {
  callHuggingFaceSpace,
  processHuggingFaceRequest,
  getConfiguredSpaces
};
