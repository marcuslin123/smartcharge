const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(2000);

  // 1. Go to Recommend tab
  const navButtons = await page.locator('nav a, nav button').all();
  if (navButtons.length > 1) await navButtons[1].click();
  await page.waitForTimeout(2000);

  // 2. Lower battery to 5% to trigger charge_now
  const sliders = await page.locator('input[type="range"]').all();
  if (sliders.length > 1) {
    const box = await sliders[1].boundingBox();
    if (box) await page.mouse.click(box.x + 20, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);

  // 3. Click the first big button in the card (check in)
  const bigBtn = await page.locator('button[class*="w-full"]').first();
  if (await bigBtn.isVisible()) await bigBtn.click();
  await page.waitForTimeout(2000);

  // 4. Click "I've plugged in"
  const plugBtn = await page.locator('button:has-text("plugged in")').first();
  if (await plugBtn.isVisible()) await plugBtn.click();
  await page.waitForTimeout(2000);

  // 5. Screenshot charging state
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-charging.png' });

  // 6. Go to Home, advance time slider
  const navs = await page.locator('nav a, nav button').all();
  if (navs.length > 0) await navs[0].click();
  await page.waitForTimeout(1500);

  if (sliders.length > 0) {
    const tBox = await sliders[0].boundingBox();
    if (tBox) await page.mouse.click(tBox.x + tBox.width * 0.65, tBox.y + tBox.height / 2);
  }
  await page.waitForTimeout(3000);

  // 7. Go to Alerts
  const navs2 = await page.locator('nav a, nav button').all();
  if (navs2.length > 2) await navs2[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-1.png', fullPage: true });

  // 8. Advance time more to see move-car alert
  const navs3 = await page.locator('nav a, nav button').all();
  if (navs3.length > 0) await navs3[0].click();
  await page.waitForTimeout(1000);

  if (sliders.length > 0) {
    const tBox2 = await sliders[0].boundingBox();
    if (tBox2) await page.mouse.click(tBox2.x + tBox2.width * 0.9, tBox2.y + tBox2.height / 2);
  }
  await page.waitForTimeout(3000);

  const navs4 = await page.locator('nav a, nav button').all();
  if (navs4.length > 2) await navs4[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-alerts-2.png', fullPage: true });

  await browser.close();
})();
