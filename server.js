// server.js

import express from 'express';
import multer from 'multer';

import OpenAI, { toFile } from 'openai';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { userService, visitService, medicationService } from './services/firebase-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();

// Configure multer with file size limits for longer recordings
const upload = multer({ 
  storage: multer.memoryStorage(), // Use in-memory storage
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for longer recordings
    files: 1
  }
});

// Initialise OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());



// 1) Transcription endpoint - Updated for serverless (no FFmpeg)
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided.' });
    }

    console.log('Received audio file:', req.file.originalname, 'Size:', req.file.size);

    // Create a File object directly from the buffer - OpenAI Whisper can handle WebM directly
    const audioFile = await toFile(req.file.buffer, 'recording.webm', { 
      contentType: req.file.mimetype || 'audio/webm' 
    });

    console.log('Sending to OpenAI for transcription...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text',
      temperature: 0.3,
      language: 'en'
    });

    console.log(`Transcription completed. Length: ${transcription.length} characters`);
    res.json({ success: true, transcript: transcription });
  } catch (err) {
    console.error('Transcription error:', err);
    
    let errorMessage = 'Transcription failed.';
    if (err.message && err.message.includes('timeout')) {
      errorMessage = 'Audio processing timed out. Please try a shorter recording.';
    } else if (err.message && err.message.includes('file size')) {
      errorMessage = 'Audio file is too large. Please try a shorter recording.';
    }
    
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// 2) Summarisation endpoint
app.post('/api/summarise', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ success: false, error: 'No transcript provided.' });
    }

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'system',
          content: 'You are a medical summarization assistant. Please produce a detailed, structured, and comprehensive summary that captures all key details from the transcript. Your summary should not omit any information but should be succinct and easy to understand.'
        },
        {
          role: 'user',
          content: `Analyze the following medical transcript and return a JSON object with the following keys:
{
  "summary": "A robust, multi-sentence summary covering all the concepts discussed.",
  "tldr": "A very short, one-sentence summary.",
  "specialty": "A short phrase indicating the medical specialty (e.g., 'Ophthalmology')",
  "date": "Extract the actual appointment/visit date. If the transcript mentions 'today', 'today's visit', 'today's appointment', or similar phrases indicating this is happening today, return 'TODAY'. If a specific date is mentioned (like 'March 15th'), return that date. If no date context is found, return 'Not specified'.",
  "medications": [
    {
      "name": "Corrected medication name (fix any transcription spelling errors)",
      "dosage": "e.g., 10mg",
      "frequency": "e.g., daily, twice daily, every 8 hours",
      "timing": "e.g., morning, evening, with meals, before bed",
      "route": "e.g., oral, eye drops, topical",
      "laterality": "e.g., left eye, right eye, both eyes (if applicable)",
      "duration": "e.g., 7 days, until finished, ongoing",
      "instructions": "Any special instructions like 'take with food', 'avoid alcohol', 'shake well'",
      "fullInstructions": "Complete patient instructions combining all the above information"
    }
  ],
  "chronicConditions": [
    "List of chronic conditions mentioned or discussed in the transcript. Use standard medical terminology. Examples: 'Hypertension', 'Diabetes', 'Asthma', 'COPD', 'Coronary Artery Disease', 'Chronic Kidney Disease', 'Hyperlipidemia', 'Hypothyroidism', 'Depression', 'Anxiety', 'Arthritis', 'Cancer', 'Obesity'. Only include conditions that are explicitly mentioned as being diagnosed, confirmed, or discussed as ongoing issues."
  ]
}

For medications, extract ALL available information including:
- Exact dosage and frequency
- Timing (when to take)
- Route of administration
- Eye laterality for eye medications
- Duration of treatment
- Special instructions or warnings
- Combine everything into a clear, patient-friendly fullInstructions field

For chronic conditions:
- Extract any chronic conditions mentioned in the transcript
- Use standard medical terminology (e.g., 'Hypertension' not 'high blood pressure')
- Only include conditions that are explicitly mentioned as diagnosed or ongoing
- Do not include acute conditions or temporary issues
- If no chronic conditions are mentioned, return an empty array

IMPORTANT: Date Extraction
- If the transcript mentions "today", "today's visit", "today's appointment", "during today's visit", etc., return "TODAY" (not the actual date)
- If a specific date is mentioned (like "March 15th", "last week", "yesterday"), convert it to YYYY-MM-DD format
- Look for context clues like "in today's appointment we discussed", "during this visit", "today I'm here for"
- If no date context is found, return "Not specified"

IMPORTANT: Medication Name Correction
- If a medication name appears to be misspelled or phonetically transcribed incorrectly, correct it to the proper spelling
- Common transcription errors include:
  * Phonetic misspellings (e.g., "cosopt" transcribed as "cosoft", "cosopted")
  * Similar-sounding letters (e.g., "b" vs "p", "f" vs "ph", "c" vs "k")
  * Missing or extra syllables
  * Common drug name variations
- Use your medical knowledge to identify and correct medication names to their standard pharmaceutical spelling
- Consider the medical specialty context to help identify the most likely medication
- If you're unsure about a medication name, make your best educated guess based on context and common medications

If no medications are mentioned, return an empty array for the "medications" key.
If no chronic conditions are mentioned, return an empty array for the "chronicConditions" key.

Transcript:
${transcript}`
        }
      ],
      temperature: 0.4,
      max_tokens: 800
    });

    const rawContent = chatResponse.choices[0].message.content.trim();

    // If JSON is wrapped in code block
    const match = rawContent.match(/```json\s*([\s\S]*?)```/);
    const jsonText = match ? match[1].trim() : rawContent;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (jsonErr) {
      console.error('Failed to parse JSON:', jsonErr);
      console.error('Raw model output:\n', rawContent);
      return res.status(500).json({
        success: false,
        error: 'OpenAI summarization returned invalid JSON.',
        rawResponse: rawContent
      });
    }

    let { summary, specialty, date, tldr, medications, chronicConditions } = parsed;

    // Always use today's date for new visits (since they're being recorded now)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('Setting visit date to today:', date);

    return res.json({
      success: true,
      summary: summary || 'No summary available',
      specialty: specialty || 'Specialty not identified',
      date,
      tldr: tldr || '',
      medications: medications || [],
      chronicConditions: chronicConditions || []
    });
  } catch (err) {
    console.error('Summarisation error:', err);
    return res.status(500).json({ success: false, error: 'Summarisation failed.' });
  }
});

// Health AI Assistant endpoint
app.post('/api/health-assistant', async (req, res) => {
  try {
    const { userId, query } = req.body;
    if (!userId || !query) {
      return res.status(400).json({ success: false, error: 'Missing userId or query.' });
    }
    // Fetch user profile, visits, and medications
    const [profile, visits, medications] = await Promise.all([
      userService.getUserById(userId),
      visitService.getUserVisits(userId),
      medicationService.getUserMedications(userId)
    ]);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }
    // Format context for LLM
    const context = `PATIENT PROFILE:\n${JSON.stringify(profile, null, 2)}\n\nVISIT HISTORY:\n${visits.map(v => `- ${v.date}: ${v.summary || v.tldr || ''}`).join('\n')}\n\nCURRENT MEDICATIONS:\n${medications.map(m => `- ${m.name} ${m.dosage || ''} ${m.frequency || ''}` ).join('\n')}`;
    // Compose prompt
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful health assistant. Use the following patient data to answer questions, summarize, or provide predictions. If you don\'t know, say so.'
      },
      {
        role: 'user',
        content: `${context}\n\nUSER QUESTION:\n${query}`
      }
    ];
    // Call OpenAI
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.3,
      max_tokens: 800
    });
    const answer = chatResponse.choices[0].message.content.trim();
    return res.json({ success: true, answer });
  } catch (err) {
    console.error('Health Assistant error:', err);
    return res.status(500).json({ success: false, error: 'Health Assistant failed.' });
  }
});

// Firebase endpoints
app.post('/api/visits', async (req, res) => {
  try {
    const visitData = req.body;
    const docRef = await visitService.createVisit(visitData);
    res.json({ success: true, visitId: docRef.id });
  } catch (err) {
    console.error('Create visit error:', err);
    res.status(500).json({ success: false, error: 'Failed to create visit.' });
  }
});

app.get('/api/visits/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const visits = await visitService.getUserVisits(userId);
    res.json({ success: true, visits });
  } catch (err) {
    console.error('Get visits error:', err);
    res.status(500).json({ success: false, error: 'Failed to get visits.' });
  }
});

app.delete('/api/visits/:visitId', async (req, res) => {
  try {
    const { visitId } = req.params;
    await visitService.deleteVisit(visitId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete visit error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete visit.' });
  }
});

app.post('/api/medications', async (req, res) => {
  try {
    const medicationData = req.body;
    const docRef = await medicationService.createMedication(medicationData);
    res.json({ success: true, medicationId: docRef.id });
  } catch (err) {
    console.error('Create medication error:', err);
    res.status(500).json({ success: false, error: 'Failed to create medication.' });
  }
});

app.get('/api/medications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const medications = await medicationService.getUserMedications(userId);
    res.json({ success: true, medications });
  } catch (err) {
    console.error('Get medications error:', err);
    res.status(500).json({ success: false, error: 'Failed to get medications.' });
  }
});

app.delete('/api/medications/:medicationId', async (req, res) => {
  try {
    const { medicationId } = req.params;
    await medicationService.deleteMedication(medicationId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete medication error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete medication.' });
  }
});

// Start server for local development
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

// Export for Vercel
export default app;
