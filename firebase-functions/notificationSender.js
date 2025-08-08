// firebase-functions/notificationSender.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const winston = require('winston');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'notification-sender' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Cloud Function: Automated notification sender
 * Triggers based on Firestore changes and scheduled events
 */

/**
 * Scheduled function: Check for students requiring notifications
 * Runs every 30 minutes during business hours
 */
exports.scheduledNotificationSender = functions.pubsub
  .schedule('*/30 9-18 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      logger.info('🔔 Starting scheduled notification check...');

      // Get students requiring attention
      const studentsNeedingAttention = await getStudentsRequiringAttention();
      logger.info(`Found ${studentsNeedingAttention.length} students needing attention`);

      // Process each student
      const results = [];
      for (const student of studentsNeedingAttention) {
        try {
          const result = await processStudentNotifications(student);
          results.push({ studentId: student.id, success: true, result });
        } catch (error) {
          logger.error(`Error processing student ${student.id}:`, error);
          results.push({ studentId: student.id, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info(`✅ Scheduled notifications completed: ${successCount}/${results.length} successful`);

      return { success: true, processed: results.length, successful: successCount };

    } catch (error) {
      logger.error('❌ Error in scheduled notification sender:', error);
      throw new functions.https.HttpsError('internal', 'Scheduled notification failed', error.message);
    }
  });

/**
 * Firestore trigger: Student status change notifications
 * Triggers when a student document is updated
 */
exports.onStudentStatusChange = functions.firestore
  .document('students/{studentId}')
  .onUpdate(async (change, context) => {
    try {
      const studentId = context.params.studentId;
      const before = change.before.data();
      const after = change.after.data();

      logger.info(`📊 Student status change detected: ${studentId}`);

      // Check if status actually changed
      if (before.status === after.status) {
        logger.info('No status change detected, skipping notification');
        return null;
      }

      logger.info(`Status changed: ${before.status} -> ${after.status}`);

      // Determine notification type based on status change
      const notificationType = determineNotificationType(before.status, after.status);
      
      if (notificationType) {
        const notification = await sendStatusChangeNotification(after, notificationType);
        
        // Log the notification
        await logNotificationToFirestore({
          studentId,
          type: 'status_change',
          trigger: 'firestore_update',
          oldStatus: before.status,
          newStatus: after.status,
          notificationType,
          success: notification.success,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return notification;
      }

      return null;

    } catch (error) {
      logger.error('Error in student status change handler:', error);
      throw error;
    }
  });

/**
 * Firestore trigger: New student welcome notifications
 * Triggers when a new student document is created
 */
exports.onNewStudent = functions.firestore
  .document('students/{studentId}')
  .onCreate(async (snap, context) => {
    try {
      const studentId = context.params.studentId;
      const studentData = snap.data();

      logger.info(`🎉 New student created: ${studentId} - ${studentData.name}`);

      // Send welcome notification after a short delay (5 minutes)
      setTimeout(async () => {
        try {
          await sendWelcomeNotification(studentData);
          
          // Schedule follow-up reminder for 24 hours
          await scheduleFollowUpReminder(studentData, 24 * 60 * 60 * 1000);

          logger.info(`✅ Welcome notification sent to ${studentData.name}`);
        } catch (error) {
          logger.error(`❌ Error sending welcome notification to ${studentId}:`, error);
        }
      }, 5 * 60 * 1000); // 5 minutes delay

      return { success: true, studentId, action: 'welcome_scheduled' };

    } catch (error) {
      logger.error('Error in new student handler:', error);
      throw error;
    }
  });

/**
 * HTTP Cloud Function: Manual notification trigger
 * Allows manual triggering of notifications via API call
 */
exports.sendManualNotification = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Verify API token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (token !== functions.config().api.token) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }

    const { studentId, notificationType, customMessage, priority = 'medium' } = req.body;

    if (!studentId || !notificationType) {
      res.status(400).json({ error: 'Missing required fields: studentId, notificationType' });
      return;
    }

    logger.info(`📱 Manual notification request: ${notificationType} for student ${studentId}`);

    // Get student data
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const studentData = studentDoc.data();

    // Send notification
    const result = await sendNotificationByType(studentData, notificationType, {
      customMessage,
      priority,
      manual: true
    });

    // Log the manual notification
    await logNotificationToFirestore({
      studentId,
      type: 'manual_notification',
      trigger: 'manual_api',
      notificationType,
      priority,
      success: result.success,
      customMessage,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ Manual notification completed: ${result.success ? 'success' : 'failed'}`);

    res.status(200).json({
      success: result.success,
      message: 'Notification processed',
      studentId,
      notificationType,
      result
    });

  } catch (error) {
    logger.error('Error in manual notification handler:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * Cloud Function: Process failed notifications retry
 * Scheduled to run every 4 hours to retry failed notifications
 */
exports.retryFailedNotifications = functions.pubsub
  .schedule('0 */4 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      logger.info('🔄 Starting failed notification retry process...');

      // Get failed notifications from the last 24 hours
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const failedNotificationsSnapshot = await db.collection('notifications')
        .where('status', '==', 'failed')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(cutoffTime))
        .where('retryCount', '<', 3)
        .limit(50)
        .get();

      if (failedNotificationsSnapshot.empty) {
        logger.info('No failed notifications to retry');
        return { success: true, retried: 0 };
      }

      logger.info(`Found ${failedNotificationsSnapshot.size} failed notifications to retry`);

      const retryResults = [];
      
      for (const doc of failedNotificationsSnapshot.docs) {
        const notification = doc.data();
        
        try {
          // Get current student data
          const studentDoc = await db.collection('students').doc(notification.studentId).get();
          if (!studentDoc.exists) {
            logger.warn(`Student ${notification.studentId} not found, skipping retry`);
            continue;
          }

          const studentData = studentDoc.data();
          
          // Retry the notification
          const retryResult = await sendNotificationByType(
            studentData, 
            notification.notificationType,
            { 
              retry: true,
              originalFailure: notification.error 
            }
          );

          // Update notification record
          await doc.ref.update({
            retryCount: (notification.retryCount || 0) + 1,
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
            status: retryResult.success ? 'sent' : 'failed',
            lastError: retryResult.success ? null : retryResult.error
          });

          retryResults.push({
            notificationId: doc.id,
            studentId: notification.studentId,
            success: retryResult.success
          });

        } catch (error) {
          logger.error(`Error retrying notification ${doc.id}:`, error);
          
          // Update retry count even on error
          await doc.ref.update({
            retryCount: (notification.retryCount || 0) + 1,
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
            lastError: error.message
          });

          retryResults.push({
            notificationId: doc.id,
            studentId: notification.studentId,
            success: false
          });
        }
      }

      const successfulRetries = retryResults.filter(r => r.success).length;
      
      logger.info(`✅ Retry process completed: ${successfulRetries}/${retryResults.length} successful`);

      return { 
        success: true, 
        totalAttempted: retryResults.length,
        successful: successfulRetries
      };

    } catch (error) {
      logger.error('❌ Error in retry failed notifications:', error);
      throw new functions.https.HttpsError('internal', 'Retry process failed', error.message);
    }
  });

// Helper functions

/**
 * Get students that require attention/notifications
 */
async function getStudentsRequiringAttention() {
  const students = [];
  
  // Query for high-risk students
  const highRiskQuery = db.collection('students')
    .where('riskLevel', '==', 'high')
    .where('status', 'not-in', ['enrolled', 'deleted'])
    .limit(20);

  // Query for students with no recent activity
  const staleActivityCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
  const staleQuery = db.collection('students')
    .where('lastActivity', '<=', admin.firestore.Timestamp.fromDate(staleActivityCutoff))
    .where('status', 'not-in', ['enrolled', 'deleted'])
    .limit(30);

  // Query for students with pending documents
  const pendingDocsQuery = db.collection('students')
    .where('status', '==', 'documents_pending')
    .limit(25);

  const [highRiskSnapshot, staleSnapshot, pendingDocsSnapshot] = await Promise.all([
    highRiskQuery.get(),
    staleQuery.get(),
    pendingDocsQuery.get()
  ]);

  // Combine results and deduplicate
  const studentIds = new Set();
  
  [highRiskSnapshot, staleSnapshot, pendingDocsSnapshot].forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      if (!studentIds.has(doc.id)) {
        studentIds.add(doc.id);
        students.push({ id: doc.id, ...doc.data() });
      }
    });
  });

  return students;
}

/**
 * Process notifications for a student
 */
async function processStudentNotifications(student) {
  const notifications = [];

  // Determine what notifications to send
  if (student.riskLevel === 'high') {
    notifications.push('high_risk_intervention');
  }

  if (student.status === 'documents_pending') {
    const daysSinceUpdate = calculateDaysSince(student.updatedAt?.toDate() || student.createdAt?.toDate());
    if (daysSinceUpdate >= 2) {
      notifications.push('document_reminder');
    }
  }

  if (student.lastActivity) {
    const daysSinceActivity = calculateDaysSince(student.lastActivity.toDate());
    if (daysSinceActivity >= 3) {
      notifications.push('follow_up');
    }
  }

  // Send notifications
  const results = [];
  for (const notificationType of notifications) {
    try {
      const result = await sendNotificationByType(student, notificationType);
      results.push({ type: notificationType, success: result.success });
    } catch (error) {
      results.push({ type: notificationType, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Send notification based on type
 */
async function sendNotificationByType(studentData, notificationType, options = {}) {
  const { customMessage, priority = 'medium', manual = false, retry = false } = options;

  try {
    // Prepare notification data
    const notificationData = {
      studentId: studentData.id || 'unknown',
      studentName: studentData.name,
      studentPhone: studentData.phone,
      studentEmail: studentData.email,
      notificationType,
      priority,
      manual,
      retry
    };

    // Add custom message if provided
    if (customMessage) {
      notificationData.customMessage = customMessage;
    }

    // Call the main server API to send notification
    const serverUrl = functions.config().server?.url || 'https://your-server.com';
    const apiToken = functions.config().api?.token || 'default-token';

    const response = await axios.post(`${serverUrl}/api/notifications/send`, {
      to: studentData.phone,
      studentId: studentData.id,
      templateType: notificationType,
      variables: {
        studentName: studentData.name,
        inquiryType: studentData.inquiryType || 'program',
        applicationStatus: studentData.status || 'in_progress'
      },
      priority,
      customMessage
    }, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.data.success) {
      logger.info(`✅ Notification sent successfully: ${notificationType} to ${studentData.name}`);
      return { success: true, response: response.data };
    } else {
      logger.error(`❌ Notification failed: ${notificationType} to ${studentData.name}`, response.data);
      return { success: false, error: response.data.error };
    }

  } catch (error) {
    logger.error(`❌ Error sending ${notificationType} notification:`, error);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
}

/**
 * Determine notification type based on status change
 */
function determineNotificationType(oldStatus, newStatus) {
  const statusChangeMap = {
    'inquiry_submitted_to_documents_pending': 'document_requirements',
    'documents_pending_to_application_in_progress': 'application_received',
    'application_in_progress_to_interview_scheduled': 'interview_scheduled',
    'interview_scheduled_to_accepted': 'acceptance_congratulations',
    'accepted_to_enrolled': 'enrollment_confirmation',
    'any_to_dropout_risk': 'urgent_intervention',
    'any_to_counselor_required': 'counselor_assignment'
  };

  const changeKey = `${oldStatus}_to_${newStatus}`;
  
  return statusChangeMap[changeKey] || 
         statusChangeMap[`any_to_${newStatus}`] || 
         null;
}

/**
 * Send welcome notification to new student
 */
async function sendWelcomeNotification(studentData) {
  return await sendNotificationByType(studentData, 'welcome', {
    priority: 'high'
  });
}

/**
 * Send status change notification
 */
async function sendStatusChangeNotification(studentData, notificationType) {
  return await sendNotificationByType(studentData, notificationType, {
    priority: 'medium'
  });
}

/**
 * Schedule follow-up reminder
 */
async function scheduleFollowUpReminder(studentData, delayMs) {
  // In a production environment, you would use Cloud Tasks or similar
  // For now, we'll log the scheduling
  logger.info(`📅 Scheduling follow-up reminder for ${studentData.name} in ${delayMs}ms`);
  
  // Store scheduled reminder in Firestore
  await db.collection('scheduled_notifications').add({
    studentId: studentData.id,
    type: 'follow_up_reminder',
    scheduledFor: new Date(Date.now() + delayMs),
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Log notification to Firestore
 */
async function logNotificationToFirestore(notificationData) {
  try {
    await db.collection('notification_logs').add({
      ...notificationData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Error logging notification to Firestore:', error);
  }
}

/**
 * Calculate days since a date
 */
function calculateDaysSince(date) {
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// Export individual functions for testing
module.exports = {
  scheduledNotificationSender: exports.scheduledNotificationSender,
  onStudentStatusChange: exports.onStudentStatusChange,
  onNewStudent: exports.onNewStudent,
  sendManualNotification: exports.sendManualNotification,
  retryFailedNotifications: exports.retryFailedNotifications
};