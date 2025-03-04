 (NOBRIDGE) WARN  `flexWrap: `wrap`` is not supported with the `VirtualizedList` components.Consider using `numColumns` with `FlatList` instead. [Component Stack]
 (NOBRIDGE) LOG  Loaded cradle settings: {"duration": 7, "enabled": true, "progress": 27, "startDate": "2025-03-02T12:16:20.486Z"}
 (NOBRIDGE) LOG  Loaded cradle characters: 5
 (NOBRIDGE) LOG  定时检查：没有需要处理的投喂数据
 (NOBRIDGE) LOG  定时检查：没有需要处理的投喂数据
 (NOBRIDGE) LOG  定时检查：没有需要处理的投喂数据
 (NOBRIDGE) LOG  [CircleService] Found user settings from UserContext
 (NOBRIDGE) LOG  [CircleService] Using global API provider from UserContext: openrouter
 (NOBRIDGE) LOG  [NodeSTManager] Processing circle interaction, type: newPost
 (NOBRIDGE) LOG  [NodeSTManager] API Provider: openrouter
 (NOBRIDGE) LOG  [NodeSTManager] OpenRouter Enabled: true
 (NOBRIDGE) LOG  [NodeSTManager] OpenRouter Model: google/gemini-2.0-flash-exp:free
 (NOBRIDGE) LOG  [NodeSTManager] OpenRouter API Key: present
 (NOBRIDGE) LOG  [NodeSTManager] Using API settings: {"openRouterEnabled": true, "openRouterModel": "google/gemini-2.0-flash-exp:free", "provider": "openrouter"}
 (NOBRIDGE) LOG  [NodeSTManager] Creating CircleManager with API provider: openrouter
 (NOBRIDGE) LOG  [NodeSTManager] OpenRouter enabled with model: google/gemini-2.0-flash-exp:free
 (NOBRIDGE) LOG  [NodeSTManager] OpenRouter API key length: 73
 (NOBRIDGE) LOG  [OpenRouterAdapter] Initialized with model: google/gemini-2.0-flash-exp:free
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: newPost，作者ID: ，响应者ID: 1740821349159
 (NOBRIDGE) LOG  [PromptBuilderService] 构建完成：R框架条目数=4，D类条目数=0，历史消息数=0
 (NOBRIDGE) LOG  [CircleManager] Getting chat response with API provider: openrouter
 (NOBRIDGE) LOG  [CircleManager] Using OpenRouter: true
 (NOBRIDGE) LOG  [CircleManager] Sending request to OpenRouter with model: google/gemini-2.0-flash-exp:free
 (NOBRIDGE) LOG  [CircleManager] Calling OpenRouterAdapter.generateContent
 (NOBRIDGE) LOG  [OpenRouterAdapter] Generating content with model: google/gemini-2.0-flash-exp:free
 (NOBRIDGE) LOG  [OpenRouterAdapter] Request messages count: 1
 (NOBRIDGE) ERROR  [OpenRouterAdapter] Error generating content: [TypeError: Cannot convert undefined value to object]
 (NOBRIDGE) LOG  [OpenRouterAdapter] Returning fallback response due to error
 (NOBRIDGE) LOG  [CircleManager] Got response from OpenRouter, length: 117
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) ERROR  【朋友圈】未找到JSON格式内容
 (NOBRIDGE) ERROR  【朋友圈】解析响应失败: [Error: 未能从AI回复中提取有效数据]
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740821349159 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"error": "未能从AI回复中提取有效数据", "success": false}
 (NOBRIDGE) LOG  [NodeSTManager] Circle interaction response success: false
 