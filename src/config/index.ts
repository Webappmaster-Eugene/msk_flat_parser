import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Supports both formats: "id1,id2,id3" or ["id1","id2","id3"]
function parseChatIds(value: string): string[] {
  if (!value) return [];
  
  // Try JSON array format first
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(id => String(id).trim()).filter(id => id.length > 0);
      }
    } catch {
      // Not valid JSON, fall through to comma-separated
    }
  }
  
  // Comma-separated format
  return value.split(',').map(id => id.trim()).filter(id => id.length > 0);
}

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/moskvartaly',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    chatIds: parseChatIds(process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || ''),
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
    recordVideo: process.env.RECORD_VIDEO === 'true',
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

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
