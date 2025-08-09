// server/middleware/errorHandler.js
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});

// A utility function to create a standardized error object
const createError = (message, status = 500, code = 'GENERIC_ERROR', details = null) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    error.details = details;
    return error;
};

// Asynchronous middleware wrapper to catch errors
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// General error handling middleware
const errorHandler = (err, req, res, next) => {
    logger.error('An unhandled error occurred:', {
        message: err.message,
        stack: err.stack,
        status: err.status || 500,
        code: err.code || 'GENERIC_ERROR',
        details: err.details || null,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    const code = err.code || 'GENERIC_ERROR';
    const details = err.details || null;

    res.status(status).json({
        status: 'error',
        message: message,
        code: code,
        details: details
    });
};

module.exports = {
  createError,
  asyncHandler,
  errorHandler
};