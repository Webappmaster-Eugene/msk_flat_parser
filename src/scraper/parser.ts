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

    try {
      await page.screenshot({ path: 'data/debug-1-loaded.png', timeout: 10000 });
      logger.info({ profileId: profile.id }, 'Screenshot saved: debug-1-loaded.png');
    } catch {
      logger.warn({ profileId: profile.id }, 'Screenshot 1 failed, continuing...');
    }
    
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

    try {
      await page.screenshot({ path: 'data/debug-2-after-show.png', timeout: 10000 });
      logger.info({ profileId: profile.id }, 'Screenshot saved: debug-2-after-show.png');
    } catch {
      logger.warn({ profileId: profile.id }, 'Screenshot 2 failed, continuing...');
    }
    
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
      // Scroll down to make pagination visible
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(1000, 1500);
      
      // Debug: find all elements with "Все" text
      const debugInfo = await page.evaluate(() => {
        const results: string[] = [];
        const allEls = document.querySelectorAll('*');
        allEls.forEach((el, i) => {
          if (el.textContent?.trim() === 'Все' && el.children.length === 0) {
            const rect = (el as HTMLElement).getBoundingClientRect();
            results.push(`[${i}] tag=${el.tagName} class="${el.className}" visible=${rect.width > 0 && rect.height > 0} rect=${JSON.stringify(rect)}`);
          }
        });
        return results;
      });
      logger.info({ profileId: profile.id, elements: debugInfo }, 'DEBUG: Found elements with text "Все"');
      
      // Try multiple strategies to find and click "Все"
      let clicked: string | false = false;
      
      // Strategy: Find "Все" element, scroll to it, then click
      const clickResult = await page.evaluate(() => {
        // Find all "Все" elements (excluding already active ones)
        const allEls = Array.from(document.querySelectorAll('*')).filter(
          el => el.textContent?.trim() === 'Все' && 
                el.children.length === 0 &&
                !el.classList.contains('active')
        );
        
        // Find one with positive dimensions
        for (const el of allEls) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            // Scroll element into view first
            (el as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' });
            
            // Wait a bit for scroll to complete
            return { found: true, tag: el.tagName, class: el.className, needsClick: true };
          }
        }
        
        // Try data-id="all" 
        const dataIdEl = document.querySelector('[data-id="all"]') as HTMLElement;
        if (dataIdEl && !dataIdEl.classList.contains('active')) {
          dataIdEl.scrollIntoView({ behavior: 'instant', block: 'center' });
          return { found: true, tag: 'data-id', class: dataIdEl.className, needsClick: true };
        }
        
        return { found: false };
      });
      
      // If element found, wait for scroll and click
      if (clickResult.found && clickResult.needsClick) {
        await randomDelay(500, 800);
        
        // Now click after scroll
        const finalClick = await page.evaluate(() => {
          const allEls = Array.from(document.querySelectorAll('*')).filter(
            el => el.textContent?.trim() === 'Все' && 
                  el.children.length === 0 &&
                  !el.classList.contains('active')
          );
          
          for (const el of allEls) {
            const rect = (el as HTMLElement).getBoundingClientRect();
            // Now check if element is in viewport (y > 0 and y < window height)
            if (rect.width > 0 && rect.height > 0 && rect.y > 0 && rect.y < window.innerHeight) {
              (el as HTMLElement).click();
              return { success: true, y: rect.y };
            }
          }
          
          // Fallback to data-id
          const dataIdEl = document.querySelector('[data-id="all"]') as HTMLElement;
          if (dataIdEl) {
            dataIdEl.click();
            return { success: true, y: 'data-id' };
          }
          
          return { success: false };
        });
        
        if (finalClick.success) {
          clicked = `${clickResult.tag}-scrolled-y${finalClick.y}`;
          logger.info({ profileId: profile.id, clickResult, finalClick }, 'Clicked element after scroll');
        }
      }
      
      if (clicked) {
        logger.info({ profileId: profile.id, strategy: clicked }, 'Clicked "Все" via JavaScript');
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
      if (page.isClosed()) break;
      await humanLikeScroll(page);
      await randomDelay(300, 600);
    }
    if (!page.isClosed()) {
      await randomDelay(2000, 3000);
    }

    try {
      await page.screenshot({ path: 'data/debug-3-final.png', fullPage: true, timeout: 15000 });
      logger.info({ profileId: profile.id }, 'Screenshot saved: debug-3-final.png');
    } catch {
      logger.warn({ profileId: profile.id }, 'Screenshot 3 failed, continuing...');
    }

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
