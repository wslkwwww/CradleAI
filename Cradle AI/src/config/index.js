require('dotenv').config();

const config = {
  // OpenRouter API 配置
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    httpReferer: process.env.HTTP_REFERER,
    xTitle: process.env.X_TITLE
  },
  
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  
  // CORS 配置
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3001']
  },
  
  // 限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '50')
  }
};

// 配置验证
function validateConfig() {
  if (!config.openRouter.apiKey) {
    console.error('警告: OPENROUTER_API_KEY 环境变量未设置');
  }
}

validateConfig();

module.exports = config;
