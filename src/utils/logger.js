import winston from 'winston';
import { db } from '../firebase/firebase.js';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'burnout-bot' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Audit log function
const auditLog = async (userId, action, details = {}, request = null) => {
  try {
    const logEntry = {
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: request?.ip || 'N/A',
      userAgent: request?.headers?.['user-agent'] || 'N/A'
    };
    
    // Store in database
    await db.collection('audit_logs').add(logEntry);
    
    // Also log to Winston
    logger.info('Audit log entry', { auditLog: logEntry });
    
    return true;
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    return false;
  }
};

export { logger, auditLog }; 