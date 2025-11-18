import puppeteer, { Browser, Page, Target } from 'puppeteer-core';
import fetch from 'node-fetch';
import { PuppeteerLaunchOptions, Scrapeless } from '@scrapeless-ai/sdk';
import { Logger } from '@nestjs/common';

export interface BaseInput {
  task_id: string;
  proxy_url: string;
  timeout: number;
}

export interface BaseOutput {
  url: string;
  data: number[];
  collection?: string;
  dataType?: string;
}

export interface QueryChatgptRequest extends BaseInput {
  prompt: string;
  webhook?: string;
  session_name?: string;
  web_search?: boolean;
  session_recording?: boolean;
  answer_type?: 'text' | 'html' | 'raw';
}

export interface ChatgptResponse {
  prompt: string;
  task_id?: string;
  duration?: number;
  answer?: string;
  url: string;
  success: boolean;
  country_code: string;
  error_reason?: string;
  links_attached?: Partial<{ position: number; text: string; url: string }>[];
  citations?: Partial<{ url: string; icon: string; title: string; description: string }>[];
  products?: Partial<{ url: string; title: string; image_urls: (string | null)[] }>[];
  image_cards?: Partial<{ position: number; url: string }>[];
}

interface StartChatParams extends QueryChatgptRequest {
  page: Page;
  browser: Browser;
}

export class ChatgptService {
  logger = new Logger(this.constructor.name);
  scrapeless = new Scrapeless({ apiKey: 'sk_IRRG8mLhM6MaLutyNBJvHMba2iQQICmonrFRRJ1202bI3dFlMr7vkzJFLxn45499' });

  private timeoutMultiplier = 2;
  private defaultTimeout = 3 * 60 * 1000;
  private internalErrorSymbol = '[InternalError]:';

  async solver(input: QueryChatgptRequest, checkTimeout: () => boolean): Promise<BaseOutput> {
    const { session_name, task_id, webhook, session_recording, proxy_url } = input;

    let browser: Browser;

    const startTime = performance.now();
    const successful = false;

    const getTotalDuration = () => {
      const endTime = performance.now();
      const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
      return totalDuration;
    };

    const handleChatResponse = (data: Partial<ChatgptResponse>) => {
      const payload = { ...data, task_id, duration: getTotalDuration() };
      return payload;
    };

    const createResponse = (data: string, url = 'https://chatgpt.com'): BaseOutput => {
      return {
        url: url,
        data: Array.from(Buffer.from(data)),
        dataType: 'json',
      };
    };

    try {
      browser = await this.connectToBrowser(
        {
          session_name,
          session_ttl: 600,
          session_recording,
          proxy_url,
          fingerprint: {
            platform: 'macOS',
            localization: {
              timezone: 'America/New_York',
            },
            args: {
              '--window-size': '1920,1080',
            },
          },
        },
        checkTimeout,
      );

      const page = await browser.newPage();

      await this.fakePageDate(page);

      const chatParams: StartChatParams = { ...input, page, browser };
      const results = await this.startChat(chatParams);
      const payload = handleChatResponse(results);
      this.pushToMessage(payload, webhook);
      return createResponse(JSON.stringify(payload), payload.url);
    } catch (error) {
      if (error.success) {
        const payload = handleChatResponse(error);
        this.pushToMessage(payload, webhook);
        return createResponse(JSON.stringify(payload), error.url);
      }
      if (error.error_reason) {
        const errorMessage = error.error_reason;
        const payload = handleChatResponse(error);
        this.pushToMessage(payload, webhook);
        this.logger.warn(`Processing failed: ${errorMessage}`);
        throw { message: !errorMessage.includes(this.internalErrorSymbol) ? errorMessage : '' };
      }
      const errorMessage = error.message || 'Unknown error';
      const payload = handleChatResponse({
        success: false,
        error_reason: errorMessage,
      });
      this.pushToMessage(payload, webhook);
      this.logger.warn(`Processing failed: ${errorMessage}`);
      throw error;
    } finally {
      const totalDuration = getTotalDuration();
      this.logger.log(
        `Processing ${successful ? 'successful' : 'completed'} | Total duration: ${totalDuration} seconds`,
      );
    }
  }

  async format(data: Uint8Array): Promise<QueryChatgptRequest> {
    if (!data) {
      throw new Error('No valid input data');
    }
    const input = JSON.parse(data.toString()) as QueryChatgptRequest;

    if (!input.prompt) {
      this.logger.error(`prompt is required`);
      throw new Error('prompt is required');
    }

    return {
      ...input,
      timeout: input.timeout || this.defaultTimeout,
      web_search: input.web_search ?? true,
      session_name: input.session_name || 'Chatgpt Answer',
      session_recording: input.session_recording || false,
      answer_type: input.answer_type || 'text',
    };
  }

  private startChat(params: StartChatParams): Promise<ChatgptResponse> {
    return new Promise(async (resolve, reject: (reason: ChatgptResponse) => void) => {
      const { prompt, answer_type, web_search, timeout, page, browser, proxy_url } = params;
      let action: string;
      let isAborted = false;
      let rawResponse: string;

      this.logger.debug((action = 'Connecting to Browser'));

      const proxy_country = /-country_([A-Z]{2,3})/.exec(proxy_url)?.[1] || 'ANY';
      const query = new URLSearchParams({ q: prompt });
      if (web_search) {
        query.set('hints', 'search');
      }
      const baseUrl = 'https://chatgpt.com';
      const _url = `${baseUrl}/?${query.toString()}`;

      function waitForChatGPTResponse(page: Page): Promise<string> {
        return new Promise((resolve, reject) => {
          let retryCount = 0;
          const CHECK_INTERVAL = 500; // Check once every 500ms

          const checkResponse = async () => {
            try {
              if (isAborted) {
                resolve('timeout');
                return;
              }
              const currentContent = await page.evaluate(() => {
                const assistantMessage = '[data-message-author-role="assistant"]';
                const $assistantMessages = document.querySelectorAll(assistantMessage);
                const lastMessage = $assistantMessages[$assistantMessages.length - 1];
                if (!lastMessage) return null;

                // When a copy button greater than one appears, it means that gpt's answer has been completed
                const $answerCopyButtons = document.querySelectorAll('button[data-testid="copy-turn-action-button"]');
                if ($answerCopyButtons.length > 1) {
                  return lastMessage.textContent || 'No content';
                } else {
                  return null;
                }
              });

              // If the content has not changed and is not empty
              if (currentContent) {
                retryCount++;
                // If the content is stable and not empty, the response is considered complete
                if (retryCount >= 3) {
                  // Content stable for 1.5 seconds
                  resolve(currentContent);
                  return;
                }
              }

              // Continue to check
              setTimeout(checkResponse, CHECK_INTERVAL);
            } catch (error) {
              reject(error);
            }
          };

          // Start checking
          checkResponse();
        });
      }

      async function receiveChatGPTStream() {
        const client = await page.createCDPSession();
        await client.send('Fetch.enable', {
          patterns: [
            {
              urlPattern: '*conversation',
              requestStage: 'Response',
            },
          ],
        });

        client.on('Fetch.requestPaused', async (event) => {
          const { requestId, request, responseHeaders } = event;
          const isSSE = responseHeaders?.some(
            (h) => h.name?.toLowerCase() === 'content-type' && h.value?.includes('text/event-stream'),
          );
          if (request.url.includes('/conversation') && isSSE) {
            try {
              const { body, base64Encoded } = await client.send('Fetch.getResponseBody', { requestId });
              rawResponse = base64Encoded ? Buffer.from(body, 'base64').toString('utf-8') : body;
            } catch (err) {
              console.warn('Failed to get see stream response', err.message);
            }
          }
          await client.send('Fetch.continueRequest', { requestId });
        });
      }

      function throwError(errorReason: string) {
        const error: ChatgptResponse = {
          prompt,
          success: false,
          country_code: proxy_country,
          error_reason: errorReason,
          url: _url,
        };
        reject(error);
      }

      const timeoutId = setTimeout(() => {
        isAborted = true;
        throwError(`Chat timeout after ${timeout}ms`);
      }, timeout);

      try {
        this.logger.debug((action = 'Register CDP to capture GPT stream data (raw_response)'));
        await receiveChatGPTStream();
        this.logger.debug((action = 'Navigating to chatgpt.com'));
        const navigateTimeout = 25_000 * this.timeoutMultiplier;
        try {
          await page.goto(_url, { timeout: navigateTimeout });
        } catch {
          throwError(`Navigate to chatgpt.com Timeout (${navigateTimeout}ms)`);
          return;
        }

        // Add URL change listener
        page.on('framenavigated', async (frame) => {
          if (frame !== page.mainFrame()) return;
          const url = frame.url();
          if (!url.startsWith('https://auth.openai.com')) return;
          isAborted = true;
          throwError(`Redirected to OpenAI login page when <<${_url}>> - ${action}`);
          return;
        });

        if (isAborted) return;
        await this.wait(50, 150);
        this.logger.debug((action = 'Make sure input exists'));
        const inputs = ['#prompt-textarea', '[placeholder="Ask anything"]'];
        try {
          await Promise.race(
            inputs.map(async (input) => {
              await page.waitForSelector(input, {
                timeout: 20_000 * this.timeoutMultiplier,
                visible: true,
              });
              return input;
            }),
          );
        } catch {
          throwError('The current region is unavailable or redirected to the login page');
          return;
        }

        if (isAborted) return;
        await this.wait(150, 250);
        this.logger.debug((action = 'Waiting for GPT Response'));
        let gptAnswer: string;
        try {
          gptAnswer = await waitForChatGPTResponse(page);
          this.logger.debug((action = 'GPT Response received'));
        } catch (error: any) {
          this.logger.error(`Failed to get response: ${error.message}`);
          throwError(`Get chatgpt response failed`);
          return;
        }

        if (isAborted) return;
        await this.wait(150, 250);
        this.logger.debug((action = 'Obtain chatgpt image cards'));
        const imageCardsSelector = 'div.no-scrollbar:has(button img) img';
        const imageCardsLightBoxSelector = 'div[data-testid="modal-image-gen-lightbox"] ol li img';
        const imageCardsLightBoxCloseSelector = 'div[data-testid="modal-image-gen-lightbox"] button';
        let gptImageCards: ChatgptResponse['image_cards'] = [];
        try {
          const firstImageCard = await page.$(imageCardsSelector);
          if (firstImageCard) {
            firstImageCard.click();
            await page.waitForSelector(imageCardsLightBoxSelector);
            gptImageCards = await page.$$eval(imageCardsLightBoxSelector, (elements) => {
              return elements.map((element, index) => {
                const url = element.getAttribute('src') || '';
                return { url, position: index + 1 };
              });
            });
            await page.waitForSelector(imageCardsLightBoxCloseSelector);
            await page.click(imageCardsLightBoxCloseSelector);
          } else {
            this.logger.debug((action = 'No Image Cards found'));
          }
        } catch (error: any) {
          this.logger.debug((action = `Obtain chatgpt image cards: ${error.toString()}`));
        }

        if (isAborted) return;
        await this.wait(300, 450);
        this.logger.debug((action = 'Obtain chatgpt recommend products'));
        const closeButtonSelector = `button[data-testid="close-button"]`;
        const recommendProductsSelector = 'div.markdown div.relative > div.flex.flex-row:has(img):not(a) > div img';
        const recommendProductDetailsSelector = `section[screen-anchor="top"] div[slot="content"]`;
        const detailLinkSelector = `${recommendProductDetailsSelector} span a`;
        const gptRecommendProducts: ChatgptResponse['products'] = [];
        try {
          const recommendProducts = await page.$$(recommendProductsSelector);
          if (recommendProducts.length) {
            let lastUrl = '';
            for (const [index] of recommendProducts.entries()) {
              // External link jump may be triggered
              let newPage: Page = null as unknown as Page;
              const targetCreatedHandler = async (target: Target) => {
                this.logger.debug((action = `Obtain chatgpt recommend products: ${target.type()}`));
                try {
                  if (target.type() === 'page') {
                    const pageTarget = await target.page();
                    const opener = await target.opener();
                    if (opener && (opener as any)?._targetId === (page.target() as any)?._targetId) {
                      newPage = pageTarget as Page;
                    }
                  }
                } catch (e) {}
              };
              browser.once('targetcreated', targetCreatedHandler);

              // Click on the recommended item
              await page.evaluate(
                (selector, index) => {
                  const currentProduct = document.querySelectorAll(selector)?.[index];
                  (currentProduct as HTMLElement)?.click();
                },
                recommendProductsSelector,
                index,
              );

              await this.wait(750, 950);
              browser.off('targetcreated', targetCreatedHandler);

              if (newPage) {
                const url = newPage.url();
                const title = await newPage.title();
                gptRecommendProducts.push({ url, title, image_urls: [] });
                await newPage.close();
                continue;
              }

              await page.waitForSelector(detailLinkSelector, { timeout: 20_000 * this.timeoutMultiplier });

              // Wait for details to change
              let maxRetry = 30;
              while (maxRetry-- > 0) {
                const currentUrl = await page.$eval(detailLinkSelector, (el) => el.getAttribute('href') || '');
                if (currentUrl && currentUrl !== lastUrl) {
                  lastUrl = currentUrl;
                  break;
                }
                await this.wait(200, 300);
              }

              const info = await page.$eval(
                recommendProductDetailsSelector,
                (element, currentUrl) => {
                  const title = element.querySelector('div.text-xl')?.textContent || '';
                  const image_urls = Array.from(element.querySelectorAll('.no-scrollbar img')).map((img) =>
                    img.getAttribute('src'),
                  );
                  return { url: currentUrl, title, image_urls };
                },
                lastUrl,
              );

              gptRecommendProducts.push(info);
            }
            await page.click(closeButtonSelector);
          } else {
            this.logger.debug((action = 'No recommend products found'));
          }
        } catch (error: any) {
          this.logger.debug((action = `Obtain chatgpt recommend products: ${error.toString()}`));
        }

        if (isAborted) return;
        await this.wait(500, 1000);
        this.logger.debug((action = 'Obtain chatgpt citations'));
        const citationsEntranceSelector = `button.group\\/footnote`;
        const citationsContentLinkSelector = `section[screen-anchor="top"] div[slot="content"] a`;
        let gptCitations: ChatgptResponse['citations'] = [];
        await page.bringToFront();

        try {
          const citationsButton = await page.waitForSelector(citationsEntranceSelector, {
            timeout: 3_000,
          });
          if (citationsButton) {
            await citationsButton.click();
            const citationsContent = await page.waitForSelector(citationsContentLinkSelector, {
              timeout: 20_000 * this.timeoutMultiplier,
            });
            if (citationsContent) {
              gptCitations = await page.$$eval(citationsContentLinkSelector, (elements) => {
                return elements.map((element) => {
                  const url = element.href || '';
                  const icon = element.querySelector('img')?.getAttribute?.('src');
                  const title = element.querySelector('div:nth-child(2)')?.textContent || '';
                  const description = element.querySelector('div:nth-child(3)')?.textContent || '';
                  return { url, icon, title, description };
                });
              });
              await page.click(closeButtonSelector);
            }
          } else {
            this.logger.debug((action = 'No citations found'));
          }
        } catch (error: any) {
          this.logger.debug((action = `Obtain chatgpt citations: ${error.toString()}`));
        }

        // In some cases it is necessary to add a fixed positioned element to the page
        // to prevent puppeteer to click on random elements
        if (isAborted) return;
        this.logger.debug((action = 'Add fixed elements to avoid unexpected clicks'));
        await page.evaluate(() => {
          const element = document.createElement('div');
          element.style.position = 'fixed';
          element.style.top = '0';
          element.style.left = '0';
          element.style.width = '100%';
          element.style.height = '100%';
          element.style.zIndex = '1000';
          document.body.appendChild(element);
        });

        if (isAborted) return;
        await this.wait(150, 250);
        this.logger.debug((action = 'Obtain chatgpt attached links'));
        const markdownLinksSelector = 'div.markdown a';
        let gptLinksAttached: ChatgptResponse['links_attached'] = [];
        try {
          gptLinksAttached = await page.$$eval(markdownLinksSelector, (elements) => {
            return elements.map((element, index) => {
              const url = element.href || '';
              const title = element.textContent || '';
              return { url, title, position: index + 1 };
            });
          });
        } catch (error: any) {
          this.logger.debug((action = 'No Attached Links found'));
        }

        this.logger.debug((action = 'Getting body'));
        const body = await page.evaluate(() => document.body.innerHTML);
        const cleanBody = body
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
          .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '') // Remove svg tags
          .replace(/<img[^>]*\/?>/gi, '') // Remove img tags
          .replace(/style="[^"]*"/gi, '') // Remove all style attributes
          .replace(/class="[^"]*"/gi, '') // Remove all class attributes
          .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
          // Map related replacements
          .replace(/<span>·<\/span>/g, '') // Remove span tags with ·
          .replace(/<a href="https:\/\/www\.google\.com\/maps\/[^"]*"[^>]*>[\s\S]*?<\/a>/g, '') // Remove all google maps links
          .replace(/<a href="tel:+[^"]*"[^>]*>[\s\S]*?<\/a>/g, '') // Remove all tel links
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();

        this.logger.debug((action = 'Checking error response'));
        const hasError = [
          'Something went wrong while generating the response.',
          'Unusual activity has been detected from your device.',
          'An error occurred. Either the engine you requested does not exist or there was another issue processing your request.',
        ].some((message) => cleanBody.includes(message));
        if (hasError) {
          throwError(`ChatGPT is currently unavailable`);
          return;
        }

        this.logger.log((action = 'Chat successfully'));

        const answerMap: Record<QueryChatgptRequest['answer_type'], string> = {
          html: cleanBody,
          raw: rawResponse,
          text: gptAnswer,
        };
        const answerResponse = answerMap[answer_type] ?? answerMap.text;

        resolve({
          prompt,
          success: true,
          answer: answerResponse,
          country_code: proxy_country,
          citations: gptCitations,
          links_attached: gptLinksAttached,
          image_cards: gptImageCards,
          products: gptRecommendProducts,
          url: _url,
        });
      } catch (error: any) {
        if (!isAborted) {
          throwError(this.internalErrorSymbol + (error.message || String(error)));
        }
      } finally {
        clearTimeout(timeoutId);
        try {
          await page.close();
          await browser.close();
        } catch {}
      }
    });
  }

  private async connectToBrowser(opt: PuppeteerLaunchOptions, checkTimeout: () => boolean) {
    let browser;
    try {
      const { browserWSEndpoint } = await this.scrapeless.browser.createSession(opt);
      browser = await Promise.race([
        puppeteer.connect({ browserWSEndpoint, defaultViewport: null }),
        new Promise((_, reject) => {
          const interval = setInterval(() => {
            if (checkTimeout()) {
              clearInterval(interval);
              browser?.close();
              reject(new Error('Browser connection timeout'));
            }
          }, 1000);
        }),
      ]);
      return browser;
    } catch (error) {
      this.logger.error(`Browser connection failed: ${error.message}`);
      throw error;
    }
  }

  private async pushToMessage(data: any, webhook?: string) {
    if (!webhook) {
      return;
    }
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // body: JSON.stringify({ content: JSON.stringify(data).slice(0, 1800) }),
        // body: JSON.stringify(data),
        body: JSON.stringify({
          data: data,
          content: data.answer_text,
        }),
      });
      if (res.ok) {
        this.logger.log('Webhook Push successfully');
      } else {
        this.logger.error('Webhook push failed', await res.text());
      }
    } catch (err) {
      this.logger.error('Webhook push exception', err);
    }
  }

  private async fakePageDate(page: Page) {
    await page.evaluateOnNewDocument(() => {
      // Hook new Date
      const fixedDate = new Date();
      // randomly set the date to 1-3 years ago
      const days = 100 + Math.floor(Math.random() * 365 * 3 - 100);
      fixedDate.setDate(fixedDate.getDay() - days);
      // const fixedDate = new Date('2022-01-01T00:00:00Z');
      const OriginalDate = Date;

      class FakeDate extends OriginalDate {
        constructor(...args: Parameters<typeof Date>) {
          super();
          if (args.length === 0) {
            return new OriginalDate(fixedDate);
          }
          return new OriginalDate(...args);
        }

        static now() {
          return fixedDate.getTime();
        }

        static parse(str: string) {
          return OriginalDate.parse(str);
        }

        static UTC(...args: Parameters<typeof Date.UTC>) {
          return OriginalDate.UTC(...args);
        }
      }

      Object.getOwnPropertyNames(OriginalDate).forEach((prop) => {
        FakeDate[prop as keyof typeof FakeDate] = OriginalDate[prop as keyof typeof OriginalDate] as any;
      });
      (window.Date as typeof FakeDate) = FakeDate;
    });
  }

  private async wait(fromMs: number, toMs: number) {
    const ms = fromMs + Math.random() * (toMs - fromMs);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
