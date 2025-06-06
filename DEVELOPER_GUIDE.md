# CradleAI Matrix 聊天应用开发者指南

本文档为开发者提供了理解和扩展现有Matrix聊天应用功能的完整指南。

## 📋 目录

1. [项目架构概述](#项目架构概述)
2. [核心组件说明](#核心组件说明)
3. [Matrix集成架构](#matrix集成架构)
4. [现有功能介绍](#现有功能介绍)
5. [功能扩展指南](#功能扩展指南)
6. [最佳实践](#最佳实践)
7. [常见问题解决](#常见问题解决)
8. [API参考](#api参考)

## 🏗️ 项目架构概述

### 技术栈
- **前端框架**: React Native (Expo)
- **状态管理**: React Hooks (useState, useCallback, useMemo)
- **Matrix集成**: matrix-js-sdk
- **UI组件**: React Native内置组件 + Expo Vector Icons
- **类型支持**: TypeScript

### 目录结构
```
├── app/(tabs)/
│   └── server.tsx              # 主聊天界面
├── components/
│   ├── MatrixTestComponent.tsx # Matrix功能测试组件
│   └── MatrixTestPage.tsx      # Matrix测试页面
├── hooks/
│   └── useMatrix.ts            # Matrix状态管理Hook
├── lib/
│   ├── matrix/
│   │   ├── client.ts          # Matrix客户端管理
│   │   └── test-fix.ts        # 连接测试工具
│   └── polyfills.ts           # React Native兼容性补丁
├── constants/
│   └── theme.ts               # 主题配置
└── metro.config.js            # Metro打包配置
```

## 🧩 核心组件说明

### 1. Server组件 (`app/(tabs)/server.tsx`)

**主要职责**: Discord风格的聊天界面主组件

**关键子组件**:
- `LoginModal`: 用户登录注册模态框
- `CreateRoomModal`: 创建房间模态框  
- `ChatModal`: 聊天界面模态框
- `ServerList`: 服务器列表侧边栏
- `ChannelList`: 频道/房间列表
- `MainContent`: 主内容区域
- `TextChannelContent`: 文字频道内容预览

**状态管理**:
```typescript
// 界面状态
const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
const [showChannelModal, setShowChannelModal] = useState(false);
const [showLoginModal, setShowLoginModal] = useState(false);
const [messageInput, setMessageInput] = useState('');
const [messageRefresh, setMessageRefresh] = useState(0); // 消息刷新计数器

// 表单状态
const [loginUsername, setLoginUsername] = useState('');
const [loginPassword, setLoginPassword] = useState('');
const [newRoomName, setNewRoomName] = useState('');
```

### 2. useMatrix Hook (`hooks/useMatrix.ts`)

**主要职责**: Matrix SDK的React集成封装

**核心功能**:
- 用户认证管理
- 房间列表同步
- 消息发送接收
- 实时事件监听

**返回接口**:
```typescript
interface UseMatrixReturn {
  isConnected: boolean;           // 连接状态
  isLoading: boolean;            // 加载状态
  error: string | null;          // 错误信息
  rooms: MatrixRoom[];           // 房间列表
  currentUserId: string | null;  // 当前用户ID
  login: (username: string, password: string) => Promise<void>;
  createRoom: (name: string, topic?: string) => Promise<string>;
  sendMessage: (roomId: string, message: string) => Promise<void>;
  getRoomMessages: (roomId: string) => MatrixMessage[];
  disconnect: () => void;
}
```

### 3. MatrixClientManager (`lib/matrix/client.ts`)

**主要职责**: Matrix客户端的底层管理

**核心方法**:
```typescript
class MatrixClientManager {
  async initializeClient(credentials: MatrixCredentials): Promise<MatrixClient>
  getClient(): MatrixClient | null
  getRooms(): Room[]
  async createRoom(name: string, topic?: string): Promise<string>
  async sendMessage(roomId: string, message: string): Promise<string>
  getRoomMessages(roomId: string, limit?: number): MatrixEvent[]
  async login(username: string, password: string): Promise<MatrixCredentials>
  async register(username: string, password: string): Promise<MatrixCredentials>
  disconnect(): void
}
```

## 🔗 Matrix集成架构

### 事件监听机制

应用通过Matrix SDK的事件系统实现实时通信：

```typescript
// 设置事件监听器
const setupEventListeners = useCallback((client: MatrixClient) => {
  // 同步状态变化
  client.on(ClientEvent.Sync, (state: SyncState) => {
    switch (state) {
      case SyncState.Prepared:
        setIsConnected(true);
        updateRooms();
        break;
      case SyncState.Error:
        setIsConnected(false);
        break;
    }
  });

  // 新消息/时间线更新
  client.on(RoomEvent.Timeline, () => {
    updateRooms(); // 触发UI更新
  });

  // 成员关系变化
  client.on(RoomEvent.MyMembership, () => {
    updateRooms();
  });
}, [updateRooms]);
```

### 消息实时更新机制

为解决消息显示延迟问题，采用了强制刷新机制：

```typescript
// 刷新计数器触发重新获取
const [messageRefresh, setMessageRefresh] = useState(0);

const forceRefreshMessages = useCallback(() => {
  setMessageRefresh(prev => prev + 1);
}, []);

// 发送消息后触发刷新
const handleSendMessage = useCallback(async () => {
  await sendMessage(selectedChannel, messageInput.trim());
  setMessageInput('');
  
  // 立即刷新 + 延迟刷新
  forceRefreshMessages();
  setTimeout(() => forceRefreshMessages(), 500);
}, [messageInput, selectedChannel, sendMessage, forceRefreshMessages]);
```

## ✅ 现有功能介绍

### 1. 用户认证
- **登录**: 支持现有用户登录
- **注册**: 自动注册新用户
- **自动重试**: 登录失败时自动尝试注册
- **状态持久化**: 登录状态在应用重启后保持

### 2. 房间管理
- **创建房间**: 创建公开Matrix房间
- **房间列表**: 实时显示已加入的房间
- **房间选择**: 点击房间进入聊天界面
- **成员计数**: 显示房间成员数量

### 3. 消息功能
- **发送消息**: 文本消息发送
- **实时接收**: 接收其他用户消息
- **消息历史**: 显示房间历史消息
- **双端同步**: 与Element等客户端实时同步

### 4. 界面交互
- **模态框聊天**: 全屏聊天界面
- **消息预览**: 主界面显示最近3条消息
- **快速发送**: 主界面快速发送消息
- **响应式设计**: 支持不同屏幕尺寸

## 🚀 功能扩展指南

### 1. 添加新的消息类型

#### 步骤1: 扩展消息接口
```typescript
// hooks/useMatrix.ts
export interface MatrixMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  messageType: 'm.text' | 'm.image' | 'm.file' | 'm.audio'; // 新增
  fileUrl?: string;     // 新增：文件URL
  fileName?: string;    // 新增：文件名
  fileSize?: number;    // 新增：文件大小
}
```

#### 步骤2: 扩展客户端发送方法
```typescript
// lib/matrix/client.ts
class MatrixClientManager {
  // 发送图片消息
  async sendImageMessage(roomId: string, file: File): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');
    
    try {
      // 上传文件
      const uploadResponse = await this.client.uploadContent(file);
      
      // 发送图片消息
      const content = {
        msgtype: 'm.image',
        body: file.name,
        url: uploadResponse.content_uri,
        info: {
          size: file.size,
          mimetype: file.type,
        }
      };
      
      const response = await this.client.sendEvent(roomId, 'm.room.message', content);
      return response.event_id;
    } catch (error) {
      console.error('发送图片失败:', error);
      throw error;
    }
  }
  
  // 发送文件消息
  async sendFileMessage(roomId: string, file: File): Promise<string> {
    // 类似实现...
  }
}
```

#### 步骤3: 扩展Hook接口
```typescript
// hooks/useMatrix.ts
export interface UseMatrixReturn {
  // ... 现有方法
  sendImageMessage: (roomId: string, file: File) => Promise<void>;
  sendFileMessage: (roomId: string, file: File) => Promise<void>;
}

export function useMatrix(): UseMatrixReturn {
  // 发送图片消息
  const sendImageMessage = useCallback(async (roomId: string, file: File): Promise<void> => {
    try {
      await matrixClient.sendImageMessage(roomId, file);
      // 触发刷新
      forceRefreshMessages();
    } catch (err: any) {
      setError(err.message || '发送图片失败');
      throw err;
    }
  }, []);

  return {
    // ... 现有返回值
    sendImageMessage,
    sendFileMessage,
  };
}
```

#### 步骤4: 更新UI组件
```typescript
// 在ChatModal中添加文件选择按钮
const ChatModal = memo(({ /* props */ }) => (
  <Modal>
    {/* ... 现有内容 */}
    <View style={styles.chatInputRow}>
      <TouchableOpacity 
        style={styles.fileButton}
        onPress={handleFileSelect}
      >
        <Ionicons name="attach" size={20} color="#949ba4" />
      </TouchableOpacity>
      
      <TextInput
        style={styles.chatInput}
        placeholder="在此输入消息..."
        value={messageInput}
        onChangeText={onMessageInputChange}
      />
      
      <TouchableOpacity 
        style={styles.chatSendButton}
        onPress={onSendMessage}
      >
        <Ionicons name="send" size={16} color="#ffffff" />
      </TouchableOpacity>
    </View>
  </Modal>
));
```

### 2. 添加私聊功能

#### 步骤1: 扩展房间类型
```typescript
// hooks/useMatrix.ts
export interface MatrixRoom {
  id: string;
  name: string;
  topic?: string;
  numJoinedMembers: number;
  isDirect: boolean;        // 新增：是否为私聊
  otherUserId?: string;     // 新增：私聊对方ID
}
```

#### 步骤2: 添加创建私聊方法
```typescript
// lib/matrix/client.ts
async createDirectMessage(targetUserId: string): Promise<string> {
  if (!this.client) throw new Error('客户端未初始化');

  const response = await this.client.createRoom({
    preset: 'trusted_private_chat',
    visibility: 'private',
    invite: [targetUserId],
    is_direct: true
  });

  // 标记为私聊
  await this.client.setAccountData('m.direct', {
    [targetUserId]: [response.room_id]
  });

  return response.room_id;
}
```

#### 步骤3: 添加用户搜索UI
```typescript
// 新增UserSearchModal组件
const UserSearchModal = memo(({
  visible,
  onClose,
  onSelectUser
}: {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);

  const handleSearch = useCallback(async () => {
    // 实现用户搜索逻辑
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('搜索用户失败:', error);
    }
  }, [searchQuery]);

  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <View style={styles.searchModal}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索用户..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userItem}
              onPress={() => onSelectUser(item)}
            >
              <Text style={styles.userName}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
});
```

### 3. 添加消息回复功能

#### 步骤1: 扩展消息数据结构
```typescript
export interface MatrixMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  replyTo?: {              // 新增：回复信息
    eventId: string;
    senderName: string;
    content: string;
  };
}
```

#### 步骤2: 实现回复发送
```typescript
// lib/matrix/client.ts
async sendReplyMessage(
  roomId: string, 
  message: string, 
  originalEventId: string,
  originalSender: string,
  originalContent: string
): Promise<string> {
  if (!this.client) throw new Error('客户端未初始化');

  const content = {
    msgtype: 'm.text',
    body: `> <${originalSender}> ${originalContent}\n\n${message}`,
    format: 'org.matrix.custom.html',
    formatted_body: `<mx-reply><blockquote><a href="https://matrix.to/#/${roomId}/${originalEventId}">In reply to</a> <a href="https://matrix.to/#/${originalSender}">${originalSender}</a><br>${originalContent}</blockquote></mx-reply>${message}`,
    'm.relates_to': {
      'm.in_reply_to': {
        event_id: originalEventId
      }
    }
  };

  const response = await this.client.sendEvent(roomId, 'm.room.message', content);
  return response.event_id;
}
```

#### 步骤3: 添加回复UI
```typescript
// 在ChatModal中添加回复状态
const [replyingTo, setReplyingTo] = useState<MatrixMessage | null>(null);

// 消息长按处理
const handleMessageLongPress = useCallback((message: MatrixMessage) => {
  Alert.alert(
    '消息操作',
    '选择操作',
    [
      { text: '回复', onPress: () => setReplyingTo(message) },
      { text: '取消', style: 'cancel' }
    ]
  );
}, []);

// 回复输入区域
{replyingTo && (
  <View style={styles.replyPreview}>
    <Text style={styles.replyText}>
      回复 {replyingTo.sender}: {replyingTo.content}
    </Text>
    <TouchableOpacity onPress={() => setReplyingTo(null)}>
      <Ionicons name="close" size={16} color="#949ba4" />
    </TouchableOpacity>
  </View>
)}
```

### 4. 添加消息状态指示器

#### 步骤1: 扩展消息状态
```typescript
export interface MatrixMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'failed'; // 新增
}
```

#### 步骤2: 实现状态跟踪
```typescript
// hooks/useMatrix.ts
const [pendingMessages, setPendingMessages] = useState<Map<string, MatrixMessage>>(new Map());

const sendMessage = useCallback(async (roomId: string, message: string): Promise<void> => {
  const tempId = `temp_${Date.now()}`;
  const tempMessage: MatrixMessage = {
    id: tempId,
    sender: currentUserId || 'unknown',
    content: message,
    timestamp: new Date().toLocaleTimeString(),
    status: 'sending'
  };

  // 添加到待发送消息列表
  setPendingMessages(prev => new Map(prev.set(tempId, tempMessage)));

  try {
    const eventId = await matrixClient.sendMessage(roomId, message);
    
    // 发送成功，移除待发送消息
    setPendingMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(tempId);
      return newMap;
    });
    
    forceRefreshMessages();
  } catch (err: any) {
    // 发送失败，更新状态
    setPendingMessages(prev => new Map(prev.set(tempId, {
      ...tempMessage,
      status: 'failed'
    })));
    
    setError(err.message || '发送消息失败');
    throw err;
  }
}, [currentUserId, forceRefreshMessages]);
```

## 📝 最佳实践

### 1. 状态管理
- **使用useCallback**: 对所有事件处理函数使用useCallback避免不必要的重新渲染
- **合理使用useMemo**: 只对计算成本高的数据使用useMemo
- **避免过度优化**: 不要为简单的数据计算使用useMemo

```typescript
// ✅ 好的做法
const handleSendMessage = useCallback(async () => {
  // 处理逻辑
}, [dependencies]);

// ❌ 避免的做法  
const handleSendMessage = async () => {
  // 每次渲染都会重新创建函数
};
```

### 2. 组件设计
- **提取为React.memo组件**: 对于复杂的模态框组件使用React.memo
- **Props接口明确**: 为每个组件定义清晰的Props接口
- **单一职责**: 每个组件专注于单一功能

```typescript
// ✅ 好的组件设计
const ChatModal = memo(({
  visible,
  onClose,
  currentChannel,
  messages,
  onSendMessage
}: ChatModalProps) => {
  // 组件实现
});

// 明确的Props类型
interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  currentChannel?: MatrixRoom;
  messages: MatrixMessage[];
  onSendMessage: () => void;
}
```

### 3. 错误处理
- **统一错误处理**: 在Hook层面统一处理错误
- **用户友好提示**: 提供清晰的错误信息给用户
- **降级处理**: 在网络错误时提供离线功能

```typescript
// ✅ 统一错误处理
const sendMessage = useCallback(async (roomId: string, message: string) => {
  try {
    await matrixClient.sendMessage(roomId, message);
    forceRefreshMessages();
  } catch (err: any) {
    setError(err.message || '发送消息失败');
    // 可以添加重试逻辑
    throw err;
  }
}, []);
```

### 4. 性能优化
- **消息分页**: 实现消息分页加载
- **虚拟列表**: 对于大量消息使用虚拟列表
- **图片懒加载**: 实现图片懒加载机制

```typescript
// 消息分页示例
const [messageLimit, setMessageLimit] = useState(50);

const loadMoreMessages = useCallback(() => {
  setMessageLimit(prev => prev + 50);
}, []);

const messages = useMemo(() => 
  getRoomMessages(selectedChannel).slice(-messageLimit), 
  [selectedChannel, messageLimit, messageRefresh]
);
```

## 🔧 常见问题解决

### 1. 模态框闪烁问题
**问题**: 输入时模态框重复弹出收回
**解决**: 使用React.memo + useCallback优化

```typescript
// 提取为独立的memo组件
const Modal = memo(({ visible, onClose, ...props }) => (
  <Modal visible={visible} onRequestClose={onClose}>
    {/* 内容 */}
  </Modal>
));

// 使用稳定的回调函数
const handleClose = useCallback(() => {
  setVisible(false);
}, []);
```

### 2. 消息不实时更新
**问题**: 发送消息后不立即显示
**解决**: 实现强制刷新机制

```typescript
const [refreshCounter, setRefreshCounter] = useState(0);

const forceRefresh = useCallback(() => {
  setRefreshCounter(prev => prev + 1);
}, []);

// 在依赖数组中包含refreshCounter
const messages = useMemo(() => 
  getRoomMessages(roomId), 
  [roomId, refreshCounter]
);
```

### 3. Matrix SDK兼容性问题
**问题**: React Native环境缺少Node.js模块
**解决**: 配置polyfills和Metro配置

```javascript
// metro.config.js
config.resolver.extraNodeModules = {
  ...require('node-libs-react-native'),
  events: require.resolve('events/'),
  buffer: require.resolve('buffer/'),
};
```

### 4. 内存泄漏问题
**问题**: 事件监听器未正确清理
**解决**: 实现proper的cleanup机制

```typescript
useEffect(() => {
  // 设置监听器
  const cleanup = setupEventListeners();
  
  // 清理函数
  return () => {
    cleanup();
  };
}, []);
```

## 📚 API参考

### MatrixClientManager API

```typescript
interface MatrixClientManager {
  // 初始化
  initializeClient(credentials: MatrixCredentials): Promise<MatrixClient>
  getClient(): MatrixClient | null
  isClientReady(): boolean
  
  // 认证
  login(username: string, password: string): Promise<MatrixCredentials>
  register(username: string, password: string): Promise<MatrixCredentials>
  disconnect(): void
  
  // 房间操作
  getRooms(): Room[]
  createRoom(name: string, topic?: string): Promise<string>
  
  // 消息操作
  sendMessage(roomId: string, message: string): Promise<string>
  getRoomMessages(roomId: string, limit?: number): MatrixEvent[]
}
```

### useMatrix Hook API

```typescript
interface UseMatrixReturn {
  // 状态
  isConnected: boolean
  isLoading: boolean
  error: string | null
  rooms: MatrixRoom[]
  currentUserId: string | null
  
  // 方法
  login(username: string, password: string): Promise<void>
  createRoom(name: string, topic?: string): Promise<string>
  sendMessage(roomId: string, message: string): Promise<void>
  getRoomMessages(roomId: string): MatrixMessage[]
  disconnect(): void
}
```

### 数据类型定义

```typescript
interface MatrixCredentials {
  homeserverUrl: string
  accessToken: string
  userId: string
  deviceId?: string
}

interface MatrixRoom {
  id: string
  name: string
  topic?: string
  numJoinedMembers: number
}

interface MatrixMessage {
  id: string
  sender: string
  content: string
  timestamp: string
}
```

## 🎯 扩展建议

### 短期扩展 (1-2周)
1. **文件发送**: 实现图片、文档发送功能
2. **消息回复**: 添加消息回复和引用功能
3. **用户列表**: 显示房间成员列表
4. **消息搜索**: 实现房间内消息搜索

### 中期扩展 (1个月)
1. **私聊功能**: 实现用户间私聊
2. **推送通知**: 集成推送通知服务
3. **离线支持**: 实现离线消息缓存
4. **消息状态**: 显示消息发送/接收状态

### 长期扩展 (2-3个月)
1. **语音通话**: 集成WebRTC语音通话
2. **视频通话**: 实现视频通话功能
3. **端到端加密**: 集成Matrix E2E加密
4. **多媒体支持**: 支持更多文件类型

---

**维护说明**: 本文档应随着代码更新而及时更新，确保开发者能够准确理解最新的架构和API。

## 🎉 最新功能更新 (Server.tsx 新增功能)

### 已实现的新功能

基于`client.ts`中的完整Matrix SDK功能，我们已经为`server.tsx`组件添加了以下新功能的完整UI/UX支持：

#### 1. **增强消息功能** ✅
- **文件上传**: 支持拍照、相册选择、文档选择
- **消息操作菜单**: 长按消息显示操作选项
- **消息回复**: 可以回复特定消息，显示回复预览
- **消息编辑**: 可以编辑自己发送的消息
- **消息删除**: 可以删除自己发送的消息
- **表情反应**: 快速添加表情符号反应
- **消息固定**: 固定重要消息
- **正在输入状态**: 实时显示正在输入状态

#### 2. **高级搜索功能** ✅
- **消息搜索**: 全局和房间内消息搜索
- **用户搜索**: 搜索Matrix用户
- **公开房间浏览**: 浏览和加入公开房间

#### 3. **用户交互功能** ✅
- **用户邀请**: 邀请用户到当前房间
- **创建私聊**: 与搜索到的用户创建私聊
- **文件拖放上传**: 支持多种文件类型上传

#### 4. **UI/UX 改进** ✅
- **消息状态显示**: 显示已编辑、已删除等状态
- **回复预览**: 消息回复时的可视化预览
- **附件按钮**: 文件上传的便捷入口
- **操作按钮组**: 搜索、用户搜索、公开房间浏览
- **模态框界面**: 各功能的专用界面

### 新增的UI组件

#### Modal Components
```typescript
// 消息操作菜单
MessageMenuModal: {
  actions: ['reply', 'edit', 'delete', 'react', 'pin', 'forward']
}

// 消息编辑界面
EditMessageModal: {
  features: ['multiline_input', 'save_cancel', 'loading_state']
}

// 搜索界面
SearchModal: {
  features: ['search_input', 'results_list', 'loading_indicator']
}

// 用户搜索界面
UserSearchModal: {
  features: ['user_search', 'invite_button', 'direct_message']
}
```

#### Enhanced Chat Features
```typescript
// 增强的聊天界面
ChatModal: {
  new_features: [
    'file_upload_button',
    'message_long_press',
    'reply_preview',
    'typing_indicators',
    'message_status_display'
  ]
}
```

### 技术特性

#### 1. **状态管理**
- 使用React Hooks进行状态管理
- 优化的useCallback使用减少重渲染
- 集中的错误处理机制

#### 2. **文件处理**
- 支持图片、视频、文档等多种文件类型
- 平台适配的文件选择器
- 文件类型自动识别

#### 3. **实时功能**
- 正在输入状态同步
- 消息实时更新
- 强制刷新机制确保数据同步

#### 4. **用户体验**
- 响应式设计适配不同屏幕
- 加载状态指示器
- 错误提示和确认对话框
- 直观的操作反馈

### 使用指南

#### 基本操作
1. **发送文件**: 点击聊天输入框左侧的附件按钮
2. **操作消息**: 长按任意消息显示操作菜单
3. **回复消息**: 选择"回复"后在输入框上方显示回复预览
4. **搜索**: 点击服务器标题右侧的搜索按钮
5. **添加用户**: 点击用户添加按钮搜索并邀请用户

#### 高级功能
1. **编辑消息**: 长按自己的消息选择"编辑"
2. **添加表情**: 长按消息选择"添加表情"快速添加👍
3. **固定消息**: 长按消息选择"固定消息"
4. **创建私聊**: 搜索用户后点击聊天气泡图标

### 开发者注意事项

#### 待完善功能
1. **消息转发**: UI已准备就绪，需要实现转发逻辑
2. **已读回执**: 需要完善setRoomReadMarkers实现
3. **高级搜索**: 需要修复search API的TypeScript类型问题
4. **推送通知**: 尚未集成
5. **端到端加密**: 需要启用Olm/Megolm

#### 性能优化
1. **消息分页**: 大量消息时的性能优化
2. **虚拟列表**: 优化长消息列表渲染
3. **图片懒加载**: 优化图片显示性能

#### 兼容性
1. **React Native文件API**: 使用expo-document-picker和expo-image-picker
2. **平台差异**: iOS和Android的ActionSheet差异处理
3. **TypeScript类型**: Matrix SDK类型定义的兼容性

### 代码结构

```
app/(tabs)/server.tsx
├── 状态管理 (useState hooks)
├── 事件处理函数 (useCallback)
├── UI组件
│   ├── LoginModal
│   ├── CreateRoomModal  
│   ├── ChatModal (增强版)
│   ├── MessageMenuModal (新增)
│   ├── EditMessageModal (新增)
│   ├── SearchModal (新增)
│   └── UserSearchModal (新增)
└── 样式定义 (StyleSheet)
```

这次更新为Matrix聊天应用提供了**接近完整的即时通讯功能**，用户现在可以享受现代聊天应用的大部分核心功能。 