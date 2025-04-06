// Load environment variables first
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const ttsController = require('./controllers/ttsController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cluster = require('cluster');
const os = require('os');
const logger = require('./utils/logger');

// 确定是否在集群模式下运行
const CLUSTER_MODE = process.env.NODE_ENV === 'production' && process.env.DISABLE_CLUSTERING !== 'true';
const numCPUs = os.cpus().length;

// Log environment information
logger.info(`Starting server with NODE_ENV=${process.env.NODE_ENV}`);
logger.info(`RabbitMQ configuration: ${process.env.RABBITMQ_URL ? 'Found' : 'Missing'}`);

if (CLUSTER_MODE && cluster.isMaster) {
  logger.info(`Master process ${process.pid} is running`);
  
  // 根据 CPU 核心数创建工作进程
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}. Restarting...`);
    cluster.fork();
  });
} else {
  // 创建 Express 应用
  const app = express();
  
  // 设置 trust proxy 为 true，解决 X-Forwarded-For 错误
  // 这对于在代理后面运行的应用程序很重要（例如 Nginx）
  app.set('trust proxy', true);
  logger.info('Express trust proxy setting enabled');

  // 安全和性能中间件
  app.use(helmet({ 
    // 允许 SSE 内联脚本
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "http:", "https:"]
      }
    }
  }));
  app.use(compression()); // 响应压缩
  
  // 请求大小限制 - 避免过大的 JSON 负载
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
  
  // API 请求限流器 - 每个 IP 每分钟最多 60 个请求
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 60, // 每个IP每分钟限制请求数
    message: { success: false, error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // SSE 连接的限流器 - 更宽松的限制
  const sseLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 20, // 每个IP每分钟最多创建20个SSE连接
    message: { success: false, error: 'Too many SSE connections, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // 将限流器应用于 API 路由
  app.use('/api/', apiLimiter);
  app.use('/events', sseLimiter);
  
  // 记录请求的简单中间件
  app.use((req, res, next) => {
    // 在生产环境中减少日志输出
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`${req.method} ${req.url}`);
      if (req.method === 'POST') {
        logger.debug(`Request body hash: ${hashCode(JSON.stringify(req.body))}`);
      }
    } else if (req.method === 'POST' && !req.url.includes('/events')) {
      // 在生产环境中，仅记录非SSE的POST请求
      logger.info(`${req.method} ${req.url}`);
    }
    next();
  });

  // TTS 路由 - 添加请求超时处理
  app.post('/api/tts', (req, res) => {
    // 设置一个较长的超时时间，因为语音生成可能需要较长时间
    req.setTimeout(120000); // 2分钟超时
    ttsController.generateAudio(req, res);
  });
  
  // 任务重试路由
  app.post('/api/tts/retry', (req, res) => {
    ttsController.retryGenerateAudio(req, res);
  });
  
  // 任务状态查询路由
  app.get('/api/tts/task/:taskId', (req, res) => {
    ttsController.getTaskStatus(req, res);
  });

  // SSE 状态更新路由 - 使用专门的限流器
  app.get('/events', (req, res) => {
    ttsController.handleSSE(req, res);
  });
  
  // 健康检查路由
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      message: 'Service is running',
      workerId: process.pid,
      uptime: process.uptime()
    });
  });
  
  // 系统信息路由 - 用于监控
  app.get('/system', (req, res) => {
    res.status(200).json({
      status: 'OK',
      workerId: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: os.cpus().length,
      load: os.loadavg()
    });
  });

  // 错误处理中间件
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message || 'Unknown error'
    });
  });

  // 404 处理
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found'
    });
  });

  // Simple hash function for logging
  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  // 启动服务器
  app.listen(config.server.port, () => {
    logger.info(`Worker ${process.pid}: TTS Server running on port ${config.server.port}`);
  });
  
  // 优雅关闭
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received. Shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received. Shutting down gracefully');
    process.exit(0);
  });
}
