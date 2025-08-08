// server/services/notifications.js
const winston = require('winston');
const { 
  sendPersonalizedMessage,
  sendTextMessage,
  sendInteractiveMessage,
  sendBulkMessages,
  MESSAGE_TEMPLATES
} = require('../config/whatsapp');
const { logNotification } = require('../config/firebase');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'notifications' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Notifications Service - Multi-channel notification management
 */
class NotificationsService {
  /**
   * Send WhatsApp message using templates or custom text
   */
  static async sendWhatsAppMessage(messageData) {
    try {
      const {
        to,
        studentId,
        message,
        templateType,
        variables = {},
        customMessage,
        priority = 'medium'
      } = messageData;

      logger.info(`Sending WhatsApp message to: ${to}`);

      let result;

      // Determine message type and send accordingly
      if (customMessage) {
        result = await sendTextMessage(to, customMessage);
      } else if (templateType && MESSAGE_TEMPLATES[templateType]) {
        result = await sendPersonalizedMessage(to, templateType, variables);
      } else if (message) {
        result = await sendTextMessage(to, message);
      } else {
        throw new Error('No message content provided');
      }

      // Log notification in database
      await logNotification({
        type: 'whatsapp_message',
        studentId,
        channel: 'whatsapp',
        recipient: to,
        message: customMessage || message,
        templateType,
        templateVariables: variables,
        priority,
        status: result.success ? 'sent' : 'failed',
        externalMessageId: result.messageId,
        error: result.error,
        sentAt: result.success ? new Date().toISOString() : null,
        failedAt: !result.success ? new Date().toISOString() : null
      });

      return {
        success: result.success,
        messageId: result.messageId,
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      
      // Log failed notification
      if (messageData.studentId) {
        await logNotification({
          type: 'whatsapp_message',
          studentId: messageData.studentId,
          channel: 'whatsapp',
          recipient: messageData.to,
          status: 'failed',
          error: error.message,
          failedAt: new Date().toISOString()
        });
      }

      return {
        success: false,
        error: error.message,
        sentAt: new Date().toISOString()
      };
    }
  }

  /**
   * Send interactive WhatsApp message with buttons
   */
  static async sendInteractiveWhatsAppMessage(messageData) {
    try {
      const {
        to,
        studentId,
        message,
        buttons = [],
        header = null,
        footer = null,
        priority = 'medium'
      } = messageData;

      logger.info(`Sending interactive WhatsApp message to: ${to}`);

      if (buttons.length === 0 || buttons.length > 3) {
        throw new Error('Interactive messages must have 1-3 buttons');
      }

      const result = await sendInteractiveMessage(to, {
        message,
        buttons,
        header,
        footer
      });

      // Log notification
      await logNotification({
        type: 'whatsapp_interactive',
        studentId,
        channel: 'whatsapp',
        recipient: to,
        message,
        metadata: { buttons, header, footer },
        priority,
        status: result.success ? 'sent' : 'failed',
        externalMessageId: result.messageId,
        error: result.error,
        sentAt: result.success ? new Date().toISOString() : null,
        failedAt: !result.success ? new Date().toISOString() : null
      });

      return {
        success: result.success,
        messageId: result.messageId,
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error sending interactive WhatsApp message:', error);
      return {
        success: false,
        error: error.message,
        sentAt: new Date().toISOString()
      };
    }
  }

  /**
   * Send email notification (placeholder implementation)
   */
  static async sendEmailNotification(emailData) {
    try {
      const {
        to,
        studentId,
        subject,
        message,
        templateType,
        variables = {},
        priority = 'medium'
      } = emailData;

      logger.info(`Sending email to: ${to}`);

      // Placeholder email implementation
      // In production, integrate with email service like SendGrid, AWS SES, etc.
      
      const emailContent = this.processEmailTemplate(message, templateType, variables);
      
      // Simulate email sending
      const result = await this.simulateEmailSending(to, subject, emailContent);

      // Log notification
      await logNotification({
        type: 'email_message',
        studentId,
        channel: 'email',
        recipient: to,
        subject,
        message: emailContent,
        templateType,
        templateVariables: variables,
        priority,
        status: result.success ? 'sent' : 'failed',
        externalMessageId: result.messageId,
        error: result.error,
        sentAt: result.success ? new Date().toISOString() : null,
        failedAt: !result.success ? new Date().toISOString() : null
      });

      return {
        success: result.success,
        messageId: result.messageId,
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error sending email notification:', error);
      return {
        success: false,
        error: error.message,
        sentAt: new Date().toISOString()
      };
    }
  }

  /**
   * Send SMS notification (placeholder implementation)
   */
  static async sendSMSNotification(smsData) {
    try {
      const {
        to,
        studentId,
        message,
        priority = 'medium'
      } = smsData;

      logger.info(`Sending SMS to: ${to}`);

      // Placeholder SMS implementation
      // In production, integrate with SMS service like Twilio, AWS SNS, etc.
      
      const result = await this.simulateSMSSending(to, message);

      // Log notification
      await logNotification({
        type: 'sms_message',
        studentId,
        channel: 'sms',
        recipient: to,
        message,
        priority,
        status: result.success ? 'sent' : 'failed',
        externalMessageId: result.messageId,
        error: result.error,
        sentAt: result.success ? new Date().toISOString() : null,
        failedAt: !result.success ? new Date().toISOString() : null
      });

      return {
        success: result.success,
        messageId: result.messageId,
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error sending SMS notification:', error);
      return {
        success: false,
        error: error.message,
        sentAt: new Date().toISOString()
      };
    }
  }

  /**
   * Send bulk notifications to multiple recipients
   */
  static async sendBulkNotifications(bulkData) {
    try {
      const {
        recipients = [],
        batchName = 'unnamed_batch',
        priority = 'medium'
      } = bulkData;

      logger.info(`Sending bulk notifications: ${recipients.length} recipients`);

      if (recipients.length === 0) {
        throw new Error('No recipients provided');
      }

      if (recipients.length > 100) {
        throw new Error('Maximum 100 recipients allowed per batch');
      }

      const results = [];
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      for (const recipient of recipients) {
        try {
          const {
            studentId,
            channel = 'whatsapp',
            templateType,
            variables = {},
            customMessage,
            to,
            subject // For email
          } = recipient;

          let result;

          switch (channel) {
            case 'whatsapp':
              result = await this.sendWhatsAppMessage({
                to,
                studentId,
                templateType,
                variables,
                customMessage,
                priority
              });
              break;

            case 'email':
              result = await this.sendEmailNotification({
                to,
                studentId,
                subject,
                message: customMessage,
                templateType,
                variables,
                priority
              });
              break;

            case 'sms':
              result = await this.sendSMSNotification({
                to,
                studentId,
                message: customMessage,
                priority
              });
              break;

            default:
              throw new Error(`Unsupported channel: ${channel}`);
          }

          results.push({
            studentId,
            channel,
            to,
            success: result.success,
            messageId: result.messageId,
            error: result.error
          });

          // Add delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          results.push({
            studentId: recipient.studentId,
            channel: recipient.channel || 'whatsapp',
            to: recipient.to,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      // Log bulk operation
      await logNotification({
        type: 'bulk_message',
        batchId,
        batchName,
        totalRecipients: recipients.length,
        successCount,
        failCount,
        priority,
        status: 'completed',
        results,
        completedAt: new Date().toISOString()
      });

      logger.info(`Bulk notifications completed: ${successCount} successful, ${failCount} failed`);

      return {
        success: true,
        batchId,
        batchName,
        totalSent: recipients.length,
        successCount,
        failCount,
        results,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      return {
        success: false,
        error: error.message,
        sentAt: new Date().toISOString()
      };
    }
  }

  /**
   * Schedule notification for later delivery
   */
  static async scheduleNotification(notificationData, scheduleTime) {
    try {
      const {
        studentId,
        channel,
        message,
        templateType,
        variables = {},
        priority = 'medium'
      } = notificationData;

      logger.info(`Scheduling notification for student: ${studentId} at ${scheduleTime}`);

      const scheduledNotification = {
        studentId,
        channel,
        message,
        templateType,
        variables,
        priority,
        scheduledFor: new Date(scheduleTime).toISOString(),
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };

      // In a real implementation, this would use a job queue like Bull or Agenda
      // For now, log the scheduled notification
      await logNotification({
        type: 'scheduled_notification',
        ...scheduledNotification
      });

      return {
        success: true,
        scheduledId: `scheduled_${Date.now()}`,
        scheduledFor: scheduledNotification.scheduledFor,
        status: 'scheduled'
      };

    } catch (error) {
      logger.error('Error scheduling notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available message templates
   */
  static getAvailableTemplates() {
    try {
      const templates = Object.keys(MESSAGE_TEMPLATES).map(templateName => ({
        name: templateName,
        displayName: templateName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        variables: this.extractTemplateVariables(MESSAGE_TEMPLATES[templateName].text),
        description: MESSAGE_TEMPLATES[templateName].description || '',
        category: MESSAGE_TEMPLATES[templateName].category || 'general'
      }));

      return {
        success: true,
        templates
      };

    } catch (error) {
      logger.error('Error getting available templates:', error);
      return {
        success: false,
        error: error.message,
        templates: []
      };
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStatistics(dateRange = 7) {
    try {
      logger.info(`Getting notification statistics for ${dateRange} days`);

      // This would typically query the database for actual statistics
      // For now, return mock data
      const stats = {
        totalSent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        byChannel: {
          whatsapp: { sent: 0, delivered: 0, failed: 0 },
          email: { sent: 0, delivered: 0, failed: 0 },
          sms: { sent: 0, delivered: 0, failed: 0 }
        },
        byTemplate: {},
        trends: []
      };

      return {
        success: true,
        dateRange,
        statistics: stats,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error getting notification statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retry failed notifications
   */
  static async retryFailedNotifications(filters = {}) {
    try {
      logger.info('Retrying failed notifications');

      // Get failed notifications from database
      const failedNotifications = await this.getFailedNotifications(filters);

      if (failedNotifications.length === 0) {
        return {
          success: true,
          message: 'No failed notifications to retry',
          retriedCount: 0
        };
      }

      const results = [];

      for (const notification of failedNotifications) {
        try {
          let result;

          switch (notification.channel) {
            case 'whatsapp':
              result = await this.sendWhatsAppMessage({
                to: notification.recipient,
                studentId: notification.studentId,
                message: notification.message,
                templateType: notification.templateType,
                variables: notification.templateVariables
              });
              break;

            case 'email':
              result = await this.sendEmailNotification({
                to: notification.recipient,
                studentId: notification.studentId,
                subject: notification.subject,
                message: notification.message,
                templateType: notification.templateType,
                variables: notification.templateVariables
              });
              break;

            case 'sms':
              result = await this.sendSMSNotification({
                to: notification.recipient,
                studentId: notification.studentId,
                message: notification.message
              });
              break;

            default:
              throw new Error(`Unsupported channel: ${notification.channel}`);
          }

          results.push({
            notificationId: notification.id,
            success: result.success,
            error: result.error
          });

        } catch (error) {
          results.push({
            notificationId: notification.id,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      logger.info(`Retry completed: ${successCount}/${failedNotifications.length} successful`);

      return {
        success: true,
        totalAttempted: failedNotifications.length,
        successCount,
        failCount: failedNotifications.length - successCount,
        results
      };

    } catch (error) {
      logger.error('Error retrying failed notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods

  static extractTemplateVariables(templateText) {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;

    while ((match = variableRegex.exec(templateText)) !== null) {
      variables.push(match[1]);
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  static processEmailTemplate(message, templateType, variables) {
    if (!templateType || !MESSAGE_TEMPLATES[templateType]) {
      return message;
    }

    let processedMessage = MESSAGE_TEMPLATES[templateType].text;

    // Replace variables in template
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedMessage = processedMessage.replace(regex, variables[key]);
    });

    return processedMessage;
  }

  // Placeholder implementations for external services
  static async simulateEmailSending(to, subject, content) {
    // Simulate email sending with random success/failure
    const success = Math.random() > 0.1; // 90% success rate
    
    if (success) {
      return {
        success: true,
        messageId: `email_${Date.now()}`,
        to
      };
    } else {
      return {
        success: false,
        error: 'Email service temporarily unavailable',
        to
      };
    }
  }

  static async simulateSMSSending(to, message) {
    // Simulate SMS sending with random success/failure
    const success = Math.random() > 0.05; // 95% success rate
    
    if (success) {
      return {
        success: true,
        messageId: `sms_${Date.now()}`,
        to
      };
    } else {
      return {
        success: false,
        error: 'SMS service temporarily unavailable',
        to
      };
    }
  }

  static async getFailedNotifications(filters) {
    // This would query the database for failed notifications
    // For now, return empty array
    return [];
  }
}

module.exports = NotificationsService;