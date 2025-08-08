// server/middleware/validation.js
const Joi = require('joi');
const { createError } = require('./errorHandler');

/**
 * Generic validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'params', 'query', 'headers')
 * @param {Object} options - Validation options
 */
const validate = (schema, property = 'body', options = {}) => {
  const defaultOptions = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
    ...options
  };

  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], defaultOptions);

    if (error) {
      const validationError = createError(
        'Validation failed',
        400,
        'validation_error'
      );
      
      validationError.details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return next(validationError);
    }

    // Replace the request property with the validated and sanitized value
    req[property] = value;
    next();
  };
};

/**
 * Student validation schemas
 */
const studentSchemas = {
  // Create student validation
  create: Joi.object({
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
        'string.pattern.base': 'Please provide a valid international phone number (+1234567890)',
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
    
    preferredContactMethod: Joi.string().valid('whatsapp', 'email', 'voice', 'sms').default('whatsapp'),
    
    age: Joi.number().integer().min(16).max(100).allow(null),
    
    location: Joi.object({
      city: Joi.string().allow('').max(50),
      state: Joi.string().allow('').max(50),
      country: Joi.string().allow('').max(50),
      zipCode: Joi.string().allow('').max(20)
    }).default({}),
    
    educationLevel: Joi.string().valid(
      'high_school',
      'some_college',
      'bachelors',
      'masters',
      'doctorate',
      'professional'
    ).allow(null),
    
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
      source: Joi.string().allow('').max(100),
      medium: Joi.string().allow('').max(100),
      campaign: Joi.string().allow('').max(100),
      term: Joi.string().allow('').max(100),
      content: Joi.string().allow('').max(100)
    }).default({})
  }),

  // Update student validation
  update: Joi.object({
    name: Joi.string().min(2).max(100),
    email: Joi.string().email(),
    phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
    
    status: Joi.string().valid(
      'inquiry_submitted',
      'documents_pending',
      'application_in_progress',
      'application_completed',
      'interview_scheduled',
      'accepted',
      'enrolled',
      'dropout_risk',
      'counselor_required'
    ),
    
    riskLevel: Joi.string().valid('low', 'medium', 'high'),
    preferredContactMethod: Joi.string().valid('whatsapp', 'email', 'voice', 'sms'),
    
    communicationPreferences: Joi.object({
      voiceCalls: Joi.boolean(),
      whatsappMessages: Joi.boolean(),
      emailNotifications: Joi.boolean(),
      smsAlerts: Joi.boolean()
    }),
    
    location: Joi.object({
      city: Joi.string().allow('').max(50),
      state: Joi.string().allow('').max(50),
      country: Joi.string().allow('').max(50),
      zipCode: Joi.string().allow('').max(20)
    }),
    
    educationLevel: Joi.string().valid(
      'high_school',
      'some_college',
      'bachelors',
      'masters',
      'doctorate',
      'professional'
    ).allow(null),
    
    financialAidInterest: Joi.boolean(),
    
    budgetRange: Joi.string().valid(
      'under_10k',
      '10k_25k',
      '25k_50k',
      '50k_100k',
      'above_100k'
    ).allow(null),
    
    intendedStartDate: Joi.string().isoDate().allow(null),
    assignedCounselor: Joi.string().allow(''),
    tags: Joi.array().items(Joi.string().max(50))
  }).min(1), // At least one field must be provided

  // Bulk update validation
  bulkUpdate: Joi.object({
    studentIds: Joi.array().items(Joi.string()).min(1).max(100).required()
      .messages({
        'array.min': 'At least one student ID is required',
        'array.max': 'Maximum 100 students can be updated at once'
      }),
    
    status: Joi.string().valid(
      'documents_pending',
      'application_in_progress',
      'dropout_risk',
      'counselor_required'
    ).required(),
    
    reason: Joi.string().max(500).default(''),
    assignedCounselor: Joi.string().allow('')
  })
};

/**
 * Voice call validation schemas
 */
const voiceCallSchemas = {
  // Create call validation
  create: Joi.object({
    studentId: Joi.string().required(),
    toNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required()
      .messages({
        'string.pattern.base': 'Please provide a valid international phone number'
      }),
    
    studentName: Joi.string().min(2).max(100).required(),
    inquiryType: Joi.string().default('general'),
    applicationStatus: Joi.string().default('inquiry_submitted'),
    
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
    
    callType: Joi.string().valid('automated', 'manual', 'retry', 'escalation').default('automated'),
    
    agentConfig: Joi.object({
      customPrompt: Joi.string().max(2000),
      urgency: Joi.string().valid('high', 'medium', 'low').default('medium'),
      emotion: Joi.string().valid('empathetic', 'professional', 'friendly').default('professional'),
      focus: Joi.string().allow('')
    }).default({})
  }),

  // Call status update validation
  statusUpdate: Joi.object({
    call_id: Joi.string().required(),
    call_status: Joi.string().valid(
      'initiated',
      'in_progress',
      'completed',
      'failed',
      'no_answer',
      'busy',
      'cancelled'
    ).required(),
    
    start_timestamp: Joi.string().isoDate(),
    end_timestamp: Joi.string().isoDate(),
    duration: Joi.number().integer().min(0).max(3600), // Max 1 hour
    transcript: Joi.string().allow('').max(10000),
    analysis: Joi.object().allow(null)
  })
};

/**
 * Notification validation schemas
 */
const notificationSchemas = {
  // WhatsApp message validation
  whatsapp: Joi.object({
    to: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required()
      .messages({
        'string.pattern.base': 'Please provide a valid international phone number'
      }),
    
    message: Joi.string().max(4096), // WhatsApp character limit
    templateType: Joi.string().valid(
      'welcome',
      'followUp',
      'documentReminder',
      'paymentReminder',
      'scholarshipInfo',
      'interviewScheduling',
      'applicationComplete',
      'acceptanceCongratulations'
    ),
    
    variables: Joi.object().default({}),
    customMessage: Joi.string().max(4096),
    studentId: Joi.string().required()
  }).xor('message', 'templateType', 'customMessage'), // Only one of these should be provided

  // Interactive WhatsApp message validation
  whatsappInteractive: Joi.object({
    to: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
    message: Joi.string().max(1024).required(),
    
    buttons: Joi.array().items(
      Joi.object({
        id: Joi.string().max(256).required(),
        title: Joi.string().max(20).required()
      })
    ).min(1).max(3).required(),
    
    studentId: Joi.string().required()
  }),

  // Email validation
  email: Joi.object({
    to: Joi.string().email().required(),
    subject: Joi.string().max(200).required(),
    message: Joi.string().max(50000).required(),
    studentId: Joi.string(),
    templateType: Joi.string(),
    variables: Joi.object().default({})
  }),

  // Bulk notification validation
  bulk: Joi.object({
    recipients: Joi.array().items(
      Joi.object({
        studentId: Joi.string().required(),
        channel: Joi.string().valid('whatsapp', 'email', 'sms').default('whatsapp'),
        templateType: Joi.string().required(),
        variables: Joi.object().default({}),
        priority: Joi.string().valid('high', 'medium', 'low').default('medium')
      })
    ).min(1).max(100).required(),
    
    batchName: Joi.string().max(100).default('unnamed_batch')
  })
};

/**
 * AI operation validation schemas
 */
const aiSchemas = {
  // Emotion analysis validation
  emotionAnalysis: Joi.object({
    studentId: Joi.string().required(),
    transcript: Joi.string().allow('').max(10000),
    responses: Joi.array().items(Joi.string()).default([]),
    duration: Joi.number().integer().min(0).max(3600).default(0),
    summary: Joi.string().allow('').max(2000)
  }),

  // Message generation validation
  messageGeneration: Joi.object({
    studentId: Joi.string().required(),
    messageType: Joi.string().valid('whatsapp', 'email', 'sms').default('whatsapp'),
    callAnalysis: Joi.object().allow(null),
    context: Joi.object().default({})
  }),

  // Inquiry classification validation
  inquiryClassification: Joi.object({
    inquiryText: Joi.string().min(10).max(5000).required()
      .messages({
        'string.min': 'Inquiry text must be at least 10 characters long',
        'string.max': 'Inquiry text cannot exceed 5000 characters'
      }),
    
    studentData: Joi.object().default({}),
    studentId: Joi.string().allow(null)
  })
};

/**
 * Query parameter validation schemas
 */
const querySchemas = {
  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().max(50).default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Student list filters
  studentFilters: Joi.object({
    status: Joi.string().valid(
      'inquiry_submitted',
      'documents_pending',
      'application_in_progress',
      'application_completed',
      'interview_scheduled',
      'accepted',
      'enrolled',
      'dropout_risk',
      'counselor_required'
    ),
    
    riskLevel: Joi.string().valid('low', 'medium', 'high'),
    inquiryType: Joi.string(),
    source: Joi.string(),
    
    dateFrom: Joi.string().isoDate(),
    dateTo: Joi.string().isoDate(),
    
    search: Joi.string().max(100),
    assignedCounselor: Joi.string().max(100)
  }),

  // Date range validation
  dateRange: Joi.object({
    dateRange: Joi.number().integer().min(1).max(365).default(7)
  })
};

/**
 * Common validation patterns
 */
const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Please provide a valid ID'
    }),

  // UUID validation  
  uuid: Joi.string().uuid(),

  // Phone number validation
  phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/)
    .messages({
      'string.pattern.base': 'Please provide a valid international phone number (+1234567890)'
    }),

  // Email validation
  email: Joi.string().email().max(254)
    .messages({
      'string.email': 'Please provide a valid email address'
    }),

  // URL validation
  url: Joi.string().uri({ scheme: ['http', 'https'] })
    .messages({
      'string.uri': 'Please provide a valid URL'
    })
};

/**
 * Validation middleware factories
 */
const validators = {
  // Student validators
  student: {
    create: validate(studentSchemas.create),
    update: validate(studentSchemas.update),
    bulkUpdate: validate(studentSchemas.bulkUpdate),
    id: validate(Joi.object({ id: commonSchemas.objectId.required() }), 'params'),
    query: validate(querySchemas.studentFilters, 'query')
  },

  // Voice call validators
  call: {
    create: validate(voiceCallSchemas.create),
    statusUpdate: validate(voiceCallSchemas.statusUpdate),
    id: validate(Joi.object({ callId: Joi.string().required() }), 'params')
  },

  // Notification validators
  notification: {
    whatsapp: validate(notificationSchemas.whatsapp),
    whatsappInteractive: validate(notificationSchemas.whatsappInteractive),
    email: validate(notificationSchemas.email),
    bulk: validate(notificationSchemas.bulk)
  },

  // AI validators
  ai: {
    emotionAnalysis: validate(aiSchemas.emotionAnalysis),
    messageGeneration: validate(aiSchemas.messageGeneration),
    inquiryClassification: validate(aiSchemas.inquiryClassification)
  },

  // Common validators
  common: {
    pagination: validate(querySchemas.pagination, 'query'),
    dateRange: validate(querySchemas.dateRange, 'query'),
    objectId: (paramName = 'id') => validate(
      Joi.object({ [paramName]: commonSchemas.objectId.required() }), 
      'params'
    )
  }
};

/**
 * Custom validation functions
 */
const customValidators = {
  // Validate business hours
  isBusinessHours: (date = new Date()) => {
    const hour = date.getHours();
    return hour >= 9 && hour < 18; // 9 AM to 6 PM
  },

  // Validate phone number format and carrier
  validatePhoneNumber: async (phoneNumber) => {
    // Basic format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return { valid: false, reason: 'Invalid phone number format' };
    }

    // Additional validation logic could go here
    // (carrier lookup, number verification, etc.)
    
    return { valid: true };
  },

  // Validate email domain
  validateEmailDomain: async (email) => {
    const domain = email.split('@')[1];
    
    // Basic domain validation
    if (!domain || domain.length < 3) {
      return { valid: false, reason: 'Invalid email domain' };
    }

    // Could add DNS lookup or domain reputation check here
    
    return { valid: true };
  },

  // Sanitize HTML input
  sanitizeHtml: (html) => {
    // Basic HTML sanitization
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }
};

/**
 * File upload validation
 */
const fileValidation = {
  // Image validation
  image: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    maxSize: 5 * 1024 * 1024, // 5MB
    validate: (file) => {
      const errors = [];
      
      if (!fileValidation.image.allowedTypes.includes(file.mimetype)) {
        errors.push('Invalid file type. Only JPEG, PNG, and GIF are allowed.');
      }
      
      if (file.size > fileValidation.image.maxSize) {
        errors.push('File too large. Maximum size is 5MB.');
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    }
  },

  // Document validation
  document: {
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 10 * 1024 * 1024, // 10MB
    validate: (file) => {
      const errors = [];
      
      if (!fileValidation.document.allowedTypes.includes(file.mimetype)) {
        errors.push('Invalid file type. Only PDF and DOC/DOCX are allowed.');
      }
      
      if (file.size > fileValidation.document.maxSize) {
        errors.push('File too large. Maximum size is 10MB.');
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    }
  }
};

module.exports = {
  validate,
  validators,
  customValidators,
  fileValidation,
  schemas: {
    student: studentSchemas,
    call: voiceCallSchemas,
    notification: notificationSchemas,
    ai: aiSchemas,
    query: querySchemas,
    common: commonSchemas
  }
};