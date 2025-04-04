# Replicate TTS API 文档

本文档描述了 Replicate TTS 后端服务的 API 接口。

## 基本信息

- **基础 URL**: `http://your-server:3002`
- **内容类型**: 所有请求和响应均使用 JSON 格式

## API 端点

### 生成音频

使用指定的模板生成音频文件。

**端点**: `POST /api/tts`

**请求参数**:

| 参数 | 类型 | 必选 | 描述 |
|------|------|------|------|
| templateId | 字符串 | 是 | 模板 ID，用于指定使用的预置音频模板。服务将从 `https://cradleintro.top/{templateId}/` 获取源文件 |
| tts_text | 字符串 | 是 | 要生成的音频文本内容 |
| instruction | 字符串 | 否 | 语音生成指令，提供情感和风格引导 |
| task | 字符串 | 否 | 任务类型，如 "Instructed Voice Generation" 用于增强型语音 |

**请求示例**:

```json
{
  "templateId": "template1",
  "tts_text": "这是一段要转换为语音的示例文本。"
}
```

**增强型语音请求示例**:

```json
{
  "templateId": "template1",
  "tts_text": "这是一段<strong>增强</strong>的文本。[breath] <laughter>真有趣</laughter>!",
  "instruction": "活泼开朗，带有一点调皮的语气",
  "task": "Instructed Voice Generation"
}
```

**成功响应** (HTTP 状态码: 200):

```json
{
  "success": true,
  "data": {
    "audio_url": "http://minio-server:19000/tts-audio/audio-uuid.wav",
    "processingTime": 4532,
    "cached": false
  }
}
```

**错误响应** (HTTP 状态码: 400, 404, 500, 503):

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 可能的错误代码

| HTTP 状态码 | 错误原因 |
|------------|---------|
| 400 | 缺少必要参数 |
| 404 | 源文件不存在或无法访问 |
| 429 | 请求频率超过限制 |
| 500 | 服务器内部错误，可能包括 Replicate API 调用失败、MinIO 存储失败等 |
| 503 | 服务暂时不可用，等待队列已满 |

## 健康检查

检查服务是否正常运行。

**端点**: `GET /health`

**成功响应** (HTTP 状态码: 200):

```json
{
  "status": "OK",
  "message": "Service is running",
  "workerId": "12345"
}
```

## 并发性能优化

为了支持生产环境中的高并发请求，系统实现了以下优化机制：

### 请求处理优化

1. **请求去重与缓存**: 
   - 对于相同参数的请求，短时间内只处理一次，后续请求直接使用缓存结果
   - 请求缓存使用 TTL 机制，默认 5 分钟过期

2. **请求队列与并发控制**:
   - 最大并发请求数限制（默认 20），超出限制时请求进入队列
   - 队列请求设置超时机制（默认 60 秒），防止请求无限等待

3. **集群模式**:
   - 生产环境下自动使用集群模式，基于 CPU 核心数启动多个工作进程
   - 支持优雅重启和故障自动恢复

### API 调用优化

1. **Replicate API 调用控制**:
   - 限制并发 API 调用数（默认 10），防止过多请求耗尽资源
   - 实现重试机制和指数退避策略，提高远程服务调用成功率

2. **连接池与请求优化**:
   - 使用 axios 连接池优化网络请求
   - 下载大文件时使用优化配置，支持最大 100MB 文件

### 安全和访问控制

1. **请求限流**:
   - 基于 IP 的访问频率限制（默认每 IP 每分钟 60 次请求）
   - 超出限制时返回 429 状态码

2. **请求大小限制**:
   - 限制请求体大小（最大 1MB），防止过大请求攻击

3. **安全增强**:
   - 使用 Helmet 提供基本安全头，防御常见 Web 攻击
   - 生产环境中隐藏详细错误信息

## 环境变量

可以通过设置以下环境变量来调整服务行为：

| 变量名 | 描述 | 默认值 |
|-------|------|------|
| MAX_CONCURRENT_TTS | 服务最大并发请求数 | 20 |
| MAX_CONCURRENT_REPLICATE | 最大并发 Replicate API 调用数 | 10 |
| DISABLE_CLUSTERING | 设为 "true" 禁用集群模式 | false |
| NODE_ENV | 环境类型，"production" 启用生产模式配置 | development |

## 性能注意事项

- 生产环境推荐使用集群模式以充分利用多核 CPU
- 语音生成是计算密集型任务，建议在高性能服务器上运行
- 服务会使用缓存减少重复请求，对相似请求有更高效率
- 请合理设置并发限制，避免资源耗尽导致服务崩溃
