**目标：**

*   在 `CradleCreateForm.tsx` 的外观选项中，增加预设参考图片选择功能，允许用户通过视觉方式选择角色风格。

**数据源：**

*   参考图片及对应的 "画师串" 提示词、性别信息，存储在 `data/v4-artist.json` 文件中。
*   参考图片素材存储在 `data` 文件夹下。
*   后续维护通过修改 `data/v4-artist.json` 文件和添加/修改 `data` 文件夹下的图片素材实现。

**画师串提示词：**

*   "画师串" 提示词是一种键值对形式的提示词，以 `artist` 为键，画师名为值。例如：`artist:billy`。
*   用户选择预设参考图片后，对应的画师串提示词将自动添加到图片生成请求的提示词中。

**提示词生成规则：**

*   画师串提示词会被添加到提示词 (prompt) 的**末尾**。例如：`best quality, 1girl, artist:billy`。

**负面提示词优化：**

*   所有图片生成请求的负面提示词将**默认包含**以下提示词，但在前端**不进行展示**：

```
blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, multiple views, gigantic breasts, white blank page, blank page, nsfw, blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, white blank page, blank page, blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, white blank page, blank page, Bad hands, bad eyes, extra fingers, fewer fingers, ugly, deformed, disproportionate, displeasing, very displeasing
```