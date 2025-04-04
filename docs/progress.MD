2025/3/31


当前，app端的功能，除了一些小bug之外，已经完成；现在进行serverless后端的重新搭建，摒弃旧的存储方式。生图服务摒弃NAI，选择replicate，实现真正的按使用量计费。

serverless：客户端-存储端-函数服务端

客户端-函数端：请求申请

函数端-函数端：license验证

函数端-API端：请求执行和返回

函数端-存储端：文件存储

存储端-客户端：文件返回。


现在后端需要：

1.TTS接入R2对象存储，并且在前端加入TTS功能。

**目标：** 修改 replicate-TTS 服务流程，不再从 MinIO 存储，而是从指定 URL 获取 `source_audio.mp3` 和 `source_transcript.txt`。

**现有流程：**

1.  **前端请求：** 前端发送包含 `templateId` 和 `tts_text` 的 JSON 请求。
    ```json
    {
      "templateId": "template1",
      "tts_text": "这是一段要转换为语音的示例文本。"
    }
    ```
2.  **后端处理：**
    *   后端接收到前端请求。
    *   根据 `templateId` 从 MinIO 存储中查找对应的 `source_audio.mp3` 和 `source_transcript.txt`。
    *   将 `source_audio.mp3`、`source_transcript.txt`、`tts_text` 和默认的 `task` 参数传递给 Replicate 服务。
    *   后端期望获得 Replicate 服务的响应。

**修改内容：**

不再从MinIO 获取 `source_audio.mp3` 和 `source_transcript.txt` 的方式，改为从以下 URL 格式获取：

```
https://cradleintro.top/{templateId}/source_audio.mp3
https://cradleintro.top/{templateId}/source_transcript.txt
```

**示例：**

如果 `templateId` 为 "template1"，则 `source_audio.mp3` 和 `source_transcript.txt` 的 URL 如下：

```
https://cradleintro.top/template1/source_audio.mp3
https://cradleintro.top/template1/source_transcript.txt
```

**总结：**

后端需要修改从 MinIO 获取文件的逻辑，改为构建并请求指定的 URL 来获取 `source_audio.mp3` 和 `source_transcript.txt`。 其他流程保持不变，包括把返回的文件上传到minio并响应的流程，也不变








朋友圈问题


   -人称问题


   -角色发帖频率和朋友圈页面的联动问题


TTS问题



TTS服务的中文示例音微调，TTS服务的所有示例音和transcript提供生成版本

在开启tts_enhancer之后，会调用LLM基于当前的聊天消息，生成语音参数tts_text和instructions参数，这是没问题的。

现在我们需要：开启tts_enhancer后，ttsService除了向服务端传递LLM生成tts_text和instructions之外，还需要再向服务端传输一个task参数，值为字符串"Instructed Voice Generation"。这样做的目的是让服务端识别这是一段需要增强的文本。


后端：允许前端传入task值

其他问题

硬编，内存泄漏等问题（角色卡删除的数据同步）


9.退出app后memoryfact丢失的问题。-








10.云服务：openrouter的转发，图片，tts的价格的问题。-



  -首先在模型计算器中，选择自己的使用习惯，需要更新对声音和图片的需求，计算出每个月的价格（充值+服务器费用）

  -用户得出目标价格之后在官网充值



为token_planner页面的计算器增加功能，用户输入中增加可选项为：语音生成和图片生成的需求输入（默认不选）选择后，计算结果将综合原本的模型费用计算结果，以及语音生成和图片生成的价格，得出一个每月的总价格

      -语音生成运行1分钱1秒钟，运行1秒约等于生成1秒或更长音频

      -图片生成运行1分钱1秒钟，生成1张图片大约5秒

      -openrouter服务转发和代充值，加收5%的手续费。优点在于不用自己搭建网络环境，以及更高的并发请求数量，如果同时启用联网搜索，记忆服务，语音增强，需要多次调用大模型，而自备的api可能会经常达到速率限制。
    





网站联系信息和售后




6.app打包



新增角色类型定义：动态立绘

前端摇篮页面代码新增生成动态立绘入口

前端在该入口，先上传角色图库中的图片，或本地相册的图片，到cd r2存储桶，用于在摇篮界面生成角色的动态立绘（需选择立绘名称）后，生成立绘，加入图库（可重新生成）

理解r2存储桶的上传规则，编写相应代码。

成功上传后，将url地址发送给replicate后端


replicate：

-新增图生视频接口，接收前端发送的r2 url

-前端传入图片将上传到cd r2存储桶，

-url默认为首尾帧

-新增一个luma ai的调用，传入首尾帧

-返回视频url，前端需下载到本地

-编写测试脚本，测试图生视频服务是否可用

-前端做好缓存清理。









在聊天界面展示动态立绘

聊天记录后处理，根据聊天上下文和当前ai回复输出，立绘类型，以及下一步剧情建议，Json输出

聊天界面展示可以切换(视觉小说模式或常规模式)，视觉小说模式需要消息区域设置一个边界线，靠近这个边界线的消息条的边缘会渐变透明，这样就可以让边界线上方的背景不被消息条遮挡。

主动消息也需要加入后处理，在用户打开窗口时自动播放动态立绘(如果在动态立绘模式normal~conditional
