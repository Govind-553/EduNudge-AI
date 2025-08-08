// firebase-functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Get references to Firebase services
const db = admin.database();

/**
 * Cloud Function: Monitor Admission Applications
 * Triggers every 2 hours to check for incomplete applications
 */
exports.monitorAdmissionApplications = functions.pubsub
  .schedule('0 */2 * * *') // Every 2 hours
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      console.log('Starting admission monitoring...');
      
      // Get students with inquiry_submitted status older than 24 hours
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const studentsRef = db.ref('students');
      
      const snapshot = await studentsRef
        .orderByChild('status')
        .equalTo('inquiry_submitted')
        .once('value');
      
      const incompleteStudents = [];
      
      snapshot.forEach((childSnapshot) => {
        const student = childSnapshot.val();
        if (student.createdAt < cutoffTime) {
          incompleteStudents.push({
            id: childSnapshot.key,
            ...student
          });
        }
      });
      
      console.log(`Found ${incompleteStudents.length} incomplete applications`);
      
      // Process each incomplete application
      for (const student of incompleteStudents) {
        await processIncompleteApplication(student);
      }
      
      return null;
    } catch (error) {
      console.error('Error in admission monitoring:', error);
      throw error;
    }
  });

/**
 * Cloud Function: Trigger Voice Call
 * HTTP function to initiate voice calls via Retell AI
 */
exports.triggerVoiceCall = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    
    const { studentId, priority = 'medium', reason = 'follow_up' } = data;
    
    // Get student data
    const studentSnapshot = await db.ref(`students/${studentId}`).once('value');
    if (!studentSnapshot.exists()) {
      throw new functions.https.HttpsError('not-found', 'Student not found');
    }
    
    const student = studentSnapshot.val();
    
    // Trigger n8n workflow for voice call
    await triggerN8nWorkflow('voice_call_trigger', {
      studentId,
      studentName: student.name,
      studentPhone: student.phone,
      priority,
      reason,
      inquiryType: student.inquiryType,
      applicationStatus: student.status
    });
    
    // Log the call trigger
    await logActivity({
      type: 'voice_call_triggered',
      studentId,
      priority,
      reason,
      triggeredBy: context.auth.uid
    });
    
    return { 
      success: true, 
      message: 'Voice call triggered successfully',
      studentId,
      priority
    };
    
  } catch (error) {
    console.error('Error triggering voice call:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Send WhatsApp Notification
 * HTTP function to send WhatsApp messages
 */
exports.sendWhatsAppNotification = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    
    const { studentId, messageType, customMessage, urgency = 'normal' } = data;
    
    // Get student data
    const studentSnapshot = await db.ref(`students/${studentId}`).once('value');
    if (!studentSnapshot.exists()) {
      throw new functions.https.HttpsError('not-found', 'Student not found');
    }
    
    const student = studentSnapshot.val();
    
    // Send notification via n8n workflow
    await triggerN8nWorkflow('notification_send', {
      studentId,
      studentName: student.name,
      studentPhone: student.phone,
      notificationType: messageType,
      customMessage,
      channel: 'whatsapp',
      urgency
    });
    
    // Log the notification
    await logActivity({
      type: 'whatsapp_notification_sent',
      studentId,
      messageType,
      urgency,
      triggeredBy: context.auth.uid
    });
    
    return { 
      success: true, 
      message: 'WhatsApp notification sent successfully',
      studentId,
      messageType
    };
    
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Process Call Results
 * Triggered when a voice call is completed
 */
exports.processCallResults = functions.database
  .ref('/calls/{callId}')
  .onCreate(async (snapshot, context) => {
    try {
      const callData = snapshot.val();
      const callId = context.params.callId;
      
      console.log('Processing call results for:', callId);
      
      // Update student record with call results
      if (callData.studentId) {
        const updateData = {
          lastCallDate: new Date().toISOString(),
          lastCallStatus: callData.status,
          lastCallDuration: callData.duration || 0,
          contactAttempts: admin.database.ServerValue.increment(1)
        };
        
        // Add call analysis if available
        if (callData.analysis) {
          updateData.lastCallAnalysis = callData.analysis;
          
          // Check if escalation is needed
          if (callData.analysis.requiresCounselorFollowUp) {
            await triggerCounselorEscalation(callData.studentId, {
              reason: 'call_analysis_recommendation',
              urgency: 'high',
              callId
            });
          }
        }
        
        await db.ref(`students/${callData.studentId}`).update(updateData);
      }
      
      // Schedule follow-up if call was unsuccessful
      if (callData.status === 'failed' || callData.status === 'no_answer') {
        await scheduleFollowUp(callData.studentId, {
          type: 'voice_retry',
          scheduledFor: Date.now() + (24 * 60 * 60 * 1000), // 24 hours later
          reason: `Previous call ${callData.status}`
        });
      }
      
      return null;
    } catch (error) {
      console.error('Error processing call results:', error);
      throw error;
    }
  });

/**
 * Cloud Function: Generate Daily Analytics
 * Runs daily to generate analytics reports
 */
exports.generateDailyAnalytics = functions.pubsub
  .schedule('0 9 * * *') // Daily at 9 AM
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      console.log('Generating daily analytics...');
      
      const today = new Date();
      const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
      
      // Get all students created yesterday
      const studentsSnapshot = await db.ref('students')
        .orderByChild('createdAt')
        .startAt(yesterday.getTime())
        .endAt(today.getTime())
        .once('value');
      
      // Get all calls made yesterday
      const callsSnapshot = await db.ref('calls')
        .orderByChild('timestamp')
        .startAt(yesterday.getTime())
        .endAt(today.getTime())
        .once('value');
      
      // Get all notifications sent yesterday
      const notificationsSnapshot = await db.ref('notifications')
        .orderByChild('timestamp')
        .startAt(yesterday.getTime())
        .endAt(today.getTime())
        .once('value');
      
      // Calculate analytics
      const analytics = {
        date: yesterday.toISOString().split('T')[0],
        newInquiries: 0,
        totalCalls: 0,
        successfulCalls: 0,
        totalNotifications: 0,
        conversions: 0,
        riskLevels: { high: 0, medium: 0, low: 0 },
        generatedAt: new Date().toISOString()
      };
      
      // Process students
      studentsSnapshot.forEach((snapshot) => {
        const student = snapshot.val();
        analytics.newInquiries++;
        
        if (student.status === 'application_completed') {
          analytics.conversions++;
        }
        
        if (student.riskLevel) {
          analytics.riskLevels[student.riskLevel]++;
        }
      });
      
      // Process calls
      callsSnapshot.forEach((snapshot) => {
        const call = snapshot.val();
        analytics.totalCalls++;
        
        if (call.status === 'completed') {
          analytics.successfulCalls++;
        }
      });
      
      // Process notifications
      notificationsSnapshot.forEach(() => {
        analytics.totalNotifications++;
      });
      
      // Calculate conversion rate
      analytics.conversionRate = analytics.newInquiries > 0 
        ? (analytics.conversions / analytics.newInquiries * 100).toFixed(2)
        : 0;
      
      // Save analytics
      await db.ref(`analytics/daily/${analytics.date}`).set(analytics);
      
      // Send summary to administrators
      await sendAnalyticsSummary(analytics);
      
      console.log('Daily analytics generated:', analytics);
      return null;
      
    } catch (error) {
      console.error('Error generating daily analytics:', error);
      throw error;
    }
  });

/**
 * Cloud Function: Cleanup Old Data
 * Runs weekly to clean up old records
 */
exports.cleanupOldData = functions.pubsub
  .schedule('0 2 * * 0') // Weekly on Sunday at 2 AM
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      console.log('Starting data cleanup...');
      
      const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days ago
      
      // Clean up old completed applications
      const studentsRef = db.ref('students');
      const oldStudentsSnapshot = await studentsRef
        .orderByChild('updatedAt')
        .endAt(cutoffTime)
        .once('value');
      
      const cleanupPromises = [];
      
      oldStudentsSnapshot.forEach((snapshot) => {
        const student = snapshot.val();
        
        // Only clean up completed or cancelled applications
        if (student.status === 'application_completed' || student.status === 'application_cancelled') {
          // Archive instead of delete
          cleanupPromises.push(
            db.ref(`archived_students/${snapshot.key}`).set({
              ...student,
              archivedAt: new Date().toISOString()
            }).then(() => {
              return db.ref(`students/${snapshot.key}`).remove();
            })
          );
        }
      });
      
      // Clean up old logs
      const logsRef = db.ref('logs');
      const oldLogsSnapshot = await logsRef
        .orderByChild('timestamp')
        .endAt(cutoffTime)
        .once('value');
      
      oldLogsSnapshot.forEach((snapshot) => {
        cleanupPromises.push(
          db.ref(`logs/${snapshot.key}`).remove()
        );
      });
      
      await Promise.all(cleanupPromises);
      
      console.log(`Cleaned up ${cleanupPromises.length} old records`);
      return null;
      
    } catch (error) {
      console.error('Error in data cleanup:', error);
      throw error;
    }
  });

/**
 * Helper function: Process incomplete application
 */
async function processIncompleteApplication(student) {
  try {
    const daysSinceInquiry = Math.floor((Date.now() - student.createdAt) / (1000 * 60 * 60 * 24));
    const daysSinceLastActivity = Math.floor((Date.now() - (student.lastActivity || student.createdAt)) / (1000 * 60 * 60 * 24));
    
    // Calculate risk level
    let riskLevel = 'low';
    if (daysSinceLastActivity >= 5) riskLevel = 'high';
    else if (daysSinceLastActivity >= 2) riskLevel = 'medium';
    
    // Update student with risk assessment
    await db.ref(`students/${student.id}`).update({
      riskLevel,
      daysSinceInquiry,
      daysSinceLastActivity,
      lastRiskAssessment: new Date().toISOString()
    });
    
    // Trigger appropriate action based on risk level
    if (riskLevel === 'high') {
      await triggerN8nWorkflow('voice_call_trigger', {
        studentId: student.id,
        priority: 'high',
        reason: 'high_dropout_risk'
      });
    } else if (riskLevel === 'medium') {
      await triggerN8nWorkflow('notification_send', {
        studentId: student.id,
        notificationType: 'followUp',
        channel: 'whatsapp'
      });
    }
    
    console.log(`Processed incomplete application for student: ${student.id}, Risk: ${riskLevel}`);
    
  } catch (error) {
    console.error(`Error processing incomplete application for student ${student.id}:`, error);
  }
}

/**
 * Helper function: Trigger n8n workflow
 */
async function triggerN8nWorkflow(workflowName, data) {
  try {
    const n8nWebhookUrl = functions.config().n8n?.webhook_url;
    
    if (!n8nWebhookUrl) {
      console.warn('n8n webhook URL not configured');
      return;
    }
    
    const response = await axios.post(`${n8nWebhookUrl}/${workflowName}`, {
      event: workflowName,
      data,
      timestamp: new Date().toISOString(),
      source: 'firebase-functions'
    });
    
    console.log(`Triggered n8n workflow: ${workflowName}`);
    return response.data;
    
  } catch (error) {
    console.error(`Error triggering n8n workflow ${workflowName}:`, error);
    throw error;
  }
}

/**
 * Helper function: Trigger counselor escalation
 */
async function triggerCounselorEscalation(studentId, escalationData) {
  try {
    await triggerN8nWorkflow('counselor_escalation', {
      studentId,
      ...escalationData,
      escalatedAt: new Date().toISOString()
    });
    
    // Update student status
    await db.ref(`students/${studentId}`).update({
      status: 'counselor_required',
      escalationReason: escalationData.reason,
      escalatedAt: new Date().toISOString()
    });
    
    console.log(`Escalated student ${studentId} to counselor`);
    
  } catch (error) {
    console.error(`Error escalating student ${studentId}:`, error);
  }
}

/**
 * Helper function: Schedule follow-up
 */
async function scheduleFollowUp(studentId, followUpData) {
  try {
    const followUpRef = db.ref('follow_ups').push();
    
    await followUpRef.set({
      studentId,
      ...followUpData,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    });
    
    console.log(`Scheduled follow-up for student ${studentId}`);
    
  } catch (error) {
    console.error(`Error scheduling follow-up for student ${studentId}:`, error);
  }
}

/**
 * Helper function: Log activity
 */
async function logActivity(activityData) {
  try {
    const logRef = db.ref('logs').push();
    
    await logRef.set({
      ...activityData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

/**
 * Helper function: Send analytics summary
 */
async function sendAnalyticsSummary(analytics) {
  try {
    // This could send email, Slack notification, etc.
    console.log('Analytics Summary:', analytics);
    
    // Example: Trigger n8n workflow to send summary
    await triggerN8nWorkflow('analytics_summary', {
      analytics,
      reportType: 'daily'
    });
    
  } catch (error) {
    console.error('Error sending analytics summary:', error);
  }
}