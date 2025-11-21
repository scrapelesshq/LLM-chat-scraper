const puppeteer = require('puppeteer-core');
async function scrapeWithGoogle() {
    const query = new URLSearchParams({
        sessionTTL: 900,
        sessionRecording: "true",
        sessionName: "AskGemini",
        proxyCountry: 'US',
        token: "API Key",
    });
    const browserWSEndpoint = `wss://browser.scrapeless.com/api/v2/browser?${query.toString()}`;
    console.log('browserWSEndpoint: ', browserWSEndpoint);
    try {
        const browser = await puppeteer.connect({
            browserWSEndpoint: browserWSEndpoint,
            defaultViewport: null,
        })
        const page = await browser.newPage()
        await page.goto("https://google.com")
        const dialogButtons = await page.$$('[role="dialog"] div > button > div[role="none"]')
        const agentButton = dialogButtons?.length ? dialogButtons[dialogButtons.length - 1] : null
        // Agree to cookies
        if (agentButton) {
            await agentButton.click()
            await new Promise((resolve) => setTimeout(resolve, 1500))
        }
        await page.waitForSelector("textarea")
        await page.type("textarea", "best shopee scraper tool")
        await page.keyboard.press("Enter")
        // Wait for result for 5s
        await new Promise((resolve) => setTimeout(resolve, 5000))
        // Save screenshot of results
        await page.screenshot({path: 'result.png', fullPage: true});
    } catch (err) {
        console.error(err);
    }
}
scrapeWithGoogle().then();
