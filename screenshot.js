const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(2000);
  
  // Click Recommend tab (bottom nav, 3rd item)
  const tabs = await page.locator('nav button, nav a, [role="tablist"] button, [role="tablist"] a').all();
  if (tabs.length >= 3) {
    await tabs[1].click();
  } else {
    // fallback: click by text
    await page.locator('text=Recommend').nth(1).click();
  }
  await page.waitForTimeout(3000);
  
  // Click on battery slider track at ~5% position (far left)
  const batterySlider = await page.locator('input[type="range"]').nth(1);
  const box = await batterySlider.boundingBox();
  if (box) {
    // Click near the left edge of the slider (5%)
    await page.mouse.click(box.x + 20, box.y + box.height / 2);
  }
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'c:/Users/MXL0RRR/projects/ev/screenshot-rec.png', fullPage: true });
  await browser.close();
})();
