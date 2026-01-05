import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from '../config';
import { getRandomUserAgent, setupAntiDetection } from './anti-detect';
import { logger } from '../logger';
import fs from 'fs';
import path from 'path';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

function isBrowserAlive(): boolean {
  return browser !== null && browser.isConnected();
}

export async function initBrowser(): Promise<BrowserContext> {
  if (browser && !browser.isConnected()) {
    logger.warn('Browser disconnected, reinitializing...');
    browser = null;
    context = null;
  }

  if (context) {
    return context;
  }

  logger.info('Initializing browser...');

  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: config.browser.headless,
    slowMo: config.browser.slowMo,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--single-process',
      '--no-zygote',
      '--disable-extensions',
      '--js-flags=--max-old-space-size=256',
    ],
  };

  if (config.proxy.enabled && config.proxy.url) {
    launchOptions.proxy = {
      server: config.proxy.url,
      username: config.proxy.username || undefined,
      password: config.proxy.password || undefined,
    };
  }

  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, 'Failed to launch browser');
    throw new Error(`Browser launch failed: ${errorMessage}`);
  }

  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    userAgent: getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    recordVideo: config.browser.recordVideo ? {
      dir: path.join(config.paths.data, 'videos'),
      size: { width: 1280, height: 720 },
    } : undefined,
  };

  if (fs.existsSync(config.paths.browserState)) {
    try {
      contextOptions.storageState = config.paths.browserState;
      logger.info('Loaded browser state from file');
    } catch (e) {
      logger.warn('Failed to load browser state, starting fresh');
    }
  }

  context = await browser.newContext(contextOptions);
  
  logger.info('Browser initialized');
  return context;
}

export async function getPage(): Promise<Page> {
  const ctx = await initBrowser();
  const page = await ctx.newPage();
  await setupAntiDetection(page);
  return page;
}

export async function saveBrowserState(): Promise<void> {
  if (context) {
    const dir = path.dirname(config.paths.browserState);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await context.storageState({ path: config.paths.browserState });
    logger.debug('Browser state saved');
  }
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await saveBrowserState();
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
  logger.info('Browser closed');
}
