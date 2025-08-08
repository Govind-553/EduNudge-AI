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
  logNotification 
} = require('../config/firebase');

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
router.post('/n8n', async (req, res) => {
  try {
    const webhookData = req.body;
    logger.info('Received n8n webhook:', { workflowId: webhookData.workflowId });

    // Process different n8n workflow events
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

  } catch (error) {
    logger.error('Error processing n8n webhook:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to process n8n webhook',
      error: error.message 
    });
  }
});

/**
 * Retell AI Webhook Handler
 * Receives events from Retell AI voice agent platform
 */
router.post('/retell', async (req, res) => {
  try {
    const event = req.body;
    logger.info('Received Retell webhook:', { event: event.event, callId: event.call?.call_id });

    // Process the Retell webhook event
    const result = await handleRetellWebhook(event);

    res.status(200).json({
      status: 'success',
      message: 'Retell webhook processed successfully',
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error processing Retell webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process Retell webhook',
      error: error.message
    });
  }
});

/**
 * WhatsApp Webhook Handler
 * Handles both GET (verification) and POST (messages) from WhatsApp
 */
router.get('/whatsapp', (req, res) => {
  try {
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

  } catch (error) {
    logger.error('Error in WhatsApp webhook verification:', error);
    res.status(500).json({
      status: 'error',
      message: 'Webhook verification failed'
    });
  }
});

router.post('/whatsapp', async (req, res) => {
  try {
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

  } catch (error) {
    logger.error('Error processing WhatsApp webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process WhatsApp webhook',
      error: error.message
    });
  }
});

/**
 * Generic Inquiry Form Webhook
 * Handles new student inquiries from various sources
 */
router.post('/inquiry', async (req, res) => {
  try {
    const inquiryData = req.body;
    logger.info('Received new inquiry:', { email: inquiryData.email });

    // Validate required fields
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

  } catch (error) {
    logger.error('Error processing inquiry:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process inquiry',
      error: error.message
    });
  }
});

/**
 * Application Status Update Webhook
 * Receives updates about application status changes
 */
router.post('/application-status', async (req, res) => {
  try {
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

  } catch (error) {
    logger.error('Error updating application status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update application status',
      error: error.message
    });
  }
});

/**
 * Handle admission dropout detection from n8n
 */
async function handleAdmissionDropout(webhookData) {
  try {
    const { studentId, dropoutReason, daysSinceLastActivity } = webhookData.data;
    
    logger.info(`Processing admission dropout for student: ${studentId}`);
    
    // Update student status
    await updateStudent(studentId, {
      status: 'dropout_risk',
      dropoutReason,
      daysSinceLastActivity,
      riskLevel: calculateRiskLevel(daysSinceLastActivity),
      lastDropoutDetection: new Date().toISOString()
    });

    // Trigger voice call through n8n
    await triggerN8nWorkflow('voice_call_trigger', {
      studentId,
      priority: 'high',
      reason: 'dropout_detected'
    });

    logger.info(`Admission dropout handled for student: ${studentId}`);
    
  } catch (error) {
    logger.error('Error handling admission dropout:', error);
    throw error;
  }
}

/**
 * Handle voice call trigger from n8n
 */
async function handleVoiceCallTrigger(webhookData) {
  try {
    const { studentId, priority, reason } = webhookData.data;
    const { createPhoneCall } = require('../config/retell');
    const { getStudent } = require('../config/firebase');
    
    logger.info(`Processing voice call trigger for student: ${studentId}`);
    
    // Get student details
    const student = await getStudent(studentId);
    if (!student) {
      throw new Error(`Student not found: ${studentId}`);
    }

    // Create phone call using Retell AI
    const callResult = await createPhoneCall({
      studentId: student.id,
      toNumber: student.phone,
      studentName: student.name,
      inquiryType: student.inquiryType,
      applicationStatus: student.status,
      agentId: process.env.RETELL_DEFAULT_AGENT_ID
    });

    // Log the call initiation
    await logNotification({
      type: 'voice_call_initiated',
      studentId,
      content: `Voice call initiated with priority: ${priority}`,
      status: 'sent',
      externalId: callResult.call_id
    });

    logger.info(`Voice call triggered for student: ${studentId}, Call ID: ${callResult.call_id}`);
    
  } catch (error) {
    logger.error('Error handling voice call trigger:', error);
    throw error;
  }
}

/**
 * Handle notification send from n8n
 */
async function handleNotificationSend(webhookData) {
  try {
    const { studentId, notificationType, content, channel } = webhookData.data;
    const { sendPersonalizedMessage } = require('../config/whatsapp');
    const { getStudent } = require('../config/firebase');
    
    logger.info(`Processing notification send for student: ${studentId}`);
    
    const student = await getStudent(studentId);
    if (!student) {
      throw new Error(`Student not found: ${studentId}`);
    }

    let result;
    
    if (channel === 'whatsapp') {
      result = await sendPersonalizedMessage(
        student.phone,
        notificationType,
        {
          student_name: student.name,
          institution_name: process.env.INSTITUTION_NAME,
          program_name: student.inquiryType
        }
      );
    }

    // Log the notification
    await logNotification({
      type: `${channel}_notification`,
      studentId,
      content,
      status: result?.success ? 'sent' : 'failed',
      externalId: result?.messageId
    });

    logger.info(`Notification sent to student: ${studentId} via ${channel}`);
    
  } catch (error) {
    logger.error('Error handling notification send:', error);
    throw error;
  }
}

/**
 * Handle counselor escalation from n8n
 */
async function handleCounselorEscalation(webhookData) {
  try {
    const { studentId, escalationReason, urgencyLevel } = webhookData.data;
    const { generateCounselorBriefing } = require('../config/openai');
    const { getStudent } = require('../config/firebase');
    
    logger.info(`Processing counselor escalation for student: ${studentId}`);
    
    const student = await getStudent(studentId);
    if (!student) {
      throw new Error(`Student not found: ${studentId}`);
    }

    // Generate counselor briefing
    const briefing = await generateCounselorBriefing(student, student.callHistory || {});

    // Update student with escalation info
    await updateStudent(studentId, {
      status: 'counselor_required',
      escalationReason,
      urgencyLevel,
      counselorBriefing: briefing.briefing,
      escalatedAt: new Date().toISOString()
    });

    // Log the escalation
    await logNotification({
      type: 'counselor_escalation',
      studentId,
      content: `Escalated to counselor: ${escalationReason}`,
      status: 'escalated',
      urgencyLevel
    });

    logger.info(`Counselor escalation processed for student: ${studentId}`);
    
  } catch (error) {
    logger.error('Error handling counselor escalation:', error);
    throw error;
  }
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
 * Calculate risk level based on days since last activity
 */
function calculateRiskLevel(daysSinceLastActivity) {
  if (daysSinceLastActivity >= 7) return 'high';
  if (daysSinceLastActivity >= 3) return 'medium';
  return 'low';
}

/**
 * Trigger initial engagement workflow
 */
async function triggerInitialEngagement(student) {
  try {
    // Send welcome message via WhatsApp
    const { sendPersonalizedMessage } = require('../config/whatsapp');
    
    await sendPersonalizedMessage(
      student.phone,
      'welcome',
      {
        student_name: student.name,
        institution_name: process.env.INSTITUTION_NAME
      }
    );

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
    // Process message content for sentiment and intent
    const { analyzeStudentEmotion } = require('../config/openai');
    
    const emotionAnalysis = await analyzeStudentEmotion({
      transcript: messageData.content,
      responses: [messageData.content]
    });

    // Update student based on message sentiment
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
  try {
    const followUpMap = {
      'documents_pending': 'document_reminder',
      'payment_pending': 'payment_reminder',
      'interview_scheduled': 'interview_preparation',
      'application_complete': 'completion_confirmation',
      'application_accepted': 'acceptance_congratulations'
    };

    const workflowName = followUpMap[status];
    if (workflowName) {
      await triggerN8nWorkflow(workflowName, {
        studentId,
        status,
        triggeredBy: 'status_update'
      });
    }

    logger.info(`Status-based follow-up triggered for student: ${studentId}, status: ${status}`);
    
  } catch (error) {
    logger.error('Error triggering status-based follow-up:', error);
  }
}

module.exports = router;