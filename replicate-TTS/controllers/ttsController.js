const fs = require('fs');
const path = require('path');
const replicateService = require('../services/replicateService');
const minioService = require('../services/minioService');
const sseService = require('../services/sseService');
const config = require('../config');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

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
    
    // 存储任务信息
    this.taskStore = new Map();
  }
  
  // SSE 状态更新处理
  async handleSSE(req, res) {
    try {
      // 添加客户端连接
      const clientId = sseService.addClient(req, res);
      
      // 如果请求中包含任务 ID，将客户端订阅到该任务
      const taskId = req.query.taskId;
      if (taskId) {
        sseService.subscribeClientToTask(clientId, taskId);
        
        // 如果任务信息存在，立即发送当前状态
        const taskInfo = this.taskStore.get(taskId);
        if (taskInfo) {
          sseService.sendEvent(clientId, 'task_update', {
            taskId,
            status: taskInfo.status,
            ...taskInfo.data,
            message: 'Current task status',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      logger.error('Error handling SSE connection:', error);
      res.status(500).end();
    }
  }
  
  // 处理重试请求
  async retryGenerateAudio(req, res) {
    try {
      const { taskId, templateId, tts_text, instruction, task } = req.body;
      
      if (!taskId || !templateId || !tts_text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: taskId, templateId and tts_text'
        });
      }
      
      // 加载模板数据
      const templateData = await this.loadTemplateData(templateId);
      
      // 准备 payload
      const payload = {
        version: "669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d",
        input: {
          source_audio: templateData.sourceAudioUrl,
          source_transcript: templateData.sourceTranscript,
          tts_text: tts_text,
          task: task || "zero-shot voice clone"
        }
      };
      
      // 添加指令参数（如果提供）
      if (instruction) {
        payload.input.instruction = instruction;
      }
      
      // 调用 replicateService 的 retryTask 方法
      const result = await replicateService.retryTask(taskId, payload);
      
      // 返回响应
      res.status(200).json({
        success: true,
        data: {
          taskId,
          message: 'Retry initiated successfully'
        }
      });
    } catch (error) {
      logger.error('Error retrying audio generation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retry audio generation'
      });
    }
  }
  
  async generateAudio(req, res) {
    const startTime = Date.now();
    // 生成唯一的任务ID
    const taskId = uuidv4();
    
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
      
      // 获取客户端ID以便推送状态更新
      // 如果请求中包含客户端ID，使用它；否则保持为null
      const clientId = req.headers['x-client-id'] || null;
      
      // 检查此请求是否已在缓存中
      const cachedResult = this.requestCache.get(cacheKey);
      if (cachedResult) {
        logger.info(`Cache hit for request: ${cacheKey.substring(0, 30)}... (${Date.now() - startTime}ms)`);
        
        // 如果有客户端ID，发送缓存命中状态
        if (clientId) {
          sseService.sendEvent(clientId, 'task_update', {
            taskId,
            status: 'cache_hit',
            audioUrl: cachedResult.audioUrl,
            message: 'Audio was found in cache',
            timestamp: new Date().toISOString()
          });
        }
        
        return res.status(200).json({
          success: true,
          data: {
            audio_url: cachedResult.audioUrl,
            cached: true,
            taskId // 返回任务ID给前端
          }
        });
      }
      
      // 如果已达到最大并发请求数，将请求添加到队列
      if (this.activeRequests >= this.maxConcurrentRequests) {
        logger.info(`Max concurrent requests reached (${this.activeRequests}). Queuing request.`);
        
        // 如果有客户端ID，发送队列状态
        if (clientId) {
          sseService.sendEvent(clientId, 'task_update', {
            taskId,
            status: 'queued',
            message: 'Request is queued due to high load',
            queuePosition: this.requestQueue.length + 1,
            timestamp: new Date().toISOString()
          });
        }
        
        // 创建一个延迟队列处理系统
        try {
          await new Promise((resolve, reject) => {
            const queueItem = { 
              resolve, 
              reject, 
              request: { templateId, tts_text, instruction, task },
              taskId,
              clientId
            };
            this.requestQueue.push(queueItem);
            
            // 设置队列超时，避免请求无限期等待
            setTimeout(() => {
              const index = this.requestQueue.indexOf(queueItem);
              if (index !== -1) {
                this.requestQueue.splice(index, 1);
                
                // 如果有客户端ID，发送队列超时状态
                if (clientId) {
                  sseService.sendEvent(clientId, 'task_update', {
                    taskId,
                    status: 'queue_timeout',
                    message: 'Request timed out while waiting in queue',
                    timestamp: new Date().toISOString()
                  });
                }
                
                reject(new Error('Request timeout while waiting in queue'));
              }
            }, 60000); // 1分钟队列等待超时
          });
        } catch (queueError) {
          return res.status(503).json({
            success: false,
            error: queueError.message || 'Service temporarily unavailable. Too many requests in queue.',
            taskId // 仍然返回任务ID，前端可以用它来查询状态
          });
        }
      }
      
      // 增加活动请求计数
      this.activeRequests++;
      
      // 在请求缓存中标记此请求为处理中
      this.requestCache.set(cacheKey, { inProgress: true }, 300); // 5分钟TTL
      
      // 存储任务信息
      this.taskStore.set(taskId, {
        status: 'started',
        data: {
          templateId,
          ttsText: tts_text,
          instruction,
          task,
          createdAt: new Date().toISOString()
        }
      });
      
      // 发送初始响应，包含任务ID，让前端可以立即开始轮询状态
      res.status(202).json({
        success: true,
        data: {
          taskId,
          message: 'Audio generation started',
          status: 'started'
        }
      });
      
      try {
        // 1. 加载模板数据
        const templateData = await this.loadTemplateData(templateId);
        
        // 更新任务状态
        this.taskStore.set(taskId, {
          status: 'template_loaded',
          data: {
            templateId,
            ttsText: tts_text,
            instruction,
            task,
            createdAt: this.taskStore.get(taskId).data.createdAt
          }
        });
        
        // 2. 调用 Replicate API 生成音频
        const audioBuffer = await replicateService.generateAudio(
          templateData.sourceAudioUrl,
          templateData.sourceTranscript,
          tts_text,
          instruction, 
          task,
          clientId, // 传递客户端ID以便订阅状态更新
          taskId    // 传递任务ID以便跟踪任务
        );
        
        // 3. 保存音频到 MinIO
        const audioUrl = await minioService.uploadAudio(audioBuffer);
        
        // 更新缓存
        this.requestCache.set(cacheKey, { audioUrl });
        
        // 更新任务状态
        this.taskStore.set(taskId, {
          status: 'completed',
          data: {
            templateId,
            ttsText: tts_text,
            instruction,
            task,
            audioUrl,
            createdAt: this.taskStore.get(taskId).data.createdAt,
            completedAt: new Date().toISOString()
          }
        });
        
      } catch (error) {
        logger.error(`Error generating audio for task ${taskId}:`, error);
        
        // 更新任务状态为失败
        this.taskStore.set(taskId, {
          status: 'failed',
          data: {
            templateId,
            ttsText: tts_text,
            instruction,
            task,
            error: error.message || 'Unknown error',
            createdAt: this.taskStore.get(taskId).data.createdAt,
            failedAt: new Date().toISOString()
          }
        });
      } finally {
        // 减少活动请求计数
        this.activeRequests--;
        
        // 处理队列中的下一个请求（即使当前请求失败）
        this._processNextQueuedRequest();
      }
    } catch (error) {
      logger.error(`Error in generateAudio for task ${taskId}:`, error);
      
      // 确保在错误时也返回任务ID
      return res.status(500).json({
        success: false,
        error: error.message || 'An unexpected error occurred',
        taskId
      });
    }
  }
  
  // 获取任务状态
  async getTaskStatus(req, res) {
    try {
      const { taskId } = req.params;
      
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: taskId'
        });
      }
      
      // 从任务存储中获取状态
      const taskInfo = this.taskStore.get(taskId);
      
      if (!taskInfo) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }
      
      // 返回任务状态
      return res.status(200).json({
        success: true,
        data: {
          taskId,
          status: taskInfo.status,
          ...taskInfo.data
        }
      });
    } catch (error) {
      logger.error('Error getting task status:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get task status'
      });
    }
  }
  
  // 处理队列中的下一个请求
  async _processNextQueuedRequest() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        logger.info('Processing next request from queue');
        
        // 如果有客户端ID，发送出队状态
        if (nextRequest.clientId) {
          sseService.sendEvent(nextRequest.clientId, 'task_update', {
            taskId: nextRequest.taskId,
            status: 'dequeued',
            message: 'Request dequeued and now processing',
            timestamp: new Date().toISOString()
          });
        }
        
        try {
          nextRequest.resolve();
        } catch (error) {
          logger.error('Error processing queued request:', error);
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
      
      logger.info(`Template data loaded: Audio URL: ${sourceAudioUrl}`);
      logger.debug(`Template transcript: ${sourceTranscript}`);
      
      return {
        sourceAudioUrl,
        sourceTranscript
      };
    } catch (error) {
      logger.error('Error loading template data:', error);
      throw new Error(`Failed to load template data: ${error.message}`);
    }
  }
}

module.exports = new TTSController();
