import { config, validateConfig } from './config';
import { logger } from './logger';
import { initDatabase, closeDatabase } from './database';
import { initBrowser, closeBrowser } from './scraper';
import { testConnection, sendStartupMessage, startListeningForResponses } from './notifier';
import { startScheduler, stopScheduler, runScrapeJob } from './scheduler';

async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  stopScheduler();
  await closeBrowser();
  await closeDatabase();
  logger.info('Shutdown complete');
  process.exit(0);
}

async function main(): Promise<void> {
  logger.info('Starting Moskvartaly Monitor...');

  try {
    validateConfig();
  } catch (error) {
    logger.error({ error }, 'Configuration validation failed');
    process.exit(1);
  }

  await initDatabase();

  const telegramConnected = await testConnection();
  if (!telegramConnected) {
    logger.error('Failed to connect to Telegram, exiting...');
    process.exit(1);
  }

  await initBrowser();

  await sendStartupMessage();

  // Start listening for user responses (for alert acknowledgment)
  startListeningForResponses();

  logger.info('Running initial scrape...');
  await runScrapeJob();

  startScheduler();

  logger.info(`Monitor is running. Checking every ${config.scheduler.checkIntervalMinutes} minutes.`);

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
