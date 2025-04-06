const rabbitmqService = require('./rabbitmqService');
const replicateService = require('./replicateService');
const taskService = require('./taskService');
const config = require('../config');
const logger = require('../utils/logger');

class WorkerService {
  /**
   * Initialize the worker service
   */
  async initialize() {
    try {
      // Register consumer for the generation queue
      await rabbitmqService.consume(
        config.rabbitmq.queues.generation,
        this.processGenerationTask.bind(this)
      );
      
      logger.info('Worker service initialized');
    } catch (error) {
      logger.error('Failed to initialize worker service:', error);
      throw error;
    }
  }

  /**
   * Process a generation task from the queue
   * @param {Object} task - The task to process
   */
  async processGenerationTask(task) {
    const { taskId } = task;
    logger.info(`Processing generation task: ${taskId}`);
    
    try {
      // Update task status to processing
      taskService.updateTask(taskId, 'processing');
      
      // Create input object for Replicate API
      const input = {
        prompt: task.prompt,
        negative_prompt: task.negative_prompt || "nsfw, naked",
        steps: task.steps || 28,
        width: task.width || 1024,
        height: task.height || 1024,
        batch_size: task.batch_size || 1,
        model: "Animagine-XL-4.0",
        vae: "default",
        scheduler: "Euler a",
        prepend_preprompt: true,
        cfg_scale: 5,
        pag_scale: 3,
        guidance_rescale: 0.5,
        clip_skip: 1,
        seed: task.seed || -1, // Random seed
      };
      
      // Create prediction
      taskService.updateTask(taskId, 'prediction_creating');
      let prediction;
      
      try {
        prediction = await replicateService.createPrediction(input);
        
        if (!prediction || !prediction.id) {
          throw new Error('Invalid prediction response: missing ID');
        }
        
        logger.info(`Created prediction with ID: ${prediction.id} for task: ${taskId}`);
      } catch (predictionError) {
        logger.error(`Failed to create prediction for task ${taskId}:`, predictionError);
        throw new Error(`Failed to create prediction: ${predictionError.message}`);
      }
      
      // Store prediction ID with task
      taskService.updateTask(taskId, 'prediction_created', { 
        predictionId: prediction.id 
      });
      
      // Wait for prediction to complete
      taskService.updateTask(taskId, 'waiting_for_prediction');
      
      // Use a more robust polling mechanism
      let completedPrediction;
      try {
        completedPrediction = await replicateService.waitForPrediction(
          prediction.id, 
          60,  // 60 attempts
          2000 // 2 seconds between attempts
        );
      } catch (pollingError) {
        logger.error(`Error polling prediction for task ${taskId}:`, pollingError);
        throw new Error(`Error polling prediction: ${pollingError.message}`);
      }
      
      // Check prediction output
      if (!completedPrediction.output) {
        throw new Error('Prediction completed but no output was returned');
      }
      
      if (!Array.isArray(completedPrediction.output)) {
        logger.warn(`Prediction output is not an array for task ${taskId}. Converting single item to array.`);
        completedPrediction.output = [completedPrediction.output];
      }
      
      // Update task with URLs
      taskService.updateTask(taskId, 'succeeded', { 
        urls: completedPrediction.output
      });
      
      logger.info(`Task ${taskId} completed successfully`);
    } catch (error) {
      logger.error(`Error processing task ${taskId}:`, error);
      
      // Update task with error
      taskService.updateTask(taskId, 'failed', { 
        error: error.message 
      });
      
      // Schedule for retry if appropriate
      const currentTask = taskService.getTask(taskId);
      
      if (currentTask && (!currentTask.retryCount || currentTask.retryCount < config.retry.maxRetries)) {
        const retryCount = (currentTask.retryCount || 0) + 1;
        taskService.updateTask(taskId, 'retrying', {
          retryCount: retryCount
        });
        
        await rabbitmqService.scheduleRetry(
          task,
          currentTask.retryCount || 0
        );
      }
      
      throw error;
    }
  }
}

module.exports = new WorkerService();
