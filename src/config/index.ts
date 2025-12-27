import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  scheduler: {
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '2', 10),
    randomDelayMinSeconds: parseInt(process.env.RANDOM_DELAY_MIN_SECONDS || '0', 10),
    randomDelayMaxSeconds: parseInt(process.env.RANDOM_DELAY_MAX_SECONDS || '60', 10),
  },
  proxy: {
    enabled: process.env.USE_PROXY === 'true',
    url: process.env.PROXY_URL || '',
    username: process.env.PROXY_USER || '',
    password: process.env.PROXY_PASS || '',
  },
  browser: {
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || '0', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  paths: {
    data: path.join(process.cwd(), 'data'),
    database: path.join(process.cwd(), 'data', 'apartments.db'),
    browserState: path.join(process.cwd(), 'data', 'browser-state.json'),
  },
};

export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.telegram.botToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }
  if (!config.telegram.chatId) {
    errors.push('TELEGRAM_CHAT_ID is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
