const { test, expect } = require('@playwright/test');
const CurrencyExchangePage = require('../../pages/accounting/CurrencyExchangePage');
const CurrencyPage = require('../../pages/accounting/CurrencyPage');
const testData = require('../../config/testData');

// =============================================================================
// Currency Exchange (Settings)
// =============================================================================
//
// Doesn't use the shared registerSettingsEntityTests factory (see settings-entity.contract.js):
// unlike every other Settings entity in this suite, there's no free-text "name" field known
// before creation - each row is identified only by an auto-generated series number (e.g.
// "CEX-2026-000007"), so search/view/edit all need that series captured AFTER Save, the same
// "document" pattern purchase-invoice.crud.spec.js and 07-payment-entry.spec.js already use.

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Currency Exchange (Settings)', () => {
  const data = testData.accounting.currencyExchange;

  // from_currency_id/to_currency_id need existing Currency (Settings > Currency) records - seed
  // a dedicated pair here, never deleted, so this file runs independently of 02-currency.spec.js's
  // own CRUD lifecycle (which deletes its record at the end).
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    const currency = new CurrencyPage(page);
    for (const name of [data.seedFromCurrencyName, data.seedToCurrencyName]) {
      await currency.openAdd();
      await currency.create({
        name,
        symbol: '$',
        fraction: 'Cents',
        fraction_unit: '100',
        smallest_fraction_value: '0.01',
        exchange_rate: '1',
      });
      await currency.save();
      await page.waitForLoadState('networkidle');
    }
    await context.close();
  });

  test('TC-CEX-01 [+] Navigate to list and verify page loads', { tag: '@smoke' }, async ({ page }) => {
    const ce = new CurrencyExchangePage(page);
    await ce.gotoList();
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('TC-CEX-02 [-] Create with required fields blank stays on the add form', async ({ page }) => {
    const ce = new CurrencyExchangePage(page);
    await ce.openAdd();
    await ce.create(data.missingRequired);
    await ce.save();
    await expect(page).toHaveURL(new RegExp(ce.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const errors = page.locator('.MuiFormHelperText-root[class*="error"], .Mui-error');
    await expect(errors.first()).toBeVisible({ timeout: 5000 });
  });

  test.describe.serial('Create -> View -> Edit -> Search -> Delete lifecycle', () => {
    let seriesNumber;

    test('TC-CEX-03 [+] Create with all fields', { tag: '@smoke' }, async ({ page }) => {
      test.setTimeout(60000);
      const ce = new CurrencyExchangePage(page);
      const { updatedExchangeRate, ...formFields } = data.valid;
      await ce.openAdd();
      await ce.create(formFields);
      await ce.save();
      await page.waitForURL(new RegExp(ce.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), {
        timeout: 15000,
      });
      await waitForIdle(page);

      seriesNumber = await ce.openNewestRow();
      expect(seriesNumber).toMatch(/CEX-\d{4}-\d+/);

      await expect(page.getByText(data.seedFromCurrencyName).first()).toBeVisible();
      await expect(page.getByText(data.seedToCurrencyName).first()).toBeVisible();
      await expect(page.getByText(data.valid.exchange_rate, { exact: false }).first()).toBeVisible();
    });

    test('TC-CEX-04 [+] View shows the saved record', async ({ page }) => {
      test.skip(!seriesNumber, 'depends on TC-CEX-03 creating a record first');
      const ce = new CurrencyExchangePage(page);
      await ce.gotoList();
      await expect(page.getByRole('link', { name: seriesNumber, exact: true })).toBeVisible();
    });

    test('TC-CEX-05 [+] Edit updates the exchange rate and the change persists', async ({ page }) => {
      test.skip(!seriesNumber, 'depends on TC-CEX-03 creating a record first');
      test.setTimeout(60000);
      const ce = new CurrencyExchangePage(page);

      await ce.gotoList();
      await ce.rowLink(seriesNumber).click();
      await waitForIdle(page);
      await ce.editButton.click();
      await page.waitForURL(/edit-currency-exchange/, { timeout: 15000 });
      await waitForIdle(page);

      await ce.fillField('exchange_rate', data.valid.updatedExchangeRate);
      await ce.save();
      await waitForIdle(page);

      await ce.gotoList();
      await ce.rowLink(seriesNumber).click();
      await waitForIdle(page);
      await expect(page.getByText(data.valid.updatedExchangeRate, { exact: false }).first()).toBeVisible();
    });

    test('TC-CEX-06 [+] Search by series number returns the matching row', async ({ page }) => {
      test.skip(!seriesNumber, 'depends on TC-CEX-03 creating a record first');
      const ce = new CurrencyExchangePage(page);
      await ce.gotoList();
      await ce.search(seriesNumber);
      await expect(page.getByText(seriesNumber).first()).toBeVisible();
    });

    test('TC-CEX-07 [-] Delete via row menu: Cancel keeps it, Confirm removes it', async ({ page }) => {
      test.skip(!seriesNumber, 'depends on TC-CEX-03 creating a record first');
      const ce = new CurrencyExchangePage(page);

      await ce.gotoList();
      await ce.search(seriesNumber);
      const row = ce.row(seriesNumber);
      await expect(row.first()).toBeVisible({ timeout: 10000 });

      await row.hover();
      await row.locator('button').first().click();
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await ce.confirmDeleteButton.waitFor({ state: 'visible' });
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(row.first()).toBeVisible();

      await row.hover();
      await row.locator('button').first().click();
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await ce.confirmDeleteButton.click();
      await waitForIdle(page);

      await ce.gotoList();
      await ce.search(seriesNumber);
      await expect(page.getByText(seriesNumber)).not.toBeVisible();
    });
  });
});
