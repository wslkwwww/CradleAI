# 工具提示词管理（UtilPromptManagement）指南


## 1. 功能目标

- 支持用户自定义输入指令（如自动消息生成指令）。
- 支持导入角色预设（preset）和世界书（worldbook）JSON文件。
- 允许用户预览和编辑导入内容。
- 通过`buildRFrameworkWithChatHistory`方法，将输入、预设、世界书等信息编排为消息数组。
- 消息数组通过`unified-api`发送到指定适配器（如Gemini/OpenRouter/OpenAI Compatible），获得AI回复。
- 支持保存和持久化配置，便于下次直接复用。

---

## 2. 操作流程

### 2.1 用户界面与交互

1. **输入指令**：用户填写自动消息或工具指令（如“请主动发起一条合适的消息”）。
2. **导入预设**：通过文件选择器导入preset.json，内容会被解析并可预览。
3. **导入世界书**：通过文件选择器导入worldbook.json，内容会被解析并可预览。
4. **选择适配器类型**：自动读取当前API设置（如Gemini/OpenRouter），也可手动切换。
5. **生成消息数组**：调用`buildRFrameworkWithChatHistory`，将上述内容编排为标准消息数组，供AI调用。
6. **预览与保存**：用户可预览生成的消息数组，并将其保存到本地持久化存储。

### 2.2 消息数组的生成与使用

- `buildRFrameworkWithChatHistory(inputText, presetJson, adapterType, worldBookJson?)`  
  该方法将用户输入、预设、世界书等内容，按适配器格式编排为消息数组。

- 消息数组结构兼容OpenAI/Gemini/OpenRouter等主流API。

### 2.3 统一API调用

- 通过`unifiedGenerateContent(messages, options)`方法，将消息数组和适配器参数发送到统一API服务。
- `options`参数需包含适配器类型、API Key、模型ID等信息（可通过`getApiSettings()`获取）。
- 统一API会自动适配消息格式并调用对应的AI服务，返回响应文本。

---

## 3. 持久化与复用

- 所有配置（输入指令、预设、世界书、适配器类型、消息数组）均可保存到本地（如AsyncStorage）。
- 下次进入工具页面时自动加载，便于复用和快速测试。

---

## 4. 扩展到其他工具的建议

如需为其他工具（如批量对话生成、角色测试等）添加预设和世界书支持，建议遵循以下步骤：

1. **界面层**：提供输入、导入、预览、适配器选择、生成与保存等交互。
2. **消息编排**：调用`buildRFrameworkWithChatHistory`生成标准消息数组。
3. **API调用**：通过`unifiedGenerateContent`和`getApiSettings`，将消息数组发送到目标AI服务。
4. **结果处理**：展示AI回复，支持保存和复用。

---

## 5. 参考实现

请参考`UtilSettings.tsx`和`automessage-service.ts`的实现，了解完整的集成流程。

---

## 6. 关键API说明

- `buildRFrameworkWithChatHistory(inputText, presetJson, adapterType, worldBookJson?)`  
  编排消息数组，适配不同AI服务格式。

- `unifiedGenerateContent(messages, options)`  
  统一API调用，自动适配Gemini/OpenAI/OpenRouter等。

- `getApiSettings()`  
  获取当前全局API设置（适配器类型、API Key、模型等）。
