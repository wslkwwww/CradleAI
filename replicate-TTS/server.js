const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const ttsController = require('./controllers/ttsController');

// 创建 Express 应用
const app = express();

// 中间件配置
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// TTS 路由
app.post('/api/tts', ttsController.generateAudio.bind(ttsController));

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Service is running' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 启动服务器
app.listen(config.server.port, () => {
  console.log(`TTS Server running on port ${config.server.port}`);
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
