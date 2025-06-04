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
    const webmExt = '.webm';
    const wavExt = '.wav';
    const webmPath = audioPath + webmExt;
    // Rename the temporary file to have .webm extension
    renameSync(audioPath, webmPath);

    // Convert WebM → WAV using ffmpeg (must have ffmpeg installed)
    const wavPath = audioPath + wavExt;
    execSync(`ffmpeg -y -i "${webmPath}" "${wavPath}"`);

    // Now read the WAV file for transcription
    const audioStream = createReadStream(wavPath);

    // Call OpenAI's audio transcription using the WAV stream
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "gpt-4o-mini-transcribe",
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

    // Call OpenAI's chat completion for summarisation
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: 'You are a concise summarisation assistant.' },
        { role: 'user', content: `Please provide a concise summary of the following text:\n\n${transcript}` }
      ],
      temperature: 0.7,
      max_tokens: 300
    });
    const summary = chatResponse.choices[0].message.content.trim();
    return res.json({ success: true, summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Summarisation failed.' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});