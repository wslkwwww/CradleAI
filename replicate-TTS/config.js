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
  }
};
