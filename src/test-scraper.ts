import { logger } from './logger';
import { initBrowser, getPage, closeBrowser } from './scraper';
import { checkForAvailableApartments } from './scraper/parser';
import { getEnabledProfiles, testProfileWithAvailable } from './config/search-profiles';

async function testScraper(): Promise<void> {
  logger.info('Testing scraper...');

  await initBrowser();

  const useTestProfile = process.argv.includes('--test-available');
  const profile = useTestProfile ? testProfileWithAvailable : getEnabledProfiles()[0];
  
  if (!profile) {
    logger.error('No profile found');
    return;
  }

  logger.info({ profile: profile.name, useTestProfile }, 'Testing with profile');

  const page = await getPage();
  
  try {
    const result = await checkForAvailableApartments(page, profile);
    
    logger.info({ 
      totalButtons: result.totalButtons,
      bookedButtons: result.bookedButtons,
      availableCount: result.availableButtons.length,
      error: result.error 
    }, 'Scrape result');

    if (result.allButtonTexts.length <= 50) {
      logger.info({ allButtonTexts: result.allButtonTexts }, 'All button texts found');
    }

    if (result.availableButtons.length > 0) {
      logger.info({ count: result.availableButtons.length }, '🎉 FOUND AVAILABLE APARTMENTS! Will send Telegram notification.');
    } else {
      logger.info('All apartments are booked (all buttons say "забронировано")');
    }

    logger.info({
      total: result.totalButtons,
      booked: result.bookedButtons,
      available: result.availableButtons.length,
    }, 'Summary');

  } finally {
    await page.close();
  }

  await closeBrowser();
  
  logger.info('Test completed');
}

testScraper().catch(error => {
  logger.error({ error }, 'Test failed');
  process.exit(1);
});
