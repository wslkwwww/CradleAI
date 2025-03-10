#!/bin/bash

# 设置工作目录 - 切换到应用程序所在目录
cd "$(dirname "$0")"
echo "Current working directory: $(pwd)"

# 显示目录内容以确认app.py存在
echo "Directory contents:"
ls -la

# 加载环境变量
if [ -f .env ]; then
    echo "Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# 检查PYTHONPATH
echo "PYTHONPATH: $PYTHONPATH"

# 添加当前目录到Python路径
export PYTHONPATH=$PYTHONPATH:$(pwd)

# 运行Gunicorn (使用绝对路径引用app.py)
echo "Starting Gunicorn with app:app"
gunicorn -w 4 -b 0.0.0.0:5000 --log-level debug app:app
