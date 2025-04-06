const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const validator = require('../middleware/validator');
const taskService = require('../services/taskService');
const rabbitmqService = require('../services/rabbitmqService');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * POST /api/generate
 * Generate images using Replicate API via task queue
 */
router.post('/', validator.validateGenerateRequest, async (req, res, next) => {
  try {
    const {
      prompt,
      negative_prompt = "nsfw, naked",
      steps = 28,
      width = 1024,
      height = 1024,
      batch_size = 1,
    } = req.body;

    // Create a new task
    const taskId = uuidv4();
    const task = taskService.createTask({
      taskId,
      prompt,
      negative_prompt,
      steps,
      width,
      height,
      batch_size,
    });

    // Publish task to RabbitMQ queue
    await rabbitmqService.publish(config.rabbitmq.queues.generation, task);
    
    // Update task status to queued
    taskService.updateTask(taskId, 'queued');

    // Return response with task ID
    res.status(202).json({
      success: true,
      data: {
        taskId,
        message: "Image generation started",
        status: "started"
      }
    });
    
    logger.info(`Task ${taskId} queued for processing`);
  } catch (error) {
    logger.error('Error in generate endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/generate/retry
 * Retry a failed generation task
 */
router.post('/retry', validator.validateRetryRequest, async (req, res, next) => {
  try {
    const { taskId, prompt, negative_prompt, width, height, steps, batch_size } = req.body;
    
    // Check if task exists
    const existingTask = taskService.getTask(taskId);
    
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }
    
    // Create retry task (keeping taskId for tracking)
    const retryTask = taskService.createTask({
      taskId,
      prompt: prompt || existingTask.prompt,
      negative_prompt: negative_prompt || existingTask.negative_prompt,
      width: width || existingTask.width,
      height: height || existingTask.height,
      steps: steps || existingTask.steps,
      batch_size: batch_size || existingTask.batch_size,
      retryCount: existingTask.retryCount || 0
    });
    
    // Publish to queue
    await rabbitmqService.publish(config.rabbitmq.queues.generation, retryTask);
    
    // Update status
    taskService.updateTask(taskId, 'queued', { 
      retryInitiated: true 
    });
    
    res.status(202).json({
      success: true,
      data: {
        taskId,
        message: "Retry initiated successfully"
      }
    });
    
    logger.info(`Task ${taskId} retry initiated`);
  } catch (error) {
    logger.error('Error in retry endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/generate/task/:taskId
 * Get task status and information
 */
router.get('/task/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    const task = taskService.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }
    
    // Return safe task data (no internal fields)
    res.status(200).json({
      success: true,
      data: taskService.getSafeTask(task)
    });
  } catch (error) {
    logger.error('Error in get task endpoint:', error);
    next(error);
  }
});

module.exports = router;
