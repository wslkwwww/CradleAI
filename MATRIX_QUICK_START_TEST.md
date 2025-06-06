# Matrix JS SDK 快速测试指南

## 1. 基础测试步骤

### 安装依赖
```bash
npm install matrix-js-sdk
```

### 基础连接测试

创建一个简单的测试文件 `matrix-test.js`：

```javascript
import { createClient } from 'matrix-js-sdk';

// 1. 测试服务器连接
async function testConnection() {
  try {
    const client = createClient({ baseUrl: 'https://official.cradleintro.top' });
    const versions = await client.getVersions();
    console.log('✅ 服务器连接成功');
    console.log('支持的版本:', versions.versions);
    return true;
  } catch (error) {
    console.error('❌ 服务器连接失败:', error.message);
    return false;
  }
}

// 2. 测试用户注册
async function testRegistration(username, password) {
  try {
    const client = createClient({ baseUrl: 'https://official.cradleintro.top' });
    
    // 检查用户名可用性
    const available = await client.isUsernameAvailable(username);
    if (!available) {
      console.log('⚠️ 用户名已被占用，尝试登录...');
      return await testLogin(username, password);
    }
    
    // 注册新用户
    const response = await client.register(
      username,
      password,
      null,
      { type: 'm.login.dummy' }
    );
    
    console.log('✅ 用户注册成功');
    console.log('用户ID:', response.user_id);
    return response;
  } catch (error) {
    console.error('❌ 注册失败:', error.message);
    return false;
  }
}

// 3. 测试用户登录
async function testLogin(username, password) {
  try {
    const client = createClient({ baseUrl: 'https://official.cradleintro.top' });
    const response = await client.loginWithPassword(username, password);
    
    console.log('✅ 用户登录成功');
    console.log('用户ID:', response.user_id);
    return response;
  } catch (error) {
    console.error('❌ 登录失败:', error.message);
    return false;
  }
}

// 4. 测试房间创建
async function testRoomCreation(accessToken, userId, deviceId) {
  try {
    const client = createClient({
      baseUrl: 'https://official.cradleintro.top',
      accessToken,
      userId,
      deviceId
    });
    
    const response = await client.createRoom({
      name: `测试房间_${Date.now()}`,
      topic: '这是一个测试房间',
      preset: 'public_chat',
      visibility: 'public'
    });
    
    console.log('✅ 房间创建成功');
    console.log('房间ID:', response.room_id);
    return response.room_id;
  } catch (error) {
    console.error('❌ 房间创建失败:', error.message);
    return false;
  }
}

// 5. 测试消息发送
async function testMessageSending(accessToken, userId, deviceId, roomId) {
  try {
    const client = createClient({
      baseUrl: 'https://official.cradleintro.top',
      accessToken,
      userId,
      deviceId
    });
    
    const content = {
      msgtype: 'm.text',
      body: `测试消息 - ${new Date().toLocaleString()}`
    };
    
    const response = await client.sendEvent(roomId, 'm.room.message', content);
    
    console.log('✅ 消息发送成功');
    console.log('事件ID:', response.event_id);
    return true;
  } catch (error) {
    console.error('❌ 消息发送失败:', error.message);
    return false;
  }
}

// 运行完整测试
async function runFullTest() {
  console.log('🚀 开始 Matrix SDK 集成测试...\n');
  
  // 1. 测试连接
  const connected = await testConnection();
  if (!connected) return;
  
  // 2. 测试认证（使用随机用户名避免冲突）
  const username = `testuser_${Date.now()}`;
  const password = 'test123456';
  
  const authResult = await testRegistration(username, password);
  if (!authResult) return;
  
  // 3. 测试房间创建
  const roomId = await testRoomCreation(
    authResult.access_token,
    authResult.user_id,
    authResult.device_id
  );
  if (!roomId) return;
  
  // 4. 测试消息发送
  await testMessageSending(
    authResult.access_token,
    authResult.user_id,
    authResult.device_id,
    roomId
  );
  
  console.log('\n🎉 所有测试完成！');
}

// 导出测试函数
export {
  testConnection,
  testRegistration,
  testLogin,
  testRoomCreation,
  testMessageSending,
  runFullTest
};

// 如果直接运行此文件
if (import.meta.main) {
  runFullTest();
}
```

## 2. 在 React Native 中使用

### 简单的测试按钮组件

```typescript
// components/SimpleMatrixTest.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { createClient } from 'matrix-js-sdk';

export const SimpleMatrixTest = () => {
  const [status, setStatus] = useState('未开始');

  const testMatrixConnection = async () => {
    setStatus('测试中...');
    
    try {
      const client = createClient({ baseUrl: 'https://official.cradleintro.top' });
      const versions = await client.getVersions();
      
      setStatus('连接成功！');
      Alert.alert('成功', `Matrix 服务器连接成功\n支持版本: ${versions.versions.join(', ')}`);
    } catch (error) {
      setStatus('连接失败');
      Alert.alert('错误', `连接失败: ${error.message}`);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>Matrix 连接测试</Text>
      <TouchableOpacity
        onPress={testMatrixConnection}
        style={{
          backgroundColor: '#5865f2',
          padding: 15,
          borderRadius: 8,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>
          测试 Matrix 服务器连接
        </Text>
      </TouchableOpacity>
      <Text style={{ marginTop: 20, textAlign: 'center' }}>
        状态: {status}
      </Text>
    </View>
  );
};
```

## 3. 命令行测试

### 创建独立的测试脚本

```javascript
// scripts/test-matrix.js
const { createClient } = require('matrix-js-sdk');

async function quickTest() {
  console.log('测试 Matrix 服务器连接...');
  
  try {
    const client = createClient({ baseUrl: 'https://official.cradleintro.top' });
    const versions = await client.getVersions();
    
    console.log('✅ 连接成功！');
    console.log('支持的 Matrix 版本:', versions.versions);
    console.log('不稳定特性:', Object.keys(versions.unstable_features || {}));
    
    return true;
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 建议检查：');
      console.log('1. 域名是否正确：cradleintro.top');
      console.log('2. 服务器是否正在运行');
      console.log('3. 网络连接是否正常');
    }
    
    return false;
  }
}

quickTest();
```

### 运行测试

```bash
node scripts/test-matrix.js
```

## 4. 常见问题排查

### 连接失败
- 检查服务器 URL 是否正确
- 确认 Synapse 服务正在运行
- 检查防火墙和端口设置

### 认证失败
- 确认用户名和密码正确
- 检查服务器的注册设置
- 验证客户端配置

### 房间创建失败
- 确认用户已正确登录
- 检查权限设置
- 验证房间配置参数

### 消息发送失败
- 确认已加入房间
- 检查消息内容格式
- 验证用户权限

## 5. 下一步

测试成功后，可以：

1. 实现完整的认证流程
2. 添加实时消息同步
3. 集成到现有的 Discord 风格界面
4. 添加文件上传功能
5. 实现端到端加密

参考完整的 `MATRIX_SDK_INTEGRATION_GUIDE.md` 获取详细的集成步骤。 