const amqp = require('amqplib');
const config = require('../config');
const logger = require('../utils/logger');

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isInitialized = false;
    this.retryQueue = config.rabbitmq.retryQueue;
    this.deadLetterQueue = config.rabbitmq.deadLetterQueue;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // 连接到 RabbitMQ 服务器
      logger.info('Connecting to RabbitMQ server with credentials');
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      // 确保队列存在
      await this.channel.assertQueue(this.retryQueue, {
        durable: true // 持久化队列，确保重启后队列仍然存在
      });
      
      // 创建死信队列，用于存储最终失败的任务
      await this.channel.assertQueue(this.deadLetterQueue, {
        durable: true
      });
      
      // 设置错误处理
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        this.reconnect();
      });
      
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect');
        this.reconnect();
      });
      
      this.isInitialized = true;
      logger.info('RabbitMQ service initialized successfully');
    } catch (error) {
      // 检查是否是认证错误
      if (error.message && error.message.includes('ACCESS_REFUSED')) {
        logger.error('RabbitMQ authentication failed. Please check credentials in .env file.');
      } else if (error.message && error.message.includes('ECONNREFUSED')) {
        logger.error('Failed to connect to RabbitMQ server. Please check if RabbitMQ is running.');
      } else {
        logger.error('Failed to initialize RabbitMQ:', error);
      }
      
      // 尝试重新连接
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  async reconnect() {
    this.isInitialized = false;
    if (this.channel) {
      try {
        await this.channel.close();
      } catch (err) {
        logger.error('Error closing RabbitMQ channel:', err);
      }
    }
    
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (err) {
        logger.error('Error closing RabbitMQ connection:', err);
      }
    }
    
    // 尝试重新初始化
    setTimeout(() => this.initialize(), 5000);
  }

  async addToRetryQueue(task, retryCount = 0, delay = 0) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // 计算下一次重试的延迟时间（指数退避）
      const nextRetry = retryCount + 1;
      const nextDelay = Math.min(
        config.retry.initialInterval * Math.pow(config.retry.multiplier, retryCount),
        config.retry.maxInterval
      );
      
      // 准备队列消息
      const message = {
        ...task,
        retryCount: nextRetry,
        nextRetryAt: Date.now() + nextDelay,
        createdAt: task.createdAt || Date.now()
      };
      
      // 如果需要延迟发送（使用定时器模拟延迟队列）
      if (delay > 0) {
        setTimeout(() => {
          this.channel.sendToQueue(
            this.retryQueue,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
          );
          logger.info(`Task scheduled for retry in ${delay}ms, retry count: ${nextRetry}`);
        }, delay);
      } else {
        // 立即发送到队列
        this.channel.sendToQueue(
          this.retryQueue,
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
        logger.info(`Task added to retry queue, retry count: ${nextRetry}`);
      }
      
      return message;
    } catch (error) {
      logger.error('Error adding task to retry queue:', error);
      throw error;
    }
  }

  async moveToDeadLetterQueue(task, reason) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // 添加失败信息
      const failedTask = {
        ...task,
        finalFailure: true,
        failureReason: reason,
        failedAt: Date.now()
      };
      
      // 发送到死信队列
      this.channel.sendToQueue(
        this.deadLetterQueue,
        Buffer.from(JSON.stringify(failedTask)),
        { persistent: true }
      );
      
      logger.warn(`Task moved to dead letter queue after ${task.retryCount} retries. Reason: ${reason}`);
      return failedTask;
    } catch (error) {
      logger.error('Error moving task to dead letter queue:', error);
      throw error;
    }
  }

  async consumeRetryQueue(callback) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // 开始消费重试队列
    this.channel.consume(this.retryQueue, async (msg) => {
      if (msg) {
        try {
          const task = JSON.parse(msg.content.toString());
          
          // 检查是否到达重试时间
          const now = Date.now();
          if (task.nextRetryAt && task.nextRetryAt > now) {
            // 还没到重试时间，放回队列
            const delay = task.nextRetryAt - now;
            this.channel.ack(msg); // 确认当前消息
            await this.addToRetryQueue(task, task.retryCount - 1, delay);
            return;
          }
          
          // 检查重试次数是否超过最大值
          if (task.retryCount > config.retry.maxRetries) {
            this.channel.ack(msg); // 确认当前消息
            await this.moveToDeadLetterQueue(task, 'Maximum retry attempts exceeded');
            return;
          }
          
          // 执行回调函数处理任务
          await callback(task);
          this.channel.ack(msg);
        } catch (error) {
          logger.error('Error processing retry task:', error);
          // 发生错误时，将消息重新放回队列
          this.channel.nack(msg, false, true);
        }
      }
    });
    
    logger.info('Started consuming from retry queue');
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.isInitialized = false;
  }
}

module.exports = new RabbitMQService();
