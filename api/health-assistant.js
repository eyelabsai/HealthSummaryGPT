import OpenAI from 'openai';
import { userService, visitService, medicationService } from '../services/firebase-service.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

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
} 