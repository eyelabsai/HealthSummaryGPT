# OpenCare - Health Visit Tracker

A comprehensive health management application that allows users to record, transcribe, and analyze their medical visits using AI-powered transcription and summarization.

## Features

- **AI-Powered Transcription**: Convert audio recordings of medical visits to text using OpenAI Whisper
- **Intelligent Summarization**: Extract key medical information, medications, and visit details
- **Health Assistant**: AI-powered chat interface to query and analyze health data
- **Medication Management**: Track current medications with detailed instructions
- **Visit History**: Comprehensive visit tracking with specialty categorization
- **User Profiles**: Complete health profiles with chronic conditions and demographics
- **Firebase Integration**: Real-time cloud storage with user authentication

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **AI Services**: OpenAI GPT-4o, Whisper
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Deployment**: Vercel

## Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd HealthSummaryGPT
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Configure Firebase**
   - Set up a Firebase project
   - Add your Firebase config to `firebase-config.js`
   - Enable Authentication and Firestore

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Access the application**
   Open `http://localhost:3000` in your browser

## Vercel Deployment

### Prerequisites
- Vercel account
- Firebase project
- OpenAI API key

### Deployment Steps

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   vercel
   ```

3. **Set environment variables**
   In Vercel dashboard → Project Settings → Environment Variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Configure Firebase**
   - Your existing Firebase config in `firebase-config.js` will work
   - No additional Firebase setup needed for Vercel

### Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for transcription and AI features | Yes |

## Usage

### Recording a New Visit
1. Click "Start New Visit" on the dashboard
2. Record audio of your medical visit
3. AI will transcribe and summarize the visit
4. Review and confirm extracted medications
5. Save the visit to your health history

### Using the Health Assistant
1. Type questions about your health in the chat interface
2. Ask about medications, visit summaries, or health trends
3. Get AI-powered insights based on your complete health data

### Managing Profile
1. Click "Profile" to view/edit your health information
2. Update personal details, chronic conditions, and demographics
3. All changes are automatically saved to your secure profile

## API Endpoints

### Local Development
- `POST /transcribe` - Audio transcription
- `POST /summarise` - Visit summarization
- `POST /health-assistant` - Health AI assistant

### Vercel Deployment
- `POST /api/transcribe` - Audio transcription
- `POST /api/summarise` - Visit summarization
- `POST /api/health-assistant` - Health AI assistant

## Security

- All user data is stored securely in Firebase
- Authentication required for all operations
- Environment variables protect sensitive API keys
- CORS properly configured for cross-origin requests

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify environment variables are set correctly
3. Ensure Firebase project is properly configured
4. Check Vercel function logs for backend errors

## License

ISC License
# Force deployment
