// server/middleware/validation.js
const { body, param, validationResult } = require('express-validator');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'validation-middleware' },
  transports: [
    new winston.transports.Console()
  ]
});

// Middleware to check for validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  logger.warn('Validation errors:', { errors: extractedErrors });

  return res.status(422).json({
    status: 'error',
    message: 'Validation failed',
    errors: extractedErrors,
  });
};

// Common validators
const commonValidators = {
  dateRange: [
    body('dateRange').optional().isIn(['1', '7', '30', '90']).withMessage('Invalid date range. Must be one of 1, 7, 30, or 90.')
  ],
  id: [
    param('id').isMongoId().withMessage('Invalid ID format')
  ]
};

// Student validators
const studentValidators = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    body('phone').isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number is required.'),
    body('inquiryType').optional().isString(),
    body('source').optional().isString()
  ],
  update: [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.'),
    body('email').optional().isEmail().withMessage('Valid email is required.'),
    body('phone').optional().isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number is required.'),
    body('status').optional().isIn([
      'inquiry_submitted',
      'documents_pending',
      'application_completed',
      'dropout_risk',
      'counselor_required',
      'engaged',
      'deleted'
    ]).withMessage('Invalid status provided.'),
    body('riskLevel').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid risk level.')
  ],
  bulkUpdate: [
    body('studentIds').isArray().withMessage('studentIds must be an array.'),
    body('studentIds.*').isString().withMessage('Each studentId must be a string.'),
    body('status').isIn([
      'inquiry_submitted',
      'documents_pending',
      'application_completed',
      'dropout_risk',
      'counselor_required',
      'engaged',
      'deleted'
    ]).withMessage('Invalid status provided.'),
    body('reason').optional().isString()
  ]
};

// Voice validators
const voiceValidators = {
  createCall: [
    body('studentId').isString().withMessage('studentId is required.'),
    body('callReason').optional().isString(),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority.'),
    body('customContext').optional().isObject(),
    body('agentPersonality').optional().isString()
  ]
};

// Authentication validators
const authValidators = {
  login: [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isString().notEmpty().withMessage('Password is required.')
  ]
};

module.exports = {
  validators: {
    common: commonValidators,
    student: studentValidators,
    voice: voiceValidators,
    auth: authValidators
  },
  validate,
  validationResult,
};