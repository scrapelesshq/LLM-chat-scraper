import puppeteer from "puppeteer-core";
import fs from "fs/promises";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tokenValue = process.env.SCRAPELESS_TOKEN || "SCRAPELSS_API_KEY";

const CONNECTION_OPTIONS = {
  proxyCountry: "ANY",
  sessionRecording: "true",
  sessionTTL: "900",
  sessionName: "perplexity-scraper",
};

function buildConnectionURL(token) {
  const q = new URLSearchParams({ token, ...CONNECTION_OPTIONS });
  return `wss://browser.scrapeless.com/api/v2/browser?${q.toString()}`;
}

async function findAndType(page, prompt) {
  const selectors = [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Ask anything"]',
    'input[placeholder*="Ask"]',
    '[contenteditable="true"]',
    'div[role="textbox"]',
    'div[role="combobox"]',
    'textarea',
    'input[type="search"]',
    '[aria-label*="Ask"]',
  ];

  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      // ensure visible
      const visible = await el.boundingBox();
      if (!visible) continue;

      // decide contenteditable vs normal input
      const isContentEditable = await page.evaluate((s) => {
        const e = document.querySelector(s);
        if (!e) return false;
        if (e.isContentEditable) return true;
        const role = e.getAttribute && e.getAttribute("role");
        if (role && (role.includes("textbox") || role.includes("combobox"))) return true;
        return false;
      }, sel);

      if (isContentEditable) {
        await page.focus(sel);
        await page.evaluate((s, t) => {
          const el = document.querySelector(s);
          if (!el) return;
          try {
            el.focus();
            if (document.execCommand) {
              document.execCommand("selectAll", false);
              document.execCommand("insertText", false, t);
            } else {
              // fallback
              el.innerText = t;
            }
          } catch (e) {
            el.innerText = t;
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }, sel, prompt);
        await page.keyboard.press("Enter");
        return true;
      } else {
        try {
          await el.click({ clickCount: 1 });
        } catch (e) {}
        await page.focus(sel);
        await page.evaluate((s) => {
          const e = document.querySelector(s);
          if (!e) return;
          if ("value" in e) e.value = "";
        }, sel);
        await page.type(sel, prompt, { delay: 25 });
        await page.keyboard.press("Enter");
        return true;
      }
    } catch (e) {
    }
  }

  try {
    await page.mouse.click(640, 200).catch(() => {});
    await sleep(200);
    await page.keyboard.type(prompt, { delay: 25 });
    await page.keyboard.press("Enter");
    return true;
  } catch (e) {
    return false;
  }
}

(async () => {
  const connectionURL = buildConnectionURL(tokenValue);
  const browser = await puppeteer.connect({
    browserWSEndpoint: connectionURL,
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    );
  } catch (e) {}

  const rawResponses = [];
  const wsFrames = [];

  page.on("response", async (res) => {
    try {
      const url = res.url();
      const status = res.status();
      const resourceType = res.request ? res.request().resourceType() : "unknown";
      const headers = res.headers ? res.headers() : {};
      let snippet = "";
      try {
        const t = await res.text();
        snippet = typeof t === "string" ? t.slice(0, 20000) : String(t).slice(0, 20000);
      } catch (e) {
        snippet = "<read-failed>";
      }
      rawResponses.push({ url, status, resourceType, headers, snippet });
    } catch (e) {}
  });

  try {
    const cdp = await page.target().createCDPSession();
    await cdp.send("Network.enable");
    cdp.on("Network.webSocketFrameReceived", (evt) => {
      try {
        const { response } = evt;
        wsFrames.push({
          timestamp: evt.timestamp,
          opcode: response.opcode,
          payload: response.payloadData ? response.payloadData.slice(0, 20000) : response.payloadData,
        });
      } catch (e) {}
    });
  } catch (e) {}

  await page.goto("https://www.perplexity.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });

  const prompt = "Hi ChatGPT, Do you know what Scrapeless is?";
  await findAndType(page, prompt);

  await sleep(1500);

  const start = Date.now();
  while (Date.now() - start < 20000) {
    const ok = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      if (!main) return false;
      return Array.from(main.querySelectorAll("*")).some((el) => (el.innerText || "").trim().length > 80);
    });
    if (ok) break;
    await sleep(500);
  }

  const results = await page.evaluate(() => {
    const pick = (el) => (el ? (el.innerText || "").trim() : "");
    const out = { answers: [], links: [], rawHtmlSnippet: "" };

    const selectors = [
      '[data-testid*="answer"]',
      '[data-testid*="result"]',
      '.Answer',
      '.answer',
      '.result',
      'article',
      'main',
    ];

    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) {
        const t = pick(el);
        if (t.length > 30) out.answers.push({ selector: s, text: t.slice(0, 20000) });
      }
    }

    if (out.answers.length === 0) {
      const main = document.querySelector("main") || document.body;
      const blocks = Array.from(main.querySelectorAll("article, section, div, p")).slice(0, 8);
      for (const b of blocks) {
        const t = pick(b);
        if (t.length > 30) out.answers.push({ selector: b.tagName, text: t.slice(0, 20000) });
      }
    }

    const main = document.querySelector("main") || document.body;
    out.links = Array.from(main.querySelectorAll("a")).slice(0, 200).map(a => ({ href: a.href, text: (a.innerText || "").trim() }));
    out.rawHtmlSnippet = (main && main.innerHTML) ? main.innerHTML.slice(0, 200000) : "";

    return out;
  });

  try {
    const pageHtml = await page.content();
    await page.screenshot({ path: "./perplexity_screenshot.png", fullPage: true }).catch(() => {});
    await fs.writeFile("./perplexity_results.json", JSON.stringify({ results, extractedAt: new Date().toISOString() }, null, 2));
    await fs.writeFile("./perplexity_page.html", pageHtml);
    await fs.writeFile("./perplexity_raw_responses.json", JSON.stringify(rawResponses, null, 2));
    await fs.writeFile("./perplexity_ws_frames.json", JSON.stringify(wsFrames, null, 2));
  } catch (e) {}

  await browser.close();
  console.log("done — outputs: perplexity_results.json, perplexity_page.html, perplexity_raw_responses.json, perplexity_ws_frames.json, perplexity_screenshot.png");
  process.exit(0);
})().catch(async (err) => {
  try { await fs.writeFile("./perplexity_error.txt", String(err)); } catch (e) {}
  console.error("error — see perplexity_error.txt");
  process.exit(1);
});
