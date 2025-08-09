// server/routes/voice.js
const express = require('express');
const winston = require('winston');
const router = express.Router();

const VoiceAgentService = require('../services/voiceAgent');
const { validators, validate } = require('../middleware/validation'); // Corrected import
const { asyncHandler } = require('../middleware/errorHandler');

// Configure logger for this module
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'voice-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Endpoint to initiate an intelligent voice call to a student.
 */
router.post('/create-call', 
  validators.voice.createCall, // Corrected validator reference
  validate, // Add the validation middleware
  asyncHandler(async (req, res) => {
    const { studentId, callReason, priority, customContext, agentPersonality } = req.body;
  
    logger.info(`Received request to create call for student: ${studentId}`);

    // Use the updated VoiceAgentService to create the intelligent call
    const result = await VoiceAgentService.createIntelligentCall({ 
      studentId, 
      callReason, 
      priority, 
      customContext, 
      agentPersonality
    });
  
    if (!result.success) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Failed to initiate intelligent voice call', 
        details: result.error 
      });
    }
  
    res.status(200).json({ 
      status: 'success', 
      message: 'Intelligent voice call initiated successfully', 
      call: result.call 
    });
}));


/**
 * Webhook endpoint for receiving call completion events from Retell AI.
 */
router.post('/webhook/call-completion', asyncHandler(async (req, res) => {
  const callData = req.body;
  const { call_id } = callData;

  logger.info(`Received call completion webhook for call ID: ${call_id}`);
  
  // Use the updated VoiceAgentService to process the call completion
  const result = await VoiceAgentService.processCallCompletion(callData);

  if (result.status === 'error') {
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to process call completion webhook', 
      details: result.error 
    });
  }

  res.status(200).json({ 
    status: 'success', 
    message: 'Retell webhook processed successfully',
    data: result
  });
}));

/**
 * Endpoint to get the status of a specific call.
 */
router.get('/:callId/status', asyncHandler(async (req, res) => {
  const { callId } = req.params;
  
  logger.info(`Checking status for call: ${callId}`);
  
  const result = await VoiceAgentService.getCallStatus(callId);
  
  if (result.status === 'error') {
    return res.status(404).json({
      status: 'error',
      message: result.message
    });
  }
  
  res.status(200).json({
    status: 'success',
    call: result.call
  });
}));


/**
 * Endpoint to get recent calls with optional filters.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { studentId, limit = 50, status, priority, reason } = req.query;

  const filters = { studentId, status, priority, reason };
  
  logger.info(`Fetching recent calls with filters: ${JSON.stringify(filters)}`);

  const recentCalls = await VoiceAgentService.getRecentCalls(limit, filters);
  
  res.status(200).json({
    status: 'success',
    calls: recentCalls
  });
}));

module.exports = router;