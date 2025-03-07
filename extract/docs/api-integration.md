# NovelAI API 集成指南

本文档提供了如何在您的应用程序中集成 NovelAI API 提取库的详细指导。

## 目录

1. [基本设置](#基本设置)
2. [文本生成图像](#文本生成图像)
3. [图像生成图像](#图像生成图像)
4. [图像增强](#图像增强)
5. [历史记录管理](#历史记录管理)
6. [模型和参数](#模型和参数)
7. [错误处理](#错误处理)
8. [完整应用示例](#完整应用示例)

## 基本设置

首先，您需要初始化 API 服务：

```typescript
import { SimpleContext, NovelAIApiService, NovelAIConfig } from 'novelai-api';

// 配置
const config: NovelAIConfig = {
  type: 'token',  // 'token', 'login', 'sd-webui', 'stable-horde', 或 'naifu'
  token: 'your-token-here',  // 如果使用 token 认证
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

// 创建上下文
const ctx = new SimpleContext();

// 初始化 API 服务
const service = new NovelAIApiService(ctx, config);
```

## 文本生成图像

使用提示词从文本生成图像：

```typescript
// 基本使用
const result = await service.generateFromText({
  prompt: '美丽的风景，山脉和湖泊，4K高清'
});

if (result.success) {
  console.log('生成成功:', result.imageUrl);
  // 处理生成的图像...
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

## 图像生成图像

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

if (result.success) {
  // 处理生成的图像...
  console.log('生成成功:', result.imageUrl);
}
```

## 图像增强

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

## 历史记录管理

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

## 模型和参数

获取可用的模型和参数：

```typescript
// 获取可用模型
const models = service.getAvailableModels();
console.log('可用模型:', models);

// 获取可用采样器
const samplers = service.getAvailableSamplers();
console.log('可用采样器:', samplers);

// 获取可用调度器
const schedulers = service.getAvailableSchedulers();
console.log('可用调度器:', schedulers);

// 获取预设分辨率
const resolutions = service.getAvailableResolutions();
console.log('预设分辨率:', resolutions);
```

## 错误处理

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
      default:
        console.error('生成失败:', result.error);
    }
  }
} catch (error) {
  // 处理未预期的错误
  console.error('发生异常:', error);
}
```

## 完整应用示例

以下是一个完整的图像生成应用示例：

```typescript
import { SimpleContext, NovelAIApiService, NovelAIConfig } from 'novelai-api';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // 初始化配置
  const config: NovelAIConfig = {
    type: 'token',
    token: process.env.NAI_TOKEN,
    endpoint: 'https://api.novelai.net',
    model: 'nai-v3',
    sampler: 'k_euler_ancestral',
    textSteps: 28,
  };
  
  // 创建API服务
  const ctx = new SimpleContext();
  const service = new NovelAIApiService(ctx, config);
  
  // 创建输出目录
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 生成图像
  console.log('生成图像中...');
  const result = await service.generateFromText({
    prompt: '一只可爱的猫咪在窗台上，阳光照射进来，高质量，精细细节',
    negativePrompt: '模糊，低质量，变形'
  });
  
  if (result.success) {
    // 保存图像
    const outputPath = path.join(outputDir, `cat-${Date.now()}.png`);
    const dataUrl = result.imageUrl;
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
    console.log(`图像已保存至: ${outputPath}`);
    
    // 增强图像
    if (config.type === 'sd-webui') {
      console.log('增强图像中...');
      const enhanceResult = await service.enhanceImage(
        dataUrl,
        { scale: 2 }
      );
      
      if (enhanceResult.success) {
        const enhancedPath = path.join(outputDir, `cat-enhanced-${Date.now()}.png`);
        const enhancedBase64 = enhanceResult.imageUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(enhancedPath, Buffer.from(enhancedBase64, 'base64'));
        console.log(`增强图像已保存至: ${enhancedPath}`);
      }
    }
    
    // 查看历史记录
    const history = service.getHistory();
    console.log(`生成历史: ${history.length} 条记录`);
  } else {
    console.error('生成失败:', result.error);
  }
}

main().catch(console.error);
```

## 类型化使用

如果您需要严格类型检查，可以使用 `NovelAIAPI` 接口：

```typescript
import { NovelAIAPI, NovelAIApiService, SimpleContext, NovelAIConfig } from 'novelai-api';

// 创建具有类型定义的 API 服务
const config: NovelAIConfig = { /* 配置... */ };
const ctx = new SimpleContext();
const service: NovelAIAPI = new NovelAIApiService(ctx, config);

// 现在可以使用完全类型化的 API
const result = await service.generateFromText({
  prompt: '一个美丽的风景'
  // TypeScript 会提供完整的类型检查和自动完成
});
```

有关更多详情，请参阅 API 规范文档和类型定义。
