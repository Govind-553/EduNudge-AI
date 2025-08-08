// server/services/voiceAgent.js
const winston = require('winston');
const { 
  createPhoneCall, 
  getCallDetails,
  generateStudentPrompt 
} = require('../config/retell');

const { analyzeStudentEmotion, generateVoiceScript } = require('../config/openai');
const { logCall, getStudent, updateStudent } = require('../config/firebase');
const StudentService = require('./studentService');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'voice-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Voice Service - Business logic for voice call operations
 */
class VoiceService {
  /**
   * Create and initiate a voice call
   */
  static async createCall(callData) {
    try {
      const {
        studentId,
        toNumber,
        studentName,
        inquiryType = 'general',
        applicationStatus = 'inquiry_submitted',
        priority = 'medium',
        reason = 'follow_up',
        callType = 'automated',
        agentConfig = {}
      } = callData;

      logger.info(`Creating voice call for student: ${studentId}`);

      // Validate required fields
      if (!studentId || !toNumber || !studentName) {
        throw new Error('Student ID, phone number, and name are required');
      }

      // Get student details for context
      const student = await StudentService.getStudentById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      // Generate personalized voice script
      const voiceScript = await generateVoiceScript(student, {
        reason,
        priority,
        callType,
        daysSinceInquiry: student.daysSinceCreated,
        contactAttempts: student.contactAttempts || 0
      });

      // Prepare call configuration
      const callConfig = {
        studentId,
        toNumber: student.phone,
        studentName: student.name,
        inquiryType: student.inquiryType,
        applicationStatus: student.status,
        priority,
        reason,
        callType,
        agentConfig: {
          ...agentConfig,
          customPrompt: voiceScript.script
        }
      };

      // Create the call via Retell
      const retellCall = await createPhoneCall(callConfig);

      // Log the call in our database
      const callRecord = await logCall({
        studentId,
        callId: retellCall.call_id,
        retellCallId: retellCall.call_id,
        status: 'initiated',
        toNumber: student.phone,
        fromNumber: process.env.RETELL_FROM_NUMBER,
        priority,
        reason,
        callType,
        voiceScript: voiceScript.script,
        initiatedAt: new Date().toISOString(),
        metadata: {
          inquiryType: student.inquiryType,
          applicationStatus: student.status,
          studentName: student.name
        }
      });

      // Update student record
      await updateStudent(studentId, {
        lastCallInitiated: new Date().toISOString(),
        lastCallId: retellCall.call_id,
        lastCallReason: reason,
        lastCallPriority: priority,
        contactAttempts: (student.contactAttempts || 0) + 1
      });

      logger.info(`Voice call created successfully: ${retellCall.call_id}`);

      return {
        status: 'success',
        call: {
          id: retellCall.call_id,
          retellCallId: retellCall.call_id,
          studentId,
          studentName: student.name,
          toNumber: student.phone,
          status: 'initiated',
          priority,
          reason,
          callType,
          initiatedAt: new Date().toISOString()
        },
        voiceScript: voiceScript.script
      };

    } catch (error) {
      logger.error('Error creating voice call:', error);
      
      // Log failed call attempt
      if (callData.studentId) {
        await logCall({
          studentId: callData.studentId,
          status: 'failed',
          error: error.message,
          failedAt: new Date().toISOString()
        });
      }

      return {
        status: 'error',
        message: error.message,
        error: error.message
      };
    }
  }

  /**
   * Get call status and details
   */
  static async getCallStatus(callId) {
    try {
      logger.info(`Getting call status: ${callId}`);

      // Get call details from Retell
      const callDetails = await getCallDetails(callId);

      return {
        status: 'success',
        call: {
          id: callDetails.call_id,
          status: callDetails.call_status,
          startTime: callDetails.start_timestamp,
          endTime: callDetails.end_timestamp,
          duration: callDetails.duration,
          toNumber: callDetails.to_number,
          fromNumber: callDetails.from_number
        }
      };

    } catch (error) {
      logger.error(`Error getting call status ${callId}:`, error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Process call completion
   */
  static async processCallCompletion(callData) {
    try {
      const {
        call_id,
        call_status,
        start_timestamp,
        end_timestamp,
        duration,
        transcript = '',
        analysis = {}
      } = callData;

      logger.info(`Processing call completion: ${call_id}`);

      // Find the call in our database
      const calls = await this.getCallsByRetellId(call_id);
      if (calls.length === 0) {
        logger.warn(`Call not found in database: ${call_id}`);
        return { status: 'warning', message: 'Call not found in database' };
      }

      const call = calls[0];
      const studentId = call.studentId;

      // Update call record
      await this.updateCallRecord(call.id, {
        status: call_status,
        endTime: end_timestamp ? new Date(end_timestamp).toISOString() : null,
        duration: duration || 0,
        transcript,
        retellAnalysis: analysis,
        completedAt: new Date().toISOString()
      });

      // Analyze call if we have transcript
      let emotionAnalysis = null;
      if (transcript && transcript.length > 10) {
        try {
          emotionAnalysis = await analyzeStudentEmotion({
            transcript,
            duration: duration || 0,
            summary: analysis.summary || '',
            responses: analysis.responses || []
          });

          // Update call with emotion analysis
          await this.updateCallRecord(call.id, {
            emotionAnalysis
          });

        } catch (analysisError) {
          logger.error('Error analyzing call emotion:', analysisError);
        }
      }

      // Update student record
      const studentUpdates = {
        lastCallStatus: call_status,
        lastCallEndTime: end_timestamp ? new Date(end_timestamp).toISOString() : null,
        lastCallDuration: duration || 0,
        lastActivity: new Date().toISOString()
      };

      if (emotionAnalysis) {
        studentUpdates.lastEmotionAnalysis = emotionAnalysis;
        studentUpdates.lastCallAnalysis = emotionAnalysis;

        // Check if counselor escalation is needed
        if (emotionAnalysis.needsSupport || emotionAnalysis.urgencyLevel === 'high') {
          studentUpdates.status = 'counselor_required';
          studentUpdates.escalationReason = 'call_analysis_escalation';
          studentUpdates.escalatedAt = new Date().toISOString();
        }
      }

      await updateStudent(studentId, studentUpdates);

      logger.info(`Call completion processed: ${call_id}`);

      return {
        status: 'success',
        callId: call_id,
        callStatus: call_status,
        duration: duration || 0,
        emotionAnalysis,
        escalated: studentUpdates.status === 'counselor_required'
      };

    } catch (error) {
      logger.error('Error processing call completion:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Get call history for a student
   */
  static async getCallHistory(studentId, limit = 50) {
    try {
      logger.info(`Getting call history for student: ${studentId}`);

      // This would typically query your database for call history
      // For now, return placeholder data
      return {
        status: 'success',
        studentId,
        calls: [],
        totalCount: 0
      };

    } catch (error) {
      logger.error(`Error getting call history for student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Get all recent calls
   */
  static async getRecentCalls(limit = 50, filters = {}) {
    try {
      const { status, priority, dateFrom, dateTo } = filters;
      
      logger.info(`Getting recent calls with limit: ${limit}`);

      // This would typically query your database for recent calls
      // For now, return placeholder data
      return {
        status: 'success',
        calls: [],
        totalCount: 0,
        filters
      };

    } catch (error) {
      logger.error('Error getting recent calls:', error);
      throw error;
    }
  }

  /**
   * Cancel an ongoing call
   */
  static async cancelCall(callId) {
    try {
      logger.info(`Cancelling call: ${callId}`);

      // In a real implementation, this would call Retell API to cancel the call
      // For now, just update our database
      await this.updateCallRecord(callId, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });

      return {
        status: 'success',
        message: 'Call cancelled successfully',
        callId
      };

    } catch (error) {
      logger.error(`Error cancelling call ${callId}:`, error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Retry a failed call
   */
  static async retryCall(originalCallId, retryReason = 'manual_retry') {
    try {
      logger.info(`Retrying call: ${originalCallId}`);

      // Get original call details
      const originalCall = await this.getCallById(originalCallId);
      if (!originalCall) {
        throw new Error('Original call not found');
      }

      // Create new call with same parameters
      const retryCallData = {
        studentId: originalCall.studentId,
        toNumber: originalCall.toNumber,
        studentName: originalCall.metadata?.studentName || 'Student',
        inquiryType: originalCall.metadata?.inquiryType || 'general',
        applicationStatus: originalCall.metadata?.applicationStatus || 'inquiry_submitted',
        priority: originalCall.priority,
        reason: `${originalCall.reason}_retry`,
        callType: 'retry',
        originalCallId: originalCallId,
        retryReason
      };

      const newCall = await this.createCall(retryCallData);

      // Update original call to mark as retried
      await this.updateCallRecord(originalCallId, {
        retried: true,
        retriedAt: new Date().toISOString(),
        retryCallId: newCall.call?.id
      });

      return newCall;

    } catch (error) {
      logger.error(`Error retrying call ${originalCallId}:`, error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Get call analytics
   */
  static async getCallAnalytics(dateRange = 7) {
    try {
      logger.info(`Getting call analytics for ${dateRange} days`);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      // This would typically query your database for call analytics
      // For now, return placeholder data
      const analytics = {
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        averageDuration: 0,
        completionRate: 0,
        byStatus: {
          completed: 0,
          failed: 0,
          no_answer: 0,
          busy: 0
        },
        byPriority: {
          high: 0,
          medium: 0,
          low: 0
        },
        emotionAnalysis: {
          positive: 0,
          neutral: 0,
          negative: 0
        }
      };

      return {
        status: 'success',
        analytics,
        dateRange
      };

    } catch (error) {
      logger.error('Error getting call analytics:', error);
      throw error;
    }
  }

  /**
   * Generate voice call report
   */
  static async generateCallReport(callId) {
    try {
      logger.info(`Generating call report: ${callId}`);

      const call = await this.getCallById(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      const student = await StudentService.getStudentById(call.studentId);
      
      const report = {
        callId,
        studentInfo: {
          id: student?.id,
          name: student?.name,
          phone: student?.phone,
          status: student?.status,
          inquiryType: student?.inquiryType
        },
        callDetails: {
          status: call.status,
          duration: call.duration,
          startTime: call.startTime,
          endTime: call.endTime,
          priority: call.priority,
          reason: call.reason
        },
        analysis: call.emotionAnalysis || null,
        transcript: call.transcript || null,
        recommendations: this.generateCallRecommendations(call, student)
      };

      return {
        status: 'success',
        report
      };

    } catch (error) {
      logger.error(`Error generating call report ${callId}:`, error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Generate recommendations based on call analysis
   */
  static generateCallRecommendations(call, student) {
    const recommendations = [];

    if (call.status === 'failed' || call.status === 'no_answer') {
      recommendations.push('Schedule a retry call at a different time');
      recommendations.push('Send a WhatsApp follow-up message');
    }

    if (call.duration && call.duration < 30) {
      recommendations.push('Call was very brief - consider a longer follow-up');
    }

    if (call.emotionAnalysis) {
      if (call.emotionAnalysis.emotion === 'frustrated' || call.emotionAnalysis.emotion === 'confused') {
        recommendations.push('Student needs additional support - consider counselor escalation');
      }
      
      if (call.emotionAnalysis.needsSupport) {
        recommendations.push('Escalate to human counselor for personalized assistance');
      }
    }

    if (student?.status === 'documents_pending') {
      recommendations.push('Send document upload reminder and assistance');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring student progress');
    }

    return recommendations;
  }

  // Helper methods for database operations
  static async getCallById(callId) {
    // Implementation would query database for call by ID
    return null;
  }

  static async getCallsByRetellId(retellCallId) {
    // Implementation would query database for calls by Retell ID
    return [];
  }

  static async updateCallRecord(callId, updates) {
    // Implementation would update call record in database
    logger.info(`Call record updated: ${callId}`, updates);
    return true;
  }
}

module.exports = VoiceService;