# Google AI Mode Scraper (LLM-chat-scraper)

Scraper for collecting structured conversation data from **Google AI Mode** using the official **Scrapeless Cloud Browser SDK**.

## Installation
Install the Scrapeless SDK:  `npm install @scrapeless-ai/sdk`

## Configuration
Copy the example environment file:  `cp .env.example .env`

Then edit `.env` and add:  `SCRAPELESS_API_KEY=your_api_key_here`

## Important
After configuring `.env`, you need to edit `src/ai_mode.ts` to replace placeholder values:

| Field            | Description                                                     |
|------------------|-----------------------------------------------------------------|
| `proxyCountry`   | Country for proxy routing (e.g., `"ANY"`, `"US"`, `"BR"` etc.)  |
| `sessionName`    | Name of the browser session (e.g., `"google-ai-mode-scraper"`) |
| `prompt`         | Your Google AI Overview query or instruction                    |
| `timeout`        | Maximum wait time for the response in milliseconds              |
