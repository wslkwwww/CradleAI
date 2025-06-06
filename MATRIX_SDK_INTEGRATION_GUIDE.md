# Matrix JS SDK 集成指南 - 从 Discord 风格应用开始

本指南将详细介绍如何在现有的 Discord 风格前端应用中集成 Matrix JS SDK，实现完整的即时通讯功能。

## 目录

1. [Matrix 基础概念](#matrix-基础概念)
2. [SDK 安装与配置](#sdk-安装与配置)
3. [基础客户端设置](#基础客户端设置)
4. [用户认证](#用户认证)
5. [房间管理](#房间管理)
6. [消息处理](#消息处理)
7. [实时同步](#实时同步)
8. [与现有应用集成](#与现有应用集成)
9. [完整示例](#完整示例)
10. [测试和调试](#测试和调试)
11. [用户状态与通知管理](#用户状态与通知管理)

## Matrix 基础概念

### 核心概念
- **Homeserver**: Matrix 服务器，你的域名为 `cradleintro.top`
- **User ID**: 格式为 `@username:cradleintro.top`
- **Room**: 对话空间，类似 Discord 的频道
- **Event**: 所有消息和状态变化都是事件
- **Device**: 每个登录会话对应一个设备

### 房间类型
- **Public Rooms**: 公开房间，任何人都可以加入
- **Private Rooms**: 私人房间，需要邀请才能加入
- **Direct Messages**: 私聊房间

## SDK 安装与配置

### 1. 依赖安装

```bash
# 主要依赖
yarn add matrix-js-sdk

# 可选：如果需要端到端加密
yarn add @matrix-org/olm
yarn add @matrix-org/matrix-sdk-crypto-wasm
```

### 2. TypeScript 类型定义

Matrix JS SDK 已包含 TypeScript 定义，无需额外安装。

## 基础客户端设置

### 1. 创建 Matrix 客户端

```typescript
// lib/matrix/client.ts
import { createClient, MatrixClient, ICreateClientOpts } from 'matrix-js-sdk';

export class MatrixClientManager {
  private client: MatrixClient | null = null;
  private homeserverUrl = 'https://official.cradleintro.top';

  // 创建客户端实例
  createClient(options: Partial<ICreateClientOpts> = {}): MatrixClient {
    const clientOptions: ICreateClientOpts = {
      baseUrl: this.homeserverUrl,
      timelineSupport: true,
      unstableClientRelationAggregation: true,
      ...options
    };

    this.client = createClient(clientOptions);
    return this.client;
  }

  // 获取当前客户端
  getClient(): MatrixClient | null {
    return this.client;
  }

  // 检查客户端是否已登录
  isLoggedIn(): boolean {
    return this.client?.isLoggedIn() ?? false;
  }
}

export const matrixClientManager = new MatrixClientManager();
```

### 2. 环境配置

```typescript
// lib/matrix/config.ts
export const MATRIX_CONFIG = {
  HOMESERVER_URL: 'https://official.cradleintro.top',
  IDENTITY_SERVER_URL: undefined, // 可选
  DEFAULT_DEVICE_DISPLAY_NAME: 'CradleAI App',
  SYNC_LIMIT: 20,
  PAGINATION_LIMIT: 30,
};
```

## 用户认证

### 1. 注册新用户

```typescript
// lib/matrix/auth.ts
import { matrixClientManager } from './client';
import { MATRIX_CONFIG } from './config';

export class MatrixAuth {
  
  // 注册新用户
  async register(username: string, password: string, displayName?: string): Promise<{
    user_id: string;
    access_token: string;
    device_id: string;
  }> {
    const client = matrixClientManager.createClient();
    
    try {
      // 检查用户名是否可用
      const isAvailable = await client.isUsernameAvailable(username);
      if (!isAvailable) {
        throw new Error('用户名已被占用');
      }

      // 注册用户
      const response = await client.register(
        username,
        password,
        null, // sessionId
        { type: 'm.login.dummy' }, // auth
        undefined, // bindThreepids
        undefined, // guestAccessToken
        false // inhibitLogin - false 表示注册后自动登录
      );

      // 设置显示名称
      if (displayName && response.access_token) {
        await client.setDisplayName(displayName);
      }

      return {
        user_id: response.user_id,
        access_token: response.access_token,
        device_id: response.device_id
      };
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  }

  // 用户登录
  async login(username: string, password: string): Promise<{
    user_id: string;
    access_token: string;
    device_id: string;
  }> {
    const client = matrixClientManager.createClient();
    
    try {
      const response = await client.loginWithPassword(username, password);
      
      return {
        user_id: response.user_id,
        access_token: response.access_token,
        device_id: response.device_id
      };
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  // 登出
  async logout(): Promise<void> {
    const client = matrixClientManager.getClient();
    if (client) {
      try {
        await client.logout(true); // stopClient = true
      } catch (error) {
        console.error('登出失败:', error);
        throw error;
      }
    }
  }

  // 使用已有的访问令牌登录
  async loginWithToken(accessToken: string, userId: string, deviceId: string): Promise<MatrixClient> {
    const client = matrixClientManager.createClient({
      accessToken,
      userId,
      deviceId
    });

    // 验证令牌是否有效
    try {
      await client.whoami();
      return client;
    } catch (error) {
      console.error('令牌无效:', error);
      throw new Error('访问令牌无效');
    }
  }
}

export const matrixAuth = new MatrixAuth();
```

### 2. 存储用户凭据

```typescript
// lib/matrix/storage.ts
interface UserCredentials {
  userId: string;
  accessToken: string;
  deviceId: string;
}

export class MatrixStorage {
  private static readonly STORAGE_KEY = 'matrix_credentials';

  // 保存用户凭据
  static saveCredentials(credentials: UserCredentials): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(credentials));
    } catch (error) {
      console.error('保存凭据失败:', error);
    }
  }

  // 获取用户凭据
  static getCredentials(): UserCredentials | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('获取凭据失败:', error);
      return null;
    }
  }

  // 清除用户凭据
  static clearCredentials(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('清除凭据失败:', error);
    }
  }
}
```

## 房间管理

### 1. 创建房间

```typescript
// lib/matrix/rooms.ts
import { matrixClientManager } from './client';
import { ICreateRoomOpts, Preset, Visibility } from 'matrix-js-sdk';

export class MatrixRooms {
  
  // 创建公开房间（类似 Discord 频道）
  async createPublicRoom(name: string, topic?: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const options: ICreateRoomOpts = {
      name,
      topic,
      preset: Preset.PublicChat,
      visibility: Visibility.Public,
      initial_state: [
        {
          type: 'm.room.history_visibility',
          content: { history_visibility: 'world_readable' }
        }
      ]
    };

    try {
      const response = await client.createRoom(options);
      return response.room_id;
    } catch (error) {
      console.error('创建公开房间失败:', error);
      throw error;
    }
  }

  // 创建私人房间（群聊）
  async createPrivateRoom(name: string, topic?: string, inviteUserIds?: string[]): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const options: ICreateRoomOpts = {
      name,
      topic,
      preset: Preset.PrivateChat,
      visibility: Visibility.Private,
      invite: inviteUserIds || []
    };

    try {
      const response = await client.createRoom(options);
      return response.room_id;
    } catch (error) {
      console.error('创建私人房间失败:', error);
      throw error;
    }
  }

  // 创建直接消息房间
  async createDirectMessage(targetUserId: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const options: ICreateRoomOpts = {
      preset: Preset.TrustedPrivateChat,
      visibility: Visibility.Private,
      invite: [targetUserId],
      is_direct: true
    };

    try {
      const response = await client.createRoom(options);
      
      // 标记为直接消息
      const currentUserId = client.getUserId();
      if (currentUserId) {
        await client.setAccountData('m.direct', {
          [targetUserId]: [response.room_id]
        });
      }

      return response.room_id;
    } catch (error) {
      console.error('创建直接消息失败:', error);
      throw error;
    }
  }

  // 加入房间
  async joinRoom(roomIdOrAlias: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.joinRoom(roomIdOrAlias);
    } catch (error) {
      console.error('加入房间失败:', error);
      throw error;
    }
  }

  // 离开房间
  async leaveRoom(roomId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.leave(roomId);
    } catch (error) {
      console.error('离开房间失败:', error);
      throw error;
    }
  }

  // 邀请用户到房间
  async inviteUser(roomId: string, userId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.invite(roomId, userId);
    } catch (error) {
      console.error('邀请用户失败:', error);
      throw error;
    }
  }

  // 获取公开房间列表
  async getPublicRooms(limit = 20, since?: string) {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      return await client.publicRooms({ limit, since });
    } catch (error) {
      console.error('获取公开房间失败:', error);
      throw error;
    }
  }

  // 设置房间主题
  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.sendStateEvent(roomId, 'm.room.topic', { topic }, '');
    } catch (error) {
      console.error('设置房间主题失败:', error);
      throw error;
    }
  }

  // 设置房间名称
  async setRoomName(roomId: string, name: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.setRoomName(roomId, name);
    } catch (error) {
      console.error('设置房间名称失败:', error);
      throw error;
    }
  }

  // 设置房间头像
  async setRoomAvatar(roomId: string, avatarFile: File): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 上传头像文件
      const uploadResponse = await client.uploadContent(avatarFile);
      
      // 设置房间头像
      await client.sendStateEvent(roomId, 'm.room.avatar', {
        url: uploadResponse.content_uri
      }, '');
    } catch (error) {
      console.error('设置房间头像失败:', error);
      throw error;
    }
  }

  // 启用房间端到端加密
  async enableRoomEncryption(roomId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.sendStateEvent(roomId, 'm.room.encryption', {
        algorithm: 'm.megolm.v1.aes-sha2'
      }, '');
    } catch (error) {
      console.error('启用房间加密失败:', error);
      throw error;
    }
  }

  // 设置房间权限级别
  async setRoomPowerLevels(roomId: string, powerLevels: {
    users?: { [userId: string]: number };
    events?: { [eventType: string]: number };
    events_default?: number;
    state_default?: number;
    ban?: number;
    kick?: number;
    redact?: number;
    invite?: number;
  }): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 获取当前权限级别
      const room = client.getRoom(roomId);
      const currentPowerLevels = room?.currentState.getStateEvents('m.room.power_levels', '')?.[0]?.getContent() || {};

      // 合并新的权限设置
      const newPowerLevels = {
        ...currentPowerLevels,
        ...powerLevels
      };

      await client.sendStateEvent(roomId, 'm.room.power_levels', newPowerLevels, '');
    } catch (error) {
      console.error('设置房间权限失败:', error);
      throw error;
    }
  }

  // 踢出用户
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.kick(roomId, userId, reason);
    } catch (error) {
      console.error('踢出用户失败:', error);
      throw error;
    }
  }

  // 封禁用户
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.ban(roomId, userId, reason);
    } catch (error) {
      console.error('封禁用户失败:', error);
      throw error;
    }
  }

  // 解封用户
  async unbanUser(roomId: string, userId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.unban(roomId, userId);
    } catch (error) {
      console.error('解封用户失败:', error);
      throw error;
    }
  }

  // 设置房间加入规则
  async setRoomJoinRule(roomId: string, joinRule: 'public' | 'invite' | 'knock' | 'private'): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.sendStateEvent(roomId, 'm.room.join_rules', {
        join_rule: joinRule
      }, '');
    } catch (error) {
      console.error('设置房间加入规则失败:', error);
      throw error;
    }
  }

  // 设置房间历史可见性
  async setRoomHistoryVisibility(roomId: string, visibility: 'invited' | 'joined' | 'shared' | 'world_readable'): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.sendStateEvent(roomId, 'm.room.history_visibility', {
        history_visibility: visibility
      }, '');
    } catch (error) {
      console.error('设置房间历史可见性失败:', error);
      throw error;
    }
  }

  // 固定消息
  async pinMessage(roomId: string, eventId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 获取当前固定的消息
      const room = client.getRoom(roomId);
      const currentPinnedEvents = room?.currentState.getStateEvents('m.room.pinned_events', '')?.[0]?.getContent()?.pinned || [];
      
      // 添加新的固定消息
      const newPinnedEvents = [...currentPinnedEvents, eventId];
      
      await client.sendStateEvent(roomId, 'm.room.pinned_events', {
        pinned: newPinnedEvents
      }, '');
    } catch (error) {
      console.error('固定消息失败:', error);
      throw error;
    }
  }

  // 取消固定消息
  async unpinMessage(roomId: string, eventId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 获取当前固定的消息
      const room = client.getRoom(roomId);
      const currentPinnedEvents = room?.currentState.getStateEvents('m.room.pinned_events', '')?.[0]?.getContent()?.pinned || [];
      
      // 移除指定的固定消息
      const newPinnedEvents = currentPinnedEvents.filter((id: string) => id !== eventId);
      
      await client.sendStateEvent(roomId, 'm.room.pinned_events', {
        pinned: newPinnedEvents
      }, '');
    } catch (error) {
      console.error('取消固定消息失败:', error);
      throw error;
    }
  }
}

export const matrixRooms = new MatrixRooms();
```

## 消息处理

### 1. 发送消息

```typescript
// lib/matrix/messages.ts
import { matrixClientManager } from './client';
import { MatrixEvent, EventType, MsgType } from 'matrix-js-sdk';

export class MatrixMessages {
  
  // 发送文本消息
  async sendTextMessage(roomId: string, message: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const content = {
      msgtype: MsgType.Text,
      body: message
    };

    try {
      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  // 发送图片消息
  async sendImageMessage(roomId: string, file: File): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 上传文件
      const uploadResponse = await client.uploadContent(file);
      
      const content = {
        msgtype: MsgType.Image,
        body: file.name,
        url: uploadResponse.content_uri,
        info: {
          size: file.size,
          mimetype: file.type,
          w: undefined, // 可以通过 Image 对象获取
          h: undefined
        }
      };

      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('发送图片失败:', error);
      throw error;
    }
  }

  // 发送文件消息
  async sendFileMessage(roomId: string, file: File): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      const uploadResponse = await client.uploadContent(file);
      
      const content = {
        msgtype: MsgType.File,
        body: file.name,
        filename: file.name,
        url: uploadResponse.content_uri,
        info: {
          size: file.size,
          mimetype: file.type
        }
      };

      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('发送文件失败:', error);
      throw error;
    }
  }

  // 编辑消息
  async editMessage(roomId: string, originalEventId: string, newMessage: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const content = {
      msgtype: MsgType.Text,
      body: `* ${newMessage}`,
      "m.new_content": {
        msgtype: MsgType.Text,
        body: newMessage
      },
      "m.relates_to": {
        rel_type: "m.replace",
        event_id: originalEventId
      }
    };

    try {
      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('编辑消息失败:', error);
      throw error;
    }
  }

  // 回复消息
  async replyToMessage(roomId: string, originalEvent: MatrixEvent, replyMessage: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const originalSender = originalEvent.getSender();
    const originalBody = originalEvent.getContent().body || '';

    const content = {
      msgtype: MsgType.Text,
      body: `> <${originalSender}> ${originalBody}\n\n${replyMessage}`,
      format: "org.matrix.custom.html",
      formatted_body: `<mx-reply><blockquote><a href="https://matrix.to/#/${roomId}/${originalEvent.getId()}">In reply to</a> <a href="https://matrix.to/#/${originalSender}">${originalSender}</a><br>${originalBody}</blockquote></mx-reply>${replyMessage}`,
      "m.relates_to": {
        "m.in_reply_to": {
          event_id: originalEvent.getId()
        }
      }
    };

    try {
      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('回复消息失败:', error);
      throw error;
    }
  }

  // 发送正在输入指示器
  async setTyping(roomId: string, isTyping: boolean, timeout = 10000): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.sendTyping(roomId, isTyping, timeout);
    } catch (error) {
      console.error('设置输入状态失败:', error);
    }
  }

  // 删除消息（撤回）
  async deleteMessage(roomId: string, eventId: string, reason?: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      const response = await client.redactEvent(roomId, eventId, undefined, reason);
      return response.event_id;
    } catch (error) {
      console.error('删除消息失败:', error);
      throw error;
    }
  }

  // 发送消息反应（表情符号）
  async sendReaction(roomId: string, targetEventId: string, emoji: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const content = {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: targetEventId,
        key: emoji
      }
    };

    try {
      const response = await client.sendEvent(roomId, 'm.reaction', content);
      return response.event_id;
    } catch (error) {
      console.error('发送反应失败:', error);
      throw error;
    }
  }

  // 发送线程回复
  async sendThreadReply(roomId: string, threadRootEventId: string, message: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const content = {
      msgtype: MsgType.Text,
      body: message,
      "m.relates_to": {
        rel_type: "m.thread",
        event_id: threadRootEventId
      }
    };

    try {
      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('发送线程回复失败:', error);
      throw error;
    }
  }

  // 发送带提及的消息
  async sendMessageWithMentions(roomId: string, message: string, mentionUserIds: string[]): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    // 构建带有@提及的消息体
    let formattedMessage = message;
    let htmlMessage = message;

    mentionUserIds.forEach(userId => {
      const userDisplayName = userId; // 可以通过client.getUser(userId)?.displayName获取显示名
      formattedMessage = formattedMessage.replace(
        new RegExp(`@${userId}`, 'g'), 
        `@${userDisplayName}`
      );
      htmlMessage = htmlMessage.replace(
        new RegExp(`@${userId}`, 'g'), 
        `<a href="https://matrix.to/#/${userId}">${userDisplayName}</a>`
      );
    });

    const content = {
      msgtype: MsgType.Text,
      body: formattedMessage,
      format: "org.matrix.custom.html",
      formatted_body: htmlMessage,
      "m.mentions": {
        user_ids: mentionUserIds
      }
    };

    try {
      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('发送提及消息失败:', error);
      throw error;
    }
  }

  // 发送语音消息
  async sendVoiceMessage(roomId: string, audioBlob: Blob, duration?: number): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 创建File对象
      const audioFile = new File([audioBlob], 'voice-message.ogg', { 
        type: 'audio/ogg; codecs=opus' 
      });

      // 上传音频文件
      const uploadResponse = await client.uploadContent(audioFile);
      
      const content = {
        msgtype: MsgType.Audio,
        body: 'Voice message',
        url: uploadResponse.content_uri,
        info: {
          size: audioFile.size,
          mimetype: audioFile.type,
          duration: duration || undefined
        },
        // MSC3245: 标记为语音消息
        "org.matrix.msc3245.voice": {},
        "org.matrix.msc1767.audio": {
          duration: duration || undefined,
          waveform: undefined // 可选：音频波形数据
        }
      };

      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('发送语音消息失败:', error);
      throw error;
    }
  }

  // 发送视频消息
  async sendVideoMessage(roomId: string, videoFile: File): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 上传视频文件
      const uploadResponse = await client.uploadContent(videoFile);
      
      // 可以通过video元素获取视频尺寸和时长
      const videoInfo = await this.getVideoInfo(videoFile);
      
      const content = {
        msgtype: MsgType.Video,
        body: videoFile.name,
        url: uploadResponse.content_uri,
        info: {
          size: videoFile.size,
          mimetype: videoFile.type,
          w: videoInfo.width,
          h: videoInfo.height,
          duration: videoInfo.duration,
          thumbnail_url: videoInfo.thumbnailUrl, // 可选：缩略图
          thumbnail_info: videoInfo.thumbnailInfo
        }
      };

      const response = await client.sendEvent(roomId, EventType.RoomMessage, content);
      return response.event_id;
    } catch (error) {
      console.error('发送视频消息失败:', error);
      throw error;
    }
  }

  // 获取视频信息的辅助方法
  private async getVideoInfo(videoFile: File): Promise<{
    width?: number;
    height?: number;
    duration?: number;
    thumbnailUrl?: string;
    thumbnailInfo?: any;
  }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration * 1000 // 转换为毫秒
        });
      };
      
      video.onerror = () => {
        resolve({}); // 如果无法获取信息，返回空对象
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  }

  // 分享消息到其他房间
  async forwardMessage(sourceRoomId: string, targetRoomId: string, eventId: string): Promise<string> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      // 获取原始事件
      const sourceRoom = client.getRoom(sourceRoomId);
      if (!sourceRoom) throw new Error('源房间不存在');

      const originalEvent = sourceRoom.findEventById(eventId);
      if (!originalEvent) throw new Error('原始事件不存在');

      const originalContent = originalEvent.getContent();

      // 创建转发内容
      const content = {
        ...originalContent,
        "m.relates_to": {
          rel_type: "m.reference",
          event_id: eventId
        }
      };

      const response = await client.sendEvent(targetRoomId, originalEvent.getType(), content);
      return response.event_id;
    } catch (error) {
      console.error('转发消息失败:', error);
      throw error;
    }
  }
}

export const matrixMessages = new MatrixMessages();
```

## 实时同步

### 1. 事件监听器

```typescript
// lib/matrix/sync.ts
import { matrixClientManager } from './client';
import { MatrixClient, MatrixEvent, Room, ClientEvent, RoomEvent, SyncState } from 'matrix-js-sdk';

export class MatrixSync {
  private client: MatrixClient | null = null;
  private syncState: SyncState | null = null;

  // 初始化同步
  async startSync(initialSyncLimit = 20): Promise<void> {
    this.client = matrixClientManager.getClient();
    if (!this.client) throw new Error('客户端未初始化');

    // 设置事件监听器
    this.setupEventListeners();

    try {
      await this.client.startClient({ 
        initialSyncLimit,
        threadSupport: true,
        lazyLoadMembers: true
      });
    } catch (error) {
      console.error('同步启动失败:', error);
      throw error;
    }
  }

  // 停止同步
  stopSync(): void {
    if (this.client) {
      this.client.stopClient();
    }
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    if (!this.client) return;

    // 同步状态变化
    this.client.on(ClientEvent.Sync, (state: SyncState, prevState: SyncState | null) => {
      this.syncState = state;
      console.log('同步状态:', state);

      switch (state) {
        case SyncState.Prepared:
          console.log('客户端已准备就绪');
          this.onSyncPrepared();
          break;
        case SyncState.Syncing:
          console.log('正在同步...');
          break;
        case SyncState.Error:
          console.error('同步错误');
          this.onSyncError();
          break;
        case SyncState.Stopped:
          console.log('同步已停止');
          break;
      }
    });

    // 新消息事件
    this.client.on(RoomEvent.Timeline, (event: MatrixEvent, room: Room | undefined) => {
      if (event.getType() === 'm.room.message') {
        this.onNewMessage(event, room);
      }
    });

    // 房间状态变化
    this.client.on(RoomEvent.Name, (room: Room) => {
      this.onRoomNameChange(room);
    });

    // 成员状态变化
    this.client.on(RoomEvent.MyMembership, (room: Room, membership: string) => {
      this.onMembershipChange(room, membership);
    });
  }

  // 同步准备就绪回调
  private onSyncPrepared(): void {
    if (!this.client) return;
    
    const rooms = this.client.getRooms();
    console.log(`已同步 ${rooms.length} 个房间`);
    
    // 可以在这里触发 UI 更新
    this.emitEvent('sync:prepared', { roomCount: rooms.length });
  }

  // 同步错误回调
  private onSyncError(): void {
    console.error('同步遇到错误，将在稍后重试');
    this.emitEvent('sync:error');
  }

  // 新消息回调
  private onNewMessage(event: MatrixEvent, room: Room | undefined): void {
    if (!room) return;
    
    const sender = event.getSender();
    const content = event.getContent();
    const currentUserId = this.client?.getUserId();
    
    // 忽略自己发送的消息
    if (sender === currentUserId) return;

    console.log(`新消息来自 ${sender} 在房间 ${room.roomId}:`, content.body);
    
    this.emitEvent('message:new', {
      event,
      room,
      sender,
      content: content.body
    });
  }

  // 房间名称变化回调
  private onRoomNameChange(room: Room): void {
    console.log(`房间 ${room.roomId} 名称变更为: ${room.name}`);
    this.emitEvent('room:nameChange', { room, name: room.name });
  }

  // 成员关系变化回调
  private onMembershipChange(room: Room, membership: string): void {
    console.log(`在房间 ${room.roomId} 的成员关系变更为: ${membership}`);
    this.emitEvent('room:membershipChange', { room, membership });
  }

  // 获取当前同步状态
  getSyncState(): SyncState | null {
    return this.syncState;
  }

  // 事件发射器（简单实现）
  private eventListeners: { [key: string]: Function[] } = {};

  on(event: string, callback: Function): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  private emitEvent(event: string, data?: any): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }
}

export const matrixSync = new MatrixSync();
```

## 与现有应用集成

### 1. React Hook 集成

```typescript
// hooks/useMatrixClient.ts
import { useState, useEffect } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { matrixClientManager, matrixAuth, matrixSync } from '@/lib/matrix';
import { MatrixStorage } from '@/lib/matrix/storage';

export interface UseMatrixClientReturn {
  client: MatrixClient | null;
  isLoggedIn: boolean;
  isConnected: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

export function useMatrixClient(): UseMatrixClientReturn {
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化客户端
  useEffect(() => {
    const initializeClient = async () => {
      try {
        // 尝试从存储中恢复凭据
        const savedCredentials = MatrixStorage.getCredentials();
        
        if (savedCredentials) {
          const restoredClient = await matrixAuth.loginWithToken(
            savedCredentials.accessToken,
            savedCredentials.userId,
            savedCredentials.deviceId
          );
          
          setClient(restoredClient);
          setIsLoggedIn(true);
          
          // 启动同步
          await matrixSync.startSync();
          setIsConnected(true);
        }
      } catch (err) {
        console.error('客户端初始化失败:', err);
        MatrixStorage.clearCredentials();
        setError('自动登录失败，请重新登录');
      }
    };

    initializeClient();

    // 设置同步事件监听
    matrixSync.on('sync:prepared', () => setIsConnected(true));
    matrixSync.on('sync:error', () => setIsConnected(false));

    return () => {
      matrixSync.stopSync();
    };
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      const credentials = await matrixAuth.login(username, password);
      
      // 保存凭据
      MatrixStorage.saveCredentials(credentials);
      
      // 创建客户端实例
      const newClient = matrixClientManager.createClient({
        accessToken: credentials.access_token,
        userId: credentials.user_id,
        deviceId: credentials.device_id
      });
      
      setClient(newClient);
      setIsLoggedIn(true);
      
      // 启动同步
      await matrixSync.startSync();
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || '登录失败');
      throw err;
    }
  };

  const register = async (username: string, password: string, displayName?: string) => {
    try {
      setError(null);
      const credentials = await matrixAuth.register(username, password, displayName);
      
      // 保存凭据
      MatrixStorage.saveCredentials(credentials);
      
      // 创建客户端实例
      const newClient = matrixClientManager.createClient({
        accessToken: credentials.access_token,
        userId: credentials.user_id,
        deviceId: credentials.device_id
      });
      
      setClient(newClient);
      setIsLoggedIn(true);
      
      // 启动同步
      await matrixSync.startSync();
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || '注册失败');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await matrixAuth.logout();
      MatrixStorage.clearCredentials();
      matrixSync.stopSync();
      
      setClient(null);
      setIsLoggedIn(false);
      setIsConnected(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || '登出失败');
      throw err;
    }
  };

  return {
    client,
    isLoggedIn,
    isConnected,
    login,
    register,
    logout,
    error
  };
}
```

### 2. 集成到现有 Server 组件

```typescript
// lib/matrix/integration.ts
import { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import { Character } from '@/shared/types';

export class MatrixIntegration {
  
  // 将 Matrix 房间转换为应用的 Character 格式
  static roomToCharacter(room: Room): Character {
    return {
      id: room.roomId,
      name: room.name || room.roomId,
      avatar: room.getAvatarUrl(room.client.baseUrl, 48, 48, 'crop') || undefined,
      description: room.topic || undefined
    };
  }

  // 将 Matrix 房间转换为应用的频道格式  
  static roomToChannel(room: Room) {
    const isDirect = room.guessDMUserId() !== null;
    
    return {
      id: room.roomId,
      name: room.name || (isDirect ? '私聊' : '未命名房间'),
      type: isDirect ? 'direct' : 'text',
      category: isDirect ? '私聊' : '频道',
      active: false,
      memberCount: room.getJoinedMemberCount(),
      topic: room.topic
    };
  }

  // 将 Matrix 事件转换为应用的消息格式
  static eventToMessage(event: MatrixEvent) {
    const content = event.getContent();
    const sender = event.getSender();
    
    return {
      id: event.getId(),
      author: {
        name: event.sender?.name || sender || '未知用户',
        avatar: event.sender?.getAvatarUrl(event.sender.client.baseUrl, 40, 40, 'crop') || 'https://via.placeholder.com/40'
      },
      content: content.body || '',
      timestamp: new Date(event.getTs()).toLocaleString(),
      type: content.msgtype || 'm.text'
    };
  }

  // 获取房间的最近消息
  static getRecentMessages(room: Room, limit = 10) {
    const timeline = room.getLiveTimeline();
    const events = timeline.getEvents()
      .filter(event => event.getType() === 'm.room.message')
      .slice(-limit)
      .map(event => this.eventToMessage(event));
    
    return events;
  }
}
```

## 完整示例

### 1. 更新 Server 组件以支持 Matrix

```typescript
// app/(tabs)/matrix-server.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMatrixClient } from '@/hooks/useMatrixClient';
import { matrixRooms, matrixMessages, matrixSync } from '@/lib/matrix';
import { MatrixIntegration } from '@/lib/matrix/integration';
import { Room } from 'matrix-js-sdk';

const MatrixServer: React.FC = () => {
  const { client, isLoggedIn, isConnected, login, register, logout } = useMatrixClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  // 监听房间和消息更新
  useEffect(() => {
    if (!client || !isConnected) return;

    const updateRooms = () => {
      const clientRooms = client.getRooms();
      setRooms(clientRooms);
    };

    // 初始加载
    updateRooms();

    // 监听新消息
    matrixSync.on('message:new', ({ room }: { room: Room }) => {
      if (selectedRoom?.roomId === room.roomId) {
        const newMessages = MatrixIntegration.getRecentMessages(room);
        setMessages(newMessages);
      }
    });

    // 监听房间变化
    matrixSync.on('sync:prepared', updateRooms);

    return () => {
      // 清理监听器
    };
  }, [client, isConnected, selectedRoom]);

  // 处理房间选择
  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    const roomMessages = MatrixIntegration.getRecentMessages(room);
    setMessages(roomMessages);
  };

  // 发送消息
  const handleSendMessage = async (text: string) => {
    if (!selectedRoom) return;
    
    try {
      await matrixMessages.sendTextMessage(selectedRoom.roomId, text);
    } catch (error) {
      Alert.alert('发送失败', error.message);
    }
  };

  // 创建新房间
  const handleCreateRoom = async () => {
    try {
      const roomId = await matrixRooms.createPublicRoom('新频道', '这是一个新的频道');
      Alert.alert('成功', `房间已创建: ${roomId}`);
    } catch (error) {
      Alert.alert('创建失败', error.message);
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginContainer}>
          <Text style={styles.title}>Matrix 登录</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => login('testuser', 'password123')}
          >
            <Text style={styles.buttonText}>登录</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => register('newuser', 'password123', '新用户')}
          >
            <Text style={styles.buttonText}>注册</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Matrix 客户端</Text>
        <Text style={styles.status}>
          {isConnected ? '已连接' : '连接中...'}
        </Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* 房间列表 */}
        <View style={styles.roomList}>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateRoom}>
            <Text style={styles.createButtonText}>创建房间</Text>
          </TouchableOpacity>
          
          {rooms.map(room => (
            <TouchableOpacity
              key={room.roomId}
              style={[
                styles.roomItem,
                selectedRoom?.roomId === room.roomId && styles.selectedRoom
              ]}
              onPress={() => handleRoomSelect(room)}
            >
              <Text style={styles.roomName}>
                {room.name || room.roomId}
              </Text>
              <Text style={styles.roomMemberCount}>
                {room.getJoinedMemberCount()} 成员
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 消息区域 */}
        <View style={styles.messageArea}>
          {selectedRoom ? (
            <>
              <Text style={styles.roomTitle}>{selectedRoom.name}</Text>
              <View style={styles.messages}>
                {messages.map(message => (
                  <View key={message.id} style={styles.message}>
                    <Text style={styles.messageAuthor}>{message.author.name}</Text>
                    <Text style={styles.messageContent}>{message.content}</Text>
                    <Text style={styles.messageTime}>{message.timestamp}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.placeholder}>选择一个房间开始聊天</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1f22',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2b2d31',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  status: {
    color: '#00ff00',
    fontSize: 14,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  roomList: {
    width: 250,
    backgroundColor: '#2b2d31',
    padding: 16,
  },
  createButton: {
    backgroundColor: '#5865f2',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  roomItem: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  selectedRoom: {
    backgroundColor: '#404249',
  },
  roomName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  roomMemberCount: {
    color: '#949ba4',
    fontSize: 12,
    marginTop: 4,
  },
  messageArea: {
    flex: 1,
    backgroundColor: '#313338',
    padding: 16,
  },
  roomTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  messages: {
    flex: 1,
  },
  message: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#2b2d31',
    borderRadius: 6,
  },
  messageAuthor: {
    color: '#5865f2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageContent: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 4,
  },
  messageTime: {
    color: '#949ba4',
    fontSize: 12,
    marginTop: 4,
  },
  placeholder: {
    color: '#949ba4',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  button: {
    backgroundColor: '#5865f2',
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
    minWidth: 120,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default MatrixServer;
```

## 测试和调试

### 1. 基础连接测试

```typescript
// tests/matrix-test.ts
import { matrixAuth, matrixRooms, matrixMessages } from '@/lib/matrix';

export async function testMatrixIntegration() {
  console.log('开始 Matrix 集成测试...');

  try {
    // 1. 测试注册
    console.log('1. 测试用户注册...');
    const credentials = await matrixAuth.register('testuser_' + Date.now(), 'testpassword', '测试用户');
    console.log('注册成功:', credentials.user_id);

    // 2. 测试创建房间
    console.log('2. 测试房间创建...');
    const roomId = await matrixRooms.createPublicRoom('测试房间', '这是一个测试房间');
    console.log('房间创建成功:', roomId);

    // 3. 测试发送消息
    console.log('3. 测试消息发送...');
    const eventId = await matrixMessages.sendTextMessage(roomId, '这是一条测试消息');
    console.log('消息发送成功:', eventId);

    console.log('所有测试通过！');
    return true;
  } catch (error) {
    console.error('测试失败:', error);
    return false;
  }
}
```

### 2. 调试工具

```typescript
// lib/matrix/debug.ts
import { matrixClientManager } from './client';

export class MatrixDebug {
  
  static logClientInfo() {
    const client = matrixClientManager.getClient();
    if (!client) {
      console.log('客户端未初始化');
      return;
    }

    console.log('=== Matrix 客户端信息 ===');
    console.log('用户ID:', client.getUserId());
    console.log('设备ID:', client.getDeviceId());
    console.log('访问令牌:', client.getAccessToken()?.substring(0, 20) + '...');
    console.log('服务器URL:', client.getHomeserverUrl());
    console.log('登录状态:', client.isLoggedIn());
    
    const rooms = client.getRooms();
    console.log('房间数量:', rooms.length);
    
    rooms.forEach(room => {
      console.log(`- ${room.name || room.roomId} (${room.getJoinedMemberCount()} 成员)`);
    });
  }

  static async testServerConnection() {
    const client = matrixClientManager.getClient();
    if (!client) {
      console.error('客户端未初始化');
      return false;
    }

    try {
      const versions = await client.getVersions();
      console.log('服务器版本:', versions);
      return true;
    } catch (error) {
      console.error('服务器连接失败:', error);
      return false;
    }
  }
}
```

## 用户状态与通知管理

### 1. 用户状态管理

```typescript
// lib/matrix/presence.ts
import { matrixClientManager } from './client';
import { SetPresence } from 'matrix-js-sdk';

export class MatrixPresence {
  
  // 设置用户状态
  async setPresence(state: 'online' | 'offline' | 'unavailable', statusMsg?: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const presence: SetPresence = state === 'offline' ? 'offline' : 
                                 state === 'unavailable' ? 'unavailable' : 'online';

    try {
      await client.setPresence({
        presence,
        status_msg: statusMsg
      });
    } catch (error) {
      console.error('设置用户状态失败:', error);
      throw error;
    }
  }

  // 获取用户状态
  getUserPresence(userId: string) {
    const client = matrixClientManager.getClient();
    if (!client) return null;

    const user = client.getUser(userId);
    return user ? {
      presence: user.presence,
      statusMsg: user.presenceStatusMsg,
      lastActiveAgo: user.lastActiveAgo,
      currentlyActive: user.currentlyActive
    } : null;
  }

  // 监听用户状态变化
  onPresenceChange(callback: (userId: string, presence: any) => void): () => void {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const handler = (event: any, user: any) => {
      callback(user.userId, {
        presence: user.presence,
        statusMsg: user.presenceStatusMsg,
        lastActiveAgo: user.lastActiveAgo,
        currentlyActive: user.currentlyActive
      });
    };

    client.on('User.presence', handler);

    // 返回清理函数
    return () => client.off('User.presence', handler);
  }
}

export const matrixPresence = new MatrixPresence();
```

### 2. 已读回执管理

```typescript
// lib/matrix/receipts.ts
import { matrixClientManager } from './client';
import { ReceiptType } from 'matrix-js-sdk';

export class MatrixReceipts {
  
  // 发送已读回执
  async sendReadReceipt(roomId: string, eventId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.sendReadReceipt(roomId, eventId, ReceiptType.Read);
    } catch (error) {
      console.error('发送已读回执失败:', error);
      throw error;
    }
  }

  // 发送完全已读回执（私有）
  async sendPrivateReadReceipt(roomId: string, eventId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.sendReadReceipt(roomId, eventId, ReceiptType.ReadPrivate);
    } catch (error) {
      console.error('发送私有已读回执失败:', error);
      throw error;
    }
  }

  // 设置房间为已读
  async setRoomReadMarker(roomId: string, eventId: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.setRoomReadMarkers(roomId, eventId, eventId);
    } catch (error) {
      console.error('设置房间已读标记失败:', error);
      throw error;
    }
  }

  // 获取房间的已读回执信息
  getRoomReadReceipts(roomId: string, eventId: string) {
    const client = matrixClientManager.getClient();
    if (!client) return null;

    const room = client.getRoom(roomId);
    if (!room) return null;

    const event = room.findEventById(eventId);
    if (!event) return null;

    return room.getReceiptsForEvent(event);
  }

  // 获取房间未读消息数
  getRoomUnreadNotificationCount(roomId: string) {
    const client = matrixClientManager.getClient();
    if (!client) return 0;

    const room = client.getRoom(roomId);
    if (!room) return 0;

    return room.getUnreadNotificationCount();
  }

  // 获取房间高亮未读数（提及数）
  getRoomHighlightCount(roomId: string) {
    const client = matrixClientManager.getClient();
    if (!client) return 0;

    const room = client.getRoom(roomId);
    if (!room) return 0;

    return room.getUnreadNotificationCount('highlight');
  }
}

export const matrixReceipts = new MatrixReceipts();
```

### 3. 通知设置管理

```typescript
// lib/matrix/notifications.ts
import { matrixClientManager } from './client';
import { PushRuleKind, type PushRuleAction } from 'matrix-js-sdk';

export class MatrixNotifications {
  
  // 设置房间通知级别
  async setRoomNotificationLevel(roomId: string, level: 'all' | 'mentions' | 'none'): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      let actions: PushRuleAction[] = [];
      
      switch (level) {
        case 'all':
          actions = ['notify', { set_tweak: 'sound', value: 'default' }];
          break;
        case 'mentions':
          actions = ['dont_notify'];
          break;
        case 'none':
          actions = ['dont_notify'];
          break;
      }

      // 设置房间特定的推送规则
      await client.setPushRuleActions('global', PushRuleKind.RoomSpecific, roomId, actions);
    } catch (error) {
      console.error('设置房间通知级别失败:', error);
      throw error;
    }
  }

  // 静音房间
  async muteRoom(roomId: string): Promise<void> {
    await this.setRoomNotificationLevel(roomId, 'none');
  }

  // 取消静音房间
  async unmuteRoom(roomId: string): Promise<void> {
    await this.setRoomNotificationLevel(roomId, 'all');
  }

  // 设置关键词通知
  async addKeywordNotification(keyword: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      const ruleId = `keyword_${keyword.toLowerCase()}`;
      const conditions = [{
        kind: 'event_match',
        key: 'content.body',
        pattern: keyword
      }];
      const actions: PushRuleAction[] = ['notify', { set_tweak: 'highlight', value: true }];

      await client.addPushRule('global', PushRuleKind.ContentSpecific, ruleId, {
        conditions,
        actions
      });
    } catch (error) {
      console.error('添加关键词通知失败:', error);
      throw error;
    }
  }

  // 删除关键词通知
  async removeKeywordNotification(keyword: string): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      const ruleId = `keyword_${keyword.toLowerCase()}`;
      await client.deletePushRule('global', PushRuleKind.ContentSpecific, ruleId);
    } catch (error) {
      console.error('删除关键词通知失败:', error);
      throw error;
    }
  }

  // 获取当前推送规则
  getPushRules() {
    const client = matrixClientManager.getClient();
    if (!client) return null;

    return client.pushRules;
  }

  // 设置设备推送器
  async setPusher(pusherData: {
    kind: 'http' | 'email' | null;
    app_id: string;
    app_display_name: string;
    device_display_name: string;
    pushkey: string;
    lang?: string;
    data?: any;
  }): Promise<void> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      await client.setPusher(pusherData);
    } catch (error) {
      console.error('设置推送器失败:', error);
      throw error;
    }
  }
}

export const matrixNotifications = new MatrixNotifications();
```

### 4. 消息搜索功能

```typescript
// lib/matrix/search.ts
import { matrixClientManager } from './client';

export class MatrixSearch {
  
  // 搜索消息
  async searchMessages(query: string, options: {
    roomId?: string;
    limit?: number;
    orderBy?: 'recent' | 'rank';
    beforeLimit?: number;
    afterLimit?: number;
    includeProfile?: boolean;
  } = {}): Promise<any> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    const searchOptions = {
      search_categories: {
        room_events: {
          search_term: query,
          filter: options.roomId ? { rooms: [options.roomId] } : undefined,
          order_by: options.orderBy || 'recent',
          event_context: {
            before_limit: options.beforeLimit || 5,
            after_limit: options.afterLimit || 5,
            include_profile: options.includeProfile || true
          }
        }
      }
    };

    try {
      return await client.search(searchOptions);
    } catch (error) {
      console.error('搜索消息失败:', error);
      throw error;
    }
  }

  // 在房间中搜索
  async searchInRoom(roomId: string, query: string, limit = 20): Promise<any> {
    return this.searchMessages(query, { roomId, limit });
  }

  // 搜索用户
  async searchUsers(query: string, limit = 10): Promise<any> {
    const client = matrixClientManager.getClient();
    if (!client) throw new Error('客户端未初始化');

    try {
      return await client.searchUserDirectory({ term: query, limit });
    } catch (error) {
      console.error('搜索用户失败:', error);
      throw error;
    }
  }
}

export const matrixSearch = new MatrixSearch();
```

## 完整功能特性清单

本集成指南涵盖了以下所有核心聊天功能：

### ✅ 核心聊天功能

1. **✅ 发送和接收文本消息** - `matrixMessages.sendTextMessage()`
2. **✅ 发送和接收表情符号** - `matrixMessages.sendReaction()`
3. **✅ 发送和接收文件和图片** - `matrixMessages.sendImageMessage()`, `sendFileMessage()`
4. **✅ 回复消息** - `matrixMessages.replyToMessage()`
5. **✅ 编辑消息** - `matrixMessages.editMessage()`
6. **✅ 删除消息** - `matrixMessages.deleteMessage()`
7. **✅ @提及用户** - `matrixMessages.sendMessageWithMentions()`
8. **✅ 引用消息** - 在 `replyToMessage()` 中实现
9. **✅ 线程回复 (Reply in thread)** - `matrixMessages.sendThreadReply()`

### ✅ 高级聊天功能 

10. **✅ 创建房间/聊天室** - `matrixRooms.createPublicRoom()`, `createPrivateRoom()`
11. **✅ 加入房间/聊天室** - `matrixRooms.joinRoom()`
12. **✅ 管理房间成员** - `matrixRooms.inviteUser()`, `kickUser()`, `banUser()`
13. **✅ 房间设置** - `matrixRooms.setRoomName()`, `setRoomTopic()`, `setRoomAvatar()`
14. **✅ 端到端加密（E2EE）** - `matrixRooms.enableRoomEncryption()`
15. **✅ 发送语音消息** - `matrixMessages.sendVoiceMessage()`
16. **✅ 发送视频消息** - `matrixMessages.sendVideoMessage()`
17. **✅ 查看消息历史记录** - 通过 `Room.timeline` 和分页API
18. **✅ 搜索消息** - `matrixSearch.searchMessages()`, `searchInRoom()`
19. **✅ 标记消息** - `matrixReceipts.sendReadReceipt()`
20. **✅ 分享消息** - `matrixMessages.forwardMessage()`
21. **✅ 收藏消息** - `matrixRooms.pinMessage()`, `unpinMessage()`
22. **✅ 消息回执（已读/未读）** - `matrixReceipts.sendReadReceipt()`, `getRoomUnreadNotificationCount()`
23. **✅ 正在输入提示** - `matrixMessages.setTyping()`
24. **✅ 主题（Topic）/房名** - `matrixRooms.setRoomTopic()`, `setRoomName()`
25. **✅ 通知设置** - `matrixNotifications.setRoomNotificationLevel()`, `muteRoom()`
26. **✅ 用户状态** - `matrixPresence.setPresence()`, `getUserPresence()`

## 下一步

1. **端到端加密**: 配置 Olm/Megolm 加密
2. **推送通知**: 集成 FCM/APNs 推送
3. **文件共享**: 实现文件上传和下载
4. **语音通话**: 集成 WebRTC 通话功能
5. **离线支持**: 实现本地数据缓存
6. **性能优化**: 实现消息分页和虚拟化列表

这个指南为你提供了一个完整的 Matrix JS SDK 集成基础，你可以根据具体需求进一步定制和扩展功能。 