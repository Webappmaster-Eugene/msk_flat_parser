import { Bot } from 'grammy';
import { config } from '../config';
import { logger } from '../logger';
import { SimpleResult } from '../scraper/parser';
import { formatStartupMessage, formatErrorMessage, formatAvailableAlert, formatHeartbeatMessage } from './templates';

let bot: Bot | null = null;

export function initNotifier(): Bot {
  if (bot) {
    return bot;
  }

  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  bot = new Bot(config.telegram.botToken);
  logger.info('Telegram notifier initialized');
  return bot;
}

export async function sendAvailableAlert(profileName: string, result: SimpleResult): Promise<void> {
  const telegramBot = initNotifier();
  
  if (!config.telegram.chatId) {
    logger.warn('TELEGRAM_CHAT_ID is not configured, skipping notification');
    return;
  }

  const message = formatAvailableAlert(profileName, result);
  
  try {
    await telegramBot.api.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'Markdown',
    });
    logger.info({ availableCount: result.availableButtons.length }, 'Available alert sent!');
  } catch (error) {
    logger.error({ error }, 'Failed to send available alert');
    throw error;
  }
}

export async function sendStartupMessage(): Promise<void> {
  const telegramBot = initNotifier();
  
  if (!config.telegram.chatId) {
    logger.warn('TELEGRAM_CHAT_ID is not configured, skipping startup message');
    return;
  }

  try {
    await telegramBot.api.sendMessage(config.telegram.chatId, formatStartupMessage(), {
      parse_mode: 'Markdown',
    });
    logger.info('Startup message sent');
  } catch (error) {
    logger.error({ error }, 'Failed to send startup message');
  }
}

export async function sendErrorNotification(error: string): Promise<void> {
  const telegramBot = initNotifier();
  
  if (!config.telegram.chatId) {
    return;
  }

  try {
    await telegramBot.api.sendMessage(config.telegram.chatId, formatErrorMessage(error), {
      parse_mode: 'Markdown',
    });
  } catch (e) {
    logger.error({ error: e }, 'Failed to send error notification');
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const telegramBot = initNotifier();
    const me = await telegramBot.api.getMe();
    logger.info({ botUsername: me.username }, 'Telegram bot connected');
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Telegram');
    return false;
  }
}

export async function sendHeartbeat(stats: { totalChecks: number; lastCheckTime: Date | null; totalApartments: number; bookedCount: number }): Promise<void> {
  const telegramBot = initNotifier();
  
  if (!config.telegram.chatId) {
    return;
  }

  try {
    await telegramBot.api.sendMessage(config.telegram.chatId, formatHeartbeatMessage(stats), {
      parse_mode: 'Markdown',
    });
    logger.info('Heartbeat message sent');
  } catch (error) {
    logger.error({ error }, 'Failed to send heartbeat message');
  }
}
