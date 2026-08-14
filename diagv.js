const { chromium } = require('@playwright/test');
const LandedCostPage = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/pages/LandedCostPage');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ storageState: '/home/trootech/Documents/Project/Erpforce/ERP-Automation/auth.json', viewport: { width: 1280, height: 720 }, baseURL: 'http://localhost:7172' });
  const page = await context.newPage();
  page.on('response', r => { if (/landing-cost\/validate/.test(r.url())) console.log('VALIDATE RESPONSE', r.status(), r.url()); });

  const lc = new LandedCostPage(page);
  // create a quick record
  await lc.gotoAdd();
  const testData = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/config/testData');
  await lc.fillHeader({ receipts: [testData.landedCost.valid.receipt], narration: 'diag validate test' });
  await lc.addItem({ item: testData.landedCost.valid.itemName, splitMethod: 'Equal', cost: '10' });
  await lc.save();
  await lc.gotoList();
  const created = await lc.captureCreatedIdFromListResponse();
  console.log('created', created);
  await lc.gotoView(created.id);
  console.log('status before validate:', await lc.getStatusBadge());
  await lc.clickValidate();
  console.log('clicked validate, status right after click (no wait):', await lc.getStatusBadge().catch(e => 'ERR:' + e.message));
  await lc.gotoView(created.id);
  console.log('status after re-navigating to view:', await lc.getStatusBadge());
  await browser.close();
  console.log('DONE');
})();
