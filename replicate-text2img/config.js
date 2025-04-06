require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN,
    modelId: "aisha-ai-official/animagine-xl-4.0",
    modelVersion: "057e2276ac5dcd8d1575dc37b131f903df9c10c41aed53d47cd7d4f068c19fa5"
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucketName: process.env.MINIO_BUCKET_NAME || 'images',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT // 可选的公共访问端点
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    queues: {
      generation: 'img_generation_queue',
      retry: 'img_retry_queue',
      deadLetter: 'img_dead_letter_queue'
    }
  },
  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    initialInterval: parseInt(process.env.RETRY_INITIAL_INTERVAL || '10000'),
    multiplier: 2,
    maxInterval: 300000 // 最大重试间隔5分钟
  },
  sse: {
    heartbeatInterval: 30000, // 30秒发送一次心跳
    clientTimeout: 120000 // 2分钟超时
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: 'logs'
  }
};
