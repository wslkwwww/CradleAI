# NovelAI API 测试使用说明

本文档将指导您如何测试和使用提取的 NovelAI 功能库，该库无需依赖 Koishi 框架即可在任何 Node.js 应用程序中使用。

## 目录

1. [准备工作](#准备工作)
2. [环境配置](#环境配置)
3. [功能测试](#功能测试)
4. [参数说明](#参数说明)
5. [故障排除](#故障排除)
6. [高级用法](#高级用法)

## 准备工作

### 必要条件

- Node.js 16.x 或更高版本
- npm 或 yarn 包管理器
- 有效的 NovelAI 账户或 API 令牌
- 良好的网络环境（可能需要代理）

### 安装依赖

首先，在你的项目中安装必要的依赖：

```bash
npm install axios libsodium-wrappers-sumo image-size adm-zip dotenv
# 或使用 yarn
yarn add axios libsodium-wrappers-sumo image-size adm-zip dotenv
```

## 环境配置

### 创建环境变量文件

在项目根目录创建 `.env` 文件，填入以下内容：

```ini
# 必须配置项
# 认证方式: token（令牌）, login（账号密码）, sd-webui, stable-horde, naifu
NAI_TYPE=token

# 认证信息（根据认证方式选择其一）
# 如果使用令牌方式（推荐）
NAI_TOKEN=您的NovelAI令牌

# 如果使用账号密码方式
NAI_EMAIL=您的NovelAI邮箱
NAI_PASSWORD=您的NovelAI密码

# 接口设置
NAI_ENDPOINT=https://api.novelai.net
NAI_API_ENDPOINT=https://api.novelai.net

# 生成参数设置
NAI_MODEL=nai-v3           # 可选: safe, nai, furry, nai-v3, nai-v4-curated-preview, nai-v4-full
NAI_SAMPLER=k_euler_ancestral
NAI_TEXT_STEPS=28
NAI_IMAGE_STEPS=50
NAI_SCALE=11
NAI_STRENGTH=0.7
NAI_NOISE=0.2
NAI_REQUEST_TIMEOUT=60000  # 单位：毫秒
```

### 获取 NovelAI 认证令牌（Token）

如果选择使用令牌认证方式（推荐），需要获取 NovelAI 的认证令牌：

1. 在浏览器中登录 [NovelAI 官网](https://novelai.net)
2. 打开浏览器开发者工具（按 F12 或右键点击"检查"）
3. 切换到 Console（控制台）标签
4. 输入并执行以下命令：
   ```javascript
   console.log(JSON.parse(localStorage.session).auth_token)
   ```
5. 复制输出的令牌字符串到 `.env` 文件中的 `NAI_TOKEN` 字段

## 功能测试

本项目提供了一个完整的示例应用，位于 `examples/standalone-app.ts`。可以通过以下步骤运行此示例：

### 1. 编译 TypeScript 文件

首先编译所有的 TypeScript 文件：

```bash
# 如果已全局安装 TypeScript
tsc

# 或使用项目本地的 TypeScript
npx tsc
```

### 2. 运行示例应用

```bash
node dist/extract/examples/standalone-app.js
```

### 3. 查看生成结果

示例程序会在 `examples/output` 目录下生成三种类型的图像：

- `text2image-*.png`: 文字生成的图像
- `image2image-*.png`: 基于第一张图像生成的新图像
- `enhanced-*.png`: 增强后的图像（仅在 `sd-webui` 后端可用）

## 参数说明

本库支持所有原始需求中描述的参数，下面是主要参数的详细说明：

### 文本生成图像的参数

| 参数 | 类型 | 描述 | 建议值 |
|-----|------|-----|--------|
| prompt | string | 正向提示词，描述您想要的图像内容 | 越详细越具体越好 |
| negativePrompt | string | 负向提示词，描述您不想在图像中出现的内容 | "模糊, 扭曲, 低质量, 像素化, 简笔画" |
| model | string | 使用的模型 | "nai-v3", "safe", "nai", "furry" 等 |
| sampler | string | 采样器，不同采样器会产生不同效果 | "k_euler_ancestral", "ddim" 等 |
| steps | number | 生成步数，影响质量和细节 | 文生图:28-40, 图生图:50+ |
| scale | number | 提示词相关性，值越高越符合提示词 | 7-15 |
| seed | number | 随机种子，相同种子+参数会产生相似结果 | 随机或指定 |
| resolution | object/string | 图像分辨率 | "portrait", "landscape", "square" |

### 图像生成图像的额外参数

| 参数 | 类型 | 描述 | 建议值 |
|-----|------|-----|--------|
| strength | number | 转换强度，值越低越接近原图 | 0.3-0.8 |
| noise | number | 噪声强度，影响细节变化 | 0.1-0.4 |

### 图像增强的参数

| 参数 | 类型 | 描述 | 建议值 |
|-----|------|-----|--------|
| scale | number | 放大倍数 | 2-4 |
| upscaler | string | 使用的放大算法 | "Lanczos", "ESRGAN_4x" 等 |
| crop | boolean | 是否裁剪图像 | true/false |

## 故障排除

### 常见错误与解决方案

| 错误 | 可能原因 | 解决方法 |
|-----|---------|---------|
| 认证失败 | 令牌无效或过期 | 重新获取令牌，确保填入正确 |
| 生成超时 | 网络问题或服务器繁忙 | 增加 `requestTimeout` 值，检查网络连接 |
| 图像生成失败 | 提示词问题、服务限制 | 简化提示词，检查账户点数是否足够 |
| 网络连接问题 | 服务器不可达、防火墙阻拦 | 配置代理，确保网络通畅 |

### 网络代理设置

如果您在中国大陆或其他需要代理才能访问 NovelAI 的地区，可以通过以下方式配置代理：

1. 安装 `https-proxy-agent` 库：
   ```bash
   npm install https-proxy-agent
   ```

2. 修改实例化 `SimpleContext` 的代码，添加代理设置：
   ```typescript
   import { HttpsProxyAgent } from 'https-proxy-agent';

   // 创建代理
   const agent = new HttpsProxyAgent('http://127.0.0.1:7890');
   
   // 修改 axios 实例配置，添加代理参数
   axios.defaults.httpsAgent = agent;
   axios.defaults.proxy = false; // 必须设置为 false
   ```

## 高级用法

### 1. 批量生成图像

```typescript
async function batchGenerate(service, prompt, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = await service.generateFromText({
      prompt,
      seed: Math.floor(Math.random() * Math.pow(2, 32))
    });
    
    if (result.success) {
      results.push(result.imageUrl);
    }
  }
  return results;
}

// 使用方式
const images = await batchGenerate(service, '美丽的风景', 5);
```

### 2. 创建图像处理工作流

```typescript
async function enhancementWorkflow(service, prompt) {
  // 第一步：文本生成图像
  const textResult = await service.generateFromText({
    prompt,
    steps: 35,
    scale: 12
  });
  
  if (!textResult.success) return null;
  
  // 第二步：图像生成图像，调整细节
  const imgResult = await service.generateFromImage(
    textResult.imageUrl,
    {
      prompt: prompt + ', 增加细节, 高质量',
      strength: 0.4
    }
  );
  
  if (!imgResult.success) return textResult.imageUrl;
  
  // 第三步：图像增强（如果支持）
  if (config.type === 'sd-webui') {
    const enhanceResult = await service.enhanceImage(
      imgResult.imageUrl,
      { scale: 2 }
    );
    
    return enhanceResult.success ? enhanceResult.imageUrl : imgResult.imageUrl;
  }
  
  return imgResult.imageUrl;
}

// 使用方式
const finalImage = await enhancementWorkflow(service, '未来城市, 科幻风格');
```

### 3. 提示词优化

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

---

希望本指南能帮助您充分利用 NovelAI API 提取库的功能。如有问题，请参考源码或联系开发者。
