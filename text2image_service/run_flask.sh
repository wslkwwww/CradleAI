#!/bin/bash

# 设置工作目录
cd "$(dirname "$0")"

# 加载环境变量
export $(grep -v '^#' .env | xargs)

# 运行 Flask 应用
flask run --host=0.0.0.0 --port=$PORT
