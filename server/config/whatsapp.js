// server/config/whatsapp.js
const axios = require('axios');
const winston = require('winston');

// Configure logger for this module
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'whatsapp-config' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

let whatsappConfig = null;

/**
 * Initialize WhatsApp API configuration
 */
async function initializeWhatsApp() {
  try {
    // Check if WhatsApp is already initialized
    if (whatsappConfig) {
      logger.info('WhatsApp API already initialized');
      return whatsappConfig;
    }

    // Validate required environment variables
    const requiredEnvVars = [
      'WHATSAPP_API_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_VERIFY_TOKEN'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Initialize WhatsApp configuration
    whatsappConfig = {
      apiToken: process.env.WHATSAPP_API_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
      apiUrl: `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
      version: 'v18.0'
    };

    // Test the connection
    await testWhatsAppConnection();

    logger.info('WhatsApp API initialized successfully');
    return whatsappConfig;

  } catch (error) {
    logger.error('Error initializing WhatsApp API:', error);
    throw error;
  }
}

/**
 * Test WhatsApp API connection
 */
async function testWhatsAppConnection() {
  try {
    const headers = {
      'Authorization': `Bearer ${whatsappConfig.apiToken}`,
      'Content-Type': 'application/json'
    };

    // Test by getting phone number info
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${whatsappConfig.phoneNumberId}`,
      { headers }
    );

    if (response.status === 200) {
      logger.info('WhatsApp API connection test successful');
      return true;
    } else {
      throw new Error(`WhatsApp API test failed with status: ${response.status}`);
    }
  } catch (error) {
    logger.error('WhatsApp API connection test failed:', error);
    throw error;
  }
}

/**
 * Get WhatsApp configuration
 */
function getWhatsAppConfig() {
  if (!whatsappConfig) {
    throw new Error('WhatsApp API not initialized. Call initializeWhatsApp() first.');
  }
  return whatsappConfig;
}

/**
 * Send a text message via WhatsApp
 */
async function sendTextMessage(toNumber, message, context = {}) {
  try {
    const config = getWhatsAppConfig();
    
    const data = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: {
        body: message
      }
    };

    const headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(config.apiUrl, data, { headers });
    
    logger.info(`WhatsApp text message sent to ${toNumber}: ${response.data.messages[0].id}`);
    
    return {
      success: true,
      messageId: response.data.messages[0].id,
      status: response.data.messages[0].message_status,
      sentAt: new Date().toISOString(),
      context
    };

  } catch (error) {
    logger.error('Error sending WhatsApp text message:', error);
    throw {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Send a template message via WhatsApp
 */
async function sendTemplateMessage(toNumber, templateName, templateParams = [], context = {}) {
  try {
    const config = getWhatsAppConfig();
    
    const data = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en'
        },
        components: templateParams.length > 0 ? [
          {
            type: 'body',
            parameters: templateParams.map(param => ({
              type: 'text',
              text: param
            }))
          }
        ] : []
      }
    };

    const headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(config.apiUrl, data, { headers });
    
    logger.info(`WhatsApp template message sent to ${toNumber}: ${response.data.messages[0].id}`);
    
    return {
      success: true,
      messageId: response.data.messages[0].id,
      status: response.data.messages[0].message_status,
      templateName,
      sentAt: new Date().toISOString(),
      context
    };

  } catch (error) {
    logger.error('Error sending WhatsApp template message:', error);
    throw {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Send a multimedia message (image, document, etc.)
 */
async function sendMediaMessage(toNumber, mediaType, mediaUrl, caption = '', context = {}) {
  try {
    const config = getWhatsAppConfig();
    
    const data = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl,
        caption: caption
      }
    };

    const headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(config.apiUrl, data, { headers });
    
    logger.info(`WhatsApp ${mediaType} message sent to ${toNumber}: ${response.data.messages[0].id}`);
    
    return {
      success: true,
      messageId: response.data.messages[0].id,
      status: response.data.messages[0].message_status,
      mediaType,
      mediaUrl,
      sentAt: new Date().toISOString(),
      context
    };

  } catch (error) {
    logger.error(`Error sending WhatsApp ${mediaType} message:`, error);
    throw {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Send interactive button message
 */
async function sendButtonMessage(toNumber, bodyText, buttons, context = {}) {
  try {
    const config = getWhatsAppConfig();
    
    const data = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText
        },
        action: {
          buttons: buttons.map((button, index) => ({
            type: 'reply',
            reply: {
              id: button.id || `button_${index}`,
              title: button.title
            }
          }))
        }
      }
    };

    const headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(config.apiUrl, data, { headers });
    
    logger.info(`WhatsApp button message sent to ${toNumber}: ${response.data.messages[0].id}`);
    
    return {
      success: true,
      messageId: response.data.messages[0].id,
      status: response.data.messages[0].message_status,
      sentAt: new Date().toISOString(),
      context
    };

  } catch (error) {
    logger.error('Error sending WhatsApp button message:', error);
    throw {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature, verifyToken) {
  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', verifyToken)
      .update(payload)
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Handle webhook verification challenge
 */
function handleWebhookVerification(mode, token, challenge) {
  const config = getWhatsAppConfig();
  
  if (mode === 'subscribe' && token === config.verifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    return challenge;
  } else {
    logger.warn('WhatsApp webhook verification failed');
    return null;
  }
}

/**
 * Process incoming WhatsApp message
 */
async function processIncomingMessage(webhookData) {
  try {
    const { logNotification, updateStudent } = require('./firebase');
    
    // Extract message data
    const entry = webhookData.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;
    
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const contact = value.contacts[0];
      
      const messageData = {
        messageId: message.id,
        fromNumber: message.from,
        contactName: contact.profile.name,
        messageType: message.type,
        timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        content: extractMessageContent(message)
      };
      
      // Log the incoming message
      await logNotification({
        type: 'whatsapp_received',
        fromNumber: messageData.fromNumber,
        content: messageData.content,
        messageId: messageData.messageId,
        status: 'received'
      });
      
      // Process the message content for student updates
      await processMessageForStudentUpdate(messageData);
      
      logger.info(`Processed incoming WhatsApp message: ${messageData.messageId}`);
      return messageData;
    }
    
    // Handle message status updates
    if (value.statuses && value.statuses.length > 0) {
      const status = value.statuses[0];
      await handleMessageStatusUpdate(status);
    }
    
    return null;
    
  } catch (error) {
    logger.error('Error processing incoming WhatsApp message:', error);
    throw error;
  }
}

/**
 * Extract content from different message types
 */
function extractMessageContent(message) {
  switch (message.type) {
    case 'text':
      return message.text.body;
    case 'image':
      return `[Image] ${message.image.caption || ''}`;
    case 'document':
      return `[Document] ${message.document.filename || ''}`;
    case 'audio':
      return '[Audio Message]';
    case 'video':
      return `[Video] ${message.video.caption || ''}`;
    case 'button':
      return message.button.text;
    case 'interactive':
      return message.interactive.button_reply?.title || message.interactive.list_reply?.title || '[Interactive Response]';
    default:
      return `[${message.type}]`;
  }
}

/**
 * Process message content to update student information
 */
async function processMessageForStudentUpdate(messageData) {
  try {
    const { getStudentsByStatus } = require('./firebase');
    
    // Try to find student by phone number
    const students = await getStudentsByStatus('inquiry_submitted');
    const student = students.find(s => s.phone === messageData.fromNumber);
    
    if (student) {
      const { updateStudent } = require('./firebase');
      
      // Update student with message interaction
      await updateStudent(student.id, {
        lastWhatsAppMessage: messageData.content,
        lastWhatsAppInteraction: messageData.timestamp,
        responseReceived: true,
        status: 'engaged' // Update status to show engagement
      });
      
      logger.info(`Updated student ${student.id} based on WhatsApp message`);
    }
    
  } catch (error) {
    logger.error('Error processing message for student update:', error);
  }
}

/**
 * Handle message status updates (delivered, read, etc.)
 */
async function handleMessageStatusUpdate(status) {
  try {
    const { logNotification } = require('./firebase');
    
    await logNotification({
      type: 'whatsapp_status',
      messageId: status.id,
      recipientId: status.recipient_id,
      status: status.status,
      timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString()
    });
    
    logger.info(`Updated message status: ${status.id} - ${status.status}`);
    
  } catch (error) {
    logger.error('Error handling message status update:', error);
  }
}

/**
 * Create message templates for different scenarios
 */
function getMessageTemplates() {
  return {
    welcome: {
      name: 'welcome_message',
      text: 'Hi {{student_name}}! 👋 Thank you for your interest in {{institution_name}}. We\'re excited to help you with your admission process. How can we assist you today?'
    },
    followUp: {
      name: 'follow_up',
      text: 'Hi {{student_name}}, I wanted to follow up on your application to {{institution_name}}. Our records show you started the process {{days_ago}} days ago. Do you need any help completing your application? 📚'
    },
    documentReminder: {
      name: 'document_reminder',
      text: 'Hi {{student_name}}, just a friendly reminder that we\'re still missing some documents for your application. You can upload them here: {{upload_link}} 📄'
    },
    scholarshipInfo: {
      name: 'scholarship_info',
      text: 'Great news {{student_name}}! 🎉 You may be eligible for scholarships at {{institution_name}}. Would you like to learn more about financial aid opportunities?'
    },
    deadlineReminder: {
      name: 'deadline_reminder',
      text: 'Hi {{student_name}}, just a heads up that the application deadline for {{program_name}} is coming up on {{deadline_date}}. Need help finishing your application? ⏰'
    },
    callScheduled: {
      name: 'call_scheduled',
      text: 'Hi {{student_name}}, we\'ve scheduled a call for {{call_time}} to discuss your application. Our counselor will call you at {{phone_number}}. Looking forward to speaking with you! 📞'
    }
  };
}

/**
 * Send personalized message using template
 */
async function sendPersonalizedMessage(toNumber, templateKey, variables, context = {}) {
  try {
    const templates = getMessageTemplates();
    const template = templates[templateKey];
    
    if (!template) {
      throw new Error(`Template '${templateKey}' not found`);
    }
    
    // Replace variables in template
    let message = template.text;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, variables[key]);
    });
    
    return await sendTextMessage(toNumber, message, {
      ...context,
      templateUsed: templateKey,
      variables
    });
    
  } catch (error) {
    logger.error('Error sending personalized message:', error);
    throw error;
  }
}

module.exports = {
  initializeWhatsApp,
  getWhatsAppConfig,
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  sendButtonMessage,
  sendPersonalizedMessage,
  processIncomingMessage,
  handleWebhookVerification,
  verifyWebhookSignature,
  getMessageTemplates,
  testWhatsAppConnection
};