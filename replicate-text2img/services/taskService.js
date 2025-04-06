const { v4: uuidv4 } = require('uuid');
const sseService = require('./sseService');
const logger = require('../utils/logger');

class TaskService {
  constructor() {
    // In-memory task store
    // In production, use a database like MongoDB or Redis for persistence
    this.tasks = new Map();
  }

  /**
   * Create a new task
   * @param {Object} params - Task parameters
   * @returns {Object} - Created task object
   */
  createTask(params) {
    const taskId = params.taskId || uuidv4();
    
    const task = {
      taskId,
      prompt: params.prompt,
      negative_prompt: params.negative_prompt,
      width: params.width,
      height: params.height,
      steps: params.steps,
      batch_size: params.batch_size,
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0
    };
    
    this.tasks.set(taskId, task);
    logger.info(`Task created: ${taskId}`);
    
    return task;
  }

  /**
   * Update a task's status and related information
   * @param {string} taskId - Task ID
   * @param {string} status - New status
   * @param {Object} data - Additional data to update
   * @returns {Object} - Updated task object
   */
  updateTask(taskId, status, data = {}) {
    if (!this.tasks.has(taskId)) {
      logger.warn(`Attempted to update non-existent task: ${taskId}`);
      return null;
    }
    
    const task = this.tasks.get(taskId);
    
    const updatedTask = {
      ...task,
      ...data,
      status,
      updatedAt: new Date().toISOString()
    };
    
    // For completed statuses, add completion time
    if (['succeeded', 'failed'].includes(status) && !updatedTask.completedAt) {
      updatedTask.completedAt = new Date().toISOString();
    }
    
    this.tasks.set(taskId, updatedTask);
    
    // Notify via SSE
    sseService.notifyTaskUpdate(taskId, status, this.getSafeTask(updatedTask));
    
    logger.info(`Task ${taskId} updated: ${status}`);
    return updatedTask;
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Object} - Task object or null if not found
   */
  getTask(taskId) {
    if (!this.tasks.has(taskId)) {
      return null;
    }
    
    return this.tasks.get(taskId);
  }

  /**
   * Get a safe version of the task for client consumption
   * @param {Object} task - Task object
   * @returns {Object} - Safe task object
   */
  getSafeTask(task) {
    if (!task) return null;
    
    // Filter out any sensitive or internal fields
    const { 
      taskId, 
      status, 
      prompt, 
      negative_prompt,
      width,
      height,
      urls,
      predictionId,
      createdAt, 
      completedAt,
      error
    } = task;
    
    return {
      taskId,
      status,
      prompt,
      negative_prompt,
      width,
      height,
      urls,
      predictionId,
      createdAt,
      completedAt: completedAt || null,
      error: error || null
    };
  }
}

module.exports = new TaskService();
