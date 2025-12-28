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
  
  if (config.telegram.chatIds.length === 0) {
    logger.warn('No TELEGRAM_CHAT_IDS configured, skipping notification');
    return;
  }

  const message = formatAvailableAlert(profileName, result);
  
  for (const chatId of config.telegram.chatIds) {
    try {
      await telegramBot.api.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });
      logger.info({ chatId, availableCount: result.availableButtons.length }, 'Available alert sent!');
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to send available alert');
    }
  }
}

export async function sendStartupMessage(): Promise<void> {
  const telegramBot = initNotifier();
  
  if (config.telegram.chatIds.length === 0) {
    logger.warn('No TELEGRAM_CHAT_IDS configured, skipping startup message');
    return;
  }

  for (const chatId of config.telegram.chatIds) {
    try {
      await telegramBot.api.sendMessage(chatId, formatStartupMessage(), {
        parse_mode: 'Markdown',
      });
      logger.info({ chatId }, 'Startup message sent');
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to send startup message');
    }
  }
}

export async function sendErrorNotification(error: string): Promise<void> {
  const telegramBot = initNotifier();
  
  if (config.telegram.chatIds.length === 0) {
    return;
  }

  for (const chatId of config.telegram.chatIds) {
    try {
      await telegramBot.api.sendMessage(chatId, formatErrorMessage(error), {
        parse_mode: 'Markdown',
      });
    } catch (e) {
      logger.error({ error: e, chatId }, 'Failed to send error notification');
    }
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
  
  if (config.telegram.chatIds.length === 0) {
    return;
  }

  for (const chatId of config.telegram.chatIds) {
    try {
      await telegramBot.api.sendMessage(chatId, formatHeartbeatMessage(stats), {
        parse_mode: 'Markdown',
      });
      logger.info({ chatId }, 'Heartbeat message sent');
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to send heartbeat message');
    }
  }
}
