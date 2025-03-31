**本文档介绍了如何使用 Replicate API。以下是主要内容：**

**1. 身份验证 (Authentication)**

*   API 请求需要使用 token 进行身份验证。token 类似于密码，唯一标识你的帐户并授予你访问权限。
*   将 Replicate access token 存储在环境变量 `REPLICATE_API_TOKEN` 中，而不是直接写在代码里。例如，使用 `export REPLICATE_API_TOKEN=r8_8tL**********************************` 设置环境变量，或者将 `REPLICATE_API_TOKEN=r8_8tL**********************************` 写在 `.env` 文件中。
*   可以使用 cURL 命令来测试 token 是否设置正确: `curl https://api.replicate.com/v1/account -H "Authorization: Bearer $REPLICATE_API_TOKEN"`

**2. NodeJS 设置 (Setup)**

*   支持 ESM 和 CommonJS 两种模块格式。安装 `replicate` JavaScript 库： `npm install replicate`
*   ESM 导入方式：`import Replicate from "replicate";`
*   CommonJS 导入方式：`const Replicate = require("replicate");`
*   创建 Replicate 实例：`const replicate = new Replicate();`
*   Replicate 实例会自动从环境变量 `REPLICATE_API_TOKEN` 获取 API token。

**3. 运行模型 (Run the model)**

*   使用 `replicate.run()` 方法运行模型，并传入模型名称和输入参数。

* **模型输入输出 Schema:**

    * **输入 (Input):**

        ```json
        {
          "type": "object",
          "title": "Input",
          "required": [
            "source_audio",
            "source_transcript",
            "tts_text"
          ],
          "properties": {
            "task": {
              "enum": [
                "zero-shot voice clone",
                "cross-lingual voice clone",
                "Instructed Voice Generation"
              ],
              "type": "string",
              "title": "task",
              "description": "Task type / 任务类型：零样本声音克隆、跨语言声音克隆或指令式声音生成",
              "default": "zero-shot voice clone",
              "x-order": 3
            },
            "tts_text": {
              "type": "string",
              "title": "Tts Text",
              "x-order": 2,
              "description": "Text of the audio to generate / 要生成的音频文本内容"
            },
            "instruction": {
              "type": "string",
              "title": "Instruction",
              "default": "",
              "x-order": 4,
              "description": "Instruction for Instructed Voice Generation task / 指令式声音生成任务的指令内容"
            },
            "source_audio": {
              "type": "string",
              "title": "Source Audio",
              "format": "uri",
              "x-order": 0,
              "description": "Source audio / 源音频文件（参考来源）"
            },
            "source_transcript": {
              "type": "string",
              "title": "Source Transcript",
              "x-order": 1,
              "description": "Transcript of the source audio / 源音频（参考来源）的文字内容"
            }
          }
        }
        ```

        *   `task`:  任务类型，可选值： `"zero-shot voice clone"` (零样本声音克隆), `"cross-lingual voice clone"` (跨语言声音克隆), `"Instructed Voice Generation"` (指令式声音生成)。默认值为 `"zero-shot voice clone"`。
        *   `tts_text`:  要生成的音频文本内容。
        *   `instruction`: 指令式声音生成任务的指令内容。 仅在任务类型为 `"Instructed Voice Generation"` 时有效。
        *   `source_audio`:  源音频文件 (参考来源)。必须是 URL。
        *   `source_transcript`: 源音频 (参考来源) 的文字内容。

    * **输出 (Output):**

        ```json
        {
          "type": "string",
          "title": "Output",
          "format": "uri"
        }
        ```

        *   输出是一个音频文件的URL。

*   例如：
    ```javascript
    const input = {
        tts_text: "白日依山尽，黄河入海流。",
        source_audio: "https://replicate.delivery/pbxt/MgbBQRAKfZkuc9EcspUou25Uxfdgc3xWS43kvqIla8eWBsaQ/zero_shot_prompt.wav",
        source_transcript: "希望你以后能够做得比我还好哟！"
    };

    const output = await replicate.run("jichengdu/cosyvoice:4106862b8e948847f2d7e1513eb1b03e7bd07333343dda94c83cf78d82eb3f1d", { input });
    ```
*   `replicate.run()` 直接返回模型输出结果。如果需要访问完整的 prediction 对象 (例如 id, status, logs)，可以使用 `replicate.predictions.create()` 方法。

**4. 文件输入 (File inputs)**

*   模型可以接受文件作为输入。
*   提供文件输入的三种方式：
    *   **Hosted file (URL):** 使用 URL 指向托管在网上的文件。(需要符合 `source_audio` 的URI格式)
    *   **Local file:** 使用 Blob, File 或 Buffer 对象，Replicate 库会自动处理上传。
    *   **Data URI:** 将文件进行 base64 编码后，生成 Data URI (推荐用于小于 1MB 的文件)。

**5. Prediction 生命周期 (Prediction lifecycle)**

*   Prediction 具有以下状态：Starting, Running, Succeeded, Failed, Canceled。
*   可以使用 `predictions.get()` 方法来获取 prediction 的最新状态。

**6. Webhooks**

*   Webhooks 可以在 prediction 状态发生变化时，实时发送 HTTP POST 请求到指定的 URL。
*   创建 prediction 时，可以通过 `webhook` 参数指定 webhook URL，并通过 `webhook_events_filter` 参数指定需要接收的事件 (例如 "start", "output", "logs", "completed")。
*   因为使用了 webhook，不再需要轮询 prediction 的状态。
*   可以使用相关文档验证webhook的安全性。

**7. 访问 Prediction 对象 (Access a prediction)**

*   使用 `replicate.predictions.create()` 或者 `replicate.deployments.predictions.create()` 函数可以获取 prediction 对象。
*   注意，这些函数只会返回创建的 prediction 对象，不会等待 prediction 完成。可以使用 `replicate.predictions.get()` 方法获取最新的 prediction 信息。

**8. 取消 Prediction (Cancel a prediction)**

*   使用 `replicate.predictions.cancel()` 函数，传入 prediction id 可以取消 prediction。

我增加了对输入参数的描述，更加明确地说明了各个参数的用途和类型。 另外，也提到了 `source_audio` 需要符合URI格式。