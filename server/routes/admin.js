// server/routes/admin.js
const express = require('express');
const winston = require('winston');
const router = express.Router();
const { getRecentCalls, getStudents } = require('../config/firebase');
const { generateCounselorBriefing } = require('../config/openai');
const { asyncHandler } = require('../middleware/errorHandler');

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
 * Get recent call history
 */
router.get('/calls', asyncHandler(async (req, res) => {
  const { limit = 50, studentId } = req.query;
  
  logger.info(`Fetching recent calls for studentId: ${studentId || 'all'}`);
  
  // Use the new getRecentCalls function from firebase.js
  const calls = await getRecentCalls(studentId, parseInt(limit));

  res.json({
    status: 'success',
    calls
  });
}));

/**
 * Get students requiring counselor attention
 */
router.get('/escalations', asyncHandler(async (req, res) => {
  logger.info('Fetching students requiring counselor attention');
  
  // Fetch students with the 'counselor_required' status
  const escalatedStudents = await getStudents({ status: 'counselor_required' });
  
  res.json({
    status: 'success',
    students: escalatedStudents
  });
}));

/**
 * Generate a briefing for a counselor based on a student's history
 */
router.post('/generate-briefing/:studentId', asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { recentCalls, recentNotifications, conversationAnalysis } = req.body;
  
  logger.info(`Generating counselor briefing for student: ${studentId}`);
  
  // The provided body is used to create the briefing.
  // In a real-world scenario, you would fetch this data from the database.
  
  const briefingResult = await generateCounselorBriefing({ 
    studentId,
    recentCalls,
    recentNotifications,
    conversationAnalysis 
  });
  
  if (!briefingResult.success) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate counselor briefing',
      details: briefingResult.error
    });
  }
  
  res.status(200).json({
    status: 'success',
    briefing: briefingResult.briefing,
    metadata: briefingResult.metadata
  });
}));

module.exports = router;