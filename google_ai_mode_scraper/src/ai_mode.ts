const puppeteer = require('puppeteer-core');
async function scrapeGemini() {
    const query = new URLSearchParams({
        sessionTTL: 900,
        sessionRecording: "true",
        sessionName: "GoogleAI",
        proxyCountry: 'US',
        token: "API Key",
    });
    const browserWSEndpoint = `wss://browser.scrapeless.com/api/v2/browser?${query.toString()}`;
    console.log('browserWSEndpoint: ', browserWSEndpoint);
    try {
        const browser = await puppeteer.connect({
            browserWSEndpoint: browserWSEndpoint,
            defaultViewport: null,
        });
        const page = await browser.newPage();
        await page.goto('https://google.com/ai', {waitUntil: "domcontentloaded"});
        // Find the input element with data-placeholder="Ask anything"
        const textArea = await page.waitForSelector('textarea[placeholder="Ask anything"]');
        // Type query and press Enter
        await textArea.type('best shopee scraper tool');
        await textArea.press('Enter');
        // Wait for result for 10s
        await new Promise((resolve) => setTimeout(resolve, 10000))
        // Save screenshot of results
        await page.screenshot({path: 'result.png', fullPage: true});
        await browser.disconnect();
    } catch (err) {
        console.error(err);
    }
}
scrapeGemini().then();
