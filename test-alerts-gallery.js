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

  // 2. Set battery slider to 5% (far left click)
  const sliders = await page.locator('input[type="range"]').all();
  if (sliders.length > 0) {
    const box = await sliders[0].boundingBox();
    if (box) await page.mouse.click(box.x + 20, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);

  // 3. Click "I'm heading to X" (first non-demo w-full button)
  const allBtns = await page.locator('button').all();
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && text.includes('heading to') && !text.includes('Demo')) {
      await btn.click(); break;
    }
  }
  await page.waitForTimeout(2000);

  // 4. Click "I've plugged in"
  const plugBtns = await page.locator('button').all();
  for (const btn of plugBtns) {
    const text = await btn.textContent();
    if (text && text.includes('plugged in')) { await btn.click(); break; }
  }
  await page.waitForTimeout(2000);

  // 5. Close any modal with X
  const closeBtns = await page.locator('button').all();
  for (const btn of closeBtns) {
    const text = await btn.textContent().catch(() => '');
    if (text === 'X') { await btn.click(); break; }
  }
  await page.waitForTimeout(500);

  // 6. Go to Home tab
  if (nav.length > 0) await nav[0].click();
  await page.waitForTimeout(1500);

  // 7. Click time slider at ~31% to set to ~10:05 AM (605 min in 360-1140 range)
  const timeSlider = await page.locator('input[type="range"]').first();
  const tBox = await timeSlider.boundingBox();
  if (tBox) {
    // 605 min = 31% across the 360-1140 range
    await page.mouse.click(tBox.x + tBox.width * 0.31, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-home-time-set.png' });

  // 8. Go to Alerts tab
  const nav2 = await page.locator('nav a, nav button').all();
  if (nav2.length > 2) await nav2[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-gallery.png', fullPage: true });

  // 9. Advance time to ~10:20 AM to show move-car notification too
  const nav3 = await page.locator('nav a, nav button').all();
  if (nav3.length > 0) await nav3[0].click();
  await page.waitForTimeout(1000);
  if (tBox) {
    await page.mouse.click(tBox.x + tBox.width * 0.37, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);
  const nav4 = await page.locator('nav a, nav button').all();
  if (nav4.length > 2) await nav4[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-gallery2.png', fullPage: true });

  await browser.close();
})();
