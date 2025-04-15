const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const chatRoutes = require('./routes/chatRoutes');
const huggingfaceRoutes = require('./routes/huggingfaceRoutes');

// 创建 Express 应用
const app = express();

// 应用安全中间件
app.use(helmet());

// 配置 CORS
app.use(cors({
  origin: config.cors.allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 配置速率限制
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many requests, please try again later.',
      status: 429
    }
  }
});

// 应用速率限制中间件
app.use(limiter);

// 解析 JSON 请求体
app.use(express.json({ limit: '1mb' }));

// 请求日志中间件
app.use(requestLogger);

// API 路由
app.use('/api/chat', chatRoutes);
app.use('/api/huggingface', huggingfaceRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not Found',
      status: 404
    }
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Cradle AI server running on port ${PORT}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);
  
  if (!config.openRouter.apiKey) {
    logger.warn('OPENROUTER_API_KEY not set. API calls will fail!');
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
