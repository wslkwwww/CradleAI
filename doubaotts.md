火山引擎的大模型语音合成API提供了两种接入方式：WebSocket和HTTP。

**WebSocket接入**

*   接口地址：`wss://openspeech.bytedance.com/api/v1/tts/ws_binary`
*   认证方式：Bearer Token，在请求header中加入`"Authorization": "Bearer; {token}"`，并在请求json中填入appid。Bearer和token用分号;分隔。
*   请求方式：二进制协议。报文格式包含协议版本、报头大小、消息类型、特定标志、序列化方法、压缩方法和保留字段。
    *   Full client request：用于发送合成文本等请求，Header size为4B，Message type为`b0001`，Message type specific flags为`b0000`，Message serialization method为`b0001` (JSON)。
    *   Audio-only server response：用于接收音频数据，Header size为4B，Message type为`b1011`，Message serialization method为`b0000` (raw bytes)。Message type specific flags用于表示sequence number。
*   注意事项：
    *   每次合成需要重新设置唯一的reqid（建议使用uuid.V4）。
    *   单个WebSocket连接仅支持单次合成，多次合成需要多次建立连接。
    *   operation参数需要设置为"submit"才能流式返回音频。
    *   WebSocket握手成功后，返回Response header中包含X-Tt-Logid，建议获取并打印以便问题定位。

**HTTP接入**

*   接口地址：`https://openspeech.bytedance.com/api/v1/tts`
*   认证方式：Bearer Token，在请求Header中加入`"Authorization": "Bearer;${token}"`。Bearer和token用分号;分隔。
*   请求方式：HTTP POST，返回JSON格式数据，音频数据经过base64编码，需要解码。
*   注意事项：
    *   每次合成需要重新设置唯一的reqid（建议使用UUID/GUID）。
    *   operation参数需要设置为"query"。
    *   HTTP握手成功后，返回Response header中包含X-Tt-Logid，建议获取并打印以便问题定位。

**通用请求参数**

WebSocket和HTTP接入方式的请求参数相同，主要包括：

*   `app` (dict, 必需): 应用相关配置
    *   `appid` (string, 必需): 应用标识，需要申请
    *   `token` (string, 必需): 应用令牌，可传任意非空字符串
    *   `cluster` (string, 必需): 业务集群，固定为"volcano\_tts"
*   `user` (dict, 必需): 用户相关配置
    *   `uid` (string, 必需): 用户标识，可传任意非空字符串
*   `audio` (dict, 必需): 音频相关配置
    *   `voice_type` (string, 必需): 音色类型
    *   `emotion` (string, 可选): 音色情感，部分音色支持
    *   `enable_emotion` (bool, 可选): 是否开启音色情感
    *   `emotion_scale` (float, 可选): 情绪值设置，范围1~5
    *   `encoding` (string, 可选): 音频编码格式 (wav/pcm/ogg\_opus/mp3)，默认为pcm
    *   `speed\_ratio` (float, 可选): 语速，\[0.8,2\]，默认为1
    *   `rate` (int, 可选): 音频采样率，默认为24000
    *   `bitrate` (int, 可选): 比特率，单位kb/s，默认160 kb/s
    *   `explicit_language` (string, 可选): 明确语种
    *   `context_language` (string, 可选): 参考语种
    *   `loudness_ratio` (float, 可选): 音量调节，\[0.5,2\]，默认为1
*   `request` (dict, 必需): 请求相关配置
    *   `reqid` (string, 必需): 请求标识，需要保证唯一
    *   `text` (string, 必需): 合成语音的文本，长度限制1024字节（UTF-8编码），建议小于300字符
    *   `text_type` (string, 可选): 文本类型，使用ssml时设置为"ssml"
    *   `silence_duration` (float, 可选): 句尾静音时长，范围0~30000ms
    *   `with_timestamp` (int/string, 可选): 是否返回时间戳，传入1启用
    *   `operation` (string, 必需): 操作类型，WebSocket为"submit"，HTTP为"query"
    *   `extra_param` (jsonstring, 可选): 附加参数，如disable\_markdown\_filter, enable\_latex\_tn, mute\_cut\_remain\_ms, cache\_config等

**返回参数**

*   `reqid` (string): 请求ID
*   `code` (int): 请求状态码，3000表示成功
*   `message` (string): 请求状态信息
*   `sequence` (int): 音频段序号，负数表示合成完毕 (WebSocket)
*   `data` (string): 合成音频数据，base64编码
*   `addition` (string): 额外信息父节点
    *   `duration` (string): 返回音频的长度，单位ms

**常见错误码**

包括但不限于：
*   3001: 无效的请求，参数值非法
*   3003: 并发超限
*   3005: 后端服务忙
*   3010: 文本长度超限
*   3011: 无效文本
*   3050: 音色不存在

**常见错误返回说明**

文档中提供了几种常见的错误返回信息及其原因和建议处理方式，如用量超限、并发超限、voice\_type/cluster错误、无效文本、鉴权失败、未拥有音色授权等。

**TypeScript接入示例 (基于WebSocket)**

以下是一个简化的TypeScript示例，展示如何使用WebSocket连接火山引擎语音合成API并发送请求。

```typescript
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const appid = 'YOUR_APPID'; // 替换为你的appid
const token = 'YOUR_TOKEN'; // 替换为你的token
const url = 'wss://openspeech.bytedance.com/api/v1/tts/ws_binary';

const ws = new WebSocket(url, {
  headers: {
    'Authorization': `Bearer;${token}`
  }
});

ws.on('open', () => {
  console.log('WebSocket connected');

  const reqid = uuidv4();
  const text = '你好，这是一个语音合成测试。';

  const request = {
    app: {
      appid: appid,
      token: token,
      cluster: 'volcano_tts',
    },
    user: {
      uid: 'test_user'
    },
    audio: {
      voice_type: 'zh_male_M392_conversation_wvae_bigtts', // 替换为你想使用的音色
      encoding: 'mp3',
      speed_ratio: 1.0,
    },
    request: {
      reqid: reqid,
      text: text,
      operation: 'submit',
    }
  };

  // WebSocket发送的是二进制数据，需要构建二进制报文
  // 这里仅为示例，实际应用中需要按照文档中的二进制协议格式构建数据
  // 简单的JSON发送方式 (可能不符合API的二进制协议要求，仅作演示)
  // 请参考文档中的二进制协议说明进行实际实现
  const jsonMessage = JSON.stringify(request);
  // 在实际应用中，需要将JSON数据按照二进制协议封装，例如添加header size，message type等
  // For demonstration, sending as plain text (likely won't work with binary protocol)
  // ws.send(jsonMessage);

  // Example of sending a simple binary buffer (does not follow the full protocol)
  // In a real application, implement the binary protocol as described in the documentation
  const jsonBuffer = Buffer.from(jsonMessage, 'utf-8');
  const header = Buffer.alloc(4); // Example header, doesn't follow the actual format
  header.writeUInt8(1, 0); // Example: Protocol version 1
  // ... encode other header fields according to documentation
  const dataToSend = Buffer.concat([header, jsonBuffer]); // Simplified concatenation

  ws.send(dataToSend);

  console.log('Request sent:', request);
});

ws.on('message', (data) => {
  // 接收到的数据是二进制音频数据 (Audio-only server response)
  // 实际应用中需要根据二进制协议解析消息类型和sequence number
  // 如果是音频数据，可以直接播放或保存
  console.log('Received message (binary data):', data);

  // For demonstration, attempting to parse as JSON (only for error messages or specific control messages)
  try {
    const message = JSON.parse(data.toString());
    console.log('Parsed message:', message);
    if (message.sequence < 0) {
        console.log('Audio synthesis finished.');
        ws.close(); // Close connection after receiving the last audio segment
    }
  } catch (e) {
    console.log('Received non-JSON data, likely audio.');
    // Process audio data (e.g., append to a buffer, play)
  }
});

ws.on('close', (code, reason) => {
  console.log(`WebSocket closed with code: ${code}, reason: ${reason}`);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// 要获取 appid 和 token，请参考文档中提到的 "控制台使用FAQ-Q1"。
// 在实际项目中，你需要根据文档中描述的二进制协议格式来正确构建发送的请求数据包。
// 上述示例中的二进制发送部分是简化的，仅用于说明概念。
```

**TypeScript接入示例 (基于HTTP)**

以下是一个简化的TypeScript示例，展示如何使用HTTP连接火山引擎语音合成API并发送请求。

```typescript
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer'; // Assuming Node.js environment for Buffer

const appid = 'YOUR_APPID'; // 替换为你的appid
const token = 'YOUR_TOKEN'; // 替换为你的token
const url = 'https://openspeech.bytedance.com/api/v1/tts';

const requestBody = {
  app: {
    appid: appid,
    token: token,
    cluster: 'volcano_tts',
  },
  user: {
    uid: 'test_user'
  },
  audio: {
    voice_type: 'zh_male_M392_conversation_wvae_bigtts', // 替换为你想使用的音色
    encoding: 'mp3', // HTTP接口支持多种编码格式
    speed_ratio: 1.0,
  },
  request: {
    reqid: uuidv4(),
    text: '你好，这是一个语音合成测试。',
    operation: 'query', // HTTP接口使用query
  }
};

axios.post(url, requestBody, {
  headers: {
    'Authorization': `Bearer;${token}`,
    'Content-Type': 'application/json'
  },
  responseType: 'json' // 指定响应类型为json
})
.then(response => {
  console.log('HTTP Response:', response.data);
  if (response.data && response.data.code === 3000) {
    const audioData = response.data.data; // base64 encoded audio data
    // 解码base64音频数据
    const audioBuffer = Buffer.from(audioData, 'base64');
    console.log('Decoded audio buffer:', audioBuffer);
    // 在这里处理解码后的音频数据，例如保存到文件或播放
  } else {
    console.error('Error in synthesis:', response.data.message);
  }
})
.catch(error => {
  console.error('HTTP request failed:', error);
});

// 要获取 appid 和 token，请参考文档中提到的 "控制台使用FAQ-Q1"。