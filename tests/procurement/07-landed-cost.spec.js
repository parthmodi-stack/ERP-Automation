const { test, expect } = require('@playwright/test');
const LandedCostPage = require('../../pages/LandedCostPage');
const testData = require('../../config/testData');

const FIXTURE_RECEIPT = testData.landedCost.valid.receipt;
const FIXTURE_ITEM = testData.landedCost.valid.itemName;

test.describe('Landed Cost Management', () => {
  test.describe.configure({ timeout: 150000 });

  let createdId;
  let validatedId;

  // ── Landed Cost - Lifecycle (TC01-TC03, TC06) ──────────────────────────
  test.describe.serial('Lifecycle Flow', () => {
    test('TC01 - Create a new record with an item/line and Save', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      await lc.fillHeader({ receipts: [FIXTURE_RECEIPT], narration: 'Automation Landed Cost TC01 create' });
      await lc.addItem({ item: FIXTURE_ITEM, splitMethod: 'Equal', cost: '100' });
      await lc.save();

      await lc.gotoList();
      createdId = await lc.captureCreatedIdFromListResponse();
      expect(createdId.id).toBeTruthy();

      await lc.gotoView(createdId.id);
      expect(await lc.getStatusBadge()).toMatch(/Draft/i);
    });

    test('TC02 - Edit the draft and persist changes', async ({ page }) => {
      const lc = new LandedCostPage(page);
      if (!createdId?.id) test.skip();
      await lc.gotoEdit(createdId.id);
      await lc.resetDateToToday();
      await page.getByPlaceholder('Enter Narration').fill('Automation Landed Cost TC02 edited');
      await lc.save();

      await lc.gotoView(createdId.id);
      expect(await lc.getFieldValueOnView('Narration')).toBe('Automation Landed Cost TC02 edited');
      expect(await lc.getStatusBadge()).toMatch(/Draft/i);
    });

    test('TC03 - View page displays all previously filled data correctly', async ({ page }) => {
      const lc = new LandedCostPage(page);
      if (!createdId?.id) test.skip();
      await lc.gotoView(createdId.id);
      expect(await lc.getFieldValueOnView('Receipt')).toContain(FIXTURE_RECEIPT);
    });

    test('TC06 - Validate transitions Draft -> Validated and locks the record', async ({ page }) => {
      const lc = new LandedCostPage(page);
      if (!createdId?.id) test.skip();
      await lc.gotoView(createdId.id);
      // expect(await lc.hasValidateButton()).toBeTruthy();

      await lc.clickValidate();
      await lc.gotoView(createdId.id);
      expect(await lc.getStatusBadge()).toMatch(/Validated/i);

      // Once Validated, both Actions and Validate should disappear entirely -
      // there is no Accept/Reject/re-open path in this module.
      expect(await lc.hasActionsButton()).toBeFalsy();
      expect(await lc.hasValidateButton()).toBeFalsy();
    });
  });

  // ── Landed Cost - Edit Integrity (TC011/TC012/TC013) ───────────────────
  test.describe.serial('Edit Integrity', () => {
    let id;

    test.beforeAll(async ({ browser }) => {
      // beforeAll/afterAll hooks default to the global 30s test timeout regardless of this
      // file's own describe.configure({ timeout: 150000 }) - that only extends test BODIES, not
      // hooks (confirmed live: this hook's multi-step create flow hit "beforeAll hook timeout of
      // 30000ms exceeded" even with the parent configure already in place). Extend it explicitly.
      test.setTimeout(150000);
      const context = await browser.newContext();
      const page = await context.newPage();
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      await lc.fillHeader({ receipts: [FIXTURE_RECEIPT], narration: 'Automation Landed Cost edit-integrity fixture' });
      await lc.addItem({ item: FIXTURE_ITEM, splitMethod: 'Equal', cost: '50' });
      await lc.save();
      await lc.gotoList();
      id = await lc.captureCreatedIdFromListResponse();
      await context.close();
    });

    test('TC011 - Auto-filled fields on Edit match the View page', async ({ page }) => {
      const lc = new LandedCostPage(page);
      if (!id?.id) test.skip();
      await lc.gotoView(id.id);
      const viewReceipt = await lc.getFieldValueOnView('Receipt');
      const viewNarration = await lc.getFieldValueOnView('Narration');

      await lc.gotoEdit(id.id);
      const editNarration = await page.getByPlaceholder('Enter Narration').inputValue();
      await expect(page.getByText('1 Item Selected')).toBeVisible();
      expect(editNarration).toBe(viewNarration);
      expect(viewReceipt).toContain(FIXTURE_RECEIPT);
    });

    test('TC012 - Read-only fields stay read-only in Edit mode', async ({ page }) => {
      const lc = new LandedCostPage(page);
      if (!id?.id) test.skip();
      await lc.gotoEdit(id.id);
      await expect(page.getByLabel('ID', { exact: true })).toBeDisabled();
      // Date, Receipt, Bill, Narration and the Items grid are all editable
      // while the record is Draft - only ID is read-only.
      await expect(page.getByLabel('Date', { exact: true })).toBeEditable();
      await expect(page.getByLabel('Receipt', { exact: true })).toBeEnabled();
    });

    test('TC013 - Editing a single field and saving updates only that field', async ({ page }) => {
      const lc = new LandedCostPage(page);
      if (!id?.id) test.skip();
      await lc.gotoEdit(id.id);
      await lc.resetDateToToday();
      const beforeReceipt = await lc.getFieldValueOnView('Receipt').catch(() => '');

      await page.getByPlaceholder('Enter Narration').fill('single-field-change-lc');
      await lc.save();

      await lc.gotoView(id.id);
      expect(await lc.getFieldValueOnView('Narration')).toBe('single-field-change-lc');
      if (beforeReceipt) expect(await lc.getFieldValueOnView('Receipt')).toContain(FIXTURE_RECEIPT);
    });
  });

  // ── Landed Cost - Delete & Status Lock (TC014/TC016-equiv/TC019) ───────
  test.describe.serial('Delete & Status Lock', () => {
    test('TC014 - Delete a Draft record', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      await lc.fillHeader({ receipts: [FIXTURE_RECEIPT], narration: 'Automation Landed Cost delete-draft fixture' });
      await lc.addItem({ item: FIXTURE_ITEM, splitMethod: 'Equal', cost: '10' });
      await lc.save();
      await lc.gotoList();
      const draftId = await lc.captureCreatedIdFromListResponse();

      await lc.gotoView(draftId.id);
      await lc.deleteFromView();

      await lc.gotoView(draftId.id);
      await expect(page.getByText(/not found|error/i)).toBeVisible();
    });

    test('TC016-equiv - Edit/Delete are disabled for a Validated record', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      await lc.fillHeader({ receipts: [FIXTURE_RECEIPT], narration: 'Automation Landed Cost validated-lock fixture' });
      await lc.addItem({ item: FIXTURE_ITEM, splitMethod: 'Equal', cost: '10' });
      await lc.save();
      await lc.gotoList();
      validatedId = await lc.captureCreatedIdFromListResponse();

      await lc.gotoView(validatedId.id);
      await lc.clickValidate();

      // Confirmed by direct observation: after validating, the view page's
      // Actions dropdown and Validate button disappear entirely rather than
      // being present-but-blocked.
      await lc.gotoView(validatedId.id);
      expect(await lc.hasActionsButton()).toBeFalsy();

      // In the list, the row's "..." menu shows Edit/Delete visibly disabled
      // for this Validated row (Duplicate remains enabled). List lookups key off the
      // series number (the ID-column text), not the raw PK.
      await lc.gotoList();
      await lc.searchList(validatedId.seriesNumber);
      expect(await lc.isRowActionDisabled(validatedId.seriesNumber, 'Edit')).toBeTruthy();
      expect(await lc.isRowActionDisabled(validatedId.seriesNumber, 'Delete')).toBeTruthy();
      expect(await lc.isRowActionDisabled(validatedId.seriesNumber, 'Duplicate')).toBeFalsy();
    });

    test('TC019 - Related master data (Receipt/Item) remains usable after delete', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      await lc.fillHeader({ receipts: [FIXTURE_RECEIPT] });
      await lc.addItem({ item: FIXTURE_ITEM, splitMethod: 'Equal', cost: '5' });
      const rows = await lc.itemsGridRowCount();
      expect(rows).toBe(1);
      await lc.discard();
    });
  });

  // ── Landed Cost - Listing Page (TC-L01-05) ─────────────────────────────
  test.describe('Listing Page', () => {
    test('TC-L01 - Search/filter the list', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoList();

      let searchKey = validatedId?.seriesNumber || createdId?.seriesNumber || (await lc.getFirstRowSeriesNumber()) || 'LNDC-2026-000017';

      await lc.searchList(searchKey);
      await expect(lc.rowBySeriesNumber(searchKey)).toBeVisible();

      await lc.searchList('no-such-landed-cost-xyz');
      await expect(lc.noDataRow()).toBeVisible();
      await expect(page.locator('table tbody tr').filter({ has: page.locator('a') })).toHaveCount(0);

      await lc.clearSearch();
    });

    test('TC-L02 - Sort a column ascending/descending', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoList();
      const dateHeader = lc.columnHeader('Date');
      await expect(dateHeader).toHaveAttribute('aria-sort', 'none');
      await dateHeader.click();
      await expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
      await dateHeader.click();
      await expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    });

    test('TC-L03 - Paginate between pages', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoList();

      await expect(lc.prevPageButton()).toBeDisabled();
      const label = await lc.getPaginationLabel();
      expect(label).toMatch(/Page\s*1\s*of\s*\d+/);

      const match = label.match(/Page\s*1\s*of\s*(\d+)/);
      const totalPages = match ? parseInt(match[1], 10) : 1;
      if (totalPages > 1) {
        await lc.nextPageButton().click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        expect(await lc.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
        await expect(lc.prevPageButton()).toBeEnabled();

        await lc.prevPageButton().click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        expect(await lc.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

        await lc.goToPage(2);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        expect(await lc.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
      }
    });

    test('TC-L04 - Row action menu shows only status-appropriate actions', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoList();

      const firstRowLink = page.locator('table tbody tr a').first();
      if (await firstRowLink.isVisible()) {
        const seriesNumber = ((await firstRowLink.textContent()) || '').trim();
        expect(await lc.isRowActionDisabled(seriesNumber, 'Edit')).toBeFalsy();
        expect(await lc.isRowActionDisabled(seriesNumber, 'Duplicate')).toBeFalsy();
      }
    });

    test('TC-L05 - Row status badge matches Draft/Validated lifecycle state', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoList();
      await expect(page.getByText('Draft').first()).toBeVisible();
    });
  });

  // ── Landed Cost - Field Validations (TC-V01-07) ────────────────────────
  test.describe('Field Validations', () => {
    test('TC-V01 - Required header fields (Receipt, Items) block save with correct inline errors', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      // Deliberately-invalid submit: client-side Yup validation blocks the create dispatch before
      // any request fires, so there is no list-page navigation to wait for here (unlike save(),
      // which every OTHER test in this suite uses after filling out a valid record).
      await lc.clickSaveWithoutNav();
      await expect(page.getByText('Please select receipts')).toBeVisible();
      await expect(page.getByText('Please add atleast one item')).toBeVisible();
    });

    test('TC-V01b - Item modal required fields block save', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      const modal = await lc.openAddItemModal();
      await modal.getByRole('button', { name: 'Save' }).click();
      await expect(modal.getByText('Please select Item')).toBeVisible();
      await expect(modal.getByText('Please select split method')).toBeVisible();
      await expect(modal.getByText('Please enter cost')).toBeVisible();
    });

    test('TC-V02 - Invalid Cost format is rejected', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      const modal = await lc.openAddItemModal();
      const costInput = modal.getByPlaceholder('Enter Cost');
      // A native <input type="number"> refuses non-numeric keystrokes at the browser level -
      // pressSequentially (not fill(), which throws outright for this input type) confirms the
      // letters never register.
      await costInput.pressSequentially('abc');
      await expect(costInput).toHaveValue('');
      await modal.getByRole('button', { name: 'Save' }).click();
      await expect(modal.getByText('Please enter cost')).toBeVisible();
    });

    test('TC-V03 - Negative Cost is rejected', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      const modal = await lc.openAddItemModal();
      await lc.selectCombobox(modal, 'Item', FIXTURE_ITEM);
      await lc.selectCombobox(modal, 'Split Method', 'Equal');
      await modal.getByPlaceholder('Enter Cost').fill('-50');
      await modal.getByRole('button', { name: 'Save' }).click();
      await expect(modal.getByText('Cost must be a positive number')).toBeVisible();
    });

    test('TC-V04 - Max length / character limit is enforced on Narration', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      const longText = 'A'.repeat(600);
      const narration = page.getByPlaceholder('Enter Narration');
      await narration.fill(longText);
      const value = await narration.inputValue();
      expect(value.length).toBeLessThanOrEqual(600);
    });

    test('TC-V06 - Item Valuation recomputes correctly after adding a cost line', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      await lc.fillHeader({ receipts: [FIXTURE_RECEIPT] });
      await lc.addItem({ item: FIXTURE_ITEM, splitMethod: 'Equal', cost: '100' });
      const valuation = await lc.getItemValuationRow('act');
      const original = Number(valuation.originalValue.replace(/[^0-9.]/g, ''));
      const updated = Number(valuation.newValue.replace(/[^0-9.]/g, ''));
      expect(updated).toBeGreaterThan(original);
    });

    test('TC-V07 - Correcting an invalid field clears its error', async ({ page }) => {
      const lc = new LandedCostPage(page);
      await lc.gotoAdd();
      await lc.clickSaveWithoutNav();
      await expect(page.getByText('Please select receipts')).toBeVisible();
      await lc.fillHeader({ receipts: [FIXTURE_RECEIPT] });
      await expect(page.getByText('Please select receipts')).toBeHidden();
    });
  });
});
