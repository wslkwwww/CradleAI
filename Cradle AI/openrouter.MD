下面是补充了 `chat completion` 请求参数的文档总结和翻译：

**快速入门**

**开始使用 OpenRouter**

OpenRouter 提供了一个统一的 API，让你可以通过单个端点访问数百个 AI 模型，同时自动处理回退并选择最具成本效益的选项。只需几行代码，使用你偏好的 SDK 或框架即可开始使用。

想和我们的文档聊天吗？下载一份 LLM 友好的完整文档文本文件，并将其包含在你的系统提示中。

在下面的例子中，OpenRouter 特有的标头是可选的。设置它们可以让你的应用出现在 OpenRouter 的排行榜上。

**使用 OpenAI SDK**

Python

TypeScript

```typescript
import OpenAI from 'openai';
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '<OPENROUTER_API_KEY>',
  defaultHeaders: {
    'HTTP-Referer': '<YOUR_SITE_URL>', // 可选。用于在 openrouter.ai 上进行排名的站点 URL。
    'X-Title': '<YOUR_SITE_NAME>', // 可选。用于在 openrouter.ai 上进行排名的站点标题。
  },
});
async function main() {
  const completion = await openai.chat.completions.create({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'user',
        content: '生命的意义是什么？',
      },
    ],
     stream: false, // Optional. Defaults to false. 启用流式传输结果。
     max_tokens: 100, // Optional. Maximum number of tokens (range: [1, context_length)).
     temperature: 0.7, // Optional. Sampling temperature (range: [0, 2]).
     seed: 123, // Optional. Seed for deterministic outputs.
     top_p: 0.9, // Optional. Top-p sampling value (range: (0, 1]).
     top_k: 50, // Optional. Top-k sampling value (range: [1, Infinity)).
     frequency_penalty: 0.0, // Optional. Frequency penalty (range: [-2, 2]).
     presence_penalty: 0.0, // Optional. Presence penalty (range: [-2, 2]).
     repetition_penalty: 1.1, // Optional. Repetition penalty (range: (0, 2]).
    // logit_bias: {}, // Optional. Mapping of token IDs to bias values.
     top_logprobs: 5, // Optional. Number of top log probabilities to return.
     min_p: 0.1, // Optional. Minimum probability threshold (range: [0, 1]).
     top_a: 0.5, // Optional. Alternate top sampling parameter (range: [0, 1]).
    // transforms: [], // Optional. List of prompt transforms (OpenRouter-only).
    // models: [], // Optional. Alternate list of models for routing overrides.
    // route: "fallback", // Optional. Defaults to fallback Model routing strategy (OpenRouter-only).
    // provider: {}, // Optional. Preferences for provider routing.
    // reasoning: {} //Optional. Configuration for model reasoning/thinking tokens
  });
  console.log(completion.choices[0].message);
}
main();
```

**直接使用 OpenRouter API**

Python

TypeScript

Shell

```typescript
fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // 可选。用于在 openrouter.ai 上进行排名的站点 URL。
    'X-Title': '<YOUR_SITE_NAME>', // 可选。用于在 openrouter.ai 上进行排名的站点标题。
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'user',
        content: '生命的意义是什么？',
      },
    ],
     stream: false, // Optional. Defaults to false. 启用流式传输结果。
     max_tokens: 100, // Optional. Maximum number of tokens (range: [1, context_length)).
     temperature: 0.7, // Optional. Sampling temperature (range: [0, 2]).
     seed: 123, // Optional. Seed for deterministic outputs.
     top_p: 0.9, // Optional. Top-p sampling value (range: (0, 1]).
     top_k: 50, // Optional. Top-k sampling value (range: [1, Infinity)).
     frequency_penalty: 0.0, // Optional. Frequency penalty (range: [-2, 2]).
     presence_penalty: 0.0, // Optional. Presence penalty (range: [-2, 2]).
     repetition_penalty: 1.1, // Optional. Repetition penalty (range: (0, 2]).
    // logit_bias: {}, // Optional. Mapping of token IDs to bias values.
     top_logprobs: 5, // Optional. Number of top log probabilities to return.
     min_p: 0.1, // Optional. Minimum probability threshold (range: [0, 1]).
     top_a: 0.5, // Optional. Alternate top sampling parameter (range: [0, 1]).
    // transforms: [], // Optional. List of prompt transforms (OpenRouter-only).
    // models: [], // Optional. Alternate list of models for routing overrides.
    // route: "fallback", // Optional. Defaults to fallback Model routing strategy (OpenRouter-only).
    // provider: {}, // Optional. Preferences for provider routing.
    // reasoning: {} //Optional. Configuration for model reasoning/thinking tokens
  }),
});
```

该 API 也支持流式传输 (streaming)。

**使用第三方 SDK**

有关将第三方 SDK 和框架与 OpenRouter 结合使用的信息，请参阅我们的框架文档。

**补充说明：**

*   我在代码示例中添加了所有可选参数，并使用注释标明。 你可以根据你的需求修改这些值或者删除不需要的参数。
*   `logit_bias`, `transforms`, `models`, `provider`, `reasoning`  这些参数需要更复杂的数据结构，所以我在注释中保留了它们的空对象或者空数组形式。 在实际使用中，你需要根据 OpenRouter 的文档来填充这些参数。
*  请将 `<OPENROUTER_API_KEY>` 替换成你自己的 OpenRouter API 密钥， `<YOUR_SITE_URL>` 替换成你的站点 URL，`<YOUR_SITE_NAME>`替换成你的站点名称.

**请求参数解释:**

*   **model (string, 必需):** 要使用的模型 ID。如果未指定，则使用用户的默认设置。
*   **messages (list of objects, 必需):** 包含对话历史的消息列表。每条消息包含 `role`（"system", "user", "assistant"）和 `content`。
*   **stream (boolean, 可选):**  是否启用流式传输结果。默认为 false。
*   **max_tokens (integer, 可选):** 生成的最大 token 数。范围：[1, context_length)。
*   **temperature (double, 可选):**  采样温度。控制生成结果的随机性。范围：[0, 2]。
*   **seed (integer, 可选):** 用于生成确定性输出的种子。
*   **top_p (double, 可选):** Top-p 采样值。范围：(0, 1]。
*   **top_k (integer, 可选):** Top-k 采样值。范围：[1, Infinity)。
*   **frequency_penalty (double, 可选):** 频率惩罚。范围：[-2, 2]。
*   **presence_penalty (double, 可选):**  存在惩罚。范围：[-2, 2]。
*   **repetition_penalty (double, 可选):** 重复惩罚。范围：(0, 2]。
*   **logit_bias (map from strings to doubles, 可选):**  token ID 到 bias 值的映射。
*   **top_logprobs (integer, 可选):**  返回的 top log probabilities 的数量。
*   **min_p (double, 可选):**  最小概率阈值。范围：[0, 1]。
*   **top_a (double, 可选):**  备用 top 采样参数。范围：[0, 1]。
*   **transforms (list of strings, 可选):** prompt 转换列表 (仅 OpenRouter)。
*   **models (list of strings, 可选):**  用于路由覆盖的备用模型列表。
*   **route (string, 可选):**  模型路由策略 (仅 OpenRouter)。默认为 "fallback"。
*   **provider (object, 可选):**  provider 路由的首选项。
*   **reasoning (object, 可选):** 模型推理/思考 token 的配置。