#!/bin/bash

# 确保 Redis 正在运行
redis-server --daemonize yes

# 启动 Celery Worker
echo "Starting Celery worker..."
cd /path/to/text2image_service
celery -A worker worker --loglevel=info &

# 启动 Flask 应用
echo "Starting Flask application..."
gunicorn -w 4 -b 0.0.0.0:5000 app:app
