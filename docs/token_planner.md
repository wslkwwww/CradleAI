**技术需求文档：模型费用估算工具整合**

**1. 项目背景**

用户在使用 AI 聊天 App 时，经常关心使用不同模型会产生的费用。为了帮助用户更好地了解费用情况，并选择最适合自己的模型，我们需要在 App 的 `profile.tsx` 中增加一个功能`token_planner`和相对应的入口，一个模型费用估算工具。

**2. 目标**

*   提供一个用户友好的界面，让用户可以输入自己的使用习惯和预算。
*   根据用户输入，估算使用不同模型每月的费用和可聊天天数。
*   帮助用户选择最适合自己需求和预算的模型。

**3. 功能需求**

3.1. **用户输入**

在`profile.tsx` 增加一个功能入口，允许用户输入以下信息：

*   **用户输入字数：** 预计每次输入的最大字数 (数值输入框，默认值：100)。
*   **期望角色输出字数：** 预计每次角色回复的最大字数 (数值输入框，默认值：200)。
*   **角色卡字数：** 角色卡的总字数 (数值输入框，默认值：500)。
*   **每月图片数量（可选）：**  预计每月发送的图片数量 (数值输入框，默认为 0)。  提供一个开关，用于启用/禁用图片数量输入。
*   **对话轮数记忆窗口：** 期望每次对话记住多少轮历史对话 (数值输入框，默认值：5)。
*   **每月预算：**  每月愿意支付的最高费用 (数值输入框，默认值：30 元)。
*   **每天聊天条数：**  每天预计的聊天条数 (数值输入框，默认值：300)。
*   **文字和token转换比率：** 调整文字转换成token的比率，默认0.75，用户可以调整，以便调整token数量(数值输入框，默认值：0.75)。

3.2. **模型选择**

*   根据文档`openrouter-availablemodels.MD`获取可用的模型列表，包括模型的 ID、名称、描述和价格信息（输入/输出/图片）。
*   API 返回的数据结构参考：

```json
{
    "data": [
    //..其他参数       
        "pricing": {
          "prompt": "0.0000001", //输入价格
          "completion": "0.0000001",//输出价格
          "request": "0",
          "image": "0",//图片输入价格
          "web_search": "0",
          "internal_reasoning": "0",
          "input_cache_read": "0",
          "input_cache_write": "0"
        },
    //..其他参数 
    ]
}
```

3.3. **费用估算**

*   根据用户输入和模型价格信息，估算使用每个模型每月的费用和可聊天天数。
*   Token 计算公式：
    *   `input_tokens = user_input_words * token_per_word_ratio`
    *   `output_tokens = expected_output_words * token_per_word_ratio`
    *   `role_card_tokens = role_card_words * token_per_word_ratio`
    *   `chat_history_tokens = conversation_turns * (input_tokens + output_tokens)`
    *   `total_tokens_per_chat = input_tokens + output_tokens + role_card_tokens + chat_history_tokens`
    *   `total_daily_tokens = total_tokens_per_chat * daily_chats`
    *   `total_monthly_tokens = total_daily_tokens * 30`
*   费用计算公式：
    *   `input_cost = (total_monthly_tokens / 1000000) * input_price_per_million_tokens`
    *   `output_cost = (total_monthly_tokens / 1000000) * output_price_per_million_tokens`
    *   `image_cost = (image_count / 1000000) * image_price_per_million_images`
    *   `total_monthly_cost = input_cost + output_cost + image_cost`
*   可聊天天数计算公式：
    *   `days_can_chat = monthly_budget / (total_daily_tokens/ 1000000 * (input_price_per_million_tokens + output_price_per_million_tokens)  + (image_count/30) / 1000000 * image_price_per_million_images)`

3.4. **结果展示**

*   默认只展示 `days_can_chat >= 25` 的模型，按照 `estimated_monthly_cost` 升序排序。
*   展示的信息包括：模型名称、预计每月费用、预计可聊天天数，以及简单的提示信息（例如 "在您的预算下，使用 XXX 模型，预计每月可以连续聊天 YYY 天。"）。
*   提供一个 "查看所有模型" 按钮/选项，点击后展示所有模型。
*   在每个模型的结果中，提供展开/折叠按钮，点击后显示详细信息（`total_monthly_tokens`、`input_cost`、`output_cost`、`image_cost`）。

3.5. **数据持久化（可选）**

*   可以将用户输入的数据保存在本地存储 (例如 `localStorage`)，以便用户下次打开页面时自动加载。
*   如果用户登录了账号，可以将数据保存在后端数据库中，实现跨设备同步。

**4. 技术设计**

4.3. **组件设计**

*   `ModelInputForm.tsx`：
    *   负责渲染用户输入表单。
    *   处理用户输入验证。
*   `ModelResultList.tsx`：
    *   负责展示模型费用估算结果。
    *   处理 "查看所有模型" 和展开/折叠详细信息的功能。
*    `ModelResultItem.tsx`:
        * 负责显示每一个模型的基本信息和明细信息


**5. 逻辑流程**

1.  组件加载时，从后端 API 获取模型列表。
2.  用户在 `ModelInputForm.tsx` 中输入相关信息。
3.  用户点击 "计算" 按钮后，`Profile.tsx` 组件收集用户输入，并根据公式计算每个模型的费用和可聊天天数。
4.  `ModelResultList.tsx` 组件根据计算结果，默认展示 `days_can_chat >= 25` 的模型。
5.  用户点击 "查看所有模型" 按钮后，`ModelResultList.tsx` 组件展示所有模型。
6.  用户可以展开/折叠每个模型的详细信息。

**6. 错误处理**

*   API 调用失败：显示错误提示信息。
*   无效的用户输入：在 `ModelInputForm.tsx` 中进行输入验证，并显示错误提示信息。
*   费用计算出错：显示通用的错误提示信息。

**78. 性能优化**

*   缓存 API 返回的模型列表，减少 API 调用次数。
*   对计算结果进行适当的缓存，避免重复计算。
*   优化 `ModelResultList.tsx` 组件的渲染性能。

**9. 界面设计**

*   页面结构要和app风格统一
*   使用清晰简洁的UI组件库，保证用户体验良好
*   在适当位置添加Tooltip，增加可读性