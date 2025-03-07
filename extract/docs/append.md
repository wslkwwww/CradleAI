## 附录

### 提示词参考表

以下是一些常用的提示词参考，可以帮助您更有效地生成图像：

#### 艺术风格

| 风格名称 | 提示词 |
|---------|-------|
| 写实风格 | photorealistic, detailed, realistic photography |
| 油画风格 | oil painting, painterly, textured, artistic |
| 水彩风格 | watercolor painting, vibrant colors, flowing |
| 像素艺术 | pixel art, retro game style, 8-bit, 16-bit |
| 素描风格 | pencil sketch, line art, charcoal drawing |
| 科幻风格 | sci-fi, futuristic, cyberpunk, high tech |
| 奇幻风格 | fantasy, magical, mythical, medieval |

#### 光照效果

| 效果 | 提示词 |
|-----|-------|
| 阳光 | sunlight, golden hour, sun rays, sun beams |
| 夜晚 | night time, moonlight, dark, stars |
| 霓虹 | neon lights, neon glow, colorful lights |
| 体积光 | volumetric lighting, god rays, light beams |
| 逆光 | backlight, silhouette, rim light |
| 工作室光 | studio lighting, professional lighting, softbox |

#### 质量提升词

| 类别 | 提示词 |
|-----|-------|
| 基础质量 | masterpiece, best quality, highly detailed |
| 清晰度 | 4k, 8k, ultra hd, sharp focus, intricate details |
| 构图 | perfect composition, professional photography, award winning |
| 渲染质量 | unreal engine, octane render, cinema 4d, ray tracing |

#### 负面提示词

| 问题类型 | 提示词 |
|---------|-------|
| 普通缺陷 | blurry, low quality, worst quality, jpeg artifacts |
| 结构问题 | deformed, bad anatomy, disfigured, mutation |
| 错误特征 | extra limbs, missing limbs, extra fingers, fused fingers |
| 文字问题 | watermark, signature, text, username |

### API 错误码参考

| 错误码 | 描述 | 可能原因 | 解决方案 |
|-------|-----|---------|---------|
| `.invalid-token` | 无效的令牌 | 令牌过期或不正确 | 重新获取令牌 |
| `.invalid-password` | 无效的密码 | 登录凭据错误 | 确认账号密码 |
| `.file-too-large` | 文件太大 | 上传的图像超出大小限制 | 压缩图片或降低分辨率 |
| `.unsupported-file-type` | 不支持的文件类型 | 上传了非图像文件或不支持的格式 | 使用JPG或PNG格式 |
| `.network-error` | 网络错误 | 连接问题或网络中断 | 检查网络连接或使用代理 |
| `400` | 请求错误 | 请求参数有误 | 检查参数格式和值 |
| `401` | 未授权 | 认证信息无效 | 检查认证令牌 |
| `403` | 禁止访问 | 权限不足或账户受限 | 检查账户状态 |
| `429` | 请求过多 | 超过API限制或账户点数不足 | 降低请求频率或充值 |
| `500` | 服务器错误 | 服务器内部错误 | 稍后重试 |

## 专业技巧

### 1. 提示词工程最佳实践

- **使用基础质量词 + 细节描述 + 风格指导**结构化提示词
- 描述越具体越好，包括**场景、主体、背景、光照、视角、色调**等
- 使用英文提示词通常效果更好，可以利用翻译API转换
- 使用**逗号分隔**不同概念，权重由前到后降低
- 基于**艺术家风格**可以产生更一致的结果

### 2. 种子管理策略

- 使用**固定种子**可以在参数不变的情况下生成相同图像
- 种子可用于**创建变体**：相同种子+不同提示词产生相关但不同的图像
- 记录满意结果的种子，用于后续相似风格的生成
- 创建"种子库"按风格、主题、效果分类保存有效种子

### 3. 批量处理工作流

- 使用**脚本处理多个提示词**，减少手动操作
- 保持提示词、设置文件和生成图像之间的**命名关联**
- 实现**批处理渲染队列**，自动处理多个作业
- 为大批量生成建立**错误重试机制**
````