// server/routes/webhook.js
const express = require('express');
const winston = require('winston');
const router = express.Router();

// Import webhook handlers
const { handleWebhookEvent: handleRetellWebhook } = require('../config/retell');
const { 
  processIncomingMessage, 
  handleWebhookVerification, 
  verifyWebhookSignature 
} = require('../config/whatsapp');
const { 
  createStudent, 
  updateStudent, 
  logNotification,
  getStudent 
} = require('../config/firebase');
const VoiceAgentService = require('../services/voiceAgent');
const NotificationsService = require('../services/notifications');
const AIIntelligenceService = require('../services/aiIntelligence');
const { asyncHandler } = require('../middleware/errorHandler');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'webhook-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * n8n Webhook Handler
 * Receives workflow notifications from n8n automation platform
 */
router.post('/n8n', asyncHandler(async (req, res) => {
  const webhookData = req.body;
  logger.info('Received n8n webhook:', { workflowId: webhookData.workflowId });

  switch (webhookData.event) {
    case 'admission_dropout_detected':
      await handleAdmissionDropout(webhookData);
      break;
    
    case 'voice_call_trigger':
      await handleVoiceCallTrigger(webhookData);
      break;
    
    case 'notification_send':
      await handleNotificationSend(webhookData);
      break;
    
    case 'counselor_escalation':
      await handleCounselorEscalation(webhookData);
      break;
    
    default:
      logger.warn(`Unhandled n8n event: ${webhookData.event}`);
  }

  res.status(200).json({ 
    status: 'success', 
    message: 'n8n webhook processed successfully',
    timestamp: new Date().toISOString()
  });
}));

/**
 * Retell AI Webhook Handler
 * Receives events from Retell AI voice agent platform
 */
router.post('/retell', asyncHandler(async (req, res) => {
  const event = req.body;
  logger.info('Received Retell webhook:', { event: event.event, callId: event.call?.call_id });

  // Process the Retell webhook event
  const result = await VoiceAgentService.processCallCompletion(event.call);

  res.status(200).json({
    status: 'success',
    message: 'Retell webhook processed successfully',
    result,
    timestamp: new Date().toISOString()
  });
}));

/**
 * WhatsApp Webhook Handler
 * Handles both GET (verification) and POST (messages) from WhatsApp
 */
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info('WhatsApp webhook verification request');

  const verificationResult = handleWebhookVerification(mode, token, challenge);
  
  if (verificationResult) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

router.post('/whatsapp', asyncHandler(async (req, res) => {
  const webhookData = req.body;
  const signature = req.headers['x-hub-signature-256'];

  logger.info('Received WhatsApp webhook message');

  // Verify webhook signature (optional but recommended)
  if (signature && process.env.WHATSAPP_VERIFY_TOKEN) {
    const isValid = verifyWebhookSignature(
      JSON.stringify(req.body), 
      signature, 
      process.env.WHATSAPP_VERIFY_TOKEN
    );
    
    if (!isValid) {
      logger.warn('Invalid WhatsApp webhook signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  // Process the incoming message
  const messageData = await processIncomingMessage(webhookData);
  
  if (messageData) {
    // Trigger appropriate follow-up actions
    await triggerMessageFollowUp(messageData);
  }

  res.status(200).json({
    status: 'success',
    message: 'WhatsApp webhook processed successfully',
    timestamp: new Date().toISOString()
  });
}));

/**
 * Generic Inquiry Form Webhook
 * Handles new student inquiries from various sources
 */
router.post('/inquiry', asyncHandler(async (req, res) => {
  const inquiryData = req.body;
  logger.info('Received new inquiry:', { email: inquiryData.email });

  const requiredFields = ['name', 'email', 'phone'];
  const missingFields = requiredFields.filter(field => !inquiryData[field]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields',
      missingFields
    });
  }

  // Create new student record
  const student = await createStudent({
    name: inquiryData.name,
    email: inquiryData.email,
    phone: inquiryData.phone,
    inquiryType: inquiryData.inquiryType || 'general',
    source: inquiryData.source || 'website',
    programInterest: inquiryData.programInterest || '',
    expectedStartDate: inquiryData.expectedStartDate || '',
    additionalInfo: inquiryData.additionalInfo || '',
    status: 'inquiry_submitted'
  });

  // Trigger initial engagement workflow
  await triggerInitialEngagement(student);

  res.status(201).json({
    status: 'success',
    message: 'Inquiry processed successfully',
    studentId: student.id,
    timestamp: new Date().toISOString()
  });
}));

/**
 * Application Status Update Webhook
 * Receives updates about application status changes
 */
router.post('/application-status', asyncHandler(async (req, res) => {
  const statusData = req.body;
  logger.info('Received application status update:', { 
    studentId: statusData.studentId, 
    status: statusData.status 
  });

  // Update student status
  await updateStudent(statusData.studentId, {
    status: statusData.status,
    applicationStage: statusData.stage || '',
    statusUpdatedAt: new Date().toISOString(),
    statusNotes: statusData.notes || ''
  });

  // Log the status update
  await logNotification({
    type: 'status_update',
    studentId: statusData.studentId,
    content: `Application status updated to: ${statusData.status}`,
    status: 'logged'
  });

  // Trigger appropriate follow-up based on status
  await triggerStatusBasedFollowUp(statusData.studentId, statusData.status);

  res.status(200).json({
    status: 'success',
    message: 'Application status updated successfully',
    timestamp: new Date().toISOString()
  });
}));

/**
 * Handle admission dropout detection from n8n
 */
async function handleAdmissionDropout(webhookData) {
  const { studentId, dropoutReason, daysSinceLastActivity } = webhookData.data;
  
  logger.info(`Processing admission dropout for student: ${studentId}`);
  
  await updateStudent(studentId, {
    status: 'dropout_risk',
    dropoutReason,
    daysSinceLastActivity,
    riskLevel: AIIntelligenceService.predictDropoutProbability({ daysSinceLastActivity }).prediction.riskLevel,
    lastDropoutDetection: new Date().toISOString()
  });

  await triggerN8nWorkflow('voice_call_trigger', {
    studentId,
    priority: 'high',
    reason: 'dropout_detected'
  });
}

/**
 * Handle voice call trigger from n8n
 */
async function handleVoiceCallTrigger(webhookData) {
  const { studentId, priority, reason } = webhookData.data;
  const student = await getStudent(studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const callResult = await VoiceAgentService.createIntelligentCall({
    studentId: student.id,
    toNumber: student.phone,
    studentName: student.name,
    inquiryType: student.inquiryType,
    applicationStatus: student.status,
    priority,
    callReason: reason,
    callType: 'automated'
  });

  if (callResult.success) {
    await logNotification({
      type: 'voice_call_initiated',
      studentId,
      content: `Voice call initiated with priority: ${priority}`,
      status: 'sent',
      externalId: callResult.call.id
    });
  } else {
    await logNotification({
      type: 'voice_call_failed',
      studentId,
      content: `Voice call failed: ${callResult.error}`,
      status: 'failed',
      error: callResult.error
    });
  }
}

/**
 * Handle notification send from n8n
 */
async function handleNotificationSend(webhookData) {
  const { studentId, notificationType, customMessage, channel } = webhookData.data;
  const student = await getStudent(studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  let result;
  if (channel === 'whatsapp') {
    result = await NotificationsService.sendWhatsAppMessage({
      to: student.phone,
      studentId: student.id,
      templateType: notificationType,
      customMessage: customMessage || await AIIntelligenceService.generateFollowUpMessage(student).message
    });
  }

  await logNotification({
    type: `${channel}_notification`,
    studentId,
    content: result.message,
    status: result.success ? 'sent' : 'failed',
    externalId: result.messageId
  });
}

/**
 * Handle counselor escalation from n8n
 */
async function handleCounselorEscalation(webhookData) {
  const { studentId, escalationReason, urgencyLevel } = webhookData.data;
  const student = await getStudent(studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const briefing = await AIIntelligenceService.generatePersonalizedIntervention(student, {
    reason: escalationReason,
    urgencyLevel
  });

  await updateStudent(studentId, {
    status: 'counselor_required',
    escalationReason,
    urgencyLevel,
    counselorBriefing: briefing.briefing,
    escalatedAt: new Date().toISOString()
  });

  await logNotification({
    type: 'counselor_escalation',
    studentId,
    content: `Escalated to counselor: ${escalationReason}`,
    status: 'escalated',
    urgencyLevel
  });
}

/**
 * Trigger n8n workflow
 */
async function triggerN8nWorkflow(workflowName, data) {
  try {
    const axios = require('axios');
    
    const response = await axios.post(
      `${process.env.N8N_WEBHOOK_URL}/${workflowName}`,
      {
        event: workflowName,
        data,
        timestamp: new Date().toISOString(),
        source: 'edunudge-api'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.N8N_API_KEY}`
        }
      }
    );
    logger.info(`Triggered n8n workflow: ${workflowName}`);
    return response.data;
  } catch (error) {
    logger.error(`Error triggering n8n workflow ${workflowName}:`, error);
    throw error;
  }
}

/**
 * Trigger initial engagement workflow
 */
async function triggerInitialEngagement(student) {
  try {
    // Send welcome message via WhatsApp
    await NotificationsService.sendWhatsAppMessage({
      to: student.phone,
      studentId: student.id,
      templateType: 'welcome'
    });

    // Schedule follow-up monitoring
    await triggerN8nWorkflow('admission_monitor', {
      studentId: student.id,
      action: 'start_monitoring'
    });

    logger.info(`Initial engagement triggered for student: ${student.id}`);
  } catch (error) {
    logger.error('Error triggering initial engagement:', error);
  }
}

/**
 * Trigger message follow-up actions
 */
async function triggerMessageFollowUp(messageData) {
  try {
    const emotionAnalysis = await AIIntelligenceService.analyzeConversationIntelligence({
      transcript: messageData.content,
      responses: [messageData.content]
    });

    if (emotionAnalysis.needsSupport) {
      await triggerN8nWorkflow('counselor_escalation', {
        studentId: messageData.studentId,
        reason: 'whatsapp_support_needed',
        urgencyLevel: emotionAnalysis.urgencyLevel
      });
    }

    logger.info(`Message follow-up processed for: ${messageData.fromNumber}`);
  } catch (error) {
    logger.error('Error processing message follow-up:', error);
  }
}

/**
 * Trigger status-based follow-up
 */
async function triggerStatusBasedFollowUp(studentId, status) {
  const followUpMap = {
    'documents_pending': 'document_reminder',
    'interview_scheduled': 'interview_preparation',
    'application_complete': 'completion_confirmation',
    'accepted': 'acceptance_congratulations'
  };

  const workflowName = followUpMap[status];
  if (workflowName) {
    await triggerN8nWorkflow(workflowName, {
      studentId,
      status,
      triggeredBy: 'status_update'
    });
  }
}

module.exports = router;