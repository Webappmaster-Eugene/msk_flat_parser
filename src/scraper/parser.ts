import { Page } from 'playwright';
import { ScrapedApartment, ApartmentStatus, SearchProfile, ScrapeResult } from '../types';
import { logger } from '../logger';
import { randomDelay, humanLikeScroll } from './anti-detect';

export interface ButtonInfo {
  text: string;
  isBooked: boolean;
  index: number;
}

export interface SimpleResult {
  profileId: string;
  profileName: string;
  totalButtons: number;
  bookedButtons: number;
  availableButtons: ButtonInfo[];
  allButtonTexts: string[];
  scrapedAt: Date;
  error?: string;
}

function isBookedText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return lower.includes('забронир') || 
         lower.includes('бронь') || 
         lower.includes('продан') ||
         lower.includes('недоступ');
}

export async function checkForAvailableApartments(page: Page, profile: SearchProfile): Promise<SimpleResult> {
  const result: SimpleResult = {
    profileId: profile.id,
    profileName: profile.name,
    totalButtons: 0,
    bookedButtons: 0,
    availableButtons: [],
    allButtonTexts: [],
    scrapedAt: new Date(),
  };

  try {
    logger.info({ profileId: profile.id }, `Navigating to ${profile.url}`);
    
    await page.goto(profile.url, { 
      waitUntil: 'domcontentloaded',
      timeout: 90000 
    });

    await randomDelay(3000, 5000);
    
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch {
      logger.warn({ profileId: profile.id }, 'Network idle timeout, continuing anyway...');
    }

    await page.screenshot({ path: 'data/debug-1-loaded.png' });
    logger.info({ profileId: profile.id }, 'Screenshot saved: debug-1-loaded.png');
    
    logger.info({ profileId: profile.id }, 'Looking for view switcher (Плитка)...');
    
    try {
      const tileView = await page.$('text=Плитка');
      if (tileView) {
        await tileView.click();
        await randomDelay(1000, 2000);
        logger.info({ profileId: profile.id }, 'Switched to tile view');
      }
    } catch {
      logger.warn({ profileId: profile.id }, 'Could not switch to tile view');
    }
    
    logger.info({ profileId: profile.id }, 'Looking for "Показать квартир" button...');
    
    try {
      const showBtn = page.getByText(/Показать \d+ квартир/);
      await showBtn.waitFor({ state: 'visible', timeout: 10000 });
      const btnText = await showBtn.textContent();
      logger.info({ profileId: profile.id, text: btnText?.trim() }, 'Found "Показать квартир" button, clicking...');
      await showBtn.click();
      await randomDelay(5000, 8000);
      try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
      } catch {
        logger.warn({ profileId: profile.id }, 'Network idle after click timeout');
      }
    } catch (e) {
      logger.warn({ profileId: profile.id, error: String(e) }, 'No "Показать квартир" button found');
    }

    await page.screenshot({ path: 'data/debug-2-after-show.png' });
    logger.info({ profileId: profile.id }, 'Screenshot saved: debug-2-after-show.png');
    
    try {
      const closeBtn = page.locator('[class*="close"], [class*="modal"] button, .popup-close').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) {
        await closeBtn.click();
        await randomDelay(500, 1000);
        logger.info({ profileId: profile.id }, 'Closed modal/popup');
      }
    } catch {
    }

    logger.info({ profileId: profile.id }, 'Looking for "Все" pagination button...');
    
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await randomDelay(500, 1000);
      
      const clicked = await page.evaluate(() => {
        const allDiv = document.querySelector('[data-id="all"]') as HTMLElement;
        if (allDiv) {
          allDiv.click();
          return true;
        }
        const allElements = Array.from(document.querySelectorAll('*')).filter(
          el => el.textContent?.trim() === 'Все' && el.children.length === 0
        );
        if (allElements.length > 0) {
          (allElements[allElements.length - 1] as HTMLElement).click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        logger.info({ profileId: profile.id }, 'Clicked "Все" via JavaScript');
        await randomDelay(3000, 5000);
        try {
          await page.waitForLoadState('networkidle', { timeout: 20000 });
        } catch {
          logger.warn({ profileId: profile.id }, 'Network idle after "Все" click timeout');
        }
      } else {
        logger.warn({ profileId: profile.id }, 'Could not find "Все" button to click');
      }
    } catch (e) {
      logger.warn({ profileId: profile.id, error: String(e) }, 'Failed to click "Все" pagination');
    }
    
    for (let i = 0; i < 5; i++) {
      await humanLikeScroll(page);
      await randomDelay(300, 600);
    }
    await randomDelay(2000, 3000);

    await page.screenshot({ path: 'data/debug-3-final.png', fullPage: true });
    logger.info({ profileId: profile.id }, 'Screenshot saved: debug-3-final.png');

    logger.info({ profileId: profile.id }, 'Searching for apartment booking buttons...');

    const availableCount1 = await page.getByText('забронировать', { exact: true }).count();
    const availableCount2 = await page.getByText('Забронировать', { exact: true }).count();
    const bookedCount1 = await page.getByText('забронировано', { exact: true }).count();
    const bookedCount2 = await page.getByText('Забронировано', { exact: true }).count();
    
    const availableCount = availableCount1 + availableCount2;
    const bookedCount = bookedCount1 + bookedCount2;
    
    logger.info({ 
      profileId: profile.id, 
      availableCount,
      bookedCount,
      details: { availableCount1, availableCount2, bookedCount1, bookedCount2 }
    }, 'Found booking buttons via getByText');

    const buttonData: { text: string; disabled: boolean; tag: string; classes: string }[] = [];
    
    for (let i = 0; i < availableCount; i++) {
      buttonData.push({ text: 'забронировать', disabled: false, tag: '', classes: '' });
    }
    for (let i = 0; i < bookedCount; i++) {
      buttonData.push({ text: 'забронировано', disabled: true, tag: '', classes: '' });
    }

    result.allButtonTexts = buttonData.map(b => `${b.text} (${b.disabled ? 'disabled' : 'active'})`);
    result.totalButtons = buttonData.length;
    
    buttonData.forEach((btn, index) => {
      const textLower = btn.text.toLowerCase();
      
      if (textLower === 'забронировать' && !btn.disabled) {
        result.availableButtons.push({
          text: btn.text,
          isBooked: false,
          index,
        });
      } else {
        result.bookedButtons++;
      }
    });

    logger.info({ 
      profileId: profile.id, 
      totalApartments: result.totalButtons,
      bookedCount: result.bookedButtons,
      availableCount: result.availableButtons.length,
      allButtons: result.allButtonTexts,
    }, 'Apartment scan completed');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ profileId: profile.id, error: errorMessage }, 'Scraping failed');
    result.error = errorMessage;
  }

  return result;
}

export async function scrapeProfile(page: Page, profile: SearchProfile): Promise<ScrapeResult> {
  const simpleResult = await checkForAvailableApartments(page, profile);
  
  const result: ScrapeResult = {
    profileId: profile.id,
    profileName: profile.name,
    apartments: [],
    scrapedAt: simpleResult.scrapedAt,
    error: simpleResult.error,
  };

  if (simpleResult.availableButtons.length > 0) {
    simpleResult.availableButtons.forEach((btn, idx) => {
      result.apartments.push({
        externalId: `available-${idx}`,
        status: 'available',
        price: null,
        pricePerMeter: null,
        area: null,
        floor: null,
        rooms: null,
        address: null,
        building: null,
        link: null,
      });
    });
  }

  return result;
}
