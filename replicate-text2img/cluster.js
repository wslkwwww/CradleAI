const cluster = require('cluster');
const os = require('os');
const config = require('./config');
const logger = require('./utils/logger');

// Determine how many workers to spawn
const numCPUs = os.cpus().length;
const numWorkers = process.env.WORKERS || numCPUs;

/**
 * Start the cluster master process
 */
function startMaster() {
  logger.info(`Master process ${process.pid} is running`);
  logger.info(`Starting ${numWorkers} workers...`);
  
  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  // Handle worker events
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker...');
    cluster.fork();
  });
  
  // Log worker online events
  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });
}

/**
 * Start a worker process
 */
function startWorker() {
  logger.info(`Worker ${process.pid} started`);
  require('./server');
}

// Start appropriate process based on role
if (cluster.isMaster) {
  startMaster();
} else {
  startWorker();
}
