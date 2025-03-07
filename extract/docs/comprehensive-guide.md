````markdown
# NovelAI API 库综合指南

本文档提供了 NovelAI API 库的完整指南，包括 API 规范、接口类型和图片生成服务的配置选项。通过本指南，您可以轻松集成和使用 NovelAI API 库的各项功能。

## 目录

1. [基本设置](#基本设置)
   - [安装](#安装)
   - [初始化](#初始化)
   - [认证配置](#认证配置)

2. [核心功能](#核心功能)
   - [文本生成图像](#文本生成图像)
   - [图像生成图像](#图像生成图像)
   - [图像增强](#图像增强)
   - [历史记录管理](#历史记录管理)

3. [API 接口规范](#api-接口规范)
   - [NovelAIAPI 接口](#novelaiapi-接口)
   - [参数类型定义](#参数类型定义)
   - [返回值类型](#返回值类型)

4. [配置详解](#配置详解)
   - [认证方式](#认证方式)
   - [服务器配置](#服务器配置)
   - [模型与采样器](#模型与采样器)
   - [生成参数](#生成参数)
   - [特定后端配置](#特定后端配置)

5. [最佳实践](#最佳实践)
   - [错误处理](#错误处理)
   - [参数优化](#参数优化)
   - [提示词技巧](#提示词技巧)

6. [完整应用示例](#完整应用示例)
   - [基础应用](#基础应用)
   - [高级工作流](#高级工作流)

## 基本设置

### 安装

```bash
npm install novelai-api
# 或使用 yarn
yarn add novelai-api
```

### 初始化

```typescript
import { SimpleContext, NovelAIApiService, NovelAIConfig } from 'novelai-api';

// 创建上下文
const ctx = new SimpleContext();

// 创建配置
const config: NovelAIConfig = {
  type: 'token',
  token: 'your-token-here',
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  textSteps: 28,
  imageSteps: 50,
  scale: 11,
  strength: 0.7,
  noise: 0.2,
  requestTimeout: 60000,
};

// 初始化 API 服务
const service = new NovelAIApiService(ctx, config);
```

### 认证配置

该库支持多种认证方式和后端服务：

#### NovelAI 官方 API (Token)

```typescript
const config: NovelAIConfig = {
  type: 'token',
  token: 'your-token-here', // 从 localStorage.session 获取
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
};
```

#### NovelAI 官方 API (账号密码)

```typescript
const config: NovelAIConfig = {
  type: 'login',
  email: 'your-email@example.com',
  password: 'your-password-here',
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
};
```

#### Stable Diffusion WebUI

```typescript
const config: NovelAIConfig = {
  type: 'sd-webui',
  endpoint: 'http://127.0.0.1:7860',
};
```

#### Stable Horde

```typescript
const config: NovelAIConfig = {
  type: 'stable-horde',
  token: '0000000000', // 或您的 API Key
  endpoint: 'https://stablehorde.net/',
};
```

#### NAIFU

```typescript
const config: NovelAIConfig = {
  type: 'naifu',
  endpoint: 'http://localhost:6969',
};
```

## 核心功能

### 文本生成图像

使用提示词从文本生成图像：

```typescript
// 基本使用
const result = await service.generateFromText({
  prompt: '美丽的风景，山脉和湖泊，4K高清'
});

if (result.success) {
  console.log('图像URL:', result.imageUrl);
} else {
  console.error('生成失败:', result.error);
}

// 高级选项
const advancedResult = await service.generateFromText({
  prompt: '科幻风格城市夜景，霓虹灯，未来感，高质量',
  negativePrompt: '模糊，低质量，变形',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  steps: 30,
  scale: 11,
  seed: 12345,  // 指定种子
  resolution: 'landscape',  // 或 {width: 768, height: 512}
  userId: 'user123'  // 用于历史记录
});
```

### 图像生成图像

从现有图像生成新图像：

```typescript
const result = await service.generateFromImage(
  'https://example.com/source-image.jpg',  // 或 base64 数据 URL
  {
    prompt: '将图像转换为冬季场景，添加雪',
    negativePrompt: '模糊，低质量',
    strength: 0.7,  // 控制与原图差异程度
    noise: 0.2,     // 控制添加的噪声
    steps: 50       // 图生图通常需要更多步数
  }
);
```

### 图像增强

增强图像质量（仅支持 SD-WebUI 后端）：

```typescript
const result = await service.enhanceImage(
  'https://example.com/source-image.jpg',
  {
    scale: 2,          // 放大倍数
    upscaler: 'ESRGAN_4x',  // 使用的算法
    upscaler2: 'None',      // 第二算法
    visibility: 0.5,        // 第二算法的可见度
    crop: false             // 是否裁剪
  }
);
```

### 历史记录管理

管理生成历史记录：

```typescript
// 获取用户的生成历史
const history = service.getHistory('user123', 10);  // 最近10条

// 获取特定记录
const item = await service.getHistoryItem('record-id', 'user123');

// 删除记录
await service.deleteHistoryItem('record-id', 'user123');

// 清空历史
await service.clearHistory('user123');
```

## API 接口规范

### NovelAIAPI 接口

`NovelAIAPI` 接口定义了提取库的主要功能：

```typescript
interface NovelAIAPI {
  /**
   * 从文本生成图像
   * @param params 生成参数
   * @returns 生成结果
   */
  generateFromText(params: TextToImageParameters): Promise<GenerationResult>;
  
  /**
   * 从图像生成新图像
   * @param sourceImage 源图像 (URL、Base64或文件路径)
   * @param params 生成参数
   * @returns 生成结果
   */
  generateFromImage(sourceImage: string, params: ImageToImageParameters): Promise<GenerationResult>;
  
  /**
   * 增强图像质量
   * @param sourceImage 源图像 (URL、Base64或文件路径)
   * @param params 增强参数
   * @returns 增强结果
   */
  enhanceImage(sourceImage: string, params: ImageEnhancementParameters): Promise<GenerationResult>;
  
  /**
   * 获取用户历史记录
   * @param userId 用户ID (可选，默认为'anonymous')
   * @param limit 限制返回记录数量 (可选)
   * @returns 历史记录项目数组
   */
  getHistory(userId?: string, limit?: number): HistoryItem[];
  
  /**
   * 获取特定历史记录
   * @param id 记录ID
   * @param userId 用户ID (可选)
   * @returns 历史记录项目，不存在则返回null
   */
  getHistoryItem(id: string, userId?: string): Promise<HistoryItem | null>;
  
  /**
   * 删除历史记录
   * @param id 记录ID
   * @param userId 用户ID (可选)
   * @returns 是否成功删除
   */
  deleteHistoryItem(id: string, userId?: string): Promise<boolean>;
  
  /**
   * 清空用户历史
   * @param userId 用户ID
   */
  clearHistory(userId: string): Promise<void>;
  
  /**
   * 获取可用模型列表
   * @returns 模型名称数组
   */
  getAvailableModels(): string[];
  
  /**
   * 获取可用采样器列表
   * @returns 采样器名称数组
   */
  getAvailableSamplers(): string[];
  
  /**
   * 获取可用调度器列表
   * @returns 调度器名称数组
   */
  getAvailableSchedulers(): string[];
  
  /**
   * 获取预设分辨率
   * @returns 分辨率配置对象
   */
  getAvailableResolutions(): Record<string, { width: number, height: number }>;
}
```

### 参数类型定义

#### 文本生成图像的参数

```typescript
interface TextToImageParameters {
  /** 正向提示词，描述你想要生成的内容 */
  prompt: string;
  
  /** 负向提示词，描述你不想在图像中出现的内容 */
  negativePrompt?: string;
  
  /** 使用的模型名称 */
  model?: string;
  
  /** 采样器 */
  sampler?: string;
  
  /** 生成步数 */
  steps?: number;
  
  /** 提示词相关性，值越高越遵循提示词 */
  scale?: number;
  
  /** 随机种子，相同种子+参数会产生相似结果 */
  seed?: number;
  
  /** 
   * 图像分辨率
   * 可以是预设值 'portrait', 'landscape', 'square' 
   * 或自定义宽高 { width: number, height: number }
   */
  resolution?: { width: number, height: number } | string;
  
  /** 调度器 */
  scheduler?: string;
  
  /** 批量生成数量 */
  batchSize?: number;
  
  /** 用户ID，用于历史记录管理 */
  userId?: string;
}
```

#### 图像生成图像的参数

```typescript
interface ImageToImageParameters extends TextToImageParameters {
  /** 转换强度，值越低越接近原图 (0.0-1.0) */
  strength?: number;
  
  /** 噪声强度，影响细节的变化程度 (0.0-1.0) */
  noise?: number;
}
```

#### 图像增强的参数

```typescript
interface ImageEnhancementParameters {
  /** 放大倍数 */
  scale?: number;
  
  /** 使用的放大算法 */
  upscaler?: string;
  
  /** 辅助放大算法 */
  upscaler2?: string;
  
  /** 辅助算法可见度 */
  visibility?: number;
  
  /** 是否裁剪图像 */
  crop?: boolean;
  
  /** 用户ID，用于历史记录管理 */
  userId?: string;
}
```

### 返回值类型

#### 生成结果

```typescript
interface GenerationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 生成的图像URL（成功时提供） */
  imageUrl?: string;
  
  /** 生成参数（成功时提供） */
  parameters?: Record<string, any>;
  
  /** 错误信息（失败时提供） */
  error?: string;
}
```

#### 历史记录项目

```typescript
interface HistoryItem {
  /** 记录ID */
  id: string;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 记录类型 */
  type: 'text2img' | 'img2img' | 'enhance';
  
  /** 正向提示词 */
  prompt: string;
  
  /** 负向提示词 */
  negativePrompt: string;
  
  /** 生成的图像URL */
  imageUrl: string;
  
  /** 生成参数 */
  parameters: Record<string, any>;
  
  /** 用户ID */
  userId?: string;
}
```

## 配置详解

### 认证方式

#### type

- **类型**: `string`
- **可选值**: `'token'`, `'login'`, `'naifu'`, `'sd-webui'`, `'stable-horde'`, `'comfyui'`
- **默认值**: `'token'`
- **描述**: 认证方式/后端类型

这是最基础的配置项，决定了您使用的后端服务类型：
- `token`: 使用 NovelAI 官方 API，通过授权令牌认证（推荐）
- `login`: 使用 NovelAI 官方 API，通过账号密码认证
- `naifu`: 连接到 NAI Diffusion (NAIFU) 私有部署实例
- `sd-webui`: 连接到 Stable Diffusion WebUI 的 API
- `stable-horde`: 连接到 Stable Horde 分布式网络
- `comfyui`: 连接到 ComfyUI 服务

#### token

- **类型**: `string`
- **适用类型**: `token`, `stable-horde`, `naifu`(可选)
- **描述**: 认证令牌

在使用 `token` 类型时，这是您从 NovelAI 获取的授权令牌。
在使用 `stable-horde` 类型时，这是您的 API Key（可以使用 `0000000000` 进行匿名访问）。

#### email 和 password

- **类型**: `string`
- **适用类型**: `login`
- **描述**: NovelAI 账号邮箱和密码

在使用 `login` 类型时，需要提供您的 NovelAI 账号邮箱和密码。
这种方式仅在服务器环境中可用，不推荐在浏览器环境中使用。

### 服务器配置

#### endpoint

- **类型**: `string`
- **默认值**: `'https://api.novelai.net'`（使用官方 API 时）
- **适用类型**: 所有类型
- **描述**: API 服务器地址

后端服务的 URL。对于不同的后端，应设置为：
- NovelAI 官方: `https://api.novelai.net`
- SD-WebUI: 您的 WebUI 地址，如 `http://127.0.0.1:7860`
- NAIFU: 您的 NAIFU 服务地址，如 `http://localhost:6969`
- Stable Horde: `https://stablehorde.net/`
- ComfyUI: 您的 ComfyUI 服务地址，如 `http://127.0.0.1:8188`

#### apiEndpoint

- **类型**: `string`
- **默认值**: 与 `endpoint` 相同
- **适用类型**: `token`, `login`
- **描述**: API 服务器地址（用于认证）

通常与 `endpoint` 保持一致，专用于认证过程。

#### headers

- **类型**: `Record<string, string>`
- **默认值**: `{}`
- **描述**: 附加的 HTTP 请求头

可以自定义添加到 API 请求中的 HTTP 头信息。

#### requestTimeout

- **类型**: `number`
- **默认值**: `60000` (60秒)
- **描述**: API 请求的超时时间（毫秒）

如果遇到请求超时错误，可以根据网络情况增加此值。

### 模型与采样器

#### model

- **类型**: `string`
- **默认值**: `'nai-v3'`
- **可选值**:
  - NovelAI: `'safe'`, `'nai'`, `'furry'`, `'nai-v3'`, `'nai-v4-curated-preview'`, `'nai-v4-full'`
  - Stable Horde: 可用模型列表见其文档
- **描述**: 默认使用的生成模型

不同模型产生的图像风格和质量会有明显差异。较新的模型通常具有更高的生成质量。

#### sampler

- **类型**: `string`
- **默认值**: `'k_euler_ancestral'`
- **可选值**:
  - NovelAI: `'k_euler_ancestral'`, `'k_euler'`, `'k_lms'`, `'ddim'`, `'plms'`
  - NAI-v3: `'k_euler'`, `'k_euler_a'`, `'k_dpmpp_2s_ancestral'`, `'k_dpmpp_2m'`, `'k_dpmpp_sde'`, `'ddim_v3'`
  - NAI-v4: `'k_euler'`, `'k_euler_a'`, `'k_dpmpp_2s_ancestral'`, `'k_dpmpp_2m_sde'`, `'k_dpmpp_2m'`, `'k_dpmpp_sde'`
  - SD-WebUI: 取决于您的安装，常见的包括 `'Euler a'`, `'DDIM'`, `'DPM++ 2M Karras'` 等
  - Stable Horde: `'k_lms'`, `'k_heun'`, `'k_euler'`, `'k_euler_a'` 等
  - ComfyUI: `'euler'`, `'euler_ancestral'`, `'heun'`, `'dpm_2'` 等
- **描述**: 默认使用的采样器

不同采样器会产生不同的效果，有些侧重细节，有些则更加稳定。

#### scheduler

- **类型**: `string`
- **默认值**: 根据后端类型不同而变化
- **可选值**:
  - NovelAI: `'native'`, `'karras'`, `'exponential'`, `'polyexponential'`
  - NAI-v4: `'karras'`, `'exponential'`, `'polyexponential'`
  - SD-WebUI: `'Automatic'`, `'Uniform'`, `'Karras'` 等
  - Stable Horde: `'karras'`
  - ComfyUI: `'normal'`, `'karras'`, `'exponential'`, `'sgm_uniform'`, `'simple'`, `'ddim_uniform'`
- **描述**: 噪声调度器类型

控制采样过程中的噪声调度方式。

### 生成参数

#### textSteps

- **类型**: `number`
- **默认值**: `28`
- **描述**: 文本生成图像时的默认迭代步数

文本到图像生成使用的迭代步数。步数越多，细节越丰富，但也需要更多处理时间。

#### imageSteps

- **类型**: `number`
- **默认值**: `50`
- **描述**: 图像生成图像时的默认迭代步数

图像到图像生成通常需要更多的步数以获得良好的效果。

#### scale

- **类型**: `number`
- **默认值**: `11`
- **描述**: 默认的提示词相关性（CFG Scale）

提示词相关性控制生成图像与提示词的匹配程度。较高的值会让图像更严格地遵循提示词。

#### strength

- **类型**: `number`
- **默认值**: `0.7`
- **范围**: `0.0` - `1.0`
- **描述**: 默认的图像到图像转换强度

控制新生成图像与原始图像的相似程度，值越低越接近原图。

#### noise

- **类型**: `number`
- **默认值**: `0.2`
- **范围**: `0.0` - `1.0`
- **描述**: 默认的图像到图像噪声强度

控制添加到图像中的噪声量，影响细节的变化程度。

#### resolution

- **类型**: `string` 或 `{width: number, height: number}`
- **默认值**: `'portrait'`
- **可选值**: 
  - `'portrait'`: 竖图，1216×832
  - `'landscape'`: 横图，832×1216
  - `'square'`: 方形，1024×1024
  - 自定义尺寸对象 `{width: number, height: number}`
- **描述**: 生成图像的分辨率

可以使用预设值或自定义分辨率，注意分辨率应为 64 的倍数，且总像素数不宜过大。

### 特定后端配置

#### NovelAI 特有参数

##### smea 和 smeaDyn

- **类型**: `boolean`
- **默认值**: `false`
- **适用模型**: `nai-v3`
- **描述**: SMEA 采样模式开关

启用 NAI-v3 模型的 SMEA 采样模式，可能提供更好的细节和一致性。

##### decrisper

- **类型**: `boolean`
- **默认值**: `false`
- **描述**: 启用动态阈值处理

可能帮助减少过饱和和提高某些细节的真实感。

##### rescale

- **类型**: `number`
- **范围**: `0.0` - `1.0`
- **默认值**: `0`
- **适用模型**: `nai-v4-*`
- **描述**: 输入服从度调整规模

NovelAI v4 模型的特殊参数，调整生成的一致性。

#### SD-WebUI 特有参数

##### upscaler

- **类型**: `string`
- **默认值**: `'Lanczos'`
- **可选值**: `'None'`, `'Lanczos'`, `'Nearest'`, `'ESRGAN_4x'` 等（取决于安装的模型）
- **描述**: 默认的图像放大算法

控制图像增强时使用的放大算法。

##### restoreFaces

- **类型**: `boolean`
- **默认值**: `false`
- **描述**: 是否启用人脸修复

SD-WebUI 独有功能，可以改善生成图像中的面部特征。

##### hiresFix

- **类型**: `boolean`
- **默认值**: `false`
- **描述**: 是否启用高分辨率修复

SD-WebUI 独有功能，生成初始图像后进行再处理以获得更高品质。

##### hiresFixUpscaler

- **类型**: `string`
- **默认值**: `'Latent'`
- **可选值**: `'Latent'`, `'Latent (antialiased)'`, `'Latent (bicubic)'` 等
- **描述**: 高分辨率修复的放大算法

用于 hiresFix 的放大算法。

#### Stable Horde 特有参数

##### trustedWorkers

- **类型**: `boolean`
- **默认值**: `false`
- **描述**: 是否只使用可信任的工作节点

启用后，仅使用经过验证的可信任节点，可能提供更一致的结果。

##### pollInterval

- **类型**: `number`
- **默认值**: `1000` (1秒)
- **描述**: 轮询间隔时间（毫秒）

Stable Horde 使用轮询机制检查生成结果，此参数控制轮询频率。

##### nsfw

- **类型**: `'disallow' | 'censor' | 'allow'`
- **默认值**: `'allow'`
- **描述**: NSFW 内容处理策略

控制 Stable Horde 如何处理可能的 NSFW 内容。

#### ComfyUI 特有参数

##### workflowText2Image

- **类型**: `string`
- **描述**: API 格式的文本到图像工作流

指定用于文本到图像生成的 ComfyUI 工作流 JSON 文件路径。

##### workflowImage2Image

- **类型**: `string`
- **描述**: API 格式的图像到图像工作流

指定用于图像到图像生成的 ComfyUI 工作流 JSON 文件路径。

## 最佳实践

### 错误处理

有效的错误处理示例：

```typescript
try {
  const result = await service.generateFromText({
    prompt: '美丽的风景'
  });
  
  if (result.success) {
    // 处理成功
    saveImage(result.imageUrl);
  } else {
    // 处理特定错误
    switch(result.error) {
      case '.unsupported-file-type':
        console.error('不支持的文件类型');
        break;
      case '.file-too-large':
        console.error('文件太大');
        break;
      case '.network-error':
        console.error('网络错误，请检查连接');
        break;
      case '.invalid-token':
        console.error('无效的认证令牌');
        break;
      default:
        console.error('生成失败:', result.error);
    }
  }
} catch (error) {
  // 处理未预期的错误
  console.error('发生异常:', error);
}
```

### 参数优化

以下是一些优化生成参数的建议：

1. **步数 (steps)**:
   - 文本到图像：28-35 步通常足够
   - 图像到图像：40-50 步以获得更好的细节

2. **相关性 (scale)**:
   - 7-9: 创意性更强，但可能与提示词偏离
   - 9-12: 平衡创意和准确性
   - 12-15: 高度遵循提示词，但创意性较低

3. **强度 (strength)**:
   - 0.3-0.5: 保留原图大部分特征
   - 0.5-0.7: 平衡原图和新内容
   - 0.7-0.9: 大幅改变原图，仅保留基本结构

4. **噪声 (noise)**:
   - 0.1-0.2: 较小的细节变化
   - 0.2-0.4: 中等细节变化
   - 0.4+: 显著的细节变化

### 提示词技巧

以下是一些优化提示词的技巧：

1. **使用详细描述**：越具体越好，包括主体、风格、光线、视角等
2. **正确使用权重**：重要的关键词放在前面
3. **使用艺术风格词**：如 "masterpiece, best quality, highly detailed"
4. **负面提示词**：排除不需要的元素，如 "blurry, low quality, deformed"

示例优质提示词：

```
一个美丽的风景, 山脉, 湖泊, 落日, 金色的天空, 逼真的光影, 4k超高清, 专业摄影, 完美构图, masterpiece, best quality, highly detailed
```

负面提示词示例：

```
模糊, 低质量, 变形, 扭曲, 错误比例, 多余的肢体, 粗糙, 低分辨率, 草图, 重复
```

## 完整应用示例

### 基础应用

```typescript
import { SimpleContext, NovelAIApiService, NovelAIConfig } from 'novelai-api';

// 创建上下文
const ctx = new SimpleContext();

// 创建配置
const config: NovelAIConfig = {
  type: 'token',
  token: 'your-token-here',
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  textSteps: 28,
  imageSteps: 50,
  scale: 11,
  strength: 0.7,
  noise: 0.2,
  requestTimeout: 60000,
};

// 初始化 API 服务
const service = new NovelAIApiService(ctx, config);

// 生成图像
async function generateImage() {
  const result = await service.generateFromText({
    prompt: '美丽的风景，山脉和湖泊，4K高清'
  });

  if (result.success) {
    console.log('图像URL:', result.imageUrl);
  } else {
    console.error('生成失败:', result.error);
  }
}

generateImage();
```

### 高级工作流

```typescript
import { SimpleContext, NovelAIApiService, NovelAIConfig } from 'novelai-api';
import * as fs from 'fs';
import * as path from 'path';

// 创建配置
const config: NovelAIConfig = {
  type: 'token',
  token: process.env.NAI_TOKEN || 'your-token-here',
  endpoint: 'https://api.novelai.net',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  textSteps: 28,
};

// 创建上下文和服务
const ctx = new SimpleContext();
const service = new NovelAIApiService(ctx, config);

// 保存图像到文件的帮助函数
async function saveImageToFile(dataUrl: string, filePath: string) {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) throw new Error('Invalid data URL');
  
  const buffer = Buffer.from(matches[2], 'base64');
  const dirName = path.dirname(filePath);
  
  // 确保目录存在
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  
  fs.writeFileSync(filePath, buffer);
  console.log(`图像已保存: ${filePath}`);
  return filePath;
}

// 图像变体生成工作流
async function imageVariationWorkflow(basePrompt: string, variations: number = 3) {
  console.log(`开始生成 ${variations} 个变体, 基础提示词: "${basePrompt}"`);
  const results = [];
  const outputDir = path.join(__dirname, 'variations');
  
  for (let i = 0; i < variations; i++) {
    console.log(`生成变体 ${i+1}/${variations}...`);
    
    // 为每个变体使用不同的随机种子
    const seed = Math.floor(Math.random() * Math.pow(2, 32));
    const result = await service.generateFromText({
      prompt: basePrompt,
      negativePrompt: '模糊，低质量，变形',
      seed
    });
    
    if (result.success) {
      // 保存变体
      const filePath = path.join(outputDir, `variant-${i+1}-seed-${seed}.png`);
      await saveImageToFile(result.imageUrl!, filePath);
      
      // 添加到结果
      results.push({
        seed,
        path: filePath,
        imageUrl: result.imageUrl
      });
    } else {
      console.error(`变体 ${i+1} 生成失败:`, result.error);
    }
  }
  
  return results;
}

// 图像迭代改进工作流
async function imageRefinementWorkflow(initialPrompt: string, iterations: number = 3) {
  console.log(`开始图像迭代改进, 初始提示词: "${initialPrompt}"`);
  const outputDir = path.join(__dirname, 'refinement');
  let currentImage = null;
  
  // 生成初始图像
  const initialResult = await service.generateFromText({
    prompt: initialPrompt,
    negativePrompt: '模糊，低质量，变形'
  });
  
  if (!initialResult.success) {
    console.error('初始图像生成失败:', initialResult.error);
    return null;
  }
  
  // 保存初始图像
  const initialPath = path.join(outputDir, 'initial.png');
  await saveImageToFile(initialResult.imageUrl!, initialPath);
  currentImage = initialResult.imageUrl;
  
  // 迭代改进
  for (let i = 0; i < iterations; i++) {
    console.log(`迭代 ${i+1}/${iterations}...`);
    
    // 每次迭代减少强度，使细节更加精细
    const strength = 0.7 - (i * 0.15);
    
    // 在每次迭代中改进提示词
    const refinedPrompt = `${initialPrompt}, 更加精细的细节, 提高质量`;
    
    const result = await service.generateFromImage(
      currentImage!,
      {
        prompt: refinedPrompt,
        negativePrompt: '模糊，低质量，变形',
        strength: Math.max(0.2, strength), // 确保强度不低于0.2
        steps: 50
      }
    );
    
    if (result.success) {
      // 保存迭代结果
      const iterationPath = path.join(outputDir, `iteration-${i+1}.png`);
      await saveImageToFile(result.imageUrl!, iterationPath);
      currentImage = result.imageUrl;
    } else {
      console.error(`迭代 ${i+1} 失败:`, result.error);
      break;
    }
  }
  
  return currentImage;
}

// 批量图像生成和处理工作流
async function batchProcessingWorkflow(prompts: string[]) {
  console.log(`开始批量处理 ${prompts.length} 个提示词...`);
  const outputDir = path.join(__dirname, 'batch');
  const results = [];
  
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(`处理提示词 ${i+1}/${prompts.length}: "${prompt}"`);
    
    // 生成图像
    const result = await service.generateFromText({
      prompt,
      negativePrompt: '模糊，低质量，变形'
    });
    
    if (result.success) {
      // 保存原始图像
      const originalPath = path.join(outputDir, `original-${i+1}.png`);
      await saveImageToFile(result.imageUrl!, originalPath);
      
      // 处理：从同一图像生成不同风格版本
      const styles = ['油画风格', '水彩风格', '素描风格'];
      const styleResults = [];
      
      for (let j = 0; j < styles.length; j++) {
        const style = styles[j];
        console.log(`  应用风格: ${style}`);
        
        const styleResult = await service.generateFromImage(
          result.imageUrl!,
          {
            prompt: `${prompt}, ${style}`,
            negativePrompt: '模糊，低质量，变形',
            strength: 0.6
          }
        );
        
        if (styleResult.success) {
          const stylePath = path.join(outputDir, `style-${i+1}-${j+1}.png`);
          await saveImageToFile(styleResult.imageUrl!, stylePath);
          styleResults.push({
            style,
            path: stylePath
          });
        }
      }
      
      results.push({
        prompt,
        originalPath,
        styles: styleResults
      });
    } else {
      console.error(`提示词 ${i+1} 处理失败:`, result.error);
    }
  }
  
  return results;
}

async function runWorkflows() {
  try {
    // 运行变体生成工作流
    console.log('=== 开始变体生成工作流 ===');
    const variations = await imageVariationWorkflow('一个梦幻般的城堡在云端, 最佳质量, 超级详细', 3);
    console.log(`生成了 ${variations.length} 个变体\n`);
    
    // 运行迭代改进工作流
    console.log('=== 开始迭代改进工作流 ===');
    const refinedImage = await imageRefinementWorkflow('科幻太空战舰, 壮丽的场景, 太空背景', 3);
    console.log(`迭代改进完成\n`);
    
    // 运行批量处理工作流
    console.log('=== 开始批量处理工作流 ===');
    const prompts = [
      '宁静的森林湖泊, 日出',
      '未来城市的夜景, 霓虹灯',
      '雪山风景, 冬天场景'
    ];
    const batchResults = await batchProcessingWorkflow(prompts);
    console.log(`批量处理完成\n`);
    
    console.log('所有工作流已完成!');
  } catch (error) {
    console.error('工作流执行失败:', error);
  }
}

// 启动所有工作流
runWorkflows();
```

## 常见问题解答

### 一般问题

#### 我需要付费才能使用这个库吗？

这个库本身是免费的，但使用 NovelAI 官方 API 需要一个有效的 NovelAI 账户和足够的点数。您也可以使用以下免费替代方案：

1. 自行部署 Stable Diffusion WebUI (`sd-webui` 类型)
2. 使用 Stable Horde (`stable-horde` 类型)，支持匿名访问
3. 自行部署 NAIFU 或其他兼容服务

#### 如何获取 NovelAI 的授权令牌?

1. 登录 [NovelAI 官网](https://novelai.net)
2. 打开浏览器开发者工具 (按 F12)
3. 在控制台中输入: `console.log(JSON.parse(localStorage.session).auth_token)`
4. 复制输出的令牌

#### 这个库支持哪些平台？

本库可以在任何支持 Node.js 的环境中使用，包括：

- 服务器端应用程序
- 桌面应用程序 (使用 Electron 等)
- 后端 API 服务
- 命令行工具

对于浏览器环境，需要额外处理 CORS 问题，可能需要代理服务。

### 技术问题

#### 为什么图像生成请求超时？

可能的原因包括：

1. 网络连接问题
2. NovelAI 服务负载高
3. 请求超时设置过短
4. 复杂提示词或高分辨率图像需要更长处理时间

解决方案：
- 增加 `requestTimeout` 值 (例如设为 120000 毫秒)
- 检查网络连接
- 使用代理服务器
- 减小图像分辨率或简化提示词

#### 如何处理 CORS 问题？

在浏览器环境中使用时，可能会遇到 CORS 限制。解决方法：

1. 设置代理服务器转发请求
2. 在服务端处理 API 调用
3. 使用支持 CORS 的第三方服务

#### 如何有效管理图像生成历史？

本库提供内置的历史记录管理功能：

```typescript
// 获取最近10条历史记录
const history = service.getHistory('user123', 10);

// 定期清理不需要的历史
await service.clearHistory('user123');

// 使用自定义ID跟踪特定生成
const result = await service.generateFromText({
  prompt: '...',
  userId: 'user123'  // 指定用户ID便于后续检索
});
const itemId = result.parameters?.id;  // 获取生成ID
```

## 性能优化

### 效率提升策略

1. **合理设置步数**：文本到图像通常 28-35 步已足够，过高步数性价比下降
2. **使用合适分辨率**：较小的图像生成更快，可先生成小图再放大
3. **批量请求优化**：使用 Promise.all 并行处理多个请求，但注意设置合理的并发限制
4. **使用图像缓存**：相同参数的重复请求可以缓存结果
5. **优化提示词长度**：过长的提示词不一定产生更好的结果，精简词语可提高效率

### 高级缓存示例

```typescript
class ImageCache {
  private cache: Map<string, string> = new Map();
  private maxSize: number;
  
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }
  
  // 为参数生成缓存键
  private getKey(prompt: string, params: any): string {
    return JSON.stringify({
      p: prompt,
      n: params.negativePrompt || '',
      m: params.model || 'default',
      s: params.sampler,
      st: params.steps,
      se: params.seed,
      sc: params.scale
    });
  }
  
  // 获取缓存的图像
  get(prompt: string, params: any): string | null {
    const key = this.getKey(prompt, params);
    return this.cache.get(key) || null;
  }
  
  // 存储图像到缓存
  set(prompt: string, params: any, imageUrl: string): void {
    const key = this.getKey(prompt, params);
    
    // 如果缓存已满，删除最早项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, imageUrl);
  }
  
  // 清除缓存
  clear(): void {
    this.cache.clear();
  }
  
  // 获取缓存大小
  get size(): number {
    return this.cache.size;
  }
}

// 使用方法
const imageCache = new ImageCache();

async function generateWithCache(service, prompt, params) {
  // 检查缓存
  const cachedImage = imageCache.get(prompt, params);
  if (cachedImage) {
    console.log('使用缓存图像');
    return { success: true, imageUrl: cachedImage, isCached: true };
  }
  
  // 生成新图像
  const result = await service.generateFromText({
    prompt,
    ...params
  });
  
  // 如果生成成功，存入缓存
  if (result.success) {
    imageCache.set(prompt, params, result.imageUrl!);
  }
  
  return result;
}
```

## 扩展与集成

### 与前端框架集成

#### React 集成示例

```jsx
import React, { useState } from 'react';
import { SimpleContext, NovelAIApiService, NovelAIConfig } from 'novelai-api';

// 创建服务
const ctx = new SimpleContext();
const config = { 
  type: 'token', 
  token: process.env.REACT_APP_NAI_TOKEN,
  // ...其他配置 
};
const service = new NovelAIApiService(ctx, config);

function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const generateImage = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await service.generateFromText({
        prompt,
        negativePrompt
      });
      
      if (result.success) {
        setImage(result.imageUrl);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="image-generator">
      <h2>AI 图像生成器</h2>
      
      <div className="form">
        <div className="form-group">
          <label>提示词:</label>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述您想要的图像..."
          />
        </div>
        
        <div className="form-group">
          <label>负面提示词:</label>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="不想在图像中出现的元素..."
          />
        </div>
        
        <button 
          onClick={generateImage}
          disabled={loading || !prompt}
        >
          {loading ? '生成中...' : '生成图像'}
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {image && (
        <div className="result">
          <h3>生成结果</h3>
          <img src={image} alt="AI 生成的图像" />
          <button onClick={() => window.open(image)}>
            查看原图
          </button>
        </div>
      )}
    </div>
  );
}

export default ImageGenerator;
```

#### Node.js API 服务集成

```javascript
const express = require('express');
const { SimpleContext, NovelAIApiService } = require('novelai-api');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 创建 NovelAI 服务
const ctx = new SimpleContext();
const config = {
  type: 'token',
  token: process.env.NAI_TOKEN,
  endpoint: 'https://api.novelai.net',
  model: 'nai-v3'
};
const service = new NovelAIApiService(ctx, config);

// API 端点 - 文本生成图像
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, negativePrompt, ...options } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: '提示词不能为空' });
    }
    
    const result = await service.generateFromText({
      prompt,
      negativePrompt,
      ...options
    });
    
    if (result.success) {
      res.json({ success: true, imageUrl: result.imageUrl });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API 端点 - 图像生成图像
app.post('/api/img2img', async (req, res) => {
  try {
    const { sourceImage, prompt, negativePrompt, ...options } = req.body;
    
    if (!sourceImage || !prompt) {
      return res.status(400).json({ error: '源图像和提示词不能为空' });
    }
    
    const result = await service.generateFromImage(sourceImage, {
      prompt,
      negativePrompt,
      ...options
    });
    
    if (result.success) {
      res.json({ success: true, imageUrl: result.imageUrl });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器在端口 ${PORT} 上运行`);
});
```
