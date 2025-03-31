OpenRouter 提供了一个 API 端点，用于列出特定模型的可用端点及其功能：

**API 端点：**

`GET https://openrouter.ai/api/v1/models/:author/:slug/endpoints`

**路径参数：**

*   **author (string, Required):** 模型作者。
*   **slug (string, Required):** 模型标识符。

**响应 (数据字段 - data):**

响应返回一个 JSON 对象，包含以下关于模型的端点信息：

*   **id (string):** 端点 ID。
*   **name (string):** 端点名称。
*   **created (double):** 端点创建时间（时间戳）。
*   **description (string):** 端点描述。
*   **architecture (object):** 模型架构信息
    *   **tokenizer (string, Optional):**  分词器类型。
    *   **instruct_type (string, Optional):**  指令类型。
    *   **modality (string, Optional):**  模态类型.
*   **endpoints (list of objects):** 端点列表，每个端点对象包含：
    *   **name (string):** 端点名称。
    *   **context_length (double):** 上下文长度 (以 token 计)。
    *   **pricing (object):** 定价信息:
        *   **request (string):** 请求费用。
        *   **image (string):** 图像处理费用。
        *   **prompt (string):** prompt 费用。
        *   **completion (string):** 完成费用。
    *   **provider_name (string):** 提供者名称。
    *   **supported_parameters (list of strings):**  端点支持的参数列表。
    *   **quantization (string, Optional):** 量化类型。
    *   **max_completion_tokens (double, Optional):** 最大补全 token 数。
    *   **max_prompt_tokens (double, Optional):**  最大 prompt token 数。
    *   **status (string, Optional):** 端点状态。

**总结：**

通过此 API，可以查询特定模型的可用端点，并获取有关这些端点的关键信息，如上下文长度、定价、支持的参数和量化类型等，这对于选择适合特定任务的模型和端点非常有帮助。  `supported_parameters`字段可以用来确定某个模型支持哪些`chat completion` request 里面的参数。