// server/routes/admin.js
const express = require('express');
const winston = require('winston');
const router = express.Router();

// Import Firebase functions
const { getAnalytics } = require('../config/firebase');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'admin-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get Analytics Data
 */
router.get('/analytics', async (req, res) => {
  try {
    const { dateRange = '7' } = req.query;
    
    logger.info(`Fetching analytics for ${dateRange} days`);
    
    const analytics = await getAnalytics(parseInt(dateRange));

    res.json({
      status: 'success',
      analytics
    });

  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

/**
 * Get Recent Calls
 */
router.get('/calls', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    logger.info(`Fetching recent calls, limit: ${limit}`);
    
    // For now, return empty array - in real implementation, fetch from database
    res.json({
      status: 'success',
      calls: []
    });

  } catch (error) {
    logger.error('Error fetching calls:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch calls',
      error: error.message
    });
  }
});

/**
 * Log Activity
 */
router.post('/log', async (req, res) => {
  try {
    const logData = req.body;
    
    logger.info('Logging activity:', logData);
    
    // In real implementation, store in database
    res.json({
      status: 'success',
      message: 'Activity logged successfully'
    });

  } catch (error) {
    logger.error('Error logging activity:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to log activity',
      error: error.message
    });
  }
});

module.exports = router;