const amqp = require('amqplib');
const config = require('../config');
const logger = require('../utils/logger');

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.consumers = new Map();
  }

  /**
   * Connect to RabbitMQ and set up channels and queues
   */
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Already connected to RabbitMQ');
        return;
      }

      if (this.isReconnecting) {
        logger.info('Already attempting to reconnect to RabbitMQ');
        return;
      }

      this.isReconnecting = true;
      
      // 隐藏密码的日志输出
      const connectionUrlForLog = config.rabbitmq.url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
      logger.info(`Connecting to RabbitMQ: ${connectionUrlForLog}`);
      
      // Connect to RabbitMQ
      this.connection = await amqp.connect(config.rabbitmq.url);
      
      // Handle connection errors
      this.connection.on('error', (err) => {
        if (err.message.includes('auth')) {
          logger.error('RabbitMQ authentication error. Please check username and password.');
        } else {
          logger.error('RabbitMQ connection error:', err);
        }
        this.handleDisconnect();
      });
      
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.handleDisconnect();
      });
      
      // Create channel
      this.channel = await this.connection.createChannel();
      
      // Set up dead letter exchange
      await this.channel.assertExchange('dl.exchange', 'direct', { durable: true });
      
      // Set up dead letter queue
      await this.channel.assertQueue(config.rabbitmq.queues.deadLetter, { 
        durable: true 
      });
      
      await this.channel.bindQueue(
        config.rabbitmq.queues.deadLetter,
        'dl.exchange',
        'dead.letter.routing.key'
      );
      
      // Set up retry queue with TTL
      await this.channel.assertQueue(config.rabbitmq.queues.retry, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': config.rabbitmq.queues.generation,
        }
      });
      
      // Set up main queue with dead letter setup
      await this.channel.assertQueue(config.rabbitmq.queues.generation, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dl.exchange',
          'x-dead-letter-routing-key': 'dead.letter.routing.key'
        }
      });
      
      this.isConnected = true;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      logger.info('Successfully connected to RabbitMQ');
      
      // Restore consumers
      if (this.consumers.size > 0) {
        for (const [queue, callback] of this.consumers.entries()) {
          await this.consume(queue, callback);
        }
      }
    } catch (error) {
      this.isConnected = false;
      this.isReconnecting = false;
      
      if (error.message.includes('auth')) {
        logger.error('Failed to connect to RabbitMQ: Authentication failed. Please check your credentials.');
      } else {
        logger.error('Failed to connect to RabbitMQ:', error);
      }
      
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Safely disconnect from RabbitMQ
   */
  async disconnect() {
    try {
      if (!this.isConnected) return;
      
      if (this.channel) {
        await this.channel.close();
      }
      
      if (this.connection) {
        await this.connection.close();
      }
      
      this.isConnected = false;
      logger.info('Disconnected from RabbitMQ');
    } catch (error) {
      logger.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  /**
   * Handle disconnection and attempt reconnect
   */
  handleDisconnect() {
    if (this.isReconnecting) return;
    
    this.isConnected = false;
    this.channel = null;
    this.scheduleReconnect();
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect() {
    if (this.isReconnecting) return;
    
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error('Maximum reconnect attempts reached. Giving up.');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      logger.info('Attempting to reconnect to RabbitMQ...');
      this.connect().catch(err => {
        logger.error('Reconnect attempt failed:', err);
      });
    }, delay);
  }

  /**
   * Publish a message to a queue
   * @param {string} queue - Queue name
   * @param {object} message - Message to publish
   * @param {object} options - Publishing options
   */
  async publish(queue, message, options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      await this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          ...options
        }
      );
      
      logger.debug(`Published message to queue ${queue}`);
    } catch (error) {
      logger.error(`Error publishing to queue ${queue}:`, error);
      throw error;
    }
  }

  /**
   * Consume messages from a queue
   * @param {string} queue - Queue name
   * @param {function} callback - Message handler function
   */
  async consume(queue, callback) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      // Store consumer for reconnection
      this.consumers.set(queue, callback);
      
      await this.channel.consume(queue, async (msg) => {
        if (!msg) return;
        
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content, msg);
          this.channel.ack(msg);
        } catch (error) {
          logger.error(`Error processing message from ${queue}:`, error);
          
          // Reject the message and don't requeue
          this.channel.nack(msg, false, false);
        }
      });
      
      logger.info(`Consumer registered for queue ${queue}`);
    } catch (error) {
      logger.error(`Error consuming from queue ${queue}:`, error);
      throw error;
    }
  }

  /**
   * Schedule a message for retry with exponential backoff
   * @param {string} queue - Target queue for eventual redelivery
   * @param {object} message - Message to retry
   * @param {number} retryCount - Current retry count
   */
  async scheduleRetry(message, retryCount = 0) {
    try {
      const { maxRetries, initialInterval, multiplier, maxInterval } = config.retry;
      
      // If max retries reached, move to dead letter queue
      if (retryCount >= maxRetries) {
        logger.warn(`Max retries (${maxRetries}) reached for message: ${JSON.stringify(message)}`);
        await this.publish(config.rabbitmq.queues.deadLetter, {
          ...message,
          retryCount,
          failedAt: new Date().toISOString(),
          reason: 'Max retries exceeded'
        });
        return;
      }
      
      // Calculate retry delay with exponential backoff
      const delay = Math.min(
        initialInterval * Math.pow(multiplier, retryCount),
        maxInterval
      );
      
      // Update message with retry information
      const retryMessage = {
        ...message,
        retryCount: retryCount + 1,
        retriedAt: new Date().toISOString()
      };
      
      // Publish to retry queue with delay
      await this.channel.sendToQueue(
        config.rabbitmq.queues.retry,
        Buffer.from(JSON.stringify(retryMessage)),
        {
          persistent: true,
          expiration: delay.toString()
        }
      );
      
      logger.info(`Scheduled retry ${retryCount + 1}/${maxRetries} for task ${message.taskId} in ${delay}ms`);
    } catch (error) {
      logger.error('Error scheduling retry:', error);
      throw error;
    }
  }
}

module.exports = new RabbitMQService();
