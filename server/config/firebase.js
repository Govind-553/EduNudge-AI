// server/config/firebase.js
const admin = require('firebase-admin');
const winston = require('winston');

// Configure logger for this module
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'firebase-config' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

let db = null;
let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (firebaseApp) {
      logger.info('Firebase already initialized');
      return { app: firebaseApp, db };
    }

    // Validate required environment variables
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_DATABASE_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Format private key (handle escaped newlines)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });

    // Initialize Realtime Database
    db = admin.database();

    // Test the connection
    await testFirebaseConnection();

    logger.info('Firebase initialized successfully');
    return { app: firebaseApp, db };

  } catch (error) {
      logger.error('Error initializing Firebase:', error);
      throw error;
  }
}

/**
 * Test Firebase connection
 */
async function testFirebaseConnection() {
  try {
    const testRef = db.ref('system/health');
    await testRef.set({
      status: 'healthy',
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    
    const snapshot = await testRef.once('value');
    if (snapshot.exists()) {
      logger.info('Firebase connection test successful');
      return true;
    } else {
      throw new Error('Failed to write test data to Firebase');
    }
  } catch (error) {
    logger.error('Firebase connection test failed:', error);
    throw error;
  }
}

/**
 * Get Firebase database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
}

/**
 * Get Firebase app instance
 */
function getFirebaseApp() {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return firebaseApp;
}

/**
 * Create a new student record
 */
async function createStudent(studentData) {
  try {
    const studentsRef = db.ref('students');
    const newStudentRef = studentsRef.push();
    
    const student = {
      ...studentData,
      id: newStudentRef.key,
      status: studentData.status || 'inquiry_submitted',
      riskLevel: studentData.riskLevel || 'low',
      createdAt: admin.database.ServerValue.TIMESTAMP,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      lastActivity: admin.database.ServerValue.TIMESTAMP,
      callHistory: {},
      notifications: {}
    };

    await newStudentRef.set(student);
    logger.info(`Student created: ${newStudentRef.key}`);
    
    return { id: newStudentRef.key, ...student };
  } catch (error) {
    logger.error('Error creating student:', error);
    throw error;
  }
}

/**
 * Update student status and information
 */
async function updateStudent(studentId, updateData) {
  try {
    const studentRef = db.ref(`students/${studentId}`);
    
    // Check if student exists
    const snapshot = await studentRef.once('value');
    if (!snapshot.exists()) {
      throw new Error(`Student with ID ${studentId} does not exist`);
    }

    const updatedData = {
      ...updateData,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      lastActivity: admin.database.ServerValue.TIMESTAMP
    };

    await studentRef.update(updatedData);
    logger.info(`Student updated: ${studentId}`);
    
    // Get updated student data
    const updatedSnapshot = await studentRef.once('value');
    const updatedStudent = { id: updatedSnapshot.key, ...updatedSnapshot.val() };
    return updatedStudent;
  } catch (error) {
    logger.error('Error updating student:', error);
    throw error;
  }
}

/**
 * Get student by ID
 */
async function getStudent(studentId) {
  try {
    const studentRef = db.ref(`students/${studentId}`);
    const snapshot = await studentRef.once('value');
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return { id: snapshot.key, ...snapshot.val() };
  } catch (error) {
    logger.error('Error getting student:', error);
    throw error;
  }
}

/**
 * Get students with optional filters, pagination, and sorting
 *
 * @param {object} filters - Object containing filters (e.g., { status: 'pending', riskLevel: 'high' })
 * @param {number} limit - Number of results to return
 * @param {number} page - Page number for pagination
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 */
async function getStudents(filters = {}, limit = 50, page = 1, sortBy = 'createdAt', sortOrder = 'desc') {
  try {
    let studentsRef = db.ref('students');
    let query = studentsRef.orderByChild(sortBy);

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      query = query.equalTo(filters.status);
    }
    if (filters.riskLevel && filters.riskLevel !== 'all') {
      query = query.equalTo(filters.riskLevel);
    }
    // Note: Firebase Realtime Database does not support multiple `equalTo` filters
    // A more complex query or filtering client-side may be needed for multiple fields.
    // For now, this will prioritize filtering by `sortBy` field.

    // Handle sort order
    if (sortOrder === 'desc') {
      query = query.limitToLast(limit * page);
    } else {
      query = query.limitToFirst(limit * page);
    }

    const snapshot = await query.once('value');
    let students = [];
    
    snapshot.forEach((childSnapshot) => {
      students.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    // Manually slice for pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Reverse the array if sorting in descending order, as limitToLast returns the last N items
    if (sortOrder === 'desc') {
        students.reverse();
    }
    
    return students.slice(startIndex, endIndex);

  } catch (error) {
    logger.error('Error getting students:', error);
    throw error;
  }
}

/**
 * Log a call record
 */
async function logCall(callData) {
  try {
    const callsRef = db.ref('calls');
    const newCallRef = callsRef.push();
    
    const call = {
      ...callData,
      id: newCallRef.key,
      timestamp: admin.database.ServerValue.TIMESTAMP
    };

    await newCallRef.set(call);
    
    // Also update student's call history
    if (callData.studentId) {
      const studentCallRef = db.ref(`students/${callData.studentId}/callHistory/${newCallRef.key}`);
      await studentCallRef.set({
        callId: newCallRef.key,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        status: callData.status,
        duration: callData.duration || 0
      });
    }
    
    logger.info(`Call logged: ${newCallRef.key}`);
    return { id: newCallRef.key, ...call };
  } catch (error) {
    logger.error('Error logging call:', error);
    throw error;
  }
}

/**
 * Log a notification
 */
async function logNotification(notificationData) {
  try {
    const notificationsRef = db.ref('notifications');
    const newNotificationRef = notificationsRef.push();
    
    const notification = {
      ...notificationData,
      id: newNotificationRef.key,
      timestamp: admin.database.ServerValue.TIMESTAMP
    };

    await newNotificationRef.set(notification);
    
    // Also update student's notification history
    if (notificationData.studentId) {
      const studentNotificationRef = db.ref(`students/${notificationData.studentId}/notifications/${newNotificationRef.key}`);
      await studentNotificationRef.set({
        notificationId: newNotificationRef.key,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        type: notificationData.type,
        status: notificationData.status
      });
    }
    
    logger.info(`Notification logged: ${newNotificationRef.key}`);
    return { id: newNotificationRef.key, ...notification };
  } catch (error) {
    logger.error('Error logging notification:', error);
    throw error;
  }
}

/**
 * Get incomplete applications (for monitoring)
 */
async function getIncompleteApplications(timeThreshold = 24 * 60 * 60 * 1000) { // 24 hours default
  try {
    const studentsRef = db.ref('students');
    const snapshot = await studentsRef.once('value');
    
    const incompleteApplications = [];
    const cutoffTime = Date.now() - timeThreshold;
    
    snapshot.forEach((childSnapshot) => {
      const student = childSnapshot.val();
      
      // Check if application is incomplete and within time threshold
      if (student.status === 'inquiry_submitted' && student.createdAt < cutoffTime) {
        incompleteApplications.push({
          id: childSnapshot.key,
          ...student
        });
      }
    });
    
    return incompleteApplications;
  } catch (error) {
    logger.error('Error getting incomplete applications:', error);
    throw error;
  }
}

/**
 * Get analytics data
 */
async function getAnalytics(dateRange = 7) { // Default 7 days
  try {
    const cutoffTime = Date.now() - (dateRange * 24 * 60 * 60 * 1000);
    
    const studentsRef = db.ref('students');
    const callsRef = db.ref('calls');
    const notificationsRef = db.ref('notifications');

    // Use a Promise.all to fetch data concurrently
    const [studentsSnapshot, callsSnapshot, notificationsSnapshot] = await Promise.all([
      studentsRef.orderByChild('createdAt').startAt(cutoffTime).once('value'),
      callsRef.orderByChild('timestamp').startAt(cutoffTime).once('value'),
      notificationsRef.orderByChild('timestamp').startAt(cutoffTime).once('value')
    ]);

    const analytics = {
      dateRange,
      totalStudents: 0,
      totalCalls: 0,
      totalNotifications: 0,
      statusBreakdown: {},
      callStatusBreakdown: {},
      conversionRate: 0
    };
    
    // Process students
    studentsSnapshot.forEach((snapshot) => {
      const student = snapshot.val();
      analytics.totalStudents++;
      analytics.statusBreakdown[student.status] = (analytics.statusBreakdown[student.status] || 0) + 1;
    });
    
    // Process calls
    callsSnapshot.forEach((snapshot) => {
      const call = snapshot.val();
      analytics.totalCalls++;
      analytics.callStatusBreakdown[call.status] = (analytics.callStatusBreakdown[call.status] || 0) + 1;
    });
    
    // Process notifications
    notificationsSnapshot.forEach(() => {
      analytics.totalNotifications++;
    });
    
    // Calculate conversion rate
    const convertedStudents = (analytics.statusBreakdown['accepted'] || 0) + (analytics.statusBreakdown['enrolled'] || 0);
    analytics.conversionRate = analytics.totalStudents > 0 
      ? ((convertedStudents / analytics.totalStudents) * 100).toFixed(2)
      : 0;
    
    return analytics;
  } catch (error) {
    logger.error('Error getting analytics:', error);
    throw error;
  }
}

module.exports = {
  initializeFirebase,
  getDatabase,
  getFirebaseApp,
  createStudent,
  updateStudent,
  getStudent,
  getStudents, // Updated: Changed function name and signature
  logCall,
  logNotification,
  getIncompleteApplications,
  getAnalytics,
  testFirebaseConnection
};