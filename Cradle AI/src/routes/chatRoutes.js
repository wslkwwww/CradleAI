const express = require('express');
const router = express.Router();
const openRouterService = require('../services/openRouterService');
const { validateChatCompletionRequest } = require('../middleware/validateRequest');

/**
 * Chat Completion API 端点
 * POST /api/chat/completion
 */
router.post('/completion', validateChatCompletionRequest, async (req, res, next) => {
  try {
    // 转发请求到 OpenRouter
    const response = await openRouterService.chatCompletion(req.body);
    
    // 将响应返回给客户端
    res.json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
