// server.js - Vercel Compatible Version (No OpenAI SDK)

import express from 'express';
import multer from 'multer';
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

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Helper function to create form data for OpenAI API
function createFormData(audioBuffer, filename, mimeType) {
  const boundary = '----formdata-' + Math.random().toString(36).substring(2, 15);
  const chunks = [];
  
  // Add model field
  chunks.push(`--${boundary}\r\n`);
  chunks.push(`Content-Disposition: form-data; name="model"\r\n\r\n`);
  chunks.push(`whisper-1\r\n`);
  
  // Add response_format field
  chunks.push(`--${boundary}\r\n`);
  chunks.push(`Content-Disposition: form-data; name="response_format"\r\n\r\n`);
  chunks.push(`text\r\n`);
  
  // Add temperature field
  chunks.push(`--${boundary}\r\n`);
  chunks.push(`Content-Disposition: form-data; name="temperature"\r\n\r\n`);
  chunks.push(`0.3\r\n`);
  
  // Add language field
  chunks.push(`--${boundary}\r\n`);
  chunks.push(`Content-Disposition: form-data; name="language"\r\n\r\n`);
  chunks.push(`en\r\n`);
  
  // Add file field
  chunks.push(`--${boundary}\r\n`);
  chunks.push(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`);
  chunks.push(`Content-Type: ${mimeType}\r\n\r\n`);
  
  // Combine text chunks
  const textData = Buffer.from(chunks.join(''));
  
  // Add file data
  const endBoundary = Buffer.from(`\r\n--${boundary}--\r\n`);
  
  return {
    data: Buffer.concat([textData, audioBuffer, endBoundary]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

// 1) Transcription endpoint - Direct OpenAI API call
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided.' });
    }

    console.log('Received audio file:', req.file.originalname, 'Size:', req.file.size);

    // Create form data for OpenAI API
    const formData = createFormData(
      req.file.buffer, 
      req.file.originalname || 'recording.webm',
      req.file.mimetype || 'audio/webm'
    );

    console.log('Sending to OpenAI for transcription...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': formData.contentType,
      },
      body: formData.data
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const transcription = await response.text();
    
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

// 2) Summarisation endpoint - Direct OpenAI API call
app.post('/api/summarise', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ success: false, error: 'No transcript provided.' });
    }

    const messages = [
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
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.4,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const chatResponse = await response.json();
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

// Health AI Assistant endpoint - Direct OpenAI API call
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
    
    // Call OpenAI API directly
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.3,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const chatResponse = await response.json();
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
