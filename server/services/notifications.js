// server/services/notifications.js
const winston = require('winston');
const axios = require('axios');

// Import configuration modules
const { 
  sendPersonalizedMessage, 
  sendTextMessage, 
  sendBulkMessages,
  MESSAGE_TEMPLATES
} = require('../config/whatsapp');

const { generateFollowUpMessage } = require('../config/openai');
const { logNotification } = require('../config/firebase');
const StudentService = require('./studentService');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'notification-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Notification Service - Business logic for all notification operations
 */
class NotificationService {
  /**
   * Send notification to a student
   */
  static async sendNotificationToStudent(studentId, options = {}) {
    try {
      const {
        channel = 'whatsapp',
        templateType = 'followUp',
        customMessage = null,
        variables = {},
        priority = 'normal'
      } = options;

      logger.info(`Sending ${channel} notification to student: ${studentId}`);

      // Get student details
      const student = await StudentService.getStudentById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      // Merge default variables with provided ones
      const allVariables = {
        student_name: student.name,
        program_name: student.inquiryType || 'our programs',
        institution_name: process.env.INSTITUTION_NAME || 'Our Institution',
        contact_phone: process.env.CONTACT_PHONE || '',
        contact_email: process.env.CONTACT_EMAIL || '',
        ...variables
      };

      let result;

      switch (channel) {
        case 'whatsapp':
          result = await this.sendWhatsAppNotification(student, {
            templateType,
            customMessage,
            variables: allVariables
          });
          break;

        case 'email':
          result = await this.sendEmailNotification(student, {
            templateType,
            customMessage,
            variables: allVariables
          });
          break;

        case 'sms':
          result = await this.sendSMSNotification(student, {
            customMessage,
            variables: allVariables
          });
          break;

        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }

      // Log the notification
      await logNotification({
        type: `${channel}_notification`,
        studentId,
        channel,
        templateType,
        customMessage,
        variables: allVariables,
        priority,
        status: result.success ? 'sent' : 'failed',
        messageId: result.messageId,
        error: result.error,
        sentAt: new Date().toISOString()
      });

      // Update student activity
      await StudentService.updateStudentActivity(studentId, `${channel}_notification`);

      return result;

    } catch (error) {
      logger.error(`Error sending notification to student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Send WhatsApp notification
   */
  static async sendWhatsAppNotification(student, options) {
    try {
      const { templateType, customMessage, variables } = options;

      let result;

      if (customMessage) {
        // Send custom message
        result = await sendTextMessage(student.phone, customMessage);
      } else if (templateType) {
        // Send template message
        result = await sendPersonalizedMessage(student.phone, templateType, variables);
      } else {
        throw new Error('Either templateType or customMessage is required');
      }

      return result;

    } catch (error) {
      logger.error('Error sending WhatsApp notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email notification (placeholder implementation)
   */
  static async sendEmailNotification(student, options) {
    try {
      const { templateType, customMessage, variables } = options;

      // For now, simulate email sending
      logger.info(`Email notification would be sent to: ${student.email}`);

      // In a real implementation, integrate with email service like SendGrid, AWS SES, etc.
      return {
        success: true,
        messageId: `email_${Date.now()}`,
        to: student.email
      };

    } catch (error) {
      logger.error('Error sending email notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send SMS notification (placeholder implementation)
   */
  static async sendSMSNotification(student, options) {
    try {
      const { customMessage } = options;

      // For now, simulate SMS sending
      logger.info(`SMS notification would be sent to: ${student.phone}`);

      // In a real implementation, integrate with SMS service like Twilio, AWS SNS, etc.
      return {
        success: true,
        messageId: `sms_${Date.now()}`,
        to: student.phone
      };

    } catch (error) {
      logger.error('Error sending SMS notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send AI-generated personalized notification
   */
  static async sendAIPersonalizedNotification(studentId, options = {}) {
    try {
      const {
        channel = 'whatsapp',
        callAnalysis = null,
        context = {}
      } = options;

      logger.info(`Sending AI personalized notification to student: ${studentId}`);

      // Get student details
      const student = await StudentService.getStudentById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      // Generate personalized message using AI
      const aiMessage = await generateFollowUpMessage(student, callAnalysis, channel);

      // Send the AI-generated message
      const result = await this.sendNotificationToStudent(studentId, {
        channel,
        customMessage: aiMessage.message,
        priority: 'high'
      });

      // Log AI generation
      await logNotification({
        type: 'ai_personalized_notification',
        studentId,
        channel,
        aiGeneratedMessage: aiMessage.message,
        callAnalysis,
        context,
        status: result.success ? 'sent' : 'failed',
        messageId: result.messageId,
        error: result.error,
        sentAt: new Date().toISOString()
      });

      return {
        ...result,
        aiGeneratedMessage: aiMessage.message
      };

    } catch (error) {
      logger.error(`Error sending AI personalized notification to student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  static async sendBulkNotifications(notifications) {
    try {
      logger.info(`Sending bulk notifications: ${notifications.length} recipients`);

      const results = [];

      for (const notification of notifications) {
        try {
          const {
            studentId,
            channel = 'whatsapp',
            templateType = 'followUp',
            customMessage,
            variables = {},
            priority = 'normal'
          } = notification;

          const result = await this.sendNotificationToStudent(studentId, {
            channel,
            templateType,
            customMessage,
            variables,
            priority
          });

          results.push({
            studentId,
            success: result.success,
            messageId: result.messageId,
            error: result.error
          });

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          results.push({
            studentId: notification.studentId,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info(`Bulk notifications completed: ${successCount}/${notifications.length} successful`);

      return {
        totalSent: notifications.length,
        successCount,
        failedCount: notifications.length - successCount,
        results
      };

    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Send follow-up notification based on student status
   */
  static async sendStatusBasedFollowUp(studentId) {
    try {
      logger.info(`Sending status-based follow-up to student: ${studentId}`);

      const student = await StudentService.getStudentById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      let templateType = 'followUp';
      let priority = 'normal';
      let variables = {};

      // Determine message type based on student status
      switch (student.status) {
        case 'inquiry_submitted':
          templateType = 'welcome';
          priority = 'high';
          break;

        case 'documents_pending':
          templateType = 'documentReminder';
          priority = 'medium';
          variables.missing_documents = 'Required documents for your application';
          break;

        case 'application_completed':
          templateType = 'applicationComplete';
          priority = 'low';
          variables.review_timeline = '5-7 business days';
          break;

        case 'dropout_risk':
          templateType = 'followUp';
          priority = 'high';
          break;

        default:
          templateType = 'followUp';
      }

      return await this.sendNotificationToStudent(studentId, {
        templateType,
        variables,
        priority
      });

    } catch (error) {
      logger.error(`Error sending status-based follow-up to student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Send reminder notifications
   */
  static async sendReminderNotifications(reminderType, criteria = {}) {
    try {
      logger.info(`Sending ${reminderType} reminder notifications`);

      let students = [];

      switch (reminderType) {
        case 'document_deadline':
          students = await this.getStudentsForDocumentReminder(criteria);
          break;

        case 'payment_due':
          students = await this.getStudentsForPaymentReminder(criteria);
          break;

        case 'enrollment_deadline':
          students = await this.getStudentsForEnrollmentReminder(criteria);
          break;

        default:
          throw new Error(`Unknown reminder type: ${reminderType}`);
      }

      if (students.length === 0) {
        logger.info(`No students found for ${reminderType} reminders`);
        return { totalSent: 0, successCount: 0, results: [] };
      }

      // Prepare bulk notifications
      const notifications = students.map(student => ({
        studentId: student.id,
        templateType: this.getTemplateForReminderType(reminderType),
        priority: 'medium',
        variables: this.getVariablesForReminder(student, reminderType)
      }));

      return await this.sendBulkNotifications(notifications);

    } catch (error) {
      logger.error(`Error sending ${reminderType} reminders:`, error);
      throw error;
    }
  }

  /**
   * Get students for document reminder
   */
  static async getStudentsForDocumentReminder(criteria) {
    const { daysOverdue = 3 } = criteria;
    
    // Implementation would query database for students with pending documents
    // For now, return empty array
    return [];
  }

  /**
   * Get students for payment reminder
   */
  static async getStudentsForPaymentReminder(criteria) {
    const { daysUntilDue = 7 } = criteria;
    
    // Implementation would query database for students with payment due
    // For now, return empty array
    return [];
  }

  /**
   * Get students for enrollment reminder
   */
  static async getStudentsForEnrollmentReminder(criteria) {
    const { daysUntilDeadline = 14 } = criteria;
    
    // Implementation would query database for students with enrollment deadline
    // For now, return empty array
    return [];
  }

  /**
   * Get template for reminder type
   */
  static getTemplateForReminderType(reminderType) {
    const templateMap = {
      'document_deadline': 'documentReminder',
      'payment_due': 'paymentReminder',
      'enrollment_deadline': 'enrollmentDeadline'
    };

    return templateMap[reminderType] || 'followUp';
  }

  /**
   * Get variables for reminder
   */
  static getVariablesForReminder(student, reminderType) {
    const baseVariables = {
      student_name: student.name,
      program_name: student.inquiryType
    };

    switch (reminderType) {
      case 'document_deadline':
        return {
          ...baseVariables,
          missing_documents: 'Required application documents',
          document_portal_url: process.env.DOCUMENT_PORTAL_URL || '#'
        };

      case 'payment_due':
        return {
          ...baseVariables,
          payment_amount: student.paymentAmount || 'Application fee',
          payment_url: process.env.PAYMENT_URL || '#'
        };

      case 'enrollment_deadline':
        return {
          ...baseVariables,
          enrollment_deadline: student.enrollmentDeadline || 'Soon',
          enrollment_url: process.env.ENROLLMENT_URL || '#'
        };

      default:
        return baseVariables;
    }
  }

  /**
   * Get notification history for a student
   */
  static async getNotificationHistory(studentId, limit = 50) {
    try {
      logger.info(`Getting notification history for student: ${studentId}`);

      // This would typically query your database for notification history
      // For now, return a placeholder response
      return {
        studentId,
        notifications: [],
        totalCount: 0
      };

    } catch (error) {
      logger.error(`Error getting notification history for student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Get available message templates
   */
  static getAvailableTemplates() {
    return Object.keys(MESSAGE_TEMPLATES).map(templateName => ({
      name: templateName,
      description: templateName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      variables: this.extractTemplateVariables(MESSAGE_TEMPLATES[templateName].text)
    }));
  }

  /**
   * Extract variables from template text
   */
  static extractTemplateVariables(templateText) {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;

    while ((match = variableRegex.exec(templateText)) !== null) {
      variables.push(match[1]);
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  /**
   * Schedule notification for later
   */
  static async scheduleNotification(studentId, options, scheduleTime) {
    try {
      logger.info(`Scheduling notification for student: ${studentId} at ${scheduleTime}`);

      // This would typically use a job queue like Bull or Agenda
      // For now, just log the scheduled notification
      
      const notificationData = {
        studentId,
        options,
        scheduleTime: new Date(scheduleTime).toISOString(),
        createdAt: new Date().toISOString()
      };

      // Log scheduled notification
      await logNotification({
        type: 'scheduled_notification',
        studentId,
        scheduledFor: notificationData.scheduleTime,
        options,
        status: 'scheduled',
        createdAt: notificationData.createdAt
      });

      return {
        success: true,
        scheduledId: `scheduled_${Date.now()}`,
        scheduleTime: notificationData.scheduleTime
      };

    } catch (error) {
      logger.error(`Error scheduling notification for student ${studentId}:`, error);
      throw error;
    }
  }
}

module.exports = NotificationService;