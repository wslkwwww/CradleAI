const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const ttsController = require('./controllers/ttsController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cluster = require('cluster');
const os = require('os');

// 确定是否在集群模式下运行
const CLUSTER_MODE = process.env.NODE_ENV === 'production' && process.env.DISABLE_CLUSTERING !== 'true';
const numCPUs = os.cpus().length;

if (CLUSTER_MODE && cluster.isMaster) {
  console.log(`Master process ${process.pid} is running`);
  
  // 根据 CPU 核心数创建工作进程
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // 创建 Express 应用
  const app = express();

  // 安全和性能中间件
  app.use(helmet()); // 增强安全性
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
  
  // 将限流器应用于 API 路由
  app.use('/api/', apiLimiter);
  
  // 记录请求的简单中间件 - 生产环境下可考虑使用 morgan
  app.use((req, res, next) => {
    // 在生产环境中减少日志输出
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      if (req.method === 'POST') {
        console.log(`Request body hash: ${hashCode(JSON.stringify(req.body))}`);
      }
    }
    next();
  });

  // TTS 路由 - 添加请求超时处理
  app.post('/api/tts', (req, res) => {
    // 设置一个较长的超时时间，因为语音生成可能需要较长时间
    req.setTimeout(120000); // 2分钟超时
    ttsController.generateAudio(req, res);
  });

  // 健康检查路由
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      message: 'Service is running',
      workerId: process.pid 
    });
  });

  // 错误处理中间件
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
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
    console.log(`Worker ${process.pid}: TTS Server running on port ${config.server.port}`);
  });
  
  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received. Shutting down gracefully');
    process.exit(0);
  });
}
