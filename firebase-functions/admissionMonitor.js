// firebase-functions/admissionMonitor.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin if not already done
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.database();

/**
 * Cloud Function: Monitor Admission Applications
 * Triggers every 2 hours to check for incomplete applications and assess dropout risk
 */
exports.monitorAdmissionApplications = functions.pubsub
  .schedule('0 */2 * * *') // Every 2 hours
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('🔍 Starting admission application monitoring...');
    
    try {
      // Get current timestamp
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      
      // Fetch all active students
      const studentsRef = db.ref('students');
      const studentsSnapshot = await studentsRef
        .orderByChild('status')
        .once('value');
      
      const studentsToProcess = [];
      const riskAssessments = [];
      
      // Process each student
      studentsSnapshot.forEach((childSnapshot) => {
        const studentId = childSnapshot.key;
        const student = childSnapshot.val();
        
        // Skip deleted or completed applications
        if (student.status === 'deleted' || student.status === 'application_completed') {
          return;
        }
        
        // Calculate time metrics
        const daysSinceCreated = Math.floor((now - student.createdAt) / (1000 * 60 * 60 * 24));
        const daysSinceLastActivity = Math.floor((now - (student.lastActivity || student.createdAt)) / (1000 * 60 * 60 * 24));
        
        // Assess dropout risk
        const riskAssessment = assessDropoutRisk(student, daysSinceCreated, daysSinceLastActivity);
        
        // Add to processing queue if needs attention
        if (riskAssessment.needsIntervention) {
          studentsToProcess.push({
            studentId,
            student,
            riskAssessment,
            daysSinceCreated,
            daysSinceLastActivity
          });
        }
        
        riskAssessments.push({
          studentId,
          ...riskAssessment,
          assessedAt: now
        });
      });
      
      console.log(`📊 Processed ${riskAssessments.length} students, ${studentsToProcess.length} need intervention`);
      
      // Update risk assessments in database
      await updateRiskAssessments(riskAssessments);
      
      // Process students that need intervention
      for (const studentData of studentsToProcess) {
        await processStudentIntervention(studentData);
      }
      
      // Update monitoring statistics
      await updateMonitoringStats({
        runAt: now,
        studentsProcessed: riskAssessments.length,
        interventionsTriggered: studentsToProcess.length,
        highRiskCount: riskAssessments.filter(r => r.riskLevel === 'high').length,
        mediumRiskCount: riskAssessments.filter(r => r.riskLevel === 'medium').length
      });
      
      console.log('✅ Admission monitoring completed successfully');
      return null;
      
    } catch (error) {
      console.error('❌ Error in admission monitoring:', error);
      
      // Log error to Firebase
      await db.ref('system/errors').push({
        function: 'monitorAdmissionApplications',
        error: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
      
      throw error;
    }
  });

/**
 * Assess dropout risk for a student
 */
function assessDropoutRisk(student, daysSinceCreated, daysSinceLastActivity) {
  let riskScore = 0;
  let riskFactors = [];
  let interventionRecommendations = [];
  
  // Factor 1: Days since last activity
  if (daysSinceLastActivity >= 7) {
    riskScore += 4;
    riskFactors.push('No activity for 7+ days');
    interventionRecommendations.push('immediate_voice_call');
  } else if (daysSinceLastActivity >= 3) {
    riskScore += 2;
    riskFactors.push('No activity for 3+ days');
    interventionRecommendations.push('whatsapp_followup');
  } else if (daysSinceLastActivity >= 1) {
    riskScore += 1;
    riskFactors.push('No activity for 1+ days');
  }
  
  // Factor 2: Application status vs time created
  switch (student.status) {
    case 'inquiry_submitted':
      if (daysSinceCreated >= 3) {
        riskScore += 3;
        riskFactors.push('Inquiry not progressed after 3+ days');
        interventionRecommendations.push('document_guidance');
      } else if (daysSinceCreated >= 1) {
        riskScore += 1;
        riskFactors.push('Inquiry not progressed after 1+ days');
        interventionRecommendations.push('welcome_message');
      }
      break;
      
    case 'documents_pending':
      if (daysSinceLastActivity >= 5) {
        riskScore += 3;
        riskFactors.push('Documents pending for 5+ days');
        interventionRecommendations.push('document_reminder');
      } else if (daysSinceLastActivity >= 2) {
        riskScore += 2;
        riskFactors.push('Documents pending for 2+ days');
        interventionRecommendations.push('document_assistance');
      }
      break;
      
    case 'dropout_risk':
      riskScore += 5; // Already identified as high risk
      riskFactors.push('Previously identified as dropout risk');
      interventionRecommendations.push('counselor_escalation');
      break;
  }
  
  // Factor 3: Contact attempts
  const contactAttempts = student.contactAttempts || 0;
  if (contactAttempts >= 3) {
    riskScore += 2;
    riskFactors.push('Multiple contact attempts failed');
    interventionRecommendations.push('alternative_contact_method');
  } else if (contactAttempts >= 1) {
    riskScore += 1;
    riskFactors.push('Previous contact attempts made');
  }
  
  // Factor 4: Failed calls
  if (student.lastCallStatus === 'failed' || student.lastCallStatus === 'no_answer') {
    riskScore += 2;
    riskFactors.push('Recent call failed or no answer');
    interventionRecommendations.push('whatsapp_followup');
  }
  
  // Factor 5: Time since last successful contact
  if (student.lastCallStatus === 'completed' && student.lastCallDate) {
    const daysSinceLastCall = Math.floor((Date.now() - new Date(student.lastCallDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastCall >= 7) {
      riskScore += 2;
      riskFactors.push('No contact in 7+ days since last call');
      interventionRecommendations.push('followup_call');
    }
  }
  
  // Determine risk level
  let riskLevel = 'low';
  if (riskScore >= 6) {
    riskLevel = 'high';
  } else if (riskScore >= 3) {
    riskLevel = 'medium';
  }
  
  // Determine if intervention is needed
  const needsIntervention = riskLevel === 'high' || 
                           (riskLevel === 'medium' && daysSinceLastActivity >= 2) ||
                           (student.status === 'dropout_risk');
  
  return {
    riskScore,
    riskLevel,
    riskFactors,
    interventionRecommendations: [...new Set(interventionRecommendations)], // Remove duplicates
    needsIntervention,
    assessedAt: Date.now(),
    daysSinceCreated,
    daysSinceLastActivity
  };
}

/**
 * Update risk assessments in the database
 */
async function updateRiskAssessments(assessments) {
  const batch = {};
  
  for (const assessment of assessments) {
    const { studentId, ...assessmentData } = assessment;
    
    // Update student record
    batch[`students/${studentId}/riskAssessment`] = assessmentData;
    batch[`students/${studentId}/riskLevel`] = assessmentData.riskLevel;
    batch[`students/${studentId}/lastRiskAssessment`] = assessmentData.assessedAt;
    
    // Store historical risk data
    batch[`riskHistory/${studentId}/${assessmentData.assessedAt}`] = assessmentData;
  }
  
  await db.ref().update(batch);
  console.log(`📈 Updated risk assessments for ${assessments.length} students`);
}

/**
 * Process intervention for a student
 */
async function processStudentIntervention(studentData) {
  const { studentId, student, riskAssessment } = studentData;
  
  try {
    console.log(`🎯 Processing intervention for student: ${student.name} (Risk: ${riskAssessment.riskLevel})`);
    
    // Update student status if needed
    if (riskAssessment.riskLevel === 'high' && student.status !== 'counselor_required') {
      await db.ref(`students/${studentId}`).update({
        status: 'dropout_risk',
        riskLevel: riskAssessment.riskLevel,
        lastInterventionAt: Date.now()
      });
    }
    
    // Trigger interventions based on recommendations
    const interventions = [];
    
    for (const recommendation of riskAssessment.interventionRecommendations) {
      switch (recommendation) {
        case 'immediate_voice_call':
          interventions.push(await triggerVoiceCall(studentId, student, 'high', 'high_risk_intervention'));
          break;
          
        case 'whatsapp_followup':
          interventions.push(await triggerWhatsAppMessage(studentId, student, 'followUp'));
          break;
          
        case 'document_reminder':
          interventions.push(await triggerWhatsAppMessage(studentId, student, 'documentReminder'));
          break;
          
        case 'welcome_message':
          interventions.push(await triggerWhatsAppMessage(studentId, student, 'welcome'));
          break;
          
        case 'counselor_escalation':
          interventions.push(await triggerCounselorEscalation(studentId, student, riskAssessment));
          break;
          
        case 'document_assistance':
          interventions.push(await triggerWhatsAppMessage(studentId, student, 'documentReminder'));
          break;
          
        case 'followup_call':
          interventions.push(await triggerVoiceCall(studentId, student, 'medium', 'follow_up'));
          break;
          
        default:
          console.log(`⚠️ Unknown intervention recommendation: ${recommendation}`);
      }
    }
    
    // Log intervention
    await db.ref('interventions').push({
      studentId,
      studentName: student.name,
      riskLevel: riskAssessment.riskLevel,
      riskScore: riskAssessment.riskScore,
      riskFactors: riskAssessment.riskFactors,
      interventionsTriggered: interventions.filter(i => i.success).length,
      interventionsFailed: interventions.filter(i => !i.success).length,
      timestamp: Date.now(),
      processedBy: 'admissionMonitor'
    });
    
    console.log(`✅ Processed ${interventions.length} interventions for student: ${student.name}`);
    
  } catch (error) {
    console.error(`❌ Error processing intervention for student ${studentId}:`, error);
    
    // Log intervention error
    await db.ref('system/interventionErrors').push({
      studentId,
      error: error.message,
      timestamp: Date.now()
    });
  }
}

/**
 * Trigger voice call via n8n webhook
 */
async function triggerVoiceCall(studentId, student, priority, reason) {
  try {
    const webhookUrl = functions.config().n8n?.webhook_url || process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_URL not configured');
    }
    
    const response = await axios.post(`${webhookUrl}/voice-followup`, {
      event: 'voice_call_trigger',
      data: {
        studentId,
        studentName: student.name,
        studentPhone: student.phone,
        priority,
        reason,
        inquiryType: student.inquiryType,
        applicationStatus: student.status
      }
    });
    
    console.log(`📞 Voice call triggered for student: ${student.name}`);
    return { success: true, type: 'voice_call', response: response.data };
    
  } catch (error) {
    console.error(`❌ Failed to trigger voice call for student ${studentId}:`, error);
    return { success: false, type: 'voice_call', error: error.message };
  }
}

/**
 * Trigger WhatsApp message via n8n webhook
 */
async function triggerWhatsAppMessage(studentId, student, messageType) {
  try {
    const webhookUrl = functions.config().n8n?.webhook_url || process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_URL not configured');
    }
    
    const response = await axios.post(`${webhookUrl}/notification-sender`, {
      event: 'notification_send',
      data: {
        studentId,
        studentName: student.name,
        studentPhone: student.phone,
        studentEmail: student.email,
        notificationType: messageType,
        channel: 'whatsapp',
        urgency: 'normal'
      }
    });
    
    console.log(`💬 WhatsApp message (${messageType}) triggered for student: ${student.name}`);
    return { success: true, type: 'whatsapp_message', messageType, response: response.data };
    
  } catch (error) {
    console.error(`❌ Failed to trigger WhatsApp message for student ${studentId}:`, error);
    return { success: false, type: 'whatsapp_message', messageType, error: error.message };
  }
}

/**
 * Trigger counselor escalation via n8n webhook
 */
async function triggerCounselorEscalation(studentId, student, riskAssessment) {
  try {
    const webhookUrl = functions.config().n8n?.webhook_url || process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_URL not configured');
    }
    
    const response = await axios.post(`${webhookUrl}/counselor-escalation`, {
      event: 'counselor_escalation',
      data: {
        studentId,
        reason: riskAssessment.riskFactors.join(', '),
        urgency: riskAssessment.riskLevel,
        escalatedBy: 'admission_monitor',
        analysisData: riskAssessment
      }
    });
    
    console.log(`🚨 Counselor escalation triggered for student: ${student.name}`);
    return { success: true, type: 'counselor_escalation', response: response.data };
    
  } catch (error) {
    console.error(`❌ Failed to trigger counselor escalation for student ${studentId}:`, error);
    return { success: false, type: 'counselor_escalation', error: error.message };
  }
}

/**
 * Update monitoring statistics
 */
async function updateMonitoringStats(stats) {
  const statsRef = db.ref('system/monitoringStats');
  
  // Store current run stats
  await statsRef.child('lastRun').set(stats);
  
  // Store historical stats (keep last 100 runs)
  const historicalRef = statsRef.child('history');
  const snapshot = await historicalRef.limitToLast(99).once('value');
  const existingStats = snapshot.val() || {};
  
  // Add current stats
  existingStats[stats.runAt] = stats;
  
  // Update historical data
  await historicalRef.set(existingStats);
  
  console.log('📊 Monitoring statistics updated');
}

module.exports = exports;