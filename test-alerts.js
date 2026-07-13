const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(2000);

  // 1. Go to Recommend tab
  await page.locator('nav a, nav button').nth(1).click();
  await page.waitForTimeout(2000);

  // 2. Lower battery to 5% to trigger charge_now
  const batterySlider = await page.locator('input[type="range"]').nth(1);
  const box = await batterySlider.boundingBox();
  if (box) await page.mouse.click(box.x + 20, box.y + box.height / 2);
  await page.waitForTimeout(3000);

  // 3. Click "I'm heading to X" (check in)
  await page.click('button:has-text("I\'m heading to")');
  await page.waitForTimeout(2000);

  // 4. Click "I've plugged in"
  await page.click('button:has-text("I\'ve plugged in")');
  await page.waitForTimeout(2000);

  // 5. Screenshot the YourSession card showing charging
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-charging.png' });

  // 6. Go to Home, advance time slider to near end of charge (simulate 60 min session, advance 50 min)
  await page.locator('nav a, nav button').first().click();
  await page.waitForTimeout(1500);

  // Click time slider near right side (advance time)
  const timeSlider = await page.locator('input[type="range"]').first();
  const tBox = await timeSlider.boundingBox();
  if (tBox) {
    // Move slider forward ~50 min
    await page.mouse.click(tBox.x + tBox.width * 0.6, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);

  // 7. Go to Alerts tab
  await page.locator('nav a, nav button').nth(2).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-1.png', fullPage: true });

  // 8. Advance time more (past charge end) to see move-car alert
  await page.locator('nav a, nav button').first().click();
  await page.waitForTimeout(1000);
  if (tBox) {
    await page.mouse.click(tBox.x + tBox.width * 0.85, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);
  await page.locator('nav a, nav button').nth(2).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-2.png', fullPage: true });

  await browser.close();
})();
