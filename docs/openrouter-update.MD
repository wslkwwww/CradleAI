# OpenRouter API 代理与认证系统

## 服务概述

OpenRouter API 代理是一个中间层服务，旨在安全地代理应用程序与 OpenRouter API 之间的请求。该系统提供了用户认证机制，API Key 池管理，以及请求代理功能，有效保护了 API Key 不被直接暴露给客户端。

### 主要功能

1. **用户认证**：提供安全的注册和登录功能，使用 BLAKE2 和 Argon2 进行密钥派生
2. **API Key 池管理**：维护一个 OpenRouter API Key 池，支持轮询和自动轮换
3. **请求代理**：将客户端请求安全地转发到 OpenRouter API，隐藏实际的 API Key

## 系统架构

### 组件概览

```
+---------------+      +----------------+      +----------------+
|               |      |                |      |                |
| 客户端应用    +----->+ OpenRouter代理 +----->+ OpenRouter API |
|               |      | (Flask服务)    |      |                |
+---------------+      +----------------+      +----------------+
                               |
                               |
                               v
                       +----------------+
                       |                |
                       | MySQL 数据库   |
                       |                |
                       +----------------+
```

### 技术栈

- **后端**：Python，Flask
- **数据库**：MySQL
- **部署**：Docker，Docker Compose
- **安全认证**：JWT，Argon2，BLAKE2

## API 参考

### 1. 用户注册

注册新用户账号。客户端应先对用户名和密码进行 BLAKE2 和 Argon2 处理，生成派生密钥。

**请求**：
```
POST /register
Content-Type: application/json

{
    "username": "用户名",
    "derived_key": "密钥派生值"
}
```

**响应**：
```json
// 成功 (201 Created)
{
    "message": "User registered successfully"
}

// 失败 (400 Bad Request)
{
    "message": "Username already exists"
}
```

### 2. 用户登录

登录用户账号。客户端应先对用户名和密码进行 BLAKE2 和 Argon2 处理，生成派生密钥。

**请求**：
```
POST /login
Content-Type: application/json

{
    "username": "用户名",
    "derived_key": "密钥派生值"
}
```

**响应**：
```json
// 成功 (200 OK)
{
    "message": "Login successful",
    "token": "JWT令牌"
}

// 失败 (401 Unauthorized)
{
    "message": "Invalid credentials"
}
```

### 3. OpenRouter API 代理

将请求代理到 OpenRouter API，客户端无需知道实际的 API Key。

**请求**：
```
POST /api/proxy/openrouter
Authorization: Bearer {JWT令牌}
Content-Type: application/json

{
    "model": "openai/gpt-3.5-turbo",
    "messages": [
        {
            "role": "system",
            "content": "你是一个有用的助手"
        },
        {
            "role": "user",
            "content": "你好！"
        }
    ],
    "temperature": 0.7
}
```

**响应**：
OpenRouter API 的原始响应会被直接传回客户端，包括状态码和头信息。

```json
{
    "id": "gen-xxx",
    "choices": [
        {
            "message": {
                "role": "assistant",
                "content": "你好！有什么我可以帮助你的吗？"
            }
        }
    ]
}
```

## 安装与部署

### 环境准备

确保已安装：
- Docker 和 Docker Compose
- Python 3.9+（如果不使用Docker）

### 使用 Docker Compose 部署

1. **克隆仓库**：
   ```bash
   git clone [仓库URL]
   cd my-app/server
   ```

2. **配置环境变量**：
   编辑 `docker-compose.yml` 文件，设置以下环境变量：
   - `SECRET_KEY`：JWT 签名密钥，生产环境应使用强随机值
   - `DB_PASSWORD`：MySQL 数据库密码
   - `APP_HOSTNAME`：应用程序域名，用于 OpenRouter 请求头
   - `APP_TITLE`：应用程序名称，用于 OpenRouter 请求头
   - `OPENROUTER_PROVISION_KEY`：OpenRouter Provisioning API Key
   - `ENCRYPTION_KEY`：用于加密存储 API Key 的密钥

3. **启动服务**：
   ```bash
   docker compose up -d
   ```

### 手动部署

1. **准备 MySQL 数据库**：
   创建数据库和用户，授予适当权限。

2. **安装依赖**：
   ```bash
   pip install -r requirements.txt
   ```

3. **配置环境变量**：
   ```bash
   export SECRET_KEY="your_secret_key"
   export DB_HOST="localhost"
   export DB_USER="root"
   export DB_PASSWORD="your_password"
   export DB_NAME="openrouter_proxy"
   export APP_HOSTNAME="https://myapp.com"
   export APP_TITLE="MyApp"
   export OPENROUTER_PROVISION_KEY="your_provision_key"
   export ENCRYPTION_KEY="your_encryption_key"
   ```

4. **启动服务**：
   ```bash
   python app.py
   ```

5. **设置 API Key 轮换定时任务**：
   ```bash
   python key_rotation.py
   ```

## 系统组件详解

### 1. 应用程序（app.py）

主 Flask 应用程序，提供 Web 路由和请求处理。负责：
- 用户注册和登录
- JWT 令牌生成与验证
- OpenRouter 请求代理
- 错误处理

### 2. 认证模块（auth.py）

负责用户认证相关的功能，包括：
- 使用 BLAKE2 哈希用户名
- 验证派生密钥
- 用户注册和登录逻辑

### 3. 数据库连接（db.py）

管理数据库连接和模式，包括：
- 初始化数据库和表
- 创建连接池
- 提供数据库连接

### 4. OpenRouter 代理（openrouter_proxy.py）

处理 OpenRouter API 请求代理功能，负责：
- 使用池中的 API Key 转发请求
- 处理 API 响应
- 错误处理

### 5. API Key 管理器（api_key_manager.py）

管理 OpenRouter API Key 池，包括：
- 创建和存储 API Key
- 轮询机制（随机选择 API Key）
- 加密存储和解密
- API Key 轮换

### 6. API Key 轮换（key_rotation.py）

定期轮换 API Key 的独立脚本，可作为后台服务运行。

## 数据库架构

### users 表
存储用户认证信息。

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username_hash VARCHAR(64) NOT NULL UNIQUE,
    key_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);
```

### api_keys 表
存储 OpenRouter API Key。

```sql
CREATE TABLE api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_key TEXT NOT NULL, -- 加密存储
    api_key_hash VARCHAR(64) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    use_count INT DEFAULT 0
);
```

## 安全考量

### 存储安全
- 用户名使用 BLAKE2 哈希存储
- API Key 使用 Fernet 对称加密存储
- 敏感操作使用密码派生而非明文密码

### 传输安全
- 生产环境应使用 HTTPS
- JWT 用于身份验证
- 请求内容不会被服务器记录

### API Key 安全
- API Key 池中的 Key 定期轮换
- 实际 API Key 从不暴露给客户端
- 来自 OpenRouter 的错误不会泄露 API Key

## 客户端集成指南

### 密钥派生

客户端应按照以下方式生成密钥：

```typescript
// 示例 TypeScript 实现
import { blake2b } from 'hash-wasm';
import * as argon2 from 'argon2-browser';

async function deriveKey(email: string, password: string): Promise<string> {
  const preSalt = `${password.substring(0, 6)}${email}novelai_data_access_key`;
  
  // 生成盐值
  const salt = await blake2b(preSalt, 16);
  
  // 使用 Argon2 派生密钥
  const result = await argon2.hash({
    pass: password,
    salt: Buffer.from(salt),
    time: 2,
    mem: 2000000 / 1024,
    parallelism: 1,
    hashLen: 64,
    type: argon2.ArgonType.Argon2id
  });
  
  return result.encoded.substring(0, 64);
}
```

### 身份验证与请求

1. **注册用户**：
   ```typescript
   const derivedKey = await deriveKey(username, password);
   
   const response = await fetch('https://your-server/register', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ username, derived_key: derivedKey })
   });
   ```

2. **登录用户**：
   ```typescript
   const derivedKey = await deriveKey(username, password);
   
   const response = await fetch('https://your-server/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ username, derived_key: derivedKey })
   });
   
   const { token } = await response.json();
   localStorage.setItem('auth_token', token);
   ```

3. **调用 OpenRouter API**：
   ```typescript
   const token = localStorage.getItem('auth_token');
   
   const response = await fetch('https://your-server/api/proxy/openrouter', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`
     },
     body: JSON.stringify({
       model: 'openai/gpt-3.5-turbo',
       messages: [
         { role: 'system', content: '你是一个有用的助手' },
         { role: 'user', content: '你好！' }
       ]
     })
   });
   
   const result = await response.json();
   ```

## 故障排除

### 常见问题

1. **数据库连接失败**：
   - 检查数据库凭据和网络连接
   - 确保 MySQL 服务正在运行
   - 检查防火墙和网络配置

2. **API Key 创建失败**：
   - 验证 Provisioning API Key 是否正确
   - 检查是否有足够的权限创建 API Key
   - 查看服务器日志了解详细错误信息

3. **用户认证失败**：
   - 确保客户端正确实现了派生密钥算法
   - 检查用户名和密码是否正确
   - 验证 JWT 令牌是否过期

4. **API 请求失败**：
   - 确保 JWT 令牌有效并包含在请求头中
   - 检查 API Key 池是否有可用的 Key
   - 查看 OpenRouter 响应状态码和错误信息

## 监控与维护

### 日志记录

服务记录以下信息：
- 用户注册和登录尝试（不含敏感信息）
- API Key 创建和轮换操作
- 请求代理状态（模型信息，不含请求内容）
- 错误和异常情况

### API Key 使用统计

数据库记录了每个 API Key 的使用情况：
- 使用次数统计
- 最后使用时间
- 创建和更新时间

### 系统维护

1. **数据库备份**：定期备份数据库，特别是 API Key 表
2. **监控 API Key 池**：确保有足够的可用 Key
3. **更新 Provisioning Key**：如需更新主 Provisioning Key，修改环境变量并重启服务
4. **JWT 密钥轮换**：定期更新 JWT 签名密钥，提高安全性

## 性能优化

1. **连接池**：使用数据库连接池提高性能
2. **内存缓存**：API Key 缓存在内存中，减少数据库查询
3. **异步更新**：API Key 使用统计异步更新，不阻塞请求处理
4. **超时设置**：OpenRouter 请求设置了适当的超时时间

## 未来扩展

1. **用户限额**：为不同用户实现不同的使用限额
2. **多服务支持**：扩展代理支持其他 AI API 服务
3. **使用分析**：添加详细的使用统计和成本分析
4. **扩展认证方式**：支持 OAuth 或其他第三方认证

## 总结

OpenRouter API 代理系统为应用程序提供了安全、高效的方式来调用 OpenRouter API，同时保护 API Key 并简化管理。通过密钥派生、JWT 认证和安全的请求代理，实现了安全性与易用性的平衡。

---

## 附录：环境变量参考

| 环境变量 | 描述 | 默认值 | 必填 |
|---------|------|-------|-----|
| SECRET_KEY | JWT 签名密钥 | dev_secret_key | 是（生产环境） |
| DB_HOST | 数据库主机 | localhost | 是 |
| DB_USER | 数据库用户 | root | 是 |
| DB_PASSWORD | 数据库密码 | 空 | 是 |
| DB_NAME | 数据库名称 | openrouter_proxy | 是 |
| APP_HOSTNAME | 应用程序域名 | https://myapp.com | 是 |
| APP_TITLE | 应用程序标题 | MyApp | 是 |
| OPENROUTER_PROVISION_KEY | OpenRouter Provisioning Key | sk-or-v1-... | 是 |
| ENCRYPTION_KEY | API Key 加密密钥 | 自动生成 | 是（生产环境） |
| FLASK_DEBUG | 调试模式 | True | 否 |
| PORT | 服务器端口 | 5000 | 否 |