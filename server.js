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
          content: `Analyze the following medical transcript and return a JSON object with the following keys:\n
{
  "summary": "A robust, multi-sentence summary covering all the concepts discussed.",
  "specialty": "A short phrase indicating the medical specialty (e.g., 'Ophthalmology')",
  "date": "If a date is mentioned, return it; otherwise return 'Date not specified'"
}

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

    let { summary, specialty, date } = parsed;

    // Fallback date if not provided
    if (!date || date.toLowerCase().includes('not specified')) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      date = `${yyyy}-${mm}-${dd}`;
    }

    // Generate TLDR
    const tldrResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: 'You are an assistant that produces clear, concise medical TLDRs.' },
        { role: 'user', content: `Please provide a TLDR (1–2 sentences) of the following transcript:\n\n${transcript}` }
      ],
      temperature: 0.5,
      max_tokens: 80
    });

    const tldr = tldrResponse.choices[0].message.content.trim();

    return res.json({
      success: true,
      summary: summary || 'No summary available',
      specialty: specialty || 'Specialty not identified',
      date,
      tldr: tldr || ''
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
