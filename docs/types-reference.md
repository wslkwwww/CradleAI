```markdown
# 类型系统说明文档

## 类型架构概述

类型系统分为两个主要部分：
- `/shared/types.ts`: 核心业务逻辑类型定义
- `/constants/types.ts`: UI 和应用特定类型定义

## 核心业务类型 (shared/types.ts)

### 基础用户类型
```typescript
interface User {
    id: string;
    avatar?: string;
    name?: string;
    settings?: GlobalSettings;
}
```

### NodeST 核心类型

#### RoleCardJson (角色卡)
```typescript
interface RoleCardJson {
    name: string;          // 角色名称
    first_mes: string;     // 首次对话内容
    description: string;   // 角色描述
    personality: string;   // 性格特征
    scenario: string;      // 场景设定
    mes_example: string;   // 示例对话
    background?: string;   // 背景设定（可选）
    data?: {
        extensions?: {
            regex_scripts?: RegexScript[]; // 正则替换脚本
        };
    };
}
```

#### WorldBookJson (世界观设定)
```typescript
interface WorldBookJson {
    entries: {
        [key: string]: WorldBookEntry;
    };
}

interface WorldBookEntry {
    comment: string;               // 条目说明
    content: string;              // 具体内容
    disable: boolean;             // 是否禁用
    position: 0 | 1 | 2 | 3 | 4;  // 插入位置
    key?: string[];              // 触发关键词
    constant: boolean;           // 是否固定
    order: number;              // 排序
    depth: number;             // 插入深度
    vectorized?: boolean;      // 是否向量化
}
```

#### PresetJson (预设提示词)
```typescript
interface PresetJson {
    prompts: Array<{
        name: string;
        content: string;
        enable: boolean;
        identifier: string;
        injection_position?: 0 | 1;
        injection_depth?: number;
        role: "user" | "model";
    }>;
    prompt_order: PromptOrder[];
}
```

### 消息类型系统

#### 基础消息类型
```typescript
interface MessagePart {
    text: string;
}

interface ChatMessage {
    role: string;
    parts: MessagePart[];
    is_first_mes?: boolean;
    is_author_note?: boolean;
    is_d_entry?: boolean;
    name?: string;
    identifier?: string;
    injection_depth?: number;
    constant?: boolean;
    key?: string[];
    position?: number;
    insertion_order?: number;
    timestamp?: number;
}
```

## UI 专用类型 (constants/types.ts)

### UI 组件属性类型
```typescript
interface CradleSettingsProps {
    isVisible: boolean;
    onClose: () => void;
    onCradleToggle: (enabled: boolean) => void;
    onDurationChange: (days: number) => void;
    isCradleEnabled: boolean;
    cradleDuration: number;
}

interface MemoSheetProps {
    isVisible: boolean;
    onClose: () => void;
    onSave: (content: string) => void;
    style?: StyleProp<ViewStyle>;
}
```

### 编辑器专用类型
```typescript
interface PresetEntryUI {
    id: string;
    name: string;
    content: string;
    identifier: string;
    insertType: 'relative' | 'chat';
    role: 'user' | 'model';
    order: number;
    depth?: number;
    enable: boolean;
    injection_position?: number;
    isDefault?: boolean;
    isEditable: boolean;
}

interface WorldBookEntryUI {
    id: string;
    name: string;
    // ... 继承自 WorldBookEntry 的其他字段
    comment: string;
    disable: boolean;
    position: 0 | 1 | 2 | 3 | 4;
}
```

### 摇篮系统类型
```typescript
interface CradleSettings {
    enabled: boolean;
    duration: number;
    startDate?: string;
    progress: number;
    lastInterruption?: string;
    cradleConversationId?: string;
}

interface CradleAnimation {
    glowIntensity?: number;
    glowColor?: string;
    pulseSpeed?: number;
}

interface CradleCharacter extends Character {
    isCradleGenerated: boolean;
    cradleAnimation?: CradleAnimation;
}
```

## 类型使用指南

### 1. 角色相关操作

使用 RoleCardJson 创建或更新角色：
```typescript
const roleCard: RoleCardJson = {
    name: "角色名",
    first_mes: "首次对话内容",
    description: "角色描述",
    // ... 其他必需字段
};
```

### 2. 世界观条目处理

Position 值说明：
- 0: 描述前
- 1: 描述后
- 2: 作者注释前
- 3: 作者注释后
- 4: 动态插入

### 3. UI 开发注意事项

1. 编辑器组件应使用 UI 专用类型：
   - PresetEntryUI 用于预设编辑器
   - WorldBookEntryUI 用于世界观编辑器

2. 摇篮系统相关组件应使用对应的专用类型：
   - CradleSettings 用于配置
   - CradleAnimation 用于动画效果
   - CradleCharacter 用于摇篮生成的角色

## 类型兼容性要求

1. WorldBookEntry 和 WorldBookEntryUI 的 position 字段必须保持一致
2. PresetJson 中的 role 字段必须为 "user" | "model"
3. ChatMessage 的 role 字段在转换为 GeminiMessage 时需要映射：
   - "assistant" -> "model"
   - "system" -> "user"
```

这个文档提供了主要类型的详细说明和使用指南，帮助开发者理解和正确使用类型系统。建议随着类型系统的更新持续维护此文档。
