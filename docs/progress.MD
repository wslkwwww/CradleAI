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


   -现有的服务接入对象

   -在角色创建页面增加标签页：声线。

   -选择声线，即选择了一个声音template。

   -在对话窗口，和角色对话时，可以点击消息条的语音生成。

   -点击语音生成，即触发想TTS服务端的请求流程，需验证用户license。

   -因为语音生成可能很慢，所以它不应该影响app内正常的聊天流程。

   -当语音下载完毕，消息条的下载按钮转为播放按钮，用户可以点击播放按钮，播放下载到本地的语音。


2.生图服务，replicate不需要访问https url，图片可以传到存储桶。为了负荷均衡，图片存储暂时不变。


3.