# Cradle AI

一个轻量级的 OpenRouter Chat Completion API 代理服务，作为前端应用与 OpenRouter API 之间的中间层。

## 项目介绍

Cradle AI 是一个基于 Node.js 和 Express.js 构建的后端服务，负责接收前端应用的聊天请求，将其转发到 OpenRouter API，并将响应返回给前端应用。

### 主要功能

- 提供 Chat Completion API 接口，代理 OpenRouter 的 AI 模型服务
- 支持各种 OpenRouter 参数配置
- 安全处理 API 密钥和敏感信息
- 提供错误处理和日志记录
- 实现请求速率限制和 CORS 配置
- 包含测试工具和示例

## 安装

### 先决条件

- Node.js (v14+)
- npm 或 yarn

### 安装步骤

1. 克隆仓库

```bash
git clone <repository-url>
cd Cradle-AI
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

将 `.env.example` 文件复制为 `.env`，并修改其中的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置以下变量：

```
# OpenRouter API 配置
OPENROUTER_API_KEY=你的OpenRouter API密钥
HTTP_REFERER=你的网站URL
X_TITLE=你的应用名称

# 服务器配置
PORT=3001
NODE_ENV=development

# CORS 配置
ALLOWED_ORIGINS=http://localhost:3001,https://你的域名

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=50
```

## 使用方法

### 启动服务

开发模式（带有热重载）：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

### API 端点

#### Chat Completion

```
POST /api/chat/completion
```

请求体示例：

```json
{
  "model": "openai/gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "你好，请用中文介绍一下自己。"
    }
  ],
  "max_tokens": 100,
  "temperature": 0.7
}
```

完整的请求参数可参考 `openrouter.MD` 文档。

### 测试

运行聊天完成 API 测试：

```bash
npm test
```

列出 OpenRouter 可用模型：

```bash
npm run list-models
```

## 项目结构

```
Cradle AI/
├── src/                      # 源代码
│   ├── config/               # 配置文件
│   ├── middleware/           # 中间件
│   ├── routes/               # 路由
│   ├── services/             # 服务
│   ├── utils/                # 工具函数
│   └── index.js              # 入口文件
├── test/                     # 测试脚本
├── .env.example              # 环境变量示例
├── .gitignore                # Git忽略文件
├── package.json              # 项目依赖
├── README.md                 # 项目说明文档
└── openrouter.MD             # OpenRouter API文档
```

## 安全注意事项

- API 密钥存储在 `.env` 文件中，确保不要将此文件提交到版本控制系统
- 生产环境中建议使用环境变量而不是 `.env` 文件
- 配置适当的 CORS 设置，限制只有信任的源才能访问 API

## 部署

### 宝塔面板部署

1. 在宝塔面板中创建一个网站
2. 上传项目文件到网站目录
3. 安装 Node.js 环境
4. 设置网站的运行目录为项目根目录
5. 添加以下 PM2 配置：
   - 启动文件：`src/index.js`
   - 运行目录：项目根目录
   - 启动参数：无
6. 设置环境变量
7. 启动项目

### 其他部署选项

- Docker 容器化部署
- 云服务如 Vercel, Netlify, Heroku 等

## 错误处理

服务会返回标准化的错误响应：

```json
{
  "error": {
    "message": "错误信息",
    "status": 状态码
  }
}
```

常见状态码：
- 400: 请求参数错误
- 401: 认证失败
- 404: 资源不存在
- 429: 请求速率超限
- 500: 服务器内部错误

## 贡献指南

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

[MIT License](LICENSE)
