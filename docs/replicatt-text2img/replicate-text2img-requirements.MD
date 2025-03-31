好的，这是一个可以用于指导构建 Replicate API Serverless 后端的开发需求提示词，目标是使用 Node.js，部署在宝塔面板上，并将生成的图片存储在 MinIO 中。

**开发需求提示词：**

**项目目标：**

构建一个 Node.js Serverless 后端，用于处理前端应用发送的图像生成请求，利用 Replicate API 生成图片，并将生成的图片存储在 MinIO 对象存储服务中，最后将存储图片的 URL 返回给前端。

**技术栈:**

*   **后端语言:** Node.js
*   **框架 (可选):** Express.js (轻量级框架), Koa.js (更现代的框架), Serverless Functions (例如 Vercel, Netlify Functions, AWS Lambda)
*   **HTTP 客户端:** `node-fetch` or `axios` (用于向 Replicate API 发送请求)
*   **MinIO 客户端:** `@minio/minio-js`
*   **部署环境:** 宝塔面板 (需要配置 Node.js 环境和反向代理)
*   **Serverless 环境 (可选):** Vercel, Netlify, AWS Lambda (如果选择 Serverless Functions)
*   **环境变量管理:**  `.env` 文件 (用于存储 API 密钥、MinIO 凭据等)

**详细需求：**

1.  **API 端点:**
    *   创建一个 POST 端点 `/generate`， 接收前端传递的JSON格式请求体，包含以下参数：
        *   `prompt` (string, 必选): 生成图像的提示词。
        *   `negative_prompt` (string, 可选): 负面提示词，用于避免生成不需要的内容。
        *   `steps` (integer, 可选): 生成步骤数，默认值为 28。
        *   `width` (integer, 可选): 图像宽度，默认值为 1024。
        *   `height` (integer, 可选): 图像高度，默认值为 1024。
        *   `batch_size` (integer, 可选): 批量生成数量，默认值为 1，最大值为 4。

2.  **参数校验:**
    *   对收到的参数进行校验，确保参数类型正确，数值在合理范围内。

3.  **Replicate API 请求:**
    *   使用 `REPLICATE_API_TOKEN` 环境变量中的 API 密钥对 Replicate API 进行身份验证。
    *   构造符合 Replicate API 格式的请求体，包含模型ID (aisha-ai-official/animagine-xl-4.0:057e2276ac5dcd8d1575dc37b131f903df9c10c41aed53d47cd7d4f068c19fa5)和从前端接收到的参数。
    *   调用 Replicate API 的 `/predictions` 端点发起异步生成任务。
    *   获得 Replicate API 返回的 prediction ID。

4.  **图片获取与存储:**
    *   轮询 Replicate API，使用 prediction ID 查询生成任务的状态，直到任务完成 (状态为 "succeeded")。
    *   从 Replicate API 的响应中获取生成的图片 URL。
    *   使用 MinIO 客户端连接到 MinIO 服务器。
    *   将 Replicate 返回的图片下载到服务器本地。
    *   将本地图片上传到 MinIO 存储桶中，对象名称使用UUID随机生成。
    *   从MinIO获取上传后图片的公共可访问URL。

5.  **响应格式:**
    *   将 MinIO 中存储的图片的 URL 列表以 JSON 格式返回给前端。例如:
        ```json
        {
          "urls": [
            "http://minio.example.com/your-bucket/image1.png",
            "http://minio.example.com/your-bucket/image2.png"
          ]
        }
        ```
    *  可以参考`miniosdk.py`
    
6.  **错误处理:**
    *   如果 Replicate API 请求失败，返回包含错误信息的 JSON 响应。
    *   如果 MinIO 上传失败，返回包含错误信息的 JSON 响应。
    *   对所有可能的异常情况进行处理，并返回相应的错误信息。

7.  **安全性:**
    *   将 `REPLICATE_API_TOKEN` 和 MinIO 的凭据存储在环境变量中，避免硬编码在代码中。
    *   使用 HTTPS 协议进行通信，确保数据传输的安全性。

8.  **部署:**
    *   将后端部署到宝塔面板上。
    *   配置 Node.js 环境和反向代理，将请求转发到 Node.js 服务。
    *   (如果选择 Serverless Functions) 配置相应的 Serverless 环境，并将代码部署到云平台上。

9.  **日志记录:**
    *   添加适当的日志记录，方便调试和问题排查。

**其他考虑:**

*   **异步处理:**  使用 `async/await` 或者 Promise 来处理异步操作，避免阻塞主线程。
*   **流式处理:** 在下载和上传图片时，使用流式处理，减少内存占用。
*   **可扩展性:**  设计代码时考虑可扩展性，方便以后添加新的功能。

**验收标准：**

*   前端应用能够成功调用 `/generate` 端点，并收到包含图片 URL 的 JSON 响应。
*   生成的图片能够成功上传到 MinIO 存储桶中。
*   API 的性能满足要求，响应时间在可接受范围内。
*   代码质量高，易于维护和扩展。
*   部署顺利，服务稳定可靠。
*   具备完善的错误处理和日志记录。
*   遵循安全最佳实践。
