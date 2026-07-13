const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-1-home.png' });

  // Click Recommend
  const nav = await page.locator('nav a, nav button').all();
  if (nav.length > 1) await nav[1].click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-2-recommend.png', fullPage: true });

  // Lower battery
  const sliders = await page.locator('input[type="range"]').all();
  if (sliders.length > 1) {
    const box = await sliders[1].boundingBox();
    if (box) await page.mouse.click(box.x + 20, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-3-lowbat.png', fullPage: true });

  // Dismiss any toast
  try {
    const gotIt = await page.locator('button:has-text("Got it")');
    if (await gotIt.isVisible()) await gotIt.click();
  } catch {}
  await page.waitForTimeout(500);

  // Click first big button
  const btns = await page.locator('button[class*="w-full"]').all();
  if (btns.length > 0) {
    try { await btns[0].click(); } catch {}
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/debug-4-checkin.png', fullPage: true });

  await browser.close();
})();
