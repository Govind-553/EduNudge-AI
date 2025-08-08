// server/middleware/logging.js
const winston = require('winston');
const expressWinston = require('express-winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Winston logger configuration
 */
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'edunudge-ai-server',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Access log file for HTTP requests
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ]
};

// Add file transports only in production
if (process.env.NODE_ENV === 'production') {
  // Separate log files for different levels
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'warn.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    }),
    
    new winston.transports.File({
      filename: path.join(logsDir, 'info.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    })
  );
}

// Create the main logger
const logger = winston.createLogger(loggerConfig);

/**
 * Request logging middleware using express-winston
 */
const requestLogger = expressWinston.logger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log')
    })
  ],
  
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  
  // Request metadata to log
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
  
  // Express request metadata
  expressFormat: true,
  colorize: false,
  
  // Skip logging for certain routes
  skip: (req, res) => {
    // Skip health check and static files
    return req.url === '/health' || 
           req.url === '/favicon.ico' ||
           req.url.startsWith('/static/');
  },
  
  // Custom request metadata
  dynamicMeta: (req, res) => {
    return {
      userAgent: req.get('User-Agent'),
      clientIP: getClientIP(req),
      userId: req.user?.id || 'anonymous',
      userRole: req.user?.role || 'none',
      requestId: req.headers['x-request-id'] || generateRequestId(),
      sessionId: req.sessionID || null,
      referer: req.get('Referer') || null,
      contentLength: res.get('content-length') || 0,
      apiVersion: req.headers['api-version'] || 'v1'
    };
  }
});

/**
 * Error logging middleware using express-winston
 */
const errorLogger = expressWinston.errorLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log')
    })
  ],
  
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  
  // Error metadata to log
  meta: true,
  msg: "ERROR {{req.method}} {{req.url}} {{err.message}}",
  
  // Custom error metadata
  dynamicMeta: (req, res, err) => {
    return {
      userAgent: req.get('User-Agent'),
      clientIP: getClientIP(req),
      userId: req.user?.id || 'anonymous',
      userRole: req.user?.role || 'none',
      requestId: req.headers['x-request-id'] || generateRequestId(),
      errorCode: err.code || 'UNKNOWN',
      errorType: err.type || 'UnhandledError',
      requestBody: sanitizeRequestBody(req.body),
      requestParams: req.params,
      requestQuery: req.query
    };
  }
});

/**
 * Custom application logger for business logic
 */
const appLogger = {
  // Student operations
  student: {
    created: (studentId, studentData) => {
      logger.info('Student created', {
        action: 'student_created',
        studentId,
        studentName: studentData.name,
        inquiryType: studentData.inquiryType,
        source: studentData.source
      });
    },
    
    updated: (studentId, updateData, userId) => {
      logger.info('Student updated', {
        action: 'student_updated',
        studentId,
        updatedFields: Object.keys(updateData),
        updatedBy: userId
      });
    },
    
    deleted: (studentId, userId) => {
      logger.warn('Student deleted', {
        action: 'student_deleted',
        studentId,
        deletedBy: userId
      });
    },
    
    riskAssessed: (studentId, riskLevel, riskScore) => {
      logger.info('Student risk assessed', {
        action: 'risk_assessment',
        studentId,
        riskLevel,
        riskScore
      });
    }
  },
  
  // Voice call operations
  call: {
    initiated: (callId, studentId, priority, reason) => {
      logger.info('Voice call initiated', {
        action: 'call_initiated',
        callId,
        studentId,
        priority,
        reason
      });
    },
    
    completed: (callId, duration, status, analysis) => {
      logger.info('Voice call completed', {
        action: 'call_completed',
        callId,
        duration,
        status,
        emotionDetected: analysis?.emotion || 'none',
        needsFollowup: analysis?.needsSupport || false
      });
    },
    
    failed: (callId, error, reason) => {
      logger.error('Voice call failed', {
        action: 'call_failed',
        callId,
        error: error.message,
        reason
      });
    }
  },
  
  // Notification operations
  notification: {
    sent: (type, recipient, studentId, templateType) => {
      logger.info('Notification sent', {
        action: 'notification_sent',
        type,
        recipient: maskSensitiveData(recipient),
        studentId,
        templateType
      });
    },
    
    failed: (type, recipient, error) => {
      logger.error('Notification failed', {
        action: 'notification_failed',
        type,
        recipient: maskSensitiveData(recipient),
        error: error.message
      });
    }
  },
  
  // AI operations
  ai: {
    emotionAnalyzed: (studentId, callId, emotion, confidence) => {
      logger.info('Emotion analysis completed', {
        action: 'emotion_analysis',
        studentId,
        callId,
        emotion,
        confidence
      });
    },
    
    messageGenerated: (studentId, messageType, wordCount) => {
      logger.info('AI message generated', {
        action: 'ai_message_generated',
        studentId,
        messageType,
        wordCount
      });
    }
  },
  
  // Security events
  security: {
    authFailed: (ip, userAgent, reason) => {
      logger.warn('Authentication failed', {
        action: 'auth_failed',
        clientIP: ip,
        userAgent,
        reason
      });
    },
    
    rateLimited: (ip, endpoint, limit) => {
      logger.warn('Rate limit exceeded', {
        action: 'rate_limit_exceeded',
        clientIP: ip,
        endpoint,
        limit
      });
    },
    
    suspiciousActivity: (userId, activity, details) => {
      logger.error('Suspicious activity detected', {
        action: 'suspicious_activity',
        userId,
        activity,
        details
      });
    }
  },
  
  // System events
  system: {
    started: (port, environment) => {
      logger.info('Server started', {
        action: 'server_started',
        port,
        environment,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      });
    },
    
    shutdown: (reason) => {
      logger.info('Server shutting down', {
        action: 'server_shutdown',
        reason,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    },
    
    healthCheck: (status, checks) => {
      if (status === 'healthy') {
        logger.debug('Health check passed', { action: 'health_check', status, checks });
      } else {
        logger.error('Health check failed', { action: 'health_check', status, checks });
      }
    }
  }
};

/**
 * Performance monitoring middleware
 */
const performanceLogger = (req, res, next) => {
  const start = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        action: 'slow_request',
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        clientIP: getClientIP(req)
      });
    }
    
    // Add response time header
    res.set('X-Response-Time', `${duration}ms`);
    
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Request ID middleware
 */
const requestIdMiddleware = (req, res, next) => {
  // Generate or use existing request ID
  const requestId = req.headers['x-request-id'] || generateRequestId();
  
  // Add to request
  req.requestId = requestId;
  
  // Add to response headers
  res.set('X-Request-ID', requestId);
  
  next();
};

/**
 * Structured audit logging middleware
 */
const auditLogger = (action) => {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log the audit event
      logger.info('Audit log', {
        action,
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id || 'anonymous',
        userRole: req.user?.role || 'none',
        clientIP: getClientIP(req),
        requestId: req.requestId,
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        timestamp: new Date().toISOString(),
        requestParams: req.params,
        requestQuery: sanitizeQuery(req.query),
        responseSize: JSON.stringify(data).length
      });
      
      // Call original json method
      originalJson.call(this, data);
    };
    
    next();
  };
};

// Helper functions
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         'unknown';
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function maskSensitiveData(data) {
  if (typeof data === 'string') {
    // Mask email addresses and phone numbers
    return data
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***')
      .replace(/\+?\d{10,15}/g, '***-***-****');
  }
  return data;
}

function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***masked***';
    }
  });
  
  return sanitized;
}

function sanitizeQuery(query) {
  if (!query || typeof query !== 'object') return query;
  
  const sanitized = { ...query };
  if (sanitized.token) sanitized.token = '***masked***';
  if (sanitized.api_key) sanitized.api_key = '***masked***';
  
  return sanitized;
}

/**
 * Log cleanup utility
 */
const cleanupLogs = async (daysToKeep = 30) => {
  try {
    const files = fs.readdirSync(logsDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        logger.info('Old log file deleted', { file, deletedAt: new Date() });
      }
    }
  } catch (error) {
    logger.error('Error cleaning up logs', { error: error.message });
  }
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  appLogger,
  performanceLogger,
  requestIdMiddleware,
  auditLogger,
  cleanupLogs
};