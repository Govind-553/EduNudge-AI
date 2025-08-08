// server/models/Student.js
const Joi = require('joi');

/**
 * Student data model validation schemas
 */
class StudentModel {
  // Base student schema for validation
  static baseSchema = Joi.object({
    name: Joi.string().min(2).max(100).required()
      .messages({
        'string.empty': 'Student name is required',
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 100 characters'
      }),
    
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required'
      }),
    
    phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required()
      .messages({
        'string.pattern.base': 'Please provide a valid international phone number',
        'string.empty': 'Phone number is required'
      }),
    
    inquiryType: Joi.string().valid(
      'undergraduate',
      'graduate',
      'certificate',
      'diploma',
      'online_course',
      'professional_development',
      'continuing_education'
    ).required()
      .messages({
        'any.only': 'Please select a valid inquiry type'
      }),
    
    status: Joi.string().valid(
      'inquiry_submitted',
      'documents_pending',
      'application_in_progress',
      'application_completed',
      'interview_scheduled',
      'accepted',
      'enrolled',
      'dropout_risk',
      'counselor_required',
      'deleted'
    ).default('inquiry_submitted'),
    
    riskLevel: Joi.string().valid('low', 'medium', 'high').default('low'),
    
    // Contact preferences
    preferredContactMethod: Joi.string().valid('whatsapp', 'email', 'voice', 'sms').default('whatsapp'),
    communicationPreferences: Joi.object({
      voiceCalls: Joi.boolean().default(true),
      whatsappMessages: Joi.boolean().default(true),
      emailNotifications: Joi.boolean().default(true),
      smsAlerts: Joi.boolean().default(false)
    }).default({}),
    
    // Activity tracking
    lastActivity: Joi.string().isoDate().default(() => new Date().toISOString()),
    lastActivityType: Joi.string().default('inquiry_submitted'),
    
    // Call tracking
    contactAttempts: Joi.number().integer().min(0).default(0),
    lastCallDate: Joi.string().isoDate().allow(null).default(null),
    lastCallStatus: Joi.string().valid('completed', 'failed', 'no_answer', 'busy').allow(null).default(null),
    lastCallDuration: Joi.number().integer().min(0).default(0),
    lastCallId: Joi.string().allow(null).default(null),
    
    // Demographics (optional)
    age: Joi.number().integer().min(16).max(100).allow(null).default(null),
    location: Joi.object({
      city: Joi.string().allow('').default(''),
      state: Joi.string().allow('').default(''),
      country: Joi.string().allow('').default(''),
      zipCode: Joi.string().allow('').default('')
    }).default({}),
    
    // Academic background
    educationLevel: Joi.string().valid(
      'high_school',
      'some_college',
      'bachelors',
      'masters',
      'doctorate',
      'professional'
    ).allow(null).default(null),
    
    previousInstitution: Joi.string().allow('').default(''),
    
    // Financial information
    financialAidInterest: Joi.boolean().default(false),
    budgetRange: Joi.string().valid(
      'under_10k',
      '10k_25k',
      '25k_50k',
      '50k_100k',
      'above_100k'
    ).allow(null).default(null),
    
    // Enrollment timeline
    intendedStartDate: Joi.string().isoDate().allow(null).default(null),
    applicationDeadline: Joi.string().isoDate().allow(null).default(null),
    
    // Tracking metadata
    source: Joi.string().valid(
      'website',
      'social_media',
      'referral',
      'advertisement',
      'event',
      'partner',
      'other'
    ).default('website'),
    
    utm: Joi.object({
      source: Joi.string().allow('').default(''),
      medium: Joi.string().allow('').default(''),
      campaign: Joi.string().allow('').default(''),
      term: Joi.string().allow('').default(''),
      content: Joi.string().allow('').default('')
    }).default({}),
    
    // Risk assessment data
    riskScore: Joi.number().min(0).max(100).default(0),
    riskFactors: Joi.array().items(Joi.string()).default([]),
    lastRiskAssessment: Joi.string().isoDate().allow(null).default(null),
    
    // AI analysis
    lastEmotionAnalysis: Joi.object().allow(null).default(null),
    lastCallAnalysis: Joi.object().allow(null).default(null),
    
    // Escalation tracking
    escalatedAt: Joi.string().isoDate().allow(null).default(null),
    escalationReason: Joi.string().allow('').default(''),
    assignedCounselor: Joi.string().allow('').default(''),
    
    // System fields
    createdAt: Joi.string().isoDate().default(() => new Date().toISOString()),
    updatedAt: Joi.string().isoDate().default(() => new Date().toISOString()),
    createdBy: Joi.string().allow('').default('system'),
    tags: Joi.array().items(Joi.string()).default([])
  });

  // Schema for creating new student
  static createSchema = this.baseSchema.fork([
    'status',
    'riskLevel',
    'lastActivity',
    'contactAttempts',
    'riskScore',
    'createdAt',
    'updatedAt'
  ], (schema) => schema.optional());

  // Schema for updating student
  static updateSchema = this.baseSchema.fork([
    'name',
    'email',
    'phone',
    'inquiryType'
  ], (schema) => schema.optional());

  // Schema for bulk operations
  static bulkUpdateSchema = Joi.object({
    studentIds: Joi.array().items(Joi.string()).min(1).required(),
    status: Joi.string().valid(
      'documents_pending',
      'application_in_progress',
      'dropout_risk',
      'counselor_required'
    ).required(),
    reason: Joi.string().allow('').default('')
  });

  /**
   * Validate student data for creation
   */
  static validateCreate(data) {
    return this.createSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate student data for update
   */
  static validateUpdate(data) {
    return this.updateSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate bulk update data
   */
  static validateBulkUpdate(data) {
    return this.bulkUpdateSchema.validate(data, { abortEarly: false });
  }

  /**
   * Format student data for database storage
   */
  static formatForDatabase(data) {
    const now = new Date().toISOString();
    
    return {
      ...data,
      phone: this.formatPhoneNumber(data.phone),
      email: data.email?.toLowerCase(),
      updatedAt: now
    };
  }

  /**
   * Format student data for API response
   */
  static formatForResponse(data) {
    const formatted = {
      ...data,
      // Add computed fields
      daysSinceCreated: this.calculateDaysSince(data.createdAt),
      daysSinceLastActivity: this.calculateDaysSince(data.lastActivity),
      engagementLevel: this.calculateEngagementLevel(data),
      conversionProbability: this.calculateConversionProbability(data),
      nextRecommendedAction: this.getNextAction(data),
      statusDisplay: this.getStatusDisplay(data.status),
      riskLevelDisplay: this.getRiskLevelDisplay(data.riskLevel)
    };

    // Remove sensitive data for non-admin users
    if (data.hideSensitive) {
      delete formatted.phone;
      delete formatted.email;
    }

    return formatted;
  }

  /**
   * Calculate risk score based on multiple factors
   */
  static calculateRiskScore(student) {
    let riskScore = 0;
    
    // Factor 1: Days since last activity
    const daysSinceActivity = this.calculateDaysSince(student.lastActivity);
    if (daysSinceActivity >= 7) riskScore += 30;
    else if (daysSinceActivity >= 3) riskScore += 15;
    else if (daysSinceActivity >= 1) riskScore += 5;
    
    // Factor 2: Contact attempts without success
    const failedAttempts = student.contactAttempts || 0;
    if (failedAttempts >= 3) riskScore += 25;
    else if (failedAttempts >= 2) riskScore += 15;
    else if (failedAttempts >= 1) riskScore += 5;
    
    // Factor 3: Status progression
    const statusRisk = {
      'inquiry_submitted': 10,
      'documents_pending': 20,
      'application_in_progress': 5,
      'dropout_risk': 40,
      'counselor_required': 35
    };
    riskScore += statusRisk[student.status] || 0;
    
    // Factor 4: Time since creation without progress
    const daysSinceCreated = this.calculateDaysSince(student.createdAt);
    if (daysSinceCreated >= 14) riskScore += 20;
    else if (daysSinceCreated >= 7) riskScore += 10;
    
    // Factor 5: Failed call attempts
    if (student.lastCallStatus === 'failed' || student.lastCallStatus === 'no_answer') {
      riskScore += 15;
    }
    
    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * Get risk level from score
   */
  static getRiskLevelFromScore(score) {
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Check if student needs attention
   */
  static needsAttention(student) {
    const riskScore = this.calculateRiskScore(student);
    const daysSinceActivity = this.calculateDaysSince(student.lastActivity);
    
    return riskScore >= 30 || 
           daysSinceActivity >= 5 || 
           student.status === 'dropout_risk' ||
           student.status === 'counselor_required';
  }

  /**
   * Get next recommended action
   */
  static getNextAction(student) {
    const riskScore = this.calculateRiskScore(student);
    const daysSinceActivity = this.calculateDaysSince(student.lastActivity);
    
    if (student.status === 'counselor_required') {
      return 'assign_counselor';
    }
    
    if (riskScore >= 60) {
      return 'immediate_voice_call';
    }
    
    if (daysSinceActivity >= 7) {
      return 'voice_call';
    }
    
    if (daysSinceActivity >= 3) {
      return 'whatsapp_followup';
    }
    
    if (student.status === 'documents_pending') {
      return 'document_reminder';
    }
    
    return 'continue_monitoring';
  }

  /**
   * Calculate engagement level
   */
  static calculateEngagementLevel(student) {
    const daysSinceActivity = this.calculateDaysSince(student.lastActivity);
    const contactAttempts = student.contactAttempts || 0;
    
    if (daysSinceActivity <= 1 && contactAttempts >= 1) return 'high';
    if (daysSinceActivity <= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate conversion probability
   */
  static calculateConversionProbability(student) {
    let probability = 50; // Base 50%
    
    // Adjust based on status
    const statusMultiplier = {
      'inquiry_submitted': 0.8,
      'documents_pending': 1.2,
      'application_in_progress': 1.5,
      'application_completed': 2.0,
      'dropout_risk': 0.3,
      'counselor_required': 0.5
    };
    
    probability *= statusMultiplier[student.status] || 1;
    
    // Adjust based on engagement
    const engagement = this.calculateEngagementLevel(student);
    if (engagement === 'high') probability *= 1.3;
    else if (engagement === 'low') probability *= 0.7;
    
    // Adjust based on contact success
    if (student.lastCallStatus === 'completed') probability *= 1.2;
    else if (student.lastCallStatus === 'failed') probability *= 0.8;
    
    return Math.max(0, Math.min(100, Math.round(probability)));
  }

  /**
   * Helper methods
   */
  static formatPhoneNumber(phone) {
    if (!phone) return phone;
    
    // Remove all non-digit characters except +
    let formatted = phone.replace(/[^\d+]/g, '');
    
    // If no country code, assume US (+1)
    if (!formatted.startsWith('+')) {
      if (formatted.length === 10) {
        formatted = '+1' + formatted;
      } else if (formatted.length === 11 && formatted.startsWith('1')) {
        formatted = '+' + formatted;
      }
    }
    
    return formatted;
  }

  static calculateDaysSince(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
  }

  static getStatusDisplay(status) {
    const statusMap = {
      'inquiry_submitted': 'Inquiry Submitted',
      'documents_pending': 'Documents Pending',
      'application_in_progress': 'Application in Progress',
      'application_completed': 'Application Completed',
      'interview_scheduled': 'Interview Scheduled',
      'accepted': 'Accepted',
      'enrolled': 'Enrolled',
      'dropout_risk': 'Dropout Risk',
      'counselor_required': 'Counselor Required',
      'deleted': 'Deleted'
    };
    
    return statusMap[status] || status;
  }

  static getRiskLevelDisplay(riskLevel) {
    const riskMap = {
      'low': 'Low Risk',
      'medium': 'Medium Risk',
      'high': 'High Risk'
    };
    
    return riskMap[riskLevel] || riskLevel;
  }
}

module.exports = StudentModel;