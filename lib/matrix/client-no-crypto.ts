// // Matrix客户端 - 无加密版本，专门为React Native构建
// import '@/lib/polyfills';
// import matrixConfig from './config';

// // 只导入基础的Matrix SDK模块，避免加密依赖
// import { 
//   createClient, 
//   MatrixClient, 
//   Room, 
//   MatrixEvent, 
//   Preset, 
//   Visibility, 
//   EventType, 
//   MsgType
// } from 'matrix-js-sdk';

// console.log('[Matrix Client No-Crypto] Initializing Matrix client without encryption support');

// export interface MatrixCredentials {
//   homeserverUrl: string;
//   accessToken: string;
//   userId: string;
//   deviceId?: string;
// }

// export class MatrixClientManagerNoCrypto {
//   private client: MatrixClient | null = null;
//   private credentials: MatrixCredentials | null = null;
//   private isInitializing = false;

//   // 创建并初始化客户端（无加密）
//   async initializeClient(credentials: MatrixCredentials): Promise<MatrixClient> {
//     if (this.isInitializing) {
//       throw new Error('客户端正在初始化中');
//     }

//     this.isInitializing = true;
//     this.credentials = credentials;
    
//     try {
//       console.log('[Matrix Client No-Crypto] Creating client without crypto support...');
      
//       this.client = createClient({
//         baseUrl: credentials.homeserverUrl,
//         accessToken: credentials.accessToken,
//         userId: credentials.userId,
//         deviceId: credentials.deviceId,
//         timelineSupport: true,
//         // 明确禁用加密相关功能
//         cryptoStore: undefined,
//         storeCryptoKeys: false,
//       } as any); // 使用 any 来避免类型检查问题

//       // 启动客户端同步，使用保守设置
//       await this.client.startClient({ 
//         initialSyncLimit: matrixConfig.syncSettings.initialSyncLimit,
//         lazyLoadMembers: matrixConfig.syncSettings.lazyLoadMembers,
//       });

//       console.log('[Matrix Client No-Crypto] ✓ Client initialized successfully');
//       return this.client;
//     } catch (error) {
//       console.error('[Matrix Client No-Crypto] 客户端初始化失败:', error);
//       this.client = null;
//       this.credentials = null;
//       throw error;
//     } finally {
//       this.isInitializing = false;
//     }
//   }

//   // 获取当前客户端
//   getClient(): MatrixClient | null {
//     return this.client;
//   }

//   // 检查客户端是否已初始化
//   isClientReady(): boolean {
//     return this.client !== null && !this.isInitializing;
//   }

//   // 断开连接
//   disconnect(): void {
//     if (this.client) {
//       try {
//         this.client.stopClient();
//         this.client = null;
//         this.credentials = null;
//         console.log('[Matrix Client No-Crypto] ✓ Disconnected successfully');
//       } catch (error) {
//         console.error('[Matrix Client No-Crypto] Disconnect error:', error);
//       }
//     }
//   }

//   // 基础的房间操作（不涉及加密）
//   async createRoom(name: string, topic?: string): Promise<string> {
//     if (!this.client) throw new Error('客户端未初始化');

//     const response = await this.client.createRoom({
//       name,
//       topic,
//       preset: Preset.PublicChat,
//       visibility: Visibility.Public,
//       // 禁用加密
//       initial_state: [],
//     });

//     return response.room_id;
//   }

//   // 发送普通消息（不加密）
//   async sendMessage(roomId: string, message: string): Promise<string> {
//     if (!this.client) throw new Error('客户端未初始化');

//     const response = await this.client.sendEvent(roomId, EventType.RoomMessage, {
//       msgtype: MsgType.Text,
//       body: message,
//     });

//     return response.event_id;
//   }

//   // 获取房间列表
//   getRooms(): Room[] {
//     if (!this.client) return [];
//     return this.client.getRooms();
//   }

//   // 简单的登录方法
//   async login(username: string, password: string, homeserverUrl: string = 'https://official.cradleintro.top'): Promise<MatrixCredentials> {
//     try {
//       console.log('[Matrix Client No-Crypto] Attempting login...');
      
//       const tempClient = createClient({
//         baseUrl: homeserverUrl,
//       });

//       const loginResponse = await tempClient.login('m.login.password', {
//         user: username,
//         password: password,
//       });

//       const credentials: MatrixCredentials = {
//         homeserverUrl,
//         accessToken: loginResponse.access_token,
//         userId: loginResponse.user_id,
//         deviceId: loginResponse.device_id,
//       };

//       console.log('[Matrix Client No-Crypto] ✓ Login successful');
//       return credentials;
//     } catch (error) {
//       console.error('[Matrix Client No-Crypto] Login failed:', error);
//       throw error;
//     }
//   }
// }

// // 导出单例实例
// export const matrixClientNoCrypto = new MatrixClientManagerNoCrypto();