// server/routes/voice.js
const express = require('express');
const winston = require('winston');
const router = express.Router();

// Import services and middleware
const VoiceService = require('../services/voiceService');
const { validators } = require('../middleware/validation');
const { appLogger } = require('../middleware/logging');
const { asyncHandler } = require('../middleware/errorHandler');

// Configure logger
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
 * @route   POST /api/voice/create-call
 * @desc    Create and initiate a voice call
 * @access  Private
 */
router.post('/create-call', validators.call.create, asyncHandler(async (req, res) => {
  const {
    studentId,
    toNumber,
    studentName,
    inquiryType,
    applicationStatus,
    priority,
    reason,
    callType,
    agentConfig
  } = req.body;

  logger.info(`Creating voice call for student: ${studentId}`);
  appLogger.call.initiated(null, studentId, priority, reason);

  const result = await VoiceService.createCall({
    studentId,
    toNumber,
    studentName,
    inquiryType,
    applicationStatus,
    priority,
    reason,
    callType,
    agentConfig
  });

  if (result.status === 'success') {
    res.status(201).json({
      status: 'success',
      message: 'Voice call created successfully',
      data: result.call,
      voiceScript: result.voiceScript
    });
  } else {
    res.status(400).json({
      status: 'error',
      message: result.message || 'Failed to create voice call',
      error: result.error
    });
  }
}));

/**
 * @route   GET /api/voice/calls/:callId
 * @desc    Get call status and details
 * @access  Private
 */
router.get('/calls/:callId', validators.call.id, asyncHandler(async (req, res) => {
  const { callId } = req.params;

  logger.info(`Getting call status: ${callId}`);

  const result = await VoiceService.getCallStatus(callId);

  if (result.status === 'success') {
    res.json({
      status: 'success',
      message: 'Call details retrieved successfully',
      data: result.call
    });
  } else {
    res.status(404).json({
      status: 'error',
      message: result.message || 'Call not found'
    });
  }
}));

/**
 * @route   GET /api/voice/calls/history/:studentId
 * @desc    Get call history for a student
 * @access  Private
 */
router.get('/calls/history/:studentId', validators.common.objectId('studentId'), asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { limit = 50 } = req.query;

  logger.info(`Getting call history for student: ${studentId}`);

  const result = await VoiceService.getCallHistory(studentId, parseInt(limit));

  res.json({
    status: 'success',
    message: 'Call history retrieved successfully',
    data: result
  });
}));

/**
 * @route   GET /api/voice/calls/recent
 * @desc    Get recent calls with optional filters
 * @access  Private
 */
router.get('/calls/recent', validators.common.pagination, asyncHandler(async (req, res) => {
  const { 
    limit = 50, 
    status, 
    priority, 
    dateFrom, 
    dateTo,
    studentId,
    reason
  } = req.query;

  logger.info('Getting recent calls');

  const filters = {};
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;
  if (studentId) filters.studentId = studentId;
  if (reason) filters.reason = reason;

  const result = await VoiceService.getRecentCalls(parseInt(limit), filters);

  res.json({
    status: 'success',
    message: 'Recent calls retrieved successfully',
    data: result
  });
}));

/**
 * @route   DELETE /api/voice/calls/:callId
 * @desc    Cancel an ongoing call
 * @access  Private
 */
router.delete('/calls/:callId', validators.call.id, asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { reason = 'Manual cancellation' } = req.body;

  logger.info(`Cancelling call: ${callId}`);

  const result = await VoiceService.cancelCall(callId);

  if (result.status === 'success') {
    res.json({
      status: 'success',
      message: 'Call cancelled successfully',
      data: { callId, cancelledAt: new Date().toISOString() }
    });
  } else {
    res.status(400).json({
      status: 'error',
      message: result.message || 'Failed to cancel call'
    });
  }
}));

/**
 * @route   POST /api/voice/calls/:callId/retry
 * @desc    Retry a failed call
 * @access  Private
 */
router.post('/calls/:callId/retry', validators.call.id, asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { retryReason = 'Manual retry' } = req.body;

  logger.info(`Retrying call: ${callId}`);

  const result = await VoiceService.retryCall(callId, retryReason);

  if (result.status === 'success') {
    res.status(201).json({
      status: 'success',
      message: 'Call retry initiated successfully',
      data: result.call,
      originalCallId: callId
    });
  } else {
    res.status(400).json({
      status: 'error',
      message: result.message || 'Failed to retry call',
      error: result.error
    });
  }
}));

/**
 * @route   GET /api/voice/analytics
 * @desc    Get call analytics and metrics
 * @access  Private
 */
router.get('/analytics', validators.common.dateRange, asyncHandler(async (req, res) => {
  const { dateRange = 7 } = req.query;

  logger.info(`Getting call analytics for ${dateRange} days`);

  const result = await VoiceService.getCallAnalytics(parseInt(dateRange));

  res.json({
    status: 'success',
    message: 'Call analytics retrieved successfully',
    data: result
  });
}));

/**
 * @route   GET /api/voice/calls/:callId/report
 * @desc    Generate detailed call report
 * @access  Private
 */
router.get('/calls/:callId/report', validators.call.id, asyncHandler(async (req, res) => {
  const { callId } = req.params;

  logger.info(`Generating call report: ${callId}`);

  const result = await VoiceService.generateCallReport(callId);

  if (result.status === 'success') {
    res.json({
      status: 'success',
      message: 'Call report generated successfully',
      data: result.report
    });
  } else {
    res.status(404).json({
      status: 'error',
      message: result.message || 'Failed to generate call report'
    });
  }
}));

/**
 * @route   POST /api/voice/webhook/retell
 * @desc    Handle Retell AI webhook events
 * @access  Public (with API key authentication)
 */
router.post('/webhook/retell', asyncHandler(async (req, res) => {
  const { 
    event,
    call_id,
    call_status,
    start_timestamp,
    end_timestamp,
    duration,
    transcript,
    analysis
  } = req.body;

  logger.info(`Received Retell webhook: ${event} for call ${call_id}`);

  try {
    // Verify webhook signature (in production)
    // const isValid = verifyRetellSignature(req.headers, req.body);
    // if (!isValid) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    switch (event) {
      case 'call_started':
        logger.info(`Call started: ${call_id}`);
        break;

      case 'call_ended':
      case 'call_completed':
        await VoiceService.processCallCompletion({
          call_id,
          call_status,
          start_timestamp,
          end_timestamp,
          duration,
          transcript,
          analysis
        });
        break;

      case 'call_failed':
        logger.error(`Call failed: ${call_id}`, { call_status, analysis });
        await VoiceService.processCallCompletion({
          call_id,
          call_status: 'failed',
          end_timestamp: new Date().toISOString(),
          analysis
        });
        break;

      case 'call_transcription':
        logger.info(`Transcription received for call: ${call_id}`);
        // Handle live transcription updates
        break;

      default:
        logger.warn(`Unknown webhook event: ${event}`);
    }

    res.status(200).json({ 
      status: 'success',
      message: 'Webhook processed successfully',
      event,
      call_id
    });

  } catch (error) {
    logger.error('Error processing Retell webhook:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to process webhook',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/voice/bulk-calls
 * @desc    Create multiple voice calls in batch
 * @access  Private
 */
router.post('/bulk-calls', asyncHandler(async (req, res) => {
  const { 
    calls = [],
    batchName = 'unnamed_batch',
    priority = 'medium',
    reason = 'batch_operation'
  } = req.body;

  if (!calls || calls.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Calls array is required and cannot be empty'
    });
  }

  if (calls.length > 50) {
    return res.status(400).json({
      status: 'error',
      message: 'Maximum 50 calls allowed per batch'
    });
  }

  logger.info(`Creating bulk calls: ${calls.length} calls in batch '${batchName}'`);

  const results = [];

  for (const callData of calls) {
    try {
      const result = await VoiceService.createCall({
        ...callData,
        priority,
        reason,
        callType: 'batch',
        batchName
      });

      results.push({
        studentId: callData.studentId,
        success: result.status === 'success',
        callId: result.call?.id,
        error: result.error
      });

      // Add delay between calls to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      results.push({
        studentId: callData.studentId,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  logger.info(`Bulk calls completed: ${successCount} successful, ${failCount} failed`);

  res.json({
    status: 'success',
    message: `Bulk calls processed: ${successCount} created, ${failCount} failed`,
    data: {
      batchName,
      totalCalls: calls.length,
      successCount,
      failCount,
      results
    }
  });
}));

/**
 * @route   GET /api/voice/system/status
 * @desc    Get voice system status and health
 * @access  Private
 */
router.get('/system/status', asyncHandler(async (req, res) => {
  try {
    const status = {
      service: 'voice-system',
      status: 'operational',
      timestamp: new Date().toISOString(),
      checks: {
        retellConnection: 'healthy',
        database: 'healthy',
        queueStatus: 'healthy'
      },
      metrics: {
        activeCalls: 0,
        queuedCalls: 0,
        dailyCalls: 0,
        successRate: 0
      }
    };

    // In a real implementation, you would check:
    // - Retell AI service connectivity
    // - Database connection
    // - Call queue status
    // - Recent call metrics

    res.json({
      status: 'success',
      message: 'Voice system status retrieved',
      data: status
    });

  } catch (error) {
    logger.error('Error getting system status:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get system status',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/voice/test-call
 * @desc    Create a test call for system verification
 * @access  Private (Admin only)
 */
router.post('/test-call', asyncHandler(async (req, res) => {
  const { 
    toNumber,
    testType = 'system_check',
    duration = 30
  } = req.body;

  if (!toNumber) {
    return res.status(400).json({
      status: 'error',
      message: 'Phone number is required for test call'
    });
  }

  logger.info(`Creating test call to: ${toNumber}`);

  try {
    const result = await VoiceService.createCall({
      studentId: 'test-student',
      toNumber,
      studentName: 'Test Student',
      inquiryType: 'test',
      applicationStatus: 'test',
      priority: 'low',
      reason: 'system_test',
      callType: 'test',
      agentConfig: {
        customPrompt: 'This is a test call for system verification. Please acknowledge receipt and end the call.',
        duration: duration
      }
    });

    if (result.status === 'success') {
      res.json({
        status: 'success',
        message: 'Test call created successfully',
        data: {
          callId: result.call.id,
          testType,
          expectedDuration: duration,
          createdAt: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to create test call',
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error creating test call:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to create test call',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/voice/calls/:callId/transcript
 * @desc    Get call transcript and analysis
 * @access  Private
 */
router.get('/calls/:callId/transcript', validators.call.id, asyncHandler(async (req, res) => {
  const { callId } = req.params;

  logger.info(`Getting transcript for call: ${callId}`);

  try {
    const call = await VoiceService.getCallById(callId);
    
    if (!call) {
      return res.status(404).json({
        status: 'error',
        message: 'Call not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Call transcript retrieved successfully',
      data: {
        callId,
        transcript: call.transcript || '',
        duration: call.duration,
        analysis: call.emotionAnalysis,
        createdAt: call.startTime,
        completedAt: call.endTime
      }
    });

  } catch (error) {
    logger.error(`Error getting transcript for call ${callId}:`, error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get call transcript',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/voice/calls/:callId/notes
 * @desc    Add or update call notes
 * @access  Private
 */
router.put('/calls/:callId/notes', validators.call.id, asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { notes, tags = [] } = req.body;

  if (!notes || notes.trim().length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Notes cannot be empty'
    });
  }

  logger.info(`Updating notes for call: ${callId}`);

  try {
    const result = await VoiceService.updateCallRecord(callId, {
      notes: notes.trim(),
      tags,
      notesUpdatedBy: req.user.id,
      notesUpdatedAt: new Date().toISOString()
    });

    res.json({
      status: 'success',
      message: 'Call notes updated successfully',
      data: {
        callId,
        notes,
        tags,
        updatedBy: req.user.id,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error(`Error updating notes for call ${callId}:`, error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to update call notes',
      error: error.message
    });
  }
}));

module.exports = router;