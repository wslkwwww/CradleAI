
## Replicate 文本到图像后端服务

一个使用 Replicate API 生成图像并将图像存储在 MinIO 对象存储中的 Node.js 后端服务。现在支持实时状态更新、可靠的任务重试机制和基于用户余额的计费功能。

## 特点

- 使用 Replicate 的文本到图像模型 (Animagine-XL-4.0) 生成图像
- 将生成的图像存储在 MinIO 对象存储中
- 用于图像生成的 RESTful API 端点
- 参数验证和错误处理
- 基于环境的配置
- **实时任务状态更新 (SSE)**
- **可靠的消息队列处理和任务重试机制 (RabbitMQ)**
- **支持大量并发请求处理**
- **基于用户余额的计费功能**

## 设置

### 前提条件

- Node.js v14+
- MinIO 服务器
- Replicate API 令牌
- RabbitMQ 服务器
- 计费授权服务API

### 安装

1. 克隆仓库
2. 安装依赖项：

```bash
npm install
```

3. 基于 `.env.example` 文件创建 `.env` 文件：

```bash
cp .env.example .env
```

4. 使用您的凭据和配置编辑 `.env` 文件。

### 运行服务

启动服务器：

```bash
npm start
```

用于带有自动重载的开发：

```bash
npm run dev
```

集群模式（生产环境）：

```bash
npm run start:cluster
```

## API 端点

### POST /api/generate

根据文本提示生成图像并将其存储在 MinIO 中。

**请求体：**

```json
{
  "prompt": "街景，1个女孩，深紫色短发，紫色眼睛，中等胸部，乳沟，休闲服装，微笑，V",
  "negative_prompt": "nsfw, 裸体",
  "width": 1024,
  "height": 1024,
  "steps": 28,
  "batch_size": 1,
  "email": "user@example.com"
}
```

**响应：**

成功（立即完成）：
```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "urls": [
      "http://minio.example.com/images/replicate_12345678-1234-1234-1234-1234567890ab.png"
    ],
    "status": "succeeded"
  }
}
```

成功（后台处理）：
```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "message": "Image generation started",
    "status": "started"
  }
}
```

错误：
```json
{
  "success": false,
  "error": "错误信息",
  "taskId": "任务ID（如果已创建）"
}
```

余额不足：
```json
{
  "success": false,
  "error": "Insufficient credits. Please add more credits to your account."
}
```

### POST /api/generate/retry

重试失败的图像生成任务。

**请求体：**

```json
{
  "taskId": "需要重试的任务ID",
  "prompt": "街景，1个女孩，深紫色短发，紫色眼睛，中等胸部，乳沟，休闲服装，微笑，V",
  "negative_prompt": "nsfw, 裸体",
  "width": 1024,
  "height": 1024,
  "steps": 28,
  "batch_size": 1,
  "email": "user@example.com"
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "message": "Retry initiated successfully"
  }
}
```

### GET /api/generate/task/:taskId

查询任务状态。

**响应：**

```json
{
  "success": true,
  "data": {
    "taskId": "任务ID",
    "status": "当前状态",
    "prompt": "提示内容",
    "urls": ["生成图像URL（如果已完成）"],
    "createdAt": "创建时间",
    "completedAt": "完成时间（如果已完成）",
    "cost": "生成该图像的费用（如果已完成）",
    "predictTime": "图像生成所用的时间（秒）"
  }
}
```

### GET /events

连接到 SSE 事件流以接收实时任务更新。

**查询参数：** 
- `taskId` (可选) - 指定要监听的任务 ID

**事件类型：**
- `connected` - 连接建立时发送
- `task_update` - 任务状态更新时发送
- `heartbeat` - 定期发送的心跳信号

## 配置

配置通过环境变量管理：

| 变量 | 描述 | 默认值 |
|----------|-------------|---------|
| PORT | 服务器端口 | 3000 |
| REPLICATE_API_TOKEN | Replicate API 令牌 | - |
| MINIO_ENDPOINT | MinIO 服务器端点 | localhost:9000 |
| MINIO_ACCESS_KEY | MinIO 访问密钥 | minioadmin |
| MINIO_SECRET_KEY | MinIO 密钥 | minioadmin |
| MINIO_BUCKET_NAME | MinIO 存储桶名称 | images |
| MINIO_USE_SSL | 是否为 MinIO 使用 SSL | false |
| RABBITMQ_URL | RabbitMQ 服务器 URL | amqp://guest:guest@localhost:5672 |
| MAX_RETRIES | 最大重试次数 | 3 |
| RETRY_INITIAL_INTERVAL | 初始重试间隔(毫秒) | 10000 |
| LICENSE_API_ENDPOINT | 计费授权服务API地址 | https://license.cradleintro.top/api/v1/license |

## 计费功能

服务现在支持基于用户邮箱地址的计费功能，按照使用的计算时间收费。

### 计费流程

1. 用户在生成请求中提供邮箱地址
2. 服务在处理任务前检查用户余额是否充足
3. 如果余额不足，服务会拒绝任务并返回相应的错误信息
4. 成功生成图像后，系统会根据Replicate API使用时间计算费用
5. 系统会自动从用户账户扣除相应费用
6. 生成结果会包含实际花费的信息

### 计费配置

计费相关的配置位于环境变量或配置文件中：

```
LICENSE_API_ENDPOINT=https://license.cradleintro.top/api/v1/license
```

在 `config.js` 中的计费设置：

```javascript
license: {
  apiEndpoint: process.env.LICENSE_API_ENDPOINT || 'https://license.cradleintro.top/api/v1/license',
  costPerSecond: 0.01, // 每秒成本
  minCredits: 1.0 // 最小所需余额
}
```

## 实时状态更新 (SSE)

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

可用的任务状态包括：`started`, `queued`, `processing`, `downloading`, `succeeded`, `failed`, `retrying` 等。

## 可靠的重试机制

服务现在使用 RabbitMQ 实现了可靠的任务重试机制，具有以下特性：

1. **指数退避重试**: 失败的任务会自动以指数递增的时间间隔重试
2. **可配置的重试参数**: 可以在配置文件中设置最大重试次数、初始重试间隔和最大重试间隔
3. **手动重试 API**: 提供了手动触发任务重试的 API
4. **死信队列**: 超过最大重试次数的任务将移至死信队列以便后续分析

## RabbitMQ 配置

RabbitMQ 用于消息队列和任务重试机制。

### 基本配置

1. 确保 RabbitMQ 服务器正在运行
2. 服务将使用以下连接URL：`amqp://rabbitmq:hBw8C74RY5GJHRCF@localhost:5672`，其中包含：
   - 用户名：`rabbitmq`
   - 密码：`hBw8C74RY5GJHRCF`
   - 主机：`localhost`
   - 端口：`5672`
3. 服务将自动创建所需的队列：
   - `img_generation_queue`: 用于处理图像生成任务
   - `img_retry_queue`: 用于重试失败的任务
   - `img_dead_letter_queue`: 用于存储最终失败的任务

### RabbitMQ Web 管理界面配置

RabbitMQ 提供了一个 Web 管理界面，可以用于监控和管理队列：

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
   
## 工作流程

1. 前端发送包含生成图像请求和用户邮箱的 POST 请求
2. 系统检查用户余额是否充足
3. 服务创建任务并将其添加到 RabbitMQ 队列
4. 工作进程消费任务并调用 Replicate API 生成图像
5. 在生成过程中，服务通过 SSE 向客户端发送实时状态更新
6. 成功生成的图像保存到 MinIO 存储桶
7. 系统计算任务花费并从用户余额中扣除相应费用
8. 服务返回 MinIO 中图像文件的 URL 及相关费用信息
9. 如果生成失败，服务会根据配置的重试策略自动重试

## 测试

该项目提供了一个测试脚本，用于验证后端服务的完整流程。测试脚本将发送图像生成请求，并下载生成的图片到本地。

### 运行测试

确保 `.env` 文件已正确配置，然后运行：

```bash
npm test
```

测试脚本将：
1. 向后端发送图像生成请求
2. 等待图像生成完成
3. 下载生成的图像到 `tests/output` 目录
4. 提供详细的中文日志，记录整个过程

### 自定义测试参数

你可以在 `.env` 文件中设置 `TEST_SERVER_URL` 来测试不同环境中的后端服务：

```
TEST_SERVER_URL=http://yourserver.com:3000
```

也可以通过修改 `tests/test-generate.js` 文件中的 `config.testParams` 对象来自定义测试参数。

### 测试输出示例

测试脚本运行时会显示类似以下的详细中文日志：

```
[2023-11-30 15:30:45] 📢 信息: Replicate Text2Img 后端测试脚本启动
[2023-11-30 15:30:45] 📢 信息: Node.js 版本: v18.12.1
[2023-11-30 15:30:45] 📢 信息: ========== 开始测试会话 ID: a1b2c3d4 ==========
[2023-11-30 15:30:45] 📢 信息: 后端服务地址: http://localhost:3000
[2023-11-30 15:30:45] 📢 信息: 准备发送以下参数:
{
  "prompt": "高清动漫风景，樱花树下的日本传统神社，黄昏时分，云彩，细节丰富",
  "negative_prompt": "nsfw, 低质量, 模糊, 畸形, 不完整",
  "width": 1024,
  "height": 1024,
  "steps": 28,
  "batch_size": 1,
  "email": "test@example.com"
}
[2023-11-30 15:30:45] 📢 信息: 正在向 http://localhost:3000/generate 发送 POST 请求...
[2023-11-30 15:31:45] ✅ 成功: 请求成功完成！耗时: 60.00 秒
[2023-11-30 15:31:45] ✅ 成功: 服务器返回 1 个图片URL:
[
  "http://localhost:9000/images/replicate_a1b2c3d4-1234-1234-1234-1234567890ab.png"
]
[2023-11-30 15:31:45] 📢 信息: 任务费用: 0.60 元
[2023-11-30 15:31:45] 📢 信息: 预测时间: 60.12 秒
[2023-11-30 15:31:45] 📢 信息: 开始下载生成的图片...
[2023-11-30 15:31:45] 📢 信息: 开始下载图片: http://localhost:9000/images/replicate_a1b2c3d4-1234-1234-1234-1234567890ab.png
[2023-11-30 15:31:46] ✅ 成功: 图片已保存到: f:\my-app\replicate-text2img\tests\output\test_a1b2c3d4_image_1.png
[2023-11-30 15:31:46] ✅ 成功: ========== 测试完成 ==========
[2023-11-30 15:31:46] 📢 信息: 总耗时: 61.00 秒
[2023-11-30 15:31:46] ✅ 成功: 成功生成并下载了 1 个图片:
[2023-11-30 15:31:46] 📢 信息: - f:\my-app\replicate-text2img\tests\output\test_a1b2c3d4_image_1.png
[2023-11-30 15:31:46] 📢 信息: ========== 测试会话 ID: a1b2c3d4 结束 ==========
```

## 运行测试脚本

在宝塔面板部署后运行测试脚本，您有两种方式：

### 方式1：在服务器上直接运行

1. 通过SSH连接到服务器
2. 导航到项目目录
3. 运行测试脚本：
   ```bash
   npm test
   ```

### 方式2：从本地运行测试脚本

1. 将项目克隆到本地计算机
2. 安装依赖：
   ```bash
   npm install
   ```
3. 编辑 `.env` 文件，将 `TEST_SERVER_URL` 设置为您的宝塔服务器地址：
   ```
   TEST_SERVER_URL=http://your-server-ip:3000
   ```
   或
   ```
   TEST_SERVER_URL=http://your-domain.com
   ```
4. 运行测试：
   ```bash
   npm test
   ```

## 故障排除

### 1. "Cannot find module 'node-fetch'"

如果您看到以下错误消息：

```
Error: Cannot find module 'node-fetch'
```

这表明 node-fetch 模块尚未安装。请执行以下命令来安装它：

```bash
npm install node-fetch@2
```

### 2. "Headers is not defined" 或 "_fetch is not function"

这些错误是 Node.js 版本与 Replicate 库的兼容性问题。请按照以下步骤解决：

1. 确保已安装 node-fetch 模块 (版本 2):
   ```bash
   npm install node-fetch@2
   ```

2. 可以尝试运行自动修复脚本:
   ```bash
   bash install-script.sh
   ```

3. 如果以上方法不起作用，您可以手动编辑 Replicate 库的源代码:
   ```bash
   # 查找 replicate 库路径
   find node_modules -name "index.js" | grep replicate
   
   # 编辑找到的文件，在开头添加以下代码
   # const nodeFetch = require('node-fetch');
   # const fetch = nodeFetch.default || nodeFetch;
   # const Headers = nodeFetch.Headers;
   # global.fetch = fetch;
   # global.Headers = Headers;
   ```

### 3. 低版本 Node.js 的兼容性问题

如果您使用的是较旧版本的 Node.js (低于 v16)，可能会遇到各种兼容性问题。解决方案有以下选择：

1. 升级 Node.js 到 v16 或更高版本 (推荐):
   ```bash
   # 使用 nvm (Node Version Manager) 安装最新版本
   nvm install 16
   nvm use 16
   ```

2. 安装兼容性依赖:
   ```bash
   npm install node-fetch@2 form-data@4 abort-controller@3
   ```

3. 降级 Replicate 库版本:
   ```bash
   npm install replicate@0.12.0
   ```

### 4. "余额不足"错误

如果您收到以下错误：

```
Insufficient credits. Please add more credits to your account.
```

这表明用户账户余额不足。请执行以下操作：

1. 确认用户邮箱是否正确
2. 访问授权服务网站为用户充值
3. 检查 LICENSE_API_ENDPOINT 配置是否正确

### 5. 计费API连接问题

如果计费API连接失败，系统会记录警告日志，但仍会允许任务继续处理，稍后可以手动对账。如需解决此问题：

1. 检查网络连接
2. 验证授权服务API地址是否正确
3. 确保授权服务正常运行

### 故障排除

如果测试脚本报错：

1. **"Headers is not defined"**：
   - 这是由于 Node.js 版本兼容性问题，确保安装了 `node-fetch` 包：
   ```bash
   npm install node-fetch@2
   ```

2. **连接被拒绝**：
   - 检查服务器是否正在运行
   - 验证防火墙设置
   - 确认端口是否正确

3. **API Token 问题**：
   - 确保您的 `.env` 文件中有正确的 Replicate API Token
   - 验证 token 是否有效

4. **授权服务问题**：
   - 确保计费服务API地址配置正确
   - 验证用户邮箱格式是否正确

5. **MinIO 问题**：
   - 确保 MinIO 服务器正在运行
   - 验证 MinIO 凭据是否正确
   - 检查是否创建了正确的存储桶
```

Made changes.