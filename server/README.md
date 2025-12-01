# Simple Chatbot Server


The server supports two bot implementations:

 **OLLAMA Bot**
   - Uses Ollama local conversation
   - requires `phi3:mini` install in windows  


## Setup

1. Configure environment variables

   Create a `.env` file (If needed):

   ```bash
   cp env.example .env
   ```

   Then, add your API keys (Which chat integration you have to use its up to you In this example used Ollama):

   ```ini
   # Required API Keys
   DAILY_API_KEY=           # Your Daily API key
   OPENAI_API_KEY=          # Your OpenAI API key (required for OpenAI bot)
   GOOGLE_API_KEY=          # Your Google Gemini API key (required for Gemini bot)
   ELEVENLABS_API_KEY=      # Your ElevenLabs API key

   # Optional Configuration
   DAILY_API_URL=           # Optional: Daily API URL (defaults to https://api.daily.co/v1)
   DAILY_SAMPLE_ROOM_URL=   # Optional: Fixed room URL for development
   ```

2. Set up a virtual environment and install dependencies

   ```bash
   npm install
   ```


3. Run the bot:

   ```bash
   node index.js
   ```