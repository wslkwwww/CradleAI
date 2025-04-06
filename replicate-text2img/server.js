const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const sseService = require('./services/sseService');
const rabbitmqService = require('./services/rabbitmqService');
const generateRouter = require('./routes/generate');
const workerService = require('./services/workerService');

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// SSE events endpoint
app.get('/events', sseService.eventsHandler);

// API routes
app.use('/api/generate', generateRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// System info endpoint
app.get('/system', (req, res) => {
  res.status(200).json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpus: require('os').cpus().length
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Initialize services and start the server
async function startServer() {
  try {
    // Connect to RabbitMQ
    await rabbitmqService.connect();
    logger.info('Connected to RabbitMQ');
    
    // Initialize worker to process tasks
    await workerService.initialize();
    logger.info('Worker service initialized');

    // Start the server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  try {
    await rabbitmqService.disconnect();
    logger.info('Disconnected from RabbitMQ');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});
