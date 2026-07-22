const { chromium } = require('playwright');
const path = require('path');
const base = '/home/trootech/Documents/Project/Erpforce/ERP-Automation';
const PurchaseOrderPage = require('./pages/PurchaseOrderPage'));
const testData = require('./config/testData'));

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: path.join(base, 'auth.json'), baseURL: 'http://localhost:7172' });
  const page = await context.newPage();

  page.on('response', async (r) => {
    if (/purchase-orders/.test(r.url())) {
      console.log('RESP', r.request().method(), r.status(), r.url());
      if (r.status() >= 400) {
        try { console.log('BODY', JSON.stringify(await r.json())); } catch (e) { console.log('body-err', e.message); }
      }
    }
  });
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });

  const poData = testData.purchaseOrder.valid;
  const po = new PurchaseOrderPage(page);
  await po.gotoAdd();
  await po.fillBasicDetails({
    vendor: poData.vendor,
    entity: poData.entity,
    currency: poData.currency,
    purchaseRepresentative: poData.purchaseRepresentative,
    narration: 'TC-GRN-BF02 multi-grn REPRO',
  });
  await po.selectLocation(poData.location);
  await po.selectPaymentTerm();
  await po.fillAddressContact();
  await po.addItem({ itemName: poData.itemName, quantity: '4', rate: '50' });

  console.log('About to click Submit...');
  try {
    const created = await po.save();
    console.log('SAVE RESULT', JSON.stringify(created));
  } catch (e) {
    console.log('SAVE ERROR', e.message);
  }

  await page.waitForTimeout(3000);
  await browser.close();
})();
