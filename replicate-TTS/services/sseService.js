const EventEmitter = require('events');
const config = require('../config');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class SSEService extends EventEmitter {
  constructor() {
    super();
    // 存储活跃的客户端连接
    this.clients = new Map();
    // 设置最大监听器数量
    this.setMaxListeners(100);
    // 启动心跳发送器
    this.startHeartbeat();
  }

  // 添加新的客户端连接
  addClient(req, res) {
    const clientId = uuidv4();

    // 设置 SSE 标头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // 禁用 Nginx 代理缓冲
    });

    // 发送初始连接消息
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // 存储客户端连接
    const client = {
      id: clientId,
      res,
      messageQueue: [],
      lastActivity: Date.now(),
      tasks: new Set() // 该客户端关注的任务 ID 列表
    };
    
    this.clients.set(clientId, client);
    logger.info(`SSE client connected: ${clientId}`);
    
    // 处理客户端断开连接
    req.on('close', () => this.removeClient(clientId));
    req.on('end', () => this.removeClient(clientId));
    
    // 返回客户端 ID 用于后续操作
    return clientId;
  }

  // 移除客户端连接
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      logger.info(`SSE client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    }
  }

  // 发送事件到指定客户端
  sendEvent(clientId, event, data) {
    const client = this.clients.get(clientId);
    if (!client) {
      return false; // 客户端不存在
    }
    
    try {
      // 构建 SSE 格式的消息
      let message = '';
      if (event) {
        message += `event: ${event}\n`;
      }
      message += `data: ${JSON.stringify(data)}\n\n`;
      
      // 发送消息
      client.res.write(message);
      client.lastActivity = Date.now();
      
      return true;
    } catch (error) {
      logger.error(`Error sending SSE event to client ${clientId}:`, error);
      this.removeClient(clientId); // 发送失败时移除客户端
      return false;
    }
  }

  // 广播事件到所有客户端
  broadcastEvent(event, data) {
    let successCount = 0;
    this.clients.forEach((client, clientId) => {
      if (this.sendEvent(clientId, event, data)) {
        successCount++;
      }
    });
    return successCount;
  }

  // 将客户端订阅到特定任务的更新
  subscribeClientToTask(clientId, taskId) {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    client.tasks.add(taskId);
    logger.debug(`Client ${clientId} subscribed to task ${taskId}`);
    return true;
  }

  // 向订阅了特定任务的所有客户端发送更新
  sendTaskUpdate(taskId, status, data) {
    let sentCount = 0;
    
    // 遍历所有客户端
    this.clients.forEach((client, clientId) => {
      // 检查客户端是否订阅了这个任务
      if (client.tasks.has(taskId)) {
        const eventData = {
          taskId,
          status,
          ...data,
          timestamp: new Date().toISOString()
        };
        
        if (this.sendEvent(clientId, 'task_update', eventData)) {
          sentCount++;
        }
        
        // 如果是最终状态，移除订阅
        if (status === 'succeeded' || status === 'failed') {
          client.tasks.delete(taskId);
        }
      }
    });
    
    return sentCount;
  }

  // 定期发送心跳以保持连接
  startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, clientId) => {
        // 发送心跳
        this.sendEvent(clientId, 'heartbeat', { timestamp: now });
        
        // 检查客户端超时
        if (now - client.lastActivity > config.sse.clientTimeout) {
          logger.info(`SSE client ${clientId} timed out`);
          this.removeClient(clientId);
        }
      });
    }, config.sse.heartbeatInterval);
  }
}

module.exports = new SSEService();
