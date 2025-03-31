
**项目名称：** Cradle AI：An OpenRouter Chat Completion Proxy

**项目目标：**

构建一个 Node.js 后端服务:Cradle AI，作为前端 App 与 OpenRouter 之间的中间层，负责接收前端的 Chat Completion 请求，转发至 OpenRouter API，并将 OpenRouter 的响应返回给前端 App。

**详细功能需求：**

1.  **API 接收：**
    *   提供一个 HTTP POST 接口 (例如：`/api/chat/completion`)，用于接收前端 App 发送的 Chat Completion 请求。
    *   接口需要能够解析 JSON 格式的请求体。

2.  **OpenRouter API 调用：**
    *   接收到前端请求后，将请求数据转换为 OpenRouter Chat Completion API 所需的格式。
    *   调用 OpenRouter Chat Completion API ( `https://openrouter.ai/api/v1/chat/completions` )。
    *   **安全地**从环境变量中获取 OpenRouter API Key ( `OPENROUTER_API_KEY` )，并在请求 Header 中设置 `Authorization: Bearer <OPENROUTER_API_KEY>`。
    *   添加可选的 OpenRouter 请求头：`HTTP-Referer` 和 `X-Title`。  这些值也应通过环境变量配置（`HTTP_REFERER` 和 `X_TITLE`）。
    *   处理 API 调用过程中可能出现的错误，如网络错误、API 鉴权失败等。

3.  **响应处理与返回：**
    *   接收 OpenRouter API 的响应。
    *   将 OpenRouter 的响应数据转换为前端 App 能够理解的格式 (例如，直接透传 JSON)。
    *   通过 HTTP 接口将处理后的响应返回给前端 App。

4.  **环境变量配置：**
    *   使用环境变量安全地存储 OpenRouter API Key ( `OPENROUTER_API_KEY` )。
    *   支持通过环境变量配置 `HTTP_REFERER` 和 `X_TITLE`，用于设置 OpenRouter 的可选请求头。
    *   提供默认端口配置，并允许通过环境变量修改服务监听端口 (例如：`PORT`，默认 3000)。

5.  **日志记录：**
    *   记录请求日志，包括请求时间、请求来源、OpenRouter API 调用状态、响应状态等。
    *   使用合适的日志级别 (例如：info, error) 来区分不同类型的日志。

6.  **错误处理：**
    *   捕获并处理各种异常，包括请求参数错误、API 调用失败、环境变量未配置等。
    *   向前端 App 返回清晰的错误信息 (例如，HTTP 状态码和错误消息)。

7.  **安全性：**
    *   输入验证：对前端 App 传入的请求参数进行验证，防止恶意请求。
    *   防止 API Key 泄露：确保 OpenRouter API Key 不会被硬编码到代码中，而是通过环境变量安全存储和使用。
    *   CORS 配置：配置 CORS，只允许来自特定域名(前端 App 的域名)的请求。 (需要通过环境变量配置)

8. **可选增强功能**
    *   添加限流机制，防止API被滥用


**技术选型 (建议)：**

*   Node.js (LTS 版本)
*   Express.js (Web 框架)
*   axios 或 node-fetch (HTTP 客户端)
*   dotenv (环境变量管理)
*   winston 或 pino (日志库)

**部署环境 (考虑)：**

*   宝塔面板Node项目

**成功标准：**

*   前端 App和测试脚本 能够通过 Cradle AI 成功调用 OpenRouter Chat Completion API。
*   OpenRouter API Key 得到安全存储和使用。
*   服务稳定可靠，能够处理各种异常情况。
*   日志记录完善，便于问题排查。

