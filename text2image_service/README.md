# NovelAI 图像生成服务

这是一个用于 NovelAI 图像生成的 REST API 服务。

## 功能特点

- 支持 NovelAI 令牌和用户名/密码认证
- 在服务器端执行 Argon2id 密钥计算
- 异步处理图像生成任务
- 使用 Celery 和 Redis 进行任务队列管理
- 支持文本到图像和图像到图像生成

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

## 运行服务

1. 启动 Redis (如果尚未运行)

```bash
redis-server
```

2. 启动 Celery Worker

```bash
celery -A worker worker --loglevel=info
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

请求示例:

```json
{
  "auth_type": "token",
  "token": "your-novelai-token",
  "model": "nai-v3",
  "prompt": "一只可爱的猫咪，高清照片",
  "negative_prompt": "模糊，低质量",
  "sampler": "k_euler_ancestral",
  "steps": 28,
  "scale": 11,
  "resolution": "portrait"
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

响应示例:

```json
{
  "success": true,
  "task_id": "a1b2c3d4e5f6",
  "message": "图像生成任务已提交"
}
```

### 查询任务状态 (GET /task_status/{task_id})

响应示例 (任务进行中):

```json
{
  "task_id": "a1b2c3d4e5f6",
  "status": "PENDING",
  "done": false
}
```

响应示例 (任务完成):

```json
{
  "task_id": "a1b2c3d4e5f6",
  "status": "SUCCESS",
  "done": true,
  "success": true,
  "image_url": "data:image/png;base64,..."
}
```

## 错误处理

常见错误代码和原因:

- 400: 缺少必要参数或参数格式错误
- 401: 认证失败
- 429: 请求过于频繁，超过 API 限制
- 500: 服务器内部错误

## 安全注意事项

- 不要将 NovelAI 凭据存储在客户端
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

### 解决方法

如果使用 token 认证遇到问题，可以尝试以下步骤:

1. 在客户端应用中，切换到"login"认证类型
2. 切换回"token"认证类型
3. 确保 token 没有多余空格或换行符 (应用中会自动调用 `token.trim()` 清理)
4. 重新尝试生成图像

### 服务日志

查看服务日志可以帮助诊断问题:

```bash
# 查看 Flask 应用日志
tail -f /path/to/flask.log

# 查看 Celery 工作进程日志
tail -f /path/to/celery.log
```
