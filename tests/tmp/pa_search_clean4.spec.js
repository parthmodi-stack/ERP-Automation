const { test, expect } = require('@playwright/test');
const PurchaseAgreementPage = require('../../pages/PurchaseAgreementPage');

test('inspect element at dismiss click point', async ({ page }) => {
  const pa = new PurchaseAgreementPage(page);
  await pa.gotoList();

  const el = await page.evaluate(() => {
    const e = document.elementFromPoint(300, 10);
    return e ? { tag: e.tagName, cls: e.className, text: e.innerText?.slice(0,50), outer: e.outerHTML?.slice(0,200) } : null;
  });
  console.log('element at (300,10) before search:', JSON.stringify(el));

  page.on('framenavigated', (f) => console.log('NAVIGATED to', f.url()));

  await pa.searchList('PA-2026-000153');
  console.log('rows now', await page.locator('table tbody tr').count());
  console.log('current url', page.url());
});
