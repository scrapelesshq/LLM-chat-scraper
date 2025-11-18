![LLM-Chat-Scraper](https://github.com/user-attachments/assets/86192d5d-8d5d-4e89-931b-1da2d8dd9449)

</p>

<h1 align="center">LLM-Chat-Scraper</h1>

<p align="center">
  <strong>Scrapers for collecting structured data from AI chat platforms</strong><br/>
  ChatGPT, Perplexity, Gemini, Claude, Copilot, Groq, Google AI Mode and more — built for researchers, integrators and automation pipelines.
</p>

  <p align="center">
    <a href="https://www.youtube.com/@Scrapeless" target="_blank">
      <img src="https://img.shields.io/badge/Follow%20on%20YouTuBe-FF0033?style=for-the-badge&logo=youtube&logoColor=white" alt="Follow on YouTuBe" />
    </a>
    <a href="https://discord.com/invite/xBcTfGPjCQ" target="_blank">
      <img src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join our Discord" />
    </a>
    <a href="https://x.com/Scrapelessteam" target="_blank">
      <img src="https://img.shields.io/badge/Follow%20us%20on%20X-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow us on X" />
    </a>
    <a href="https://www.reddit.com/r/Scrapeless" target="_blank">
      <img src="https://img.shields.io/badge/Join%20us%20on%20Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Join us on Reddit" />
    </a> 
    <a href="https://app.scrapeless.com/passport/register?utm_source=official&utm_term=githubopen" target="_blank">
      <img src="https://img.shields.io/badge/Official%20Website-12A594?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Official Website"/>
    </a>
  </p>

---

### First, install the SDK
```bash
# Install the official Scrapeless SDK
npm install @scrapeless-ai/sdk
```

### Click [here](https://app.scrapeless.com/passport/register?utm_source=official&utm_term=githubopen) to obtain your API-KEY

---

## To scrape ChatGPT
You can use the ChatGPT scraper contained in this repository to collect structured conversation data. Clone or browse the scraper at: https://github.com/scrapelesshq/LLM-chat-scraper/tree/main/chatgpt_scraper and follow these quick steps to run it locally:

```bash
git clone https://github.com/scrapelesshq/LLM-chat-scraper.git
cd LLM-chat-scraper/chatgpt_scraper
npm install
cp .env.example .env
# edit .env and add at least SCRAPELESS_API_KEY=your_api_key_here
npx ts-node src/chatgpt.ts
```

---

## 📄 License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- 📖 **Documentation**: [https://docs.scrapeless.com](https://docs.scrapeless.com?utm_source=official&utm_term=githubopen)
- 💬 **Community**: [Join our Discord](https://backend.scrapeless.com/app/api/v1/public/links/discord)
- 🐛 **Issues**: [GitHub Issues](https://github.com/scrapelesshq/LLM-chat-scraper/issues)
- 📧 **Email**: [business@scrapeless.com](mailto:business@scrapeless.com)

## 🏢 About Scrapeless

Scrapeless is a powerful web scraping and browser automation platform that helps businesses extract data from any website at scale. Our platform provides:

- High-performance web scraping infrastructure
- Global proxy network
- Browser automation capabilities
- Enterprise-grade reliability and support

Visit [scrapeless.com](?utm_source=official&utm_term=githubopen) to learn more and get started.
