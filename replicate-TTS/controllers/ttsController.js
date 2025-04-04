const fs = require('fs');
const path = require('path');
const replicateService = require('../services/replicateService');
const minioService = require('../services/minioService');
const config = require('../config');
const NodeCache = require('node-cache');

class TTSController {
  constructor() {
    // 使用 NodeCache 替换简单的 Map 缓存 - 更好的内存管理和过期策略
    this.requestCache = new NodeCache({ 
      stdTTL: 300, // 5分钟过期
      checkperiod: 60, // 每分钟检查过期项
      maxKeys: 1000 // 限制最大缓存项数量，防止内存泄漏
    });
    
    // 限制并发处理的请求数量
    this.maxConcurrentRequests = process.env.MAX_CONCURRENT_TTS || 20;
    this.activeRequests = 0;
    this.requestQueue = [];
  }
  
  async generateAudio(req, res) {
    const startTime = Date.now();
    try {
      const { templateId, tts_text, instruction, task } = req.body;
      
      if (!templateId || !tts_text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: templateId and tts_text'
        });
      }
      
      // 创建请求的缓存键
      const cacheKey = this._createCacheKey({ templateId, tts_text, instruction, task });
      
      // 检查此请求是否已在缓存中
      const cachedResult = this.requestCache.get(cacheKey);
      if (cachedResult) {
        console.log(`Cache hit for request: ${cacheKey.substring(0, 30)}... (${Date.now() - startTime}ms)`);
        
        return res.status(200).json({
          success: true,
          data: {
            audio_url: cachedResult.audioUrl,
            cached: true
          }
        });
      }
      
      // 如果已达到最大并发请求数，将请求添加到队列
      if (this.activeRequests >= this.maxConcurrentRequests) {
        console.log(`Max concurrent requests reached (${this.activeRequests}). Queuing request.`);
        
        // 创建一个延迟队列处理系统
        try {
          await new Promise((resolve, reject) => {
            const queueItem = { resolve, reject, request: { templateId, tts_text, instruction, task } };
            this.requestQueue.push(queueItem);
            
            // 设置队列超时，避免请求无限期等待
            setTimeout(() => {
              const index = this.requestQueue.indexOf(queueItem);
              if (index !== -1) {
                this.requestQueue.splice(index, 1);
                reject(new Error('Request timeout while waiting in queue'));
              }
            }, 60000); // 1分钟队列等待超时
          });
        } catch (queueError) {
          return res.status(503).json({
            success: false,
            error: queueError.message || 'Service temporarily unavailable. Too many requests in queue.'
          });
        }
      }
      
      // 增加活动请求计数
      this.activeRequests++;
      
      // 在请求缓存中标记此请求为处理中
      this.requestCache.set(cacheKey, { inProgress: true }, 300); // 5分钟TTL
      
      // 1. 加载模板数据
      const templateData = await this.loadTemplateData(templateId);
      
      // 2. 调用 Replicate API 生成音频
      const audioBuffer = await replicateService.generateAudio(
        templateData.sourceAudioUrl,
        templateData.sourceTranscript,
        tts_text,
        instruction, 
        task
      );
      
      // 3. 保存音频到 MinIO
      const audioUrl = await minioService.uploadAudio(audioBuffer);
      
      // 更新缓存
      this.requestCache.set(cacheKey, { audioUrl });
      
      // 4. 返回音频 URL 给前端
      res.status(200).json({
        success: true,
        data: {
          audio_url: audioUrl,
          processingTime: Date.now() - startTime
        }
      });
      
      // 处理队列中的下一个请求
      this._processNextQueuedRequest();
      
    } catch (error) {
      console.error('Error generating audio:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate audio'
      });
      
      // 处理队列中的下一个请求（即使当前请求失败）
      this._processNextQueuedRequest();
    } finally {
      // 减少活动请求计数
      this.activeRequests--;
    }
  }
  
  // 处理队列中的下一个请求
  async _processNextQueuedRequest() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        console.log('Processing next request from queue');
        try {
          nextRequest.resolve();
        } catch (error) {
          console.error('Error processing queued request:', error);
        }
      }
    }
  }
  
  // 创建缓存键
  _createCacheKey(params) {
    return `${params.templateId}|${params.tts_text}|${params.instruction || ''}|${params.task || ''}`;
  }
  
  async loadTemplateData(templateId) {
    try {
      // 获取源音频 URL，现在从指定 URL 获取，而不是 MinIO
      const sourceAudioUrl = minioService.getSourceAudioUrl(templateId);
      
      // 获取源文本内容
      const sourceTranscript = await minioService.getTranscriptText(templateId);
      
      console.log(`Template data loaded: Audio URL: ${sourceAudioUrl}`);
      console.log(`Template transcript: ${sourceTranscript}`);
      
      return {
        sourceAudioUrl,
        sourceTranscript
      };
    } catch (error) {
      console.error('Error loading template data:', error);
      throw new Error(`Failed to load template data: ${error.message}`);
    }
  }
}

module.exports = new TTSController();
