# Replicate TTS 后端服务

这是一个基于 Node.js 的 Serverless 后端服务，用于处理来自前端 App 的音频生成请求，将请求发送给 Replicate API，并将返回的音频文件存储在 MinIO 存储桶中。现在支持实时状态更新和可靠的任务重试机制。

## 技术栈

- Node.js
- Express.js
- Replicate API
- MinIO (对象存储)
- RabbitMQ (消息队列，用于任务重试)
- Server-Sent Events (SSE，用于实时状态更新)
- Winston (日志系统)
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

2. 编辑 `.env` 文件，填入 Replicate API Token、MinIO 凭证和 RabbitMQ 配置：

```
REPLICATE_API_TOKEN=your_replicate_api_token_here
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_PUBLIC_ENDPOINT=your_minio_public_endpoint(optional)
RABBITMQ_URL=amqp://username:password@host:port
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

## RabbitMQ 配置

RabbitMQ 用于消息队列和任务重试机制。

### 基本配置

1. 确保 RabbitMQ 服务器正在运行
2. 服务将自动创建所需的队列：
   - `tts_retry_queue`: 用于重试失败的任务
   - `tts_dead_letter_queue`: 用于存储最终失败的任务

### RabbitMQ Web 管理界面配置

RabbitMQ 提供了一个 Web 管理界面，可以用于监控和管理队列。以下是配置步骤：

1. **启用 RabbitMQ 管理插件**:
   ```bash
   rabbitmq-plugins enable rabbitmq_management
   ```

2. **访问管理界面**:
   - 打开浏览器，访问 `http://<rabbitmq-server-ip>:15672/`
   - 默认用户名和密码为 `guest` / `guest`（仅在localhost访问时有效）
   
3. **创建管理员用户**（推荐）:
   ```bash
   rabbitmqctl add_user admin your_password
   rabbitmqctl set_user_tags admin administrator
   rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"
   ```

4. **监控队列**:
   - 在 Web 界面的 "Queues" 标签页中，您可以看到已创建的队列
   - 监控 `tts_retry_queue` 和 `tts_dead_letter_queue` 的消息数量和处理状态
   
5. **查看失败的消息**:
   - 在 "Queues" 页面中点击 `tts_dead_letter_queue`
   - 在 "Get messages" 区域，可以查看和检查失败的任务详情
   - 设置 "Ack mode" 为 "Nack message requeue false" 来查看消息而不从队列中删除它

6. **设置警报**（可选）:
   - 在 "Admin" > "Policies" 中可以设置队列的长度限制和过期策略
   - 建议为 `tts_dead_letter_queue` 设置消息 TTL (Time to Live)，如 7 天

7. **配置虚拟主机**（可选，用于隔离环境）:
   - 在 "Admin" > "Virtual Hosts" 中可以创建新的虚拟主机
   - 例如，为测试环境创建 "test" 虚拟主机，为生产环境创建 "production" 虚拟主机
   - 在创建虚拟主机后，需要为用户分配相应权限

8. **安全设置**:
   - 如果 RabbitMQ 需要从外部访问，务必配置合适的防火墙规则
   - 限制访问 Web 管理界面的 IP
   - 使用强密码和定期更改管理员密码

### 队列设置建议

在 Web 管理界面中，可以对队列进行以下设置：

1. **持久性**：确保队列为持久化（Durable），这样在 RabbitMQ 重启后队列仍然存在。

2. **消息 TTL**：为重试队列中的消息设置合理的 TTL，避免过期消息长时间占用资源。
   - 可以在 "Policies" 中设置: `{"message-ttl": 86400000}` (24小时)

3. **队列长度限制**：限制死信队列的最大长度，防止过多失败消息占用内存。
   - 可以在 "Policies" 中设置: `{"max-length": 1000}`

4. **自动删除**：对临时队列设置为自动删除模式，以便在不再使用时自动清理。

> 注意：服务代码会自动创建必需的队列，但上述设置可以通过 Web 管理界面进一步优化。

## 运行服务

开发环境：

```bash
npm run dev
```

生产环境：

```bash
npm start
```

集群模式（生产环境）：

```bash
npm run start:cluster
```

## 新增功能

### 实时状态更新 (SSE)

服务现在支持通过 Server-Sent Events (SSE) 向客户端实时推送任务状态更新。这使客户端可以实时显示任务进度，而不需要轮询。

**连接到 SSE 端点**：
```javascript
const eventSource = new EventSource('/events?taskId=your_task_id');

eventSource.addEventListener('task_update', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Task ${data.taskId} status: ${data.status}`);
  // 更新 UI
});
```

可用的任务状态包括：`starting`, `queued`, `dequeued`, `processing`, `prediction_created`, `downloading`, `download_complete`, `succeeded`, `failed`, `retrying`, `waiting_retry` 等。

### 可靠的重试机制

服务现在使用 RabbitMQ 实现了可靠的任务重试机制，具有以下特性：

1. **指数退避重试**: 失败的任务会自动以指数递增的时间间隔重试
2. **可配置的重试参数**: 可以在配置文件中设置最大重试次数、初始重试间隔和最大重试间隔
3. **手动重试 API**: 提供了手动触发任务重试的 API
4. **死信队列**: 超过最大重试次数的任务将移至死信队列以便后续分析

## 客户端 SDK

为方便前端集成，我们提供了一个 JavaScript 客户端 SDK，位于 `client/SSEClient.js`。该 SDK 提供了用于 SSE 连接和任务管理的全套功能。

使用示例：

```javascript
const ttsClient = new TTSEventClient({ baseUrl: 'https://your-tts-service.com' });

// 连接到 SSE
await ttsClient.connect();

// 监听所有任务更新
ttsClient.addEventListener('task_update', (data) => {
  console.log(`Task ${data.taskId} status: ${data.status}`);
});

// 生成音频
const result = await ttsClient.generateAudio({
  templateId: 'template1',
  tts_text: '要生成的音频文本内容'
});

// 重试失败的任务
await ttsClient.retryAudio({
  taskId: 'task_id',
  templateId: 'template1',
  tts_text: '要生成的音频文本内容'
});
```

## HTML 示例

在 `public/sse-client-example.html` 提供了一个完整的示例，演示了如何在 Web 应用中集成实时状态更新和重试功能。

## API 文档

### 生成音频 API

**端点**：`POST /api/tts`

**请求体 (JSON)**：
```json
{
  "templateId": "template1",
  "tts_text": "要生成的音频文本内容",
  "instruction": "可选的语音指令，如 '开心地'"
}
```

**响应 (成功)**：
```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "audio_url": "http://localhost:19000/tts-audio/audio-uuid.wav",
    "status": "succeeded"
  }
}
```

如果任务需要后台处理，会立即返回任务ID，让客户端通过SSE接收后续更新：
```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "message": "Audio generation started",
    "status": "started"
  }
}
```

**响应 (失败)**：
```json
{
  "success": false,
  "error": "错误信息",
  "taskId": "任务ID（如果已创建）"
}
```

### 重试生成 API

**端点**：`POST /api/tts/retry`

**请求体 (JSON)**：
```json
{
  "taskId": "需要重试的任务ID",
  "templateId": "template1",
  "tts_text": "要生成的音频文本内容"
}
```

**响应 (成功)**：
```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "message": "Retry initiated successfully"
  }
}
```

### 任务状态查询 API

**端点**：`GET /api/tts/task/:taskId`

**响应 (成功)**：
```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "status": "当前状态",
    "templateId": "模板ID",
    "ttsText": "文本内容",
    "audioUrl": "生成音频URL（如果已完成）",
    "createdAt": "创建时间",
    "completedAt": "完成时间（如果已完成）"
  }
}
```

### SSE 连接端点

**端点**：`GET /events`

可选查询参数：`taskId` - 指定要订阅的任务ID

**SSE 事件类型**：
- `connected`: 连接建立时发送，包含客户端ID
- `task_update`: 任务状态更新
- `heartbeat`: 定期心跳，保持连接活跃

## 健康检查和系统监控

**健康检查端点**：`GET /health`

**系统信息端点**：`GET /system`

## 生产环境配置

在生产环境中，推荐以集群模式运行服务以充分利用多核CPU：

```bash
NODE_ENV=production npm run start:cluster
```

重要的生产环境配置参数（在 config.js 中）：
- `retry.maxRetries`: 最大重试次数
- `retry.initialInterval`: 初始重试间隔（毫秒）
- `retry.multiplier`: 重试间隔指数增长倍率
- `sse.heartbeatInterval`: SSE 心跳间隔（毫秒）
- `sse.clientTimeout`: SSE 客户端超时时间（毫秒）

## 工作流程

1. 前端发送包含 `templateId` 和 `tts_text` 的请求
2. 服务从 `https://cradleintro.top/{templateId}/` 获取源音频和文本
3. 服务调用 Replicate API 生成新的音频
4. 在生成过程中，服务通过 SSE 向客户端发送实时状态更新
5. 成功生成的音频保存到 MinIO 存储桶
6. 服务返回 MinIO 中音频文件的 URL
7. 如果生成失败，服务会根据配置的重试策略自动重试

## 目录结构

```
replicate-TTS/
├── config.js              # 配置文件
├── server.js              # 服务器入口文件
├── controllers/           # 控制器目录
│   └── ttsController.js   # TTS 控制器
├── services/              # 服务目录
│   ├── replicateService.js # Replicate API 服务
│   ├── minioService.js    # MinIO 存储服务
│   ├── sseService.js      # SSE 推送服务
│   └── rabbitmqService.js # RabbitMQ 消息队列服务
├── utils/                 # 工具目录
│   └── logger.js          # 日志工具
├── public/                # 公共资源目录
│   └── sse-client-example.html # SSE 客户端示例
├── client/                # 客户端 SDK
│   └── SSEClient.js       # SSE 客户端 SDK
├── logs/                  # 日志目录
├── .env                   # 环境变量文件
└── package.json           # 项目配置
```

