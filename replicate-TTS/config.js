require('dotenv').config();

module.exports = {
  server: {
    port: 3002
  },
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN,
    apiUrl: 'https://api.replicate.com/v1/predictions'
  },
  minio: {
    endPoint: '152.69.219.182', // 本地访问的端点
    publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT || '152.69.219.182', // 公网访问的端点
    port: 19000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: 'tts-audio',
    templatesDir: 'templates' // MinIO 中模板目录
  },
  sourceFiles: {
    baseUrl: 'https://cradleintro.top'
  },
  // SSE 配置
  sse: {
    heartbeatInterval: 30000, // 30秒发送一次心跳
    clientTimeout: 120000 // 客户端连接超时时间 (2分钟)
  },
  // 消息队列配置
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    retryQueue: 'tts_retry_queue',
    deadLetterQueue: 'tts_dead_letter_queue'
  },
  // 重试机制配置
  retry: {
    maxRetries: 5, // 最大重试次数
    initialInterval: 30000, // 初始重试间隔 (30秒)
    multiplier: 2, // 指数退避倍率
    maxInterval: 600000 // 最大重试间隔 (10分钟)
  },
  // 许可证 API 配置
  license: {
    apiUrl: process.env.LICENSE_API_URL || 'https://license.cradleintro.top',
    creditPerSecond: process.env.CREDIT_PER_SECOND ? parseFloat(process.env.CREDIT_PER_SECOND) : 0.01, // 每秒费用
    minRequiredBalance: process.env.MIN_REQUIRED_BALANCE ? parseFloat(process.env.MIN_REQUIRED_BALANCE) : 1.0, // 最低所需余额
    adminToken: process.env.LICENSE_ADMIN_TOKEN || 'test2' // 管理员令牌，用于扣除余额等操作
  }
};
