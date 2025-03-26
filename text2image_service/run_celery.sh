#!/bin/bash

# 设置工作目录
cd "$(dirname "$0")"

# 加载环境变量
set -a
source .env
set +a

# 输出Redis连接信息（不显示密码）
echo "INFO: 正在连接到Redis服务器 $REDIS_HOST:$REDIS_PORT/$REDIS_DB"
if [ -n "$REDIS_PASSWORD" ]; then
    echo "INFO: Redis密码已设置"
else
    echo "WARNING: Redis密码未设置，这可能导致认证错误"
fi

# 启动 Celery Worker
echo "INFO: 正在启动Celery Worker..."
celery -A worker.celery_app worker --loglevel=info
