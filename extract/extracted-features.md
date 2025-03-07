# NovelAI 特性提取

本文档介绍了如何使用从 koishi-plugin-novelai 提取的核心功能来构建你自己的 AI 绘图应用。

## 核心组件

提取出的功能主要包含以下几个核心组件：

1. `NovelAIFeatures` - 核心功能类，提供与 NovelAI API 的直接交互
2. `HistoryManager` - 历史记录管理器，用于保存和管理生成历史
3. `NovelAIApiService` - 高级 API 服务，整合了上述组件并提供更友好的接口

## 快速开始

### 基本设置

```typescript
import { Context } from 'koishi'
import { NovelAIApiService } from './src/api-service'
import { Config } from './src/config'

// 创建配置
const config: Config = {
  type: 'token',  // 可选: 'token', 'login', 'sd-webui', 'stable-horde', 'naifu'
  token: 'your-token-here',  // 使用你的 NovelAI token
  endpoint: 'https://api.novelai.net',
  model: 'nai-v3',  // 可选: 'safe', 'nai', 'furry', 'nai-v3'
  sampler: 'k_euler_ancestral',
  textSteps: 28,
  scale: 11,
  resolution: 'portrait',
  // 其他配置...
}

// 创建上下文
const ctx = new Context()

// 初始化服务
const service = new NovelAIApiService(ctx, config)
```

### 文本生成图像 (Text-to-Image)

```typescript
// 基本使用
const result = await service.generateFromText({ 
  prompt: 'a beautiful landscape with mountains and trees',
  negativePrompt: 'ugly, blurry, low quality'
})

if (result.success) {
  console.log('生成成功:', result.imageUrl)
} else {
  console.error('生成失败:', result.error)
}

// 高级选项
const advancedResult = await service.generateFromText({
  prompt: 'a futuristic city with flying cars',
  negativePrompt: 'ugly, blurry, low quality',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  steps: 28,
  scale: 11,
  seed: 12345,
  resolution: 'landscape',
  scheduler: 'karras',
  batchSize: 1,
  userId: 'user123'  // 用于历史记录
})
```

### 图像生成图像 (Image-to-Image)

```typescript
const result = await service.generateFromImage(
  'https://example.com/image.jpg',  // 或 base64 图像数据
  {
    prompt: 'convert to oil painting style',
    strength: 0.7,  // 控制与原图的相似度
    noise: 0.2     // 噪声强度
  }
)

if (result.success) {
  console.log('生成成功:', result.imageUrl)
} else {
  console.error('生成失败:', result.error)
}
```

### 图像增强 (Upscale)

```typescript
const result = await service.enhanceImage(
  'https://example.com/image.jpg',
  {
    scale: 2,  // 放大倍数
    upscaler: 'Lanczos',  // 使用的放大算法
    crop: true  // 是否裁剪
  }
)
```

### 历史记录管理

```typescript
// 获取用户的生成历史
const history = service.getHistory('user123')

// 获取特定历史记录
const item = await service.getHistoryItem('item-id', 'user123')

// 删除历史记录
await service.deleteHistoryItem('item-id', 'user123')

// 清空用户历史
await service.clearHistory('user123')
```

## 可用的模型和采样器

使用服务的辅助方法获取可用选项：

```typescript
// 获取可用模型
const models = service.getAvailableModels()

// 获取可用采样器
const samplers = service.getAvailableSamplers()

// 获取可用调度器
const schedulers = service.getAvailableSchedulers()

// 获取预设分辨率
const resolutions = service.getAvailableResolutions()
```

## 常见问题

### 如何处理 NSFW 内容？

NovelAI 默认允许生成 NSFW 内容。如果需要禁用 NSFW，可以在负面提示词中添加相关过滤词：

```typescript
const result = await service.generateFromText({
  prompt: 'your prompt here',
  negativePrompt: 'nsfw, nudity, explicit content, sexual content'
})
```

### 如何优化生成质量？

1. 调整 steps 参数 (通常 28-50 之间获得较好效果)
2. 调整 scale 参数 (通常 7-15 之间获得较好效果)
3. 使用详细、精确的提示词
4. 使用适当的负面提示词排除不想要的元素

### 如何处理错误？

始终检查 `result.success` 标志，并相应地处理错误：

```typescript
const result = await service.generateFromText({ prompt: 'your prompt' })
if (!result.success) {
  console.error('生成失败:', result.error)
  // 适当地处理错误...
}
```

## 高级用法

### 批量生成

```typescript
async function batchGenerate(prompt, count) {
  const results = []
  for (let i = 0; i < count; i++) {
    const result = await service.generateFromText({
      prompt,
      seed: Math.floor(Math.random() * Math.pow(2, 32)) // 随机种子
    })
    if (result.success) {
      results.push(result.imageUrl)
    }
  }
  return results
}

const images = await batchGenerate('a cute cat', 5)
```

### 自动化工作流

```typescript
async function enhancementWorkflow(prompt) {
  // 先生成初始图像
  const initialResult = await service.generateFromText({ prompt })
  if (!initialResult.success) return null
  
  // 然后增强图像
  const enhancedResult = await service.enhanceImage(
    initialResult.imageUrl,
    { scale: 2 }
  )
  
  return enhancedResult.success ? enhancedResult.imageUrl : null
}

const finalImage = await enhancementWorkflow('beautiful sunset landscape')
```
