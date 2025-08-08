// server/utils/helpers.js
const crypto = require('crypto');
const moment = require('moment-timezone'); // Fixed: Added moment-timezone

/**
 * Utility helper functions for the EduNudge AI server
 */

/**
 * Generate a secure random string
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Hash a password using crypto
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
  return {
    hash: hash.toString('hex'),
    salt: salt
  };
}

/**
 * Verify a password against hash
 */
function verifyPassword(password, hash, salt) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
  return hash === verifyHash.toString('hex');
}

/**
 * Format phone number to international standard
 */
function formatPhoneNumber(phone) {
  if (!phone) return phone;
  
  // Remove all non-digit characters except +
  let formatted = phone.replace(/[^\d+]/g, '');
  
  // If no country code, assume US (+1)
  if (!formatted.startsWith('+')) {
    if (formatted.length === 10) {
      formatted = '+1' + formatted;
    } else if (formatted.length === 11 && formatted.startsWith('1')) {
      formatted = '+' + formatted;
    }
  }
  
  return formatted;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone) {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Calculate time difference in human readable format
 */
function getTimeAgo(timestamp) {
  return moment(timestamp).fromNow();
}

/**
 * Format date to readable string
 */
function formatDate(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
  return moment(timestamp).format(format);
}

/**
 * Calculate days between two dates
 */
function daysBetween(startDate, endDate = new Date()) {
  const start = moment(startDate);
  const end = moment(endDate);
  return end.diff(start, 'days');
}

/**
 * Check if date is within business hours (9 AM - 6 PM)
 */
function isBusinessHours(date = new Date(), timezone = 'America/New_York') {
  try {
    const hour = moment(date).tz(timezone).hour();
    return hour >= 9 && hour < 18;
  } catch (error) {
    // Fallback to local time if timezone is invalid
    const hour = moment(date).hour();
    return hour >= 9 && hour < 18;
  }
}

/**
 * Sanitize string for database storage
 */
function sanitizeString(str) {
  if (!str) return str;
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Generate a slug from text
 */
function generateSlug(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, ''); // Fixed: removed .trim('-') which doesn't exist
}

/**
 * Mask sensitive data for logging
 */
function maskSensitiveData(data, fields = ['password', 'token', 'key', 'secret']) {
  if (!data || typeof data !== 'object') return data;
  
  const masked = { ...data };
  
  fields.forEach(field => {
    if (masked[field]) {
      masked[field] = '***masked***';
    }
  });
  
  return masked;
}

/**
 * Convert object to query string
 */
function objectToQueryString(obj) {
  if (!obj || typeof obj !== 'object') return '';
  
  return Object.keys(obj)
    .filter(key => obj[key] !== null && obj[key] !== undefined)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join('&');
}

/**
 * Parse query string to object
 */
function queryStringToObject(queryString) {
  if (!queryString) return {};
  
  const params = new URLSearchParams(queryString);
  const obj = {};
  
  for (const [key, value] of params) {
    obj[key] = value;
  }
  
  return obj;
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Debounce function
 */
function debounce(func, delay) {
  let timeoutId;
  
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  
  return function (...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(func, maxRetries = 3, baseDelay = 1000) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await func();
    } catch (error) {
      retries++;
      
      if (retries >= maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, retries - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Check if string is JSON
 */
function isValidJSON(str) {
  if (typeof str !== 'string') return false;
  
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Safe JSON parse
 */
function safeJSONParse(str, defaultValue = null) {
  if (typeof str !== 'string') return defaultValue;
  
  try {
    return JSON.parse(str);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Capitalize first letter of each word
 */
function titleCase(str) {
  if (!str || typeof str !== 'string') return '';
  
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random string of specified length
 */
function randomString(length = 10, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Calculate percentage
 */
function calculatePercentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Convert bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get client IP address from request
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         'unknown';
}

/**
 * Check if running in development mode
 */
function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Log with timestamp
 */
function logWithTimestamp(message, level = 'info') {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

/**
 * Create error response object
 */
function createErrorResponse(message, code = 'GENERIC_ERROR', details = null) {
  return {
    status: 'error',
    message,
    code,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create success response object
 */
function createSuccessResponse(data = null, message = 'Success') {
  return {
    status: 'success',
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate required fields in object
 */
function validateRequiredFields(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    return {
      isValid: false,
      missingFields: requiredFields
    };
  }
  
  const missing = [];
  
  requiredFields.forEach(field => {
    if (!(field in obj) || obj[field] === null || obj[field] === undefined || obj[field] === '') {
      missing.push(field);
    }
  });
  
  return {
    isValid: missing.length === 0,
    missingFields: missing
  };
}

/**
 * Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateSecureToken,
  generateUUID,
  hashPassword,
  verifyPassword,
  formatPhoneNumber,
  isValidEmail,
  isValidPhoneNumber,
  getTimeAgo,
  formatDate,
  daysBetween,
  isBusinessHours,
  sanitizeString,
  generateSlug,
  maskSensitiveData,
  objectToQueryString,
  queryStringToObject,
  deepMerge,
  isObject,
  debounce,
  throttle,
  retryWithBackoff,
  isValidJSON,
  safeJSONParse,
  titleCase,
  randomInt,
  randomString,
  calculatePercentage,
  formatNumber,
  formatBytes,
  getClientIP,
  isDevelopment,
  isProduction,
  logWithTimestamp,
  createErrorResponse,
  createSuccessResponse,
  validateRequiredFields,
  sleep
};