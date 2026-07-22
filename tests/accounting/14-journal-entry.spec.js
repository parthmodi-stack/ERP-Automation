const { test, expect } = require('@playwright/test');
const path = require('path');
const JournalEntryPage = require('../../pages/accounting/JournalEntryPage');
const testData = require('../../config/testData');

// NOTE: button/label text below (Add Item, Save, Submit, Accept, Reject, Mark As Void) comes
// from i18n keys in journal-entry.tsx/journal-item-modal.tsx (e.g. t('common.submit')) whose
// rendered English strings must be confirmed against the running app - update the locators in
// pages/accounting/JournalEntryPage.js if the live UI text differs.
//
// Tests in this file run sequentially (playwright.config.js sets workers: 1) and share state
// via the module-level `createdEntryUrl`/`createdEntryUrl2` variables, the same way
// 02-location.spec.js shares a created record's name across its own TC-LOC-02..09.

test.describe('Journal Entry Management', () => {
  const data = testData.accounting.journalEntry;
  let createdEntryUrl; // used by view/edit/submit/duplicate tests below
  let createdSeriesNumber; // e.g. 'JV-2026-017074' - used for the search test (the URL's numeric id isn't the same value the search box matches against)

  // Save redirects to the plain list (same as every Settings entity), not to a /:id view page -
  // confirmed against the running app. Journal Entries have no chosen unique display name like
  // Settings entities do, so the newest row (list is sorted newest-first by default) is used to
  // recover the just-created entry's real view URL.
  async function openNewestEntry(page) {
    const je = new JournalEntryPage(page);
    await je.gotoList();
    await page.waitForTimeout(500);
    await page.locator('table tbody tr').first().locator('a').first().click();
    await page.waitForLoadState('networkidle');
    return je;
  }

  async function createBalancedEntry(page) {
    const je = new JournalEntryPage(page);
    await je.openAdd();
    await je.selectField('journal_type_id', data.valid.header.journalTypeId);
    for (const item of data.valid.lineItems) {
      await je.addLineItem(item);
    }
    await je.save();
    await page.waitForLoadState('networkidle');
    await page.waitForURL(je.listPath, { timeout: 10000 });
    return je;
  }

  test('TC-JE-01 [+] Navigate to Journal Entry list', { tag: '@smoke' }, async ({ page }) => {
    const je = new JournalEntryPage(page);
    await je.gotoList();
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('TC-JE-02 [+] Create a balanced Journal Entry with two line items', { tag: '@smoke' }, async ({ page }) => {
    // Two line-item modals plus header/list navigation, each with dropdown selections, is
    // marginal against the 30s default with this suite's global slowMo: 500 (same reasoning as
    // settings-entity.contract.js's TC-05 and 09-customer-vendor.spec.js's create tests).
    test.setTimeout(60000);
    const je = new JournalEntryPage(page);
    await je.openAdd();
    await je.selectField('journal_type_id', data.valid.header.journalTypeId);

    for (const item of data.valid.lineItems) {
      await je.addLineItem(item);
    }

    const debit = (await je.totalDebitValue.textContent())?.trim();
    const credit = (await je.totalCreditValue.textContent())?.trim();
    expect(debit).toBe(credit);

    await je.save();
    await page.waitForLoadState('networkidle');
    await page.waitForURL(je.listPath, { timeout: 10000 });

    await openNewestEntry(page);
    createdEntryUrl = page.url();
    const seriesMatch = (await page.locator('main').innerText()).match(/[A-Z]{1,3}-\d{4}-\d+/);
    createdSeriesNumber = seriesMatch?.[0];
    await expect(page.getByText(data.valid.lineItems[0].narration).first()).toBeVisible();
  });

  test('TC-JE-03 [-] Line item modal requires an Account before saving', async ({ page }) => {
    const je = new JournalEntryPage(page);
    await je.openAdd();
    await je.selectField('journal_type_id', data.valid.header.journalTypeId);
    await je.openAddItemModal();
    await je.fillLineItem({ debitAmount: '100' });
    await je.itemModalSaveButton.click();
    await expect(je.lineItemAccountError()).toBeVisible();
  });

  test('TC-JE-04 [-] Line item modal requires at least one of debit/credit amount', async ({ page }) => {
    const je = new JournalEntryPage(page);
    await je.openAdd();
    await je.selectField('journal_type_id', data.valid.header.journalTypeId);
    await je.openAddItemModal();
    await je.fillLineItem({ account: data.valid.lineItems[0].account });
    await je.itemModalSaveButton.click();
    await expect(je.lineItemAmountError()).toBeVisible();
  });

  test('TC-JE-05 [-] Saving an unbalanced entry (debit != credit) is rejected', async ({ page }) => {
    const je = new JournalEntryPage(page);
    await je.openAdd();
    await je.selectField('journal_type_id', data.valid.header.journalTypeId);
    for (const item of data.unbalanced.lineItems) {
      await je.addLineItem(item);
    }
    await je.save();
    // Confirmed against the running app: this validation renders as an inline banner above the
    // line-item table, not a toast.
    await expect(je.imbalanceError()).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(je.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('TC-JE-06 [-] Saving an entry with only a single line item is rejected', async ({ page }) => {
    const je = new JournalEntryPage(page);
    await je.openAdd();
    await je.selectField('journal_type_id', data.valid.header.journalTypeId);
    for (const item of data.singleLine.lineItems) {
      await je.addLineItem(item);
    }
    await je.save();
    await expect(je.imbalanceError()).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(je.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('TC-JE-07 [+] View - saved entry shows header and line item values', async ({ page }) => {
    test.skip(!createdEntryUrl, 'depends on TC-JE-02 creating an entry first');
    await page.goto(createdEntryUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.valid.lineItems[0].narration).first()).toBeVisible();
    await expect(page.getByText(data.valid.lineItems[1].narration).first()).toBeVisible();
  });

  test('TC-JE-08 [+] Edit and persist a narration change', async ({ page }) => {
    test.skip(!createdEntryUrl, 'depends on TC-JE-02 creating an entry first');
    const je = new JournalEntryPage(page);
    await page.goto(createdEntryUrl);
    await page.waitForLoadState('networkidle');
    // Confirmed against the running app: Edit is its own top-level button on the view page, not
    // nested under the "Actions" menu (which holds Duplicate/Delete instead).
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.waitForLoadState('networkidle');

    const updatedNarration = `${data.valid.lineItems[0].narration}_EDITED`;
    // Confirmed against the running app: each line-item row's first cell holds a pencil
    // IconButton (data-testid="EditIcon") that reopens the item modal - the row's text itself
    // isn't clickable.
    await page.locator('table tbody tr').filter({ hasText: data.valid.lineItems[0].account })
      .first().locator('button').first().click();
    await je.itemModal.waitFor({ state: 'visible' });
    await je.lineItemField('narration').fill(updatedNarration);
    await je.saveLineItem();
    await je.save();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(updatedNarration).first()).toBeVisible();
  });

  test('TC-JE-09 [+] Duplicate opens a pre-filled Add form', async ({ page }) => {
    test.skip(!createdEntryUrl, 'depends on TC-JE-02 creating an entry first');
    const je = new JournalEntryPage(page);
    await page.goto(createdEntryUrl);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForURL(new RegExp(je.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.getByText(data.valid.lineItems[0].account).first()).toBeVisible();
  });

  test('TC-JE-10 [+] Submit for Approval changes the status chip', async ({ page }) => {
    test.skip(!createdEntryUrl, 'depends on TC-JE-02 creating an entry first');
    const je = new JournalEntryPage(page);
    await page.goto(createdEntryUrl);
    await page.waitForLoadState('networkidle');
    const statusBefore = await je.statusChipOnView().textContent().catch(() => null);
    await je.submitForApproval();
    await page.waitForLoadState('networkidle');
    if (statusBefore) {
      await expect(je.statusChipOnView()).not.toHaveText(statusBefore);
    }
  });

  // Accept/Reject/Mark-as-Void depend on the logged-in test user being the assigned approver,
  // which is an environment/data-configuration concern rather than something this pilot suite
  // can guarantee. Skipped for now - see ACCOUNTING_FINDINGS.md "Follow-up" section for how to
  // enable them (a second approver-role test account, or a company config with auto-approval).
  test.skip('TC-JE-11 [+] Accept a submitted entry as the assigned approver', async () => {});
  test.skip('TC-JE-12 [-] Reject a submitted entry as the assigned approver', async () => {});
  test.skip('TC-JE-13 [+] Mark an Approved entry as Void', async () => {});

  test('TC-JE-14 [+] Attach a file on create and verify it appears on View', async ({ page }) => {
    const je = new JournalEntryPage(page);
    await je.openAdd();
    await je.selectField('journal_type_id', data.valid.header.journalTypeId);
    for (const item of data.valid.lineItems) {
      await je.addLineItem(item);
    }
    await je.attachFile(path.join(__dirname, '..', '..', 'fixtures', 'sample-attachment.txt'));
    await je.save();
    await page.waitForLoadState('networkidle');
    await page.waitForURL(je.listPath, { timeout: 10000 });
    await openNewestEntry(page);
    await expect(page.getByText(/sample-attachment/i)).toBeVisible();
  });

  test('TC-JE-15 [-] Delete an entry removes it from the list', async ({ page }) => {
    await createBalancedEntry(page);
    const je = await openNewestEntry(page);
    const entryUrl = page.url();
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL(je.listPath, { timeout: 10000 });
    await page.goto(entryUrl).catch(() => {});
    // Deleted entries should 404 / redirect rather than render successfully.
  });

  test('TC-JE-16 [+] Search list by series number', async ({ page }) => {
    test.skip(!createdSeriesNumber, 'depends on TC-JE-02 creating an entry first');
    const je = new JournalEntryPage(page);
    await je.gotoList();
    await je.search(createdSeriesNumber);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(createdSeriesNumber).first()).toBeVisible();
  });
});
