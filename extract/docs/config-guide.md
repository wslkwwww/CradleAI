# NovelAI API 配置详解

本文档详细介绍 NovelAI API 提取库的各项配置参数，帮助您根据自己的需求进行精确配置。

## 目录

1. [认证配置](#认证配置)
2. [服务器配置](#服务器配置)
3. [模型与采样器](#模型与采样器)
4. [生成参数](#生成参数)
5. [特定后端配置](#特定后端配置)
6. [配置示例](#配置示例)

## 认证配置

### type

- **类型**: `string`
- **可选值**: `'token'`, `'login'`, `'naifu'`, `'sd-webui'`, `'stable-horde'`
- **默认值**: `'token'`
- **描述**: 认证方式/后端类型

这是最基础的配置项，决定了您使用的后端服务类型：
- `token`: 使用 NovelAI 官方 API，通过授权令牌认证（推荐）
- `login`: 使用 NovelAI 官方 API，通过账号密码认证
- `naifu`: 连接到 NAI Diffusion (NAIFU) 私有部署实例
- `sd-webui`: 连接到 Stable Diffusion WebUI 的 API
- `stable-horde`: 连接到 Stable Horde 分布式网络

### token

- **类型**: `string`
- **适用类型**: `token`, `stable-horde`, `naifu`(可选)
- **描述**: 认证令牌

在使用 `token` 类型时，这是您从 NovelAI 获取的授权令牌。
在使用 `stable-horde` 类型时，这是您的 API Key（可以使用 `0000000000` 进行匿名访问）。

### email 和 password

- **类型**: `string`
- **适用类型**: `login`
- **描述**: NovelAI 账号邮箱和密码

在使用 `login` 类型时，需要提供您的 NovelAI 账号邮箱和密码。
这种方式仅在服务器环境中可用，不推荐在浏览器环境中使用。

## 服务器配置

### endpoint

- **类型**: `string`
- **默认值**: `'https://api.novelai.net'`（使用官方 API 时）
- **适用类型**: 所有类型
- **描述**: API 服务器地址

后端服务的 URL。对于不同的后端，应设置为：
- NovelAI 官方: `https://api.novelai.net`
- SD-WebUI: 您的 WebUI 地址，如 `http://127.0.0.1:7860`
- NAIFU: 您的 NAIFU 服务地址，如 `http://localhost:6969`
- Stable Horde: `https://stablehorde.net/`

### apiEndpoint

- **类型**: `string`
- **默认值**: 与 `endpoint` 相同
- **适用类型**: `token`, `login`
- **描述**: API 服务器地址（用于认证）

通常与 `endpoint` 保持一致，专用于认证过程。

### headers

- **类型**: `Record<string, string>`
- **默认值**: `{}`
- **描述**: 附加的 HTTP 请求头

可以自定义添加到 API 请求中的 HTTP 头信息。

### requestTimeout

- **类型**: `number`
- **默认值**: `60000` (60秒)
- **描述**: API 请求的超时时间（毫秒）

如果遇到请求超时错误，可以根据网络情况增加此值。

## 模型与采样器

### model

- **类型**: `string`
- **默认值**: `'nai-v3'`
- **可选值**:
  - NovelAI: `'safe'`, `'nai'`, `'furry'`, `'nai-v3'`, `'nai-v4-curated-preview'`, `'nai-v4-full'`
  - Stable Horde: 可用模型列表见其文档
- **描述**: 默认使用的生成模型

不同模型产生的图像风格和质量会有明显差异。较新的模型通常具有更高的生成质量。

### sampler

- **类型**: `string`
- **默认值**: `'k_euler_ancestral'`
- **可选值**:
  - NovelAI: `'k_euler_ancestral'`, `'k_euler'`, `'k_lms'`, `'ddim'`, `'plms'`
  - SD-WebUI: 取决于您的安装，常见的包括 `'Euler a'`, `'DDIM'`, `'DPM++ 2M Karras'` 等
- **描述**: 默认使用的采样器

不同采样器会产生不同的效果，有些侧重细节，有些则更加稳定。

### scheduler

- **类型**: `string`
- **默认值**: 根据后端类型不同而变化
- **可选值**:
  - NovelAI: `'native'`, `'karras'`, `'exponential'`, `'polyexponential'`
  - SD-WebUI: `'Automatic'`, `'Uniform'`, `'Karras'` 等
- **描述**: 噪声调度器类型

控制采样过程中的噪声调度方式。

## 生成参数

### textSteps

- **类型**: `number`
- **默认值**: `28`
- **描述**: 文本生成图像时的默认迭代步数

文本到图像生成使用的迭代步数。步数越多，细节越丰富，但也需要更多处理时间。

### imageSteps

- **类型**: `number`
- **默认值**: `50`
- **描述**: 图像生成图像时的默认迭代步数

图像到图像生成通常需要更多的步数以获得良好的效果。

### scale

- **类型**: `number`
- **默认值**: `11`
- **描述**: 默认的提示词相关性（CFG Scale）

提示词相关性控制生成图像与提示词的匹配程度。较高的值会让图像更严格地遵循提示词。

### strength

- **类型**: `number`
- **默认值**: `0.7`
- **范围**: `0.0` - `1.0`
- **描述**: 默认的图像到图像转换强度

控制新生成图像与原始图像的相似程度，值越低越接近原图。

### noise

- **类型**: `number`
- **默认值**: `0.2`
- **范围**: `0.0` - `1.0`
- **描述**: 默认的图像到图像噪声强度

控制添加到图像中的噪声量，影响细节的变化程度。

## 特定后端配置

### NovelAI 特有参数

#### smea 和 smeaDyn

- **类型**: `boolean`
- **默认值**: `false`
- **适用模型**: `nai-v3`
- **描述**: SMEA 采样模式开关

启用 NAI-v3 模型的 SMEA 采样模式，可能提供更好的细节和一致性。

#### decrisper

- **类型**: `boolean`
- **默认值**: `false`
- **描述**: 启用动态阈值处理

可能帮助减少过饱和和提高某些细节的真实感。

### Stable Horde 特有参数

#### trustedWorkers

- **类型**: `boolean`
- **默认值**: `false`
- **描述**: 是否只使用可信任的工作节点

启用后，仅使用经过验证的可信任节点，可能提供更一致的结果。

#### pollInterval

- **类型**: `number`
- **默认值**: `1000` (1秒)
- **描述**: 轮询间隔时间（毫秒）

Stable Horde 使用轮询机制检查生成结果，此参数控制轮询频率。

#### nsfw

- **类型**: `'disallow' | 'censor' | 'allow'`
- **默认值**: `'allow'`
- **描述**: NSFW 内容处理策略

控制 Stable Horde 如何处理可能的 NSFW 内容。

### SD-WebUI 特有参数

#### upscaler

- **类型**: `string`
- **默认值**: `'Lanczos'`
- **描述**: 默认的图像放大算法

控制图像增强时使用的放大算法。

## 配置示例

以下是针对不同后端的完整配置示例：

### NovelAI 官方 API (Token)

```javascript
const config = {
  type: 'token',
  token: 'your-token-here', // 替换为您的令牌
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  textSteps: 28,
  scale: 11,
  scheduler: 'native',
  // NAI v3 特有参数
  smea: false,
  smeaDyn: false,
  decrisper: false,
  requestTimeout: 60000
};
```

### NovelAI 官方 API (账号密码)

```javascript
const config = {
  type: 'login',
  email: 'your-email@example.com', // 替换为您的邮箱
  password: 'your-password-here',  // 替换为您的密码
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  textSteps: 28,
  scale: 11
};
```

### Stable Diffusion WebUI

```javascript
const config = {
  type: 'sd-webui',
  endpoint: 'http://127.0.0.1:7860', // 替换为您的 WebUI 地址
  sampler: 'Euler a',
  textSteps: 28,
  imageSteps: 50,
  scale: 7,
  scheduler: 'Karras',
  upscaler: 'ESRGAN_4x'
};
```

### Stable Horde

```javascript
const config = {
  type: 'stable-horde',
  token: '0000000000', // 匿名访问或替换为您的 API Key
  endpoint: 'https://stablehorde.net/',
  model: 'stable_diffusion_2.1',
  sampler: 'k_euler_ancestral',
  textSteps: 30,
  scale: 9,
  trustedWorkers: true,
  nsfw: 'allow',
  pollInterval: 2000
};
```

### NAIFU

```javascript
const config = {
  type: 'naifu',
  endpoint: 'http://localhost:6969', // 替换为您的 NAIFU 服务地址
  token: 'optional-token-if-needed',
  sampler: 'k_euler_ancestral',
  textSteps: 28,
  scale: 11
};
```

## 配置最佳实践

1. **合理设置步数**：对于一般用途，28-30 步通常已经足够，太高的步数可能不会有明显的质量提升但会增加生成时间
2. **调整 scale 以平衡创意与精确度**：较低的 scale (7-9) 给 AI 更多创作自由，较高的 (11-15) 则更严格遵循提示词
3. **图像到图像转换中的 strength 参数**：0.3-0.5 适合保留原图的基本结构，0.6-0.8 则允许更多变化
4. **使用适合您任务的采样器**：`k_euler_ancestral` 是一个很好的通用选择，而 `k_dpmpp_2m` 在细节上可能表现更好
5. **针对网络不稳定情况**：增加 `requestTimeout` 值，并设置适当的代理
