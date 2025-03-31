const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  // 记录请求开始
  const start = Date.now();
  
  // 记录基本请求信息
  logger.info(`Incoming request`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 在响应发送后记录完成信息
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Request completed`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
}

module.exports = requestLogger;
