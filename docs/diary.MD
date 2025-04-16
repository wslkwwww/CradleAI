# 角色日记系统

角色日记系统是一个基于AI驱动的反思和记录机制，允许角色以第一人称视角撰写日记，记录与用户的互动体验，增强角色的连贯性和深度。

## 功能概述

角色日记系统通过定期或手动触发，基于聊天历史、角色设定、朋友圈记忆等多维度信息，生成富有个性化的日记内容。

### 主要功能

1. **自动/手动日记生成**：支持每日自动生成或手动触发生成角色日记
2. **多维度反思**：综合考虑聊天记录、角色设定、朋友圈动态等多种信息
3. **每日一篇限制**：每天只生成一篇日记，避免内容冗余
4. **重新生成**：对当天的日记不满意时可以重新生成
5. **删除日记**：支持删除不需要的日记条目
6. **自定义设置**：可调整日记生成的各项参数

## 用户界面

### 入口

在角色卡片上提供日记本按钮，点击后打开该角色的日记本页面。

### 日记本界面

日记本界面分为两个主要标签页：

#### 日记条目标签页

显示所有已生成的日记条目，按时间倒序排列。每个日记条目包含：

- 创建日期和时间
- 反思目标
- 各维度权重标签
- 日记正文内容
- 操作按钮（删除、重新生成）

当天的日记会特别标记，并提供"重新生成"按钮。

#### 设置标签页

提供日记系统的各项配置选项：

- 启用/禁用日记系统
- 反思目标设定
- 日记字数设定（100-1000字）
- 各维度权重调整：
  - 聊天上下文权重
  - 角色设定权重
  - 世界信息权重
  - 策略调整权重
  - 朋友圈记忆权重
- 朋友圈记忆条数设置

## 技术实现

### 主要组件

1. **DiaryBook**: 日记本UI组件，负责展示和管理日记
2. **DiaryService**: 日记服务类，处理日记生成、存储等核心逻辑

### 数据结构

```typescript
// 日记条目
interface DiaryEntry {
  id: string;
  characterId: string;
  content: string;
  createdAt: number;
  reflectionGoal: string;
  contextWeight: number;
  characterWeight: number;
  worldInfoWeight: number;
  strategicWeight: number;
  circleMemoryWeight?: number;
  circleMemoryCount?: number;
}

// 日记设置
interface DiarySettings {
  enabled: boolean;
  reflectionGoal: string;
  wordCount: number;
  contextWeight: number;
  characterWeight: number;
  worldInfoWeight: number;
  strategicWeight: number;
  confidenceThreshold: number;
  triggerInterval: 'daily' | 'hourly' | 'manual' | string;
  triggerTime?: string;
  lastTriggered?: number;
  circleMemoryWeight?: number;
  circleMemoryCount?: number;
}
```

### 日记生成流程

1. 获取角色的聊天历史（基于StorageAdapter）
2. 如果启用了朋友圈记忆，获取角色的朋友圈记忆
3. 解析角色设定数据
4. 构建日记生成提示词，包含：
   - 角色信息
   - 反思目标
   - 聊天记录摘要
   - 朋友圈记忆摘要
   - 世界信息
5. 通过ApiServiceProvider调用LLM API生成日记内容
6. 保存日记条目到AsyncStorage

### 约束条件

- 每个角色每天只能生成一篇日记
- 用户可以删除或重新生成日记
- 日记内容受用户设置的各维度权重影响

## 使用指南

### 创建第一篇日记

1. 点击角色卡片上的日记本图标
2. 进入日记本页面
3. 点击"创建新日记"按钮
4. 系统将基于角色设定和过往聊天记录生成日记

### 自定义日记设置

1. 在日记本页面切换到"设置"标签
2. 调整各项参数：
   - 启用/禁用日记系统
   - 设置反思目标
   - 调整日记字数
   - 设置各维度权重

### 管理日记

- **删除日记**：点击日记条目下方的"删除"按钮
- **重新生成**：对当天的日记，点击"重新生成"按钮可以创建新版本

## 技术拓展

### 计划功能

1. **日记情绪分析**：分析日记内容的情绪，影响角色的后续对话风格
2. **自动行动决策**：基于日记内容自动决定是否主动发送消息给用户
3. **日记搜索功能**：允许搜索日记内容
4. **导出/分享功能**：支持导出日记内容或分享到社交平台

## 故障排除

### 常见问题

1. **日记生成失败**
   - 检查API设置是否正确
   - 检查网络连接
   - 查看控制台错误信息

2. **无法重新生成日记**
   - 确认已成功删除当天的日记
   - 检查API限制
   
3. **设置无法保存**
   - 确认存储权限
   - 重启应用后再试

## API参考

### DiaryService核心方法

- `generateDiaryEntry(character: Character): Promise<DiaryEntry | null>`
- `saveDiaryEntry(entry: DiaryEntry): Promise<boolean>`
- `deleteDiaryEntry(characterId: string, entryId: string): Promise<boolean>`
- `getDiaryEntriesByCharacterId(characterId: string): Promise<DiaryEntry[]>`
- `getDiarySettings(characterId: string): Promise<DiarySettings | null>`
- `saveDiarySettings(characterId: string, settings: DiarySettings): Promise<boolean>`
