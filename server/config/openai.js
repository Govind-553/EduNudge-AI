// server/config/openai.js
const OpenAI = require('openai');
const winston = require('winston');

// Configure logger for this module
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'openai-config' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

let openaiClient = null;

/**
 * Initialize OpenAI client
 */
async function initializeOpenAI() {
  try {
    // Check if OpenAI is already initialized
    if (openaiClient) {
      logger.info('OpenAI already initialized');
      return openaiClient;
    }

    // Validate required environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Initialize OpenAI client
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test the connection
    await testOpenAIConnection();

    logger.info('OpenAI initialized successfully');
    return openaiClient;

  } catch (error) {
    logger.error('Error initializing OpenAI:', error);
    throw error;
  }
}

/**
 * Test OpenAI connection
 */
async function testOpenAIConnection() {
  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, this is a connection test.' }],
      max_tokens: 10
    });
    
    if (response.choices && response.choices.length > 0) {
      logger.info('OpenAI connection test successful');
      return true;
    } else {
      throw new Error('No response from OpenAI');
    }
  } catch (error) {
    logger.error('OpenAI connection test failed:', error);
    throw error;
  }
}

/**
 * Get OpenAI client instance
 */
function getOpenAIClient() {
  if (!openaiClient) {
    throw new Error('OpenAI not initialized. Call initializeOpenAI() first.');
  }
  return openaiClient;
}

/**
 * Generate personalized script for voice agent based on student data
 */
async function generatePersonalizedScript(studentData, context = {}) {
  try {
    const client = getOpenAIClient();
    
    const systemPrompt = `You are an expert educational counselor creating personalized conversation scripts for voice AI agents. 
    
    Your goal is to create empathetic, engaging scripts that help students overcome obstacles in their admission process.
    
    Consider the following principles:
    - Be warm and understanding
    - Address specific concerns
    - Provide actionable next steps
    - Use encouraging language
    - Adapt tone based on student's emotional state
    - Include relevant institutional information
    
    Always structure your response as a conversational script that sounds natural when spoken.`;

    const userPrompt = `Create a personalized conversation script for a student with the following details:
    
    Student Information:
    - Name: ${studentData.name || 'Student'}
    - Inquiry Type: ${studentData.inquiryType || 'General admission'}
    - Application Status: ${studentData.status || 'inquiry_submitted'}
    - Days Since Inquiry: ${calculateDaysSince(studentData.createdAt)}
    - Previous Contact Attempts: ${studentData.contactAttempts || 0}
    - Last Interaction: ${studentData.lastInteraction || 'Initial inquiry form'}
    
    Context:
    - Institution: ${process.env.INSTITUTION_NAME || 'Our Institution'}
    - Program Type: ${context.programType || 'Various programs'}
    - Current Status: ${context.currentStatus || 'Follow-up needed'}
    - Urgency Level: ${context.urgencyLevel || 'Medium'}
    
    Please create a script that:
    1. Opens with a warm, personalized greeting
    2. Acknowledges their inquiry and shows appreciation
    3. Identifies and addresses potential concerns
    4. Provides clear next steps
    5. Offers multiple ways to get help
    6. Ends with encouragement and clear follow-up
    
    Keep the script conversational and natural, suitable for a voice AI agent.`;

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    const script = response.choices[0].message.content;
    
    logger.info(`Generated personalized script for student: ${studentData.id}`);
    return {
      script,
      generatedAt: new Date().toISOString(),
      tokenUsage: response.usage
    };

  } catch (error) {
    logger.error('Error generating personalized script:', error);
    throw error;
  }
}

/**
 * Analyze student emotion and sentiment from conversation data
 */
async function analyzeStudentEmotion(conversationData) {
  try {
    const client = getOpenAIClient();
    
    const systemPrompt = `You are an expert in emotional intelligence and student psychology. 
    
    Analyze the given conversation data to understand the student's emotional state, concerns, and needs.
    
    Provide your analysis in the following JSON format:
    {
      "primaryEmotion": "emotion_name",
      "emotionIntensity": "low|medium|high",
      "concerns": ["concern1", "concern2"],
      "needsSupport": true/false,
      "recommendedApproach": "description",
      "urgencyLevel": "low|medium|high",
      "nextSteps": ["step1", "step2"]
    }`;

    const userPrompt = `Analyze this student conversation data:
    
    Transcript: ${conversationData.transcript || 'No transcript available'}
    Duration: ${conversationData.duration || 'Unknown'}
    Student Responses: ${JSON.stringify(conversationData.responses || [])}
    Voice Characteristics: ${conversationData.voiceCharacteristics || 'Not analyzed'}
    
    Please provide a comprehensive emotional analysis.`;

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 400,
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    logger.info(`Analyzed student emotion: ${analysis.primaryEmotion}`);
    return {
      ...analysis,
      analyzedAt: new Date().toISOString(),
      tokenUsage: response.usage
    };

  } catch (error) {
    logger.error('Error analyzing student emotion:', error);
    // Return a default analysis if parsing fails
    return {
      primaryEmotion: 'neutral',
      emotionIntensity: 'medium',
      concerns: ['Unable to analyze'],
      needsSupport: true,
      recommendedApproach: 'Standard follow-up approach',
      urgencyLevel: 'medium',
      nextSteps: ['Contact student', 'Provide support'],
      analyzedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Generate follow-up message content based on student interaction
 */
async function generateFollowUpMessage(studentData, messageType = 'whatsapp') {
  try {
    const client = getOpenAIClient();
    
    const systemPrompt = `You are an expert educational marketing specialist creating follow-up messages for prospective students.
    
    Create messages that are:
    - Personalized and engaging
    - Action-oriented
    - Supportive and encouraging
    - Professional yet friendly
    - Appropriate for the specified communication channel
    
    Format guidelines:
    - WhatsApp: Casual, emoji-friendly, concise
    - Email: Professional, detailed, well-structured
    - SMS: Very brief, clear call-to-action`;

    const userPrompt = `Create a ${messageType} follow-up message for:
    
    Student: ${studentData.name || 'Prospective Student'}
    Status: ${studentData.status || 'inquiry_submitted'}
    Program Interest: ${studentData.inquiryType || 'General admission'}
    Days Since Contact: ${calculateDaysSince(studentData.lastActivity)}
    Previous Messages: ${studentData.messageCount || 0}
    
    Institutional Details:
    - Name: ${process.env.INSTITUTION_NAME || 'Our Institution'}
    - Contact: ${process.env.CONTACT_PHONE || 'Contact us'}
    - Website: ${process.env.WEBSITE_URL || 'Visit our website'}
    
    Create an encouraging message that provides clear next steps and shows genuine interest in helping them succeed.`;

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.8
    });

    const message = response.choices[0].message.content;
    
    logger.info(`Generated ${messageType} follow-up message for student: ${studentData.id}`);
    return {
      message,
      messageType,
      generatedAt: new Date().toISOString(),
      tokenUsage: response.usage
    };

  } catch (error) {
    logger.error('Error generating follow-up message:', error);
    throw error;
  }
}

/**
 * Generate counselor briefing based on student interaction history
 */
async function generateCounselorBriefing(studentData, interactionHistory) {
  try {
    const client = getOpenAIClient();
    
    const systemPrompt = `You are an AI assistant helping educational counselors prepare for student interactions.
    
    Create comprehensive briefings that include:
    - Student background summary
    - Key concerns and obstacles identified
    - Emotional state assessment
    - Recommended conversation approach
    - Specific action items
    - Priority level assessment
    
    Keep briefings professional, actionable, and focused on student success.`;

    const userPrompt = `Create a counselor briefing for:
    
    Student Information:
    - Name: ${studentData.name || 'Student'}
    - Program Interest: ${studentData.inquiryType || 'General'}
    - Current Status: ${studentData.status || 'inquiry_submitted'}
    - Application Stage: ${studentData.applicationStage || 'Initial inquiry'}
    
    Interaction History:
    ${JSON.stringify(interactionHistory, null, 2)}
    
    Recent Analysis:
    - Last Call Emotion: ${studentData.lastCallAnalysis?.emotion || 'Not analyzed'}
    - Main Concerns: ${studentData.lastCallAnalysis?.concerns || 'Unknown'}
    - Requires Follow-up: ${studentData.lastCallAnalysis?.requiresCounselorFollowUp || false}
    
    Please provide a comprehensive briefing for the counselor.`;

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600,
      temperature: 0.5
    });

    const briefing = response.choices[0].message.content;
    
    logger.info(`Generated counselor briefing for student: ${studentData.id}`);
    return {
      briefing,
      generatedAt: new Date().toISOString(),
      studentId: studentData.id,
      tokenUsage: response.usage
    };

  } catch (error) {
    logger.error('Error generating counselor briefing:', error);
    throw error;
  }
}

/**
 * Optimize conversation flow based on success patterns
 */
async function optimizeConversationFlow(successData, failureData) {
  try {
    const client = getOpenAIClient();
    
    const systemPrompt = `You are an AI expert in conversation optimization and educational psychology.
    
    Analyze successful and unsuccessful conversation patterns to provide recommendations for improving voice agent interactions.
    
    Focus on:
    - Conversation structure improvements
    - Emotional response optimization
    - Timing and pacing adjustments
    - Content personalization strategies
    
    Provide actionable recommendations.`;

    const userPrompt = `Analyze conversation patterns:
    
    Successful Conversations:
    ${JSON.stringify(successData, null, 2)}
    
    Unsuccessful Conversations:
    ${JSON.stringify(failureData, null, 2)}
    
    Please provide specific recommendations for optimizing future conversations.`;

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.4
    });

    const recommendations = response.choices[0].message.content;
    
    logger.info('Generated conversation optimization recommendations');
    return {
      recommendations,
      generatedAt: new Date().toISOString(),
      basedOnSamples: {
        successful: successData.length,
        unsuccessful: failureData.length
      },
      tokenUsage: response.usage
    };

  } catch (error) {
    logger.error('Error optimizing conversation flow:', error);
    throw error;
  }
}

/**
 * Helper function to calculate days since a given date
 */
function calculateDaysSince(dateString) {
  if (!dateString) return 'Unknown';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Generate usage statistics for OpenAI API calls
 */
function getUsageStatistics() {
  // This would be implemented with proper tracking
  return {
    totalRequests: 0,
    totalTokens: 0,
    averageResponseTime: 0,
    errorRate: 0
  };
}

module.exports = {
  initializeOpenAI,
  getOpenAIClient,
  generatePersonalizedScript,
  analyzeStudentEmotion,
  generateFollowUpMessage,
  generateCounselorBriefing,
  optimizeConversationFlow,
  testOpenAIConnection,
  getUsageStatistics
};