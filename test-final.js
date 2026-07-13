const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(3000);

  // Go to Recommend, set battery to 5%
  const nav = await page.locator('nav a, nav button').all();
  if (nav.length > 1) await nav[1].click();
  await page.waitForTimeout(2000);

  const sliders = await page.locator('input[type="range"]').all();
  if (sliders.length > 0) {
    const box = await sliders[0].boundingBox();
    if (box) await page.mouse.click(box.x + 20, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);

  // Click "I'm heading to X"
  const allBtns = await page.locator('button').all();
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && text.includes('heading to') && !text.includes('Demo')) { await btn.click(); break; }
  }
  await page.waitForTimeout(2000);

  // Click "I've plugged in"
  const plugBtns = await page.locator('button').all();
  for (const btn of plugBtns) {
    const text = await btn.textContent();
    if (text && text.includes('plugged in')) { await btn.click(); break; }
  }
  await page.waitForTimeout(2000);

  // Close any modal
  const closeBtn = await page.locator('button:has-text("X"), [aria-label="Close"]').first();
  if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  await page.waitForTimeout(500);

  // Go to Home, advance time slider to 10:10 AM (610 min = ~60% across)
  if (nav.length > 0) await nav[0].click();
  await page.waitForTimeout(1500);

  const timeSlider = await page.locator('input[type="range"]').first();
  const tBox = await timeSlider.boundingBox();
  if (tBox) {
    // 610 min in a 360-1140 range = ~56% across
    await page.mouse.click(tBox.x + tBox.width * 0.56, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);

  // Go to Alerts
  const nav2 = await page.locator('nav a, nav button').all();
  if (nav2.length > 2) await nav2[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-almost-done.png', fullPage: true });

  // Advance to 10:20 AM (620 min) to see move-car alert
  const nav3 = await page.locator('nav a, nav button').all();
  if (nav3.length > 0) await nav3[0].click();
  await page.waitForTimeout(1000);
  if (tBox) {
    await page.mouse.click(tBox.x + tBox.width * 0.62, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);
  const nav4 = await page.locator('nav a, nav button').all();
  if (nav4.length > 2) await nav4[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-move-car.png', fullPage: true });

  await browser.close();
})();
