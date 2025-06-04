# WhisperTranscription

A minimal Node.js service that records audio via the browser, transcribes speech using OpenAI’s `gpt-4o-mini-transcribe`, then—on demand—summarises the transcript with `gpt-4o-mini`.  

## Overview  
This application provides:  
1. A simple front end (HTML/JavaScript) that captures microphone input and uploads it as a WebM blob.  
2. An Express-powered back end that:  
   - Converts the browser-generated WebM to WAV (via `ffmpeg`).  
   - Streams the resulting WAV to OpenAI’s transcription endpoint.  
   - Returns the transcript to the browser.  
   - Accepts a transcript and returns a concise summary via the LLM.  

You can record your voice, obtain a transcription, then click “Summarise” to receive a condensed version.  

## Prerequisites  
- **Node.js** (v16 or later) and **npm** installed.  
- **ffmpeg** installed on your system (Homebrew, apt, etc.), so that the WebM→WAV conversion works.  
- An **OpenAI API key** with access to the `gpt-4o-mini-transcribe` and `gpt-4o-mini` models.  

## Installation  

1. **Clone the repository** (or copy files) into a local folder:  
   ```bash
   git clone https://github.com/your-username/WhisperTranscription.git
   cd WhisperTranscription
   ```

	2.	Install Node.js dependencies:
 3.	
```
npm install
```

	3.	Install ffmpeg (if not already):
	•	macOS (Homebrew):
```
brew install ffmpeg
```

	•	Ubuntu/Debian:
```
sudo apt update
sudo apt install ffmpeg
```

	•	Confirm installation with:
```
ffmpeg -version
```

	4.	Configure environment variables:
Create a file named .env in the project root with:

```
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE
```

Ensure that the key is valid and grants access to both gpt-4o-mini-transcribe and gpt-4o-mini.

Project Structure

.
├── public
│   └── index.html           ← Front-end HTML/JS for recording, transcription, summarisation
├── uploads                  ← Multer’s temporary storage for incoming audio blobs
├── server.js                ← Main Express server
├── package.json
└── .env                     ← Contains your OpenAI API key (not committed to Git)

Configuration
	•	package.json
	•	Has "type": "module" set, so Node treats .js files as ES modules.
	•	Dependencies:
	•	express for HTTP server.
	•	multer for handling file uploads.
	•	openai v5 SDK to call OpenAI’s endpoints.
	•	dotenv to load environment variables.
	•	server.js
	•	Imports createReadStream and renameSync from fs, plus execSync from child_process.
	•	Defines two endpoints:
	1.	POST /transcribe: accepts an audio file (WebM blob).
	•	Renames the file to .webm.
	•	Converts WebM → WAV via ffmpeg.
	•	Streams the WAV to OpenAI’s transcription API (gpt-4o-mini-transcribe).
	•	Returns { success: true, transcript } on success.
	2.	POST /summarise: expects JSON { transcript: "…" }.
	•	Calls OpenAI’s chat completion (gpt-4o-mini) with a summarisation prompt.
	•	Returns { success: true, summary }.
	•	public/index.html
	•	Simple UI with:
	•	“Start Recording” and “Stop Recording” buttons (MediaRecorder API).
	•	A <textarea> to show the transcript.
	•	A “Summarise” button to request a summary.
	•	Status messages to indicate progress.

Usage
	1.	Start the server:

node server.js

You should see:

Server listening on port 3000


	2.	Open your browser at

http://localhost:3000

– You will see a page with “Start Recording” / “Stop Recording” buttons.

	3.	Record & transcribe:
	•	Click “🎤 Start Recording”, speak into your microphone, then click “⏹ Stop Recording”.
	•	The page will upload the WebM blob, server converts → WAV → transcribes with gpt-4o-mini-transcribe.
	•	Once complete, the raw transcript appears in the first textarea.
	4.	Summarize:
	•	Click “📄 Summarize Transcript”.
	•	The transcript is sent to the server, which calls gpt-4o-mini to produce a concise summary.
	•	The summary is displayed in the second textarea.

Endpoints

POST /transcribe
	•	Content-Type: multipart/form-data
	•	Form Field:
	•	audio (file): Browser-recorded audio blob (WebM).

Response (JSON):

{ 
  "success": true, 
  "transcript": "…your transcribed text…" 
}

Or, on failure:

{ 
  "success": false, 
  "error": "Transcription failed." 
}

POST /summarise
	•	Content-Type: application/json
	•	JSON Body:

{ 
  "transcript": "…full transcript text…" 
}

Response (JSON):

{ 
  "success": true, 
  "summary": "…concise summary…" 
}

Or, on failure:

{ 
  "success": false, 
  "error": "Summarisation failed." 
}

Troubleshooting
	1.	“ffmpeg: command not found”
	•	You must install ffmpeg (via Homebrew on macOS or your package manager).
	•	Confirm with ffmpeg -version.
	2.	“Audio file might be corrupted or unsupported”
	•	Ensure the front end is indeed sending a WebM blob (the code appends .webm).
	•	Check that ffmpeg successfully produces a valid WAV file (inspect uploads/xyz.wav).
	3.	“Could not parse multipart form”
	•	This occurs if you send a Buffer instead of a proper ReadStream. Make sure the code uses createReadStream on a renamed file with a correct extension.
	4.	Missing API key or invalid model
	•	Verify your .env has a valid OPENAI_API_KEY.
	•	Confirm access to gpt-4o-mini-transcribe and gpt-4o-mini on your OpenAI plan.

Licence

MIT Licence
