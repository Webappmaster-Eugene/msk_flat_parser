import { testConnection, sendStartupMessage } from './notifier';
import { logger } from './logger';

async function testTelegram(): Promise<void> {
  logger.info('Testing Telegram connection...');

  const connected = await testConnection();
  if (!connected) {
    logger.error('Failed to connect to Telegram');
    process.exit(1);
  }

  logger.info('Sending startup message...');
  await sendStartupMessage();
  
  logger.info('Telegram test completed! Check your Telegram for the message.');
}

testTelegram().catch(error => {
  logger.error({ error }, 'Test failed');
  process.exit(1);
});
