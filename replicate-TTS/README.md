# Replicate TTS 后端服务

这是一个基于 Node.js 的 Serverless 后端服务，用于处理来自前端 App 的音频生成请求，将请求发送给 Replicate API，并将返回的音频文件存储在 MinIO 存储桶中。

## 技术栈

- Node.js
- Express.js
- Replicate API
- MinIO (对象存储)
- 宝塔面板 (部署环境)

## 安装依赖

```bash
npm install
```

## 配置

1. 复制环境变量示例文件并进行配置：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入 Replicate API Token 和 MinIO 凭证：

```
REPLICATE_API_TOKEN=your_replicate_api_token_here
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_PUBLIC_ENDPOINT=your_minio_public_endpoint(optional)
```

## 源文件配置

服务从以下 URL 格式获取模板音频和文本文件：

```
https://cradleintro.top/{templateId}/source_audio.mp3
https://cradleintro.top/{templateId}/source_transcript.txt
```

例如，对于 `templateId` 为 "template1" 的请求，服务会访问：

```
https://cradleintro.top/template1/source_audio.mp3
https://cradleintro.top/template1/source_transcript.txt
```

确保这些文件在相应的 URL 上可用。

## MinIO 存储配置

MinIO 用于存储生成的音频文件。

1. 确保 MinIO 服务器正在运行，默认端口为 19000。
2. 确保存在 `tts-audio` 存储桶。

## 运行服务

开发环境：

```bash
npm run dev
```

生产环境：

```bash
npm start
```

## 测试

使用测试脚本测试 API 功能：

```bash
npm test
```

测试结果将显示在控制台，生成的音频将保存在 `test/output` 目录中。

## 在宝塔面板上部署

1. 在宝塔面板上创建 Node.js 项目。
2. 上传项目文件到服务器。
3. 在宝塔面板的 Node.js 管理器中配置项目：
   - 端口：3002
   - 启动文件：server.js
   - 项目路径：/path/to/replicate-TTS
4. 配置环境变量。
5. 确保 MinIO 服务已正确配置且可以访问。
6. 点击"启动"按钮运行项目。

## API 文档

### 生成音频 API

**端点**：`POST /api/tts`

**请求体 (JSON)**：
```json
{
  "templateId": "template1",
  "tts_text": "要生成的音频文本内容"
}
```

**响应 (成功)**：
```json
{
  "success": true,
  "data": {
    "audio_url": "http://localhost:19000/tts-audio/audio-uuid.wav"
  }
}
```

**响应 (失败)**：
```json
{
  "success": false,
  "error": "错误信息"
}
```

### 健康检查 API

**端点**：`GET /health`

**响应 (成功)**：
```json
{
  "status": "OK",
  "message": "Service is running"
}
```

## 工作流程

1. 前端发送包含 `templateId` 和 `tts_text` 的请求
2. 服务从 `https://cradleintro.top/{templateId}/` 获取源音频和文本
3. 服务调用 Replicate API 生成新的音频
4. 生成的音频保存到 MinIO 存储桶
5. 服务返回 MinIO 中音频文件的 URL

## 目录结构

```
replicate-TTS/
├── config.js          # 配置文件
├── server.js          # 服务器入口文件
├── init-minio.js      # MinIO 初始化脚本
├── controllers/       # 控制器目录
│   └── ttsController.js
├── services/          # 服务目录
│   ├── replicateService.js
│   └── minioService.js
├── test/              # 测试目录
│   ├── test-tts-api.js
│   └── output/
└── .env               # 环境变量文件
```
```

Made changes.