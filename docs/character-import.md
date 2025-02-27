# 角色导入功能技术文档

## 1. 数据流程

### 导入流程
1. 用户选择角色卡PNG图片
2. 用户选择预设JSON文件 
3. 程序读取并解析两个文件
4. 临时存储解析后的数据到AsyncStorage
5. 跳转到创建角色页面
6. 创建页面加载临时数据并填充表单

### 数据解析规则

#### 临时存储结构
```typescript
// AsyncStorage['temp_import_data']
interface ImportData {
    roleCard: RoleCardJson;
    worldBook: WorldBookJson; 
    preset: PresetJson;
    avatar: string;
}
```

#### 预设数据标准
```typescript
interface PresetPrompt {
    name: string;
    content?: string;
    enabled: boolean;
    identifier: string;
    role: 'user' | 'model';  // 'user'对应界面"用户"，'model'对应"AI助手"
    injection_position?: 0 | 1;  // 0:相对位置 1:聊天中
    injection_depth?: number;
}
```

#### 世界信息标准
```typescript
interface WorldBookEntry {
    comment: string;
    content: string;
    disable: boolean;
    position: 0 | 1 | 2 | 3 | 4;  // 插入位置，特别注意：position值应该用extension.position提取
    key?: string[];
    constant: boolean;
    depth?: number;  // 仅当 position = 4 时有效
}
```

## 2. 涉及的代码文件

### 核心文件
- `/utils/CharacterImporter.ts`: 角色导入的核心实现
- `/shared/types.ts`: 数据类型定义
- `/app/pages/create_char.tsx`: 角色创建页面

### 组件文件
- `/components/character/CharacterFormComponents.tsx`: 通用表单组件
- `/components/character/CharacterSections.tsx`: 角色卡组件

## 3. 重要说明

### 数据转换规则
- Role转换：
    - assistant/model/ai → model (显示为"AI助手")
    - 其他值 → user (显示为"用户")
- Position转换：
    - 0 → relative (相对位置)
    - 1 → chat (聊天中)

### 错误处理
- PNG解析失败: "Invalid character data: missing chara data"
- 预设解析失败: "预设文件格式无效: {具体错误}"
- 文件读取失败: "无法读取文件内容: 所有读取方法都失败了"

### 存储位置
- 角色文件路径: `FileSystem.documentDirectory + 'app/characters/'`

## 4. 开发建议

### 功能优化
- 添加更多文件格式支持
- 实现批量导入功能
- 添加导入进度提示
- 增加数据预览功能

### 安全建议
- 添加文件大小限制
- 增加数据格式校验
- 实现异常恢复机制

### 性能优化
- 实现大文件分片处理
- 添加数据缓存机制

## 5.技术债务