// server/models/Call.js
const Joi = require('joi');

/**
 * Call data model validation schemas
 */
class CallModel {
  // Base call schema for validation
  static baseSchema = Joi.object({
    studentId: Joi.string().required()
      .messages({
        'string.empty': 'Student ID is required',
        'any.required': 'Student ID is required'
      }),
    
    retellCallId: Joi.string().allow(null).default(null),
    
    toNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required()
      .messages({
        'string.pattern.base': 'Please provide a valid international phone number',
        'string.empty': 'Phone number is required'
      }),
    
    fromNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
    
    status: Joi.string().valid(
      'initiated',
      'in_progress',
      'completed',
      'failed',
      'no_answer',
      'busy',
      'cancelled'
    ).default('initiated'),
    
    priority: Joi.string().valid('high', 'medium', 'low').default('medium'),
    
    reason: Joi.string().valid(
      'follow_up',
      'document_reminder',
      'payment_reminder',
      'high_risk_intervention',
      'welcome_call',
      'schedule_interview',
      'enrollment_reminder',
      'general_inquiry'
    ).default('follow_up'),
    
    callType: Joi.string().valid(
      'automated',
      'manual',
      'retry',
      'escalation'
    ).default('automated'),
    
    // Timestamps
    initiatedAt: Joi.string().isoDate().optional(),
    startTime: Joi.string().isoDate().optional(),
    endTime: Joi.string().isoDate().optional(),
    completedAt: Joi.string().isoDate().optional(),
    cancelledAt: Joi.string().isoDate().optional(),
    
    // Call metrics
    duration: Joi.number().integer().min(0).default(0),
    
    // Content
    transcript: Joi.string().allow('').default(''),
    voiceScript: Joi.string().allow('').default(''),
    
    // Analysis data
    emotionAnalysis: Joi.object().allow(null).default(null),
    retellAnalysis: Joi.object().allow(null).default(null),
    
    // Metadata
    metadata: Joi.object().default({}),
    
    // Retry information
    originalCallId: Joi.string().allow(null).default(null),
    retried: Joi.boolean().default(false),
    retriedAt: Joi.string().isoDate().allow(null).default(null),
    retryCallId: Joi.string().allow(null).default(null),
    retryReason: Joi.string().allow('').default(''),
    
    // Error information
    error: Joi.string().allow('').default(''),
    failedAt: Joi.string().isoDate().allow(null).default(null),
    
    // Agent information
    agentId: Joi.string().allow('').default(''),
    agentConfig: Joi.object().default({})
  });

  // Schema for creating new call
  static createSchema = this.baseSchema.fork([
    'retellCallId',
    'startTime',
    'endTime',
    'completedAt',
    'cancelledAt',
    'duration',
    'transcript',
    'emotionAnalysis',
    'retellAnalysis',
    'retriedAt',
    'retryCallId',
    'failedAt'
  ], (schema) => schema.optional());

  // Schema for updating call
  static updateSchema = this.baseSchema.fork([
    'studentId',
    'toNumber'
  ], (schema) => schema.optional());

  // Schema for call completion data
  static completionSchema = Joi.object({
    callId: Joi.string().required(),
    status: Joi.string().valid(
      'completed',
      'failed',
      'no_answer',
      'busy',
      'cancelled'
    ).required(),
    startTime: Joi.string().isoDate().optional(),
    endTime: Joi.string().isoDate().optional(),
    duration: Joi.number().integer().min(0).optional(),
    transcript: Joi.string().allow('').optional(),
    analysis: Joi.object().optional()
  });

  /**
   * Validate call data for creation
   */
  static validateCreate(data) {
    return this.createSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate call data for update
   */
  static validateUpdate(data) {
    return this.updateSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate call completion data
   */
  static validateCompletion(data) {
    return this.completionSchema.validate(data, { abortEarly: false });
  }

  /**
   * Format call data for database storage
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
   * Format call data for API response
   */
  static formatForResponse(data) {
    const formatted = {
      ...data,
      // Add computed fields
      durationFormatted: this.formatDuration(data.duration),
      statusDisplay: this.getStatusDisplay(data.status),
      priorityDisplay: this.getPriorityDisplay(data.priority),
      reasonDisplay: this.getReasonDisplay(data.reason),
      wasSuccessful: this.isSuccessfulCall(data.status),
      needsRetry: this.shouldRetry(data),
      callQuality: this.assessCallQuality(data)
    };

    // Remove sensitive data for non-admin users
    if (data.hideTranscript) {
      delete formatted.transcript;
      delete formatted.voiceScript;
    }

    return formatted;
  }

  /**
   * Format call duration to human readable format
   */
  static formatDuration(durationInSeconds) {
    if (!durationInSeconds || durationInSeconds === 0) {
      return 'N/A';
    }

    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
  }

  /**
   * Get display text for call status
   */
  static getStatusDisplay(status) {
    const statusMap = {
      'initiated': 'Call Initiated',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'failed': 'Failed',
      'no_answer': 'No Answer',
      'busy': 'Busy',
      'cancelled': 'Cancelled'
    };

    return statusMap[status] || status;
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
   * Get display text for call reason
   */
  static getReasonDisplay(reason) {
    const reasonMap = {
      'follow_up': 'Follow-up Call',
      'document_reminder': 'Document Reminder',
      'payment_reminder': 'Payment Reminder',
      'high_risk_intervention': 'High Risk Intervention',
      'welcome_call': 'Welcome Call',
      'schedule_interview': 'Schedule Interview',
      'enrollment_reminder': 'Enrollment Reminder',
      'general_inquiry': 'General Inquiry'
    };

    return reasonMap[reason] || reason;
  }

  /**
   * Check if call was successful
   */
  static isSuccessfulCall(status) {
    return status === 'completed';
  }

  /**
   * Determine if call should be retried
   */
  static shouldRetry(callData) {
    if (callData.retried) {
      return false; // Already retried
    }

    const retryableStatuses = ['failed', 'no_answer', 'busy'];
    
    if (!retryableStatuses.includes(callData.status)) {
      return false;
    }

    // Don't retry if too many attempts already made
    if (callData.metadata?.previousAttempts >= 3) {
      return false;
    }

    return true;
  }

  /**
   * Assess call quality based on various factors
   */
  static assessCallQuality(callData) {
    let score = 0;
    let factors = [];

    // Duration factor
    if (callData.duration > 120) { // 2+ minutes
      score += 3;
      factors.push('Good duration');
    } else if (callData.duration > 30) { // 30+ seconds
      score += 2;
      factors.push('Decent duration');
    } else if (callData.duration > 0) {
      score += 1;
      factors.push('Brief call');
    }

    // Status factor
    if (callData.status === 'completed') {
      score += 3;
      factors.push('Call completed');
    } else if (callData.status === 'no_answer') {
      score += 0;
      factors.push('No answer');
    } else if (callData.status === 'failed') {
      score -= 1;
      factors.push('Call failed');
    }

    // Emotion analysis factor
    if (callData.emotionAnalysis) {
      if (callData.emotionAnalysis.emotion === 'happy' || callData.emotionAnalysis.emotion === 'excited') {
        score += 2;
        factors.push('Positive emotion');
      } else if (callData.emotionAnalysis.emotion === 'frustrated' || callData.emotionAnalysis.emotion === 'confused') {
        score -= 1;
        factors.push('Negative emotion');
      }

      if (callData.emotionAnalysis.engagement === 'high') {
        score += 2;
        factors.push('High engagement');
      }
    }

    // Determine quality level
    let quality = 'poor';
    if (score >= 6) {
      quality = 'excellent';
    } else if (score >= 4) {
      quality = 'good';
    } else if (score >= 2) {
      quality = 'fair';
    }

    return {
      score,
      quality,
      factors
    };
  }

  /**
   * Calculate call statistics for a set of calls
   */
  static calculateCallStatistics(calls) {
    if (!calls || calls.length === 0) {
      return {
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        completionRate: 0,
        averageDuration: 0,
        totalDuration: 0,
        byStatus: {},
        byPriority: {},
        byReason: {}
      };
    }

    const stats = {
      totalCalls: calls.length,
      completedCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
      byStatus: {},
      byPriority: {},
      byReason: {}
    };

    calls.forEach(call => {
      // Status breakdown
      stats.byStatus[call.status] = (stats.byStatus[call.status] || 0) + 1;
      
      // Priority breakdown
      stats.byPriority[call.priority] = (stats.byPriority[call.priority] || 0) + 1;
      
      // Reason breakdown
      stats.byReason[call.reason] = (stats.byReason[call.reason] || 0) + 1;
      
      // Success/failure counts
      if (call.status === 'completed') {
        stats.completedCalls++;
      } else if (['failed', 'no_answer', 'busy', 'cancelled'].includes(call.status)) {
        stats.failedCalls++;
      }
      
      // Duration
      stats.totalDuration += call.duration || 0;
    });

    // Calculate rates
    stats.completionRate = stats.totalCalls > 0 
      ? Math.round((stats.completedCalls / stats.totalCalls) * 100)
      : 0;

    stats.averageDuration = stats.totalCalls > 0 
      ? Math.round(stats.totalDuration / stats.totalCalls)
      : 0;

    return stats;
  }

  /**
   * Get next recommended action for a call
   */
  static getNextRecommendedAction(callData) {
    switch (callData.status) {
      case 'completed':
        if (callData.emotionAnalysis?.needsSupport) {
          return 'schedule_counselor_followup';
        }
        if (callData.duration < 30) {
          return 'send_detailed_followup';
        }
        return 'continue_monitoring';

      case 'no_answer':
        return 'retry_different_time';

      case 'failed':
        return 'investigate_technical_issue';

      case 'busy':
        return 'retry_in_few_hours';

      case 'cancelled':
        return 'send_whatsapp_message';

      case 'initiated':
      case 'in_progress':
        return 'wait_for_completion';

      default:
        return 'manual_review';
    }
  }

  /**
   * Validate call can be retried
   */
  static canRetryCall(callData) {
    if (callData.retried) {
      return { canRetry: false, reason: 'Call has already been retried' };
    }

    if (!['failed', 'no_answer', 'busy'].includes(callData.status)) {
      return { canRetry: false, reason: 'Call status does not allow retry' };
    }

    const attemptCount = callData.metadata?.previousAttempts || 0;
    if (attemptCount >= 3) {
      return { canRetry: false, reason: 'Maximum retry attempts reached' };
    }

    // Check time since last attempt
    const lastAttempt = new Date(callData.initiatedAt);
    const now = new Date();
    const hoursSinceLastAttempt = (now - lastAttempt) / (1000 * 60 * 60);

    if (hoursSinceLastAttempt < 1) {
      return { canRetry: false, reason: 'Must wait at least 1 hour between attempts' };
    }

    return { canRetry: true, reason: null };
  }
}

module.exports = CallModel;