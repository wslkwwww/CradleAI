#!/bin/bash

# 设置工作目录
cd "$(dirname "$0")"
echo "Current working directory: $(pwd)"

# 加载环境变量
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# 运行Gunicorn使用wsgi.py作为入口点
echo "Starting Gunicorn with wsgi:app"
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app
