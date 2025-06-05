import '@/lib/polyfills'; // 导入 polyfills，确保兼容性
import { createClient, MatrixClient, Room, MatrixEvent, Preset, Visibility, EventType, MsgType, SyncState, ClientEvent, ReceiptType, PushRuleKind, type PushRuleAction, SetPresence } from 'matrix-js-sdk';

export interface MatrixCredentials {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
}

export class MatrixClientManager {
  private client: MatrixClient | null = null;
  private credentials: MatrixCredentials | null = null;
  private isInitializing = false;

  // 创建并初始化客户端
  async initializeClient(credentials: MatrixCredentials): Promise<MatrixClient> {
    if (this.isInitializing) {
      throw new Error('客户端正在初始化中');
    }

    this.isInitializing = true;
    this.credentials = credentials;
    
    try {
      this.client = createClient({
        baseUrl: credentials.homeserverUrl,
        accessToken: credentials.accessToken,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        timelineSupport: true,
      });

      // 启动客户端同步，但不等待完成
      await this.client.startClient({ 
        initialSyncLimit: 10,
        lazyLoadMembers: true,
      });

      return this.client;
    } catch (error) {
      console.error('客户端初始化失败:', error);
      this.client = null;
      this.credentials = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  // 获取当前客户端
  getClient(): MatrixClient | null {
    return this.client;
  }

  // 检查客户端是否已初始化
  isClientReady(): boolean {
    return this.client !== null && !this.isInitializing;
  }

  // 获取所有房间
  getRooms(): Room[] {
    if (!this.client) return [];
    return this.client.getRooms();
  }

  // ============== 房间管理功能 ==============

  // 创建公开房间
  async createRoom(name: string, topic?: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    const response = await this.client.createRoom({
      name,
      topic,
      preset: Preset.PublicChat,
      visibility: Visibility.Public
    });

    return response.room_id;
  }

  // 创建私人房间（群聊）
  async createPrivateRoom(name: string, topic?: string, inviteUserIds?: string[]): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    const response = await this.client.createRoom({
      name,
      topic,
      preset: Preset.PrivateChat,
      visibility: Visibility.Private,
      invite: inviteUserIds || []
    });

    return response.room_id;
  }

  // 创建直接消息房间
  async createDirectMessage(targetUserId: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    const response = await this.client.createRoom({
      preset: Preset.TrustedPrivateChat,
      visibility: Visibility.Private,
      invite: [targetUserId],
      is_direct: true
    });

    // 标记为直接消息 - 使用简化的方式
    try {
      const currentUserId = this.client.getUserId();
      if (currentUserId) {
        const directMessages: Record<string, string[]> = {};
        directMessages[targetUserId] = [response.room_id];
        await this.client.setAccountData('m.direct' as any, directMessages as any);
      }
    } catch (error) {
      console.warn('设置直接消息标记失败:', error);
    }

    return response.room_id;
  }

  // 加入房间
  async joinRoom(roomIdOrAlias: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.joinRoom(roomIdOrAlias);
  }

  // 离开房间
  async leaveRoom(roomId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.leave(roomId);
  }

  // 邀请用户到房间
  async inviteUser(roomId: string, userId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.invite(roomId, userId);
  }

  // 踢出用户
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.kick(roomId, userId, reason);
  }

  // 封禁用户
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.ban(roomId, userId, reason);
  }

  // 解封用户
  async unbanUser(roomId: string, userId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.unban(roomId, userId);
  }

  // 设置房间名称
  async setRoomName(roomId: string, name: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.setRoomName(roomId, name);
  }

  // 设置房间主题
  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.sendStateEvent(roomId, 'm.room.topic' as any, { topic }, '');
  }

  // 设置房间头像
  async setRoomAvatar(roomId: string, avatarFile: File): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    // 上传头像文件
    const uploadResponse = await this.client.uploadContent(avatarFile);
    
    // 设置房间头像
    await this.client.sendStateEvent(roomId, 'm.room.avatar' as any, {
      url: uploadResponse.content_uri
    }, '');
  }

  // 启用房间端到端加密
  async enableRoomEncryption(roomId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    await this.client.sendStateEvent(roomId, 'm.room.encryption' as any, {
      algorithm: 'm.megolm.v1.aes-sha2'
    }, '');
  }

  // 固定消息
  async pinMessage(roomId: string, eventId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    const room = this.client.getRoom(roomId);
    const pinnedEventsState = room?.currentState.getStateEvents('m.room.pinned_events' as any, '');
    
    let currentPinnedEvents: string[] = [];
    if (pinnedEventsState && Array.isArray(pinnedEventsState) && pinnedEventsState.length > 0) {
      currentPinnedEvents = pinnedEventsState[0].getContent()?.pinned || [];
    }
    
    const newPinnedEvents = [...currentPinnedEvents, eventId];
    
    await this.client.sendStateEvent(roomId, 'm.room.pinned_events' as any, {
      pinned: newPinnedEvents
    }, '');
  }

  // 取消固定消息
  async unpinMessage(roomId: string, eventId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    const room = this.client.getRoom(roomId);
    const pinnedEventsState = room?.currentState.getStateEvents('m.room.pinned_events' as any, '');
    
    let currentPinnedEvents: string[] = [];
    if (pinnedEventsState && Array.isArray(pinnedEventsState) && pinnedEventsState.length > 0) {
      currentPinnedEvents = pinnedEventsState[0].getContent()?.pinned || [];
    }
    
    const newPinnedEvents = currentPinnedEvents.filter((id: string) => id !== eventId);
    
    await this.client.sendStateEvent(roomId, 'm.room.pinned_events' as any, {
      pinned: newPinnedEvents
    }, '');
  }

  // 获取公开房间列表
  async getPublicRooms(limit = 20, since?: string) {
    if (!this.client) throw new Error('客户端未初始化');
    return await this.client.publicRooms({ limit, since });
  }

  // ============== 消息管理功能 ==============

  // 发送文本消息
  async sendMessage(roomId: string, message: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      const response = await this.client.sendTextMessage(roomId, message);
      return response.event_id;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  // 发送图片消息
  async sendImageMessage(roomId: string, file: File): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      const uploadResponse = await this.client.uploadContent(file);
      
      const content = {
        msgtype: MsgType.Image,
        body: file.name,
        url: uploadResponse.content_uri,
        info: {
          size: file.size,
          mimetype: file.type,
        }
      };

      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('发送图片失败:', error);
      throw error;
    }
  }

  // 发送文件消息
  async sendFileMessage(roomId: string, file: File): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      const uploadResponse = await this.client.uploadContent(file);
      
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

      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('发送文件失败:', error);
      throw error;
    }
  }

  // 发送语音消息
  async sendVoiceMessage(roomId: string, audioBlob: Blob, duration?: number): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      const audioFile = new File([audioBlob], 'voice-message.ogg', { 
        type: 'audio/ogg; codecs=opus' 
      });

      const uploadResponse = await this.client.uploadContent(audioFile);
      
      const content = {
        msgtype: MsgType.Audio,
        body: 'Voice message',
        url: uploadResponse.content_uri,
        info: {
          size: audioFile.size,
          mimetype: audioFile.type,
          duration: duration || undefined
        },
        "org.matrix.msc3245.voice": {},
        "org.matrix.msc1767.audio": {
          duration: duration || undefined,
        }
      };

      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('发送语音消息失败:', error);
      throw error;
    }
  }

  // 发送视频消息
  async sendVideoMessage(roomId: string, videoFile: File): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      const uploadResponse = await this.client.uploadContent(videoFile);
      
      const content = {
        msgtype: MsgType.Video,
        body: videoFile.name,
        url: uploadResponse.content_uri,
        info: {
          size: videoFile.size,
          mimetype: videoFile.type,
        }
      };

      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('发送视频消息失败:', error);
      throw error;
    }
  }

  // 编辑消息
  async editMessage(roomId: string, originalEventId: string, newMessage: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

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
      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('编辑消息失败:', error);
      throw error;
    }
  }

  // 回复消息
  async replyToMessage(roomId: string, originalEventId: string, originalSender: string, originalContent: string, replyMessage: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    const content = {
      msgtype: MsgType.Text,
      body: `> <${originalSender}> ${originalContent}\n\n${replyMessage}`,
      format: "org.matrix.custom.html",
      formatted_body: `<mx-reply><blockquote><a href="https://matrix.to/#/${roomId}/${originalEventId}">In reply to</a> <a href="https://matrix.to/#/${originalSender}">${originalSender}</a><br>${originalContent}</blockquote></mx-reply>${replyMessage}`,
      "m.relates_to": {
        "m.in_reply_to": {
          event_id: originalEventId
        }
      }
    };

    try {
      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('回复消息失败:', error);
      throw error;
    }
  }

  // 发送线程回复
  async sendThreadReply(roomId: string, threadRootEventId: string, message: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    const content = {
      msgtype: MsgType.Text,
      body: message,
      "m.relates_to": {
        rel_type: "m.thread",
        event_id: threadRootEventId
      }
    };

    try {
      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('发送线程回复失败:', error);
      throw error;
    }
  }

  // 发送消息反应（表情符号）
  async sendReaction(roomId: string, targetEventId: string, emoji: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    const content = {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: targetEventId,
        key: emoji
      }
    };

    try {
      const response = await this.client.sendEvent(roomId, 'm.reaction' as any, content);
      return response.event_id;
    } catch (error) {
      console.error('发送反应失败:', error);
      throw error;
    }
  }

  // 发送带提及的消息
  async sendMessageWithMentions(roomId: string, message: string, mentionUserIds: string[]): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    let formattedMessage = message;
    let htmlMessage = message;

    mentionUserIds.forEach(userId => {
      const userDisplayName = userId;
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
      const response = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any);
      return response.event_id;
    } catch (error) {
      console.error('发送提及消息失败:', error);
      throw error;
    }
  }

  // 删除消息（撤回）
  async deleteMessage(roomId: string, eventId: string, reason?: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      const opts = reason ? { reason } : undefined;
      const response = await this.client.redactEvent(roomId, eventId, undefined, opts);
      return response.event_id;
    } catch (error) {
      console.error('删除消息失败:', error);
      throw error;
    }
  }

  // 转发消息到其他房间
  async forwardMessage(sourceRoomId: string, targetRoomId: string, eventId: string): Promise<string> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      const sourceRoom = this.client.getRoom(sourceRoomId);
      if (!sourceRoom) throw new Error('源房间不存在');

      const originalEvent = sourceRoom.findEventById(eventId);
      if (!originalEvent) throw new Error('原始事件不存在');

      const originalContent = originalEvent.getContent();

      const content = {
        ...originalContent,
        "m.relates_to": {
          rel_type: "m.reference",
          event_id: eventId
        }
      };

      const response = await this.client.sendEvent(targetRoomId, originalEvent.getType() as any, content);
      return response.event_id;
    } catch (error) {
      console.error('转发消息失败:', error);
      throw error;
    }
  }

  // 发送正在输入指示器
  async setTyping(roomId: string, isTyping: boolean, timeout = 10000): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      await this.client.sendTyping(roomId, isTyping, timeout);
    } catch (error) {
      console.error('设置输入状态失败:', error);
    }
  }

  // 获取房间历史消息
  getRoomMessages(roomId: string, limit = 50): MatrixEvent[] {
    if (!this.client) return [];
    
    const room = this.client.getRoom(roomId);
    if (!room) return [];

    const timeline = room.getLiveTimeline();
    const events = timeline.getEvents();
    
    return events
      .filter(event => event.getType() === 'm.room.message')
      .slice(-limit);
  }

  // ============== 消息回执和已读状态 ==============

  // 发送已读回执
  async sendReadReceipt(roomId: string, eventId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      // 查找事件对象
      const room = this.client.getRoom(roomId);
      if (room) {
        const event = room.findEventById(eventId);
        if (event) {
          await this.client.sendReadReceipt(event, ReceiptType.Read);
          return;
        }
      }
      
      // 如果找不到事件，使用基础的receipt发送方式
      console.warn('无法找到事件对象，跳过已读回执发送');
    } catch (error) {
      console.error('发送已读回执失败:', error);
      throw error;
    }
  }

  // 设置房间为已读
  async setRoomReadMarker(roomId: string, eventId: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      // 暂时简化实现，避免TypeScript错误
      console.log('设置房间已读标记:', roomId, eventId);
      // TODO: 实现正确的setRoomReadMarkers调用
    } catch (error) {
      console.error('设置房间已读标记失败:', error);
      throw error;
    }
  }

  // 获取房间未读消息数
  getRoomUnreadNotificationCount(roomId: string): number {
    if (!this.client) return 0;

    const room = this.client.getRoom(roomId);
    if (!room) return 0;

    return room.getUnreadNotificationCount();
  }

  // 获取房间高亮未读数（提及数）
  getRoomHighlightCount(roomId: string): number {
    if (!this.client) return 0;

    const room = this.client.getRoom(roomId);
    if (!room) return 0;

    // 使用基础的 getUnreadNotificationCount，而不是传递参数
    return room.getUnreadNotificationCount();
  }

  // ============== 用户状态管理 ==============

  // 设置用户状态
  async setPresence(state: 'online' | 'offline' | 'unavailable', statusMsg?: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      await this.client.setPresence({
        presence: state as SetPresence,
        status_msg: statusMsg
      });
    } catch (error) {
      console.error('设置用户状态失败:', error);
      throw error;
    }
  }

  // 获取用户状态
  getUserPresence(userId: string) {
    if (!this.client) return null;

    const user = this.client.getUser(userId);
    return user ? {
      presence: user.presence,
      statusMsg: user.presenceStatusMsg,
      lastActiveAgo: user.lastActiveAgo,
      currentlyActive: user.currentlyActive
    } : null;
  }

  // ============== 通知设置 ==============

  // 设置房间通知级别
  async setRoomNotificationLevel(roomId: string, level: 'all' | 'mentions' | 'none'): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      let actions: any[] = [];
      
      switch (level) {
        case 'all':
          actions = ['notify'];
          break;
        case 'mentions':
          actions = ['dont_notify'];
          break;
        case 'none':
          actions = ['dont_notify'];
          break;
      }

      await this.client.setPushRuleActions('global', PushRuleKind.RoomSpecific, roomId, actions);
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

  // ============== 搜索功能 ==============

  // 搜索消息
  async searchMessages(query: string, options: {
    roomId?: string;
    limit?: number;
    orderBy?: string;
    beforeLimit?: number;
    afterLimit?: number;
    includeProfile?: boolean;
  } = {}): Promise<any> {
    if (!this.client) throw new Error('客户端未初始化');

    try {
      // 暂时简化实现，避免TypeScript错误
      console.log('搜索消息:', query, options);
      // TODO: 实现正确的search调用
      return { search_categories: { room_events: { results: [] } } };
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
    if (!this.client) throw new Error('客户端未初始化');

    try {
      return await this.client.searchUserDirectory({ term: query, limit });
    } catch (error) {
      console.error('搜索用户失败:', error);
      throw error;
    }
  }

  // ============== 原有功能保持不变 ==============

  // 登录
  async login(username: string, password: string, homeserverUrl: string = 'https://official.cradleintro.top'): Promise<MatrixCredentials> {
    const tempClient = createClient({ baseUrl: homeserverUrl });
    
    try {
      const response = await tempClient.loginWithPassword(username, password);
      
      if (!response.access_token || !response.user_id) {
        throw new Error('登录响应缺少必要信息');
      }
      
      const credentials: MatrixCredentials = {
        homeserverUrl,
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id || undefined
      };

      await this.initializeClient(credentials);
      return credentials;
    } catch (error: any) {
      if (error.errcode === 'M_FORBIDDEN' || error.errcode === 'M_UNKNOWN') {
        console.log('登录失败，尝试注册...');
        return await this.register(username, password, homeserverUrl);
      }
      throw error;
    }
  }

  // 注册
  async register(username: string, password: string, homeserverUrl: string = 'https://official.cradleintro.top'): Promise<MatrixCredentials> {
    const tempClient = createClient({ baseUrl: homeserverUrl });
    
    try {
      const isAvailable = await tempClient.isUsernameAvailable(username);
      if (!isAvailable) {
        throw new Error('用户名已被占用');
      }

      const response = await tempClient.register(
        username,
        password,
        null,
        { type: 'm.login.dummy' }
      );

      if (!response.access_token || !response.user_id) {
        throw new Error('注册响应缺少必要信息');
      }

      const credentials: MatrixCredentials = {
        homeserverUrl,
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id || undefined
      };

      await this.initializeClient(credentials);
      return credentials;
    } catch (error: any) {
      if (error.errcode === 'M_USER_IN_USE') {
        throw new Error('用户名已被占用，请选择其他用户名');
      }
      throw error;
    }
  }

  // 断开连接
  disconnect(): void {
    if (this.client) {
      try {
        this.client.stopClient();
      } catch (error) {
        console.warn('停止客户端时出错:', error);
      }
      this.client = null;
    }
    this.credentials = null;
    this.isInitializing = false;
  }

  // 获取当前凭据
  getCredentials(): MatrixCredentials | null {
    return this.credentials;
  }
}

export const matrixClient = new MatrixClientManager(); 