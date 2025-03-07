# NovelAI API 提取库

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

这是一个从 [koishi-plugin-novelai](https://github.com/koishijs/novelai-bot) 中提取的独立 NovelAI API 库，无需依赖 Koishi 框架即可在任何 Node.js 应用程序中使用。

## 特性

该库提供了以下核心功能：

- **文本生成图像**：根据文字描述生成图像
- **图像生成图像**：修改和转换已有图像
- **图像增强**：放大并优化图像质量（仅支持 SD-WebUI 后端）
- **灵活的后端支持**：
  - NovelAI 官方 API
  - Stable Diffusion WebUI
  - NAI Diffusion (NAIFU)
  - Stable Horde
- **历史管理**：自动保存生成记录
- **高级参数控制**：详细控制生成过程中的各种参数

## 安装

```bash
npm install novelai-api
# 或使用 yarn
yarn add novelai-api
```

## 快速开始

以下是一个简单的使用示例：

```typescript
import { SimpleContext, NovelAIApiService } from 'novelai-api';

// 创建配置
const config = {
  type: 'token',
  token: 'your-token-here', // 替换为你的 NovelAI token
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  textSteps: 28,
  scale: 11,
};

// 创建上下文和服务
const ctx = new SimpleContext();
const service = new NovelAIApiService(ctx, config);

// 生成图像
async function generateImage() {
  const result = await service.generateFromText({
    prompt: '美丽的风景，有山脉和湖泊，最佳质量，超级详细',
    negativePrompt: '模糊，低质量，变形'
  });
  
  if (result.success) {
    console.log('生成成功:', result.imageUrl);
    // 处理生成的图像...
  } else {
    console.error('生成失败:', result.error);
  }
}

generateImage();
```

## 功能示例

### 文本生成图像 (Text-to-Image)

```typescript
const result = await service.generateFromText({
  prompt: '一只可爱的猫咪，坐在窗台上，看着窗外的雨',
  negativePrompt: '模糊，低质量，变形',
  model: 'nai-v3',
  sampler: 'k_euler_ancestral',
  steps: 28,
  scale: 11,
  seed: 12345,      // 可选：指定种子，确保可重复的结果
  resolution: 'portrait',  // 或 'landscape', 'square'
});
```

### 图像生成图像 (Image-to-Image)

```typescript
const result = await service.generateFromImage(
  'https://example.com/input-image.jpg',  // 或本地文件路径、Base64 数据
  {
    prompt: '将图像转换为油画风格',
    negativePrompt: '模糊，低质量',
    strength: 0.7,  // 控制与原图的相似度 (0.0-1.0)
    noise: 0.2     // 噪声强度 (0.0-1.0)
  }
);
```

### 图像增强 (Image Enhancement)

```typescript
// 仅支持 SD-WebUI 后端
const result = await service.enhanceImage(
  'https://example.com/image.jpg',
  {
    scale: 2,       // 放大倍数
    upscaler: 'ESRGAN_4x',  // 使用的放大算法
    crop: false     // 是否裁剪
  }
);
```

### 历史记录管理

```typescript
// 获取历史记录
const history = service.getHistory('user123', 10);  // 获取用户的最近10条历史

// 获取特定记录
const item = await service.getHistoryItem('record-id', 'user123');

// 删除历史记录
await service.deleteHistoryItem('record-id', 'user123');
```

## 支持的后端

### 1. NovelAI 官方 API

```typescript
const config = {
  type: 'token',  // 或 'login'
  token: 'your-token-here',  // 或提供 email 和 password
  endpoint: 'https://api.novelai.net',
  apiEndpoint: 'https://api.novelai.net',
  model: 'nai-v3',
};
```

### 2. Stable Diffusion WebUI

```typescript
const config = {
  type: 'sd-webui',
  endpoint: 'http://127.0.0.1:7860',
  sampler: 'Euler a',
};
```

### 3. Stable Horde

```typescript
const config = {
  type: 'stable-horde',
  token: 'your-api-key',  // 0000000000 表示匿名访问
  endpoint: 'https://stablehorde.net/',
  model: 'stable_diffusion_2.1', // 选择模型
};
```

### 4. NAI Diffusion (NAIFU)

```typescript
const config = {
  type: 'naifu',
  endpoint: 'http://your-naifu-server:6969',
  token: 'optional-token',
};
```

## 配置参数

完整的配置参数列表：

| 参数 | 类型 | 描述 | 默认值 |
|-----|-----|------|-------|
| type | string | 认证方式 | 'token' |
| token | string | NovelAI 认证令牌 | - |
| email | string | NovelAI 账号邮箱 | - |
| password | string | NovelAI 账号密码 | - |
| endpoint | string | API 服务器地址 | 'https://api.novelai.net' |
| apiEndpoint | string | API 服务器地址 | 'https://api.novelai.net' |
| model | string | 默认模型 | 'nai-v3' |
| sampler | string | 默认采样器 | 'k_euler_ancestral' |
| textSteps | number | 文生图默认步数 | 28 |
| imageSteps | number | 图生图默认步数 | 50 |
| scale | number | 默认服从度 | 11 |
| strength | number | 默认重绘强度 | 0.7 |
| noise | number | 默认噪声强度 | 0.2 |
| headers | object | 额外请求头 | {} |
| requestTimeout | number | 请求超时 (ms) | 60000 |
| pollInterval | number | 轮询间隔 (ms) | 1000 |
| trustedWorkers | boolean | 是否只用信任节点 | false |
| nsfw | string | NSFW 内容选项 | 'allow' |

## 详细文档

请参阅 [测试使用说明](./docs/test-instructions.md) 获取更详细的使用指导。

## 从 Koishi 插件迁移

如果您之前使用 koishi-plugin-novelai，可以参考以下对照表迁移您的代码：

| Koishi 插件 | 独立库 |
|------------|-------|
| `ctx.command('novelai').action()` | `service.generateFromText()` |
| `session.text('.waiting')` | 自行处理等待提示 |
| `ctx.http.post()` | 已内置，无需手动处理 |
| `Config.token` | `config.token` |

## 许可证

本项目使用 [MIT](LICENSE) 许可证。

## 致谢

- [koishi-plugin-novelai](https://github.com/koishijs/novelai-bot) - 原始代码来源
- [NovelAI](https://novelai.net/) - API 服务提供者
