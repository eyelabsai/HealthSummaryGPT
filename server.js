// server.js

import express from 'express';
import multer from 'multer';
import { createReadStream, renameSync } from 'fs';
import OpenAI from 'openai';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();
const upload = multer({ dest: 'uploads/' });

// Initialise OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 1) Transcription endpoint
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioPath = req.file.path;
    const webmPath = audioPath + '.webm';
    const wavPath = audioPath + '.wav';

    // Rename to .webm
    renameSync(audioPath, webmPath);

    // Convert to .wav using ffmpeg
    execSync(`ffmpeg -y -i "${webmPath}" "${wavPath}"`);

    const audioStream = createReadStream(wavPath);

    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      response_format: "json",
      temperature: 1.0
    });

    const transcript = transcriptionResponse.text;
    return res.json({ success: true, transcript });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Transcription failed.' });
  }
});

// 2) Summarisation endpoint
app.post('/summarise', async (req, res) => {
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

    let { summary, specialty, date, tldr, medications } = parsed;

    // Always use today's date for new visits (since they're being recorded now)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    date = `${yyyy}-${mm}-${dd}`;

    console.log('Setting visit date to today:', date);

    return res.json({
      success: true,
      summary: summary || 'No summary available',
      specialty: specialty || 'Specialty not identified',
      date,
      tldr: tldr || '',
      medications: medications || []
    });
  } catch (err) {
    console.error('Summarisation error:', err);
    return res.status(500).json({ success: false, error: 'Summarisation failed.' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
