# 智能角色聊天系统文档

## 聊天界面功能概述

当前聊天界面实现了一个完整的角色聊天系统，支持以下功能：

### 核心聊天功能

1. **基本消息交流**
   - 发送和接收文本信息
   - 支持 Markdown 格式文本
   - 消息气泡样式区分用户和角色
   - 支持表情符号和格式化文本

2. **角色设定**
   - 基于角色卡片的人物设定
   - 角色会记住对话内容并保持一致性
   - 个性化回复基于角色设定

3. **自动首条消息**
   - 角色会在对话开始时自动发送设定的开场白
   - 重置对话后也会自动发送开场白

4. **对话管理**
   - 切换不同角色的对话
   - 重置当前对话
   - 重新生成角色的回复
   - 角色回复评分系统

### 增强功能

5. **主动消息系统**
   - 角色会在用户长时间未回复时主动发送消息
   - 可配置的触发时间间隔（1-30分钟）
   - 可按角色单独开关主动消息功能
   - 主动消息通知系统

6. **消息通知**
   - 角色新消息通知功能
   - 可按角色单独开关通知
   - 未读消息计数显示
   - 切换到聊天页面时自动清除通知

7. **记忆总结系统**
   - 自动总结长对话以保持语境理解
   - 可配置的总结阈值和总结长度
   - 超过阈值长度时触发总结

8. **图像功能**
   - 聊天中展示和发送图片
   - AI 图像生成功能
   - 图像编辑和修改
   - 全屏查看图片

9. **对话保存与恢复**
   - 保存当前对话状态
   - 预览保存的对话状态
   - 恢复到之前保存的对话点

10. **自定义背景**
    - 为每个角色设置独特的聊天背景

## 文件结构

```
f:\my-app\
│
├── app\
│   └── (tabs)\               # 标签式导航相关文件
│       ├── _layout.tsx       # 标签布局及通知系统
│       └── index.tsx         # 主聊天界面逻辑与UI
│
├── components\               # UI组件
│   ├── ChatDialog.tsx        # 聊天消息显示区域
│   ├── ChatInput.tsx         # 聊天输入框及功能按钮
│   ├── SettingsSidebar.tsx   # 角色设置侧边栏
│   ├── Sidebar.tsx           # 角色选择侧边栏
│   ├── TopBarWithBackground.tsx # 顶部栏组件
│   ├── MemoOverlay.tsx       # 备忘录组件
│   └── SaveManager.tsx       # 对话保存与恢复管理器
│
├── constants\                # 应用常量与上下文
│   ├── CharactersContext.tsx # 角色数据上下文
│   ├── RegexContext.tsx      # 文本处理上下文
│   ├── UserContext.tsx       # 用户设置上下文
│   └── theme.ts              # UI主题定义
│
├── services\                 # 服务层
│   ├── ChatSaveService.ts    # 对话保存服务
│   ├── ratingService.ts      # 消息评分服务
│   └── AIbbs\                # AI相关服务
│       └── memory-service.ts # 记忆总结服务
│
├── NodeST\                   # 节点式处理引擎
│   └── nodest\
│       ├── index.ts          # NodeST入口
│       ├── core\
│       │   └── node-st-core.ts # 核心处理逻辑
│       └── utils\
│           ├── character-utils.ts # 角色数据处理
│           └── gemini-adapter.ts  # Gemini API适配器
│
├── utils\                    # 工具函数
│   ├── NodeSTManager.ts      # NodeST管理器
│   ├── textParser.ts         # 文本解析工具
│   └── dateUtils.ts          # 日期处理工具
│
└── shared\                   # 共享类型与接口
    └── types.ts              # 数据类型定义
```

## 关键组件流程

1. **聊天消息流程**：
   - 用户在 `ChatInput` 输入消息
   - `index.tsx` 处理消息并通过 `NodeSTManager` 发送给 AI
   - AI响应通过 `node-st-core.ts` 处理
   - 响应返回后在 `ChatDialog` 中显示

2. **主动消息流程**：
   - `index.tsx` 中的定时器跟踪用户活动
   - 根据设置的时间间隔触发自动消息
   - 使用 `EventRegister` 更新通知计数
   - `_layout.tsx` 显示未读消息标记

3. **角色设置流程**：
   - 通过 `SettingsSidebar` 修改角色设置
   - 设置保存到 `CharactersContext`
   - 设置影响聊天行为和角色互动方式

4. **对话保存/恢复流程**：
   - `SaveManager` 处理保存点创建和管理
   - 保存点存储在 `AsyncStorage` 中
   - 可预览或恢复到特定保存点

## 技术栈

- React Native + Expo
- AsyncStorage 用于本地数据持久化
- NodeST 自定义引擎用于AI聊天处理
- Gemini API 用于AI文本和图像生成
- React Context API 用于状态管理
- Expo Vector Icons 用于图标

## 配置选项

角色层面的配置选项在 `SettingsSidebar.tsx` 中定义，主要包括：

- 主动消息开关与触发时间
- 消息通知开关
- 记忆总结设置（阈值和长度）
- 朋友圈互动频率
- 关系系统设置

全局设置存储在 `UserContext` 中，包括API设置和用户偏好。
