const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${stack ? '\n' + stack : ''}`;
  })
);

// 创建 Winston logger 实例
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'replicate-tts' },
  transports: [
    // 记录所有级别日志到控制台
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // 记录所有日志到综合日志文件
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // 只记录错误日志到错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// 为重要的业务逻辑添加特定日志处理器
logger.taskLogger = function(taskId) {
  return {
    info: (message, meta = {}) => {
      logger.info(`[Task: ${taskId}] ${message}`, meta);
    },
    warn: (message, meta = {}) => {
      logger.warn(`[Task: ${taskId}] ${message}`, meta);
    },
    error: (message, error, meta = {}) => {
      logger.error(`[Task: ${taskId}] ${message}`, { ...meta, error });
    },
    debug: (message, meta = {}) => {
      logger.debug(`[Task: ${taskId}] ${message}`, meta);
    }
  };
};

module.exports = logger;
