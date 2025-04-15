const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const LICENSE_API_URL = config.license.apiUrl;
const ADMIN_TOKEN = config.license.adminToken;

/**
 * 验证许可证
 * @param {string} licenseKey - 许可证密钥
 * @param {string} deviceId - 设备ID
 * @returns {Promise<Object>} - 许可证信息
 */
async function verifyLicense(licenseKey, deviceId) {
  try {
    logger.info('Verifying license', { 
      licenseKey, 
      deviceIdPrefix: deviceId?.substring(0, 4) 
    });
    
    // 确保包含 device_id 参数
    const response = await axios.post(`${LICENSE_API_URL}/api/v1/license/verify`, {
      license_key: licenseKey,
      device_id: deviceId
    });
    
    logger.info('License verification result', {
      success: response.data.success,
      planId: response.data.license_info?.plan_id
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error('License verification failed with response', {
        status: error.response.status,
        data: error.response.data
      });
      return { 
        success: false, 
        error: error.response.data?.error || error.message 
      };
    } else {
      logger.error('License verification failed', { error: error.message });
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

/**
 * 查询许可证余额
 * @param {string} email - 用户邮箱
 * @returns {Promise<Object>} - 余额信息
 */
async function checkBalance(email) {
  try {
    if (!email) {
      logger.warn('Checking balance without email');
      return { success: false, error: 'Email is required' };
    }

    logger.info('Checking license balance', { email });
    
    // 调用API检查余额
    const response = await axios.get(`${LICENSE_API_URL}/api/v1/license/balance/${email}`);
    
    logger.info('Balance check result', {
      success: response.data.success,
      credits: response.data.credits
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error('Balance check failed with response', {
        status: error.response.status,
        data: error.response.data
      });
      return { 
        success: false, 
        error: error.response.data?.error || error.message,
        credits: 0
      };
    } else {
      logger.error('Balance check failed', { error: error.message });
      return { 
        success: false, 
        error: error.message,
        credits: 0
      };
    }
  }
}

/**
 * 扣除许可证余额
 * @param {string} email - 用户邮箱
 * @param {number} amount - 扣除金额
 * @returns {Promise<Object>} - 扣除结果
 */
async function deductCredits(email, amount) {
  try {
    if (!email) {
      logger.warn('Deducting credits without email');
      return { success: false, error: 'Email is required' };
    }

    logger.info('Deducting license credits', { email, amount });
    
    // 调用API扣除余额
    const response = await axios.post(`${LICENSE_API_URL}/api/v1/license/deduct`, {
      email,
      amount
    }, {
      headers: {
        'X-Admin-Token': ADMIN_TOKEN
      }
    });
    
    logger.info('Credit deduction result', {
      success: response.data.success,
      remaining: response.data.remaining_credits
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error('Credit deduction failed with response', {
        status: error.response.status,
        data: error.response.data
      });
      return { 
        success: false, 
        error: error.response.data?.error || error.message 
      };
    } else {
      logger.error('Credit deduction failed', { error: error.message });
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

module.exports = {
  verifyLicense,
  checkBalance,
  deductCredits
};
