# Discord App UI 界面规范文档

## 目录
1. [总体布局结构](#总体布局结构)
2. [组件层次结构](#组件层次结构)
3. [视觉设计规范](#视觉设计规范)
4. [交互行为规范](#交互行为规范)
5. [响应式设计](#响应式设计)
6. [状态管理](#状态管理)

## 总体布局结构

### 主要布局区域
Discord采用三栏布局结构：

```
┌─────────────────────────────────────────────────────────┐
│ [服务器列表] │ [频道列表] │        [主内容区域]        │
│     70px     │   240px    │          剩余空间           │
│              │            │                             │
│              │            │ ┌─────────────────────────┐ │
│              │            │ │      标题栏区域         │ │
│              │            │ │        48px             │ │
│              │            │ ├─────────────────────────┤ │
│              │            │ │                         │ │
│              │            │ │      消息区域           │ │
│              │            │ │      (flex-grow)        │ │
│              │            │ │                         │ │
│              │            │ ├─────────────────────────┤ │
│              │            │ │      输入框区域         │ │
│              │            │ │        68px             │ │
│              │            │ └─────────────────────────┘ │
│              │            │                             │
└─────────────────────────────────────────────────────────┘
```

## 组件层次结构

### 1. 服务器列表 (Server List)

**容器属性:**
- 宽度: 70px (固定)
- 背景色: #1e1f22
- 滚动: 垂直滚动

**服务器图标组件:**
```css
.server-icon {
  width: 48px;
  height: 48px;
  border-radius: 50% -> 30% (hover时过渡)
  margin: 0 auto 8px;
  background: #36393f;
  transition: all 0.2s ease;
}

.server-icon:hover {
  border-radius: 30%;
  background: #5865f2; /* Discord蓝色 */
}

.server-icon.active {
  border-radius: 30%;
}
```

**特殊元素:**
- 顶部: "发现服务器"按钮 (绿色圆形，带+号)
- 分隔线: 2px高度，颜色#36393f
- 底部: "添加服务器"按钮 (灰色圆形，带+号)

### 2. 频道列表 (Channel List)

**容器属性:**
- 宽度: 240px (固定)
- 背景色: #2b2d31
- 分为三个区域: 服务器标题、频道列表、用户信息

**服务器标题区域 (48px高):**
```css
.server-header {
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #1e1f22;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.server-header:hover {
  background: #35373c;
}
```

**频道分类和频道项:**
```css
.channel-category {
  padding: 16px 8px 0 16px;
  color: #949ba4;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.channel-item {
  padding: 1px 8px 1px 16px;
  margin: 1px 8px;
  border-radius: 4px;
  color: #949ba4;
  cursor: pointer;
}

.channel-item:hover {
  background: #35373c;
  color: #dbdee1;
}

.channel-item.active {
  background: #404249;
  color: #ffffff;
}
```

**频道类型图标:**
- 文字频道: # (井号)
- 语音频道: 🔊 (喇叭图标)
- 公告频道: 📢 (公告图标)
- 论坛频道:  (消息气泡)


**用户信息区域 (固定在底部, 52px高):**
```css
.user-panel {
  height: 52px;
  background: #232428;
  padding: 0 8px;
  display: flex;
  align-items: center;
}
```

### 3. 主内容区域

#### 3.1 标题栏 (Header Bar)

**容器属性:**
- 高度: 48px (固定)
- 背景色: #313338
- 边框底部: 1px solid #1e1f22

**内容布局:**
```css
.channel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
}

.channel-header-left {
  display: flex;
  align-items: center;
}

.channel-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
```

**左侧元素:**
- 频道图标 + 频道名称
- 频道主题 (如果有)

**右侧元素:**
- 搜索框
- 各种操作按钮 (视频、语音、设置等)

#### 3.2 消息区域 (Messages Area)

**容器属性:**
```css
.messages-wrapper {
  flex: 1;
  overflow: hidden;
  background: #313338;
}

.messages-scroller {
  height: 100%;
  overflow-y: scroll;
  padding: 16px 0;
}
```

**消息组件结构:**
```css
.message-group {
  padding: 0.125rem 4rem 0.125rem 4.5rem;
  margin: 0 1rem;
  position: relative;
}

.message-group:hover {
  background: #2e3035;
}
```

**消息内容:**
- 用户头像 (40x40px, 圆形)
- 用户名 + 时间戳
- 消息内容
- 反应表情区域
- 附件区域

#### 3.3 输入框区域 (Message Input)

**容器属性:**
- 高度: 68px (固定)
- 背景色: #313338
- 内边距: 0 16px

**输入框样式:**
```css
.message-input {
  background: #383a40;
  border-radius: 8px;
  border: none;
  padding: 11px 16px;
  color: #dcddde;
  font-size: 14px;
  resize: none;
  max-height: 50vh;
}

.message-input::placeholder {
  color: #72767d;
}
```

## 视觉设计规范

### 颜色系统

**主要背景色:**
- 最深背景: #1e1f22 (服务器列表)
- 中等背景: #2b2d31 (频道列表)
- 浅色背景: #313338 (主内容区)
- 输入框背景: #383a40

**交互状态色:**
- 悬停背景: #35373c / #2e3035
- 激活背景: #404249
- Discord蓝: #5865f2
- 在线绿: #23a559
- 警告黄: #faa61a
- 错误红: #ed4245

**文字颜色:**
- 主要文字: #ffffff
- 次要文字: #dbdee1
- 三级文字: #949ba4
- 占位符文字: #72767d

### 字体规范

**字体族:**
```css
font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
```

**字体大小:**
- 用户名: 16px, font-weight: 500
- 消息内容: 16px, font-weight: 400
- 时间戳: 12px, font-weight: 500
- 频道名: 16px, font-weight: 500
- 分类标题: 12px, font-weight: 600

### 圆角和阴影

**圆角半径:**
- 小元素: 3px
- 中等元素: 4px
- 大元素: 8px
- 头像: 50% (圆形)

**阴影效果:**
```css
.elevated-element {
  box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.2);
}
```

## 交互行为规范

### 悬停效果

**通用悬停:**
- 过渡时间: 0.2s ease
- 背景色变化
- 部分元素透明度变化

**服务器图标悬停:**
- 圆角从50%变为30%
- 显示服务器名称tooltip

**频道项悬停:**
- 背景色变化
- 文字颜色变浅
- 显示右侧操作按钮

### 点击效果

**选中状态:**
- 服务器: 左侧白色竖线指示器
- 频道: 背景高亮，文字变白
- 消息: 左侧灰色竖线

**按钮反馈:**
- 轻微缩放效果 (transform: scale(0.95))
- 背景色变化

### 滚动行为

**消息区域:**
- 自动滚动到底部 (新消息时)
- 平滑滚动
- 滚动条样式自定义

**频道列表:**
- 垂直滚动
- 隐藏滚动条

## 响应式设计

### 断点设置

```css
/* 平板 */
@media (max-width: 768px) {
  .server-list {
    width: 60px;
  }
  
  .channel-list {
    width: 200px;
  }
}

/* 手机 */
@media (max-width: 480px) {
  /* 隐藏侧边栏，使用抽屉式导航 */
  .server-list,
  .channel-list {
    position: fixed;
    left: -100%;
    transition: left 0.3s ease;
  }
  
  .sidebar-open .server-list {
    left: 0;
  }
  
  .sidebar-open .channel-list {
    left: 60px;
  }
}
```

### 移动端特殊处理

**触摸优化:**
- 增大点击区域 (最小44px)
- 禁用hover效果
- 添加触摸反馈

**导航处理:**
- 汉堡菜单按钮
- 手势滑动支持
- 底部导航栏 (可选)

## 状态管理

### UI状态类型

**全局状态:**
- 当前服务器ID
- 当前频道ID
- 侧边栏展开状态
- 主题模式 (暗色/亮色)

**组件状态:**
- 消息输入框内容
- 滚动位置
- 悬停状态
- 加载状态

### 状态更新规则

**导航状态:**
```javascript
// 示例状态结构
{
  currentServerId: 'server-123',
  currentChannelId: 'channel-456',
  sidebarCollapsed: false,
  theme: 'dark'
}
```

**消息状态:**
```javascript
// 示例消息状态
{
  messages: [],
  isLoading: false,
  hasMore: true,
  scrollPosition: 0
}
```

## 动画效果

### 页面转场

**频道切换:**
- 淡入淡出效果
- 持续时间: 150ms

**服务器切换:**
- 快速切换，无动画
- 更新指示器位置

### 微交互

**消息发送:**
- 输入框清空动画
- 消息出现动画

**在线状态:**
- 状态指示器颜色变化
- 脉冲效果 (正在输入时)

## 开发实现建议

### 技术栈推荐

**框架:**
- React / Vue / Angular
- TypeScript

**样式:**
- CSS Modules / Styled Components
- Sass/SCSS

**状态管理:**
- Redux / Zustand / Pinia

### 组件拆分建议

**大组件:**
1. App (根组件)
2. ServerList (服务器列表)
3. ChannelList (频道列表)
4. MainContent (主内容区)

**中等组件:**
5. ServerIcon (服务器图标)
6. ChannelItem (频道项)
7. MessageList (消息列表)
8. MessageInput (消息输入)

**小组件:**
9. Avatar (头像)
10. Button (按钮)
11. Tooltip (提示框)
12. Icon (图标)

### 数据结构建议

**服务器数据:**
```typescript
interface Server {
  id: string;
  name: string;
  icon?: string;
  channels: Channel[];
}
```

**频道数据:**
```typescript
interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'announcement';
  category?: string;
}
```

**消息数据:**
```typescript
interface Message {
  id: string;
  content: string;
  author: User;
  timestamp: Date;
  attachments?: Attachment[];
  reactions?: Reaction[];
}
```

## 详细频道界面规范

### 1. 频道列表详细结构

**服务器信息区域 (在频道列表顶部):**

```css
.server-info-section {
  background: #2b2d31;
  border-bottom: 1px solid #1e1f22;
}

.server-banner {
  height: 84px;
  background-size: cover;
  background-position: center;
  position: relative;
}

.server-banner::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, #2b2d31);
}

.server-title-section {
  padding: 12px 16px 8px;
}

.server-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.server-subtitle {
  font-size: 13px;
  color: #949ba4;
  display: flex;
  align-items: center;
  gap: 4px;
}

.member-count::before {
  content: "•";
  color: #23a559;
  margin-right: 4px;
}

.server-guide {
  padding: 8px 16px 12px;
}

.server-guide-button {
  background: #5865f2;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  width: 100%;
}
```

**频道列表增强结构:**
```css
.channel-list-enhanced {
  padding-top: 8px;
}

.channel-category-enhanced {
  padding: 16px 8px 4px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.channel-category-enhanced h3 {
  color: #949ba4;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.channel-item-enhanced {
  padding: 6px 8px 6px 16px;
  margin: 1px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.channel-icon {
  width: 20px;
  height: 20px;
  color: #80848e;
}

.channel-name {
  flex: 1;
  font-size: 16px;
  font-weight: 500;
  color: #949ba4;
}

.channel-item-enhanced:hover {
  background: #35373c;
}

.channel-item-enhanced:hover .channel-name {
  color: #dbdee1;
}

.channel-item-enhanced.active {
  background: #404249;
}

.channel-item-enhanced.active .channel-name {
  color: #ffffff;
}

.channel-item-enhanced.active .channel-icon {
  color: #ffffff;
}
```

### 2. 频道全屏模态框系统

**模态框基础结构:**
```css
.channel-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.channel-modal {
  width: 100vw;
  height: 100vh;
  background: #313338;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.2s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  height: 56px;
  background: #2b2d31;
  border-bottom: 1px solid #1e1f22;
  display: flex;
  align-items: center;
  padding: 0 20px;
  position: relative;
}

.modal-close-button {
  position: absolute;
  right: 20px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #b5bac1;
  cursor: pointer;
  border-radius: 4px;
}

.modal-close-button:hover {
  background: #35373c;
  color: #dbdee1;
}

.modal-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

### 3. 论坛频道模态框

**论坛模态框特定结构:**
```css
.forum-modal .modal-header {
  padding: 0 20px;
}

.forum-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.forum-icon {
  width: 24px;
  height: 24px;
  color: #b5bac1;
}

.forum-controls {
  height: 48px;
  background: #313338;
  border-bottom: 1px solid #1e1f22;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
}

.sort-button,
.filter-tags-button {
  background: #4e5058;
  border: none;
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sort-button:hover,
.filter-tags-button:hover {
  background: #5d6269;
}

.forum-posts-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.forum-post-entry {
  background: #2b2d31;
  border: 1px solid #1e1f22;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.forum-post-entry:hover {
  background: #35373c;
  border-color: #404249;
}

.post-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.post-thumbnail {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.post-info {
  flex: 1;
  min-width: 0;
}

.post-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
  line-height: 1.2;
}

.post-preview {
  font-size: 14px;
  color: #b5bac1;
  line-height: 1.3;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.post-tag {
  background: #5865f2;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #949ba4;
}

.post-author {
  display: flex;
  align-items: center;
  gap: 6px;
}

.author-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.post-stats {
  display: flex;
  gap: 12px;
}
```

### 4. 帖子详情模态框

**帖子详情结构:**
```css
.post-detail-modal .modal-header {
  flex-direction: column;
  align-items: flex-start;
  height: auto;
  padding: 20px;
}

.post-detail-title {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 12px;
  line-height: 1.2;
}

.post-detail-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.post-content-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.original-post {
  padding: 20px 0;
  border-bottom: 2px solid #404249;
  margin-bottom: 20px;
}

.post-author-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.author-avatar-large {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.author-details {
  flex: 1;
}

.author-name {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.post-timestamp {
  font-size: 13px;
  color: #949ba4;
}

.post-content {
  font-size: 16px;
  line-height: 1.375;
  color: #dbdee1;
  margin-bottom: 16px;
}

.post-attachments {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.attachment-image {
  width: 100%;
  border-radius: 8px;
  cursor: pointer;
}

.floor-separator {
  height: 2px;
  background: #404249;
  margin: 20px 0;
  position: relative;
}

.floor-separator::after {
  content: "2楼及以下";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: #313338;
  color: #949ba4;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
}

.reply-section {
  padding: 16px 0;
}

.reply-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  background: #2b2d31;
}

.post-input-area {
  padding: 20px;
  background: #2b2d31;
  border-top: 1px solid #1e1f22;
}

.post-input-container {
  background: #383a40;
  border-radius: 8px;
  padding: 12px;
}

.post-input {
  width: 100%;
  background: transparent;
  border: none;
  color: #dcddde;
  font-size: 14px;
  resize: none;
  min-height: 44px;
  outline: none;
}

.post-input::placeholder {
  color: #72767d;
}

.input-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.input-tools {
  display: flex;
  gap: 8px;
}

.tool-button {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  color: #b5bac1;
  cursor: pointer;
  border-radius: 4px;
}

.tool-button:hover {
  background: #4e5058;
  color: #dbdee1;
}

.send-button {
  background: #5865f2;
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
}

.send-button:hover {
  background: #4752c4;
}

.send-button:disabled {
  background: #4e5058;
  cursor: not-allowed;
}
```

### 5. 文字频道模态框

**文字频道结构:**
```css
.text-channel-modal .modal-header {
  padding: 0 20px;
}

.text-channel-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-channel-icon {
  width: 24px;
  height: 24px;
  color: #80848e;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.message-group-detailed {
  padding: 0.125rem 4rem 0.125rem 4.5rem;
  margin: 0 1rem;
  position: relative;
  min-height: 2.75rem;
}

.message-group-detailed:hover {
  background: #2e3035;
}

.message-avatar {
  position: absolute;
  left: 16px;
  top: 0.125rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
}

.message-content-wrapper {
  position: relative;
  padding-left: 0;
}

.message-header {
  display: flex;
  align-items: baseline;
  margin-bottom: 0.125rem;
}

.message-username {
  font-size: 1rem;
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  margin-right: 0.25rem;
}

.message-username:hover {
  text-decoration: underline;
}

.message-timestamp {
  font-size: 0.75rem;
  color: #949ba4;
  font-weight: 500;
  margin-left: 0.25rem;
}

.message-text {
  font-size: 1rem;
  line-height: 1.375;
  color: #dcddde;
  word-wrap: break-word;
  user-select: text;
}

.text-input-area {
  padding: 0 16px 24px 16px;
}

.text-input-container {
  background: #383a40;
  border-radius: 8px;
  padding: 0;
  position: relative;
}

.text-input {
  background: transparent;
  border: none;
  color: #dcddde;
  font-size: 14px;
  line-height: 1.375;
  padding: 11px 16px 11px 16px;
  resize: none;
  width: 100%;
  outline: none;
  max-height: 50vh;
}

.text-input::placeholder {
  color: #72767d;
}

.text-input-toolbar {
  display: flex;
  align-items: center;
  padding: 0 16px 11px 16px;
}
```

### 6. 用户信息模态框

**用户模态框结构:**
```css
.user-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1100;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.user-modal {
  width: 100%;
  max-width: 400px;
  background: #2b2d31;
  border-radius: 8px 8px 0 0;
  animation: userModalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-height: 80vh;
  overflow: hidden;
}

@keyframes userModalSlideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.user-modal-header {
  height: 120px;
  background: linear-gradient(135deg, #5865f2, #7289da);
  position: relative;
  padding: 16px;
}

.user-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-modal-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 6px solid #2b2d31;
  position: absolute;
  bottom: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: #36393f;
}

.user-modal-content {
  padding: 50px 16px 16px;
  text-align: center;
}

.user-modal-name {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
}

.user-modal-discriminator {
  font-size: 14px;
  color: #949ba4;
  margin-bottom: 16px;
}

.user-status-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 3px solid #2b2d31;
  position: absolute;
  bottom: -6px;
  right: -6px;
}

.user-status-online {
  background: #23a559;
}

.user-status-idle {
  background: #faa61a;
}

.user-status-dnd {
  background: #ed4245;
}

.user-status-offline {
  background: #80848e;
}

.user-bio {
  background: #1e1f22;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  text-align: left;
}

.user-bio-title {
  font-size: 12px;
  font-weight: 600;
  color: #949ba4;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.user-bio-content {
  font-size: 14px;
  color: #dcddde;
  line-height: 1.3;
}

.user-action-buttons {
  display: flex;
  gap: 8px;
  padding: 0 16px 16px;
}

.user-action-button {
  flex: 1;
  background: #4e5058;
  border: none;
  color: #ffffff;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.user-action-button:hover {
  background: #5d6269;
}

.user-action-button.primary {
  background: #5865f2;
}

.user-action-button.primary:hover {
  background: #4752c4;
}
```

### 7. 模态框交互行为

**打开/关闭动画:**
```css
/* 频道模态框动画 */
.channel-modal-enter {
  opacity: 0;
  transform: scale(0.95);
}

.channel-modal-enter-active {
  opacity: 1;
  transform: scale(1);
  transition: opacity 200ms, transform 200ms;
}

.channel-modal-exit {
  opacity: 1;
  transform: scale(1);
}

.channel-modal-exit-active {
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 150ms, transform 150ms;
}

/* 用户模态框动画 */
.user-modal-enter {
  transform: translateY(100%);
  opacity: 0;
}

.user-modal-enter-active {
  transform: translateY(0);
  opacity: 1;
  transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms;
}

.user-modal-exit {
  transform: translateY(0);
  opacity: 1;
}

.user-modal-exit-active {
  transform: translateY(100%);
  opacity: 0;
  transition: transform 250ms ease-in, opacity 250ms;
}
```

**键盘和手势支持:**
```javascript
// 示例交互逻辑
const handleKeyPress = (event) => {
  if (event.key === 'Escape') {
    closeModal();
  }
  if (event.key === 'Enter' && event.ctrlKey) {
    sendMessage();
  }
};

const handleSwipeDown = (distance) => {
  if (distance > 100) {
    closeUserModal();
  }
};
```

### 8. 数据结构扩展

**论坛帖子数据:**
```typescript
interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: User;
  tags: string[];
  thumbnail?: string;
  attachments: Attachment[];
  replies: Reply[];
  createdAt: Date;
  updatedAt: Date;
  pinned: boolean;
  locked: boolean;
  reactionCount: number;
  replyCount: number;
}

interface Reply {
  id: string;
  content: string;
  author: User;
  attachments: Attachment[];
  createdAt: Date;
  floor: number; // 楼层号
  reactions: Reaction[];
}
```

**用户扩展数据:**
```typescript
interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  banner?: string;
  bio?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  customStatus?: string;
  joinedAt: Date;
  roles: Role[];
  badges: Badge[];
}
```

## 总结

本文档提供了完整的Discord UI界面规范，包括：
- 详细的布局结构和尺寸
- 完整的视觉设计系统
- 交互行为规范
- 响应式设计方案
- 状态管理建议

开发人员可以根据此文档完全复刻Discord的前端界面，实现所有UI交互效果，无需实际的业务逻辑支持。
