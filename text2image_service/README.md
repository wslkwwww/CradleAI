# NovelAI 图像生成服务

这是一个用于 NovelAI 图像生成的 REST API 服务。

## 功能特点

- 支持 NovelAI 令牌和用户名/密码认证
- **许可证验证集成**，确保只有授权用户可以访问服务
- 服务器端存储凭据，无需每次从前端传递敏感信息
- **多账号轮询机制**，支持当一个账号失效时自动切换到下一个有效账号
- **账号失效智能处理**，自动冷却失效账号并在适当时机重试
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

### 管理 NovelAI 账号凭据

有两种方式配置NovelAI账号信息：

#### 1. 环境变量方式（推荐，更安全）

在环境变量或 `.env` 文件中设置以下变量：

```bash
# 第一个账号
NOVELAI_EMAIL_1=your-email-1@example.com
NOVELAI_PASSWORD_1=your-password-1

# 第二个账号（可选）
NOVELAI_EMAIL_2=your-email-2@example.com
NOVELAI_PASSWORD_2=your-password-2

# 最多可设置10个账号（NOVELAI_EMAIL_1 到 NOVELAI_EMAIL_10）
```

服务会优先使用环境变量中的凭据，只有在环境变量未设置时才会使用文件存储的凭据。

#### 2. 文件存储方式（兼容旧版本）

使用提供的脚本安全地存储您的 NovelAI 账号信息:

```bash
# 添加单个账号
python set_credentials.py

# 使用新的管理工具添加多个账号
python manage_credentials.py add
```

**多账号管理工具**

新增的 `manage_credentials.py` 工具提供了完整的多账号管理功能：

```bash
# 列出所有已配置的账号
python manage_credentials.py list

# 列出并测试所有账号的有效性
python manage_credentials.py list --test

# 测试所有账号
python manage_credentials.py test

# 添加新账号
python manage_credentials.py add --email user@example.com

# 更新现有账号
python manage_credentials.py update 0 --password "new_password"

# 删除账号
python manage_credentials.py remove 0

# 查看账号认证失败记录
python manage_credentials.py failures
```

系统会自动在多个账号之间轮询，当检测到一个账号认证失败或产生401错误时，会自动切换到其他可用账号，并将失败的账号暂时标记为冷却状态（默认30分钟）。

### 配置环境变量

可以通过修改 `.env` 文件或设置环境变量来配置服务:

- `SECRET_KEY`: Flask 应用密钥
- `PORT`: 服务运行端口（默认 5005）
- `RATE_LIMIT_DAILY`: 每日请求限制 (默认 800)
- `RATE_LIMIT_MIN_INTERVAL`: 请求间最小间隔秒数 (默认 8)
- `RATE_LIMIT_MAX_INTERVAL`: 请求间最大间隔秒数 (默认 15)
- `LICENSE_API_URL`: 许可证验证API的URL (默认 'https://cradleintro.top/api/v1/license/verify')
- `NOVELAI_EMAIL_1`, `NOVELAI_PASSWORD_1`: NovelAI 账号凭据

## 许可证集成

服务已集成许可证验证系统，确保只有授权用户可以访问图像生成服务。

### 客户端集成

客户端应用需要在API请求中包含许可证信息:

```javascript
// 获取许可证头
const licenseHeaders = {
  'X-License-Key': 'your-license-key',
  'X-Device-ID': 'your-device-id'
};

// 添加到API请求
fetch('https://your-api.com/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...licenseHeaders
  },
  body: JSON.stringify({
    prompt: '一只可爱的猫咪',
    model: 'nai-v3'
  })
});
```

### 许可证验证端点

系统提供以下与许可证相关的端点:

#### 验证许可证 (POST /verify_license)

```json
{
  "license_key": "your-license-key",
  "device_id": "your-device-id"
}
```

响应示例:

```json
{
  "success": true,
  "license_info": {
    "plan_id": "premium_monthly",
    "expiry_date": "2023-12-31",
    "customer_email": "user@example.com"
  }
}
```

#### 检查许可证状态 (GET /license_status)

需要在请求头中包含 `X-License-Key` 和 `X-Device-ID`。

响应示例:

```json
{
  "success": true,
  "has_license": true,
  "license_info": {
    "plan_id": "premium_monthly",
    "expiry_date": "2023-12-31",
    "customer_email": "user@example.com"
  }
}
```

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

### 使用 Nginx 部署（生产环境）

在生产环境中，推荐使用 Nginx 作为反向代理：

1. 将 `nginx/text2image.conf` 配置文件复制到 Nginx 配置目录：

```bash
sudo cp nginx/text2image.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/text2image.conf /etc/nginx/sites-enabled/
```

2. 修改配置文件中的域名和SSL证书路径：

```bash
sudo nano /etc/nginx/sites-available/text2image.conf
```

3. 检查配置并重启 Nginx：

```bash
sudo nginx -t
sudo systemctl restart nginx
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

## 多账号轮询机制

服务实现了强大的多账号轮询和失效处理机制：

1. **多账号管理**：通过 `manage_credentials.py` 工具可以添加、删除和管理多个NovelAI账号

2. **自动轮询**：系统根据账号的可用性自动在多个账号之间进行轮询

3. **智能失效处理**：
   - 当账号出现401认证错误时，自动标记为失效状态
   - 失效账号会进入冷却期（默认30分钟），避免短时间内重复使用失效账号
   - 冷却期结束后账号会重新进入可用池

4. **自动重试机制**：
   - 当请求失败时，自动尝试使用其他可用账号重新发送请求
   - 任务队列会保留原始请求，确保处理不会丢失

5. **账号状态监控**：
   - 记录账号失效历史，便于分析问题
   - 通过 `failures` 命令查看详细的失效记录

此机制大幅提高了系统的可靠性和稳定性，特别适合需要长时间运行的服务环境。

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
- 401: 认证失败或未提供许可证
- 403: 许可证无效或功能不在当前许可计划内
- 429: 请求过于频繁，超过 API 限制
- 500: 服务器内部错误

## 安全注意事项

- 推荐使用服务器端凭据存储
- 确保服务器与客户端之间使用 HTTPS 通信
- 设置适当的 API 限制，防止滥用
- 保护许可证密钥和设备ID不被盗用

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

### 许可证问题

当遇到 "需要有效的许可证" 或 "无效的许可证" 错误时:

1. **检查许可证信息**:
   - 确认许可证密钥输入正确
   - 确认使用的设备ID与激活时的一致
   - 检查许可证是否已过期

2. **重新激活许可证**:
   - 尝试通过 `/verify_license` 端点重新验证许可证
   - 检查设备是否超过许可证允许的激活数量

3. **联系管理员**:
   - 如果确认许可证有效但仍无法使用，请联系系统管理员

### 账号轮询问题

如果遇到账号轮询相关问题：

1. **所有账号都失效**：
   - 检查 `credential_failures.json` 文件了解失败详情
   - 使用 `python manage_credentials.py test` 测试所有账号
   - 尝试手动更新账号凭据 `python manage_credentials.py update [index]`

2. **轮询不正常**：
   - 检查日志中的账号选择逻辑是否正确
   - 确认账号失效标记和冷却机制是否正常工作
   - 可以删除 `credential_failures.json` 文件重置失败记录

3. **手动强制使用某个账号**：
   - 临时删除其他账号，只保留需要使用的账号
   - 使用后再重新添加其他账号

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