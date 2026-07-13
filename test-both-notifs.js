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

  // 2. Set battery to 5%
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

  // 3. Click "I'm heading to X"
  const headingBtn = await page.locator('button:has-text("heading to")').first();
  if (await headingBtn.isVisible()) await headingBtn.click();
  await page.waitForTimeout(2000);

  // 4. Click "I've plugged in"
  const pluggedBtn = await page.locator('button:has-text("plugged in")').first();
  if (await pluggedBtn.isVisible()) await pluggedBtn.click();
  await page.waitForTimeout(2000);

  // 5. Close modal
  const closeBtn = await page.locator('button:has-text("X")').first();
  if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  await page.waitForTimeout(500);

  // 6. Go to Home, set time to 10:20 AM (620 min)
  if (nav.length > 0) await nav[0].click();
  await page.waitForTimeout(1500);

  const timeSlider = await page.locator('input[type="range"]').first();
  const box = await timeSlider.boundingBox();
  if (box) {
    // 620 min in 360-1140 range = 0.333% across
    const pct = (620 - 360) / (1140 - 360);
    await page.mouse.click(box.x + pct * box.width, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-home-1020.png' });

  // 7. Go to Alerts tab
  const nav2 = await page.locator('nav a, nav button').all();
  if (nav2.length > 2) await nav2[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-both.png', fullPage: true });

  await browser.close();
})();
