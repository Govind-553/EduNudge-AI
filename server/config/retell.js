// server/config/retell.js
const { Retell } = require('retell-sdk');
const winston = require('winston');

// Configure logger for this module
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'retell-config' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

let retellClient = null;

/**
 * Initialize Retell AI client
 */
async function initializeRetell() {
  try {
    // Check if Retell is already initialized
    if (retellClient) {
      logger.info('Retell AI already initialized');
      return retellClient;
    }

    // Validate required environment variables
    if (!process.env.RETELL_API_KEY) {
      throw new Error('RETELL_API_KEY environment variable is required');
    }

    // Initialize Retell client
    retellClient = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    // Test the connection
    await testRetellConnection();

    logger.info('Retell AI initialized successfully');
    return retellClient;

  } catch (error) {
    logger.error('Error initializing Retell AI:', error);
    throw error;
  }
}

/**
 * Test Retell AI connection
 */
async function testRetellConnection() {
  try {
    // Try to list agents to test connection
    const agents = await retellClient.agent.list({ limit: 1 });
    logger.info('Retell AI connection test successful');
    return true;
  } catch (error) {
    logger.error('Retell AI connection test failed:', error);
    throw error;
  }
}

/**
 * Get Retell client instance
 */
function getRetellClient() {
  if (!retellClient) {
    throw new Error('Retell AI not initialized. Call initializeRetell() first.');
  }
  return retellClient;
}

/**
 * Create a new phone call using Retell AI
 */
async function createPhoneCall(callData) {
  try {
    const client = getRetellClient();
    
    const callParams = {
      from_number: process.env.RETELL_FROM_NUMBER,
      to_number: callData.toNumber,
      override_agent_id: callData.agentId || process.env.RETELL_DEFAULT_AGENT_ID,
      retell_llm_dynamic_variables: {
        student_name: callData.studentName || '',
        inquiry_type: callData.inquiryType || '',
        application_status: callData.applicationStatus || '',
        institution_name: process.env.INSTITUTION_NAME || 'Our Institution',
        counselor_name: callData.counselorName || 'Support Team'
      },
      metadata: {
        student_id: callData.studentId,
        call_type: 'follow_up',
        initiated_by: 'system',
        timestamp: new Date().toISOString()
      }
    };

    const response = await client.call.createPhoneCall(callParams);
    
    logger.info(`Created phone call: ${response.call_id}`);
    return response;

  } catch (error) {
    logger.error('Error creating phone call:', error);
    throw error;
  }
}

/**
 * Create or update an agent with emotion-aware capabilities
 */
async function createEmotionAwareAgent(agentConfig) {
  try {
    const client = getRetellClient();

    // Create LLM configuration with emotion awareness
    const llmConfig = {
      model: 'gpt-4o',
      general_prompt: generateEmotionAwarePrompt(agentConfig),
      general_tools: [
        {
          type: 'end_call',
          name: 'end_call',
          description: 'End the call when the conversation is complete or if the student requests it.'
        },
        {
          type: 'transfer_call',
          name: 'transfer_to_counselor',
          description: 'Transfer the call to a human counselor when needed.',
          transfer_destination: {
            type: 'predefined',
            number: process.env.COUNSELOR_PHONE_NUMBER
          }
        }
      ],
      states: [
        {
          name: 'initial_engagement',
          state_prompt: `You are starting a friendly conversation with a prospective student. 
                        Be warm, empathetic, and understanding. Listen for emotional cues in their voice.
                        If they sound confused, provide clear explanations.
                        If they sound hesitant, offer reassurance and support.
                        If they sound frustrated, acknowledge their feelings and offer help.`,
          edges: [
            {
              destination_state_name: 'information_gathering',
              description: 'Move to gathering more information about their inquiry.'
            },
            {
              destination_state_name: 'concern_addressing',
              description: 'Address specific concerns or hesitations they express.'
            }
          ]
        },
        {
          name: 'information_gathering',
          state_prompt: `Gather information about their application status and any obstacles they're facing.
                        Be patient and understanding. Ask open-ended questions to understand their situation better.
                        Listen for emotional indicators - stress, confusion, excitement, or concerns.`,
          edges: [
            {
              destination_state_name: 'concern_addressing',
              description: 'Address concerns or obstacles they mention.'
            },
            {
              destination_state_name: 'guidance_providing',
              description: 'Provide guidance on next steps.'
            }
          ]
        },
        {
          name: 'concern_addressing',
          state_prompt: `Address the student's concerns with empathy and understanding.
                        Provide reassurance and practical solutions.
                        If you detect frustration or stress in their voice, acknowledge these feelings.
                        Offer specific help and resources.`,
          edges: [
            {
              destination_state_name: 'guidance_providing',
              description: 'Provide guidance after addressing concerns.'
            },
            {
              destination_state_name: 'escalation',
              description: 'Escalate to human counselor if needed.'
            }
          ]
        },
        {
          name: 'guidance_providing',
          state_prompt: `Provide clear, actionable guidance for their next steps.
                        Be encouraging and supportive. Offer specific resources and assistance.
                        Ensure they understand what they need to do and feel confident about moving forward.`,
          edges: [
            {
              destination_state_name: 'follow_up_scheduling',
              description: 'Schedule follow-up if needed.'
            }
          ]
        },
        {
          name: 'escalation',
          state_prompt: `Prepare to transfer the call to a human counselor.
                        Explain why the transfer is happening and what to expect.
                        Reassure the student that they will receive personalized help.`,
          tools: [
            {
              type: 'transfer_call',
              name: 'transfer_to_counselor',
              description: 'Transfer to human counselor for personalized assistance.'
            }
          ]
        },
        {
          name: 'follow_up_scheduling',
          state_prompt: `Schedule appropriate follow-up communication.
                        Ask about preferred communication method and timing.
                        Confirm their contact information and provide clear next steps.`
        }
      ],
      starting_state: 'initial_engagement',
      begin_message: `Hi ${agentConfig.studentName || 'there'}! This is an automated call from ${process.env.INSTITUTION_NAME || 'our institution'}. I'm calling to follow up on your admission inquiry and see how I can help you with your application process. Do you have a few minutes to chat?`
    };

    const llmResponse = await client.llm.create(llmConfig);

    // Create agent with the LLM
    const agentConfig_full = {
      response_engine: {
        type: 'retell-llm',
        llm_id: llmResponse.llm_id
      },
      agent_name: agentConfig.name || 'EduNudge Voice Agent',
      voice_id: agentConfig.voiceId || '11labs-Adrian',
      voice_temperature: 0.8,
      voice_speed: 1.0,
      responsiveness: 1,
      interruption_sensitivity: 1,
      enable_backchannel: true,
      backchannel_frequency: 0.9,
      language: 'en-US',
      webhook_url: `${process.env.BASE_URL}/api/webhook/retell`,
      end_call_after_silence_ms: 600000, // 10 minutes
      max_call_duration_ms: 1800000, // 30 minutes
      post_call_analysis_data: [
        {
          type: 'string',
          name: 'student_emotion',
          description: 'Overall emotional state detected during the call',
          examples: ['positive', 'neutral', 'concerned', 'frustrated', 'excited']
        },
        {
          type: 'string',
          name: 'main_concerns',
          description: 'Primary concerns or obstacles mentioned by the student'
        },
        {
          type: 'string',
          name: 'next_steps',
          description: 'Recommended next steps for this student'
        },
        {
          type: 'boolean',
          name: 'requires_counselor_follow_up',
          description: 'Whether this student needs human counselor follow-up'
        }
      ]
    };

    const agentResponse = await client.agent.create(agentConfig_full);
    
    logger.info(`Created emotion-aware agent: ${agentResponse.agent_id}`);
    return {
      agent_id: agentResponse.agent_id,
      llm_id: llmResponse.llm_id,
      config: agentConfig_full
    };

  } catch (error) {
    logger.error('Error creating emotion-aware agent:', error);
    throw error;
  }
}

/**
 * Generate emotion-aware prompt for the agent
 */
function generateEmotionAwarePrompt(config) {
  return `You are an empathetic AI voice assistant representing ${process.env.INSTITUTION_NAME || 'our educational institution'}. 

Your primary role is to:
1. Follow up with prospective students who have submitted inquiries but haven't completed their applications
2. Detect and respond appropriately to emotional cues in the student's voice and speech patterns
3. Provide guidance, support, and encouragement throughout the admission process
4. Connect students with appropriate resources and human counselors when needed

EMOTIONAL INTELLIGENCE GUIDELINES:
- Listen carefully to tone, pace, and emotional indicators in the student's voice
- If you detect hesitation or uncertainty: Provide reassurance and break down complex processes into simple steps
- If you detect frustration or stress: Acknowledge their feelings and offer practical solutions
- If you detect excitement or enthusiasm: Match their energy and provide encouraging next steps
- If you detect confusion: Ask clarifying questions and provide clear, simple explanations
- If you detect fear or anxiety: Be extra patient and supportive, offer to connect them with a counselor

CONVERSATION GUIDELINES:
- Always be warm, professional, and genuinely helpful
- Use the student's name when appropriate
- Speak in a conversational, not scripted manner
- Ask open-ended questions to understand their specific situation
- Provide specific, actionable next steps
- Offer multiple ways to get help (phone, email, in-person)
- Be honest about timelines and requirements
- Never make promises you can't keep

ESCALATION CRITERIA:
- Student expresses strong emotional distress
- Complex financial aid or academic questions
- Special circumstances requiring individual attention
- Technical issues that can't be resolved over the phone
- Student specifically requests to speak with a human

Remember: Your goal is to help students successfully navigate the admission process while providing emotional support and building confidence in their educational journey.`;
}

/**
 * Handle webhook events from Retell AI
 */
async function handleWebhookEvent(event) {
  try {
    logger.info(`Received Retell webhook event: ${event.event}`);

    switch (event.event) {
      case 'call_started':
        return await handleCallStarted(event.call);
      
      case 'call_ended':
        return await handleCallEnded(event.call);
      
      case 'call_analyzed':
        return await handleCallAnalyzed(event.call);
      
      default:
        logger.warn(`Unhandled webhook event: ${event.event}`);
        return { status: 'ignored' };
    }

  } catch (error) {
    logger.error('Error handling webhook event:', error);
    throw error;
  }
}

/**
 * Handle call started event
 */
async function handleCallStarted(call) {
  try {
    const { logCall } = require('./firebase');
    
    await logCall({
      retellCallId: call.call_id,
      studentId: call.metadata?.student_id,
      status: 'started',
      fromNumber: call.from_number,
      toNumber: call.to_number,
      agentId: call.agent_id,
      startTime: new Date(call.start_timestamp)
    });

    logger.info(`Call started: ${call.call_id}`);
    return { status: 'processed' };

  } catch (error) {
    logger.error('Error handling call started:', error);
    throw error;
  }
}

/**
 * Handle call ended event
 */
async function handleCallEnded(call) {
  try {
    const { logCall, updateStudent } = require('./firebase');
    
    await logCall({
      retellCallId: call.call_id,
      studentId: call.metadata?.student_id,
      status: 'ended',
      duration: call.duration_ms,
      endReason: call.disconnection_reason,
      endTime: new Date(call.end_timestamp)
    });

    // Update student's last contact time
    if (call.metadata?.student_id) {
      await updateStudent(call.metadata.student_id, {
        lastCallDate: new Date().toISOString(),
        lastCallStatus: 'completed'
      });
    }

    logger.info(`Call ended: ${call.call_id}`);
    return { status: 'processed' };

  } catch (error) {
    logger.error('Error handling call ended:', error);
    throw error;
  }
}

/**
 * Handle call analyzed event
 */
async function handleCallAnalyzed(call) {
  try {
    const { updateStudent } = require('./firebase');
    const { scheduleFollowUp } = require('../utils/scheduler');
    
    // Extract analysis data
    const analysis = call.call_analysis;
    const customAnalysis = analysis.custom_analysis_data || {};

    // Update student with analysis results
    if (call.metadata?.student_id) {
      const updateData = {
        lastCallAnalysis: {
          emotion: customAnalysis.student_emotion,
          concerns: customAnalysis.main_concerns,
          nextSteps: customAnalysis.next_steps,
          requiresCounselorFollowUp: customAnalysis.requires_counselor_follow_up,
          sentiment: analysis.user_sentiment,
          callSuccessful: analysis.call_successful,
          analyzedAt: new Date().toISOString()
        }
      };

      await updateStudent(call.metadata.student_id, updateData);

      // Schedule follow-up if needed
      if (customAnalysis.requires_counselor_follow_up) {
        await scheduleFollowUp({
          studentId: call.metadata.student_id,
          type: 'counselor_contact',
          priority: 'high',
          scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
        });
      } else if (!analysis.call_successful) {
        await scheduleFollowUp({
          studentId: call.metadata.student_id,
          type: 'voice_retry',
          priority: 'medium',
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        });
      }
    }

    logger.info(`Call analyzed: ${call.call_id}`);
    return { status: 'processed' };

  } catch (error) {
    logger.error('Error handling call analyzed:', error);
    throw error;
  }
}

module.exports = {
  initializeRetell,
  getRetellClient,
  createPhoneCall,
  createEmotionAwareAgent,
  handleWebhookEvent,
  testRetellConnection
};