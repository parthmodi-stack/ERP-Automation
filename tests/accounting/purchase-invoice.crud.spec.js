const { test, expect } = require('@playwright/test');
const PurchaseInvoicePage = require('../../pages/accounting/PurchaseInvoicePage');
const testData = require('../../config/testData');

// =============================================================================
// Purchase Invoice - CRUD
// =============================================================================
//
// Full Create/Read/Update/Delete coverage for the Item-mode Purchase Invoice, built on
// PurchaseInvoicePage (a proper Page Object, unlike the ad-hoc helper functions in
// purchase-invoice.spec.js) so each step - fill header, add an item entry, save/save-as-draft,
// delete from list vs. from the View page - is a single reusable method rather than duplicated
// per test. purchase-invoice.spec.js already covers list rendering/search, Add-form empty-submit
// validation and duplicate-submit guards, and the per-status button surface on View; this file
// does not repeat those and instead exercises the actual data lifecycle:
//
//   TC-PI-CRUD-01..04  Create (Draft) -> View -> Edit -> Delete (from the View/detail page)
//   TC-PI-CRUD-05..06  Create (Draft) -> Delete (from the list row menu)
//   TC-PI-CRUD-07      Create via "Save" (not "Save to Draft") lands in a non-Draft status
//
// Both describe.serial blocks below build their own invoice rather than sharing one, so a
// Delete in one lifecycle can never invalidate a step still pending in the other (same reasoning
// as chart-of-accounts.crud.spec.js's separate ADD/DISCARD/LIFECYCLE records).

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Purchase Invoice - CRUD', () => {
  const data = testData.accounting.purchaseInvoice;
  // Page-object item entries take the dropdown's exact "<SKU> - <name>" option text under the
  // `item` key; on-page assertions and row lookups use the plain display name instead (see
  // testData.js's purchaseInvoice.item comment for why the two differ).
  const itemEntry = () => ({
    item:        data.item.dropdownOption,
    quantity:    data.item.quantity,
    rate:        data.item.rate,
    taxTemplate: data.item.taxTemplate,
  });

  test.describe.serial('Item invoice lifecycle: create -> view -> edit -> delete (from the detail page)', () => {
    let invoiceUrl;
    const vendorInvoiceNo = `${data.valid.vendorInvoiceNo}_VIEWFLOW`;
    const updatedVendorInvoiceNo = `${data.updated.vendorInvoiceNo}_VIEWFLOW`;

    test('TC-PI-CRUD-01 [+] Create - Save to Draft with one item entry creates a Draft invoice', { tag: '@smoke' }, async ({ page }) => {
      test.setTimeout(60000);
      const pi = new PurchaseInvoicePage(page);

      // Sets a Shipping Address even though this is a Draft save (which doesn't itself require
      // one) because the Edit form has no "Save to Draft" option of its own - editing a Draft
      // invoice always goes through the same fully-validated "Save" the Add form's plain Save
      // uses, confirmed live in TC-PI-CRUD-03, so that field has to already be on the record.
      await pi.createItemInvoice(
        {
          vendor:          data.vendor,
          currency:        data.currency,
          paymentTerm:     data.paymentTerm,
          vendorInvoiceNo,
          shippingAddress: data.shippingAddress,
        },
        [itemEntry()]
      );
      await pi.saveAsDraft();
      await page.waitForURL(pi.listPath, { timeout: 20000 });
      await waitForIdle(page);

      await pi.openNewestRow();
      invoiceUrl = page.url();

      await expect(pi.approvalStatusChipOnView()).toHaveText(/Draft/i, { timeout: 15000 });
      await expect(page.getByText(data.vendor).first()).toBeVisible();
      await expect(page.getByText(data.item.name).first()).toBeVisible();
    });

    test('TC-PI-CRUD-02 [+] Read - View page shows the saved vendor, item, invoice no and Draft status', async ({ page }) => {
      test.skip(!invoiceUrl, 'depends on TC-PI-CRUD-01 creating an invoice first');
      const pi = new PurchaseInvoicePage(page);

      await page.goto(invoiceUrl);
      await waitForIdle(page);

      await expect(page.getByText(data.vendor).first()).toBeVisible();
      await expect(page.getByText(data.item.name).first()).toBeVisible();
      await expect(page.getByText(vendorInvoiceNo).first()).toBeVisible();
      await expect(pi.approvalStatusChipOnView()).toHaveText(/Draft/i);

      // Draft-only header surface (same rule confirmed in purchase-invoice.spec.js's TC-PI-VIEW-02)
      await expect(pi.editButton).toBeVisible();
      await expect(pi.editButton).toBeEnabled();
      await expect(pi.actionsMenuButton).not.toBeVisible();
    });

    test('TC-PI-CRUD-03 [+] Update - Edit changes the vendor invoice no and item quantity, and both persist', async ({ page }) => {
      test.skip(!invoiceUrl, 'depends on TC-PI-CRUD-01 creating an invoice first');
      test.setTimeout(60000);
      const pi = new PurchaseInvoicePage(page);

      await page.goto(invoiceUrl);
      await waitForIdle(page);
      await pi.editButton.click();
      await page.waitForURL(/edit-purchase-invoice/, { timeout: 15000 });
      await waitForIdle(page);

      await pi.fillVendorInvoiceNo(updatedVendorInvoiceNo);
      // Re-passing taxTemplate here isn't a form change (it was already set) - it's required to
      // force the row's Gross/Tax/Net recompute at all. Confirmed live: changing only Quantity
      // and blurring never recalculates those fields on its own, so without re-selecting a tax
      // template afterwards the saved Gross/Net amounts stay stale at the OLD quantity's values,
      // and the backend rejects the PUT with the same "Mismatch found in details" 400 the Add
      // form's item modal hits when Tax Template is skipped entirely (see fillItemEntry's comment).
      await pi.editItemEntry(data.item.name, { quantity: data.updated.quantity, taxTemplate: data.item.taxTemplate });
      // Confirmed live: the Edit form has no "Save to Draft" button at all, only "Save" - the
      // same fully-validated Save the Add form's non-draft path uses (see the header comment on
      // this describe block).
      await pi.save();

      // Edit redirects to the list on success (same convention confirmed for every other
      // document/Settings-entity Page Object in this suite).
      await page.waitForURL(pi.listPath, { timeout: 20000 });
      await waitForIdle(page);

      await page.goto(invoiceUrl);
      await waitForIdle(page);
      await expect(page.getByText(updatedVendorInvoiceNo).first()).toBeVisible();
      await expect(page.getByText(data.updated.quantity, { exact: false }).first()).toBeVisible();
    });

    test('TC-PI-CRUD-04 [-] Delete (detail page) - Cancel keeps the invoice, Delete removes it and redirects to the list', async ({ page }) => {
      test.skip(!invoiceUrl, 'depends on TC-PI-CRUD-01 creating an invoice first');
      const pi = new PurchaseInvoicePage(page);

      await page.goto(invoiceUrl);
      await waitForIdle(page);

      await pi.cancelDeleteFromView();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page).toHaveURL(invoiceUrl);

      await pi.deleteFromView();
      await page.waitForURL(new RegExp(pi.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15000 });

      // Confirmed against the running app: the list's own search box does not actually filter
      // Purchase Invoice results (it always returns the full unfiltered page, a real gap in this
      // list - see the class-level comment), so re-searching for the deleted record can't be used
      // to confirm removal either. Re-visiting the deleted invoice's own URL isn't reliable here
      // either - it neither redirects nor 404s, and the SPA can still render the vendor name from
      // a client-side cache rather than a fresh fetch. Comparing the list's own newest row against
      // the deleted invoice's id is a real check: a freshly-fetched GET can't show a deleted row.
      await waitForIdle(page);
      const deletedId = invoiceUrl.match(/purchase-invoices\/(\d+)\//)?.[1];
      const newestRowHref = await page.locator('table tbody tr').first().locator('a').first().getAttribute('href');
      expect(newestRowHref).not.toContain(`/${deletedId}/`);
    });
  });

  test.describe.serial('Delete from the listing row menu', () => {
    const vendorInvoiceNo = `${data.valid.vendorInvoiceNo}_LISTFLOW`;
    let invoiceUrl;

    test('TC-PI-CRUD-05 [+] Create - a second Draft invoice used by the listing-delete flow', async ({ page }) => {
      test.setTimeout(60000);
      const pi = new PurchaseInvoicePage(page);

      await pi.createItemInvoice(
        { vendor: data.vendor, currency: data.currency, paymentTerm: data.paymentTerm, vendorInvoiceNo },
        [itemEntry()]
      );
      await pi.saveAsDraft();
      await page.waitForURL(pi.listPath, { timeout: 20000 });
      await waitForIdle(page);

      await pi.openNewestRow();
      invoiceUrl = page.url();
      expect(invoiceUrl).toContain('view-purchase-invoice');
    });

    // Confirmed against the running app: the list's ActionBar search box does not actually
    // filter Purchase Invoice results - typing any query (an invoice's own numeric ID, its
    // vendor invoice no, or its vendor's name) still returns the same unfiltered first page, so
    // `SettingsEntityPage.search()`/`openRowMenu()`/`deleteViaMenu()` (which depend on it to find
    // the row) can't be used here. This test instead targets the topmost row directly, the same
    // "list is sorted newest-first" assumption openNewestRow() already relies on - valid here
    // since nothing else creates a Purchase Invoice between TC-PI-CRUD-05 and this test.
    test('TC-PI-CRUD-06 [-] Delete (list row menu) - Cancel keeps the row, Delete removes it', async ({ page }) => {
      test.skip(!invoiceUrl, 'depends on TC-PI-CRUD-05 creating an invoice first');
      const pi = new PurchaseInvoicePage(page);

      await pi.gotoList();
      const row = page.locator('table tbody tr').first();
      await expect(row).toBeVisible();

      await row.hover();
      await row.locator('button').first().click();
      await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await pi.confirmDeleteButton.waitFor({ state: 'visible' });
      await pi.cancelDeleteButton.click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(row).toBeVisible();

      await row.hover();
      await row.locator('button').first().click();
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await pi.confirmDeleteButton.click();
      await waitForIdle(page);

      await page.goto(invoiceUrl).catch(() => {});
      await waitForIdle(page);
      await expect(page.getByText(data.vendor)).not.toBeVisible();
    });
  });

  test('TC-PI-CRUD-07 [+] Create - "Save" (not "Save to Draft") creates a non-Draft invoice', async ({ page }) => {
    test.setTimeout(90000);
    const pi = new PurchaseInvoicePage(page);
    const vendorInvoiceNo = `${data.valid.vendorInvoiceNo}_SAVEFLOW`;

    await pi.createItemInvoice(
      {
        vendor:          data.vendor,
        currency:        data.currency,
        paymentTerm:     data.paymentTerm,
        vendorInvoiceNo,
        shippingAddress: data.shippingAddress,
      },
      [itemEntry()]
    );
    await pi.save();
    await page.waitForURL(pi.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await pi.openNewestRow();
    await expect(pi.approvalStatusChipOnView()).not.toHaveText(/Draft/i, { timeout: 15000 });
  });
});
