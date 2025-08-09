// server/routes/students.js
const express = require('express');
const winston = require('winston');
const router = express.Router();

// Import Firebase functions
const { 
  createStudent, 
  updateStudent, 
  getStudent, 
  getStudents, // Updated: Renamed from getStudentsByStatus
  getAnalytics
} = require('../config/firebase');

// Import middleware
const { validators } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { appLogger } = require('../middleware/logging');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'students-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get all students with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { 
    status, 
    riskLevel, 
    limit = 50, 
    page = 1,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  logger.info(`Fetching students with filters: status=${status}, riskLevel=${riskLevel}, limit=${limit}, page=${page}`);

  // Refactored to use a more robust getStudents function that can handle multiple filters
  const students = await getStudents({ 
    status, 
    riskLevel, 
    limit: parseInt(limit), 
    page: parseInt(page),
    sortBy,
    sortOrder
  });

  res.json({
    status: 'success',
    students,
    totalCount: students.length, // This should be updated to return the actual total count from the DB
    page: parseInt(page),
    limit: parseInt(limit)
  });
}));

/**
 * Get specific student by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  logger.info(`Fetching student: ${id}`);
  
  const student = await getStudent(id);
  
  if (!student) {
    return res.status(404).json({
      status: 'error',
      message: 'Student not found'
    });
  }

  res.json({
    status: 'success',
    student
  });
}));

/**
 * Create new student
 */
router.post('/', validators.student.create, asyncHandler(async (req, res) => {
  const studentData = req.body;
  
  logger.info(`Creating student: ${studentData.name}`);
  appLogger.student.created(null, studentData);
  
  const student = await createStudent(studentData);

  res.status(201).json({
    status: 'success',
    message: 'Student created successfully',
    student
  });
}));

/**
 * Update student information
 */
router.put('/:id', validators.student.update, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  logger.info(`Updating student: ${id}`);
  
  // Check if student exists first
  const existingStudent = await getStudent(id);
  if (!existingStudent) {
    return res.status(404).json({
      status: 'error',
      message: 'Student not found'
    });
  }

  const updatedStudent = await updateStudent(id, updateData);
  appLogger.student.updated(id, updateData, req.user?.id);

  res.json({
    status: 'success',
    message: 'Student updated successfully',
    student: updatedStudent
  });
}));

/**
 * Delete student (soft delete by updating status)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  logger.info(`Deleting student: ${id}`);
  
  // Check if student exists first
  const existingStudent = await getStudent(id);
  if (!existingStudent) {
    return res.status(404).json({
      status: 'error',
      message: 'Student not found'
    });
  }

  // Soft delete by updating status
  const updatedStudent = await updateStudent(id, {
    status: 'deleted',
    deletedAt: new Date().toISOString(),
    deletedBy: req.user?.id || 'system'
  });
  appLogger.student.deleted(id, req.user?.id);

  res.json({
    status: 'success',
    message: 'Student deleted successfully',
    student: updatedStudent
  });
}));

/**
 * Get student statistics
 */
router.get('/stats/overview', validators.common.dateRange, asyncHandler(async (req, res) => {
  const { dateRange = '7' } = req.query;
  
  logger.info(`Fetching student statistics for ${dateRange} days`);
  
  const analytics = await getAnalytics(parseInt(dateRange));

  res.json({
    status: 'success',
    analytics
  });
}));

/**
 * Bulk update student statuses
 */
router.put('/bulk/status', validators.student.bulkUpdate, asyncHandler(async (req, res) => {
  const { studentIds, status, reason } = req.body;
  
  logger.info(`Bulk updating ${studentIds.length} students to status: ${status}`);
  
  const updatePromises = studentIds.map(studentId => 
    updateStudent(studentId, {
      status,
      bulkUpdateReason: reason || 'Bulk status update',
      bulkUpdatedAt: new Date().toISOString(),
      bulkUpdatedBy: req.user?.id || 'system'
    })
  );

  const results = await Promise.allSettled(updatePromises);
  
  const successful = results.filter(result => result.status === 'fulfilled').length;
  const failed = results.filter(result => result.status === 'rejected').length;

  res.json({
    status: 'success',
    message: `Bulk update completed: ${successful} successful, ${failed} failed`,
    successful,
    failed,
    totalProcessed: studentIds.length
  });
}));

/**
 * Search students by name, email, or phone
 */
router.get('/search/:query', asyncHandler(async (req, res) => {
  const { query } = req.params;
  const { limit = 20 } = req.query;
  
  if (!query || query.length < 2) {
    return res.status(400).json({
      status: 'error',
      message: 'Search query must be at least 2 characters long'
    });
  }

  logger.info(`Searching students with query: ${query}`);
  
  // For now, it fetches all students and filters in memory
  const db = getDatabase();
  const studentsRef = db.ref('students');
  const snapshot = await studentsRef.once('value');
  const allStudents = [];
  
  snapshot.forEach(childSnapshot => {
    allStudents.push({
      id: childSnapshot.key,
      ...childSnapshot.val()
    });
  });

  const searchQuery = query.toLowerCase();
  const matchingStudents = allStudents.filter(student => {
    const name = (student.name || '').toLowerCase();
    const email = (student.email || '').toLowerCase();
    const phone = (student.phone || '').toLowerCase();
    
    return name.includes(searchQuery) || 
           email.includes(searchQuery) || 
           phone.includes(searchQuery);
  });

  // Limit results
  const limitedResults = matchingStudents.slice(0, parseInt(limit));

  res.json({
    status: 'success',
    students: limitedResults,
    totalMatches: matchingStudents.length,
    query
  });
}));

module.exports = router;