# 摇篮系统 (Cradle System) 文档

## 更新日志

**2023-07-01: 初始版本**
- 创建前端UI界面
- 定义基础数据结构

**2023-08-15: 版本更新**
- 实现角色生成器核心功能
- 集成Gemini LLM
- 完成投喂类型分类功能
- 实现消息队列处理机制

**2023-10-20: OpenRouter集成及UI优化**
- 集成OpenRouter API支持，扩展LLM选项
- 重新设计摇篮培育详情展示区，支持背景图片
- 改进角色选择交互，实现角色选择与详情联动
- 优化键盘处理，解决页面偏移问题
- 修复角色列表刷新和投喂计数更新问题


#### 图片访问方式更新
- 将角色导入到摇篮时，头像和背景图像都会被下载并保存在本地。
- 当图像由图像生成服务生成时，它们也会被保存在本地。
- 轮播组件正确地优先使用本地图像，而不是远程图像。

#### CradleCreateForm 组件更新
- 修复了创建角色时的数据结构，确保所有必要字段都正确初始化
- 增强了日志记录，便于调试图像生成过程
- 优化了角色创建后的页面导航逻辑

#### CharactersContext 更新
- 完善了`addCradleCharacter`和`updateCradleCharacter`方法
- 确保角色数据完整性和正确的状态管理
- 增强了日志记录和错误处理

#### Cradle 页面更新
- 改进了`checkImageGenerationStatus`函数，正确处理图像生成状态
- 添加了周期性刷新机制，确保UI反映最新状态
- 增加了`refreshCharacterCards`函数，强制更新角色卡片显示

#### 类型定义更新
- 完善了`CradleCharacter`类型定义，添加了图像生成相关字段
- 确保类型安全和一致性

### 测试结果
- 创建摇篮角色后，角色卡片立即显示在摇篮页面
- 图像生成完成后，角色卡片背景自动更新
- 生成的图像正确更新角色的backgroundImage属性

## 概述

摇篮系统是一种创新的AI角色生成机制，通过让用户在一段时间内"投喂"数据给未成熟的角色，来培育和塑造具有独特个性的AI角色。与传统的直接创建角色方法相比，摇篮系统能够形成更加丰富、自然且个性化的角色设定。

## 核心概念

### 摇篮培育周期

摇篮系统基于培育周期概念，用户可以设置1-30天的培育周期。培育期间，角色处于"成长"状态，通过用户提供的各类数据逐渐形成自己的个性和知识库。

### 角色成熟阶段

角色培育分为三个阶段：
- **孵化期 (Egg)**: 初始阶段，角色个性尚未形成
- **成长期 (Growing)**: 正在吸收和处理投喂的数据
- **成熟期 (Mature)**: 角色个性已经形成，准备"毕业"为正式角色

### 数据投喂

用户可以投喂多种类型的数据：
- **关于我类型**: 角色的基本设定、背景故事、性格特点等
- **知识类型**: 角色应该掌握的专业知识、常识、观点等
- **素材类型**: 参考材料、灵感来源、文化背景等
- **文本类型**: 一般文本内容，将被分类处理
- **图片类型**: 图片数据（需要可用的视觉模型支持）
- **语音类型**: 语音数据（需要可用的语音模型支持）

## 文件结构

摇篮系统的实现涉及以下文件：

```
/f:/my-app/
├── app/
│   ├── (tabs)/
│   │   └── cradle.tsx              // 摇篮系统主页面
│   ├── pages/
│   │   ├── create_char.tsx  // 角色创建页面，包括常规角色和摇篮角色
│   │   └── CradleCreateForm.tsx // 摇篮角色创建页面（包含摇篮标签页）
├── components/
│   ├── CradleCreateForm.tsx        // 摇篮角色创建表单组件，包括向服务器请求图片生成的功能
│   ├── CradleFeedModal.tsx         // 摇篮数据投喂模态框
│   ├── CradleSettings.tsx          // 摇篮系统设置组件
│   ├── CradleApiSettings.tsx       // 新增 - 摇篮API设置组件
│   └── ImportToCradleModal.tsx     // 导入现有角色到摇篮系统组件
│   └── ImageRegenerationModal.tsx     // 为角色重新生成图片的组件
│   └── CharacterEditDialog.tsx     // 通过对话更改角色设定的组件
│   └── ImageEditorModal.tsx     // 角色图片编辑组件 
│   └── CradleCharacterDetail.tsx     // 角色图库编辑组件
├── constants/
│   ├── types.ts                    // 摇篮系统相关类型定义
│   └── CharactersContext.tsx       // 包含摇篮系统的业务逻辑和数据管理
├── shared/
│   ├── types.ts                    // 摇篮角色的定义，继承自常规角色
│   └── types/
│       └── api-types.ts           // 新增 - API相关类型定义
├── NodeST/nodest/
│   ├── services/
│   │   ├── character-generator-service.ts // 角色生成器服务
│   │   ├── cradle-service.ts            // 摇篮系统核心服务
│   │   └── prompt-builder-service.ts    // 提示词构建服务
│   ├── utils/
│   │   ├── gemini-adapter.ts           // Gemini API适配器
│   │   ├── openrouter-adapter.ts       // 新增 - OpenRouter API适配器
│   │   └── openrouter-model-manager.ts // 新增 - OpenRouter模型管理器
│   └── types/
│       └── types.ts                    // NodeST相关类型定义
├── assets/
│   └── images/
│       └── default-cradle-bg.jpg       // 新增 - 默认摇篮背景图
├── docs/
│   ├── cradle-system.md                // 摇篮系统开发文档
│   ├── cradle-requirement.md           // 摇篮系统需求文档
│   └── issue.md                        // 问题追踪和修复文档
├── tests/
│   └── cradle-service.test.ts          // 摇篮服务测试
```

## 核心类型定义

摇篮系统的核心数据结构定义在 `shared/types.ts` 和 `constants/types.ts` 中：

### CradleSettings

```typescript
interface CradleSettings {
  enabled: boolean;         // 摇篮系统是否启用
  duration: number;         // 培育周期（天）
  startDate?: string;       // 开始培育日期
  progress?: number;        // 培育进度（百分比）
  lastInterruption?: string; // 上次中断时间
  cradleConversationId?: string; // 关联的会话ID
}
```

### Feed

```typescript
interface Feed {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image' | 'aboutMe'| 'material'| 'knowledge'; // 投喂类型
  timestamp: number;                // 时间戳
  processed: boolean;               // 是否已处理
}
```

### FeedType (角色生成器专用)

```typescript
enum FeedType {
  ABOUT_ME = "aboutMe",     // 关于我的信息
  MATERIAL = "material",    // 素材信息
  KNOWLEDGE = "knowledge"   // 知识信息
}
```

### CradleCharacter

```typescript
interface CradleCharacter extends Omit<Character, 'backgroundImage'> {
  feedHistory: Feed[];             // 投喂历史
  inCradleSystem: boolean;         // 是否在摇篮系统中
  isCradleGenerated?: boolean;     // 是否由摇篮生成的角色
  cradleAnimation?: CradleAnimation;
  importedFromCharacter?: boolean; // 是否从常规角色导入
  importedCharacterId?: string;    // 导入来源的角色ID
  initialSettings?: {              // 初始设定
    axis?: {...};                  // 性格坐标轴
    sliders?: {...};               // 属性滑块
    reference?: string;            // 参考角色ID
    description?: string;          // 描述
  };
  cradle?: {                       // 摇篮特定数据
    startDate?: string;
    progress?: number;
    stage?: 'egg' | 'growing' | 'mature';
    lastFeedTimestamp?: number;
  };
  backgroundImage: string | null;  // 角色背景图片
  imageGenerationTaskId?: string;  // 图像生成任务ID
  imageGenerationStatus?: 'pending' | 'completed' | 'failed'; // 图像生成状态
}
```

## 图像生成服务交互流程

### 概述

摇篮系统与图像生成服务的交互主要发生在角色创建和更新过程中。系统采用异步方式处理图像生成请求，允许用户在图像生成过程中继续使用其他功能。

### 架构图

```
┌─────────────────┐      ┌────────────────┐      ┌──────────────────┐
│                 │  1   │                │  3   │                  │
│  移动端应用     ├─────►│  图像生成API   ├─────►│  MinIO存储服务   │
│  (React Native) │      │  (Flask+Celery)│      │                  │
│                 │◄─────┤                │◄─────┤                  │
└─────────────────┘  2,4 └────────────────┘  3   └──────────────────┘
```

1. 移动应用向图像生成API发送带标签的请求
2. API返回任务ID
3. 后台任务处理并将图像保存到MinIO
4. 移动应用定期查询任务状态，获取图像URL

### 交互流程详解

#### 1. 角色创建时的图像生成流程

当用户在`CradleCreateForm`组件中创建角色并选择"根据Tag生成图片"时:

1. **标签收集与提交**:
   - 用户从标签库中选择正向标签和负向标签
   - 调用`submitImageGenerationTask`函数处理请求

```typescript
// 位于 CradleCreateForm.tsx 中的核心函数
const submitImageGenerationTask = async (positive: string[], negative: string[]): Promise<string> => {
  try {
    // 将标签数组转换为以逗号分隔的字符串
    const positivePrompt = positive.join(', ');
    const negativePrompt = negative.join(', ');
    
    console.log(`[摇篮角色创建] 准备提交图像生成请求`);
    console.log(`[摇篮角色创建] 角色名称: ${characterName}, 性别: ${gender}`);
    console.log(`[摇篮角色创建] 正向提示词 (${positive.length}个标签): ${positivePrompt}`);
    console.log(`[摇篮角色创建] 负向提示词 (${negative.length}个标签): ${negativePrompt}`);
    
    // 构建请求参数
    const requestData = {
      prompt: positivePrompt,
      negative_prompt: negativePrompt,
      model: 'nai-v4-full',  // 使用NovelAI v4模型
      sampler: 'k_euler_ancestral',
      steps: 28,
      scale: 11,
      resolution: 'portrait',
    };
    
    // 发送请求到服务器
    const response = await fetch('http://152.69.219.182:5000/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    const data = await response.json();
    
    // 检查响应状态
    if (!data.success) {
      throw new Error(`图像生成请求失败: ${data.error || '未知错误'}`);
    }
    
    // 返回任务ID
    return data.task_id;
  } catch (error) {
    console.error('[摇篮角色创建] 提交图像生成请求失败:', error);
    throw error;
  }
};
```

2. **创建角色对象与保存状态**:
   - 在`handleCreateCharacter`函数中，将任务ID保存到角色对象
   - 使用`addCradleCharacter`方法将角色保存到状态

```typescript
// 保存图像生成任务状态到角色对象
if (uploadMode === 'generate' && positiveTags.length > 0) {
  try {
    const imageTaskId = await submitImageGenerationTask(positiveTags, negativeTags);
    
    // 将任务ID存储到角色数据中
    cradleCharacter.imageGenerationTaskId = imageTaskId;
    cradleCharacter.imageGenerationStatus = 'pending';
  } catch (error) {
    console.error('[摇篮角色创建] 提交图像生成任务失败:', error);
    setImageGenerationError(error instanceof Error ? error.message : '提交图像生成任务失败');
    // 即使图片生成请求失败，也继续创建角色
  }
}
```

#### 2. 状态监控与更新流程

在`cradle.tsx`页面中，系统会定期检查图像生成状态:

1. **定时检查任务状态**:
   - 使用`useEffect`设置定时器，调用`checkImageGenerationStatus`函数
   - 检查所有具有`imageGenerationTaskId`的角色

```typescript
useEffect(() => {
  // 设置定期刷新定时器
  const refreshInterval = setInterval(() => {
    // 检查所有角色的图像生成状态
    cradleCharacters.forEach(character => {
      if (character.imageGenerationTaskId && 
          character.imageGenerationStatus !== 'success' && 
          character.imageGenerationStatus !== 'error') {
        checkImageGenerationStatus(character);
      }
    });
  }, 30000); // 每30秒检查一次
  
  return () => clearInterval(refreshInterval);
}, [cradleCharacters]);
```

2. **任务状态检查与响应处理**:

```typescript
const checkImageGenerationStatus = async (character: CradleCharacter) => {
  if (!character.imageGenerationTaskId) return;
  
  try {
    console.log(`[摇篮页面] 检查角色 "${character.name}" 的图像生成任务状态: ${character.imageGenerationTaskId}`);
    
    // 请求状态从服务器
    const response = await fetch(`http://152.69.219.182:5000/task_status/${character.imageGenerationTaskId}`);
    if (!response.ok) {
      console.warn(`[摇篮页面] 获取任务状态失败: HTTP ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    // 如果任务完成且成功
    if (data.done && data.success && data.image_url) {
      console.log(`[摇篮页面] 图像生成成功: ${data.image_url}`);
      
      // 更新角色信息
      let updatedCharacter = { ...character };
      updatedCharacter.backgroundImage = data.image_url;
      updatedCharacter.imageGenerationStatus = 'success';
      
      // 保存更新后的角色
      await updateCradleCharacter(updatedCharacter);
      showNotification('图像生成成功', `角色 ${character.name} 的图像已成功生成！`);
    } 
    // 如果任务失败
    else if (data.done && !data.success) {
      console.error(`[摇篮页面] 图像生成失败: ${data.error || '未知错误'}`);
      
      let updatedCharacter = { ...character };
      updatedCharacter.imageGenerationStatus = 'error';
      updatedCharacter.imageGenerationError = data.error || '未知错误';
      
      // 保存更新后的角色
      await updateCradleCharacter(updatedCharacter);
      showNotification('图像生成失败', `角色 ${character.name} 的图像生成失败：${data.error || '未知错误'}`);
    }
    // 如果任务仍在队列中
    else if (data.queue_info) {
      // 更新队列状态信息
      const queuePosition = data.queue_info.position;
      const estimatedWait = data.queue_info.estimated_wait || 0;
      
      console.log(`[摇篮页面] 图像生成任务在队列中，位置: ${queuePosition}，预计等待时间: ${Math.round(estimatedWait / 60)} 分钟`);
      
      // 仅在第一次获取队列状态时显示通知
      if (character.imageGenerationStatus === 'idle') {
        let updatedCharacter = { ...character };
        updatedCharacter.imageGenerationStatus = 'pending';
        await updateCradleCharacter(updatedCharacter);
        
        showNotification(
          '图像生成进行中',
          `角色 ${character.name} 的图像生成任务已加入队列。\n队列位置: ${queuePosition}\n预计等待时间: ${Math.round(estimatedWait / 60)} 分钟`
        );
      }
    }
  } catch (error) {
    console.error(`[摇篮页面] 检查图像生成状态失败:`, error);
  }
};
```

### 后端服务API接口

图像生成服务提供两个主要的API端点:

#### 1. 图像生成请求 (`/generate`)

- **方法**: POST
- **URL**: http://152.69.219.182:5000/generate
- **请求体**:
  ```json
  {
    "prompt": "positive tags separated by commas",
    "negative_prompt": "negative tags separated by commas",
    "model": "nai-v4-full",
    "sampler": "k_euler_ancestral",
    "steps": 28,
    "scale": 11,
    "resolution": "portrait",
    "is_test_request": false
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "task_id": "unique-task-id",
    "queue_info": {
      "position": 2,
      "total_pending": 5,
      "estimated_wait": 300
    }
  }
  ```

#### 2. 任务状态检查 (`/task_status/{task_id}`)

- **方法**: GET
- **URL**: http://152.69.219.182:5000/task_status/{task_id}
- **响应** (进行中):
  ```json
  {
    "done": false,
    "queue_info": {
      "position": 2,
      "total_pending": 5,
      "estimated_wait": 300
    }
  }
  ```
- **响应** (完成):
  ```json
  {
    "done": true,
    "success": true,
    "image_url": "https://minio-server.domain/characters/image-uuid.png"
  }
  ```
- **响应** (失败):
  ```json
  {
    "done": true,
    "success": false,
    "error": "Error message describing what went wrong"
  }
  ```

### 数据流和状态管理

#### 1. 角色状态中的图像相关字段

在`CradleCharacter`类型中:
```typescript
export interface CradleCharacter extends Omit<Character, 'backgroundImage'> {
  // ...其他字段...
  backgroundImage: string | null;
  imageGenerationTaskId?: string | null;
  imageGenerationStatus?: 'idle' | 'pending' | 'success' | 'error';
  imageGenerationError?: string | null;
}
```

#### 2. 状态转换流程

图像生成过程中的状态转换:

```
  ┌─────────┐        提交生成请求         ┌─────────┐      
  │  idle   │────────────────────────────►│ pending │      
  └─────────┘                             └────┬────┘      
                                               │           
                                               │ 定期检查状态 
                                               ▼           
                         ┌──────────────────────────────────┐
                         │                                  │
                         ▼                                  ▼
                    ┌─────────┐        API错误         ┌─────────┐
                    │ success │◄───────────────────────┤  error  │
                    └─────────┘                        └─────────┘
```

### 图像结果展示

当图像生成完成后，系统会:

1. 更新角色的`backgroundImage`字段为生成的图像URL
2. 更新角色的`imageGenerationStatus`为'success'
3. 通过`CradleCharacterCarousel`组件展示图像
4. 显示成功通知给用户

### 错误处理与恢复

系统实现了以下错误处理机制:

1. **提交请求失败**: 
   - 捕获并记录错误
   - 设置`imageGenerationError`
   - 继续创建角色，但不包含生成的图像

2. **任务处理失败**:
   - 更新角色的`imageGenerationStatus`为'error'
   - 设置`imageGenerationError`为API返回的错误消息
   - 显示错误通知给用户

3. **状态查询失败**:
   - 记录错误但不中断用户操作
   - 下次定时检查时会重试

### 调试与故障排除

#### 常见问题

1. **图像没有生成**:
   - 检查角色的`imageGenerationTaskId`是否存在
   - 检查角色的`imageGenerationStatus`状态
   - 查看控制台日志中的错误信息

2. **任务提交成功但图像未显示**:
   - 检查图像URL是否可访问
   - 检查MinIO存储服务是否正常
   - 确认`backgroundImage`字段已正确设置

3. **服务连接问题**:
   - 确认图像生成服务器IP地址正确(当前为152.69.219.182)
   - 检查网络连接和防火墙设置
   - 确认服务器端Celery工作线程正常运行

#### 日志记录

系统在关键点添加了丰富的日志记录:

- 提交请求时记录标签和参数
- 定期检查状态时记录队列位置和等待时间
- 任务成功或失败时记录结果和URL

#### 推荐测试方法

1. **测试标签组合**:
   使用不同的正向和负向标签组合，观察图像生成效果

2. **测试错误恢复**:
   - 在服务器离线时尝试提交请求
   - 重启应用并检查是否能恢复未完成的任务

3. **队列处理测试**:
   提交多个并发请求，观察队列行为和状态更新
```


```
## OpenRouter API 集成

OpenRouter API是一项服务，它允许通过统一的API访问多种AI大模型，包括OpenAI的GPT模型、Anthropic的Claude以及其他知名AI提供商的模型。我们的摇篮系统现在支持通过OpenRouter API访问这些模型，为用户提供更多选择。

### OpenRouterAdapter

`OpenRouterAdapter` 类提供与OpenRouter API的接口，主要功能包括：

- 文本生成请求处理
- 模型列表获取
- 对话历史管理

```typescript
export class OpenRouterAdapter {
  // 核心方法
  async generateContent(messages: ChatMessage[]): Promise<string> { ... }
  async listModels(): Promise<OpenRouterModel[]> { ... }
}
```

### OpenRouterModelManager

`OpenRouterModelManager` 类提供模型缓存和管理功能，以减少API调用和提高响应速度：

```typescript
export class OpenRouterModelManager {
  // 核心方法
  static async getModels(apiKey: string, forceRefresh = false): Promise<OpenRouterModel[]> { ... }
  static async clearCache(): Promise<void> { ... }
}
```

### CradleApiSettings 组件

新增的 `CradleApiSettings` 组件提供了友好的用户界面，允许用户：

- 在Gemini API和OpenRouter API之间切换
- 配置OpenRouter API密钥
- 从可用模型列表中选择特定模型
- 测试API连接

## UI/UX优化

### 重新设计的摇篮培育详情区

"摇篮培育进行中"区域改造为"摇篮培育详情区"，具有以下改进：

- 支持角色背景图片显示
- 使用LinearGradient提供更好的文本可见度
- 突出显示选中角色的头像和信息
- 实现角色状态的实时更新
- 更清晰地展示培育进度

### 角色选择交互优化

- 选择角色后自动显示在详情区域
- 对当前选择的角色提供视觉反馈（高亮显示）
- 只有在选择了角色后才能执行特定操作（如投喂）
- 角色列表和详情区保持数据同步

### 键盘处理优化

解决了键盘弹出/隐藏引起的UI问题：

- 使用`KeyboardAvoidingView`适当调整布局
- 添加键盘事件监听器以跟踪键盘状态
- 在键盘弹出时滚动到相关输入区域
- 在键盘隐藏时恢复正常布局

### 数据刷新优化

解决了数据刷新相关的问题：

- 导入角色后立即刷新摇篮角色列表
- 投喂数据后立即更新投喂计数显示
- 模态框关闭后自动刷新相关数据
- 角色选择状态在数据刷新后保持一致

## 核心服务实现更新

### 摇篮服务 (CradleService)

摇篮服务已更新以支持OpenRouter API：

```typescript
export class CradleService {
  // 支持API设置更新
  public updateApiSettings(apiSettings: {
    apiProvider: 'gemini' | 'openrouter';
    openrouter?: {
      enabled: boolean;
      apiKey: string;
      model: string;
    }
  }) { ... }

  // 根据设置选择合适的适配器
  private getActiveAdapter() { ... }
}
```

### 角色生成器 (CharacterGeneratorService)

角色生成器现在支持多LLM提供商：

```typescript
export class CharacterGeneratorService {
  private llmAdapter: GeminiAdapter | OpenRouterAdapter;
  
  constructor(adapter: GeminiAdapter | OpenRouterAdapter) {
    this.llmAdapter = adapter;
  }
  
  // 生成和更新方法保持不变，但现在可以使用不同的适配器
}
```

## 已实现功能更新

除了之前已实现的功能外，现在还包括：

1. ✅ **多LLM提供商支持**: 通过OpenRouter API支持多种LLM
2. ✅ **角色详情展示优化**: 使用背景图片增强视觉体验
3. ✅ **角色选择交互**: 实现了角色选择与详情展示的联动
4. ✅ **UI/UX优化**: 改进了键盘处理和数据刷新机制
5. ✅ **即时数据更新**: 导入和投喂后立即更新相关数据
6. ✅ **API设置管理**: 新增了API设置管理界面

## 待实现功能

除了之前的待实现功能外，新增：

1. ❌ **更细粒度的模型参数控制**: 允许用户调整温度、top-p等模型参数
2. ❌ **模型与角色的兼容性匹配**: 根据角色类型推荐适合的模型
3. ❌ **多API费用跟踪**: 跟踪不同API提供商的使用成本
4. ❌ **自定义二元对立模块**: 实现角色创建时的性格滑块自定义功能

## 开发者指南

### 如何添加新的API提供商

要添加新的API提供商，请按以下步骤操作：

1. 创建新的适配器类，实现与`GeminiAdapter`和`OpenRouterAdapter`相同的接口
2. 更新`CradleService`以支持新的适配器
3. 在`CharactersContext`中添加相关设置和方法
4. 创建对应的设置UI组件
5. 更新`CradleApiSettings`组件以包含新提供商

### 如何扩展角色详情区

详情区可以进一步扩展以显示更多信息：

1. 添加角色情绪动画
2. 实现点击角色头像显示更多详细信息
3. 在详情区域增加培育过程可视化
4. 添加快速操作按钮

## 问题排查指南

### 1. API连接问题

**可能原因**:
- API密钥无效或过期
- 网络连接问题
- 请求格式错误

**排查步骤**:
1. 使用"测试连接"功能验证API密钥
2. 检查控制台中的请求/响应日志
3. 确认API提供商服务状态
4. 验证请求体格式是否符合API要求

### 2. 模型加载失败

**可能原因**:
- API密钥权限不足
- 网络请求超时
- 返回数据格式变更

**排查步骤**:
1. 检查`OpenRouterModelManager`缓存
2. 尝试使用`forceRefresh`参数强制刷新模型列表
3. 验证API响应格式是否符合预期

## 未来规划

### 短期目标

1. 完成自定义二元对立模块的实现
2. 优化角色背景图片的裁剪和显示
3. 增强投喂类型的处理逻辑

### 中期目标

1. 实现模型参数的精细控制
2. 添加培育过程的可视化展示
3. 支持更多的媒体类型投喂

### 长期目标

1. 实现社区分享功能
2. 开发角色融合机制
3. 提供模板库以快速创建特定类型的角色
