const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(3000);

  // Go to Recommend, set battery to 8%
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
    if (text && text.includes('heading to') && !text.includes('Demo')) {
      await btn.click(); break;
    }
  }
  await page.waitForTimeout(2000);

  // Click "I've plugged in"
  const plugBtns = await page.locator('button').all();
  for (const btn of plugBtns) {
    const text = await btn.textContent();
    if (text && text.includes('plugged in')) { await btn.click(); break; }
  }
  await page.waitForTimeout(2000);

  // Read the predicted finish time from the modal
  const modalText = await page.locator('[role="dialog"], .fixed, .absolute').first().textContent().catch(() => '');
  console.log('Modal text:', modalText);

  // Close modal if open
  const closeBtn = await page.locator('button:has-text("X"), [aria-label="Close"]').first();
  if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  await page.waitForTimeout(500);

  // Go to Home, read current time slider value
  if (nav.length > 0) await nav[0].click();
  await page.waitForTimeout(1500);

  const timeSlider = await page.locator('input[type="range"]').first();
  const timeVal = await timeSlider.inputValue().catch(() => '0');
  console.log('Current time slider value:', timeVal);

  // The charge was ~54 min. We need to advance to about 40 min after start (10 min before done).
  // Calculate target time = current + 40 min
  const currentMin = parseInt(timeVal) || 561; // ~9:21 AM
  const targetMin = currentMin + 45; // 45 min after start = ~10 min before done
  console.log('Advancing to minute:', targetMin, 'which is', Math.floor(targetMin/60) + ':' + String(targetMin%60).padStart(2,'0'));

  // We need to click the slider at the right position. The slider goes from 360 (6 AM) to 1140 (7 PM) = 780 range.
  const tBox = await timeSlider.boundingBox();
  if (tBox) {
    const pct = (targetMin - 360) / 780;
    const x = tBox.x + pct * tBox.width;
    await page.mouse.click(x, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-time-advanced.png' });

  // Go to Alerts
  const nav2 = await page.locator('nav a, nav button').all();
  if (nav2.length > 2) await nav2[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-alerts-almost-done.png', fullPage: true });

  await browser.close();
})();
