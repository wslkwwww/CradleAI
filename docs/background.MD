
# 背景知识：openrouter函数调用方法

```
**在你的提示中使用工具**

工具调用（也称为函数调用）允许LLM访问外部工具。 LLM 不直接调用工具。相反，它建议调用哪个工具。 然后，用户分别调用该工具，并将结果返回给 LLM。 最后，LLM将响应格式化为对用户原始问题的答案。

OpenRouter 标准化了跨模型和提供商的工具调用接口。
```

**工具调用示例**

```typescript
// TypeScript 代码示例
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer <OPENROUTER_API_KEY>`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      {
        role: 'user',
        content: 'What are the titles of some James Joyce books?',
      },
    ],
  }),
});
```
**定义工具**

接下来，我们定义想要调用的工具。 请记住，该工具将由 LLM 请求，但我们在此处编写的代码最终负责执行调用并将结果返回给 LLM。

```typescript
// TypeScript 代码示例
async function searchGutenbergBooks(searchTerms: string[]): Promise<Book[]> {
  const searchQuery = searchTerms.join(' ');
  const url = 'https://gutendex.com/books';
  const response = await fetch(`${url}?search=${searchQuery}`);
  const data = await response.json();
  return data.results.map((book: any) => ({
    id: book.id,
    title: book.title,
    authors: book.authors,
  }));
}
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_gutenberg_books',
      description:
        'Search for books in the Project Gutenberg library based on specified search terms',
      parameters: {
        type: 'object',
        properties: {
          search_terms: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              "List of search terms to find books in the Gutenberg library (e.g. ['dickens', 'great'] to search for books by Dickens with 'great' in the title)",
          },
        },
        required: ['search_terms'],
      },
    },
  },
];
const TOOL_MAPPING = {
  searchGutenbergBooks,
};
```

请注意，“工具”只是一个普通函数。 然后，我们编写一个与 OpenAI 函数调用参数兼容的 JSON“规范”。 我们会将该规范传递给 LLM，以便它知道该工具可用以及如何使用它。 它会在需要时请求该工具，以及任何参数。 然后，我们将在本地编排工具调用，进行函数调用，并将结果返回给 LLM。

**工具使用和工具结果**

让我们对模型进行第一次 OpenRouter API 调用：


```typescript
// TypeScript 代码示例
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer <OPENROUTER_API_KEY>`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    tools,
    messages,
  }),
});
```

LLM 响应的完成原因是 tool_calls，并且返回一个 tool_calls 数组。 在通用的 LLM 响应处理程序中，您需要在处理工具调用之前检查完成原因，但在这里我们假设就是这种情况。 让我们继续，处理工具调用：

```typescript
// TypeScript 代码示例
// Append the response to the messages array so the LLM has the full context
// It's easy to forget this step!
messages.push(response);
// Now we process the requested tool calls, and use our book lookup tool
for (const toolCall of response.toolCalls) {
  const toolName = toolCall.function.name;
  const toolArgs = JSON.parse(toolCall.function.arguments);
  const toolResponse = await TOOL_MAPPING[toolName](toolArgs);
  messages.push({
    role: 'tool',
    toolCallId: toolCall.id,
    name: toolName,
    content: JSON.stringify(toolResponse),
  });
}
```

现在，messages 数组包含：

*   我们最初的请求
*   LLM 的响应（包含工具调用请求）
*   工具调用的结果（从古腾堡计划 API 返回的 JSON 对象）

现在，我们可以进行第二次 OpenRouter API 调用，并希望获得我们的结果！

```typescript
// TypeScript 代码示例
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer <OPENROUTER_API_KEY>`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    messages,
    tools,
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);
```

输出将类似于：

```
Here are some books by James Joyce:
*   *Ulysses*
*   *Dubliners*
*   *A Portrait of the Artist as a Young Man*
*   *Chamber Music*
*   *Exiles: A Play in Three Acts*
```

我们成功了！ 我们已成功地在提示中使用了一个工具。

**一个简单的 Agentic Loop**

在上面的示例中，调用是显式且顺序进行的。 为了处理各种各样的用户输入和工具调用，您可以使用 agentic loop。

以下是一个简单的 agentic loop 的示例（使用与上面相同的工具和初始消息）：

```typescript
// TypeScript 代码示例
async function callLLM(messages: Message[]): Promise<Message> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer <OPENROUTER_API_KEY>`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        tools,
        messages,
      }),
    },
  );
  const data = await response.json();
  messages.push(data.choices[0].message);
  return data;
```


# 背景知识：gemini工具 & 函数调用方法


借助函数调用，用户可以与实时信息和服务（例如数据库、客户关系管理系统和文档库）进行交互。该功能还可以增强模型提供相关且符合上下文的回答的能力。函数调用最适合与外部系统交互。如果您的用例需要模型执行计算，但不涉及外部系统或 API，您应考虑改用代码执行。

## 函数声明

在提示中实现函数调用时，您需要创建一个 `tools` 对象，其中包含一个或多个 `function declarations`。您可以使用 JSON 定义函数，具体而言，使用 OpenAPI 架构格式的部分子集。单个函数声明可以包含以下参数：

*   **name**（字符串）：API 调用中函数的唯一标识符。
*   **description**（字符串）：全面说明函数的用途和功能。
*   **parameters**（对象）：定义函数所需的输入数据。
    *   **type**（字符串）：指定整体数据类型，例如 `object`。
    *   **properties**（对象）：列出各个参数，每个参数均包含：
        *   **type**（字符串）：参数的数据类型，例如 `string`、`integer`、`boolean`。
        *   **description**（字符串）：清楚地说明参数的用途和预期格式。
    *   **required**（数组）：一个字符串数组，用于列出函数运行所必需的参数名称。

如需查看使用 `c网址` 命令的函数声明的代码示例，请参阅[函数调用示例](#函数调用示例)。如需查看使用 Gemini API SDK 创建函数声明的示例，请参阅[函数调用教程](https://developers.google.com/gemini/tutorials/function-calling)。

## 函数声明的最佳实践

在将函数集成到请求中时，准确定义函数至关重要。每个函数都依赖于特定参数，这些参数可指导其行为并与模型互动。以下列表提供了有关在 `functions_declarations` 数组中定义各个函数参数的指南。

*   **name**: 使用清晰、描述性强的名称，不含空格、英文句点 `(.)` 或短划线 `(-)` 字符。请改用下划线 `(_)` 字符或驼峰式命名法。

*   **description**: 提供详细、清晰且具体的函数说明，并根据需要提供示例。例如，使用 `find theaters based on location and optionally movie title that is currently playing in theaters.` 取代 `find theaters`。避免使用过于宽泛或模糊的说明。

*   **properties > type**: 使用强类型参数来减少模型幻觉。例如，如果参数值来自有限集，请使用 `enum` 字段，而不是在说明中列出值（例如，`"type": "enum", "values": ["now_playing", "upcoming"]`）。如果参数值始终是整数，请将类型设置为 `integer`，而不是 `number`。

*   **properties > description**: 提供具体的示例和限制。 例如，使用 `The city and state, e.g. San Francisco, CA or a zip code e.g. 95616` 取代 `the location to search`。

如需了解使用函数调用的更多最佳实践，请参阅[最佳实践部分](#最佳做法)。

## 函数调用模式

您可以使用调用 `mode` 参数的函数来修改地图项的执行行为。有三种模式可供选择：

*   **AUTO**: 默认的模型行为。模型决定预测函数调用或自然语言回答。
*   **ANY**: 模型会受到限制，始终预测函数调用。如果未提供 `allowed_function_names`，模型会从所有可用的函数声明中进行选择。如果提供了 `allowed_function_names`，模型会从一组允许的函数中进行选择。
*   **NONE**: 模型不会预测函数调用。在这种情况下，模型行为与您不传递任何函数声明时一样。

您还可以传递一组 `allowed_function_names`，如果提供，则会限制模型将调用的函数。仅当模式为 `ANY` 时，您才应添加 `allowed_function_names`。函数名称应与函数声明名称一致。将模式设置为 `ANY` 并设置 `allowed_function_names` 后，模型将从提供的一组函数名称中预测函数调用。

**要点**: 如果您将模式设置为 `ANY` 并提供 `allowed_function_names`，模型会从一组允许的函数中进行选择。如果您将模式设置为 `ANY` 且不提供 `allowed_function_names`，模型会从所有可用的函数中进行选择。

示例请求中的以下代码段展示了如何将 `mode` 设置为 `ANY` 并指定允许的函数列表：

```json
"tool_config": {
  "function_calling_config": {
    "mode": "ANY",
    "allowed_function_names": ["find_theaters", "get_showtimes"]
  },
}
```

## 组合函数调用

Gemini 2.0 支持一项新的函数调用功能：组合函数调用。通过组合函数调用，Gemini API 可以在生成回答的过程中自动调用多个用户定义的函数。例如，为了响应提示 `"Get the temperature in my current location"`，Gemini API 可能会同时调用 `get_current_location()` 函数和 `get_weather()` 函数，并将位置作为参数。

带有代码执行的组合函数调用需要使用双向流式传输，并且仅由新版 Live API 支持。以下示例展示了如何将组合函数调用、代码执行和实时 API 搭配使用：

**注意**: 为简洁起见，省略了用于处理异步 WebSocket 设置的 `run()` 函数声明。

```python
turn_on_the_lights_schema = {'name': 'turn_on_the_lights'}
turn_off_the_lights_schema = {'name': 'turn_off_the_lights'}

prompt = """
  Hey, can you write run some python code to turn on the lights, wait 10s and then turn off the lights?
  """

tools = [
    {'code_execution': {}},
    {'function_declarations': [turn_on_the_lights_schema, turn_off_the_lights_schema]}
]

await run(prompt, tools=tools, modality="AUDIO")
```

## 函数调用示例

本部分提供了使用 `c网址` 命令进行函数调用的示例提示。这些示例包括单轮和多轮场景，以及启用不同的函数调用模式。

将 `c网址` 命令与此功能搭配使用时，函数和参数信息会包含在 `tools` 元素中。`tools` 元素中的每个函数声明都包含函数名称，您可以使用与 OpenAPI 兼容的架构指定参数，并提供函数说明。

### 单轮示例

单轮是指调用一次语言模型。对于函数调用，单轮用例可能是当您向模型提供自然语言查询和函数列表时的用例。在这种情况下，模型使用函数声明（包括函数名称、参数和说明）来预测要调用的函数以及调用该函数所使用的参数。

以下 curl 示例展示了如何传入用于返回电影播放地点信息的函数的说明。请求中包含多个函数声明，例如 `find_movies` 和 `find_theaters`。


```
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$API_KEY \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": {
      "role": "user",
      "parts": {
        "text": "Which theaters in Mountain View show Barbie movie?"
    }
  },
  "tools": [
    {
      "function_declarations": [
        {
          "name": "find_movies",
          "description": "find movie titles currently playing in theaters based on any description, genre, title words, etc.",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "description": {
                "type": "string",
                "description": "Any kind of description including category or genre, title words, attributes, etc."
              }
            },
            "required": [
              "description"
            ]
          }
        },
        {
          "name": "find_theaters",
          "description": "find theaters based on location and optionally movie title which is currently playing in theaters",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "movie": {
                "type": "string",
                "description": "Any movie title"
              }
            },
            "required": [
              "location"
            ]
          }
        },
        {
          "name": "get_showtimes",
          "description": "Find the start times for movies playing in a specific theater",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "movie": {
                "type": "string",
                "description": "Any movie title"
              },
              "theater": {
                "type": "string",
                "description": "Name of the theater"
              },
              "date": {
                "type": "string",
                "description": "Date for requested showtime"
              }
            },
            "required": [
              "location",
              "movie",
              "theater",
              "date"
            ]
          }
        }
      ]
    }
  ]
}'
    
```

此 curl 示例的响应可能与以下内容类似。
```
[{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "find_theaters",
              "args": {
                "movie": "Barbie",
                "location": "Mountain View, CA"
              }
            }
          }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HATE_SPEECH",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 9,
    "totalTokenCount": 9
  }
}]

```

### 使用 ANY 模式的单轮示例

以下 curl 示例与单curl示例类似，但它将模式设置为 ANY：

```json
"tool_config": {
  "function_calling_config": {
    "mode": "ANY"
  },
}
```

curl https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$API_KEY \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": {
      "role": "user",
      "parts": {
        "text": "What movies are showing in North Seattle tonight?"
    }
  },
  "tools": [
    {
      "function_declarations": [
        {
          "name": "find_movies",
          "description": "find movie titles currently playing in theaters based on any description, genre, title words, etc.",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "description": {
                "type": "string",
                "description": "Any kind of description including category or genre, title words, attributes, etc."
              }
            },
            "required": [
              "description"
            ]
          }
        },
        {
          "name": "find_theaters",
          "description": "find theaters based on location and optionally movie title which is currently playing in theaters",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "movie": {
                "type": "string",
                "description": "Any movie title"
              }
            },
            "required": [
              "location"
            ]
          }
        },
        {
          "name": "get_showtimes",
          "description": "Find the start times for movies playing in a specific theater",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "movie": {
                "type": "string",
                "description": "Any movie title"
              },
              "theater": {
                "type": "string",
                "description": "Name of the theater"
              },
              "date": {
                "type": "string",
                "description": "Date for requested showtime"
              }
            },
            "required": [
              "location",
              "movie",
              "theater",
              "date"
            ]
          }
        }
      ]
    }
  ],
  "tool_config": {
    "function_calling_config": {
      "mode": "ANY"
    },
  }
}'
```

响应可能类似以下内容：
```
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "find_movies",
              "args": {
                "description": "",
                "location": "North Seattle, WA"
              }
            }
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HATE_SPEECH",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "promptFeedback": {
    "safetyRatings": [
      {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HARASSMENT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "probability": "NEGLIGIBLE"
      }
    ]
  }
}

### 使用“ANY”模式和允许的函数的单轮示例

以下 curl 示例与单转弯示例类似，但它会将模式设置为 ANY，并包含允许的函数列表：

```json
"tool_config": {
  "function_calling_config": {
    "mode": "ANY",
    "allowed_function_names": ["find_theaters", "get_showtimes"]
  },
}
```

[使用 ANY 模式和允许的函数进行单轮函数调用（请求）]
```
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$API_KEY \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": {
      "role": "user",
      "parts": {
        "text": "What movies are showing in North Seattle tonight?"
    }
  },
  "tools": [
    {
      "function_declarations": [
        {
          "name": "find_movies",
          "description": "find movie titles currently playing in theaters based on any description, genre, title words, etc.",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "description": {
                "type": "string",
                "description": "Any kind of description including category or genre, title words, attributes, etc."
              }
            },
            "required": [
              "description"
            ]
          }
        },
        {
          "name": "find_theaters",
          "description": "find theaters based on location and optionally movie title which is currently playing in theaters",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "movie": {
                "type": "string",
                "description": "Any movie title"
              }
            },
            "required": [
              "location"
            ]
          }
        },
        {
          "name": "get_showtimes",
          "description": "Find the start times for movies playing in a specific theater",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
              },
              "movie": {
                "type": "string",
                "description": "Any movie title"
              },
              "theater": {
                "type": "string",
                "description": "Name of the theater"
              },
              "date": {
                "type": "string",
                "description": "Date for requested showtime"
              }
            },
            "required": [
              "location",
              "movie",
              "theater",
              "date"
            ]
          }
        }
      ]
    }
  ],
  "tool_config": {
    "function_calling_config": {
      "mode": "ANY",
      "allowed_function_names": ["find_theaters", "get_showtimes"]
    },
  }
}'
```
由于 `find_movies` 函数不在允许的函数列表中，因此模型无法预测该函数，而是预测了其他函数。响应可能类似以下内容：
```
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "find_theaters",
              "args": {
                "location": "North Seattle, WA",
                "movie": null
              }
            }
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HATE_SPEECH",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "promptFeedback": {
    "safetyRatings": [
      {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HARASSMENT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "probability": "NEGLIGIBLE"
      }
    ]
  }
}

```
### 多轮对话示例

您可以通过执行以下操作来实现多轮函数调用场景：

1.  通过调用语言模型获取函数调用响应。这是第一轮。
2.  使用第一轮的函数调用响应和调用该函数获得的函数响应调用语言模型。这是第二轮。

第二轮的响应会总结第一轮中回答您查询的结果，或包含可用于获取查询更多信息的第二轮函数调用。

本主题包含两个多轮 curl 示例：

*   [使用上一轮的函数响应的 curl 示例](#使用上一轮的函数响应的 curl 示例)
*   [多次调用语言模型的 curl 示例](#多次调用语言模型的 curl 示例)

#### 使用上一轮的响应

以下 curl 示例调用上一个单轮示例返回的函数和参数以获取响应。此 JSON 中包含单轮示例返回的方法和参数。

```json
"functionCall": {
  "name": "find_theaters",
  "args": {
    "movie": "Barbie",
    "location": "Mountain View, CA"
  }
}
```

[多轮函数调用 curl 示例请求](#多轮函数调用 curl 示例请求)
```
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$API_KEY \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{
        "text": "Which theaters in Mountain View show Barbie movie?"
    }]
  }, {
    "role": "model",
    "parts": [{
      "functionCall": {
        "name": "find_theaters",
        "args": {
          "location": "Mountain View, CA",
          "movie": "Barbie"
        }
      }
    }]
  }, {
    "role": "user",
    "parts": [{
      "functionResponse": {
        "name": "find_theaters",
        "response": {
          "name": "find_theaters",
          "content": {
            "movie": "Barbie",
            "theaters": [{
              "name": "AMC Mountain View 16",
              "address": "2000 W El Camino Real, Mountain View, CA 94040"
            }, {
              "name": "Regal Edwards 14",
              "address": "245 Castro St, Mountain View, CA 94040"
            }]
          }
        }
      }
    }]
  }],
  "tools": [{
    "functionDeclarations": [{
      "name": "find_movies",
      "description": "find movie titles currently playing in theaters based on any description, genre, title words, etc.",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "location": {
            "type": "STRING",
            "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
          },
          "description": {
            "type": "STRING",
            "description": "Any kind of description including category or genre, title words, attributes, etc."
          }
        },
        "required": ["description"]
      }
    }, {
      "name": "find_theaters",
      "description": "find theaters based on location and optionally movie title which is currently playing in theaters",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "location": {
            "type": "STRING",
            "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
          },
          "movie": {
            "type": "STRING",
            "description": "Any movie title"
          }
        },
        "required": ["location"]
      }
    }, {
      "name": "get_showtimes",
      "description": "Find the start times for movies playing in a specific theater",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "location": {
            "type": "STRING",
            "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
          },
          "movie": {
            "type": "STRING",
            "description": "Any movie title"
          },
          "theater": {
            "type": "STRING",
            "description": "Name of the theater"
          },
          "date": {
            "type": "STRING",
            "description": "Date for requested showtime"
          }
        },
        "required": ["location", "movie", "theater", "date"]
      }
    }]
  }]
}'
    
```
此 curl 示例的响应包含调用 `find_theaters` 方法的结果。响应可能类似以下内容：
```
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": " OK. Barbie is showing in two theaters in Mountain View, CA: AMC Mountain View 16 and Regal Edwards 14."
          }
        ]
      }
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 9,
    "candidatesTokenCount": 27,
    "totalTokenCount": 36
  }
}

```
#### 多次调用模型

以下 `c网址` 示例多次调用生成式 AI 模型来调用函数。每次模型调用该函数时，都可以使用不同的函数来回答请求中的不同用户查询。

[多轮函数调用 curl 示例请求](#多轮函数调用 curl 示例请求)
```
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$API_KEY \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{
        "text": "Which theaters in Mountain View show Barbie movie?"
    }]
  }, {
    "role": "model",
    "parts": [{
      "functionCall": {
        "name": "find_theaters",
        "args": {
          "location": "Mountain View, CA",
          "movie": "Barbie"
        }
      }
    }]
  }, {
    "role": "user",
    "parts": [{
      "functionResponse": {
        "name": "find_theaters",
        "response": {
          "name": "find_theaters",
          "content": {
            "movie": "Barbie",
            "theaters": [{
              "name": "AMC Mountain View 16",
              "address": "2000 W El Camino Real, Mountain View, CA 94040"
            }, {
              "name": "Regal Edwards 14",
              "address": "245 Castro St, Mountain View, CA 94040"
            }]
          }
        }
      }
    }]
  },
  {
    "role": "model",
    "parts": [{
      "text": " OK. Barbie is showing in two theaters in Mountain View, CA: AMC Mountain View 16 and Regal Edwards 14."
    }]
  },{
    "role": "user",
    "parts": [{
      "text": "Can we recommend some comedy movies on show in Mountain View?"
    }]
  }],
  "tools": [{
    "functionDeclarations": [{
      "name": "find_movies",
      "description": "find movie titles currently playing in theaters based on any description, genre, title words, etc.",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "location": {
            "type": "STRING",
            "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
          },
          "description": {
            "type": "STRING",
            "description": "Any kind of description including category or genre, title words, attributes, etc."
          }
        },
        "required": ["description"]
      }
    }, {
      "name": "find_theaters",
      "description": "find theaters based on location and optionally movie title which is currently playing in theaters",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "location": {
            "type": "STRING",
            "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
          },
          "movie": {
            "type": "STRING",
            "description": "Any movie title"
          }
        },
        "required": ["location"]
      }
    }, {
      "name": "get_showtimes",
      "description": "Find the start times for movies playing in a specific theater",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "location": {
            "type": "STRING",
            "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
          },
          "movie": {
            "type": "STRING",
            "description": "Any movie title"
          },
          "theater": {
            "type": "STRING",
            "description": "Name of the theater"
          },
          "date": {
            "type": "STRING",
            "description": "Date for requested showtime"
          }
        },
        "required": ["location", "movie", "theater", "date"]
      }
    }]
  }]
}'
```
[多轮函数调用 curl 示例响应](#多轮函数调用 curl 示例响应)
```
[{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "find_movies",
              "args": {
                "description": "comedy",
                "location": "Mountain View, CA"
              }
            }
          }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HATE_SPEECH",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 48,
    "totalTokenCount": 48
  }
}
]
```
## 最佳做法

请遵循以下最佳实践，提高函数调用的准确性和可靠性。

### 用户提示

为获得最佳结果，请在用户查询前面加上以下详细信息：

*   模型的其他上下文。例如 `You are a movie API assistant to help users find movies and showtimes based on their preferences.`。
*   有关如何及何时使用函数的详细信息或说明。例如：`Don't make assumptions on showtimes. Always use a future date for showtimes.`
*   在用户查询不明确时询问澄清性问题的说明。例如：`Ask clarifying questions if not enough information is available to complete the request.`

### 采样参数

对于温度参数，请使用 0 或其他较低值。这会指示模型生成置信度更高的结果并减少幻觉。

### API 调用

如果模型建议调用一个会发送订单、更新数据库或以其他方式产生重大后果的函数，请在执行之前先向用户验证该函数调用。