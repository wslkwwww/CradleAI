## Replicate API 认证、使用及预测生命周期

本文档介绍了如何使用 Replicate API 进行身份验证，以及如何使用 JavaScript 客户端库来运行模型，并处理预测生命周期。

### 身份验证

所有 API 请求都需要使用 token 进行身份验证。 Token 就像密码一样，可以唯一标识您的帐户并授予您访问权限。

Replicate 客户端会查找名为 `REPLICATE_API_TOKEN` 的环境变量，如果找到，则使用它。

**设置 Token：**

您可以通过以下方式设置 token：

```bash
export REPLICATE_API_TOKEN=r8_8tL**********************************
```

或者，您可以在 `.env` 文件中添加相同的 token：

```
REPLICATE_API_TOKEN=r8_8tL**********************************
```

Replicate API 使用 `Authorization` HTTP Header进行身份验证。 如果您使用的是客户端库，则会自动处理此头部。

**测试 Token：**

您可以使用 `account.get` 端点测试您的 access token 是否设置正确：

```bash
curl https://api.replicate.com/v1/account -H "Authorization: Bearer $REPLICATE_API_TOKEN"
# {"type":"user","username":"aron","name":"Aron Carroll","github_url":"https://github.com/aron"}
```

如果设置正确，您将看到一个包含帐户信息的 JSON 对象。 否则，请确保您的 token 可用：

```bash
echo "$REPLICATE_API_TOKEN"
# "r8_xyz"
```

### NodeJS 设置

NodeJS 支持两种模块格式：ESM 和 CommonJS。 下面详细介绍了每种环境的设置。 设置后，无论模块格式如何，代码都是相同的。

**ESM:**

1. 确保您有一个 NodeJS 项目：

```bash
npm create esm -y
```

2. 使用 npm 安装 replicate JavaScript 库：

```bash
npm install replicate
```

3. 导入并创建 Replicate 实例：

```javascript
import Replicate from "replicate";

const replicate = new Replicate();
```

这会自动使用您在环境中设置的 `REPLICATE_API_TOKEN` API token 进行授权。

**CommonJS:**

1. 确保您有一个 NodeJS 项目：

```bash
npm create -y
```

2. 使用 npm 安装 replicate JavaScript 库：

```bash
npm install replicate
```

3. 导入并创建 Replicate 实例：

```javascript
const Replicate = require("replicate");

const replicate = new Replicate();
```

这会自动使用您在环境中设置的 `REPLICATE_API_TOKEN` API token 进行授权。

### 运行模型

使用 `replicate.run()` 方法运行模型。 该方法接受模型 ID 和一个包含输入参数的对象。

**输入参数 (Input Schema):**

```json
{
  "type": "object",
  "title": "Input",
  "properties": {
    "vae": {
      "enum": [
        "default",
        "Animagine-XL-4.0"
      ],
      "type": "string",
      "title": "vae",
      "description": "The VAE to use",
      "default": "default",
      "x-order": 1
    },
    "seed": {
      "type": "integer",
      "title": "Seed",
      "default": -1,
      "x-order": 14,
      "description": "The seed used when generating, set to -1 for random seed"
    },
    "model": {
      "enum": [
        "Animagine-XL-4.0"
      ],
      "type": "string",
      "title": "model",
      "description": "The model to use",
      "default": "Animagine-XL-4.0",
      "x-order": 0
    },
    "steps": {
      "type": "integer",
      "title": "Steps",
      "default": 28,
      "maximum": 100,
      "minimum": 1,
      "x-order": 12,
      "description": "The steps when generating"
    },
    "width": {
      "type": "integer",
      "title": "Width",
      "default": 1024,
      "maximum": 4096,
      "minimum": 1,
      "x-order": 8,
      "description": "The width of the image"
    },
    "height": {
      "type": "integer",
      "title": "Height",
      "default": 1024,
      "maximum": 4096,
      "minimum": 1,
      "x-order": 9,
      "description": "The height of the image"
    },
    "prompt": {
      "type": "string",
      "title": "Prompt",
      "default": "street, 1girl, dark-purple short hair, purple eyes, medium breasts, cleavage, casual clothes, smile, V",
      "x-order": 2,
      "description": "The prompt, uses Compel weighting syntax"
    },
    "cfg_scale": {
      "type": "number",
      "title": "Cfg Scale",
      "default": 5,
      "maximum": 50,
      "minimum": 1,
      "x-order": 4,
      "description": "CFG scale defines how much attention the model pays to the prompt when generating, set to 1 to disable"
    },
    "clip_skip": {
      "type": "integer",
      "title": "Clip Skip",
      "default": 1,
      "minimum": 1,
      "x-order": 7,
      "description": "How many CLIP layers to skip, 1 is actually no skip, this is the behavior in A1111 so it's aligned to it"
    },
    "pag_scale": {
      "type": "number",
      "title": "Pag Scale",
      "default": 3,
      "maximum": 50,
      "minimum": 0,
      "x-order": 6,
      "description": "PAG scale is similar to CFG but it literally makes the result better, it's compatible with CFG too, set to 0 to disable"
    },
    "scheduler": {
      "enum": [
        "DPM++ 2M SDE Karras",
        "UniPC",
        "Heun",
        "DDIM",
        "DPM2 a",
        "DPM2 a Karras",
        "DPM SDE",
        "DDPM",
        "DPM++ SDE",
        "DPM++ SDE Karras",
        "LMS",
        "LMS Karras",
        "Euler a",
        "Euler",
        "PNDM",
        "DPM2",
        "DPM2 Karras",
        "DEIS",
        "DPM++ 2M",
        "DPM++ 2M Karras",
        "DPM++ 2M SDE"
      ],
      "type": "string",
      "title": "scheduler",
      "description": "The scheduler to use",
      "default": "Euler a",
      "x-order": 11
    },
    "batch_size": {
      "type": "integer",
      "title": "Batch Size",
      "default": 1,
      "maximum": 4,
      "minimum": 1,
      "x-order": 13,
      "description": "Number of images to generate (1-4), note if you set this to 4, some high resolution gens might fail because of not enough VRAM"
    },
    "negative_prompt": {
      "type": "string",
      "title": "Negative Prompt",
      "default": "nsfw, naked",
      "x-order": 3,
      "description": "The negative prompt (For things you don't want), uses Compel weighting syntax"
    },
    "guidance_rescale": {
      "type": "number",
      "title": "Guidance Rescale",
      "default": 0.5,
      "maximum": 5,
      "minimum": 0,
      "x-order": 5,
      "description": "The amount to rescale CFG generated noise to avoid generating overexposed images, set to 0 or 1 to disable"
    },
    "prepend_preprompt": {
      "type": "boolean",
      "title": "Prepend Preprompt",
      "default": true,
      "x-order": 10,
      "description": "Prepend preprompt (Prompt: \"masterpiece, high score, great score, absurdres, \" Negative prompt: \"lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, \")"
    }
  }
}
```

**输出参数 (Output Schema):**

```json
{
  "type": "array",
  "items": {
    "type": "string",
    "format": "uri"
  },
  "title": "Output"
}
```

**示例代码:**

```javascript
const input = {
  prompt: "street, 1girl, dark-purple short hair, purple eyes, medium breasts, cleavage, casual clothes, smile, V",
  negative_prompt: "nsfw, naked",
  width: 512,
  height: 512
};

const output = await replicate.run("aisha-ai-official/animagine-xl-4.0:057e2276ac5dcd8d1575dc37b131f903df9c10c41aed53d47cd7d4f068c19fa5", { input });

import { writeFile } from "node:fs/promises";
for (const [index, item] of Object.entries(output)) {
  await writeFile(`output_${index}.png`, item);
}
//=> output_0.png written to disk
```

该函数直接返回输出，您可以直接使用或作为另一个模型的输入传递。 如果您想访问完整的预测对象（不仅仅是输出），请改用 `replicate.predictions.create()` 方法。 这将包括预测 ID、状态、日志等。

### 预测生命周期

运行预测和训练通常需要很长时间才能完成，超出 HTTP 请求/响应的合理时间。

当您在 Replicate 上运行模型时，预测会创建为 “starting” 状态，然后立即返回。 然后它将移动到 "processing"，最终到 “successful”、“failed” 或 “canceled” 之一。

**预测状态：**

*   **Starting:** 预测已创建，但尚未开始处理。
*   **Running:** 预测正在处理中。
*   **Succeeded:** 预测成功完成。
*   **Failed:** 预测失败。
*   **Canceled:** 预测已取消。

您可以使用 `predictions.get()` 方法检索预测的最新版本，直到完成为止，从而探索预测生命周期。

### Webhooks

Webhooks 提供有关预测的实时更新。 在创建预测时指定一个端点，Replicate 将在该预测创建、更新和完成时向该 URL 发送 HTTP POST 请求。

可以向 `predictions.create()` 函数提供一个 URL，当预测状态更改时，Replicate 将请求该 URL。 这是轮询的替代方法。

要接收 webhooks，您需要一个 web 服务器。 以下示例使用 Hono，这是一个基于 web 标准的服务器，但此模式适用于大多数框架。

然后创建预测，传入 webhook URL，并指定要接收的事件，例如 "start"、"output"、”logs” 和 "completed"。

```javascript
const input = {
  prompt: "street, 1girl, dark-purple short hair, purple eyes, medium breasts, cleavage, casual clothes, smile, V",
  negative_prompt: "nsfw, naked",
  width: 512,
  height: 512
};

const callbackURL = `https://my.app/webhooks/replicate`;
await replicate.predictions.create({
  version: "057e2276ac5dcd8d1575dc37b131f903df9c10c41aed53d47cd7d4f068c19fa5",
  input: input,
  webhook: callbackURL,
  webhook_events_filter: ["completed"],
});

// The server will now handle the event and log:
// => {"id": "xyz", "status": "successful", ... }
```

ℹ️ 这里没有使用 `replicate.run()` 方法。 因为我们使用的是 webhooks，并且不需要轮询更新。

协调预测请求和 webhook 响应需要一些粘合代码。 单个 JavaScript 服务器的简单实现可以使用事件发射器来管理它。

从安全角度来看，也可以验证 webhook 是否来自 Replicate。 请查看我们的 webhook 验证文档了解更多信息。

### 访问预测

您可能希望访问预测对象。 在这些情况下，更容易使用 `replicate.predictions.create()` 或 `replicate.deployments.predictions.create()` 函数，它们将返回预测对象。

请注意，这些函数只会返回创建的预测，并且在返回之前不会等待该预测完成。 使用 `replicate.predictions.get()` 获取最新预测。

```javascript
const input = {
  prompt: "street, 1girl, dark-purple short hair, purple eyes, medium breasts, cleavage, casual clothes, smile, V",
  negative_prompt: "nsfw, naked",
  width: 512,
  height: 512
};

const prediction = replicate.predictions.create({
  version: "057e2276ac5dcd8d1575dc37b131f903df9c10c41aed53d47cd7d4f068c19fa5",
  input
});
// { "id": "xyz123", "status": "starting", ... }
```

### 取消预测

您可能需要取消预测。 也许用户已离开浏览器或取消了您的应用程序。 为了防止不必要的工作并降低运行时成本，您可以使用 `replicate.predictions.cancel` 函数并传递预测 ID。

```javascript
await replicate.predictions.cancel(prediction.id);
```