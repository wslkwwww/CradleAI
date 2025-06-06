# CradleAI Matrix 快速入门指南

> 🚀 5分钟快速了解现有功能和扩展方法

## 📁 项目结构

```
app/(tabs)/server.tsx    ← 🎯 主界面 (Discord风格聊天)
hooks/useMatrix.ts       ← 🔌 Matrix状态管理
lib/matrix/client.ts     ← ⚙️ Matrix客户端底层
lib/polyfills.ts         ← 🔧 React Native兼容性
```

## 🏃‍♂️ 现有功能

✅ **已实现**:
- 用户登录/注册 (自动fallback)
- 创建/加入Matrix房间
- 实时发送/接收消息
- Discord风格UI界面
- 与Element客户端实时同步

⚡ **核心组件**:
- `LoginModal` - 登录界面
- `CreateRoomModal` - 创建房间
- `ChatModal` - 全屏聊天
- `useMatrix` - Matrix状态Hook

## 🛠️ 如何添加新功能

### 1️⃣ 添加图片发送 (15分钟)

```typescript
// 步骤1: 扩展接口 (hooks/useMatrix.ts)
export interface MatrixMessage {
  // ... 现有字段
  messageType?: 'm.text' | 'm.image';
  fileUrl?: string;
}

// 步骤2: 添加发送方法 (lib/matrix/client.ts)
async sendImageMessage(roomId: string, file: File): Promise<string> {
  const upload = await this.client.uploadContent(file);
  return await this.client.sendEvent(roomId, 'm.room.message', {
    msgtype: 'm.image',
    body: file.name,
    url: upload.content_uri
  });
}

// 步骤3: Hook集成 (hooks/useMatrix.ts)
const sendImageMessage = useCallback(async (roomId: string, file: File) => {
  await matrixClient.sendImageMessage(roomId, file);
  forceRefreshMessages(); // 重要：刷新UI
}, []);

// 步骤4: UI更新 (server.tsx ChatModal)
<TouchableOpacity onPress={handleImagePicker}>
  <Ionicons name="camera" size={20} color="#949ba4" />
</TouchableOpacity>
```

### 2️⃣ 添加消息回复 (20分钟)

```typescript
// 步骤1: 扩展消息结构
interface MatrixMessage {
  // ... 现有字段
  replyTo?: {
    eventId: string;
    content: string;
    sender: string;
  };
}

// 步骤2: 实现回复发送 (lib/matrix/client.ts)
async sendReplyMessage(roomId: string, message: string, originalEvent: string) {
  return await this.client.sendEvent(roomId, 'm.room.message', {
    msgtype: 'm.text',
    body: message,
    'm.relates_to': {
      'm.in_reply_to': { event_id: originalEvent }
    }
  });
}

// 步骤3: 添加回复UI状态 (server.tsx)
const [replyingTo, setReplyingTo] = useState<MatrixMessage | null>(null);

// 长按消息触发回复
const handleMessageLongPress = (message: MatrixMessage) => {
  setReplyingTo(message);
};
```

### 3️⃣ 添加私聊功能 (30分钟)

```typescript
// 步骤1: 扩展房间类型 (hooks/useMatrix.ts)
interface MatrixRoom {
  // ... 现有字段
  isDirect: boolean;
  otherUserId?: string;
}

// 步骤2: 创建私聊方法 (lib/matrix/client.ts)
async createDirectMessage(targetUserId: string): Promise<string> {
  const response = await this.client.createRoom({
    preset: 'trusted_private_chat',
    invite: [targetUserId],
    is_direct: true
  });
  
  // 标记为DM
  await this.client.setAccountData('m.direct', {
    [targetUserId]: [response.room_id]
  });
  
  return response.room_id;
}

// 步骤3: 添加用户搜索UI
const UserSearchModal = memo(() => {
  // 用户搜索和选择逻辑
});
```

## 🎯 关键架构概念

### 消息刷新机制
```typescript
// 强制刷新消息列表的关键模式
const [messageRefresh, setMessageRefresh] = useState(0);

const forceRefreshMessages = useCallback(() => {
  setMessageRefresh(prev => prev + 1);
}, []);

// 发送消息后立即刷新 + 延迟刷新
await sendMessage(roomId, content);
forceRefreshMessages();
setTimeout(forceRefreshMessages, 500);
```

### React优化模式
```typescript
// 提取模态框为memo组件避免闪烁
const LoginModal = memo(({ visible, onClose, ... }) => (
  <Modal visible={visible} onRequestClose={onClose}>
    {/* 内容 */}
  </Modal>
));

// 使用useCallback稳定事件处理函数
const handleLogin = useCallback(async () => {
  // 登录逻辑
}, [username, password]);
```

### Matrix事件监听
```typescript
// 实时同步的核心模式
client.on(ClientEvent.Sync, (state) => {
  if (state === SyncState.Prepared) {
    updateRooms(); // 更新房间列表
  }
});

client.on(RoomEvent.Timeline, () => {
  updateRooms(); // 新消息时更新
});
```

## 🚨 常见问题

**Q: 模态框输入时闪烁？**
A: 使用`React.memo`提取组件 + `useCallback`稳定回调

**Q: 消息发送后不显示？**
A: 调用`forceRefreshMessages()`强制刷新

**Q: Matrix SDK报错？**
A: 检查`lib/polyfills.ts`和`metro.config.js`配置

**Q: 性能问题？**
A: 避免过度使用`useMemo`，优先使用`useCallback`

## 📋 开发清单

在开始开发新功能前，请确认：

- [ ] 理解`useMatrix` Hook的工作机制
- [ ] 熟悉`MatrixClientManager`的API
- [ ] 了解消息刷新机制的重要性
- [ ] 掌握React.memo + useCallback优化模式
- [ ] 知道如何正确处理Matrix事件监听

## 🔗 相关文档

- 📖 [完整开发者指南](./DEVELOPER_GUIDE.md)
- 🔌 [Matrix JS SDK文档](https://matrix-org.github.io/matrix-js-sdk/)
- ⚛️ [React Native文档](https://reactnative.dev/)

---

💡 **提示**: 在实现新功能时，参考现有的`sendMessage`和`createRoom`实现模式，它们包含了正确的错误处理和UI更新逻辑。 