# Matrix JS SDK 使用指南

Matrix JS SDK 是 Matrix 协议的 JavaScript/TypeScript 客户端 SDK，可以与 Synapse 等 Matrix 服务器进行通信。

## 目录

1. [快速开始](#1-快速开始)
2. [客户端管理](#2-客户端管理)
3. [房间操作](#3-房间操作)
4. [消息处理](#4-消息处理)
5. [媒体处理](#5-媒体处理)
6. [时间线和事件](#6-时间线和事件)
7. [测试方案](#7-测试方案)
8. [高级功能](#8-高级功能)

## 1. 快速开始

### 安装和导入

```javascript
import * as sdk from "matrix-js-sdk";
```

### 创建客户端

```javascript
const client = sdk.createClient({ 
    baseUrl: "https://your-synapse-server.com" 
});
```

### 使用访问令牌创建认证客户端

```javascript
const client = sdk.createClient({
    baseUrl: "https://your-synapse-server.com",
    accessToken: "your_access_token",
    userId: "@user:your-domain.com"
});
```

## 2. 客户端管理

### 启动客户端

```javascript
await client.startClient({ initialSyncLimit: 10 });
```

### 监听同步状态

```javascript
client.once(ClientEvent.sync, function (state, prevState, res) {
    if (state === "PREPARED") {
        console.log("客户端已准备就绪");
    }
});
```

### 用户认证

#### 注册用户

```javascript
const username = "testuser_" + Date.now();
const password = "testpassword123";
const registerResponse = await client.register(username, password);
```

#### 用户登录

```javascript
const loginResponse = await client.login("m.login.password", {
    user: "username",
    password: "password"
});
```

#### 用户登出

```javascript
// 登出并停止客户端
await client.logout(true); // true参数会同时停止客户端
```

**注意**：注册后创建客户端不等同于登录。登录是通过 `client.login()` 方法完成的独立操作。

## 3. 房间操作

### 创建房间

```javascript
const roomOptions = {
    name: "测试房间",
    topic: "这是一个测试房间",
    visibility: "private"
};
const room = await client.createRoom(roomOptions);
```

### 加入房间

```javascript
const room = await client.joinRoom(roomIdOrAlias, opts);
```

### 自动加入邀请的房间

```javascript
client.on(RoomEvent.MyMembership, function (room, membership, prevMembership) {
    if (membership === KnownMembership.Invite) {
        client.joinRoom(room.roomId).then(function () {
            console.log("自动加入房间 %s", room.roomId);
        });
    }
});
```

### 房间权限检查

```javascript
const canSend = room.maySendMessage();
```

## 4. 消息处理

### 发送消息

#### 发送文本消息

```javascript
const content = {
    body: "消息内容",
    msgtype: "m.text",
};
client.sendEvent("roomId", "m.room.message", content, "", (err, res) => {
    console.log(err);
});
```

### 接收消息

```javascript
client.on(RoomEvent.Timeline, function (event, room, toStartOfTimeline) {
    if (event.getType() !== "m.room.message") {
        return;
    }
    console.log(event.event.content.body);
});
```

### 发送回执

```javascript
await client.sendReceipt(event, receiptType, body, unthreaded);
```

## 5. 媒体处理

### 媒体下载端点

Matrix SDK 支持两种媒体下载方式：

1. **未认证媒体端点**：`/_matrix/media/v3/download` 和 `/_matrix/media/v3/thumbnail`
2. **认证媒体端点**：`/_matrix/client/v1/media/download` 和 `/_matrix/client/v1/media/thumbnail`

### HTTPS 支持

完全支持 HTTPS 下载媒体。SDK 的 `getHttpUriForMxc` 函数会根据提供的 `baseUrl` 生成完整的 URL。

## 6. 时间线和事件

### 时间线概念

时间线（Timeline）是一个有序的事件序列，代表房间中消息和状态变化的时间顺序。

### 获取所有消息事件

```javascript
// 获取房间的主时间线
const room = client.getRoom(roomId);
const timelineSet = room.getUnfilteredTimelineSet();
const liveTimeline = timelineSet.getLiveTimeline();
const events = liveTimeline.getEvents();

// 遍历所有事件
events.forEach(event => {
    if (event.getType() === "m.room.message") {
        console.log(event.getContent().body);
    }
});
```

### 分页获取历史消息

可以通过时间线的分页（pagination）机制获取部分消息事件。

## 7. 测试方案

### 完整测试流程

```javascript
import * as sdk from "matrix-js-sdk";

async function testMatrixClient() {
    const baseUrl = "https://cradleintro.top";
    
    // 1. 创建客户端（用于注册）
    let client = sdk.createClient({ baseUrl });
    
    try {
        // 2. 注册用户
        const username = "testuser_" + Date.now();
        const password = "testpassword123";
        
        const registerResponse = await client.register(username, password);
        console.log("注册成功:", registerResponse);
        
        // 3. 使用注册返回的凭据创建认证客户端
        client = sdk.createClient({
            baseUrl: baseUrl,
            accessToken: registerResponse.access_token,
            userId: registerResponse.user_id,
        });
        
        // 4. 启动客户端
        await client.startClient({ initialSyncLimit: 10 });
        
        // 5. 等待客户端准备就绪
        await new Promise((resolve) => {
            client.once("sync", (state) => {
                if (state === "PREPARED") {
                    console.log("客户端同步完成");
                    resolve();
                }
            });
        });
        
        // 6. 创建房间
        const roomOptions = {
            name: "测试房间",
            topic: "这是一个测试房间",
            visibility: "private"
        };
        
        const room = await client.createRoom(roomOptions);
        console.log("房间创建成功:", room.room_id);
        
        // 7. 发送消息
        const messageContent = {
            body: "Hello, Matrix!",
            msgtype: "m.text"
        };
        
        const messageResponse = await client.sendEvent(
            room.room_id,
            "m.room.message",
            messageContent
        );
        console.log("消息发送成功:", messageResponse.event_id);
        
        console.log("所有测试完成！");
        
    } catch (error) {
        console.error("测试失败:", error);
    } finally {
        // 8. 清理
        client.stopClient();
    }
}

// 运行测试
testMatrixClient();
```

## 8. 高级功能

### 同步机制

SDK 使用两种同步方式与服务器保持状态同步：
1. **传统同步** - 使用 `/sync` 端点
2. **滑动同步** - 使用 `/sliding_sync` 端点（更高效）

### 支持的功能列表

#### 房间管理
- 创建、加入、离开房间
- 邀请、踢出、封禁用户
- 设置房间权限和可见性

#### 消息功能
- 发送文本、媒体消息
- 编辑、删除、回复消息
- 发送自定义事件

#### 用户管理
- 用户注册、登录、登出
- 用户资料管理
- 设备管理

#### 安全功能
- 端到端加密
- 设备验证
- 密钥备份

#### 其他功能
- 搜索消息和房间
- 推送通知管理
- 第三方集成

## 重要注意事项

- SDK 需要 Matrix 服务器版本至少为 v1.1
- 如需端到端加密支持，需要在启动客户端前调用 `await client.initRustCrypto()`
- SDK 会自动处理消息重试、本地回显、分页等功能
- 所有操作都是异步的，建议使用 Promise 或 async/await 处理
- 确保 Synapse 服务器配置正确，特别是 CORS 设置，以支持 Web 客户端访问

## 相关资源

- [Client Lifecycle](https://github.com/matrix-org/matrix-js-sdk)
- [Data Models](https://github.com/matrix-org/matrix-js-sdk)
- [Synchronization](https://github.com/matrix-org/matrix-js-sdk)