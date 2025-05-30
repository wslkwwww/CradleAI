## 认证
每次发起 API 请求时，你都需要使用令牌进行身份验证。令牌就像密码一样，唯一标识你的账户并授予你访问权限。

以下所有示例都假设你的 Replicate 访问令牌可以从命令行获取。由于令牌是机密信息，不应该直接写在代码中，而应该存储在环境变量中。Replicate 客户端会查找 REPLICATE_API_TOKEN 环境变量并使用它。

要设置这个环境变量，你可以使用：

```
export REPLICATE_API_TOKEN=<粘贴你的令牌>
```

一些应用程序框架和工具也支持名为 .env 的文本文件，你可以编辑它来包含相同的令牌：

```
REPLICATE_API_TOKEN=<粘贴你的令牌>
```

Replicate API 使用 Authorization HTTP 头来验证请求。如果你使用的是客户端库，这个过程会自动为你处理。

你可以通过使用我们的 account.get 端点来测试你的访问令牌是否设置正确：

什么是 cURL？
```
curl https://api.replicate.com/v1/account -H "Authorization: Bearer $REPLICATE_API_TOKEN"
# {"type":"user","username":"aron","name":"Aron Carroll","github_url":"https://github.com/aron"}
```

如果配置正确，你会看到返回一个包含你账户信息的 JSON 对象，否则请确保你的令牌可用：

```
echo "$REPLICATE_API_TOKEN"
# "r8_xyz"
```

## 设置
NodeJS 支持两种模块格式：ESM 和 CommonJS。以下详细介绍了每种环境的设置。设置完成后，无论使用哪种模块格式，代码都是相同的。

### ESM
首先，你需要确保你有一个 NodeJS 项目：

```
npm create esm -y
```

然后使用 npm 安装 replicate JavaScript 库：

```
npm install replicate
```

要使用这个库，首先导入并创建一个实例：

```
import Replicate from "replicate";

const replicate = new Replicate();
```

这将使用你在环境中设置的 REPLICATE_API_TOKEN API 令牌进行授权。

### CommonJS
首先，你需要确保你有一个 NodeJS 项目：

```
npm create -y
```

然后使用 npm 安装 replicate JavaScript 库：

```
npm install replicate
```

要使用这个库，首先导入并创建一个实例：

```
const Replicate = require("replicate");

const replicate = new Replicate();
```

这将使用你在环境中设置的 REPLICATE_API_TOKEN API 令牌进行授权。

## 运行模型
使用 replicate.run() 方法来运行模型：

```javascript
const input = {
    text: "Speech-02-series is a Text-to-Audio and voice cloning technology that offers voice synthesis, emotional expression, and multilingual capabilities.\n\nThe HD version is optimized for high-fidelity applications like voiceovers and audiobooks. While the turbo one is designed for real-time applications with low latency.\n\nWhen using this model on Replicate, each character represents 1 token.",
    emotion: "angry",
    voice_id: "Deep_Voice_Man",
    language_boost: "English",
    english_normalization: true
};

const output = await replicate.run("minimax/speech-02-turbo", { input });
await writeFile("output.mp3", output);
//=> output.mp3 写入磁盘
```

你可以在模型页面上了解有关此模型的定价信息。

run() 函数直接返回输出，你可以使用它或将其作为输入传递给另一个模型。如果你想访问完整的预测对象（不仅仅是输出），请使用 replicate.predictions.create() 方法。这将包括预测 ID、状态、日志等。

## 预测生命周期
运行预测和训练通常需要大量时间才能完成，超出了 HTTP 请求/响应的合理范围。

当你在 Replicate 上运行模型时，预测会创建一个 "starting"（开始）状态，然后立即返回。然后它会转移到 "processing"（处理中），最终变为 "successful"（成功）、"failed"（失败）或 "canceled"（已取消）之一。

- Starting（开始）
- Running（运行中）
- Succeeded（成功）
- Failed（失败）
- Canceled（已取消）

你可以通过使用 predictions.get() 方法检索预测的最新版本，直到完成，来探索预测生命周期。













## Webhook
Webhook 提供有关你的预测的实时更新。在创建预测时指定一个端点，Replicate 将在预测创建、更新和完成时向该 URL 发送 HTTP POST 请求。

可以在 predictions.create() 函数中提供一个 URL，当预测状态发生变化时，Replicate 将请求该 URL。这是轮询的替代方案。

要接收 webhook，你需要一个 Web 服务器。以下示例使用 Hono，一个基于 Web 标准的服务器，但这种模式适用于大多数框架。

然后创建预测，传入 webhook URL 并指定你想接收的事件，可以是 "start"、"output"、"logs" 和 "completed" 中的一个或多个。

```javascript
const input = {
    text: "Speech-02-series is a Text-to-Audio and voice cloning technology that offers voice synthesis, emotional expression, and multilingual capabilities.\n\nThe HD version is optimized for high-fidelity applications like voiceovers and audiobooks. While the turbo one is designed for real-time applications with low latency.\n\nWhen using this model on Replicate, each character represents 1 token.",
    emotion: "angry",
    voice_id: "Deep_Voice_Man",
    language_boost: "English",
    english_normalization: true
};

const callbackURL = `https://my.app/webhooks/replicate`;
await replicate.predictions.create({
  model: "minimax/speech-02-turbo",
  input: input,
  webhook: callbackURL,
  webhook_events_filter: ["completed"],
});

// 服务器现在将处理事件并记录：
// => {"id": "xyz", "status": "successful", ... }
```

ℹ️ 这里没有使用 replicate.run() 方法。因为我们使用的是 webhook，不需要轮询更新。

在预测请求和 webhook 响应之间进行协调需要一些胶水代码。对于单个 JavaScript 服务器，可以使用事件发射器来管理这一过程。

从安全角度来看，也可以验证 webhook 是否来自 Replicate。查看我们关于验证 webhook 的文档以获取更多信息。

## 访问预测
你可能希望访问预测对象。在这些情况下，使用 replicate.predictions.create() 或 replicate.deployments.predictions.create() 函数更容易，它们将返回预测对象。

请注意，这些函数只会返回创建的预测，并且不会等待该预测完成后再返回。使用 replicate.predictions.get() 来获取最新的预测。

```javascript
const input = {
    text: "Speech-02-series is a Text-to-Audio and voice cloning technology that offers voice synthesis, emotional expression, and multilingual capabilities.\n\nThe HD version is optimized for high-fidelity applications like voiceovers and audiobooks. While the turbo one is designed for real-time applications with low latency.\n\nWhen using this model on Replicate, each character represents 1 token.",
    emotion: "angry",
    voice_id: "Deep_Voice_Man",
    language_boost: "English",
    english_normalization: true
};
const prediction = replicate.predictions.create({
  model: "minimax/speech-02-turbo",
  input
});
// { "id": "xyz123", "status": "starting", ... }
```

## 取消预测
你可能需要取消预测。也许用户已经离开了浏览器或取消了你的应用程序。为了防止不必要的工作并减少运行时成本，你可以使用 replicate.predictions.cancel 函数并传递预测 ID。

```javascript
await replicate.predictions.cancel(prediction.id);
```

## 在 React Native/Expo 中调用 Minimax TTS

### 1. 安装依赖

确保已安装 `replicate` 和 `expo-file-system`：

```sh
npm install replicate expo-file-system
```

### 2. 配置 API Token

将你的 Replicate API Token 保存在环境变量或安全存储中。建议通过用户设置界面输入并持久化。

### 3. 调用 MinimaxTTS 服务

你可以通过 `MinimaxTTS` 服务进行文本转语音：

```typescript
import { MinimaxTTS } from '@/services/MinimaxTTS';

// 初始化服务（推荐将 token 存储在用户设置中）
const tts = new MinimaxTTS('<你的 Replicate API Token>');

// 调用文本转语音
const result = await tts.textToSpeech({
  text: '你好，欢迎使用 Minimax 语音合成。',
  emotion: 'happy', // 可选
  voice_id: 'Deep_Voice_Man', // 可选
  language_boost: 'Chinese', // 可选
  english_normalization: true // 可选
});

// result.audioPath 即为本地音频文件路径，可直接用于播放
```

### 4. 参数说明

- `text`：要合成的文本（必填）
- `emotion`：情感类型，可选，支持 `neutral`、`happy`、`sad`、`angry`、`fear`、`disgust`、`surprise`
- `voice_id`：音色 ID，默认 `Deep_Voice_Man`
- `language_boost`：语言增强，默认 `English`
- `english_normalization`：英文归一化，默认 `true`
- `model`：模型名称，默认 `minimax/speech-02-turbo`，可自定义

### 5. 进阶：自定义模型

你可以通过设置 `model` 字段，切换不同的 Minimax 语音模型。例如：

```typescript
const tts = new MinimaxTTS('<token>', 'minimax/speech-02-turbo');
```

### 6. 结合用户设置

建议通过用户设置页面输入并保存 API Token 和模型名称，调用时自动读取，无需硬编码。