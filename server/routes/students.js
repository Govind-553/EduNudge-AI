// server/routes/students.js
const express = require('express');
const winston = require('winston');
const router = express.Router();

// Import Firebase functions
const { 
  createStudent, 
  updateStudent, 
  getStudent, 
  getStudentsByStatus,
  getAnalytics
} = require('../config/firebase');

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
router.get('/', async (req, res) => {
  try {
    const { 
      status = 'all', 
      riskLevel = 'all', 
      limit = 50, 
      page = 1 
    } = req.query;

    logger.info(`Fetching students with filters: status=${status}, riskLevel=${riskLevel}`);

    let students = [];
    
    if (status === 'all') {
      // For now, get all students - in production you'd implement proper pagination
      const allStatuses = [
        'inquiry_submitted', 
        'documents_pending', 
        'application_completed', 
        'dropout_risk', 
        'counselor_required',
        'engaged'
      ];
      
      for (const statusType of allStatuses) {
        const statusStudents = await getStudentsByStatus(statusType, parseInt(limit));
        students = students.concat(statusStudents);
      }
    } else {
      students = await getStudentsByStatus(status, parseInt(limit));
    }

    // Filter by risk level if specified
    if (riskLevel !== 'all') {
      students = students.filter(student => student.riskLevel === riskLevel);
    }

    // Sort by last activity (most recent first)
    students.sort((a, b) => {
      const aTime = a.lastActivity || a.createdAt || 0;
      const bTime = b.lastActivity || b.createdAt || 0;
      return bTime - aTime;
    });

    res.json({
      status: 'success',
      students,
      totalCount: students.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    logger.error('Error fetching students:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

/**
 * Get specific student by ID
 */
router.get('/:id', async (req, res) => {
  try {
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

  } catch (error) {
    logger.error('Error fetching student:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch student',
      error: error.message
    });
  }
});

/**
 * Create new student
 */
router.post('/', async (req, res) => {
  try {
    const studentData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !studentData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
        missingFields
      });
    }

    logger.info(`Creating student: ${studentData.name}`);
    
    const student = await createStudent(studentData);

    res.status(201).json({
      status: 'success',
      message: 'Student created successfully',
      student
    });

  } catch (error) {
    logger.error('Error creating student:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create student',
      error: error.message
    });
  }
});

/**
 * Update student information
 */
router.put('/:id', async (req, res) => {
  try {
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

    res.json({
      status: 'success',
      message: 'Student updated successfully',
      student: updatedStudent
    });

  } catch (error) {
    logger.error('Error updating student:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update student',
      error: error.message
    });
  }
});

/**
 * Delete student (soft delete by updating status)
 */
router.delete('/:id', async (req, res) => {
  try {
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

    res.json({
      status: 'success',
      message: 'Student deleted successfully',
      student: updatedStudent
    });

  } catch (error) {
    logger.error('Error deleting student:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete student',
      error: error.message
    });
  }
});

/**
 * Get student statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { dateRange = '7' } = req.query;
    
    logger.info(`Fetching student statistics for ${dateRange} days`);
    
    const analytics = await getAnalytics(parseInt(dateRange));

    res.json({
      status: 'success',
      analytics
    });

  } catch (error) {
    logger.error('Error fetching student statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

/**
 * Bulk update student statuses
 */
router.put('/bulk/status', async (req, res) => {
  try {
    const { studentIds, status, reason } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Student IDs array is required'
      });
    }

    if (!status) {
      return res.status(400).json({
        status: 'error',
        message: 'Status is required'
      });
    }

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

  } catch (error) {
    logger.error('Error bulk updating students:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to bulk update students',
      error: error.message
    });
  }
});

/**
 * Search students by name, email, or phone
 */
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query must be at least 2 characters long'
      });
    }

    logger.info(`Searching students with query: ${query}`);
    
    // For now, get all students and filter in memory
    // In production, you'd implement proper search indexing
    const allStatuses = [
      'inquiry_submitted', 
      'documents_pending', 
      'application_completed', 
      'dropout_risk', 
      'counselor_required',
      'engaged'
    ];
    
    let allStudents = [];
    for (const status of allStatuses) {
      const statusStudents = await getStudentsByStatus(status, 100);
      allStudents = allStudents.concat(statusStudents);
    }

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

  } catch (error) {
    logger.error('Error searching students:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search students',
      error: error.message
    });
  }
});

module.exports = router;