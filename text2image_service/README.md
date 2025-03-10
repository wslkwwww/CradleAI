# NovelAI 图像生成服务

这是一个用于 NovelAI 图像生成的 REST API 服务。

## 功能特点

- 支持 NovelAI 令牌和用户名/密码认证
- 服务器端存储凭据，无需每次从前端传递敏感信息
- 在服务器端执行 Argon2id 密钥计算
- 异步处理图像生成任务
- 使用 Celery 和 Redis 进行任务队列管理
- 支持文本到图像和图像到图像生成
- 智能速率限制，模拟人类使用行为
- 请求集中在新加坡时间的三个时间窗口，降低被检测风险
- 支持对任务进行优先级排序
- 本地或 MinIO 图像存储选项

## 安装步骤

1. 确保已安装 Python 3.8+ 和 Redis

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server python3-pip python3-venv

# CentOS/RHEL
sudo yum install redis python3-pip
sudo systemctl start redis
```

2. 创建并激活虚拟环境

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# 或者 
# venv\Scripts\activate   # Windows
```

3. 安装依赖项

```bash
pip install -r requirements.txt
```

## 配置服务

### 设置 NovelAI 账号凭据 (推荐)

使用提供的脚本安全地存储您的 NovelAI 账号信息:

```bash
python set_credentials.py
```

此脚本会安全地存储凭据，避免每次请求时都需要从前端传递敏感信息。

### 配置环境变量

可以通过修改 `.env` 文件或设置环境变量来配置服务:

- `SECRET_KEY`: Flask 应用密钥
- `PORT`: 服务运行端口
- `RATE_LIMIT_DAILY`: 每日请求限制 (默认 800)
- `RATE_LIMIT_MIN_INTERVAL`: 请求间最小间隔秒数 (默认 8)
- `RATE_LIMIT_MAX_INTERVAL`: 请求间最大间隔秒数 (默认 15)

## 运行服务

### 使用便捷脚本

```bash
# 赋予脚本执行权限
chmod +x run_celery.sh run_flask.sh run_gunicorn.sh

# 启动 Celery Worker
./run_celery.sh

# 启动 Flask 应用 (开发环境)
./run_flask.sh

# 或使用 Gunicorn (生产环境)
./run_gunicorn.sh
```

### 手动启动服务

1. 启动 Redis (如果尚未运行)

```bash
redis-server
```

2. 启动 Celery Worker

```bash
celery -A worker.celery_app worker --loglevel=info
```

3. 启动 Flask 应用

```bash
flask run --host=0.0.0.0
```

或者在生产环境中:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## API 使用说明

### 生成图像 (POST /generate)

如已设置服务器端凭据，只需提供创建图像的必要参数:

```json
{
  "prompt": "一只可爱的猫咪，高清照片",
  "negative_prompt": "模糊，低质量",
  "model": "nai-v3",
  "sampler": "k_euler_ancestral",
  "steps": 28,
  "scale": 11,
  "resolution": "portrait"
}
```

如未设置服务器端凭据，则需要提供认证信息:

```json
{
  "auth_type": "token",
  "token": "your-novelai-token",
  "prompt": "一只可爱的猫咪，高清照片",
  "negative_prompt": "模糊，低质量",
  "model": "nai-v3",
  "steps": 28
}
```

或者使用用户名/密码认证:

```json
{
  "auth_type": "login",
  "email": "your-email@example.com",
  "password": "your-password",
  "prompt": "一只可爱的猫咪，高清照片",
  "negative_prompt": "模糊，低质量",
  "model": "nai-v3",
  "steps": 28
}
```

使用测试模式跳过速率限制(仅用于测试):

```json
{
  "prompt": "测试图像",
  "model": "nai-v3",
  "is_test_request": true
}
```

响应示例:

```json
{
  "success": true,
  "task_id": "a1b2c3d4e5f6",
  "message": "图像生成任务已提交",
  "queue_info": {
    "position": 2,
    "total_pending": 5
  },
  "rate_limit_info": {
    "daily_limit": 800,
    "requests_today": 15,
    "remaining": 785
  }
}
```

### 查询任务状态 (GET /task_status/{task_id})

响应示例 (任务进行中):

```json
{
  "task_id": "a1b2c3d4e5f6",
  "status": "PENDING",
  "done": false,
  "queue_info": {
    "position": 2,
    "total_pending": 5,
    "estimated_wait": 60
  }
}
```

响应示例 (任务完成):

```json
{
  "task_id": "a1b2c3d4e5f6",
  "status": "SUCCESS",
  "done": true,
  "success": true,
  "image_url": "http://example.com/static/images/novelai_abc123.png",
  "image_urls": ["http://example.com/static/images/novelai_abc123.png"]
}
```

### 获取队列状态 (GET /queue_status)

响应示例:

```json
{
  "queue_status": {
    "total_pending": 5,
    "queue_positions": {
      "task1": 1,
      "task2": 2
    },
    "last_updated": 1679012345.67
  },
  "active_tasks": 2,
  "last_updated": "2023-03-17 14:52:25"
}
```

### 获取速率限制状态 (GET /rate_limit_status)

查询当前速率限制状态，包括允许的时间窗口和剩余配额:

```json
{
  "success": true,
  "rate_limit_info": {
    "daily_limit": 800,
    "requests_today": 125,
    "remaining": 675,
    "singapore_time": {
      "date": "2023-03-17",
      "hour": 14
    },
    "allowed_windows": [
      [6, 9],
      [12, 14],
      [19, 23]
    ],
    "in_allowed_window": true,
    "window_description": "6:00-9:00, 12:00-14:00, 19:00-23:00"
  }
}
```

### 取消任务 (POST /cancel_task/{task_id})

响应示例:

```json
{
  "success": true,
  "message": "任务 a1b2c3d4e5f6 已取消"
}
```

## 速率限制与人类行为模拟

系统实现了以下速率限制和人类行为模拟策略：

1. **时间窗口限制**：请求仅在新加坡时间的三个时间段处理
   - 早晨 6:00-9:00
   - 中午 12:00-14:00
   - 晚上 19:00-23:00

2. **请求间隔**：两次请求之间随机间隔 8-15 秒

3. **异常处理**：请求失败后冷却 5-12 秒再重试

4. **每日限额**：总请求数不超过 800 次/天

5. **人类行为模拟**：
   - 随机请求延迟
   - 真实浏览器标头
   - 偶尔请求额外资源模拟浏览行为
   - 随机化请求参数和顺序

标记为测试请求的任务不受时间窗口和队列限制，便于开发测试。

## 错误处理

常见错误代码和原因:

- 400: 缺少必要参数或参数格式错误
- 401: 认证失败
- 429: 请求过于频繁，超过 API 限制
- 500: 服务器内部错误

## 安全注意事项

- 推荐使用服务器端凭据存储
- 确保服务器与客户端之间使用 HTTPS 通信
- 设置适当的 API 限制，防止滥用

## 常见问题排查

### 认证失败 (401 Unauthorized)

当遇到 "未知错误 400 或 401" 或 "登录失败: 用户名或密码错误 (401 Unauthorized)" 时:

1. **使用 token 认证时:**
   - 确认 token 是从 NovelAI 网站正确复制的，没有多余空格或换行符
   - 有时候需要先切换到 login 认证模式，再切换回 token 认证模式
   - 确认 token 没有过期
   
2. **使用 login 认证时:**
   - 确认邮箱和密码正确
   - 检查密码中是否包含特殊字符
   - 确认没有被 NovelAI 临时锁定账户（多次失败登录后可能发生）

3. **网络问题:**
   - 确认服务器可以访问 NovelAI API (api.novelai.net)
   - 检查是否被 IP 封锁 (过多请求后可能发生)

### 速率限制问题

如果收到速率限制错误，可能是因为：

1. 达到每日请求限额 (800次)
2. 当前时间不在允许的时间窗口内
3. 请求频率太高，未达到最小间隔要求

解决方法：
- 使用 `is_test_request: true` 参数标记测试请求
- 检查 `/rate_limit_status` 端点了解当前状态和限制
- 等待下一个时间窗口

### 服务日志

查看服务日志可以帮助诊断问题:

```bash
# 查看 Flask 应用日志
tail -f flask.log

# 查看 Celery 工作进程日志
tail -f celery.log
```

## 贡献

欢迎提交 Pull Requests 和 Issues。

## 许可证

[MIT](LICENSE)
