#!/bin/bash

echo "==== Replicate Text2Img 兼容性安装脚本 ===="
echo "此脚本将安装必要的依赖并应用补丁以确保与 Replicate API 的兼容性"

# 检查 Node.js 版本
NODE_VERSION=$(node -v)
echo "检测到 Node.js 版本: $NODE_VERSION"

# 安装依赖
echo "正在安装必要的依赖..."
npm install node-fetch@2 form-data@4 abort-controller@3

# 创建 .env 文件（如果不存在）
if [ ! -f .env ]; then
  echo "创建示例 .env 文件..."
  cp .env.example .env 2>/dev/null || echo "PORT=3000
REPLICATE_API_TOKEN=your_token_here
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=images
MINIO_USE_SSL=false
RABBITMQ_URL=amqp://guest:guest@localhost:5672
MAX_RETRIES=3
RETRY_INITIAL_INTERVAL=10000
LOG_LEVEL=info" > .env
  echo "请编辑 .env 文件并设置您的 REPLICATE_API_TOKEN"
fi

# 应用补丁
echo "正在应用 Replicate 兼容性补丁..."
node patches/replicate-patch.js

echo "安装完成！"
echo "您可以通过以下命令启动服务："
echo "npm start         # 单进程模式"
echo "npm run start:cluster # 集群模式（生产环境推荐）"
