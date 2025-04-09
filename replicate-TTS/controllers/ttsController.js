const fs = require('fs');
const path = require('path');
const axios = require('axios');
const replicateService = require('../services/replicateService');
const minioService = require('../services/minioService');
const sseService = require('../services/sseService');
const config = require('../config');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class TTSController {
  constructor() {
    this.requestCache = new NodeCache({ 
      stdTTL: 300, 
      checkperiod: 60, 
      maxKeys: 1000 
    });
    
    this.maxConcurrentRequests = process.env.MAX_CONCURRENT_TTS || 20;
    this.activeRequests = 0;
    this.requestQueue = [];
    this.taskStore = new Map();

    this.licenseBaseUrl = process.env.LICENSE_API_URL || 'https://license.cradleintro.top';
    this.creditPerSecond = 0.01;
    this.minRequiredBalance = 1.0;
  }
  
  async checkUserBalance(email) {
    if (!email) {
      throw new Error('Missing user email for balance check');
    }
    
    try {
      logger.info(`Checking balance for user: ${email}`);
      
      const response = await axios.get(
        `${this.licenseBaseUrl}/api/v1/license/balance/${encodeURIComponent(email)}`,
        {
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.status === 200 && response.data) {
        logger.info(`User ${email} balance: ${response.data.credits}`);
        return {
          success: true,
          balance: response.data.credits,
          sufficient: response.data.credits >= this.minRequiredBalance
        };
      } else {
        logger.warn(`Unexpected response checking balance for ${email}:`, response.data);
        return {
          success: false,
          balance: 0,
          sufficient: false,
          error: 'Unexpected response from license server'
        };
      }
    } catch (error) {
      logger.error(`Error checking balance for ${email}:`, error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        return {
          success: false,
          balance: 0,
          sufficient: false,
          error: 'User not found in license system'
        };
      }
      
      return {
        success: false,
        balance: 0,
        sufficient: false,
        error: error.response?.data?.message || error.message || 'Failed to check balance'
      };
    }
  }
  
  async deductCredits(email, amount) {
    if (!email || !amount) {
      throw new Error('Missing email or amount for credit deduction');
    }
    
    try {
      logger.info(`Deducting ${amount} credits from user: ${email}`);
      
      const response = await axios.post(
        `${this.licenseBaseUrl}/api/v1/license/deduct`,
        {
          email: email,
          amount: amount
        },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Admin-Token': config.license.adminToken // 添加管理员令牌
          }
        }
      );
      
      if (response.status === 200 && response.data.success) {
        logger.info(`Successfully deducted ${amount} credits from ${email}. New balance: ${response.data.newBalance}`);
        return {
          success: true,
          newBalance: response.data.newBalance
        };
      } else {
        logger.warn(`Unexpected response deducting credits from ${email}:`, response.data);
        return {
          success: false,
          error: response.data?.message || 'Unexpected response from license server'
        };
      }
    } catch (error) {
      logger.error(`Error deducting credits for ${email}:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to deduct credits'
      };
    }
  }
  
  async handleSSE(req, res) {
    try {
      const clientId = sseService.addClient(req, res);
      const taskId = req.query.taskId;
      if (taskId) {
        sseService.subscribeClientToTask(clientId, taskId);
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
  
  async retryGenerateAudio(req, res) {
    try {
      const { taskId, templateId, tts_text, instruction, task, email } = req.body;
      
      if (!taskId || !templateId || !tts_text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: taskId, templateId and tts_text'
        });
      }
      
      if (email) {
        const balanceCheck = await this.checkUserBalance(email);
        
        if (!balanceCheck.success || !balanceCheck.sufficient) {
          return res.status(402).json({
            success: false,
            error: balanceCheck.error || `Insufficient balance. Minimum required: ${this.minRequiredBalance} credits`,
            balance: balanceCheck.balance || 0
          });
        }
      }
      
      const templateData = await this.loadTemplateData(templateId);
      
      const payload = {
        version: "669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d",
        input: {
          source_audio: templateData.sourceAudioUrl,
          source_transcript: templateData.sourceTranscript,
          tts_text: tts_text,
          task: task || "zero-shot voice clone"
        }
      };
      
      if (instruction) {
        payload.input.instruction = instruction;
      }
      
      const result = await replicateService.retryTask(taskId, payload);
      
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
    const taskId = uuidv4();
    
    try {
      const { templateId, tts_text, instruction, task, email } = req.body;
      
      if (!templateId || !tts_text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: templateId and tts_text'
        });
      }
      
      const userEmail = email || req.headers['x-user-email'];
      
      if (userEmail) {
        logger.info(`Checking balance for user email: ${userEmail}`);
        const balanceCheck = await this.checkUserBalance(userEmail);
        
        if (!balanceCheck.success) {
          logger.warn(`Balance check failed for ${userEmail}: ${balanceCheck.error}`);
          if (balanceCheck.error?.includes('not found')) {
            return res.status(400).json({
              success: false,
              error: `User not found in license system: ${userEmail}`,
              taskId
            });
          }
        } else if (!balanceCheck.sufficient) {
          logger.warn(`Insufficient balance for ${userEmail}: ${balanceCheck.balance}`);
          return res.status(402).json({
            success: false,
            error: `Insufficient balance. You have ${balanceCheck.balance} credits, but ${this.minRequiredBalance} credits are required for this operation.`,
            balance: balanceCheck.balance,
            taskId
          });
        }
        
        logger.info(`User ${userEmail} has sufficient balance: ${balanceCheck.balance}`);
      } else {
        logger.info('No user email provided, skipping balance check');
      }
      
      const cacheKey = this._createCacheKey({ templateId, tts_text, instruction, task });
      const clientId = req.headers['x-client-id'] || null;
      
      const cachedResult = this.requestCache.get(cacheKey);
      if (cachedResult) {
        logger.info(`Cache hit for request: ${cacheKey.substring(0, 30)}... (${Date.now() - startTime}ms)`);
        
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
            taskId
          }
        });
      }
      
      if (this.activeRequests >= this.maxConcurrentRequests) {
        logger.info(`Max concurrent requests reached (${this.activeRequests}). Queuing request.`);
        
        if (clientId) {
          sseService.sendEvent(clientId, 'task_update', {
            taskId,
            status: 'queued',
            message: 'Request is queued due to high load',
            queuePosition: this.requestQueue.length + 1,
            timestamp: new Date().toISOString()
          });
        }
        
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
            
            setTimeout(() => {
              const index = this.requestQueue.indexOf(queueItem);
              if (index !== -1) {
                this.requestQueue.splice(index, 1);
                
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
            }, 60000);
          });
        } catch (queueError) {
          return res.status(503).json({
            success: false,
            error: queueError.message || 'Service temporarily unavailable. Too many requests in queue.',
            taskId
          });
        }
      }
      
      this.activeRequests++;
      this.requestCache.set(cacheKey, { inProgress: true }, 300);
      
      this.taskStore.set(taskId, {
        status: 'started',
        data: {
          templateId,
          ttsText: tts_text,
          instruction,
          task,
          email: userEmail,
          createdAt: new Date().toISOString()
        }
      });
      
      res.status(202).json({
        success: true,
        data: {
          taskId,
          message: 'Audio generation started',
          status: 'started'
        }
      });
      
      try {
        const templateData = await this.loadTemplateData(templateId);
        
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
        
        const audioBuffer = await replicateService.generateAudio(
          templateData.sourceAudioUrl,
          templateData.sourceTranscript,
          tts_text,
          instruction, 
          task,
          clientId,
          taskId,
          userEmail
        );
        
        const audioUrl = await minioService.uploadAudio(audioBuffer);
        
        this.requestCache.set(cacheKey, { audioUrl });
        
        this.taskStore.set(taskId, {
          status: 'completed',
          data: {
            templateId,
            ttsText: tts_text,
            instruction,
            task,
            audioUrl,
            email: userEmail,
            createdAt: this.taskStore.get(taskId).data.createdAt,
            completedAt: new Date().toISOString()
          }
        });
        
      } catch (error) {
        logger.error(`Error generating audio for task ${taskId}:`, error);
        
        this.taskStore.set(taskId, {
          status: 'failed',
          data: {
            templateId,
            ttsText: tts_text,
            instruction,
            task,
            email: userEmail,
            error: error.message || 'Unknown error',
            createdAt: this.taskStore.get(taskId).data.createdAt,
            failedAt: new Date().toISOString()
          }
        });
      } finally {
        this.activeRequests--;
        this._processNextQueuedRequest();
      }
    } catch (error) {
      logger.error(`Error in generateAudio for task ${taskId}:`, error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'An unexpected error occurred',
        taskId
      });
    }
  }
  
  async getTaskStatus(req, res) {
    try {
      const { taskId } = req.params;
      
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: taskId'
        });
      }
      
      const taskInfo = this.taskStore.get(taskId);
      
      if (!taskInfo) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }
      
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
  
  async _processNextQueuedRequest() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        logger.info('Processing next request from queue');
        
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
  
  _createCacheKey(params) {
    return `${params.templateId}|${params.tts_text}|${params.instruction || ''}|${params.task || ''}`;
  }
  
  async loadTemplateData(templateId) {
    try {
      const sourceAudioUrl = minioService.getSourceAudioUrl(templateId);
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
