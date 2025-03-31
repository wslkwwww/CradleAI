/**
 * 验证 Chat Completion 请求
 */
function validateChatCompletionRequest(req, res, next) {
  const { model, messages } = req.body;

  // 验证必需字段
  if (!model) {
    return res.status(400).json({
      error: {
        message: 'Missing required field: model',
        status: 400
      }
    });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: {
        message: 'Messages field must be a non-empty array',
        status: 400
      }
    });
  }

  // 验证消息格式
  const invalidMessage = messages.find(
    msg => !msg.role || !msg.content || !['system', 'user', 'assistant'].includes(msg.role)
  );

  if (invalidMessage) {
    return res.status(400).json({
      error: {
        message: 'Invalid message format. Each message must have a valid role (system, user, or assistant) and content',
        status: 400
      }
    });
  }

  // 验证通过，继续
  next();
}

module.exports = {
  validateChatCompletionRequest
};
