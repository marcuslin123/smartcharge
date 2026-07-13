const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(3000);

  // Click Recommend
  const nav = await page.locator('nav a, nav button').all();
  if (nav.length > 1) await nav[1].click();
  await page.waitForTimeout(3000);

  // Click BATTERY slider (first range input on Recommend page)
  const sliders = await page.locator('input[type="range"]').all();
  console.log('Found', sliders.length, 'sliders');
  if (sliders.length > 0) {
    const box = await sliders[0].boundingBox();
    if (box) {
      console.log('Clicking battery slider at', box.x + 20, box.y + box.height/2);
      await page.mouse.click(box.x + 20, box.y + box.height / 2);
    }
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-a-lowbat.png', fullPage: true });

  // Dismiss any modal
  try {
    const gotIt = await page.locator('button:has-text("Got it")');
    if (await gotIt.count() > 0 && await gotIt.isVisible()) await gotIt.click();
  } catch (e) { console.log('no modal', e.message); }
  await page.waitForTimeout(500);

  // Click the FIRST w-full button that is NOT the demo button
  const allBtns = await page.locator('button').all();
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && text.includes('heading to') && !text.includes('Demo')) {
      console.log('Clicking:', text.trim());
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-b-checkin.png', fullPage: true });

  // Click "I've plugged in"
  const plugBtns = await page.locator('button').all();
  for (const btn of plugBtns) {
    const text = await btn.textContent();
    if (text && text.includes('plugged in')) {
      console.log('Clicking:', text.trim());
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-c-charging.png', fullPage: true });

  // Go to Home, advance time slider
  const nav2 = await page.locator('nav a, nav button').all();
  if (nav2.length > 0) await nav2[0].click();
  await page.waitForTimeout(1500);

  const sliders2 = await page.locator('input[type="range"]').all();
  if (sliders2.length > 0) {
    const tBox = await sliders2[0].boundingBox();
    if (tBox) {
      console.log('Advancing time slider');
      await page.mouse.click(tBox.x + tBox.width * 0.65, tBox.y + tBox.height / 2);
    }
  }
  await page.waitForTimeout(3000);

  // Go to Alerts
  const nav3 = await page.locator('nav a, nav button').all();
  if (nav3.length > 2) await nav3[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-d-alerts1.png', fullPage: true });

  // Advance time more
  const nav4 = await page.locator('nav a, nav button').all();
  if (nav4.length > 0) await nav4[0].click();
  await page.waitForTimeout(1000);
  if (sliders2.length > 0) {
    const tBox2 = await sliders2[0].boundingBox();
    if (tBox2) await page.mouse.click(tBox2.x + tBox2.width * 0.9, tBox2.y + tBox2.height / 2);
  }
  await page.waitForTimeout(3000);
  const nav5 = await page.locator('nav a, nav button').all();
  if (nav5.length > 2) await nav5[2].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-e-alerts2.png', fullPage: true });

  await browser.close();
})();
