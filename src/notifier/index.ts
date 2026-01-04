import { Bot } from 'grammy';
import { config } from '../config';
import { logger } from '../logger';
import { SimpleResult } from '../scraper/parser';
import { formatStartupMessage, formatErrorMessage, formatAvailableAlert, formatHeartbeatMessage } from './templates';
import { sendAlertWithReminders, startBotPolling } from './alert-manager';
import { getAllSubscribers } from '../database/subscribers';

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
  
  const subscribers = getAllSubscribers();
  if (subscribers.length === 0) {
    logger.warn('No subscribers, skipping notification');
    return;
  }

  // Use alert manager with reminders
  await sendAlertWithReminders(telegramBot, profileName, result);
}

export async function sendStartupMessage(): Promise<void> {
  const telegramBot = initNotifier();
  
  const subscribers = getAllSubscribers();
  if (subscribers.length === 0) {
    logger.info('No subscribers yet, skipping startup message');
    return;
  }

  for (const chatId of subscribers) {
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
  
  const subscribers = getAllSubscribers();
  if (subscribers.length === 0) {
    return;
  }

  for (const chatId of subscribers) {
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
  
  const subscribers = getAllSubscribers();
  if (subscribers.length === 0) {
    return;
  }

  for (const chatId of subscribers) {
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

export function startListeningForResponses(): void {
  const telegramBot = initNotifier();
  startBotPolling(telegramBot);
}
