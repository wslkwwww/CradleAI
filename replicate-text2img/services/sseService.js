const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

class SSEService {
  constructor() {
    this.clients = new Map();
    this.taskSubscriptions = new Map();
    
    // Heartbeat to keep connections alive
    setInterval(() => {
      this.sendHeartbeat();
    }, config.sse.heartbeatInterval);
    
    // Check for stale connections
    setInterval(() => {
      this.checkStaleConnections();
    }, config.sse.heartbeatInterval);
  }

  // SSE event handler middleware
  eventsHandler(req, res) {
    // SSE setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // Generate client ID and keep track of connection time
    const clientId = uuidv4();
    const taskId = req.query.taskId; // Optional specific task subscription
    
    const newClient = {
      id: clientId,
      res,
      taskId,
      connectedAt: Date.now()
    };
    
    // Store the client
    this.clients.set(clientId, newClient);
    
    // Add to task subscriptions if needed
    if (taskId) {
      if (!this.taskSubscriptions.has(taskId)) {
        this.taskSubscriptions.set(taskId, new Set());
      }
      this.taskSubscriptions.get(taskId).add(clientId);
      logger.info(`Client ${clientId} subscribed to task ${taskId}`);
    }
    
    // Send initial connection event
    this.sendEventToClient(clientId, 'connected', { clientId });
    
    logger.info(`Client ${clientId} connected to SSE`);
    
    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      
      // Remove from task subscriptions
      if (taskId && this.taskSubscriptions.has(taskId)) {
        this.taskSubscriptions.get(taskId).delete(clientId);
        if (this.taskSubscriptions.get(taskId).size === 0) {
          this.taskSubscriptions.delete(taskId);
        }
      }
      
      logger.info(`Client ${clientId} disconnected from SSE`);
    });
  }

  // Send event to all clients
  sendEventToAll(event, data) {
    this.clients.forEach(client => {
      this.sendEventToClient(client.id, event, data);
    });
  }

  // Send event to specific client
  sendEventToClient(clientId, event, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error(`Error sending event to client ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  // Send event to clients subscribed to a specific task
  sendEventToTaskSubscribers(taskId, event, data) {
    if (!this.taskSubscriptions.has(taskId)) return;
    
    this.taskSubscriptions.get(taskId).forEach(clientId => {
      this.sendEventToClient(clientId, event, data);
    });
    
    // Also send to clients who are subscribed to all tasks
    this.clients.forEach(client => {
      if (!client.taskId) {
        this.sendEventToClient(client.id, event, data);
      }
    });
  }

  // Send heartbeat to all clients
  sendHeartbeat() {
    this.clients.forEach(client => {
      try {
        client.res.write(`:heartbeat\n\n`);
      } catch (error) {
        logger.error(`Heartbeat failed for client ${client.id}:`, error);
        this.clients.delete(client.id);
      }
    });
  }

  // Check for stale connections
  checkStaleConnections() {
    const now = Date.now();
    this.clients.forEach(client => {
      if (now - client.connectedAt > config.sse.clientTimeout) {
        logger.warn(`Client ${client.id} connection timed out`);
        try {
          client.res.end();
        } catch (error) {
          logger.error(`Error closing stale connection for client ${client.id}:`, error);
        }
        this.clients.delete(client.id);
      }
    });
  }

  // Notify about task updates
  notifyTaskUpdate(taskId, status, data = {}) {
    const eventData = {
      taskId,
      status,
      ...data
    };
    
    this.sendEventToTaskSubscribers(taskId, 'task_update', eventData);
    logger.debug(`Task ${taskId} status update: ${status}`);
  }
}

const sseService = new SSEService();

// Export the service instance and the eventsHandler middleware
module.exports = {
  notifyTaskUpdate: (taskId, status, data) => sseService.notifyTaskUpdate(taskId, status, data),
  eventsHandler: (req, res) => sseService.eventsHandler(req, res),
  sendEventToAll: (event, data) => sseService.sendEventToAll(event, data)
};
