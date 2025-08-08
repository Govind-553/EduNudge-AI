// server/services/database.js
const winston = require('winston');
const { 
  getFirestore,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudents,
  searchStudents,
  logCall,
  logNotification,
  getCallHistory,
  getNotificationHistory
} = require('../config/firebase');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'database' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Database Service - Centralized database operations and data management
 */
class DatabaseService {
  constructor() {
    this.db = getFirestore();
    this.collections = {
      students: 'students',
      calls: 'calls',
      notifications: 'notifications',
      users: 'users',
      analytics: 'analytics',
      system_logs: 'system_logs'
    };
  }

  /**
   * Student database operations
   */
  static async getStudentOperations() {
    return {
      // Create student
      create: async (studentData) => {
        try {
          logger.info('Creating student in database');
          
          const sanitizedData = this.sanitizeStudentData(studentData);
          const result = await createStudent(sanitizedData);
          
          logger.info(`Student created: ${result.id}`);
          return { success: true, data: result };
        } catch (error) {
          logger.error('Error creating student:', error);
          throw error;
        }
      },

      // Get student by ID
      getById: async (studentId) => {
        try {
          logger.info(`Getting student: ${studentId}`);
          
          const student = await getStudent(studentId);
          if (!student) {
            return { success: false, error: 'Student not found' };
          }
          
          return { success: true, data: student };
        } catch (error) {
          logger.error(`Error getting student ${studentId}:`, error);
          throw error;
        }
      },

      // Update student
      update: async (studentId, updateData) => {
        try {
          logger.info(`Updating student: ${studentId}`);
          
          const sanitizedData = this.sanitizeStudentData(updateData);
          const result = await updateStudent(studentId, sanitizedData);
          
          logger.info(`Student updated: ${studentId}`);
          return { success: true, data: result };
        } catch (error) {
          logger.error(`Error updating student ${studentId}:`, error);
          throw error;
        }
      },

      // Delete student (soft delete)
      delete: async (studentId) => {
        try {
          logger.info(`Deleting student: ${studentId}`);
          
          await updateStudent(studentId, {
            status: 'deleted',
            deletedAt: new Date().toISOString()
          });
          
          logger.info(`Student deleted: ${studentId}`);
          return { success: true };
        } catch (error) {
          logger.error(`Error deleting student ${studentId}:`, error);
          throw error;
        }
      },

      // Get students with filters
      list: async (filters = {}) => {
        try {
          logger.info('Getting students list with filters:', filters);
          
          const students = await getStudents(filters);
          return { success: true, data: students };
        } catch (error) {
          logger.error('Error getting students list:', error);
          throw error;
        }
      },

      // Search students
      search: async (query, limit = 20) => {
        try {
          logger.info(`Searching students: ${query}`);
          
          const students = await searchStudents(query, limit);
          return { success: true, data: students };
        } catch (error) {
          logger.error('Error searching students:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Call database operations
   */
  static async getCallOperations() {
    return {
      // Log new call
      create: async (callData) => {
        try {
          logger.info('Logging call in database');
          
          const sanitizedData = this.sanitizeCallData(callData);
          const result = await logCall(sanitizedData);
          
          logger.info(`Call logged: ${result.id}`);
          return { success: true, data: result };
        } catch (error) {
          logger.error('Error logging call:', error);
          throw error;
        }
      },

      // Get call by ID
      getById: async (callId) => {
        try {
          logger.info(`Getting call: ${callId}`);
          
          const call = await this.getDocument('calls', callId);
          if (!call) {
            return { success: false, error: 'Call not found' };
          }
          
          return { success: true, data: call };
        } catch (error) {
          logger.error(`Error getting call ${callId}:`, error);
          throw error;
        }
      },

      // Update call
      update: async (callId, updateData) => {
        try {
          logger.info(`Updating call: ${callId}`);
          
          const sanitizedData = this.sanitizeCallData(updateData);
          const result = await this.updateDocument('calls', callId, sanitizedData);
          
          logger.info(`Call updated: ${callId}`);
          return { success: true, data: result };
        } catch (error) {
          logger.error(`Error updating call ${callId}:`, error);
          throw error;
        }
      },

      // Get call history
      getHistory: async (studentId, limit = 50) => {
        try {
          logger.info(`Getting call history for student: ${studentId}`);
          
          const calls = await getCallHistory(studentId, limit);
          return { success: true, data: calls };
        } catch (error) {
          logger.error(`Error getting call history for ${studentId}:`, error);
          throw error;
        }
      },

      // Get recent calls
      getRecent: async (limit = 50, filters = {}) => {
        try {
          logger.info('Getting recent calls');
          
          const calls = await this.queryCollection('calls', filters, limit, 'initiatedAt', 'desc');
          return { success: true, data: calls };
        } catch (error) {
          logger.error('Error getting recent calls:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Notification database operations
   */
  static async getNotificationOperations() {
    return {
      // Log notification
      create: async (notificationData) => {
        try {
          logger.info('Logging notification in database');
          
          const sanitizedData = this.sanitizeNotificationData(notificationData);
          const result = await logNotification(sanitizedData);
          
          logger.info(`Notification logged: ${result.id}`);
          return { success: true, data: result };
        } catch (error) {
          logger.error('Error logging notification:', error);
          throw error;
        }
      },

      // Get notification by ID
      getById: async (notificationId) => {
        try {
          logger.info(`Getting notification: ${notificationId}`);
          
          const notification = await this.getDocument('notifications', notificationId);
          if (!notification) {
            return { success: false, error: 'Notification not found' };
          }
          
          return { success: true, data: notification };
        } catch (error) {
          logger.error(`Error getting notification ${notificationId}:`, error);
          throw error;
        }
      },

      // Update notification status
      updateStatus: async (notificationId, status, metadata = {}) => {
        try {
          logger.info(`Updating notification status: ${notificationId} -> ${status}`);
          
          const updateData = {
            status,
            updatedAt: new Date().toISOString(),
            ...metadata
          };

          // Add specific timestamps based on status
          if (status === 'sent') updateData.sentAt = new Date().toISOString();
          if (status === 'delivered') updateData.deliveredAt = new Date().toISOString();
          if (status === 'failed') updateData.failedAt = new Date().toISOString();

          const result = await this.updateDocument('notifications', notificationId, updateData);
          
          logger.info(`Notification status updated: ${notificationId}`);
          return { success: true, data: result };
        } catch (error) {
          logger.error(`Error updating notification status ${notificationId}:`, error);
          throw error;
        }
      },

      // Get notification history
      getHistory: async (studentId, limit = 50) => {
        try {
          logger.info(`Getting notification history for student: ${studentId}`);
          
          const notifications = await getNotificationHistory(studentId, limit);
          return { success: true, data: notifications };
        } catch (error) {
          logger.error(`Error getting notification history for ${studentId}:`, error);
          throw error;
        }
      },

      // Get notifications by status
      getByStatus: async (status, limit = 100) => {
        try {
          logger.info(`Getting notifications by status: ${status}`);
          
          const notifications = await this.queryCollection(
            'notifications', 
            { status }, 
            limit, 
            'createdAt', 
            'desc'
          );
          
          return { success: true, data: notifications };
        } catch (error) {
          logger.error(`Error getting notifications by status ${status}:`, error);
          throw error;
        }
      }
    };
  }

  /**
   * Analytics database operations
   */
  static async getAnalyticsOperations() {
    return {
      // Store analytics data
      store: async (analyticsType, data, metadata = {}) => {
        try {
          logger.info(`Storing analytics data: ${analyticsType}`);
          
          const analyticsData = {
            type: analyticsType,
            data,
            metadata,
            createdAt: new Date().toISOString(),
            validUntil: metadata.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          };

          const result = await this.createDocument('analytics', analyticsData);
          
          logger.info(`Analytics data stored: ${result.id}`);
          return { success: true, data: result };
        } catch (error) {
          logger.error(`Error storing analytics data:`, error);
          throw error;
        }
      },

      // Retrieve analytics data
      retrieve: async (analyticsType, dateRange = 7) => {
        try {
          logger.info(`Retrieving analytics data: ${analyticsType}`);
          
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - dateRange);

          const analytics = await this.queryCollection(
            'analytics',
            { 
              type: analyticsType,
              createdAt: { '>=': startDate.toISOString() }
            },
            50,
            'createdAt',
            'desc'
          );
          
          return { success: true, data: analytics };
        } catch (error) {
          logger.error(`Error retrieving analytics data:`, error);
          throw error;
        }
      },

      // Clean old analytics data
      cleanup: async (olderThanDays = 90) => {
        try {
          logger.info(`Cleaning up analytics data older than ${olderThanDays} days`);
          
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

          const oldRecords = await this.queryCollection(
            'analytics',
            { createdAt: { '<': cutoffDate.toISOString() } },
            1000,
            'createdAt',
            'asc'
          );

          let deletedCount = 0;
          for (const record of oldRecords) {
            await this.deleteDocument('analytics', record.id);
            deletedCount++;
          }
          
          logger.info(`Analytics cleanup completed: ${deletedCount} records deleted`);
          return { success: true, deletedCount };
        } catch (error) {
          logger.error('Error cleaning up analytics data:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Generic database operations
   */
  static async getGenericOperations() {
    return {
      // Create document in any collection
      create: async (collectionName, data) => {
        try {
          return await this.createDocument(collectionName, data);
        } catch (error) {
          logger.error(`Error creating document in ${collectionName}:`, error);
          throw error;
        }
      },

      // Get document by ID
      get: async (collectionName, documentId) => {
        try {
          return await this.getDocument(collectionName, documentId);
        } catch (error) {
          logger.error(`Error getting document ${documentId} from ${collectionName}:`, error);
          throw error;
        }
      },

      // Update document
      update: async (collectionName, documentId, data) => {
        try {
          return await this.updateDocument(collectionName, documentId, data);
        } catch (error) {
          logger.error(`Error updating document ${documentId} in ${collectionName}:`, error);
          throw error;
        }
      },

      // Delete document
      delete: async (collectionName, documentId) => {
        try {
          return await this.deleteDocument(collectionName, documentId);
        } catch (error) {
          logger.error(`Error deleting document ${documentId} from ${collectionName}:`, error);
          throw error;
        }
      },

      // Query collection
      query: async (collectionName, filters = {}, limit = 50, orderBy = 'createdAt', order = 'desc') => {
        try {
          return await this.queryCollection(collectionName, filters, limit, orderBy, order);
        } catch (error) {
          logger.error(`Error querying collection ${collectionName}:`, error);
          throw error;
        }
      },

      // Batch operations
      batch: async (operations) => {
        try {
          return await this.batchOperation(operations);
        } catch (error) {
          logger.error('Error performing batch operation:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Database health and monitoring
   */
  static async checkDatabaseHealth() {
    try {
      logger.info('Checking database health');

      const healthChecks = {
        connection: false,
        readOperations: false,
        writeOperations: false,
        responseTime: 0
      };

      const startTime = Date.now();

      // Test connection and read operations
      try {
        const testQuery = await this.queryCollection('students', {}, 1);
        healthChecks.connection = true;
        healthChecks.readOperations = true;
      } catch (error) {
        logger.warn('Database read test failed:', error);
      }

      // Test write operations
      try {
        const testDoc = {
          test: true,
          timestamp: new Date().toISOString()
        };
        
        await this.createDocument('system_logs', testDoc);
        healthChecks.writeOperations = true;
      } catch (error) {
        logger.warn('Database write test failed:', error);
      }

      healthChecks.responseTime = Date.now() - startTime;

      const isHealthy = healthChecks.connection && healthChecks.readOperations && healthChecks.writeOperations;

      return {
        healthy: isHealthy,
        checks: healthChecks,
        checkedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error checking database health:', error);
      return {
        healthy: false,
        error: error.message,
        checkedAt: new Date().toISOString()
      };
    }
  }

  // Helper methods for data sanitization
  static sanitizeStudentData(data) {
    const sanitized = { ...data };
    
    // Remove any null or undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === null || sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    // Ensure required fields have default values
    sanitized.status = sanitized.status || 'inquiry_submitted';
    sanitized.riskLevel = sanitized.riskLevel || 'low';
    sanitized.contactAttempts = sanitized.contactAttempts || 0;
    sanitized.createdAt = sanitized.createdAt || new Date().toISOString();
    sanitized.updatedAt = new Date().toISOString();

    return sanitized;
  }

  static sanitizeCallData(data) {
    const sanitized = { ...data };
    
    sanitized.status = sanitized.status || 'initiated';
    sanitized.duration = sanitized.duration || 0;
    sanitized.transcript = sanitized.transcript || '';
    sanitized.createdAt = sanitized.createdAt || new Date().toISOString();
    sanitized.updatedAt = new Date().toISOString();

    return sanitized;
  }

  static sanitizeNotificationData(data) {
    const sanitized = { ...data };
    
    sanitized.status = sanitized.status || 'pending';
    sanitized.retryCount = sanitized.retryCount || 0;
    sanitized.createdAt = sanitized.createdAt || new Date().toISOString();
    sanitized.updatedAt = new Date().toISOString();

    return sanitized;
  }

  // Low-level database operations (to be implemented based on your database choice)
  static async createDocument(collectionName, data) {
    // Implementation depends on your database (Firebase, MongoDB, etc.)
    // This is a placeholder
    logger.info(`Creating document in ${collectionName}`);
    return { id: 'generated_id', ...data };
  }

  static async getDocument(collectionName, documentId) {
    // Implementation depends on your database
    logger.info(`Getting document ${documentId} from ${collectionName}`);
    return null;
  }

  static async updateDocument(collectionName, documentId, data) {
    // Implementation depends on your database
    logger.info(`Updating document ${documentId} in ${collectionName}`);
    return { id: documentId, ...data };
  }

  static async deleteDocument(collectionName, documentId) {
    // Implementation depends on your database
    logger.info(`Deleting document ${documentId} from ${collectionName}`);
    return true;
  }

  static async queryCollection(collectionName, filters, limit, orderBy, order) {
    // Implementation depends on your database
    logger.info(`Querying collection ${collectionName}`);
    return [];
  }

  static async batchOperation(operations) {
    // Implementation depends on your database
    logger.info(`Performing batch operation with ${operations.length} operations`);
    return { success: true, processedCount: operations.length };
  }
}

module.exports = DatabaseService;