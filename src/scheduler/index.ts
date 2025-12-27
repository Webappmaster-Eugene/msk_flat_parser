import cron from 'node-cron';
import { config } from '../config';
import { logger } from '../logger';
import { getEnabledProfiles } from '../config/search-profiles';
import { getPage, randomDelay } from '../scraper';
import { checkForAvailableApartments } from '../scraper/parser';
import { sendAvailableAlert, sendErrorNotification, sendHeartbeat } from '../notifier';

let scheduledTask: cron.ScheduledTask | null = null;
let heartbeatTask: cron.ScheduledTask | null = null;
let isRunning = false;

const stats = {
  totalChecks: 0,
  lastCheckTime: null as Date | null,
  totalApartments: 0,
  bookedCount: 0,
};

export async function runScrapeJob(): Promise<void> {
  if (isRunning) {
    logger.warn('Previous scrape job is still running, skipping...');
    return;
  }

  isRunning = true;
  logger.info('Starting scrape job...');

  try {
    const profiles = getEnabledProfiles();
    
    if (profiles.length === 0) {
      logger.warn('No enabled profiles found');
      return;
    }

    for (const profile of profiles) {
      try {
        logger.info({ profileId: profile.id }, `Processing profile: ${profile.name}`);
        
        const page = await getPage();
        
        try {
          const result = await checkForAvailableApartments(page, profile);
          
          if (result.error) {
            logger.error({ profileId: profile.id, error: result.error }, 'Scrape failed');
            await sendErrorNotification(`Ошибка парсинга профиля "${profile.name}": ${result.error}`);
            continue;
          }

          logger.info({ 
            profileId: profile.id,
            total: result.totalButtons,
            booked: result.bookedButtons,
            available: result.availableButtons.length,
          }, 'Scan result');

          stats.totalChecks++;
          stats.lastCheckTime = new Date();
          stats.totalApartments = result.totalButtons;
          stats.bookedCount = result.bookedButtons;

          if (result.availableButtons.length > 0) {
            logger.info({ 
              profileId: profile.id, 
              availableButtons: result.availableButtons 
            }, '🎉 FOUND AVAILABLE APARTMENTS!');
            
            await sendAvailableAlert(profile.name, result);
          } else {
            logger.info({ profileId: profile.id }, 'All apartments still booked');
          }

        } finally {
          await page.close();
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ profileId: profile.id, error: errorMessage }, 'Profile processing failed');
        await sendErrorNotification(`Ошибка обработки профиля "${profile.name}": ${errorMessage}`);
      }
    }

    logger.info('Scrape job completed');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Scrape job failed');
    await sendErrorNotification(`Критическая ошибка: ${errorMessage}`);
  } finally {
    isRunning = false;
  }
}

export function startScheduler(): void {
  const intervalMinutes = config.scheduler.checkIntervalMinutes;
  
  const cronExpression = `*/${intervalMinutes} * * * *`;
  
  logger.info({ intervalMinutes, cronExpression }, 'Starting scheduler');

  scheduledTask = cron.schedule(cronExpression, async () => {
    const randomDelaySeconds = Math.floor(
      Math.random() * (config.scheduler.randomDelayMaxSeconds - config.scheduler.randomDelayMinSeconds) 
      + config.scheduler.randomDelayMinSeconds
    );
    
    if (randomDelaySeconds > 0) {
      logger.debug({ randomDelaySeconds }, 'Adding random delay before scrape');
      await randomDelay(randomDelaySeconds * 1000, (randomDelaySeconds + 5) * 1000);
    }

    await runScrapeJob();
  });

  heartbeatTask = cron.schedule('0 0,6,12,18 * * *', async () => {
    logger.info('Sending heartbeat message...');
    await sendHeartbeat(stats);
  });

  logger.info('Scheduler started');
  logger.info('Heartbeat scheduled for 00:00, 06:00, 12:00, 18:00');
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (heartbeatTask) {
    heartbeatTask.stop();
    heartbeatTask = null;
  }
  logger.info('Scheduler stopped');
}

export function getStats() {
  return { ...stats };
}
