
# Brave Search工具接入需求 #

**1. 项目名称:** MCP Brave Search 集成

**2. 目标:**

当前我们的app通过`openrouter-adapter`，`gemini-adapter`实现对LLM的请求，但尚未实现工具调用的功能。我们需要让LLM能够可靠地接入 Smithery 提供的 Model Context Protocol (MCP) 服务器，并通过 Brave Search API 执行搜索查询，最终将搜索结果应用于回复中。

Brave Search API 提供了强大的搜索功能，可以通过 Smithery 的 MCP 服务器进行安全访问。本需求旨在将 Brave Search 集成到当前的适配器中，从而提高生成质量和知识覆盖范围。

**3. 需求详情:**

*   **MCP 服务器连接:**
    *   使用 `@smithery/sdk` 和 `@modelcontextprotocol/sdk` 连接到 Smithery 提供的 MCP 服务器。
    *   连接过程需要使用 Brave Search API Key (`braveApiKey`) 进行身份验证。
    *   智能体需要能够处理连接错误，并进行重试或报告错误。
*   **工具发现:**
    *   通过 MCP 客户端列出可用的工具，并识别 Brave Search 工具。
    *   动态获取 Brave Search 工具的名称。
*   **Brave Search 调用:**
    *   智能体能够使用 MCP 客户端调用 Brave Search 工具，传递必要的搜索参数。
    *   **`brave-search-api.MD` 是定义 Brave Search 工具参数的权威来源。必须严格遵循该文档定义的参数类型、必需性、描述信息等。** 
    *   处理 API 调用错误，并进行重试或报告错误。
*   **结果处理:**
    *   解析 Brave Search API 返回的 JSON 结果。
    *   提取关键信息（例如，搜索结果的标题、摘要、链接）并用于后续的任务。
*   **安全性:**
    *   当前为测试场景中，因此测试用apikey暂时通过文件单独储存和取用。
    *   对用户输入进行安全过滤，防止注入攻击。
*   **日志记录:**
    *   详细的中文日志，记录连接、工具发现、API 调用、错误等关键事件，方便调试和监控。

**4. 技术需求:**

*   **依赖库:**
    *   `@smithery/sdk`
    *   `@modelcontextprotocol/sdk`
*   **身份验证:** Brave Search API Key (通过文件传递)
*   **错误处理:** 需要实现完善的错误处理机制，包括连接错误、API 调用错误、数据解析错误等。
*   **异步处理:** 使用 `async/await` 或 Promise 处理异步操作，避免阻塞主线程。

**5. 详细设计:**

*   **连接 MCP 服务器:**

```typescript
    import { createTransport } from "@smithery/sdk/transport.js"
    import { Client } from "@modelcontextprotocol/sdk/client/index.js"

    // 从环境变量获取 Brave Search API Key
    const braveApiKey = process.env.BRAVE_API_KEY;

    if (!braveApiKey) {
        console.error("错误：BRAVE_API_KEY 环境变量未设置。");
        // 抛出异常或采取其他适当的错误处理措施
        throw new Error("BRAVE_API_KEY is missing");
    }

    const transport = createTransport("https://server.smithery.ai/@smithery-ai/brave-search", {
      "braveApiKey": braveApiKey
    });

    const client = new Client({
        name: "AI Programming Agent",
        version: "1.0.0"
    });

    try {
        await client.connect(transport);
        console.log("成功连接到 MCP 服务器。");
    } catch (error) {
        console.error("连接到 MCP 服务器失败:", error);
        // 进行错误处理，例如重试或退出
        throw error;
    }


*   **发现 Brave Search 工具:**


    try {
        const tools = await client.listTools();
        console.log(`可用的工具: ${tools.map(t => t.name).join(", ")}`);

        // 找到 Brave Search 工具 (假设工具名称为 "brave_search")
        const braveSearchTool = tools.find(tool => tool.name === "brave_search");

        if (!braveSearchTool) {
            console.error("Brave Search 工具未找到。");
            // 进行错误处理
            throw new Error("Brave Search tool not found");
        }

        const braveSearchToolName = braveSearchTool.name;
        console.log(`Brave Search 工具名称: ${braveSearchToolName}`);

    } catch (error) {
        console.error("列出工具失败:", error);
        // 进行错误处理
        throw error;
    }
    ```

*   **调用 Brave Search 工具:**

    // 根据 brave-search-api 文档构建参数对象
    const searchQuery = "Model Context Protocol 示例";
    const params = {
        query: searchQuery,
        count: 3 // 例如，请求 3 个结果
        // 其他参数根据 brave-search-api 文档添加
    };

    try {
        const result = await client.callTool(braveSearchToolName, params);
        console.log("Brave Search 结果:", result);
        // 处理搜索结果
    } catch (error) {
        console.error("调用 Brave Search 工具失败:", error);
        // 进行错误处理
        throw error;
    }