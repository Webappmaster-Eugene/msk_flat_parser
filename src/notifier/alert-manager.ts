import { Bot } from 'grammy';
import { config } from '../config';
import { logger } from '../logger';
import { SimpleResult, checkForAvailableApartments } from '../scraper/parser';
import { formatAvailableAlert } from './templates';
import { getEnabledProfiles } from '../config/search-profiles';
import { getPage } from '../scraper';

interface PendingAlert {
  id: string;
  profileName: string;
  result: SimpleResult;
  sentAt: Date;
  remindersSent: number;
  acknowledged: boolean;
}

let bot: Bot | null = null;
let pendingAlert: PendingAlert | null = null;
let reminderInterval: NodeJS.Timeout | null = null;
let isListening = false;

const WAIT_FOR_RESPONSE_MS = 5 * 60 * 1000; // 5 minutes
const REMINDER_INTERVAL_MS = 1 * 60 * 1000; // 1 minute
const MAX_REMINDERS = 5;

export function initAlertManager(telegramBot: Bot): void {
  bot = telegramBot;
  
  if (isListening) {
    return;
  }
  
  // Command to get chat ID - works for ANY user
  bot.command('chatid', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const username = ctx.from?.username || 'unknown';
    const firstName = ctx.from?.first_name || '';
    
    logger.info({ chatId, username }, 'User requested their chat ID');
    
    await ctx.reply(
      `🆔 *Ваш Chat ID:* \`${chatId}\`\n\n` +
      `👤 Имя: ${firstName}\n` +
      `📝 Username: @${username}\n\n` +
      `_Отправьте этот ID администратору для добавления в мониторинг_`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Command /start - welcome message
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    await ctx.reply(
      `🏠 *Москварталы Монитор*\n\n` +
      `Этот бот отслеживает появление свободных квартир.\n\n` +
      `🆔 Ваш Chat ID: \`${chatId}\`\n\n` +
      `Команды:\n` +
      `/check - проверить квартиры сейчас\n` +
      `/chatid - показать ваш Chat ID\n\n` +
      `Отправьте Chat ID администратору для получения уведомлений.`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Command /check - immediate check with report
  bot.command('check', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    // Only allow for monitored users
    if (!config.telegram.chatIds.includes(chatId)) {
      await ctx.reply('⛔ У вас нет доступа к этой команде.');
      return;
    }
    
    logger.info({ chatId }, 'Manual check requested');
    await ctx.reply('🔍 *Запускаю проверку квартир...*', { parse_mode: 'Markdown' });
    
    const profiles = getEnabledProfiles();
    if (profiles.length === 0) {
      await ctx.reply('⚠️ Нет активных профилей для проверки');
      return;
    }
    
    for (const profile of profiles) {
      try {
        const startTime = Date.now();
        await ctx.reply(`📋 Проверяю: ${profile.name}...`);
        
        const page = await getPage();
        try {
          const result = await checkForAvailableApartments(page, profile);
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          
          if (result.error) {
            await ctx.reply(
              `❌ *Ошибка проверки*\n\n` +
              `Профиль: ${profile.name}\n` +
              `Ошибка: ${result.error}`,
              { parse_mode: 'Markdown' }
            );
            continue;
          }
          
          const statusEmoji = result.availableButtons.length > 0 ? '🎉' : '📊';
          const availableText = result.availableButtons.length > 0 
            ? `✅ *ЕСТЬ СВОБОДНЫЕ: ${result.availableButtons.length}*` 
            : '🔒 Все забронированы';
          
          await ctx.reply(
            `${statusEmoji} *Результат проверки*\n\n` +
            `📋 Профиль: ${profile.name}\n` +
            `⏱ Время: ${duration}с\n\n` +
            `📊 Всего квартир: ${result.totalButtons}\n` +
            `🔒 Забронировано: ${result.bookedButtons}\n` +
            `${availableText}\n\n` +
            `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
            { parse_mode: 'Markdown' }
          );
          
          // If available apartments found, also send the full alert
          if (result.availableButtons.length > 0) {
            await sendAlertWithReminders(bot!, profile.name, result);
          }
          
        } finally {
          await page.close();
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await ctx.reply(`❌ Ошибка: ${errorMsg}`);
        logger.error({ error: errorMsg, profileId: profile.id }, 'Manual check failed');
      }
    }
    
    await ctx.reply('✅ *Проверка завершена*', { parse_mode: 'Markdown' });
  });
  
  bot.on('message', (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    if (config.telegram.chatIds.includes(chatId)) {
      logger.info({ chatId, text: ctx.message.text }, 'Received message from monitored chat');
      
      if (pendingAlert && !pendingAlert.acknowledged) {
        acknowledgePendingAlert(chatId);
      }
    }
  });
  
  isListening = true;
  logger.info('Alert manager initialized - listening for responses');
}

export function startBotPolling(telegramBot: Bot): void {
  bot = telegramBot;
  initAlertManager(telegramBot);
  
  bot.start({
    onStart: () => {
      logger.info('Telegram bot started polling for messages');
    },
  });
}

function acknowledgePendingAlert(chatId: string): void {
  if (!pendingAlert) return;
  
  pendingAlert.acknowledged = true;
  
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  
  logger.info({ 
    chatId, 
    alertId: pendingAlert.id,
    remindersSent: pendingAlert.remindersSent 
  }, 'Alert acknowledged by user');
  
  // Send confirmation
  if (bot) {
    bot.api.sendMessage(chatId, '✅ Отлично! Вы подтвердили получение уведомления о свободной квартире. Удачи с бронированием! 🏠')
      .catch(err => logger.error({ err }, 'Failed to send acknowledgment'));
  }
  
  pendingAlert = null;
}

export async function sendAlertWithReminders(
  telegramBot: Bot,
  profileName: string,
  result: SimpleResult
): Promise<void> {
  bot = telegramBot;
  initAlertManager(telegramBot);
  
  // If there's already a pending alert, cancel its reminders
  if (pendingAlert && reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  
  const alertId = `alert-${Date.now()}`;
  pendingAlert = {
    id: alertId,
    profileName,
    result,
    sentAt: new Date(),
    remindersSent: 0,
    acknowledged: false,
  };
  
  const message = formatAvailableAlert(profileName, result);
  const urgentMessage = `${message}\n\n⏰ *Ответьте на это сообщение чтобы подтвердить получение!*`;
  
  // Send initial alert to all chats
  for (const chatId of config.telegram.chatIds) {
    try {
      await bot.api.sendMessage(chatId, urgentMessage, {
        parse_mode: 'Markdown',
      });
      logger.info({ chatId, alertId }, 'Initial alert sent');
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to send initial alert');
    }
  }
  
  // Wait 5 minutes, then start sending reminders
  setTimeout(() => {
    if (pendingAlert?.id === alertId && !pendingAlert.acknowledged) {
      startReminders(alertId, profileName, result);
    }
  }, WAIT_FOR_RESPONSE_MS);
}

function startReminders(alertId: string, profileName: string, result: SimpleResult): void {
  if (!bot || !pendingAlert || pendingAlert.id !== alertId) return;
  
  logger.info({ alertId }, 'No response received, starting reminders');
  
  // Send first reminder immediately
  sendReminder(alertId, profileName, result);
  
  // Then send remaining reminders every minute
  reminderInterval = setInterval(() => {
    if (!pendingAlert || pendingAlert.id !== alertId || pendingAlert.acknowledged) {
      if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
      }
      return;
    }
    
    if (pendingAlert.remindersSent >= MAX_REMINDERS) {
      logger.warn({ alertId, remindersSent: pendingAlert.remindersSent }, 'Max reminders sent, stopping');
      clearInterval(reminderInterval!);
      reminderInterval = null;
      pendingAlert = null;
      return;
    }
    
    sendReminder(alertId, profileName, result);
  }, REMINDER_INTERVAL_MS);
}

async function sendReminder(alertId: string, profileName: string, result: SimpleResult): Promise<void> {
  if (!bot || !pendingAlert || pendingAlert.id !== alertId || pendingAlert.acknowledged) return;
  
  pendingAlert.remindersSent++;
  const reminderNum = pendingAlert.remindersSent;
  
  const reminderMessage = `🚨🚨🚨 *НАПОМИНАНИЕ ${reminderNum}/${MAX_REMINDERS}* 🚨🚨🚨

🏠 *СВОБОДНАЯ КВАРТИРА ЖДЁТ ВАС!*

Профиль: ${profileName}
Доступно: ${result.availableButtons.length} квартир(а)

⚠️ *Квартиру могут забронировать в любой момент!*

👉 [ОТКРЫТЬ САЙТ](https://москварталы.рф/kvartiry/?property=семейная&floor[]=4;17&area[]=28;34&price[]=8;12&price_m[]=330.5;380.5&district=2594)

_Ответьте любым сообщением чтобы остановить напоминания_`;

  for (const chatId of config.telegram.chatIds) {
    try {
      await bot.api.sendMessage(chatId, reminderMessage, {
        parse_mode: 'Markdown',
      });
      logger.info({ chatId, alertId, reminderNum }, 'Reminder sent');
    } catch (error) {
      logger.error({ error, chatId, reminderNum }, 'Failed to send reminder');
    }
  }
}

export function hasPendingAlert(): boolean {
  return pendingAlert !== null && !pendingAlert.acknowledged;
}

export function getPendingAlert(): PendingAlert | null {
  return pendingAlert;
}
