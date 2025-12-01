# Grok Scraper (LLM-grok-scraper)

Scraper for collecting structured conversation data from **Grok** using the official **Scrapeless Cloud Browser SDK**.

## Installation
Install the Scrapeless SDK:
`npm install @scrapeless-ai/sdk`

## Configuration
Copy the example environment file:
`cp .env.example .env`

Then edit `.env` and add:
`SCRAPELESS_API_KEY=your_api_key_here`

## Important
After configuring `.env`, you need to edit `src/grok.ts` to replace placeholder values:

| Field             | Description                                                 |
|-------------------|-------------------------------------------------------------|
| `sessionTTL`      | Scrapeless browser session TTL (in seconds)                 |
| `sessionRecording`| Enable session recording (`true`/`false`)                   |
| `sessionName`     | Name for the Scrapeless browser session                     |
| `proxyCountry`    | Country of the proxy exit node (e.g. `US`)                  |
| `prompt`          | The message you want Grok to respond to                     |
