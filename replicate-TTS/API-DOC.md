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

**请求示例**:

```json
{
  "templateId": "template1",
  "tts_text": "这是一段要转换为语音的示例文本。"
}
```

**成功响应** (HTTP 状态码: 200):

```json
{
  "success": true,
  "data": {
    "audio_url": "http://minio-server:19000/tts-audio/audio-uuid.wav"
  }
}
```

**错误响应** (HTTP 状态码: 400, 404, 500):

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
| 500 | 服务器内部错误，可能包括 Replicate API 调用失败、MinIO 存储失败等 |

## 健康检查

检查服务是否正常运行。

**端点**: `GET /health`

**成功响应** (HTTP 状态码: 200):

```json
{
  "status": "OK",
  "message": "Service is running"
}
```
