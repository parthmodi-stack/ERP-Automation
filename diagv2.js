const { chromium } = require('@playwright/test');
const LandedCostPage = require('./pages/LandedCostPage');
const testData = require('./config/testData');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ storageState: './auth.json', viewport: { width: 1280, height: 720 }, baseURL: 'http://localhost:7172' });
  const page = await context.newPage();
  page.on('response', r => { if (/landing-cost/.test(r.url())) console.log('RESP', r.status(), r.request().method(), r.url()); });
  page.on('console', m => console.log('CONSOLE', m.type(), m.text()));

  const lc = new LandedCostPage(page);
  await lc.gotoAdd();
  await lc.fillHeader({ receipts: [testData.landedCost.valid.receipt], narration: 'diag validate test2' });
  await lc.addItem({ item: testData.landedCost.valid.itemName, splitMethod: 'Equal', cost: '10' });
  await lc.save();
  await lc.gotoList();
  const created = await lc.captureCreatedIdFromListResponse();
  console.log('created', created);
  await lc.gotoView(created.id);

  const btn = page.getByRole('button', { name: 'Validate' });
  console.log('button count', await btn.count());
  console.log('visible', await btn.isVisible());
  console.log('enabled', await btn.isEnabled());
  console.log('disabled attr', await btn.getAttribute('disabled'));
  await btn.click();
  await page.waitForTimeout(3000);
  console.log('status after click+3s wait:', await lc.getStatusBadge());
  await browser.close();
  console.log('DONE');
})();
