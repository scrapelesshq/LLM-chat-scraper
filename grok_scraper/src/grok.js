const puppeteer = require('puppeteer-core');
const TurndownService = require('turndown');

async function scrapeGrok() {
    const query = new URLSearchParams({
        sessionTTL: 900,
        sessionRecording: "true",
        sessionName: "AskGemini",
        proxyCountry: 'US',
        token: "APIKey",
    });

    const browserWSEndpoint = `wss://browser.scrapeless.com/api/v2/browser?${query.toString()}`;

    try {
        const browser = await puppeteer.connect({browserWSEndpoint, defaultViewport: null});
        const page = await browser.newPage();
        await page.goto('https://grok.com/');

        // Input query and submit
        await page.waitForSelector("textarea");
        await page.type("textarea", "The best social media marketing tools with source link");
        await page.keyboard.press("Enter");

        // Wait and screenshot
        await new Promise((resolve) => setTimeout(resolve, 10000));
        await page.screenshot({path: 'result.png', fullPage: true});

        // Extract and convert content
        await page.waitForSelector('div.response-content-markdown', {timeout: 30000});
        const html = await page.evaluate(() => {
            const containers = document.querySelectorAll('div.response-content-markdown');
            const container = containers.length >= 2 ? containers[1] : containers[0];
            return container ? container.innerHTML : '';
        });

        if (html) {
            const md = new TurndownService().turndown(`<div>${html}</div>`);
            console.log(md);
        }

        await browser.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

scrapeGrok().then();
