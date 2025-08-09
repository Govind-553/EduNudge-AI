# EduNudge AI - Admission Dropout Prevention System

🧠 **EduNudge AI** is an intelligent voice-powered system that proactively prevents student dropouts during the admission process using real-time conversational AI and automation workflows.

## 🚀 Features

- **🎙️ Voice AI Agent**: Emotion-aware voice conversations using Retell AI
- **🔄 Workflow Automation**: Automated follow-ups and monitoring with n8n
- **🧠 AI Intelligence**: Dynamic script generation with OpenAI GPT
- **💬 Multi-Channel Communication**: WhatsApp, Email, and Voice notifications    //whatsapp feature is partially functional
- **📊 Real-time Analytics**: Dashboard with dropout risk assessment
- **🎯 Personalized Nudging**: Behavioral psychology-based interventions

## 🏗️ Architecture

```
EduNudge-AI/
├── server/               # Node.js Express API
├── client/               # React.js Dashboard
├── firebase-functions/   # Cloud Functions
├── n8n-workflows/        # Automation Workflows
├── .env                  # Environment Configuration
└── README.md
```

## 📋 Prerequisites

- Node.js 20+
- Firebase Account
- Retell AI Account
- OpenAI API Key
- WhatsApp Business API Access
- n8n Instance

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/Govind-553/EduNudge-AI.git
cd EduNudge-AI
npm run install:all
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

### 3. Start Development
```bash
# Start server
npm run dev:server

# Start client (in another terminal)
npm run dev:client
```

### 4. Deploy Firebase Functions
```bash
cd firebase-functions
firebase deploy --only functions
```

## 📊 How It Works

### 1. **Dropout Detection**
- Monitors student application progress in real-time
- Calculates risk scores based on activity patterns
- Triggers interventions at optimal moments

### 2. **Voice AI Engagement**
- Initiates personalized voice calls via Retell AI
- Detects emotional cues during conversation
- Adapts responses based on student sentiment

### 3. **Automated Follow-ups**
- Sends WhatsApp messages and emails
- Schedules counselor interventions
- Tracks engagement across all channels

### 4. **Analytics & Insights**
- Real-time dashboard for counselors
- Conversion rate tracking
- Emotional analysis reports

## 🔧 Configuration

### Environment Variables

Key configurations in `.env`:

```bash
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=your-client-email

# Retell AI
RETELL_API_KEY=your-retell-api-key
RETELL_DEFAULT_AGENT_ID=your-agent-id

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# WhatsApp
WHATSAPP_API_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# n8n
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
N8N_API_KEY=your-n8n-api-key
```

## 📱 API Endpoints

### Voice Agent
- `POST /api/voice/create-call` - Initiate voice call
- `POST /api/voice/webhook` - Retell AI webhooks

### Student Management
- `GET /api/students` - List students
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student

### Webhooks
- `POST /api/webhook/n8n` - n8n automation triggers
- `POST /api/webhook/retell` - Retell AI events
- `POST /api/webhook/whatsapp` - WhatsApp messages

## 🎯 Workflows

### Admission Dropout Monitor
- Runs every 2 hours
- Assesses dropout risk
- Triggers appropriate interventions

### Voice Call Follow-up
- Initiates personalized calls
- Analyzes conversation outcomes
- Schedules counselor escalations

### Notification Sender
- Multi-channel messaging
- Template-based communications
- Delivery tracking

## 📈 Dashboard Features

- **Student Overview**: Risk assessment and status tracking
- **Call Analytics**: Success rates and emotional analysis  
- **Communication History**: All touchpoints across channels
- **Counselor Tools**: Briefings and escalation management

## 🔒 Security

- JWT authentication for API access
- Webhook signature verification
- Rate limiting and CORS protection
- Environment-based configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 🌟 Key Technologies

- **Backend**: Node.js, Express.js, Firebase
- **Frontend**: React.js, CSS3
- **AI/ML**: OpenAI GPT-3.5, Retell AI
- **Automation**: n8n workflows
- **Communication**: WhatsApp Business API
- **Analytics**: Firebase Analytics, Custom dashboards

---

## 🧑‍🤝‍🧑 Team

| Name       | Role                                 |
|------------|--------------------------------------|
| **Govind**     | Team Lead, Client-Server Management,  |
| **Abhiruchi**  | Backend Developer, AI                 |
| **Sahil**      | Firebase, UI/UX Design                |
| **Nishank**    | Testing & Integration                 |

---

**EduNudge AI** - Transforming educational admissions through intelligent automation and empathetic AI interactions.
