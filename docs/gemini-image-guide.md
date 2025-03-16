```markdown
# Gemini 图像生成与编辑指南

本文档提供了使用 GeminiAdapter 进行图像生成、分析和编辑的完整指南。Gemini 2.0 Flash Experimental 模型支持多种图像操作，包括文本到图像生成、图像分析和图像编辑。

## 目录

1. [配置 GeminiAdapter](#配置-geminiadapter)
2. [图像生成](#图像生成)
3. [图像分析](#图像分析)
4. [图像编辑](#图像编辑)
5. [多模态内容](#多模态内容)
6. [处理图像数据](#处理图像数据)
7. [高级用法](#高级用法)
8. [常见问题](#常见问题)

## 配置 GeminiAdapter

首先，需要初始化 GeminiAdapter 实例，并提供有效的 API 密钥：

```typescript
import { GeminiAdapter } from '@/NodeST/nodest/utils/gemini-adapter';

// 初始化适配器
const apiKey = 'YOUR_GEMINI_API_KEY';  // 从环境变量或安全存储获取
const geminiAdapter = new GeminiAdapter(apiKey);
```

## 图像生成

### 基本图像生成

使用文本提示生成图像：

```typescript
// 生成图像的简单示例
const images = await geminiAdapter.generateImage(
  "一只穿着太空服的猫在月球表面",
  { temperature: 0.8 }
);

if (images && images.length > 0) {
  // 处理生成的图像（Base64 格式）
  const imageData = images[0];
  // 转换为带有数据 URL 前缀的格式以便在 <Image> 组件中显示
  const imageUrl = `data:image/jpeg;base64,${imageData}`;
  
  // 在 React Native 中显示
  return <Image source={{uri: imageUrl}} style={{width: 300, height: 300}} />
}
```

### 参数配置

`generateImage` 方法接受以下参数：

- `prompt`: 字符串 - 描述要生成的图像
- `options`: 对象（可选）
  - `temperature`: 数字（0.0 - 1.0）- 控制随机性，较高值产生更有创意的结果
  - `referenceImages`: 图像输入数组 - 用于指导生成（用于图像变换）

## 图像分析

分析图像并获取文本描述：

```typescript
// 分析本地图像
const base64ImageData = "..."; // 不含数据 URL 前缀的 base64 数据
const response = await geminiAdapter.analyzeImage(
  {
    data: base64ImageData,
    mimeType: 'image/jpeg'
  },
  "描述这张图片中的内容，并关注细节"
);
console.log("图像分析结果:", response);

// 分析网络图像
const urlResponse = await geminiAdapter.analyzeImage(
  { url: "https://example.com/image.jpg" },
  "描述这张图片中的人物表情"
);
```

## 图像编辑

### 基本图像编辑

编辑现有图像：

```typescript
// 编辑图像示例
const editedImageData = await geminiAdapter.editImage(
  { 
    data: base64ImageData,  // 不含前缀的 base64 数据
    mimeType: 'image/jpeg'
  },
  "将背景改成蓝色海滩",
  { temperature: 0.8 }
);

if (editedImageData) {
  // 处理编辑后的图像
  const editedImageUrl = `data:image/jpeg;base64,${editedImageData}`;
}
```

### 从 URL 编辑图像

```typescript
// 编辑网络图像
const editedFromUrl = await geminiAdapter.editImage(
  { url: "https://example.com/person.jpg" },
  "将人物的衣服颜色改成红色",
);

if (editedFromUrl) {
  // 使用编辑后的图像
}
```

## 多模态内容

生成包含文本和图像的复杂内容：

```typescript
// 生成包含文本和图像的内容
const result = await geminiAdapter.generateMultiModalContent(
  "创建一篇短文，介绍三种咖啡制作方法，并配上图示",
  { includeImageOutput: true }
);

if (result.text) {
  console.log("生成的文本:", result.text);
}

if (result.images && result.images.length > 0) {
  // 处理生成的图像
}
```

## 处理图像数据

### 图像输入格式

GeminiAdapter 支持多种图像输入格式：

1. **Base64 数据**：
```typescript
const imageInput = {
  data: "base64EncodedDataWithoutPrefix",
  mimeType: "image/jpeg" // 或 image/png, image/gif 等
};
```

2. **图像 URL**：
```typescript
const imageInput = {
  url: "https://example.com/image.jpg"
};
```

### 从设备相册获取图像

配合 Expo 的 ImagePicker 获取并处理图像：

```typescript
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// 选择图像
const pickImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('需要权限', '需要照片库访问权限才能选择图片');
    return;
  }
  
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
    base64: true,
  });
  
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const selectedAsset = result.assets[0];
    
    // 压缩和调整图像大小
    const manipResult = await manipulateAsync(
      selectedAsset.uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: SaveFormat.JPEG, base64: true }
    );
    
    // 准备 base64 数据
    const base64Data = manipResult.base64;
    
    // 用于预览
    const previewUrl = `data:image/jpeg;base64,${base64Data}`;
    
    // 用于 Gemini API (不含前缀)
    return {
      data: base64Data,
      mimeType: 'image/jpeg'
    };
  }
};
```

## 高级用法

### 多轮图像编辑

实现多轮编辑会话：

```typescript
// 第一轮编辑
let currentImage = await geminiAdapter.editImage(
  originalImageInput,
  "将图片转换为卡通风格"
);

// 第二轮编辑基于第一轮结果
if (currentImage) {
  currentImage = await geminiAdapter.editImage(
    { data: currentImage, mimeType: 'image/jpeg' },
    "添加一顶红色帽子到人物头上"
  );
}

// 第三轮编辑继续修改
if (currentImage) {
  currentImage = await geminiAdapter.editImage(
    { data: currentImage, mimeType: 'image/jpeg' },
    "将背景改为夜空与星星"
  );
}
```

### 提示词优化技巧

为获得最佳结果，可以遵循以下提示词技巧：

1. **详细具体**：提供清晰详细的描述，包括颜色、样式、构图等
2. **指定风格**：明确艺术风格，如"照片写实"、"动漫风格"、"油画风格"
3. **参考艺术家**：可以提及特定艺术家的风格（"类似莫奈的印象派风格"）
4. **结构化编辑指令**：对于编辑任务，提供明确的"从/到"指令

例如，优化的提示词：
```
"生成一张日落时分的海滩图片，有棕榈树剪影，天空呈现渐变的橙红色和紫色。风格类似于现代数字插画，有清晰的线条和鲜艳的色彩。"
```

## 常见问题

### Q: 为什么我的图像生成请求失败？

A: 可能的原因包括：
- API 密钥无效或过期
- 提示词可能包含不适当内容
- 请求超出配额
- 网络连接问题

检查控制台错误信息，确保 API 密钥有效且提示词适当。

### Q: 为什么生成的图像质量不高？

A: 尝试以下方法：
- 提供更具体的提示词
- 调整 temperature 参数（0.7-0.9 通常效果较好）
- 使用参考图像引导生成
- 指定明确的分辨率和艺术风格

### Q: 图像编辑没有按预期工作？

A: 编辑功能依赖于 Gemini 理解原始图像和编辑指令。尝试：
- 使用更明确的编辑指令
- 确保原始图像清晰、分辨率适中
- 尝试渐进式编辑（多步小改动而非一次大改动）

### Q: 如何处理大图像？

A: Gemini 对输入图像大小有限制。最佳实践是：
- 使用 `manipulateAsync` 将图像缩小到 1024px 宽度
- 使用 0.7-0.8 的压缩率平衡质量和大小
- 避免发送超过 10MB 的图像

## 更多资源

- [Gemini 官方 API 文档](https://ai.google.dev/docs/gemini_api)
- [提示词工程最佳实践](https://ai.google.dev/docs/prompt_best_practices)
```
