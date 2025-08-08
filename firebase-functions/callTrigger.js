// firebase-functions/callTrigger.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin if not already done
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.database();

/**
 * Cloud Function: Trigger Voice Calls
 * HTTP endpoint that can be called to initiate voice calls for students
 */
exports.triggerVoiceCall = functions.https.onCall(async (data, context) => {
  try {
    console.log('🎯 Voice call trigger initiated');
    
    // Validate authentication (optional)
    // if (!context.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    // }
    
    // Extract and validate input data
    const { 
      studentId, 
      priority = 'medium', 
      reason = 'follow_up',
      immediateCall = false 
    } = data;
    
    if (!studentId) {
      throw new functions.https.HttpsError('invalid-argument', 'Student ID is required');
    }
    
    // Get student details from database
    const studentSnapshot = await db.ref(`students/${studentId}`).once('value');
    if (!studentSnapshot.exists()) {
      throw new functions.https.HttpsError('not-found', 'Student not found');
    }
    
    const student = studentSnapshot.val();
    console.log(`📋 Processing call trigger for student: ${student.name}`);
    
    // Validate student data
    if (!student.phone) {
      throw new functions.https.HttpsError('failed-precondition', 'Student phone number not available');
    }
    
    if (student.status === 'deleted') {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot call deleted student');
    }
    
    // Check call frequency limits
    const canCall = await checkCallFrequencyLimits(studentId, student);
    if (!canCall.allowed && !immediateCall) {
      throw new functions.https.HttpsError('resource-exhausted', canCall.reason);
    }
    
    // Determine call configuration based on priority and reason
    const callConfig = determineCallConfiguration(student, priority, reason);
    
    // Create the voice call
    const callResult = await initiateVoiceCall(studentId, student, callConfig);
    
    // Update student record
    await updateStudentCallRecord(studentId, callResult, callConfig);
    
    // Log the call trigger
    await logCallTrigger(studentId, student, callConfig, callResult);
    
    console.log(`✅ Voice call successfully triggered for student: ${student.name}`);
    
    return {
      success: true,
      callId: callResult.callId,
      studentId,
      studentName: student.name,
      priority,
      reason,
      message: 'Voice call initiated successfully'
    };
    
  } catch (error) {
    console.error('❌ Error in voice call trigger:', error);
    
    // Log error to Firebase
    await db.ref('system/callTriggerErrors').push({
      error: error.message,
      stack: error.stack,
      data,
      timestamp: Date.now()
    });
    
    // Re-throw HTTP errors as-is, wrap others
    if (error instanceof functions.https.HttpsError) {
      throw error;
    } else {
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
});

/**
 * Cloud Function: Batch Voice Call Trigger
 * Trigger calls for multiple students at once
 */
exports.batchTriggerVoiceCalls = functions.https.onCall(async (data, context) => {
  try {
    console.log('🎯 Batch voice call trigger initiated');
    
    const { 
      studentIds, 
      priority = 'medium', 
      reason = 'follow_up',
      batchName = 'manual_batch'
    } = data;
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Student IDs array is required');
    }
    
    if (studentIds.length > 50) {
      throw new functions.https.HttpsError('invalid-argument', 'Maximum 50 students per batch');
    }
    
    const results = [];
    const batchId = `batch_${Date.now()}`;
    
    console.log(`📦 Processing batch: ${batchName} with ${studentIds.length} students`);
    
    // Process each student
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      
      try {
        // Add delay between calls to avoid overwhelming the system
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
        
        const result = await exports.triggerVoiceCall.handler({
          studentId,
          priority,
          reason: `${reason}_batch`,
          immediateCall: false
        }, context);
        
        results.push({
          studentId,
          success: true,
          ...result
        });
        
      } catch (error) {
        console.error(`❌ Failed to trigger call for student ${studentId}:`, error);
        results.push({
          studentId,
          success: false,
          error: error.message
        });
      }
    }
    
    // Log batch results
    await db.ref('system/batchCallTriggers').push({
      batchId,
      batchName,
      totalStudents: studentIds.length,
      successCount: results.filter(r => r.success).length,
      failCount: results.filter(r => !r.success).length,
      priority,
      reason,
      timestamp: Date.now(),
      results
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Batch processing complete: ${successCount}/${studentIds.length} calls triggered`);
    
    return {
      success: true,
      batchId,
      totalStudents: studentIds.length,
      successCount,
      failCount: results.length - successCount,
      results
    };
    
  } catch (error) {
    console.error('❌ Error in batch voice call trigger:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Check if student can receive calls based on frequency limits
 */
async function checkCallFrequencyLimits(studentId, student) {
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const contactAttempts = student.contactAttempts || 0;
  
  // Rule 1: Maximum 3 calls per day
  if (student.lastCallDate) {
    const lastCallDate = new Date(student.lastCallDate).getTime();
    if (lastCallDate > todayStart && contactAttempts >= 3) {
      return {
        allowed: false,
        reason: 'Maximum daily call limit (3) reached'
      };
    }
  }
  
  // Rule 2: Wait at least 2 hours between calls
  if (student.lastCallAttempt) {
    const lastCallAttempt = new Date(student.lastCallAttempt).getTime();
    const twoHoursAgo = now - (2 * 60 * 60 * 1000);
    
    if (lastCallAttempt > twoHoursAgo) {
      return {
        allowed: false,
        reason: 'Must wait at least 2 hours between calls'
      };
    }
  }
  
  // Rule 3: Don't call during quiet hours (9 PM - 9 AM local time)
  const currentHour = new Date().getHours();
  if (currentHour < 9 || currentHour >= 21) {
    return {
      allowed: false,
      reason: 'Calls not allowed during quiet hours (9 PM - 9 AM)'
    };
  }
  
  // Rule 4: Don't call if student opted out
  if (student.callOptOut || student.communicationPreferences?.voiceCalls === false) {
    return {
      allowed: false,
      reason: 'Student has opted out of voice calls'
    };
  }
  
  return { allowed: true };
}

/**
 * Determine call configuration based on student and context
 */
function determineCallConfiguration(student, priority, reason) {
  const config = {
    priority,
    reason,
    maxDuration: 300, // 5 minutes default
    retryAttempts: 1,
    callbackNumber: functions.config().retell?.from_number || process.env.RETELL_FROM_NUMBER,
    agentConfig: {}
  };
  
  // Adjust based on priority
  switch (priority) {
    case 'high':
      config.maxDuration = 600; // 10 minutes
      config.retryAttempts = 2;
      config.agentConfig.urgency = 'high';
      break;
    case 'low':
      config.maxDuration = 180; // 3 minutes
      config.retryAttempts = 0;
      config.agentConfig.urgency = 'low';
      break;
    default: // medium
      config.agentConfig.urgency = 'medium';
  }
  
  // Adjust based on reason
  switch (reason) {
    case 'high_risk_intervention':
      config.agentConfig.script = 'supportive_intervention';
      config.agentConfig.emotion = 'empathetic';
      break;
    case 'document_assistance':
      config.agentConfig.script = 'helpful_guidance';
      config.agentConfig.focus = 'document_help';
      break;
    case 'payment_reminder':
      config.agentConfig.script = 'payment_assistance';
      config.agentConfig.focus = 'payment_options';
      break;
    default:
      config.agentConfig.script = 'general_followup';
  }
  
  // Adjust based on student history
  if (student.contactAttempts >= 2) {
    config.agentConfig.acknowledgePreviousAttempts = true;
  }
  
  if (student.lastCallStatus === 'no_answer') {
    config.agentConfig.messageType = 'brief_voicemail';
  }
  
  return config;
}

/**
 * Initiate the actual voice call via Retell AI
 */
async function initiateVoiceCall(studentId, student, callConfig) {
  try {
    // Call the server endpoint to create Retell call
    const serverUrl = functions.config().server?.base_url || process.env.BASE_URL;
    if (!serverUrl) {
      throw new Error('Server base URL not configured');
    }
    
    const response = await axios.post(`${serverUrl}/api/voice/create-call`, {
      studentId,
      toNumber: student.phone,
      studentName: student.name,
      inquiryType: student.inquiryType,
      applicationStatus: student.status,
      priority: callConfig.priority,
      reason: callConfig.reason,
      callType: 'automated_trigger',
      agentConfig: callConfig.agentConfig
    }, {
      headers: {
        'Authorization': `Bearer ${functions.config().api?.token || process.env.API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Call creation failed');
    }
    
    return {
      success: true,
      callId: response.data.call.id,
      retellCallId: response.data.call.id,
      status: 'initiated',
      initiatedAt: Date.now()
    };
    
  } catch (error) {
    console.error('❌ Failed to initiate voice call:', error);
    return {
      success: false,
      error: error.message,
      status: 'failed',
      failedAt: Date.now()
    };
  }
}

/**
 * Update student record with call information
 */
async function updateStudentCallRecord(studentId, callResult, callConfig) {
  const updates = {
    lastCallAttempt: Date.now(),
    lastCallReason: callConfig.reason,
    lastCallPriority: callConfig.priority,
    contactAttempts: admin.database.ServerValue.increment(1)
  };
  
  if (callResult.success) {
    updates.lastCallId = callResult.callId;
    updates.lastCallStatus = 'initiated';
  } else {
    updates.lastCallError = callResult.error;
    updates.lastCallStatus = 'failed';
  }
  
  await db.ref(`students/${studentId}`).update(updates);
  console.log(`📝 Updated student record for call: ${studentId}`);
}

/**
 * Log call trigger for analytics
 */
async function logCallTrigger(studentId, student, callConfig, callResult) {
  await db.ref('callTriggers').push({
    studentId,
    studentName: student.name,
    studentPhone: student.phone,
    studentStatus: student.status,
    priority: callConfig.priority,
    reason: callConfig.reason,
    success: callResult.success,
    callId: callResult.callId || null,
    error: callResult.error || null,
    triggeredAt: Date.now(),
    triggeredBy: 'cloud_function'
  });
}

/**
 * Cloud Function: Handle Call Status Updates
 * Process webhooks from Retell AI about call status changes
 */
exports.handleCallStatusUpdate = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    
    const callData = req.body;
    console.log('📞 Processing call status update:', callData.call_id);
    
    // Find student associated with this call
    const callsRef = db.ref('calls');
    const callSnapshot = await callsRef.orderByChild('retellCallId').equalTo(callData.call_id).once('value');
    
    if (!callSnapshot.exists()) {
      console.log('⚠️ Call not found in database:', callData.call_id);
      res.status(200).send('OK');
      return;
    }
    
    // Process each matching call record
    callSnapshot.forEach(async (snapshot) => {
      const call = snapshot.val();
      const studentId = call.studentId;
      
      // Update call record
      await db.ref(`calls/${snapshot.key}`).update({
        status: callData.call_status,
        endTime: callData.end_timestamp ? new Date(callData.end_timestamp).toISOString() : null,
        duration: callData.duration || 0,
        updatedAt: Date.now()
      });
      
      // Update student record
      const studentUpdates = {
        lastCallStatus: callData.call_status,
        lastCallEndTime: callData.end_timestamp ? new Date(callData.end_timestamp).toISOString() : null
      };
      
      if (callData.duration) {
        studentUpdates.lastCallDuration = callData.duration;
      }
      
      await db.ref(`students/${studentId}`).update(studentUpdates);
      
      console.log(`✅ Updated call status for student: ${studentId} - Status: ${callData.call_status}`);
    });
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error handling call status update:', error);
    res.status(500).send('Error');
  }
});

module.exports = exports;