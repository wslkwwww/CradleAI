#!/bin/bash

# 设置工作目录
cd "$(dirname "$0")"

# 启动 Celery Worker - 注意正确的模块路径语法
celery -A worker.celery_app worker --loglevel=info
