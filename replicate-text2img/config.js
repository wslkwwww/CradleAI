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
    useSSL: process.env.MINIO_USE_SSL === 'true'
  }
};
