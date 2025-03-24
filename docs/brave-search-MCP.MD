```markdown
## Installation

Install the Smithery and MCP SDKs using npm:

```bash
npm install @smithery/sdk @modelcontextprotocol/sdk
```

## TypeScript SDK

Use Smithery's TypeScript SDK to connect to this MCP server:

```typescript
import { createTransport } from "@smithery/sdk/transport.js"

const transport = createTransport("https://server.smithery.ai/@smithery-ai/brave-search", {
  "braveApiKey": "string"
})

// Create MCP client
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

const client = new Client({
	name: "Test client",
	version: "1.0.0"
})
await client.connect(transport)

// Use the server tools with your LLM application
const tools = await client.listTools()
console.log(`Available tools: ${tools.map(t => t.name).join(", ")}`)

// Example: Call a tool
// const result = await client.callTool("tool_name", { param1: "value1" })
```

## Configuration Schema

Full JSON Schema for server configuration:

```json
{
  "type": "object",
  "required": [
    "braveApiKey"
  ],
  "properties": {
    "braveApiKey": {
      "type": "string",
      "description": "The API key for the BRAVE Search server."
    }
  }
}
```