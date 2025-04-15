const express = require('express');
const router = express.Router();
const huggingfaceService = require('../services/huggingfaceService');
const licenseService = require('../services/licenseService');
const { validateHuggingFaceRequest } = require('../middleware/validateRequest');
const logger = require('../utils/logger');
const config = require('../config');

// 每日请求跟踪（内存中）
const dailyRequestTracker = new Map(); // licenseKey -> { date, count, deductedToday }

// 每日首次请求的扣费金额
const DAILY_FIRST_REQUEST_CHARGE = 0.33; // 修改为0.33

// 清理函数，每天00:00执行
function setupDailyCleanup() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow - now;
  
  setTimeout(() => {
    dailyRequestTracker.clear();
    logger.info('Daily request tracker cleared');
    // 设置下一次清理
    setupDailyCleanup();
  }, timeUntilMidnight);
  
  logger.info('Daily cleanup scheduled', { 
    timeUntilMidnight: `${Math.round(timeUntilMidnight / 1000 / 60)} minutes`
  });
}

// 设置每日清理
setupDailyCleanup();

/**
 * 检查并记录每日请求
 * @param {String} licenseKey - 许可证密钥
 * @returns {Object} - 包含是否是当日首次请求以及是否需要扣款的信息
 */
function checkAndRecordDailyRequest(licenseKey) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const record = dailyRequestTracker.get(licenseKey);
  if (!record || record.date !== today) {
    // 新的一天，第一次请求
    dailyRequestTracker.set(licenseKey, { 
      date: today, 
      count: 1, 
      deductedToday: false // 标记今天尚未扣款
    });
    return { 
      isFirstToday: true,
      needDeduction: true // 需要扣款
    };
  }
  
  // 今天已经有请求，增加计数
  record.count += 1;
  
  // 检查今天是否已扣款
  const needDeduction = !record.deductedToday;
  
  return { 
    isFirstToday: false,
    needDeduction: needDeduction
  };
}

/**
 * 记录扣款成功
 * @param {String} licenseKey - 许可证密钥
 */
function markDeductionComplete(licenseKey) {
  const record = dailyRequestTracker.get(licenseKey);
  if (record) {
    record.deductedToday = true;
    dailyRequestTracker.set(licenseKey, record);
    logger.info('Marked license as deducted for today', { licenseKey });
  }
}

/**
 * Hugging Face Space 请求处理
 * POST /api/huggingface/completion
 */
router.post('/completion', validateHuggingFaceRequest, async (req, res, next) => {
  const { license_key, device_id, model, messages } = req.body;
  
  try {
    // 确保同时传递 license_key 和 device_id 参数用于验证
    logger.info('Processing Hugging Face request', { 
      licenseKey: license_key, 
      deviceIdPrefix: device_id?.substring(0, 4),
      model
    });

    // 1. 验证许可证 - 确保传递设备ID
    const licenseInfo = await licenseService.verifyLicense(license_key, device_id);
    
    if (!licenseInfo.success) {
      return res.status(401).json({
        error: {
          message: 'Invalid license key or device ID',
          status: 401
        }
      });
    }
    
    const email = licenseInfo.license_info?.email;
    
    if (!email) {
      logger.warn('License verification succeeded but email is missing', { licenseKey: license_key });
    }
    
    // 2. 检查余额
    const balanceInfo = await licenseService.checkBalance(email);
    
    if (!balanceInfo.success) {
      return res.status(400).json({
        error: {
          message: 'Failed to check license balance',
          status: 400
        }
      });
    }
    
    const credits = balanceInfo.credits;
    
    // 3. 检查是否需要扣款（第一次请求且当天未扣款）
    const { isFirstToday, needDeduction } = checkAndRecordDailyRequest(license_key);
    
    if (needDeduction) {
      logger.info('Daily deduction required', { 
        license_key, 
        email,
        deviceIdPrefix: device_id?.substring(0, 4),
        amount: DAILY_FIRST_REQUEST_CHARGE
      });
      
      // 检查余额是否足够
      if (credits < DAILY_FIRST_REQUEST_CHARGE) {
        return res.status(402).json({
          error: {
            message: `Insufficient balance. Required: ${DAILY_FIRST_REQUEST_CHARGE}, Available: ${credits}`,
            status: 402
          }
        });
      }
      
      // 扣除余额
      const deductResult = await licenseService.deductCredits(email, DAILY_FIRST_REQUEST_CHARGE);
      if (deductResult.success) {
        // 扣款成功，标记该许可证当天已扣款
        markDeductionComplete(license_key);
        logger.info('Credits deducted for daily first request', { 
          license_key, 
          email, 
          amount: DAILY_FIRST_REQUEST_CHARGE 
        });
      } else {
        logger.error('Failed to deduct credits', {
          license_key,
          email,
          error: deductResult.error || 'Unknown error'
        });
        // 即使扣款失败，我们仍然处理请求，但记录错误
      }
    } else {
      logger.info('No deduction needed - already processed today', { 
        license_key,
        requestCount: dailyRequestTracker.get(license_key)?.count || 0
      });
    }
    
    // 4. 准备请求数据并调用 Hugging Face Space
    const requestData = { model, messages };
    const response = await huggingfaceService.processHuggingFaceRequest(license_key, requestData);
    
    // 5. 返回 Hugging Face Space 响应
    res.json(response);
    
  } catch (error) {
    next(error);
  }
});

/**
 * 获取空间使用统计（管理员 API）
 * GET /api/huggingface/spaces/usage
 */
router.get('/spaces/usage', async (req, res, next) => {
  try {
    // 检查管理员令牌
    const adminToken = req.header('X-Admin-Token');
    if (adminToken !== config.adminToken) {
      return res.status(401).json({
        error: {
          message: 'Unauthorized',
          status: 401
        }
      });
    }
    
    const spaceManager = require('../models/spaceManager');
    const usage = spaceManager.getSpacesUsage();
    
    res.json({
      success: true,
      usage,
      dailyRequests: Array.from(dailyRequestTracker.entries()).map(([key, value]) => ({
        license_key: key,
        date: value.date,
        count: value.count
      }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
