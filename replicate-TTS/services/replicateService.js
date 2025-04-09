const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const { v4: uuidv4 } = require('uuid');
const rabbitmqService = require('./rabbitmqService');
const sseService = require('./sseService');
const logger = require('../utils/logger');

// 创建 axios 实例并配置
const replicateAxios = axios.create({
  timeout: 30000, // 30秒超时
  maxRedirects: 5,
  // 允许更多最大并发连接
  maxContentLength: 50 * 1024 * 1024, // 50MB 最大响应大小
});

// 请求重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

class ReplicateService {
  constructor() {
    this.apiUrl = config.replicate.apiUrl;
    this.headers = {
      'Authorization': `Token ${config.replicate.apiToken}`,
      'Content-Type': 'application/json'
    };
    
    // 跟踪正在进行的请求
    this.activeRequests = new Map();
    
    // 限制同时访问 Replicate API 的请求数
    this.maxConcurrentReplicate = process.env.MAX_CONCURRENT_REPLICATE || 10;
    this.currentReplicate = 0;
    this.replicateQueue = [];

    // 跟踪任务状态
    this.taskStatus = new Map();
    
    // 初始化重试消费者
    this.initializeRetryConsumer();

    // 创建 axios 实例用于调用许可证服务
    this.licenseAxios = axios.create({
      timeout: 5000, // 5秒超时
      maxRedirects: 3,
    });
    
    this.licenseBaseUrl = process.env.LICENSE_API_URL || 'https://license.cradleintro.top';
    this.creditPerSecond = 0.01; // 每秒花费的信用点数
  }

  // 初始化重试队列消费者
  async initializeRetryConsumer() {
    try {
      await rabbitmqService.initialize();
      
      // 开始消费重试队列
      await rabbitmqService.consumeRetryQueue(async (task) => {
        logger.info(`Processing retry task: ${task.taskId}, retry attempt ${task.retryCount}`);
        
        try {
          // 发送状态更新：重试中
          sseService.sendTaskUpdate(
            task.taskId, 
            'retrying', 
            { 
              retryCount: task.retryCount,
              maxRetries: config.retry.maxRetries,
              message: `Retrying task (attempt ${task.retryCount}/${config.retry.maxRetries})`
            }
          );
          
          // 执行实际的任务重试
          const result = await this._executeReplicateRequest(task.payload, task.taskId, task.userEmail);
          
          // 如果成功，发送成功更新
          sseService.sendTaskUpdate(task.taskId, 'succeeded', { 
            output: result,
            message: 'Task completed successfully after retry'
          });
          
          return result;
        } catch (error) {
          logger.error(`Retry failed for task ${task.taskId}:`, error);
          
          // 检查是否达到最大重试次数
          if (task.retryCount >= config.retry.maxRetries) {
            // 发送最终失败状态
            sseService.sendTaskUpdate(task.taskId, 'failed', { 
              error: error.message || 'Max retries exceeded',
              message: `Task failed after ${task.retryCount} retry attempts`
            });
            
            // 移动到死信队列
            await rabbitmqService.moveToDeadLetterQueue(
              task, 
              error.message || 'Max retries exceeded'
            );
          } else {
            // 还可以继续重试，计算下一次重试间隔
            const nextRetryInterval = Math.min(
              config.retry.initialInterval * Math.pow(config.retry.multiplier, task.retryCount),
              config.retry.maxInterval
            );
            
            // 添加到重试队列
            await rabbitmqService.addToRetryQueue(
              task,
              task.retryCount,
              nextRetryInterval
            );
            
            // 发送状态更新：等待下一次重试
            sseService.sendTaskUpdate(task.taskId, 'waiting_retry', { 
              retryCount: task.retryCount + 1,
              maxRetries: config.retry.maxRetries,
              nextRetryAt: Date.now() + nextRetryInterval,
              message: `Will retry in ${Math.round(nextRetryInterval / 1000)} seconds`
            });
          }
          
          throw error;
        }
      });
      
      logger.info('Retry consumer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize retry consumer:', error);
      // 尝试稍后重新初始化
      setTimeout(() => this.initializeRetryConsumer(), 10000);
    }
  }

  async generateAudio(sourceAudioUrl, sourceTranscript, ttsText, instruction, task, clientId = null, taskId = null, userEmail = null) {
    try {
      // 如果没有提供任务ID，生成一个新的
      taskId = taskId || uuidv4();
      
      // 创建请求唯一键
      const requestKey = this._createRequestKey(sourceAudioUrl, sourceTranscript, ttsText, instruction, task);
      
      // 检查相同的请求是否已经在进行中
      if (this.activeRequests.has(requestKey)) {
        console.log('Duplicate request detected, reusing existing request');
        return this.activeRequests.get(requestKey);
      }
      
      // 准备 Replicate API 请求参数
      const payload = {
        version: "669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d",
        input: {
          source_audio: sourceAudioUrl,
          source_transcript: sourceTranscript,
          tts_text: ttsText,
          task: task || "zero-shot voice clone"
        }
      };
      
      // 添加指令参数（如果提供）
      if (instruction) {
        payload.input.instruction = instruction;
      }
      
      // 如果提供了客户端ID，将其订阅到此任务
      if (clientId) {
        sseService.subscribeClientToTask(clientId, taskId);
      }
      
      // 发送初始状态更新
      sseService.sendTaskUpdate(taskId, 'starting', { 
        message: 'Task is being prepared',
        input: {
          tts_text: ttsText,
          instruction: instruction || null,
          task: task || "zero-shot voice clone"
        }
      });

      // 创建此请求的 Promise 并存储在活动请求中
      const requestPromise = this._executeReplicateRequestWithQueue(payload, requestKey, taskId, userEmail);
      this.activeRequests.set(requestKey, requestPromise);
      
      // 完成后从活动请求中移除
      requestPromise.finally(() => {
        this.activeRequests.delete(requestKey);
      });
      
      return requestPromise;
    } catch (error) {
      logger.error('Error calling Replicate API:', error.response?.data || error.message);
      
      // 如果有任务ID，发送失败状态
      if (taskId) {
        sseService.sendTaskUpdate(taskId, 'failed', { 
          error: error.message || 'Unknown error',
          message: 'Failed to start task'
        });
      }
      
      throw new Error('Failed to generate audio via Replicate API');
    }
  }
  
  // 执行 Replicate 请求，带队列系统
  async _executeReplicateRequestWithQueue(payload, requestKey, taskId, userEmail) {
    // 如果已达到 Replicate API 并发限制，则排队等待
    if (this.currentReplicate >= this.maxConcurrentReplicate) {
      sseService.sendTaskUpdate(taskId, 'queued', { 
        message: 'Task is queued, waiting for available resources',
        queuePosition: this.replicateQueue.length + 1
      });
      
      await new Promise((resolve) => {
        this.replicateQueue.push(resolve);
      });
      
      sseService.sendTaskUpdate(taskId, 'dequeued', { 
        message: 'Task is now being processed'
      });
    }
    
    this.currentReplicate++;
    
    try {
      return await this._executeReplicateRequestWithRetry(payload, requestKey, taskId, 0, userEmail);
    } finally {
      this.currentReplicate--;
      
      // 处理队列中的下一个请求
      if (this.replicateQueue.length > 0) {
        const nextResolve = this.replicateQueue.shift();
        nextResolve();
      }
    }
  }
  
  // 执行 Replicate 请求，带重试机制
  async _executeReplicateRequestWithRetry(payload, requestKey, taskId, retryCount = 0, userEmail) {
    try {
      return await this._executeReplicateRequest(payload, taskId, userEmail);
    } catch (error) {
      // 检查是否应该重试
      if (retryCount < MAX_RETRIES && this._isRetryableError(error)) {
        logger.info(`Retrying Replicate request (${retryCount + 1}/${MAX_RETRIES}) after error: ${error.message}`);
        
        // 通知客户端内部重试
        sseService.sendTaskUpdate(taskId, 'retrying', { 
          retryCount: retryCount + 1,
          maxRetries: MAX_RETRIES,
          message: `Internal retry attempt ${retryCount + 1}/${MAX_RETRIES}`
        });
        
        await sleep(RETRY_DELAY * Math.pow(2, retryCount)); // 指数退避策略
        return this._executeReplicateRequestWithRetry(payload, requestKey, taskId, retryCount + 1, userEmail);
      }
      
      // 如果内部重试失败，添加到重试队列进行后台重试
      const task = {
        taskId,
        payload,
        requestKey,
        retryCount: 0,
        createdAt: Date.now(),
        userEmail // 添加用户邮箱以便后台重试时使用
      };
      
      // 记录最终错误
      logger.error(`Adding task ${taskId} to retry queue after initial failure:`, error);
      
      // 通知客户端任务已进入后台重试
      sseService.sendTaskUpdate(taskId, 'queued_for_retry', { 
        message: 'Task will be retried in the background',
        error: error.message || 'Task failed on initial attempt'
      });
      
      // 添加到重试队列
      await rabbitmqService.addToRetryQueue(task);
      
      throw error;
    }
  }
  
  // 检查错误是否可重试
  _isRetryableError(error) {
    // 网络错误、超时或服务器 5xx 错误通常是可重试的
    return !error.response || 
           error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           (error.response && error.response.status >= 500);
  }
  
  // 执行实际的 Replicate 请求
  async _executeReplicateRequest(payload, taskId, userEmail) {
    logger.info(`Executing Replicate request for task: ${taskId}`);
    
    // 发送状态更新：处理中
    sseService.sendTaskUpdate(taskId, 'processing', { 
      message: 'Request sent to Replicate API'
    });
    
    // 发送请求创建预测任务
    const response = await replicateAxios.post(this.apiUrl, payload, { headers: this.headers });
    
    // 获取预测任务 ID
    const predictionId = response.data.id;
    logger.info(`Prediction created with ID: ${predictionId} for task: ${taskId}`);
    
    // 发送状态更新：预测已创建
    sseService.sendTaskUpdate(taskId, 'prediction_created', { 
      predictionId,
      message: 'Prediction job created on Replicate'
    });
    
    // 轮询获取预测结果
    return await this.pollPredictionResult(predictionId, taskId, userEmail);
  }

  async pollPredictionResult(predictionId, taskId, userEmail) {
    // Increase the maximum attempts to allow for longer processing time
    const maxAttempts = 180;  // 6 minutes at 2-second intervals
    const pollingInterval = 2000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await replicateAxios.get(
          `${this.apiUrl}/${predictionId}`,
          { headers: this.headers }
        );
        
        const prediction = response.data;
        
        if (prediction.status === 'succeeded') {
          logger.info(`Prediction ${predictionId} succeeded for task ${taskId}`);
          
          // 在成功后获取详细信息并计算费用
          try {
            const details = await this.getPredictionDetails(predictionId);
            const predictTime = details?.metrics?.predict_time || 0;
            const cost = predictTime * this.creditPerSecond;
            
            logger.info(`Task ${taskId} used ${predictTime} seconds, cost: ${cost} credits`);
            
            // 如果有用户邮箱，扣除相应费用
            if (userEmail && cost > 0) {
              await this.deductCredits(userEmail, cost, predictionId, taskId);
            }
            
            // 将花费信息添加到状态更新中
            sseService.sendTaskUpdate(taskId, 'succeeded', { 
              predictionId,
              output: prediction.output,
              message: 'Audio generation completed successfully',
              metrics: {
                predictTime,
                cost
              }
            });
          } catch (costError) {
            logger.error(`Error processing costs for task ${taskId}:`, costError);
            
            // 即使费用处理失败，也继续返回成功生成的音频
            sseService.sendTaskUpdate(taskId, 'succeeded', { 
              predictionId,
              output: prediction.output,
              message: 'Audio generation completed successfully, but cost processing failed',
              error: costError.message
            });
          }
          
          // 下载生成的音频文件
          const audioUrl = prediction.output;
          const audioBuffer = await this.downloadAudio(audioUrl, taskId);
          return audioBuffer;
        } else if (prediction.status === 'failed') {
          const errorMsg = prediction.error || 'Prediction failed without specific error';
          logger.error(`Prediction ${predictionId} failed for task ${taskId}: ${errorMsg}`);
          
          // 发送状态更新：失败
          sseService.sendTaskUpdate(taskId, 'failed', { 
            predictionId,
            error: errorMsg,
            message: 'Audio generation failed on Replicate'
          });
          
          throw new Error(`Prediction failed: ${errorMsg}`);
        } else {
          // 更新状态：仍在处理中
          if (attempt % 5 === 0) { // 每 10 秒更新一次客户端状态，减少过多的 SSE 消息
            sseService.sendTaskUpdate(taskId, 'processing', { 
              predictionId,
              status: prediction.status,
              progress: Math.min(90, Math.round((attempt / maxAttempts) * 100)),
              message: `Processing prediction (${attempt + 1}/${maxAttempts})`
            });
          }
          
          logger.debug(`Prediction status for ${taskId}: ${prediction.status}. Waiting... (Attempt ${attempt + 1}/${maxAttempts})`);
          await sleep(pollingInterval);
        }
      } catch (error) {
        // Only throw an error if the API call itself failed
        // We don't want to exit polling just because of a temporary network issue
        logger.warn(`Error during polling for task ${taskId}, will retry:`, error.message);
        await sleep(pollingInterval);
      }
    }
    
    // Even after maximum attempts, don't throw error if the task is still running
    // Instead, provide a message but continue polling
    logger.warn(`Maximum initial polling attempts (${maxAttempts}) reached for task ${taskId}, but task may still be processing.`);
    
    // 发送状态更新：仍在处理中，但超过了初始轮询次数
    sseService.sendTaskUpdate(taskId, 'extended_processing', { 
      predictionId,
      message: 'Processing is taking longer than expected, continuing to wait'
    });
    
    // Continue polling indefinitely until the task succeeds or fails
    let extendedAttempt = 0;
    while (true) {
      try {
        const response = await replicateAxios.get(
          `${this.apiUrl}/${predictionId}`,
          { headers: this.headers }
        );
        
        const prediction = response.data;
        
        if (prediction.status === 'succeeded') {
          logger.info(`Prediction ${predictionId} finally succeeded for task ${taskId} after extended polling`);
          
          // 在成功后获取详细信息并计算费用
          try {
            const details = await this.getPredictionDetails(predictionId);
            const predictTime = details?.metrics?.predict_time || 0;
            const cost = predictTime * this.creditPerSecond;
            
            logger.info(`Task ${taskId} used ${predictTime} seconds after extended polling, cost: ${cost} credits`);
            
            // 如果有用户邮箱，扣除相应费用
            if (userEmail && cost > 0) {
              await this.deductCredits(userEmail, cost, predictionId, taskId);
            }
            
            // 将花费信息添加到状态更新中
            sseService.sendTaskUpdate(taskId, 'succeeded', { 
              predictionId,
              output: prediction.output,
              message: 'Audio generation completed successfully after extended processing',
              metrics: {
                predictTime,
                cost
              }
            });
          } catch (costError) {
            logger.error(`Error processing costs for task ${taskId} after extended polling:`, costError);
            
            // 即使费用处理失败，也继续返回成功生成的音频
            sseService.sendTaskUpdate(taskId, 'succeeded', { 
              predictionId,
              output: prediction.output,
              message: 'Audio generation completed successfully after extended processing, but cost processing failed',
              error: costError.message
            });
          }
          
          // 下载生成的音频文件
          const audioUrl = prediction.output;
          const audioBuffer = await this.downloadAudio(audioUrl, taskId);
          return audioBuffer;
        } else if (prediction.status === 'failed') {
          const errorMsg = prediction.error || 'Prediction failed without specific error after extended polling';
          logger.error(`Prediction ${predictionId} failed for task ${taskId} after extended polling: ${errorMsg}`);
          
          // 发送状态更新：失败
          sseService.sendTaskUpdate(taskId, 'failed', { 
            predictionId,
            error: errorMsg,
            message: 'Audio generation failed after extended processing'
          });
          
          throw new Error(`Prediction failed: ${errorMsg}`);
        } else {
          extendedAttempt++;
          if (extendedAttempt % 10 === 0) { // 每 20 秒更新一次客户端状态
            sseService.sendTaskUpdate(taskId, 'extended_processing', { 
              predictionId,
              status: prediction.status,
              extendedTime: true,
              elapsedSeconds: (extendedAttempt * pollingInterval) / 1000,
              message: `Still processing after ${Math.round((extendedAttempt * pollingInterval) / 1000)} seconds`
            });
          }
          
          logger.debug(`Extended polling for task ${taskId}: Status ${prediction.status}, attempt ${extendedAttempt}`);
          await sleep(pollingInterval);
        }
      } catch (error) {
        logger.warn(`Error during extended polling for task ${taskId}, will retry:`, error.message);
        await sleep(pollingInterval);
      }
    }
  }

  // 获取预测任务的详细信息
  async getPredictionDetails(predictionId) {
    try {
      const response = await replicateAxios.get(
        `${this.apiUrl}/${predictionId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      logger.error(`Error getting prediction details for ${predictionId}:`, error);
      throw error;
    }
  }

  // 扣除用户余额
  async deductCredits(email, amount, predictionId, taskId) {
    try {
      logger.info(`Deducting ${amount} credits from user ${email} for task ${taskId}`);
      
      const response = await this.licenseAxios.post(
        `${this.licenseBaseUrl}/api/v1/license/deduct`,
        {
          email: email,
          amount: amount
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Admin-Token': config.license.adminToken // 添加管理员令牌
          }
        }
      );
      
      if (response.status === 200 && response.data.success) {
        logger.info(`Successfully deducted ${amount} credits from ${email}, new balance: ${response.data.newBalance}`);
        return {
          success: true,
          newBalance: response.data.newBalance
        };
      } else {
        logger.warn(`Unexpected response deducting credits from ${email}:`, response.data);
        throw new Error(response.data?.message || 'Unexpected response from license server');
      }
    } catch (error) {
      logger.error(`Error deducting credits for ${email}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // 优化下载音频函数
  async downloadAudio(audioUrl, taskId) {
    try {
      // 发送状态更新：正在下载
      sseService.sendTaskUpdate(taskId, 'downloading', { 
        audioUrl,
        message: 'Downloading generated audio file'
      });
      
      // 使用流处理大文件下载
      const response = await replicateAxios({
        method: 'get',
        url: audioUrl,
        responseType: 'arraybuffer',
        // 下载大文件使用的特殊设置
        timeout: 60000, // 60秒超时
        maxContentLength: 100 * 1024 * 1024, // 支持最大 100MB 的文件
        maxBodyLength: 100 * 1024 * 1024
      });
      
      // 发送状态更新：下载完成
      sseService.sendTaskUpdate(taskId, 'download_complete', { 
        audioUrl,
        size: response.data.byteLength,
        message: 'Audio file downloaded successfully'
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Error downloading audio for task ${taskId}:`, error);
      
      // 发送状态更新：下载失败
      sseService.sendTaskUpdate(taskId, 'download_failed', { 
        audioUrl,
        error: error.message || 'Unknown download error',
        message: 'Failed to download the generated audio'
      });
      
      throw new Error('Failed to download generated audio');
    }
  }
  
  _createRequestKey(sourceAudioUrl, sourceTranscript, ttsText, instruction, task) {
    return `${sourceAudioUrl}|${sourceTranscript}|${ttsText}|${instruction || ''}|${task || ''}`;
  }
  
  // 手动触发重试
  async retryTask(taskId, payload, userEmail) {
    try {
      logger.info(`Manual retry requested for task: ${taskId}`);
      
      // 发送状态更新：手动重试中
      sseService.sendTaskUpdate(taskId, 'manual_retry', { 
        message: 'Manual retry initiated'
      });
      
      // 创建重试任务
      const retryTask = {
        taskId,
        payload,
        retryCount: 0,
        createdAt: Date.now(),
        manualRetry: true,
        userEmail // 添加用户邮箱以便重试时使用
      };
      
      // 添加到重试队列，立即执行（delay=0）
      await rabbitmqService.addToRetryQueue(retryTask, 0, 0);
      
      return { 
        success: true, 
        message: 'Task added to retry queue',
        taskId
      };
    } catch (error) {
      logger.error(`Error initiating manual retry for task ${taskId}:`, error);
      throw error;
    }
  }
}

module.exports = new ReplicateService();
