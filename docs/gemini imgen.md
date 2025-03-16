# 使用 Gemini API 生成图片

Gemini API 支持使用 Gemini 2.0 Flash 实验版和使用 Imagen 3 生成图片。本指南可帮助您开始使用这两种模型。

## 选择模型

您应该使用哪种模型来生成图片？具体取决于您的使用场景。

*   **Gemini 2.0 Flash Experimental:** 如果背景信息很重要，那么 Gemini 2.0 就是您的理想之选。Gemini 2.0 最适合生成与上下文相关的图片、混合多模态输出（文本 + 图片）、纳入世界知识以及对图片进行推理。您可以使用它在长篇幅文本序列中嵌入准确且与上下文相关的视觉内容。您还可以使用自然语言以对话方式编辑图片，同时在整个对话过程中保持上下文。
*   **Imagen 3:** 如果图片质量是您的首要考虑因素，那么 Imagen 3 是更好的选择。Imagen 3 擅长于打造逼真的效果、艺术细节，以及印象派或动漫等特定艺术风格。Imagen 3 还非常适合执行专门的图片编辑任务，例如更新商品背景、放大图片以及为视觉内容注入品牌和风格。您可以使用 Imagen 3 制作徽标或其他品牌产品设计。

## 使用 Gemini 生成图片

**预览版**：使用 Gemini 2.0 Flash Experimental 生成图片的功能已推出实验性预览版。

Gemini 2.0 Flash 实验版支持输出带内嵌图片的文本。这样，您就可以使用 Gemini 以对话方式编辑图片，或生成包含交织文本的输出内容（例如，在一次对话中生成包含文本和图片的博文）。所有生成的图片都包含 SynthID 水印，AI 工作室中的图片也包含可见水印。

根据提示和上下文，Gemini 将以不同的模式（文本转图片、文本转图片和文本等）生成内容。下面是一些示例：

*   **文本转图片**
    *   示例提示：“生成一张背景为烟花的埃菲尔铁塔图片。”
*   **文本转图片和文本（交织）**
    *   示例提示：“生成带插图的西班牙海鲜饭食谱。”
*   **图片和文本转图片和文本（交织）**
    *   问题示例：（显示家具摆设的房间图片）“我的空间适合哪些其他颜色的沙发？您能更新一下图片吗？”
*   **图片编辑（文字和图片转图片）**
    *   示例提示：“将此图片编辑成卡通图片”
    *   示例提示：[猫的图片] + [枕头的图片] +“在这个枕头上用十字绣制作我猫的图案。”
*   **多轮图片编辑（聊天）**
    *   示例提示：[上传一张蓝色汽车的图片。]“将这辆车改装成敞篷车。”“现在将颜色更改为黄色。”

### Gemini 示例

以下示例展示了如何使用 Gemini 2.0 生成文本和图片输出：

```python
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO

client = genai.Client()

contents = ('Hi, can you create a 3d rendered image of a pig '
            'with wings and a top hat flying over a happy ' 
            'futuristic scifi city with lots of greenery?')

response = client.models.generate_content(
    model="models/gemini-2.0-flash-exp",
    contents=contents,
    config=types.GenerateContentConfig(response_modalities=['Text', 'Image'])
)

for part in response.candidates[0].content.parts:
  if part.text is not None:
    print(part.text)
  elif part.inline_data is not None:
    image = Image.open(BytesIO(part.inline_data.data))
    image.show()
```

# 使用 Gemini 模型处理图片和视频

Gemini 模型能够处理图片和视频，从而支持许多先进的开发者应用场景，而这些场景在过去需要使用特定领域的模型。Gemini 的部分视觉功能包括：

*   为图片添加文字说明并回答有关图片的问题
*   转写和推理 PDF 文件（最多包含 200 万个令牌）
*   对时长最长 90 分钟的视频进行描述、细分和信息提取
*   检测图片中的对象并返回其边界框坐标

Gemini 从一开始就是作为多模态模型来构建的，我们会不断突破可能的边界。

## 图片输入

对于小于 20MB 的总图片载荷大小，我们建议上传采用 Base64 编码的图片，或直接上传本地存储的图片文件。

### 使用本地图片

如果您使用的是 Python Imaging Library (Pillow)，也可以使用 PIL 图片对象。

```python
from google import genai
from google.genai import types

import PIL.Image

image = PIL.Image.open('/path/to/image.png')

client = genai.Client(api_key="GEMINI_API_KEY")
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["What is this image?", image])

print(response.text)
```
Base64 编码的图片
您可以将公开图片网址编码为 Base64 载荷，以便上传。以下代码示例展示了如何仅使用标准库工具执行此操作：

```python

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
```python

多张图片
如需使用多张图片提示，您可以在对 generate_content 的调用中提供多张图片。这些数据可以采用任何受支持的格式，包括 base64 或 PIL。

from google import genai
from google.genai import types

import pathlib
import PIL.Image

image_path_1 = "path/to/your/image1.jpeg"  # Replace with the actual path to your first image
image_path_2 = "path/to/your/image2.jpeg" # Replace with the actual path to your second image

image_url_1 = "https://goo.gle/instrument-img" # Replace with the actual URL to your third image

pil_image = PIL.Image.open(image_path_1)

b64_image = types.Part.from_bytes(
    data=pathlib.Path(image_path_2).read_bytes(),
    mime_type="image/jpeg"
)

downloaded_image = requests.get(image_url_1)

client = genai.Client(api_key="GEMINI_API_KEY")
response = client.models.generate_content(
    model="gemini-2.0-flash-exp",
    contents=["What do these images have in common?",
              pil_image, b64_image, downloaded_image])

print(response.text)