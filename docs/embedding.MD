Embedding模型调用方法：

**URL:**

```
https://www.blueshirtmap.com/v1/embeddings
```


**测试用apikey:**


sk-34kx4CSKfjbZt7Pk16A3De55241c4fE0B0B5C677862aEf71

**方法:**

```
POST
```

**描述:**

获取给定输入的矢量表示，机器学习模型和算法可以轻松使用该表示。创建表示输入文本的嵌入向量。

**请求参数:**

*   **Header:**
    *   `Authorization` (string, 可选):  `Bearer {{YOUR_API_KEY}}`， 其中 `{{YOUR_API_KEY}}` 替换为你的 API 密钥。

*   **Body (application/json):**
    *   `model` (string, 必需): 要使用的模型的 ID。使用 List models API 查看所有可用模型。
    *   `input` (string, 必需):  输入文本，编码为字符串或标记数组。如果需要批量获取，传递一个字符串数组或标记数组数组。每个输入的长度不得超过 8192 个标记。

    ```json
    {
      "model": "text-embedding-ada-002",
      "input": "The food was delicious and the waiter..."
    }
    ```

**响应:**

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [
        0.0023064255,
        -0.009327292,
        .... (1536 floats total for ada-002)
        -0.0028842222
      ],
      "index": 0
    }
  ],
  "model": "text-embedding-ada-002",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

**响应字段:**

*   `object` (string):  固定值为 `"list"`。
*   `data` (array): 嵌入向量的数组。
    *   `object` (string):  固定值为 `"embedding"`。
    *   `embedding` (array of floats): 嵌入向量，维度取决于选择的模型 (例如, `text-embedding-ada-002` 是 1536 维)。
    *   `index` (integer): 输入在输入数组中的索引。
*   `model` (string):  使用的模型 ID。
*   `usage` (object): 令牌使用情况统计。
    *   `prompt_tokens` (integer):  prompt 使用的 tokens 数量。
    *   `total_tokens` (integer):  总共使用的 tokens 数量。