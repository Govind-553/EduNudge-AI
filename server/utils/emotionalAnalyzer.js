// server/utils/emotionalAnalyzer.js
const winston = require('winston');
const { analyzeStudentEmotion } = require('../config/openai');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'emotional-analyzer' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Emotional Analyzer Utility - Advanced emotion detection and analysis
 */
class EmotionalAnalyzer {
  constructor() {
    this.emotionWeights = {
      happy: { positive: 1.0, negative: 0.0, engagement: 0.9 },
      excited: { positive: 0.9, negative: 0.0, engagement: 1.0 },
      confident: { positive: 0.8, negative: 0.0, engagement: 0.8 },
      curious: { positive: 0.7, negative: 0.0, engagement: 0.9 },
      neutral: { positive: 0.5, negative: 0.5, engagement: 0.5 },
      confused: { positive: 0.2, negative: 0.6, engagement: 0.4 },
      frustrated: { positive: 0.1, negative: 0.8, engagement: 0.3 },
      disappointed: { positive: 0.2, negative: 0.7, engagement: 0.3 },
      anxious: { positive: 0.1, negative: 0.9, engagement: 0.6 },
      angry: { positive: 0.0, negative: 1.0, engagement: 0.4 },
      sad: { positive: 0.0, negative: 0.8, engagement: 0.2 },
      overwhelmed: { positive: 0.1, negative: 0.8, engagement: 0.2 }
    };

    this.conversationPatterns = {
      engagement_indicators: [
        'tell me more',
        'that sounds interesting',
        'i would like to know',
        'what about',
        'how does',
        'can you explain'
      ],
      concern_indicators: [
        'i\'m worried about',
        'what if',
        'i\'m not sure',
        'is it difficult',
        'how hard is it',
        'i don\'t know if'
      ],
      positive_indicators: [
        'that\'s great',
        'sounds good',
        'i like',
        'perfect',
        'excellent',
        'wonderful'
      ],
      negative_indicators: [
        'i don\'t like',
        'that\'s bad',
        'terrible',
        'awful',
        'hate',
        'disappointed'
      ]
    };
  }

  /**
   * Analyze emotion from call transcript and voice metrics
   */
  async analyzeCallEmotion(callData) {
    try {
      const {
        transcript,
        duration = 0,
        voiceMetrics = {},
        responses = [],
        callContext = {}
      } = callData;

      logger.info('Analyzing call emotion from transcript and voice metrics');

      // Multi-layer emotion analysis
      const textualAnalysis = await this.analyzeTextualEmotion(transcript);
      const voiceAnalysis = this.analyzeVoiceMetrics(voiceMetrics);
      const conversationAnalysis = this.analyzeConversationFlow(transcript, responses);
      const contextualAnalysis = this.analyzeContextualFactors(callContext, duration);

      // Combine all analyses
      const combinedEmotion = this.combineEmotionAnalyses([
        { analysis: textualAnalysis, weight: 0.4 },
        { analysis: voiceAnalysis, weight: 0.3 },
        { analysis: conversationAnalysis, weight: 0.2 },
        { analysis: contextualAnalysis, weight: 0.1 }
      ]);

      // Generate insights and recommendations
      const insights = this.generateEmotionalInsights(combinedEmotion, callData);
      const recommendations = this.generateEmotionalRecommendations(combinedEmotion, insights);

      const result = {
        emotion: combinedEmotion.primaryEmotion,
        confidence: combinedEmotion.confidence,
        intensity: combinedEmotion.intensity,
        valence: combinedEmotion.valence, // positive/negative
        arousal: combinedEmotion.arousal, // high/low energy
        
        // Detailed breakdown
        emotionBreakdown: combinedEmotion.emotionScores,
        analysisLayers: {
          textual: textualAnalysis,
          voice: voiceAnalysis,
          conversation: conversationAnalysis,
          contextual: contextualAnalysis
        },
        
        // Insights and actions
        insights,
        recommendations,
        
        // Metadata
        analyzedAt: new Date().toISOString(),
        analysisVersion: '2.1',
        callDuration: duration
      };

      logger.info(`Emotion analysis completed: ${result.emotion} (${result.confidence})`);
      return { success: true, analysis: result };

    } catch (error) {
      logger.error('Error analyzing call emotion:', error);
      return {
        success: false,
        error: error.message,
        fallbackAnalysis: this.generateFallbackAnalysis(callData)
      };
    }
  }

  /**
   * Analyze textual emotion using NLP and OpenAI
   */
  async analyzeTextualEmotion(transcript) {
    try {
      if (!transcript || transcript.trim().length === 0) {
        return this.getDefaultEmotionAnalysis();
      }

      // Use OpenAI for advanced emotion analysis
      const aiAnalysis = await analyzeStudentEmotion({
        transcript,
        analysisType: 'detailed_emotion'
      });

      // Combine with rule-based analysis
      const ruleBasedAnalysis = this.performRuleBasedTextAnalysis(transcript);

      return this.mergeTextAnalyses(aiAnalysis, ruleBasedAnalysis);

    } catch (error) {
      logger.warn('AI emotion analysis failed, using rule-based fallback:', error);
      return this.performRuleBasedTextAnalysis(transcript);
    }
  }

  /**
   * Analyze voice metrics for emotional indicators
   */
  analyzeVoiceMetrics(voiceMetrics) {
    const {
      avgPitch = 0,
      pitchVariance = 0,
      speakingRate = 0,
      pauseFrequency = 0,
      voiceEnergy = 0,
      clarity = 1.0
    } = voiceMetrics;

    let emotionScores = {
      happy: 0,
      excited: 0,
      confident: 0,
      neutral: 0.5,
      confused: 0,
      frustrated: 0,
      anxious: 0,
      sad: 0
    };

    // Pitch analysis
    if (avgPitch > 0) {
      if (avgPitch > 200) { // High pitch
        emotionScores.excited += 0.3;
        emotionScores.anxious += 0.2;
      } else if (avgPitch < 100) { // Low pitch
        emotionScores.sad += 0.3;
        emotionScores.confident += 0.2;
      }
    }

    // Pitch variance analysis
    if (pitchVariance > 50) {
      emotionScores.excited += 0.2;
      emotionScores.happy += 0.2;
    } else if (pitchVariance < 20) {
      emotionScores.sad += 0.2;
      emotionScores.frustrated += 0.1;
    }

    // Speaking rate analysis
    if (speakingRate > 0) {
      if (speakingRate > 180) { // Fast speaking
        emotionScores.excited += 0.2;
        emotionScores.anxious += 0.3;
      } else if (speakingRate < 120) { // Slow speaking
        emotionScores.sad += 0.3;
        emotionScores.confused += 0.2;
      }
    }

    // Pause frequency analysis
    if (pauseFrequency > 0.3) { // Many pauses
      emotionScores.confused += 0.3;
      emotionScores.anxious += 0.2;
    }

    // Voice energy analysis
    if (voiceEnergy > 0.7) {
      emotionScores.excited += 0.2;
      emotionScores.confident += 0.2;
    } else if (voiceEnergy < 0.3) {
      emotionScores.sad += 0.3;
      emotionScores.disappointed += 0.2;
    }

    // Clarity analysis
    if (clarity < 0.6) {
      emotionScores.confused += 0.2;
      emotionScores.frustrated += 0.1;
    }

    // Normalize scores
    const maxScore = Math.max(...Object.values(emotionScores));
    if (maxScore > 0) {
      Object.keys(emotionScores).forEach(emotion => {
        emotionScores[emotion] = emotionScores[emotion] / maxScore;
      });
    }

    const primaryEmotion = this.getPrimaryEmotion(emotionScores);
    const confidence = this.calculateConfidence(emotionScores, 'voice');

    return {
      primaryEmotion,
      confidence,
      emotionScores,
      voiceMetrics,
      analysisType: 'voice'
    };
  }

  /**
   * Analyze conversation flow and interaction patterns
   */
  analyzeConversationFlow(transcript, responses) {
    if (!transcript) {
      return this.getDefaultEmotionAnalysis();
    }

    const text = transcript.toLowerCase();
    const sentences = this.splitIntoSentences(transcript);
    
    let scores = {
      engagement: 0,
      positivity: 0,
      concern_level: 0,
      cooperation: 0,
      interest_level: 0
    };

    // Analyze engagement indicators
    this.conversationPatterns.engagement_indicators.forEach(indicator => {
      if (text.includes(indicator)) {
        scores.engagement += 0.2;
      }
    });

    // Analyze concern indicators
    this.conversationPatterns.concern_indicators.forEach(indicator => {
      if (text.includes(indicator)) {
        scores.concern_level += 0.2;
      }
    });

    // Analyze positive indicators
    this.conversationPatterns.positive_indicators.forEach(indicator => {
      if (text.includes(indicator)) {
        scores.positivity += 0.2;
      }
    });

    // Analyze negative indicators
    this.conversationPatterns.negative_indicators.forEach(indicator => {
      if (text.includes(indicator)) {
        scores.positivity -= 0.2;
      }
    });

    // Analyze response patterns
    if (responses && responses.length > 0) {
      const avgResponseLength = responses.reduce((acc, r) => acc + r.length, 0) / responses.length;
      if (avgResponseLength > 50) {
        scores.engagement += 0.3;
      } else if (avgResponseLength < 10) {
        scores.engagement -= 0.2;
      }
    }

    // Convert scores to emotion probabilities
    const emotionScores = this.convertConversationScoresToEmotion(scores);
    const primaryEmotion = this.getPrimaryEmotion(emotionScores);
    const confidence = this.calculateConfidence(emotionScores, 'conversation');

    return {
      primaryEmotion,
      confidence,
      emotionScores,
      conversationScores: scores,
      analysisType: 'conversation'
    };
  }

  /**
   * Analyze contextual factors affecting emotion
   */
  analyzeContextualFactors(callContext, duration) {
    const {
      callReason = 'unknown',
      studentRiskLevel = 'low',
      previousCallOutcome = 'unknown',
      timeOfDay = 'unknown',
      studentStatus = 'unknown'
    } = callContext;

    let contextualEmotionModifiers = {
      happy: 0.5,
      excited: 0.5,
      confident: 0.5,
      neutral: 0.5,
      confused: 0.5,
      frustrated: 0.5,
      anxious: 0.5,
      sad: 0.5
    };

    // Call reason impact
    const reasonImpact = {
      'high_risk_intervention': { anxious: 0.3, frustrated: 0.2, sad: 0.2 },
      'document_reminder': { confused: 0.2, frustrated: 0.1 },
      'payment_reminder': { anxious: 0.3, frustrated: 0.2 },
      'follow_up': { neutral: 0.1 },
      'welcome_call': { happy: 0.2, excited: 0.1 }
    };

    if (reasonImpact[callReason]) {
      Object.keys(reasonImpact[callReason]).forEach(emotion => {
        contextualEmotionModifiers[emotion] += reasonImpact[callReason][emotion];
      });
    }

    // Risk level impact
    if (studentRiskLevel === 'high') {
      contextualEmotionModifiers.anxious += 0.2;
      contextualEmotionModifiers.frustrated += 0.1;
    }

    // Call duration impact
    if (duration > 0) {
      if (duration < 60) { // Very short call
        contextualEmotionModifiers.frustrated += 0.2;
        contextualEmotionModifiers.confused += 0.1;
      } else if (duration > 300) { // Long call
        contextualEmotionModifiers.engaged = (contextualEmotionModifiers.engaged || 0.5) + 0.2;
        contextualEmotionModifiers.interested = (contextualEmotionModifiers.interested || 0.5) + 0.1;
      }
    }

    const primaryEmotion = this.getPrimaryEmotion(contextualEmotionModifiers);
    const confidence = 0.3; // Contextual analysis has lower confidence

    return {
      primaryEmotion,
      confidence,
      emotionScores: contextualEmotionModifiers,
      contextFactors: callContext,
      analysisType: 'contextual'
    };
  }

  /**
   * Combine multiple emotion analyses with weighted averaging
   */
  combineEmotionAnalyses(analyses) {
    const combinedScores = {};
    let totalWeight = 0;
    let totalConfidence = 0;

    // Initialize combined scores
    Object.keys(this.emotionWeights).forEach(emotion => {
      combinedScores[emotion] = 0;
    });

    // Weighted combination
    analyses.forEach(({ analysis, weight }) => {
      if (analysis && analysis.emotionScores) {
        totalWeight += weight;
        totalConfidence += analysis.confidence * weight;

        Object.keys(analysis.emotionScores).forEach(emotion => {
          if (combinedScores[emotion] !== undefined) {
            combinedScores[emotion] += analysis.emotionScores[emotion] * weight;
          }
        });
      }
    });

    // Normalize scores
    if (totalWeight > 0) {
      Object.keys(combinedScores).forEach(emotion => {
        combinedScores[emotion] = combinedScores[emotion] / totalWeight;
      });
      totalConfidence = totalConfidence / totalWeight;
    }

    const primaryEmotion = this.getPrimaryEmotion(combinedScores);
    const secondaryEmotions = this.getSecondaryEmotions(combinedScores, primaryEmotion);
    
    return {
      primaryEmotion,
      secondaryEmotions,
      confidence: Math.min(totalConfidence, 1.0),
      intensity: combinedScores[primaryEmotion] || 0.5,
      valence: this.calculateValence(primaryEmotion, combinedScores),
      arousal: this.calculateArousal(primaryEmotion, combinedScores),
      emotionScores: combinedScores
    };
  }

  /**
   * Generate emotional insights from analysis
   */
  generateEmotionalInsights(emotionAnalysis, callData) {
    const insights = {
      primaryInsight: this.getPrimaryInsight(emotionAnalysis),
      emotionalState: this.getEmotionalStateDescription(emotionAnalysis),
      engagementLevel: this.assessEngagementLevel(emotionAnalysis),
      communicationStyle: this.identifyCommunicationStyle(emotionAnalysis),
      concernAreas: this.identifyConcernAreas(emotionAnalysis, callData),
      positiveIndicators: this.identifyPositiveIndicators(emotionAnalysis),
      riskFactors: this.identifyEmotionalRiskFactors(emotionAnalysis)
    };

    return insights;
  }

  /**
   * Generate actionable recommendations based on emotional analysis
   */
  generateEmotionalRecommendations(emotionAnalysis, insights) {
    const recommendations = {
      immediate: [],
      followUp: [],
      longTerm: []
    };

    const emotion = emotionAnalysis.primaryEmotion;
    const confidence = emotionAnalysis.confidence;
    const intensity = emotionAnalysis.intensity;

    // Generate recommendations based on primary emotion
    if (confidence > 0.7) { // High confidence recommendations
      switch (emotion) {
        case 'frustrated':
        case 'angry':
          recommendations.immediate.push('Acknowledge frustration and provide immediate support');
          recommendations.immediate.push('Offer to escalate to a counselor');
          recommendations.followUp.push('Personal follow-up call within 24 hours');
          break;

        case 'confused':
          recommendations.immediate.push('Provide clear, simplified explanations');
          recommendations.immediate.push('Offer additional resources or documentation');
          recommendations.followUp.push('Send follow-up email with step-by-step guide');
          break;

        case 'anxious':
          recommendations.immediate.push('Provide reassurance and support');
          recommendations.immediate.push('Address specific concerns raised');
          recommendations.followUp.push('Schedule regular check-in calls');
          break;

        case 'excited':
        case 'happy':
          recommendations.immediate.push('Capitalize on positive momentum');
          recommendations.immediate.push('Move forward with next steps quickly');
          recommendations.followUp.push('Send congratulatory message');
          break;

        case 'sad':
        case 'disappointed':
          recommendations.immediate.push('Show empathy and understanding');
          recommendations.immediate.push('Explore alternative options');
          recommendations.followUp.push('Personal outreach from senior counselor');
          break;
      }
    }

    // Intensity-based recommendations
    if (intensity > 0.8) {
      recommendations.immediate.push('High-intensity emotion detected - prioritize human interaction');
    }

    // Engagement-based recommendations
    if (insights.engagementLevel === 'low') {
      recommendations.followUp.push('Try different communication channel');
      recommendations.longTerm.push('Review and update engagement strategy');
    }

    return recommendations;
  }

  // Helper methods

  performRuleBasedTextAnalysis(transcript) {
    if (!transcript) return this.getDefaultEmotionAnalysis();

    const text = transcript.toLowerCase();
    const emotionKeywords = {
      happy: ['great', 'awesome', 'fantastic', 'love', 'excellent', 'perfect', 'wonderful'],
      excited: ['excited', 'amazing', 'incredible', 'can\'t wait', 'thrilled'],
      confident: ['confident', 'sure', 'certain', 'definitely', 'absolutely'],
      confused: ['confused', 'don\'t understand', 'unclear', 'not sure', 'what do you mean'],
      frustrated: ['frustrated', 'annoying', 'ridiculous', 'stupid', 'hate'],
      anxious: ['worried', 'nervous', 'scared', 'afraid', 'concerned'],
      sad: ['sad', 'disappointed', 'upset', 'depressed', 'unhappy']
    };

    const emotionScores = {};
    let totalMatches = 0;

    Object.keys(emotionKeywords).forEach(emotion => {
      let matches = 0;
      emotionKeywords[emotion].forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        const keywordMatches = (text.match(regex) || []).length;
        matches += keywordMatches;
        totalMatches += keywordMatches;
      });
      emotionScores[emotion] = matches;
    });

    // Normalize scores
    if (totalMatches > 0) {
      Object.keys(emotionScores).forEach(emotion => {
        emotionScores[emotion] = emotionScores[emotion] / totalMatches;
      });
    } else {
      emotionScores.neutral = 1.0;
    }

    const primaryEmotion = this.getPrimaryEmotion(emotionScores);
    const confidence = this.calculateConfidence(emotionScores, 'text');

    return {
      primaryEmotion,
      confidence,
      emotionScores,
      analysisType: 'rule_based_text'
    };
  }

  mergeTextAnalyses(aiAnalysis, ruleBasedAnalysis) {
    // Weighted merge: 70% AI, 30% rule-based
    const aiWeight = 0.7;
    const ruleWeight = 0.3;

    const mergedScores = {};
    
    // Get all unique emotions
    const allEmotions = new Set([
      ...Object.keys(aiAnalysis.emotionScores || {}),
      ...Object.keys(ruleBasedAnalysis.emotionScores || {})
    ]);

    allEmotions.forEach(emotion => {
      const aiScore = aiAnalysis.emotionScores?.[emotion] || 0;
      const ruleScore = ruleBasedAnalysis.emotionScores?.[emotion] || 0;
      mergedScores[emotion] = (aiScore * aiWeight) + (ruleScore * ruleWeight);
    });

    const primaryEmotion = this.getPrimaryEmotion(mergedScores);
    const confidence = (aiAnalysis.confidence * aiWeight) + (ruleBasedAnalysis.confidence * ruleWeight);

    return {
      primaryEmotion,
      confidence,
      emotionScores: mergedScores,
      analysisType: 'merged_text',
      aiAnalysis,
      ruleBasedAnalysis
    };
  }

  convertConversationScoresToEmotion(scores) {
    const emotionScores = {
      happy: Math.max(0, scores.positivity * 0.8 + scores.engagement * 0.2),
      excited: Math.max(0, scores.engagement * 0.6 + scores.positivity * 0.4),
      confident: Math.max(0, scores.cooperation * 0.7 + scores.positivity * 0.3),
      neutral: 0.5 - Math.abs(scores.positivity) * 0.5,
      confused: Math.max(0, (1 - scores.engagement) * 0.6 + scores.concern_level * 0.4),
      frustrated: Math.max(0, -scores.positivity * 0.7 + scores.concern_level * 0.3),
      anxious: Math.max(0, scores.concern_level * 0.8 + (1 - scores.cooperation) * 0.2)
    };

    return emotionScores;
  }

  getPrimaryEmotion(emotionScores) {
    if (!emotionScores || Object.keys(emotionScores).length === 0) {
      return 'neutral';
    }

    let maxEmotion = 'neutral';
    let maxScore = 0;

    Object.keys(emotionScores).forEach(emotion => {
      if (emotionScores[emotion] > maxScore) {
        maxScore = emotionScores[emotion];
        maxEmotion = emotion;
      }
    });

    return maxEmotion;
  }

  getSecondaryEmotions(emotionScores, primaryEmotion, minScore = 0.3) {
    return Object.keys(emotionScores)
      .filter(emotion => emotion !== primaryEmotion && emotionScores[emotion] >= minScore)
      .sort((a, b) => emotionScores[b] - emotionScores[a])
      .slice(0, 2);
  }

  calculateConfidence(emotionScores, analysisType) {
    const values = Object.values(emotionScores);
    const maxScore = Math.max(...values);
    const avgScore = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Higher difference between max and average = higher confidence
    const confidenceBase = (maxScore - avgScore) / maxScore || 0;
    
    // Adjust confidence based on analysis type
    const typeMultipliers = {
      'text': 0.9,
      'voice': 0.8,
      'conversation': 0.7,
      'contextual': 0.5,
      'rule_based_text': 0.6
    };
    
    return Math.min(confidenceBase * (typeMultipliers[analysisType] || 0.7), 1.0);
  }

  calculateValence(primaryEmotion, emotionScores) {
    const positiveEmotions = ['happy', 'excited', 'confident', 'curious'];
    const negativeEmotions = ['frustrated', 'angry', 'sad', 'anxious', 'disappointed'];
    
    if (positiveEmotions.includes(primaryEmotion)) {
      return 'positive';
    } else if (negativeEmotions.includes(primaryEmotion)) {
      return 'negative';
    }
    return 'neutral';
  }

  calculateArousal(primaryEmotion, emotionScores) {
    const highArousalEmotions = ['excited', 'angry', 'frustrated', 'anxious'];
    const lowArousalEmotions = ['sad', 'disappointed', 'calm', 'bored'];
    
    if (highArousalEmotions.includes(primaryEmotion)) {
      return 'high';
    } else if (lowArousalEmotions.includes(primaryEmotion)) {
      return 'low';
    }
    return 'medium';
  }

  splitIntoSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  getPrimaryInsight(emotionAnalysis) {
    const emotion = emotionAnalysis.primaryEmotion;
    const intensity = emotionAnalysis.intensity;
    
    const insights = {
      'happy': `Student shows positive engagement with ${intensity > 0.7 ? 'high' : 'moderate'} enthusiasm`,
      'excited': `Student demonstrates high interest and motivation`,
      'confident': `Student appears comfortable and self-assured in the conversation`,
      'frustrated': `Student is experiencing frustration that needs immediate attention`,
      'confused': `Student needs additional clarification and support`,
      'anxious': `Student shows signs of anxiety that may affect decision-making`,
      'sad': `Student appears discouraged and may need emotional support`,
      'neutral': `Student maintains neutral engagement without strong emotional indicators`
    };
    
    return insights[emotion] || `Student shows ${emotion} emotional state`;
  }

  getEmotionalStateDescription(emotionAnalysis) {
    const { primaryEmotion, intensity, confidence } = emotionAnalysis;
    
    const intensityDesc = intensity > 0.7 ? 'strong' : intensity > 0.4 ? 'moderate' : 'mild';
    const confidenceDesc = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
    
    return {
      state: primaryEmotion,
      intensity: intensityDesc,
      confidence: confidenceDesc,
      description: `${intensityDesc} ${primaryEmotion} emotion detected with ${confidenceDesc} confidence`
    };
  }

  assessEngagementLevel(emotionAnalysis) {
    const engagementEmotions = {
      'excited': 1.0,
      'happy': 0.8,
      'curious': 0.9,
      'confident': 0.7,
      'neutral': 0.5,
      'confused': 0.4,
      'frustrated': 0.3,
      'sad': 0.2,
      'angry': 0.1
    };
    
    const score = engagementEmotions[emotionAnalysis.primaryEmotion] || 0.5;
    
    if (score > 0.7) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  identifyCommunicationStyle(emotionAnalysis) {
    const emotion = emotionAnalysis.primaryEmotion;
    
    const styles = {
      'happy': 'enthusiastic',
      'excited': 'energetic',
      'confident': 'assertive',
      'confused': 'hesitant',
      'frustrated': 'terse',
      'anxious': 'cautious',
      'sad': 'withdrawn',
      'neutral': 'balanced'
    };
    
    return styles[emotion] || 'neutral';
  }

  identifyConcernAreas(emotionAnalysis, callData) {
    const concerns = [];
    const emotion = emotionAnalysis.primaryEmotion;
    const intensity = emotionAnalysis.intensity;
    
    if (['frustrated', 'angry'].includes(emotion) && intensity > 0.6) {
      concerns.push('High frustration may lead to dropout');
    }
    
    if (emotion === 'confused' && intensity > 0.5) {
      concerns.push('Student needs additional clarification');
    }
    
    if (emotion === 'anxious' && intensity > 0.7) {
      concerns.push('Anxiety may impact decision-making');
    }
    
    if (callData.duration && callData.duration < 60 && ['frustrated', 'angry'].includes(emotion)) {
      concerns.push('Short call with negative emotion - follow-up needed');
    }
    
    return concerns;
  }

  identifyPositiveIndicators(emotionAnalysis) {
    const indicators = [];
    const emotion = emotionAnalysis.primaryEmotion;
    const intensity = emotionAnalysis.intensity;
    
    if (['happy', 'excited'].includes(emotion)) {
      indicators.push('Positive emotional state');
    }
    
    if (emotion === 'confident') {
      indicators.push('Student shows confidence in decision-making');
    }
    
    if (intensity > 0.7 && ['happy', 'excited', 'confident'].includes(emotion)) {
      indicators.push('Strong positive engagement');
    }
    
    return indicators;
  }

  identifyEmotionalRiskFactors(emotionAnalysis) {
    const risks = [];
    const emotion = emotionAnalysis.primaryEmotion;
    const intensity = emotionAnalysis.intensity;
    const confidence = emotionAnalysis.confidence;
    
    if (['frustrated', 'angry', 'disappointed'].includes(emotion) && intensity > 0.6) {
      risks.push({
        type: 'dropout_risk',
        level: intensity > 0.8 ? 'high' : 'medium',
        reason: 'Negative emotions may lead to withdrawal'
      });
    }
    
    if (emotion === 'confused' && confidence > 0.7) {
      risks.push({
        type: 'comprehension_risk',
        level: 'medium',
        reason: 'Student may not understand process requirements'
      });
    }
    
    if (emotion === 'anxious' && intensity > 0.7) {
      risks.push({
        type: 'decision_paralysis',
        level: 'medium',
        reason: 'High anxiety may prevent decision-making'
      });
    }
    
    return risks;
  }

  getDefaultEmotionAnalysis() {
    return {
      primaryEmotion: 'neutral',
      confidence: 0.5,
      emotionScores: { neutral: 1.0 },
      analysisType: 'default'
    };
  }

  generateFallbackAnalysis(callData) {
    return {
      emotion: 'neutral',
      confidence: 0.3,
      intensity: 0.5,
      valence: 'neutral',
      arousal: 'medium',
      insights: {
        primaryInsight: 'Emotion analysis unavailable - manual review recommended',
        emotionalState: { state: 'unknown', intensity: 'unknown', confidence: 'low' },
        engagementLevel: 'unknown'
      },
      recommendations: {
        immediate: ['Manual review of call recording'],
        followUp: ['Standard follow-up procedure'],
        longTerm: []
      },
      note: 'Fallback analysis due to processing error'
    };
  }
}

module.exports = new EmotionalAnalyzer();