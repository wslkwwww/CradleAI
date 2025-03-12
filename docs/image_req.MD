

```
//openrouter接收图片示例
const request: Request = {
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '请描述这张图片的内容。'
        },
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: 'high' // Optional: 'auto', 'low', 'high'
          }
        }
      ] as ContentPart[], // 类型断言 ContentPart[]
    } as Message, // 类型断言 Message
  ],
  model: 'openai/gpt-4-vision-preview', // 确保选择支持图像的模型
  max_tokens: 500,
  temperature: 0.7,
};

```
///Gemini接收图片示例

Base64 编码的图片
您可以将公开图片网址编码为 Base64 载荷，以便上传。以下代码示例展示了如何仅使用标准库工具执行此操作：

from google import genai
from google.genai import types

import requests

image_path = "https://goo.gle/instrument-img"
image = requests.get(image_path)

client = genai.Client(api_key="GEMINI_API_KEY")
response = client.models.generate_content(
    model="gemini-2.0-flash-exp",
    contents=["What is this image?",
              types.Part.from_bytes(data=image.content, mime_type="image/jpeg")])

print(response.text)

```