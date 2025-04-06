/**
 * SSE Client SDK for Text2Img Service
 * 提供与服务器端事件和图像生成 API 的便捷交互
 */
class Text2ImgEventClient {
  /**
   * 创建一个新的客户端实例
   * @param {Object} options - 配置选项
   * @param {string} options.baseUrl - 服务器基础 URL
   * @param {number} options.reconnectInterval - 重连间隔（毫秒）
   * @param {number} options.maxReconnectAttempts - 最大重连尝试次数
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.reconnectInterval = options.reconnectInterval || 2000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.connected = false;
    this.eventListeners = {};
    this.taskListeners = {};
    this.clientId = null;
  }

  /**
   * 连接到 SSE 事件流
   * @param {string} taskId - 可选的特定任务 ID
   * @returns {Promise} - 连接成功或失败的 Promise
   */
  connect(taskId = null) {
    return new Promise((resolve, reject) => {
      try {
        // 关闭任何现有连接
        if (this.eventSource) {
          this.eventSource.close();
        }
        
        // 构建事件源 URL
        const url = new URL(`${this.baseUrl}/events`);
        if (taskId) {
          url.searchParams.append('taskId', taskId);
        }
        
        // 创建新的 EventSource
        this.eventSource = new EventSource(url.toString());
        
        // 设置监听器
        this.eventSource.addEventListener('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          console.log('SSE 连接建立');
        });
        
        this.eventSource.addEventListener('error', (error) => {
          this.connected = false;
          console.error('SSE 连接错误:', error);
          
          // 尝试重连
          this.reconnect().catch(err => {
            reject(err);
          });
        });
        
        // 设置连接建立事件
        this.eventSource.addEventListener('connected', (event) => {
          const data = JSON.parse(event.data);
          this.clientId = data.clientId;
          console.log(`SSE 客户端 ID: ${this.clientId}`);
          resolve(data);
        });
        
        // 处理任务更新
        this.eventSource.addEventListener('task_update', (event) => {
          const data = JSON.parse(event.data);
          
          // 触发全局任务更新事件
          this._triggerEvent('task_update', data);
          
          // 触发特定任务的事件
          if (data.taskId && this.taskListeners[data.taskId]) {
            this._triggerTaskEvent(data.taskId, data);
          }
        });
      } catch (error) {
        console.error('建立 SSE 连接时出错:', error);
        reject(error);
      }
    });
  }

  /**
   * 重连到 SSE 服务器
   * @returns {Promise} - 重连成功或失败的 Promise
   */
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`已达到最大重连次数 (${this.maxReconnectAttempts})`);
      throw new Error('Maximum reconnect attempts reached');
    }
    
    this.reconnectAttempts++;
    
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`尝试在 ${delay}ms 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.connect()
          .then(resolve)
          .catch(reject);
      }, delay);
    });
  }

  /**
   * 关闭 SSE 连接
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connected = false;
      console.log('SSE 连接已关闭');
    }
  }

  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {function} callback - 回调函数
   */
  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {function} callback - 要移除的回调函数
   */
  removeEventListener(event, callback) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event] = this.eventListeners[event].filter(
      cb => cb !== callback
    );
  }

  /**
   * 添加特定任务的监听器
   * @param {string} taskId - 任务 ID
   * @param {function} callback - 回调函数
   */
  addTaskListener(taskId, callback) {
    if (!this.taskListeners[taskId]) {
      this.taskListeners[taskId] = [];
    }
    this.taskListeners[taskId].push(callback);
  }

  /**
   * 移除特定任务的监听器
   * @param {string} taskId - 任务 ID
   * @param {function} callback - 要移除的回调函数
   */
  removeTaskListener(taskId, callback) {
    if (!this.taskListeners[taskId]) return;
    
    this.taskListeners[taskId] = this.taskListeners[taskId].filter(
      cb => cb !== callback
    );
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   * @private
   */
  _triggerEvent(event, data) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`执行事件 ${event} 的监听器时出错:`, error);
      }
    });
  }

  /**
   * 触发特定任务的事件
   * @param {string} taskId - 任务 ID
   * @param {any} data - 事件数据
   * @private
   */
  _triggerTaskEvent(taskId, data) {
    if (!this.taskListeners[taskId]) return;
    
    this.taskListeners[taskId].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`执行任务 ${taskId} 的监听器时出错:`, error);
      }
    });
  }

  /**
   * 生成图像
   * @param {Object} params - 生成参数
   * @returns {Promise} - 生成结果 Promise
   */
  async generateImage(params) {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Image generation failed');
      }
      
      return data.data;
    } catch (error) {
      console.error('生成图像时出错:', error);
      throw error;
    }
  }

  /**
   * 重试图像生成任务
   * @param {Object} params - 重试参数，包含 taskId
   * @returns {Promise} - 重试结果 Promise
   */
  async retryImage(params) {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Retry failed');
      }
      
      return data.data;
    } catch (error) {
      console.error('重试图像生成时出错:', error);
      throw error;
    }
  }

  /**
   * 获取任务状态
   * @param {string} taskId - 任务 ID
   * @returns {Promise} - 任务状态 Promise
   */
  async getTaskStatus(taskId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate/task/${taskId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get task status');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取任务状态时出错:', error);
      throw error;
    }
  }
}

// 在浏览器环境中导出
if (typeof window !== 'undefined') {
  window.Text2ImgEventClient = Text2ImgEventClient;
}

// 在 Node.js 环境中导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Text2ImgEventClient;
}
