# 摇篮系统 (Cradle System) 开发文档

## 概述

摇篮系统是一个用于培育和生成更具个性化AI角色的功能模块。通过让用户在一段时间内"投喂"数据（文本、图片等）给未成熟的角色，系统可以根据这些输入来塑造和生成具有独特个性的AI角色。这种方式比直接创建角色更能形成有深度和个性的角色设定。

## 文件结构

摇篮系统的前端实现涉及以下文件：

```
/f:/my-app/
├── app/
│   ├── (tabs)/
│   │   └── cradle.tsx              // 摇篮系统主页面
│   ├── pages/
│   │   ├── create_char_cradle.tsx  // 摇篮角色创建独立页面
│   │   └── create_character_tabs.tsx // 角色创建页面（包含摇篮标签页）
├── components/
│   ├── CradleCreateForm.tsx        // 摇篮角色创建表单组件
│   ├── CradleFeedModal.tsx         // 摇篮数据投喂模态框
│   ├── CradleSettings.tsx          // 摇篮系统设置组件
│   └── ImportToCradleModal.tsx     // 导入现有角色到摇篮系统组件
├── constants/
│   ├── types.ts                    // 摇篮系统相关类型定义
│   └── CharactersContext.tsx       // 包含摇篮系统的业务逻辑和数据管理
├── shared/
│   ├── types.ts                    // 摇篮角色的定义，继承自常规角色
├── docs/
│   └── cradle-system.md            // 摇篮系统开发文档
```

## 核心类型定义

摇篮系统的核心数据结构定义在 `types.ts` 中，采用了接口继承的方式使摇篮角色与常规角色保持类型兼容：

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
  type: 'text' | 'voice' | 'image'; // 投喂类型
  timestamp: number;                // 时间戳
  processed: boolean;               // 是否已处理
}
```

### CradleAnimation

```typescript
interface CradleAnimation {
  glowIntensity?: number;
  glowColor?: string;
  pulseSpeed?: number;
}
```

### CradleCharacter

```typescript
// 使用接口继承扩展Character类型
interface CradleCharacter extends Character {
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
  }
}
```

## 数据流

摇篮系统的数据流如下：

1. **角色来源**
   - 直接创建新的摇篮角色
   - 从现有角色导入到摇篮系统

2. **角色培育**
   - 设定培育周期（默认7天）
   - 投喂数据（文本、图片）
   - 系统处理投喂数据，影响角色个性发展

3. **角色生成/更新**
   - 培育完成后，对于导入的角色，更新原角色属性
   - 对于新创建的角色，生成正式角色并从摇篮移除

## 功能模块

### 1. 摇篮角色创建 (CradleCreateForm)

- 支持选择参考角色作为基础
- 允许设置角色基本信息（名称、性别、头像、背景）
- 提供性格坐标轴和能力属性滑块
- 可选择立即生成或进入摇篮培育模式

### 2. 投喂系统 (CradleFeedModal)

- 支持文本投喂
- 支持图片投喂
- 显示投喂历史记录
- 自动更新角色头像（如果角色无头像且投喂图片）

### 3. 摇篮设置 (CradleSettings)

- 允许启用/禁用摇篮系统
- 可调整培育周期长度
- 显示系统说明和注意事项

### 4. 摇篮主页面 (cradle.tsx)

- 显示培育进度和状态
- 列出所有摇篮角色（包括导入的角色）
- 支持直接进行投喂操作
- 允许导入现有角色到摇篮系统
- 对于导入的角色，提供"应用更新"而非"生成角色"选项

### 5. 导入功能 (ImportToCradleModal)

- 显示可导入的现有角色列表
- 过滤已导入到摇篮系统的角色
- 提供导入确认流程

## 导入角色流程

1. **选择导入**
   - 用户点击"导入"按钮打开导入模态框
   - 系统显示所有未导入到摇篮的常规角色

2. **确认导入**
   - 用户选择一个角色进行导入
   - 创建带有特殊标记的摇篮角色，并链接到原角色

3. **培育过程**
   - 导入的角色与普通摇篮角色一样接受投喂培育
   - UI中显示特殊标记，表示这是导入的角色

4. **更新原角色**
   - 培育周期结束后，用户选择"应用更新"
   - 系统将投喂数据的成果合并到原角色中
   - 从摇篮系统中移除该角色

## 后端实现建议

### 1. 投喂数据处理

```
投喂数据 -> 语义分析 -> 提取特征 -> 更新角色模型
```

- 实现语义分析API，分析用户投喂的文本和图片内容
- 提取情感倾向、主题、风格等特征
- 根据分析结果动态调整角色的个性参数

### 2. 角色更新流水线

对于导入的角色和新创建的角色，处理流程略有不同：

**导入角色更新流程**
```
摇篮培育数据 -> 特征提取 -> 与原角色合并 -> 更新现有角色
```

**新创建角色生成流程**
```
摇篮培育数据 -> 特征整合 -> 生成角色设定 -> 创建新角色
```

### 3. 实时反馈系统

- 为投喂内容添加处理状态标记
- 显示数据对角色个性的影响预览
- 提供培育过程的可视化展示

## 数据持久化

摇篮系统数据使用以下文件结构存储：

- `cradle_settings.json` - 摇篮系统全局设置
- `cradle_characters.json` - 摇篮角色列表（包括导入的角色）

对于导入的角色，我们存储:
- `importedFromCharacter: true` - 标记为导入的角色
- `importedCharacterId: "原角色ID"` - 记录原始角色的ID，用于更新

## 未来扩展

除了之前提到的扩展方向，针对导入功能可以考虑以下增强：

1. **差异化投喂**
   - 基于角色已有特性推荐适合的投喂内容
   - 为导入角色提供个性化的培育建议

2. **角色演化记录**
   - 记录角色在摇篮系统中的培育历史
   - 提供角色个性变化的时间线视图

3. **批量导入/导出**
   - 支持批量导入多个角色到摇篮系统
   - 提供导出摇篮培育数据的功能

4. **角色融合**
   - 允许多个摇篮角色的特性融合
   - 创建混合特性的新角色

## 已知限制

1. 当前实现仅支持本地数据，无法在多设备间同步
2. 缺乏真实的AI处理逻辑，目前只有UI展示
3. 图片处理功能有限，没有内容分析
4. 没有实现角色数据的备份和导出功能
5. 导入角色更新机制较为简单，没有细粒度的特性合并

## 开发任务优先级

1. **高优先级**
   - 完善导入角色的更新逻辑，实现更精细的特性合并
   - 实现基本的投喂数据处理逻辑
   - 数据持久化和同步

2. **中优先级**
   - 角色培育进度可视化优化
   - 投喂类型扩展
   - 针对导入角色的个性化培育建议

3. **低优先级**
   - 社区分享功能
   - 高级培育模式
   - 角色融合功能
````