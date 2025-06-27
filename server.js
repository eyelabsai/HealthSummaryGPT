// server.js (Refactored for AWS)

import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- IMPORTANT ---
// You will need to install the necessary AWS SDK v3 packages:
// npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner axios uuid

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// =================================================================
// AWS Configuration
// These should be set in your .env file or environment variables
// =================================================================
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    // Ensure your server environment has AWS credentials configured
    // (e.g., via IAM role, or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in .env)
});

const RAW_AUDIO_BUCKET = process.env.RAW_AUDIO_BUCKET; // e.g., 'opencare-raw-audio-...'
const AGENT_API_URL = process.env.AGENT_API_URL; // The API Gateway URL for your OpenCareAgent

// =================================================================
// Refactored Endpoints
// =================================================================

/**
 * 1) Generate Secure Upload URL Endpoint (Replaces /api/transcribe)
 * This endpoint provides the frontend with a secure, one-time URL to upload an audio file directly to S3.
 * This is more scalable and secure than routing the file through our server.
 */
app.post('/api/generate-upload-url', async (req, res) => {
    try {
        const { userId, fileType } = req.body;
        if (!userId || !fileType) {
            return res.status(400).json({ success: false, error: 'Missing userId or fileType.' });
        }

        // Generate a unique key for the file to prevent overwrites
        const fileExtension = fileType.split('/')[1] || 'mp3'; // e.g., 'audio/mp3' -> 'mp3'
        const visitId = uuidv4(); // A unique ID for this new visit
        
        // The key should include the user's ID to keep their data separate
        const key = `private/${userId}/${visitId}/recording.${fileExtension}`;

        const command = new PutObjectCommand({
            Bucket: RAW_AUDIO_BUCKET,
            Key: key,
            ContentType: fileType,
        });

        // Generate the pre-signed URL which is valid for a short time (e.g., 5 minutes)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        console.log(`Generated upload URL for user ${userId}, visit ${visitId}`);

        res.json({
            success: true,
            uploadUrl: uploadUrl,
            visitId: visitId, // Send this back so the frontend knows the ID of the new visit
            key: key // The path where the file will be stored
        });

    } catch (err) {
        console.error('Error generating pre-signed URL:', err);
        res.status(500).json({ success: false, error: 'Could not generate upload URL.' });
    }
});


/**
 * 2) Health AI Assistant Endpoint (Refactored to use the OpenCareAgent)
 * This endpoint now acts as a simple proxy to your powerful AWS backend.
 * It no longer needs to fetch data or build context itself.
 */
app.post('/api/health-assistant', async (req, res) => {
    try {
        const { query } = req.body; // userId is no longer needed here, as the frontend will call the agent directly or this proxy just passes the query.
        if (!query) {
            return res.status(400).json({ success: false, error: 'Missing query.' });
        }

        if (!AGENT_API_URL) {
            return res.status(500).json({ success: false, error: 'Agent API URL is not configured on the server.' });
        }

        console.log(`Proxying query to OpenCareAgent: "${query}"`);

        // Forward the user's question to the API Gateway endpoint for the OpenCareAgent Lambda
        const agentResponse = await axios.post(AGENT_API_URL, {
            question: query
        });

        // Return the agent's answer directly to the frontend
        return res.json({ success: true, answer: agentResponse.data.answer });

    } catch (err) {
        console.error('Health Assistant error:', err.response ? err.response.data : err.message);
        return res.status(500).json({ success: false, error: 'Health Assistant failed.' });
    }
});

// =================================================================
// Server Startup Logic
// This block tells the server to start listening for requests.
// =================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`OpenCare server is running on http://localhost:${PORT}`);
});

// The 'export default app' is removed as it's not needed for local execution.
// If you were deploying to a serverless environment like Vercel, you would use that.
