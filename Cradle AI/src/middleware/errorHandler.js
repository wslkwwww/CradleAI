const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // 记录错误日志
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // 确定 HTTP 状态码
  const statusCode = err.status || 500;

  // 构建错误响应
  const errorResponse = {
    error: {
      message: err.message || 'Internal server error',
      status: statusCode
    }
  };

  // 在开发环境中添加更多详细信息
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.stack = err.stack;
    if (err.data) {
      errorResponse.error.data = err.data;
    }
  }

  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;
