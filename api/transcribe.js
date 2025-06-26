import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // For serverless, we'll need to handle the audio data differently
    // This is a simplified version - you may need to adjust based on how you're sending the audio
    const { audioData, audioFormat = 'webm' } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ success: false, error: 'No audio data provided.' });
    }

    // Convert base64 to buffer if needed
    const audioBuffer = Buffer.from(audioData, 'base64');

    console.log('Sending to OpenAI for transcription...');
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioBuffer,
      model: "whisper-1",
      response_format: "json",
      temperature: 0.3,
      language: "en"
    });

    const transcript = transcriptionResponse.text;
    console.log(`Transcription completed. Length: ${transcript.length} characters`);
    
    return res.json({ success: true, transcript });
  } catch (err) {
    console.error('Transcription error:', err);
    
    let errorMessage = 'Transcription failed.';
    if (err.message.includes('timeout')) {
      errorMessage = 'Audio processing timed out. Please try a shorter recording.';
    } else if (err.message.includes('file size')) {
      errorMessage = 'Audio file is too large. Please try a shorter recording.';
    }
    
    return res.status(500).json({ success: false, error: errorMessage });
  }
} 