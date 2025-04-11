# ImageRegenerationModal 技术文档

## 概述

`ImageRegenerationModal` 是一个用于AI图像生成的React Native组件，支持两种图像生成服务：Animagine 4和NovelAI。该组件为用户提供了一个功能完善的界面，用于自定义和生成角色图像。

## 主要特性

1. 双重图像生成服务支持
   - Animagine 4（默认）
   - NovelAI（需要有效的Token）

2. 灵活的图像尺寸选项
   - 纵向（Portrait）: 832 x 1216
   - 横向（Landscape）: 1216 x 832
   - 正方形（Square）: 1024 x 1024
   - 大幅纵向（Large Portrait）: 1024 x 1536
   - 大幅横向（Large Landscape）: 1536 x 1024

3. 丰富的标签管理功能
   - 正面标签（Positive Tags）
   - 负面标签（Negative Tags）
   - 角色标签（Character Tags）
   - 自定义提示词输入

4. NovelAI特有功能
   - 多角色提示词（Character Prompts）
   - 角色位置控制
   - 高级生成参数设置
   - Seed值管理

5. 图像生成结果管理
   - 预览生成的图像
   - 设置图像用途（头像/背景图）
   - 重新生成选项

## 组件结构

### 主要状态变量

- `imageProvider`: 当前选择的图像生成服务（'animagine4'或'novelai'）
- `positiveTags`/`negativeTags`: 正面和负面标签数组
- `characterTags`: 角色相关标签数组
- `characterPrompts`: NovelAI多角色提示词配置
- `sizePresetId`: 当前选择的图像尺寸预设
- `generationSettings`: 图像生成基本设置
- `novelaiSettings`/`animagine4Settings`: 特定服务的详细设置
- `previewImageUrl`/`generatedImageUrl`: 生成图像的URL

### 主要UI部分

1. **设置面板**
   - 服务选择器（Animagine 4/NovelAI）
   - 尺寸选择器
   - NovelAI设置面板
   - 角色提示词管理（仅NovelAI）
   - Animagine 4设置面板

2. **标签管理**
   - 标签显示区域
   - 标签选择器界面
   - 角色标签选择器
   - 画风参考选择器

3. **预览与结果**
   - 生成图像预览
   - 图像用途开关（头像/背景图）
   - 确认和重新生成按钮

## 使用流程

1. 选择图像生成服务（Animagine 4或NovelAI）
2. 配置图像尺寸
3. 添加标签（通过标签选择器、角色标签选择器或画风参考）
4. NovelAI用户可进一步配置多角色提示词和位置
5. 调整生成参数（如步数、批次大小等）
6. 点击"生成图像"按钮开始生成
7. 预览生成结果，选择是否设为头像或背景图
8. 确认使用或选择重新生成

## 技术实现细节

### 标签处理

标签在提交生成请求前会进行组织和优先级处理：

```javascript
const organizeTagsForPrompt = () => {
  const genderTags = positiveTags.filter(tag => 
    maleGenderTags.includes(tag) || femaleGenderTags.includes(tag)
  );
  
  const qualityTags = DEFAULT_POSITIVE_PROMPTS;
  
  const normalTags = positiveTags.filter(tag => 
    !maleGenderTags.includes(tag) && !femaleGenderTags.includes(tag)
  );

  const ratingTag = imageProvider === 'animagine4' ? "safe" : null;
  
  const artistTag = selectedArtistPrompt && useExistingArtistPrompt ? 
    (imageProvider === 'animagine4' ? cleanArtistTag(selectedArtistPrompt) : selectedArtistPrompt) 
    : null;
  
  return {
    genderTags,
    characterTags,
    artistTag,
    ratingTag,
    normalTags,
    qualityTags
  };
};
```

### NovelAI多角色提示词

NovelAI支持在图像中生成多个角色，每个角色可以有自己的提示词和位置：

```javascript
// 转换角色提示词为NovelAIService所需格式
const getCharacterPromptsData = (): CharacterPromptData[] => {
  return characterPrompts.map(char => ({
    prompt: char.prompt,
    positions: [char.position]
  }));
};
```

### 图像生成流程

根据选择的服务，组件会调用不同的生成方法：

1. **NovelAI生成流程**
   - 验证Token
   - 构建提示词
   - 调用NovelAIService.generateImage
   - 处理返回的图像结果

2. **Animagine 4生成流程**
   - 验证许可证
   - 构建提示词
   - 向服务器发送生成请求
   - 轮询任务状态，直到完成或失败

### 标签选择器集成

组件集成了三种标签选择器：

1. **TagSelector**: 用于浏览和选择通用标签
2. **CharacterTagSelector**: 用于选择预定义角色相关标签
3. **ArtistReferenceSelector**: 用于选择艺术风格参考

### 错误处理

组件实现了完整的错误处理机制，包括：

- 服务API调用错误
- Token或许可证验证错误
- 任务状态检查错误
- 图像生成失败错误

## 最佳实践与使用建议

1. **标签选择**:
   - 至少添加一个外观描述标签
   - 适当使用角色标签增强角色特征
   - 负面标签用于排除不需要的元素

2. **NovelAI技巧**:
   - 使用多角色提示词可以更精确控制图像生成
   - 保存有效的Seed值以便后续使用和调整
   - 调整提示词相关性（scale）可以控制提示词的影响程度

3. **Animagine 4技巧**:
   - 步数20-30通常可获得最佳结果
   - 批次大小越大生成的图像变体越多，但消耗更多积分

## 拓展和自定义

该组件设计为可扩展的，可以通过以下方式进行增强：

1. 添加新的图像服务提供商
2. 扩展标签选择器的功能
3. 增加更多图像尺寸预设
4. 实现更多高级生成参数配置

## 潜在改进方向

1. 实现图像编辑功能（如局部重绘）
2. 添加保存多个生成结果的功能
3. 实现风格迁移和参考图像上传
4. 添加批量生成和排队功能
5. 集成更多AI模型和服务
