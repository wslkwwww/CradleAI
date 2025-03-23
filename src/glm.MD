# Embedding

**模型编码：** `embedding-2`、`embedding-3`

文本向量模型，将输入的文本信息进行向量化表示，以便于结合向量数据库为大模型提供外部知识库。

`embedding-3`: 支持自定义向量维度，建议选择256、512、1024或2048维度。

## 同步调用

### 接口请求

*   **类型：** 说明
*   **传输方式：** HTTPS
*   **请求地址：** `https://open.bigmodel.cn/api/paas/v4/embeddings`
*   **调用方式：** 同步调用，等待模型执行完成并返回最终结果
*   **字符编码：** UTF-8
*   **接口请求格式：** JSON
*   **响应格式：** JSON
*   **接口请求类型：** POST
*   **开发语言：** 任意可发起 HTTP 请求的开发语言

### 请求参数

| 参数名称     | 类型              | 是否必填 | 说明                                                                                           |
|-------------|------------------|----------|------------------------------------------------------------------------------------------------|
| `model`     | `String`         | 是       | 模型编码                                                                                         |
| `input`     | `String`/`List`  | 是       | 输入需要向量化的文本，支持字符串数组。                                                             |
|             |                  |          | - `embedding-2`: 单条请求最多支持512个Tokens，数组总长度不超过8K                                   |
|             |                  |          | - `embedding-3`: 单条请求最多支持3072个Tokens，数组最大不超过64条                                 |
| `dimensions`| `Integer`        | 否       | 向量维度默认为2048，`embedding-3`模型支持自定义向量维度，建议选择256、512、1024或2048维度          |

### 响应参数

| 参数名称         | 类型          | 说明                             |
| ---------------- | ------------- | -------------------------------- |
| `model`          | `String`      | 模型编码                         |
| `object`         | `Long`        | 结果类型，目前为 `list`            |
| `data`           | `List<Object>`| 模型生成的数组结果                 |
| `data.index`     | `Integer`     | 结果下标                         |
| `data.object`    | `String`      | 结果类型，目前为 `embedding`      |
| `data.embedding` | `ListObject`  | embedding的处理结果，返回向量化表征的数组 |
| `usage`          | `Object`      | 本次模型调用的 tokens 数量统计       |
| `usage.prompt_tokens`     | `Integer`     | 用户输入的 tokens 数量            |
| `usage.completion_tokens` | `Integer`     | 模型输出的 tokens 数量            |
| `usage.total_tokens`      | `Integer`     | 总 tokens 数量                 |

### 调用示例

#### 请求示例

```python
from zhipuai import ZhipuAI

client = ZhipuAI(api_key="your api key")
response = client.embeddings.create(
    model="embedding-3", #填写需要调用的模型编码
     input=[
        "美食非常美味，服务员也很友好。",
        "这部电影既刺激又令人兴奋。",
        "阅读书籍是扩展知识的好方法。"
    ],
)
print(response)
```

#### 响应示例

```json
{
    "model": "embedding-3",
    "data": [
        {
            "embedding": [
                -0.02675454691052437,
                0.019060475751757622,
                ......
                -0.005519774276763201,
                0.014949671924114227
            ],
            "index": 0,
            "object": "embedding"
        },
        ...
        {
            "embedding": [
                -0.02675454691052437,
                0.019060475751757622,
                ......
                -0.005519774276763201,
                0.014949671924114227
            ],
            "index": 2,
            "object": "embedding"
        }
    ],
    "object": "list",
    "usage": {
        "completion_tokens": 0,
        "prompt_tokens": 100,
        "total_tokens": 100
    }
}
```