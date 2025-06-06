// import '@/lib/polyfills';
// import { createClient, ClientEvent, SyncState } from 'matrix-js-sdk';

// // 简单的Matrix连接测试
// export async function testMatrixConnection() {
//   console.log('开始Matrix连接测试...');
  
//   try {
//     // 1. 测试服务器连接
//     const client = createClient({ baseUrl: 'https://official.cradleintro.top' });
//     const versions = await client.getVersions();
//     console.log('✅ 服务器连接成功:', versions.versions);
    
//     // 2. 测试登录
//     const username = `testuser_${Date.now()}`;
//     const password = 'test123456';
    
//     console.log(`尝试注册用户: ${username}`);
    
//     const response = await client.register(
//       username,
//       password,
//       null,
//       { type: 'm.login.dummy' }
//     );
    
//     console.log('✅ 注册成功:', response.user_id);
    
//     // 3. 创建认证客户端
//     const authClient = createClient({
//       baseUrl: 'https://official.cradleintro.top',
//       accessToken: response.access_token,
//       userId: response.user_id,
//       deviceId: response.device_id,
//     });
    
//     // 4. 启动客户端
//     console.log('启动客户端同步...');
//     await authClient.startClient({ initialSyncLimit: 5 });
    
//     // 5. 等待同步完成
//     await new Promise((resolve, reject) => {
//       const timeout = setTimeout(() => {
//         reject(new Error('同步超时'));
//       }, 15000);
      
//       authClient.on(ClientEvent.Sync, (state: SyncState) => {
//         console.log('同步状态:', state);
//         if (state === SyncState.Prepared) {
//           clearTimeout(timeout);
//           resolve(true);
//         }
//       });
//     });
    
//     console.log('✅ 所有测试通过！');
    
//     // 清理
//     authClient.stopClient();
    
//     return true;
//   } catch (error) {
//     console.error('❌ 测试失败:', error);
//     return false;
//   }
// }