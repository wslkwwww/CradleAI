const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

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
  }

  async generateAudio(sourceAudioUrl, sourceTranscript, ttsText, instruction, task) {
    try {
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

      // 创建此请求的 Promise 并存储在活动请求中
      const requestPromise = this._executeReplicateRequestWithQueue(payload, requestKey);
      this.activeRequests.set(requestKey, requestPromise);
      
      // 完成后从活动请求中移除
      requestPromise.finally(() => {
        this.activeRequests.delete(requestKey);
      });
      
      return requestPromise;
    } catch (error) {
      console.error('Error calling Replicate API:', error.response?.data || error.message);
      throw new Error('Failed to generate audio via Replicate API');
    }
  }
  
  // 执行 Replicate 请求，带队列系统
  async _executeReplicateRequestWithQueue(payload, requestKey) {
    // 如果已达到 Replicate API 并发限制，则排队等待
    if (this.currentReplicate >= this.maxConcurrentReplicate) {
      await new Promise((resolve) => {
        this.replicateQueue.push(resolve);
      });
    }
    
    this.currentReplicate++;
    
    try {
      return await this._executeReplicateRequestWithRetry(payload, requestKey);
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
  async _executeReplicateRequestWithRetry(payload, requestKey, retryCount = 0) {
    try {
      return await this._executeReplicateRequest(payload, requestKey);
    } catch (error) {
      // 检查是否应该重试
      if (retryCount < MAX_RETRIES && this._isRetryableError(error)) {
        console.log(`Retrying Replicate request (${retryCount + 1}/${MAX_RETRIES}) after error: ${error.message}`);
        await sleep(RETRY_DELAY * Math.pow(2, retryCount)); // 指数退避策略
        return this._executeReplicateRequestWithRetry(payload, requestKey, retryCount + 1);
      }
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
  async _executeReplicateRequest(payload, requestKey) {
    console.log(`Executing Replicate request for: ${requestKey.substring(0, 30)}...`);
    
    // 发送请求创建预测任务
    const response = await replicateAxios.post(this.apiUrl, payload, { headers: this.headers });
    
    // 获取预测任务 ID
    const predictionId = response.data.id;
    console.log(`Prediction created with ID: ${predictionId}`);
    
    // 轮询获取预测结果
    return await this.pollPredictionResult(predictionId);
  }

  async pollPredictionResult(predictionId) {
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
          console.log('Prediction succeeded:', prediction.output);
          
          // 下载生成的音频文件
          const audioUrl = prediction.output;
          const audioBuffer = await this.downloadAudio(audioUrl);
          return audioBuffer;
        } else if (prediction.status === 'failed') {
          throw new Error(`Prediction failed: ${prediction.error}`);
        } else {
          console.log(`Prediction status: ${prediction.status}. Waiting... (Attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
      } catch (error) {
        // Only throw an error if the API call itself failed
        // We don't want to exit polling just because of a temporary network issue
        console.error('Error during polling, will retry:', error.message);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }
    
    // Even after maximum attempts, don't throw error if the task is still running
    // Instead, provide a message but continue polling
    console.log(`Maximum initial polling attempts (${maxAttempts}) reached, but task may still be processing.`);
    console.log(`Continuing to poll until task completes or fails...`);
    
    // Continue polling indefinitely until the task succeeds or fails
    while (true) {
      try {
        const response = await replicateAxios.get(
          `${this.apiUrl}/${predictionId}`,
          { headers: this.headers }
        );
        
        const prediction = response.data;
        
        if (prediction.status === 'succeeded') {
          console.log('Prediction finally succeeded:', prediction.output);
          
          // 下载生成的音频文件
          const audioUrl = prediction.output;
          const audioBuffer = await this.downloadAudio(audioUrl);
          return audioBuffer;
        } else if (prediction.status === 'failed') {
          throw new Error(`Prediction failed: ${prediction.error}`);
        } else {
          console.log(`Extended polling - Prediction status: ${prediction.status}. Continuing to wait...`);
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
      } catch (error) {
        console.error('Error during extended polling, will retry:', error.message);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }
  }

  // 优化下载音频函数
  async downloadAudio(audioUrl) {
    try {
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
      
      return response.data;
    } catch (error) {
      console.error('Error downloading audio:', error);
      throw new Error('Failed to download generated audio');
    }
  }
  
  _createRequestKey(sourceAudioUrl, sourceTranscript, ttsText, instruction, task) {
    return `${sourceAudioUrl}|${sourceTranscript}|${ttsText}|${instruction || ''}|${task || ''}`;
  }
}

module.exports = new ReplicateService();
