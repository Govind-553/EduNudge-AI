// server/models/Notification.js
const Joi = require('joi');

/**
 * Notification data model validation schemas
 */
class NotificationModel {
  // Base notification schema for validation
  static baseSchema = Joi.object({
    studentId: Joi.string().required()
      .messages({
        'string.empty': 'Student ID is required',
        'any.required': 'Student ID is required'
      }),
    
    type: Joi.string().valid(
      'whatsapp_message',
      'whatsapp_template',
      'whatsapp_interactive',
      'email_message',
      'sms_message',
      'voice_call',
      'ai_personalized_message',
      'bulk_message',
      'scheduled_notification',
      'reminder_notification'
    ).required(),
    
    channel: Joi.string().valid(
      'whatsapp',
      'email',
      'sms',
      'voice',
      'push'
    ).required(),
    
    recipient: Joi.string().required()
      .messages({
        'string.empty': 'Recipient is required'
      }),
    
    subject: Joi.string().allow('').default(''),
    message: Joi.string().allow('').default(''),
    
    // Template information
    templateType: Joi.string().valid(
      'welcome',
      'followUp',
      'documentReminder',
      'paymentReminder',
      'scholarshipInfo',
      'interviewScheduling',
      'applicationComplete',
      'acceptanceCongratulations',
      'custom'
    ).allow(null).default(null),
    
    templateVariables: Joi.object().default({}),
    
    // Status and tracking
    status: Joi.string().valid(
      'pending',
      'sent',
      'delivered',
      'failed',
      'cancelled',
      'scheduled'
    ).default('pending'),
    
    priority: Joi.string().valid('high', 'medium', 'low').default('medium'),
    
    // External IDs
    externalMessageId: Joi.string().allow('').default(''),
    whatsappMessageId: Joi.string().allow('').default(''),
    emailMessageId: Joi.string().allow('').default(''),
    smsMessageId: Joi.string().allow('').default(''),
    
    // Timestamps
    sentAt: Joi.string().isoDate().allow(null).default(null),
    deliveredAt: Joi.string().isoDate().allow(null).default(null),
    failedAt: Joi.string().isoDate().allow(null).default(null),
    scheduledFor: Joi.string().isoDate().allow(null).default(null),
    
    // Error information
    error: Joi.string().allow('').default(''),
    errorCode: Joi.string().allow('').default(''),
    retryCount: Joi.number().integer().min(0).default(0),
    maxRetries: Joi.number().integer().min(0).default(3),
    
    // Metadata
    metadata: Joi.object().default({}),
    context: Joi.object().default({}),
    
    // AI generation data
    aiGenerated: Joi.boolean().default(false),
    aiModel: Joi.string().allow('').default(''),
    aiPrompt: Joi.string().allow('').default(''),
    
    // Bulk operation data
    batchId: Joi.string().allow('').default(''),
    batchName: Joi.string().allow('').default(''),
    
    // User tracking
    sentBy: Joi.string().allow('').default('system'),
    sentByType: Joi.string().valid('system', 'user', 'automation', 'ai').default('system'),
    
    // Interaction tracking
    opened: Joi.boolean().default(false),
    openedAt: Joi.string().isoDate().allow(null).default(null),
    clicked: Joi.boolean().default(false),
    clickedAt: Joi.string().isoDate().allow(null).default(null),
    replied: Joi.boolean().default(false),
    repliedAt: Joi.string().isoDate().allow(null).default(null),
    
    // Cost tracking
    cost: Joi.number().precision(4).min(0).default(0),
    currency: Joi.string().length(3).default('USD')
  });

  // Schema for creating new notification
  static createSchema = this.baseSchema.fork([
    'sentAt',
    'deliveredAt',
    'failedAt',
    'externalMessageId',
    'whatsappMessageId',
    'emailMessageId',
    'smsMessageId',
    'retryCount',
    'opened',
    'openedAt',
    'clicked',
    'clickedAt',
    'replied',
    'repliedAt'
  ], (schema) => schema.optional());

  // Schema for updating notification
  static updateSchema = this.baseSchema.fork([
    'studentId',
    'type',
    'channel',
    'recipient'
  ], (schema) => schema.optional());

  // Schema for bulk notification
  static bulkSchema = Joi.object({
    notifications: Joi.array().items(this.createSchema).min(1).required(),
    batchName: Joi.string().required(),
    scheduledFor: Joi.string().isoDate().optional(),
    priority: Joi.string().valid('high', 'medium', 'low').default('medium')
  });

  // Schema for notification status update
  static statusUpdateSchema = Joi.object({
    notificationId: Joi.string().required(),
    status: Joi.string().valid(
      'sent',
      'delivered',
      'failed',
      'cancelled'
    ).required(),
    externalMessageId: Joi.string().optional(),
    timestamp: Joi.string().isoDate().optional(),
    error: Joi.string().optional(),
    metadata: Joi.object().optional()
  });

  /**
   * Validate notification data for creation
   */
  static validateCreate(data) {
    return this.createSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate notification data for update
   */
  static validateUpdate(data) {
    return this.updateSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate bulk notification data
   */
  static validateBulk(data) {
    return this.bulkSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate status update data
   */
  static validateStatusUpdate(data) {
    return this.statusUpdateSchema.validate(data, { abortEarly: false });
  }

  /**
   * Format notification data for database storage
   */
  static formatForDatabase(data) {
    const now = new Date().toISOString();
    
    return {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: now
    };
  }

  /**
   * Format notification data for API response
   */
  static formatForResponse(data) {
    return {
      ...data,
      // Add computed fields
      statusDisplay: this.getStatusDisplay(data.status),
      typeDisplay: this.getTypeDisplay(data.type),
      channelDisplay: this.getChannelDisplay(data.channel),
      priorityDisplay: this.getPriorityDisplay(data.priority),
      timeAgo: this.getTimeAgo(data.createdAt),
      isDelivered: this.isDelivered(data.status),
      isFailed: this.isFailed(data.status),
      canRetry: this.canRetry(data),
      deliveryStatus: this.getDeliveryStatus(data)
    };
  }

  /**
   * Get display text for notification status
   */
  static getStatusDisplay(status) {
    const statusMap = {
      'pending': 'Pending',
      'sent': 'Sent',
      'delivered': 'Delivered',
      'failed': 'Failed',
      'cancelled': 'Cancelled',
      'scheduled': 'Scheduled'
    };

    return statusMap[status] || status;
  }

  /**
   * Get display text for notification type
   */
  static getTypeDisplay(type) {
    const typeMap = {
      'whatsapp_message': 'WhatsApp Message',
      'whatsapp_template': 'WhatsApp Template',
      'whatsapp_interactive': 'WhatsApp Interactive',
      'email_message': 'Email',
      'sms_message': 'SMS',
      'voice_call': 'Voice Call',
      'ai_personalized_message': 'AI Personalized Message',
      'bulk_message': 'Bulk Message',
      'scheduled_notification': 'Scheduled Notification',
      'reminder_notification': 'Reminder'
    };

    return typeMap[type] || type;
  }

  /**
   * Get display text for channel
   */
  static getChannelDisplay(channel) {
    const channelMap = {
      'whatsapp': 'WhatsApp',
      'email': 'Email',
      'sms': 'SMS',
      'voice': 'Voice Call',
      'push': 'Push Notification'
    };

    return channelMap[channel] || channel;
  }

  /**
   * Get display text for priority
   */
  static getPriorityDisplay(priority) {
    const priorityMap = {
      'high': 'High Priority',
      'medium': 'Medium Priority',
      'low': 'Low Priority'
    };

    return priorityMap[priority] || priority;
  }

  /**
   * Get human readable time ago
   */
  static getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  }

  /**
   * Check if notification is delivered
   */
  static isDelivered(status) {
    return status === 'delivered' || status === 'sent';
  }

  /**
   * Check if notification failed
   */
  static isFailed(status) {
    return status === 'failed';
  }

  /**
   * Check if notification can be retried
   */
  static canRetry(notificationData) {
    if (notificationData.status !== 'failed') return false;
    if (notificationData.retryCount >= notificationData.maxRetries) return false;
    
    // Don't retry if failed more than 24 hours ago
    if (notificationData.failedAt) {
      const failedDate = new Date(notificationData.failedAt);
      const now = new Date();
      const hoursSinceFailed = (now - failedDate) / (1000 * 60 * 60);
      if (hoursSinceFailed > 24) return false;
    }
    
    return true;
  }

  /**
   * Get detailed delivery status
   */
  static getDeliveryStatus(notificationData) {
    const status = {
      status: notificationData.status,
      message: '',
      timestamp: null,
      canRetry: this.canRetry(notificationData)
    };

    switch (notificationData.status) {
      case 'pending':
        status.message = 'Notification is queued for sending';
        break;
      case 'sent':
        status.message = 'Notification has been sent';
        status.timestamp = notificationData.sentAt;
        break;
      case 'delivered':
        status.message = 'Notification has been delivered';
        status.timestamp = notificationData.deliveredAt;
        break;
      case 'failed':
        status.message = notificationData.error || 'Notification delivery failed';
        status.timestamp = notificationData.failedAt;
        break;
      case 'cancelled':
        status.message = 'Notification was cancelled';
        break;
      case 'scheduled':
        status.message = `Scheduled for ${notificationData.scheduledFor}`;
        status.timestamp = notificationData.scheduledFor;
        break;
    }

    return status;
  }

  /**
   * Calculate notification statistics
   */
  static calculateNotificationStatistics(notifications) {
    if (!notifications || notifications.length === 0) {
      return {
        totalNotifications: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        pendingCount: 0,
        deliveryRate: 0,
        failureRate: 0,
        byChannel: {},
        byType: {},
        byPriority: {},
        totalCost: 0
      };
    }

    const stats = {
      totalNotifications: notifications.length,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      pendingCount: 0,
      scheduledCount: 0,
      cancelledCount: 0,
      byChannel: {},
      byType: {},
      byPriority: {},
      totalCost: 0
    };

    notifications.forEach(notification => {
      // Status counts
      switch (notification.status) {
        case 'sent':
          stats.sentCount++;
          break;
        case 'delivered':
          stats.deliveredCount++;
          break;
        case 'failed':
          stats.failedCount++;
          break;
        case 'pending':
          stats.pendingCount++;
          break;
        case 'scheduled':
          stats.scheduledCount++;
          break;
        case 'cancelled':
          stats.cancelledCount++;
          break;
      }

      // Channel breakdown
      stats.byChannel[notification.channel] = (stats.byChannel[notification.channel] || 0) + 1;

      // Type breakdown
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;

      // Priority breakdown
      stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;

      // Cost calculation
      stats.totalCost += notification.cost || 0;
    });

    // Calculate rates
    const deliveredOrSent = stats.deliveredCount + stats.sentCount;
    stats.deliveryRate = stats.totalNotifications > 0 
      ? Math.round((deliveredOrSent / stats.totalNotifications) * 100)
      : 0;

    stats.failureRate = stats.totalNotifications > 0 
      ? Math.round((stats.failedCount / stats.totalNotifications) * 100)
      : 0;

    return stats;
  }

  /**
   * Get template variables for a notification type
   */
  static getTemplateVariables(templateType) {
    const templateVariables = {
      'welcome': [
        'student_name',
        'institution_name',
        'contact_phone',
        'contact_email',
        'website_url'
      ],
      'followUp': [
        'student_name',
        'program_name',
        'contact_phone'
      ],
      'documentReminder': [
        'student_name',
        'program_name',
        'missing_documents',
        'document_portal_url',
        'contact_phone'
      ],
      'paymentReminder': [
        'student_name',
        'program_name',
        'payment_amount',
        'payment_url',
        'contact_phone',
        'contact_email'
      ],
      'scholarshipInfo': [
        'student_name',
        'program_name',
        'financial_aid_phone',
        'scholarship_url'
      ],
      'interviewScheduling': [
        'student_name',
        'program_name',
        'available_dates',
        'scheduling_url',
        'contact_phone'
      ],
      'applicationComplete': [
        'student_name',
        'program_name',
        'review_timeline',
        'contact_phone',
        'contact_email',
        'institution_name'
      ],
      'acceptanceCongratulations': [
        'student_name',
        'program_name',
        'enrollment_url',
        'orientation_date',
        'contact_phone',
        'institution_name'
      ]
    };

    return templateVariables[templateType] || [];
  }

  /**
   * Validate template variables
   */
  static validateTemplateVariables(templateType, variables) {
    const requiredVariables = this.getTemplateVariables(templateType);
    const missingVariables = [];

    requiredVariables.forEach(variable => {
      if (!variables[variable]) {
        missingVariables.push(variable);
      }
    });

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
      requiredVariables
    };
  }

  /**
   * Get cost estimate for notification
   */
  static getCostEstimate(channel, type, recipientCount = 1) {
    // Cost estimates in USD
    const costPerChannel = {
      'whatsapp': 0.005,  // $0.005 per message
      'sms': 0.01,        // $0.01 per SMS
      'email': 0.001,     // $0.001 per email
      'voice': 0.05,      // $0.05 per minute (estimated)
      'push': 0.0001      // $0.0001 per push notification
    };

    const baseCost = costPerChannel[channel] || 0;
    return baseCost * recipientCount;
  }

  /**
   * Get next retry time for failed notification
   */
  static getNextRetryTime(notificationData) {
    if (!this.canRetry(notificationData)) {
      return null;
    }

    // Exponential backoff: 1min, 5min, 15min, 1hour
    const retryDelays = [1, 5, 15, 60]; // minutes
    const delayMinutes = retryDelays[notificationData.retryCount] || 60;
    
    const nextRetry = new Date();
    nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
    
    return nextRetry.toISOString();
  }
}

module.exports = NotificationModel;