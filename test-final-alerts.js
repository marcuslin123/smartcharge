const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(3000);

  // 1. Go to Recommend tab
  const nav = await page.locator('nav a, nav button').all();
  if (nav.length > 1) await nav[1].click();
  await page.waitForTimeout(2000);

  // 2. Set battery to 5% via direct slider manipulation
  await page.evaluate(() => {
    const sliders = document.querySelectorAll('input[type="range"]');
    for (const s of sliders) {
      const label = s.closest('div')?.textContent || '';
      if (label.includes('Battery')) {
        s.value = 5;
        s.dispatchEvent(new Event('input', { bubbles: true }));
        s.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  });
  await page.waitForTimeout(3000);

  // 3. Click "I'm heading to X" button
  const headingBtn = await page.locator('button:has-text("heading to")').first();
  if (await headingBtn.isVisible()) await headingBtn.click();
  await page.waitForTimeout(2000);

  // 4. Click "I've plugged in"
  const pluggedBtn = await page.locator('button:has-text("plugged in")').first();
  if (await pluggedBtn.isVisible()) await pluggedBtn.click();
  await page.waitForTimeout(2000);

  // 5. Close any modal
  const closeBtn = await page.locator('button:has-text("X")').first();
  if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  await page.waitForTimeout(500);

  // 6. Go to Home tab
  if (nav.length > 0) await nav[0].click();
  await page.waitForTimeout(1500);

  // 7. Read current time and advance to ~10:10 AM (610 min)
  const timeSlider = await page.locator('input[type="range"]').first();
  const currentVal = await timeSlider.inputValue();
  console.log('Current time slider value:', currentVal);

  // Calculate target: 610 min = 10:10 AM. Slider min=360, max=1140, range=780
  const target = 610;
  const min = 360, max = 1140;
  const pct = (target - min) / (max - min);
  const box = await timeSlider.boundingBox();
  if (box) {
    const x = box.x + pct * box.width;
    console.log('Clicking time slider at x=', x, 'y=', box.y + box.height/2, 'pct=', pct);
    await page.mouse.click(x, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);

  // 8. Screenshot Home to verify time
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-home-1010.png' });

  // 9. Go to Alerts tab
  const nav2 = await page.locator('nav a, nav button').all();
  if (nav2.length > 2) await nav2[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-1010.png', fullPage: true });

  // 10. Advance to 10:20 AM to show both notifications
  if (nav.length > 0) await nav[0].click();
  await page.waitForTimeout(1000);
  const target2 = 620;
  const pct2 = (target2 - min) / (max - min);
  if (box) {
    const x2 = box.x + pct2 * box.width;
    await page.mouse.click(x2, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);
  const nav3 = await page.locator('nav a, nav button').all();
  if (nav3.length > 2) await nav3[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-1020.png', fullPage: true });

  await browser.close();
})();
