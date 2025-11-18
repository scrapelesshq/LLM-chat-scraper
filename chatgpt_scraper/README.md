# ChatGPT Scraper (LLM-chat-scraper)

Scraper for collecting structured conversation data from **ChatGPT** using the official **Scrapeless Cloud Browser SDK**.

## Installation
Install the Scrapeless SDK:
`npm install @scrapeless-ai/sdk`

## Configuration
Copy the example environment file:
`cp .env.example .env`

Then edit `.env` and add:
`SCRAPELESS_API_KEY=your_api_key_here`

## Important
After configuring ``.env``, you need to edit ``src/chatgpt.ts`` to replace placeholder values:

| Field        | Description                                         |
|--------------|-----------------------------------------------------|
| `task_id`    | A unique identifier for this scraping task         |
| `proxy_url`  | [Your Proxy URL](https://docs.scrapeless.com/en/proxies/quickstart/introduction?utm_source=official&utm_term=githubopen)|
| `prompt`     | The message or query you want ChatGPT to respond to |
| `webhook`    | Optional webhook URL to send results               |
| `web_search` | Enable web search functionality (`true`/`false`)  |
| `timeout`    | Maximum wait time for responses in milliseconds |
| `session_name` | Optional name for the browser session           |
