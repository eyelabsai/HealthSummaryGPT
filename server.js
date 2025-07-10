// server.js - Vercel Compatible Version (No OpenAI SDK)

import express from 'express';
import multer from 'multer';
import { FormData, fetch } from 'undici';
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

// Configure multer for document uploads
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
    files: 10 // Allow multiple files
  }
});

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Server is working!', timestamp: new Date().toISOString() });
});



// 1) Transcription endpoint - Direct OpenAI API call using FormData
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided.' });
    }

    console.log('Received audio file:', req.file.originalname, 'Size:', req.file.size);
    console.log('File mimetype:', req.file.mimetype);

    // Create proper FormData for OpenAI API using undici
    const formData = new FormData();
    
    // Add form fields
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('temperature', '0.3');
    formData.append('language', 'en');
    
    // Fix filename issue - ensure proper extension for OpenAI validation
    const filename = req.file.originalname && req.file.originalname !== 'blob' 
      ? req.file.originalname.endsWith('.webm') 
        ? req.file.originalname 
        : req.file.originalname + '.webm'
      : 'recording.webm'; // fallback name with valid extension
    
    console.log('Using filename:', filename);
    
    // Create a File-like object for undici FormData
    const audioFile = new File([req.file.buffer], filename, {
      type: req.file.mimetype || 'audio/webm'
    });
    
    // Add the audio file 
    formData.append('file', audioFile);

    console.log('Sending to OpenAI for transcription...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
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
  "medicationActions": [
    {
      "action": "start|stop|continue|modify",
      "medicationName": "Name of the medication",
      "genericReference": "Optional generic reference like 'ointment', 'drops', 'antibiotic'",
      "reason": "Reason for the action (e.g., 'symptoms resolved', 'side effects', 'completed course')",
      "newInstructions": "New instructions if modifying (optional)"
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

For medicationActions, detect when the doctor mentions:
- Starting a new medication: "start", "begin", "prescribe", "add"
- Stopping a medication: "stop", "discontinue", "no longer", "cease", "end"
- Continuing a medication: "continue", "keep taking", "maintain"
- Modifying a medication: "change", "adjust", "modify", "increase", "decrease"
- Generic references: "the antibiotic", "the drops", "the ointment", "the medication"

CRITICAL: Medication Stop Actions
You MUST detect and extract ALL medication stop/discontinue actions, including:
- "stop using [medication]"
- "discontinue [medication]"
- "you can stop [medication]"
- "no longer need [medication]"
- "cease [medication]"
- "end [medication]"
- "stop [medication]"
- "discontinue the use of [medication]"
- "can discontinue [medication]"
- "should stop [medication]"
- "stop taking [medication]"

When you detect ANY of these patterns, create a medicationAction with:
- action: "stop"
- medicationName: the specific medication name
- reason: the reason given (e.g., "symptoms resolved", "condition healed", "no longer needed")
- Do NOT include stopped medications in the "medications" array

Examples:
- "Stop using erythromycin" → medicationAction: {"action": "stop", "medicationName": "erythromycin", "reason": "condition resolved"}
- "You can discontinue the antibiotic" → medicationAction: {"action": "stop", "medicationName": "antibiotic", "genericReference": "antibiotic", "reason": "treatment completed"}

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
If no medication actions are mentioned, return an empty array for the "medicationActions" key.
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

    let { summary, specialty, date, tldr, medications, medicationActions, chronicConditions } = parsed;

    console.log('Setting visit date to today:', date);
    console.log('AI detected medication actions:', JSON.stringify(medicationActions, null, 2));
    console.log('AI detected medications:', JSON.stringify(medications, null, 2));

    return res.json({
      success: true,
      summary: summary || 'No summary available',
      specialty: specialty || 'Specialty not identified',
      date,
      tldr: tldr || '',
      medications: medications || [],
      medicationActions: medicationActions || [],
      chronicConditions: chronicConditions || []
    });
  } catch (err) {
    console.error('Summarisation error:', err);
    return res.status(500).json({ success: false, error: 'Summarisation failed.' });
  }
});

// Health AI Assistant endpoint - Enhanced with conversation context and temporal intelligence
app.post('/api/health-assistant', async (req, res) => {
  try {
    const { userId, query, conversationHistory = [] } = req.body;
    if (!userId || !query) {
      return res.status(400).json({ success: false, error: 'Missing userId or query.' });
    }
    
    // Fetch user profile, visits, and medications with full details
    const [profile, visits, medications] = await Promise.all([
      userService.getUserById(userId),
      visitService.getUserVisits(userId),
      medicationService.getUserMedications(userId)
    ]);
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }
    
    // Add current date context for temporal queries
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const lastMonthName = lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Sort visits by date (newest first) and add relative time context
    const sortedVisits = visits.sort((a, b) => {
      const dateA = a.startedAt ? new Date(a.startedAt) : new Date(a.date);
      const dateB = b.startedAt ? new Date(b.startedAt) : new Date(b.date);
      return dateB - dateA;
    });
    
    // Group visits by month for temporal analysis
    const visitsByMonth = {};
    sortedVisits.forEach(visit => {
      const visitDate = visit.startedAt ? new Date(visit.startedAt) : new Date(visit.date);
      const monthKey = visitDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!visitsByMonth[monthKey]) {
        visitsByMonth[monthKey] = [];
      }
      visitsByMonth[monthKey].push(visit);
    });
    
    // Format detailed medication information including smart schedules and start dates
    const detailedMedications = medications.map(med => {
      let medInfo = `- ${med.name}`;
      if (med.dosage) medInfo += ` (${med.dosage})`;
      if (med.frequency) medInfo += ` - ${med.frequency}`;
      if (med.timing) medInfo += ` at ${med.timing}`;
      if (med.route) medInfo += ` via ${med.route}`;
      if (med.laterality) medInfo += ` (${med.laterality})`;
      if (med.duration) medInfo += ` for ${med.duration}`;
      if (med.fullInstructions) medInfo += `\n  Instructions: ${med.fullInstructions}`;
      if (med.startDate) {
        const startDate = new Date(med.startDate);
        const startMonth = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        medInfo += `\n  Started: ${med.startDate} (${startMonth})`;
      }
      return medInfo;
    }).join('\n');
    
    // Create temporal visit summary
    const temporalVisitSummary = Object.entries(visitsByMonth).map(([month, monthVisits]) => {
      return `${month}: ${monthVisits.length} visit(s)
${monthVisits.map(v => `  - ${v.date}: ${v.specialty} - ${v.tldr || v.summary || 'No summary'}`).join('\n')}`;
    }).join('\n\n');
    
    // Format context for LLM with enhanced temporal and medication details
    const context = `CURRENT DATE: ${currentDate.toLocaleDateString()} (${currentMonth})
LAST MONTH: ${lastMonthName}

PATIENT PROFILE:
${JSON.stringify(profile, null, 2)}

VISIT HISTORY BY MONTH:
${temporalVisitSummary}

CURRENT MEDICATIONS (with detailed schedules and start dates):
${detailedMedications}

CHRONIC CONDITIONS:
${profile.chronicConditions || 'None listed'}`;
    
    // Build conversation messages with history for context
    const messages = [
      {
        role: 'system',
        content: `You are a helpful health assistant for this specific patient. Use the following patient data to answer questions accurately. 

TEMPORAL QUERY HANDLING:
- When asked about "last month" or specific months, filter information to that time period only
- When asked about "the past X months/weeks", calculate the appropriate date range
- Always specify the time period you're referring to in your response
- If no data exists for the requested time period, clearly state that

MEDICATION RESPONSES:
- Refer to specific details including dosages, schedules, start dates, and instructions
- When discussing duration or "how long", check the detailed medication information
- Use the smart schedule data when available

CONVERSATION CONTEXT:
- Use the conversation history to understand follow-up questions and references
- When someone asks "how long do I take it" after asking about a specific medication, understand the context

Always provide specific, personalized answers based on the patient's actual data and the requested time frame.`
      },
      {
        role: 'user',
        content: `${context}\n\nUSER QUESTION:\n${query}`
      }
    ];
    
    // Add conversation history for context (last 6 messages to avoid token limits)
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6);
      const historyContext = recentHistory.map(msg => 
        `${msg.role === 'user' ? 'Patient' : 'Assistant'}: ${msg.content}`
      ).join('\n');
      
      messages[1].content = `RECENT CONVERSATION:
${historyContext}

${context}

CURRENT QUESTION:
${query}`;
    }
    
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

// Document upload endpoint
app.post('/api/upload-document', documentUpload.single('document'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    
    const file = req.file;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid file type. Only PDF, PNG, JPG, and JPEG files are allowed.' 
      });
    }
    
    // Create document data
    const documentData = {
      userId,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      uploadDate: new Date().toISOString(),
      buffer: file.buffer // Pass the buffer directly instead of base64
    };
    
    // Save to Firestore (we'll add this to firebase-service.js)
    const docRef = await userService.createDocument(documentData);
    
    res.json({
      success: true,
      documentId: docRef.id,
      message: 'Document uploaded successfully'
    });
    
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, error: 'Document upload failed.' });
  }
});

// Get user documents endpoint
app.get('/api/documents', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId.' });
    }
    
    const documents = await userService.getUserDocuments(userId);
    
    // Remove binary data from response for list view
    const documentsWithoutData = documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      uploadDate: doc.uploadDate
    }));
    
    res.json(documentsWithoutData);
    
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve documents.' });
  }
});

// Download document endpoint
app.get('/api/download-document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId.' });
    }
    
    const document = await userService.getDocumentById(documentId, userId);
    
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }
    
    // Redirect to Firebase Storage download URL
    res.redirect(document.downloadURL);
    
  } catch (err) {
    console.error('Download document error:', err);
    res.status(500).json({ success: false, error: 'Failed to download document.' });
  }
});

// Delete document endpoint
app.delete('/api/delete-document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId.' });
    }
    
    await userService.deleteDocument(documentId, userId);
    
    res.json({ success: true, message: 'Document deleted successfully' });
    
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete document.' });
  }
});

// Export for Vercel
export default app;
