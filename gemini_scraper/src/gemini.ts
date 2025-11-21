const puppeteer = require('puppeteer-core');

async function scrapeGemini() {

    const query = new URLSearchParams({
        sessionTTL: 900,
        sessionRecording: "true",
        sessionName: "AskGemini",
        proxyCountry: 'US',
        token: "",
    });

    const browserWSEndpoint = `wss://browser.scrapeless.com/api/v2/browser?${query.toString()}`;


    console.log('browserWSEndpoint: ', browserWSEndpoint);

    try {
        const browser = await puppeteer.connect({
            browserWSEndpoint: browserWSEndpoint,
            defaultViewport: null,
        });

        const page = await browser.newPage();
        await page.goto('https://gemini.google.com/app', {timeout: 60000});

        // Find the input element
        const geminiInput = await page.waitForSelector('div[role="textbox"]');

        // Type query and press Enter
        await geminiInput.type('best shopee scraper tool');
        await geminiInput.press('Enter');

        // Wait for answer
        await new Promise((resolve) => setTimeout(resolve, 10000))

        // Save screenshot of results
        await page.screenshot({path: 'result.png', fullPage: true});

        await browser.disconnect();
    } catch (err) {
        console.error(err);
    }
}

scrapeGemini().then();
