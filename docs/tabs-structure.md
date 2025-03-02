
```markdown
# 标签页结构与功能说明文档

## 1. 整体布局
位置：`/app/(tabs)/_layout.tsx`
- 管理底部导航栏的整体布局
- 包含5个主要标签页：聊天、发现、角色卡、摇篮、我的
- 每个标签页都有独特的图标和激活状态

## 2. 聊天页面 (index)
位置：`/app/(tabs)/index.tsx`
### 功能
- 主要聊天界面
- 显示与AI角色的对话历史
- 实时消息发送和接收
- 侧边栏切换不同对话
### 组件依赖
- ChatDialog：显示对话内容
- ChatInput：消息输入组件
- Sidebar：对话列表侧边栏
- SettingsSidebar：设置侧边栏
- TopBarWithBackground：顶部导航栏

## 3. 发现页面 (explore)
位置：`/app/(tabs)/explore.tsx`
### 功能
- 社交圈功能，类似朋友圈
- 角色关系系统
- 支持点赞、评论、转发
### 组件依赖
- CharacterSelector：角色选择器
- RelationshipGraph：关系图谱
- RelationshipActions：关系行动
- ForwardSheet：转发面板

## 4. 角色卡页面 (Character)
位置：`/app/(tabs)/Character.tsx`
### 功能
- 显示所有AI角色卡片
- 角色管理（新建、删除、导入导出）
- 角色关系查看
### 组件依赖
- CharacterCard：角色卡片组件
- RelationshipGraph：关系图谱
- MessageBox：消息盒子

## 5. 摇篮页面 (cradle)
位置：`/app/(tabs)/cradle.tsx`
### 功能
- AI角色培育系统
- 角色成长状态监控
- 知识投喂功能
### 组件依赖
- CradleSettings：摇篮设置
- CradleFeedModal：投喂模态框

## 6. 个人页面 (Profile)
位置：`/app/(tabs)/Profile.tsx`
### 功能
- 用户信息展示
- 全局设置访问
- 数据管理
### 组件依赖
- NodeSTCleanupButton：数据清理按钮

## 文件结构
```
/app/(tabs)/
├── _layout.tsx      # 标签页整体布局
├── index.tsx        # 聊天页面
├── explore.tsx      # 发现页面
├── Character.tsx    # 角色卡页面
├── cradle.tsx       # 摇篮页面
└── Profile.tsx      # 个人页面
```
```
## 样式主题
所有页面共享以下主要样式特征：
- 深色主题背景色: #282828
- 顶部导航栏高度: 90px
- 统一的边框和阴影效果
- 一致的字体和图标大小

## 公共组件
位置：`/components/`
- TopBarWithBackground：统一的顶部导航栏
- ThemedText：主题文字组件
- 各类模态框和工具组件

## 状态管理
- UserContext：用户信息管理
- CharactersContext：角色数据管理
- ColorScheme：主题色彩管理
```

Made changes.