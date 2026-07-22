const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const CommissionTargetPage = require('../../pages/accounting/CommissionTargetPage');

// =============================================================================
// Commission Target - single-file coverage
// =============================================================================
//
// Commission Target (Accounting > Commissions > Target) is master data with no approval workflow
// - confirmed live its View page has only an "Actions" button, no Submit/Accept/Reject/status
// chip. Per project convention this is master data future features (scheduled cron jobs, per the
// original request) will read. Same archetype as Commission Plan (25-commission-plan.spec.js) -
// this suite creates and uses its own disposable record for the full lifecycle (Create -> Detail
// -> Update -> Listing checks -> real Delete) rather than mutating/reading pre-existing shared
// data. Delete runs last in file order since it destroys the record every other test depends on.
//
//   TC-CT-LIST-01  Listing page loads with expected Add control
//   TC-CT-ADD-01   Add form required-field validation
//   TC-CT-CRUD-01  Create a Commission Target with required + optional fields filled
//   TC-CT-CRUD-02  Detail/Read: created record's data displays correctly
//   TC-CT-CRUD-03  Update: edit Target Amount, verify it reflects on Detail + Listing
//   TC-CT-L01..L05 Listing: search, sort, pagination, row action menu, navigation
//   TC-CT-CRUD-04  Delete: actually deletes the record (it's disposable, created by this suite)

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Commission Target Management', () => {
  test('TC-CT-LIST-01 [+] Listing page loads with expected Add control', { tag: '@smoke' }, async ({ page }) => {
    const ct = new CommissionTargetPage(page);
    await ct.gotoList();

    await expect(page.locator('main').getByText('Target', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(ct.addButton).toBeVisible();
  });

  test('TC-CT-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const ct = new CommissionTargetPage(page);
    await ct.openAdd();

    await ct.saveButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-commission-target/);
  });
});

test.describe.serial('Commission Target - Create, Read, Update, Listing, Delete', () => {
  const data = testData.accounting.commissionTarget.valid;
  const updatedTargetAmount = testData.accounting.commissionTarget.updatedTargetAmount;
  let created;

  test('TC-CT-CRUD-01 [+] Create a Commission Target with required and optional fields filled', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90000);
    const ct = new CommissionTargetPage(page);

    await ct.createCommissionTarget({
      salesperson:  data.salesperson,
      type:         data.type,
      startDate:    data.startDate,
      targetAmount: data.targetAmount,
      location:     data.location,
      department:   data.department,
    });

    created = await ct.saveAndCapture();
    expect(created.id).toBeTruthy();
    expect(created.seriesNumber).toBeTruthy();

    await page.waitForURL(ct.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Final check by series number (the record's own stable, unique identifier).
    await expect(ct.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });
  });

  test('TC-CT-CRUD-02 [+] Detail page displays the created record\'s data correctly', { tag: '@smoke' }, async ({ page }) => {
    test.skip(!created, 'depends on TC-CT-CRUD-01 creating the record first');
    const ct = new CommissionTargetPage(page);
    await ct.gotoList();
    await ct.openRow(created.seriesNumber);
    await waitForIdle(page);

    await expect(page.getByText(data.salesperson).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(data.type).first()).toBeVisible();
    await expect(page.getByText(data.targetAmount).first()).toBeVisible();
  });

  test('TC-CT-CRUD-03 [+] Update the Target Amount and verify it reflects on Detail and Listing', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-CT-CRUD-01 creating the record first');
    const ct = new CommissionTargetPage(page);
    // Confirmed live: like Commission Plan, this View page has no direct Edit button, only
    // "Actions" - Edit is reached via the row's own "..." menu instead.
    await ct.editViaMenu(created.seriesNumber);
    await waitForIdle(page);

    await ct.fillTargetAmount(updatedTargetAmount);
    await ct.save();
    await page.waitForURL(ct.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Reflects on Listing (row still present under the same identifying series number).
    await expect(ct.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    // Reflects on Detail.
    await ct.openRow(created.seriesNumber);
    await waitForIdle(page);
    await expect(page.getByText(updatedTargetAmount).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-CT-L01 [+] Search/filter the list', async ({ page }) => {
    test.skip(!created, 'depends on TC-CT-CRUD-01 creating the record first');
    const ct = new CommissionTargetPage(page);
    await ct.gotoList();

    await ct.search(created.seriesNumber);
    await expect(ct.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    await ct.search('no-such-commission-target-zzz-999');
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });

    await ct.search('');
  });

  test('TC-CT-L02 [+] Sort a column ascending/descending', async ({ page }) => {
    const ct = new CommissionTargetPage(page);
    await ct.gotoList();

    const idColumn = page.getByRole('columnheader', { name: /^ID/i });
    const initialSort = await idColumn.getAttribute('aria-sort');
    expect(initialSort === null || initialSort === 'none').toBeTruthy();

    await ct.sortByColumn(/^ID/i);
    const afterFirstClick = await idColumn.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(afterFirstClick);

    await ct.sortByColumn(/^ID/i);
    const afterSecondClick = await idColumn.getAttribute('aria-sort');
    expect(afterSecondClick).not.toBe(afterFirstClick);
    expect(['ascending', 'descending']).toContain(afterSecondClick);
  });

  test('TC-CT-L03 [+] Paginate between pages', async ({ page }) => {
    // This is a live, shared, cumulative environment - the total record count (and so total page
    // count) can sit right at the page-size boundary (10 per page, the smallest of this shared
    // pagination component's own [10, 20, 50] options, so page size can't be lowered to force a
    // second page instead). Rather than skip when there's currently only one page, create just
    // enough extra throwaway Commission Targets to guarantee a real page 2 exists, verify
    // pagination against it, then delete every extra record this test itself created.
    test.setTimeout(150000);
    const ct = new CommissionTargetPage(page);
    await ct.gotoList();

    const paginationLabel = page.getByText(/Page\s*1\s*of\s*\d+/i);
    await expect(paginationLabel).toBeVisible({ timeout: 10000 });
    // Settle wait (same pattern BasePage.getPaginationLabel() uses) - avoids misreading a
    // still-mid-render "Page 1 of 1" as the real total and triggering unneeded filler creation.
    await page
      .locator('.MuiSkeleton-root, .MuiCircularProgress-root, .MuiLinearProgress-root, [role="progressbar"]')
      .first()
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    const labelText = (await paginationLabel.textContent()) ?? '';
    const totalPages = Number(labelText.match(/of\s*(\d+)/i)?.[1] ?? '1');

    const extraCreated = [];
    if (totalPages < 2) {
      const rowsOnPage1 = await page.locator('table tbody tr').count();
      const neededToOverflow = Math.max(1, 10 - rowsOnPage1 + 1);
      for (let i = 0; i < neededToOverflow; i++) {
        await ct.createCommissionTarget({
          salesperson: data.salesperson,
          type:        data.type,
          startDate:   data.startDate,
          targetAmount: '1',
        });
        const filler = await ct.saveAndCapture();
        extraCreated.push(filler.seriesNumber);
        await page.waitForURL(ct.listPath, { timeout: 20000 });
      }
      await ct.gotoList();
    }

    try {
      await expect(page.getByText(/Page\s*1\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
      await ct.goToPage(2);
      await expect(page.getByText(/Page\s*2\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
    } finally {
      for (const seriesNumber of extraCreated) {
        await ct.gotoList();
        await ct.deleteRow(seriesNumber);
      }
    }
  });

  test('TC-CT-L04 [+] Row action menu shows Edit/Duplicate/Delete', async ({ page }) => {
    test.skip(!created, 'depends on TC-CT-CRUD-01 creating the record first');
    const ct = new CommissionTargetPage(page);
    await ct.gotoList();

    // Confirmed live: this row menu offers Edit/Duplicate/Delete - no "View" item (a row's own
    // cell link is the only way to reach the View page), same as Commission Plan.
    await ct.openRowMenu(created.seriesNumber);
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('TC-CT-L05 [+] Navigation between Listing, Add, Edit, and Detail pages', async ({ page }) => {
    test.setTimeout(45000);
    test.skip(!created, 'depends on TC-CT-CRUD-01 creating the record first');
    const ct = new CommissionTargetPage(page);
    await ct.gotoList();
    await expect(page).toHaveURL(new RegExp(ct.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));

    await ct.addButton.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(new RegExp(ct.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await ct.discardButton.click().catch(() => {});

    await ct.gotoList();
    await ct.openRow(created.seriesNumber);
    await waitForIdle(page);
    const viewUrl = page.url();
    expect(viewUrl).not.toContain('add-commission-target');
    // Confirmed live: View page has no direct Edit button, only "Actions" - Edit is reached via
    // the row's own "..." menu (see TC-CT-CRUD-03's own note on this).
    await expect(page.getByRole('button', { name: /^Actions$/i })).toBeVisible({ timeout: 10000 });

    await ct.editViaMenu(created.seriesNumber);
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeVisible({ timeout: 10000 });
    await ct.discardButton.click().catch(() => {});
  });

  test('TC-CT-CRUD-04 [+] Delete the created Commission Target', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-CT-CRUD-01 creating the record first');
    const ct = new CommissionTargetPage(page);

    // This is this suite's own disposable record (not shared production master data), so this
    // actually completes the delete rather than only verifying the confirm-dialog UI.
    await ct.deleteRow(created.seriesNumber);

    await ct.gotoList();
    await ct.search(created.seriesNumber);
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });
    await ct.search('');
  });
});
