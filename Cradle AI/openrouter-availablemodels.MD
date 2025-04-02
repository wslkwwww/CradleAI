OpenRouter 提供了一个 API 端点，用于列出可用模型：
```
curl https://openrouter.ai/api/v1/models

{
  "data": [
    {
      "id": "id",
      "name": "name",
      "created": 1741818122,
      "description": "description",
      "architecture": {
        "input_modalities": [
          "text",
          "image"
        ],
        "output_modalities": [
          "text"
        ],
        "tokenizer": "GPT"
      },
      "top_provider": {
        "is_moderated": true
      },
      "pricing": {
        "prompt": "0.0000007",
        "completion": "0.0000007",
        "image": "0",
        "request": "0",
        "input_cache_read": "0",
        "input_cache_write": "0",
        "web_search": "0",
        "internal_reasoning": "0"
      },
      "context_length": 128000,
      "per_request_limits": {
        "key": "value"
      }
    }
  ]
}
```