import { Page } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function humanLikeClick(page: Page, selector: string): Promise<void> {
  const element = await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const box = await element.boundingBox();
  if (!box) {
    throw new Error(`Could not get bounding box for: ${selector}`);
  }

  const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10;

  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
  await randomDelay(50, 150);
  await page.mouse.click(x, y);
}

export async function humanLikeScroll(page: Page): Promise<void> {
  try {
    if (page.isClosed()) return;
    const scrollAmount = Math.floor(Math.random() * 300) + 100;
    await page.mouse.wheel(0, scrollAmount);
    await randomDelay(200, 500);
  } catch (error) {
    if (String(error).includes('closed') || String(error).includes('Target')) {
      return;
    }
    throw error;
  }
}

export async function setupAntiDetection(page: Page): Promise<void> {
  await page.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
    window.chrome = { runtime: {} };
  `);
}
