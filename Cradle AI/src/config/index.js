require('dotenv').config();

const config = {
  // OpenRouter API 配置
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    httpReferer: process.env.HTTP_REFERER,
    xTitle: process.env.X_TITLE
  },
  
  // License API 配置
  license: {
    apiUrl: process.env.LICENSE_API_URL || 'https://license.cradleintro.top',
    adminToken: process.env.LICENSE_ADMIN_TOKEN || 'test2'
  },
  
  // Hugging Face Space 配置
  huggingFace: {
    spaces: []
  },
  
  // 管理员令牌
  adminToken: process.env.ADMIN_TOKEN || 'admin-secret-token',
  
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

// 从环境变量中加载Hugging Face Space配置
if (process.env.HF_SPACE_URL_1 && process.env.HF_SPACE_PASSWORD_1) {
  config.huggingFace.spaces.push({
    url: process.env.HF_SPACE_URL_1,
    password: process.env.HF_SPACE_PASSWORD_1,
    active: true
  });
}

if (process.env.HF_SPACE_URL_2 && process.env.HF_SPACE_PASSWORD_2) {
  config.huggingFace.spaces.push({
    url: process.env.HF_SPACE_URL_2,
    password: process.env.HF_SPACE_PASSWORD_2,
    active: true
  });
}

// 配置验证
function validateConfig() {
  if (!config.openRouter.apiKey) {
    console.error('警告: OPENROUTER_API_KEY 环境变量未设置');
  }
  
  if (config.huggingFace.spaces.length === 0) {
    console.error('警告: 未配置任何 Hugging Face Spaces');
  } else {
    console.log(`已加载 ${config.huggingFace.spaces.length} 个 Hugging Face Space 配置`);
    config.huggingFace.spaces.forEach((space, index) => {
      console.log(`Space ${index + 1}: ${space.url.substring(0, 25)}...`);
    });
  }
}

validateConfig();

module.exports = config;
