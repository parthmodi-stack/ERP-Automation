const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const CommissionPlanPage = require('../../pages/accounting/CommissionPlanPage');

// =============================================================================
// Commission Plan - single-file coverage
// =============================================================================
//
// Commission Plan (Accounting > Commissions > Commission Plan) is master data with no approval
// workflow - confirmed live its View page has no Submit/Actions/status-chip approval controls,
// only a plain Active/Inactive Status toggle. Per project convention this is master data future
// features (scheduled cron jobs, per the original request) will read.
//
// Create was previously blocked by a confirmed live app bug (a dead duplicate form section on the
// Add page whose own stray `company_id` field broke every Save with a 400 "Unknown column
// 'company_id' in field list") - confirmed fixed (see CommissionPlanPage.js's header comment), so
// this suite creates and uses its own disposable record for the full lifecycle (Create -> Detail
// -> Update -> Listing checks -> real Delete) instead of mutating/reading a pre-existing shared
// one. Delete runs last in file order since it destroys the record every other test in this file
// depends on.
//
//   TC-CP-LIST-01  Listing page loads with expected Add control
//   TC-CP-ADD-01   Add form required-field validation
//   TC-CP-CRUD-01  Create a Commission Plan with required + optional fields filled
//   TC-CP-CRUD-02  Detail/Read: created record's data displays correctly
//   TC-CP-CRUD-03  Update: edit Description, verify it reflects on Detail + Listing
//   TC-CP-L01..L05 Listing: search, sort, pagination, row action menu, navigation
//   TC-CP-CRUD-04  Delete: actually deletes the record (it's disposable, created by this suite)

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Commission Plan Management', () => {
  test('TC-CP-LIST-01 [+] Listing page loads with expected Add control', { tag: '@smoke' }, async ({ page }) => {
    const cp = new CommissionPlanPage(page);
    await cp.gotoList();

    await expect(page.locator('main').getByText('Commission Plan', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(cp.addButton).toBeVisible();
  });

  test('TC-CP-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const cp = new CommissionPlanPage(page);
    await cp.openAdd();

    await cp.saveButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-commission-plan/);
  });
});

test.describe.serial('Commission Plan - Create, Read, Update, Listing, Delete', () => {
  const data = testData.accounting.commissionPlan.valid;
  const updatedDescription = testData.accounting.commissionPlan.updatedDescription;
  let created;

  test('TC-CP-CRUD-01 [+] Create a Commission Plan with required and optional fields filled', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90000);
    const cp = new CommissionPlanPage(page);

    await cp.createCommissionPlan({
      title:             data.title,
      type:              data.type,
      commissionAmount:  data.commissionAmount,
      description:       data.description,
      location:          data.location,
      department:        data.department,
    });

    created = await cp.saveAndCapture();
    expect(created.id).toBeTruthy();
    expect(created.seriesNumber).toBeTruthy();

    await page.waitForURL(cp.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Final check by series number (the record's own stable, unique identifier) rather than by
    // title text, matching the pattern used elsewhere in this suite.
    await expect(cp.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });
  });

  test('TC-CP-CRUD-02 [+] Detail page displays the created record\'s data correctly', { tag: '@smoke' }, async ({ page }) => {
    test.skip(!created, 'depends on TC-CP-CRUD-01 creating the record first');
    const cp = new CommissionPlanPage(page);
    await cp.gotoList();
    await cp.openRow(created.seriesNumber);
    await waitForIdle(page);

    await expect(page.getByText(data.title).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(data.type).first()).toBeVisible();
    await expect(page.getByText(data.description).first()).toBeVisible();
  });

  test('TC-CP-CRUD-03 [+] Update the Description field and verify it reflects on Detail and Listing', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-CP-CRUD-01 creating the record first');
    const cp = new CommissionPlanPage(page);
    // Confirmed live: unlike other Settings-entity View pages (e.g. Chart of Accounts), Commission
    // Plan's View page has no direct Edit/Delete buttons in the header, only an "Actions" button -
    // Edit is reached via the row's own "..." menu instead (editViaMenu), not openEdit().
    await cp.editViaMenu(created.seriesNumber);
    await waitForIdle(page);

    await cp.fillDescription(updatedDescription);
    await cp.save();
    await page.waitForURL(cp.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Reflects on Listing (row still present under the same identifying series number).
    await expect(cp.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    // Reflects on Detail.
    await cp.openRow(created.seriesNumber);
    await waitForIdle(page);
    await expect(page.getByText(updatedDescription).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-CP-L01 [+] Search/filter the list', async ({ page }) => {
    test.skip(!created, 'depends on TC-CP-CRUD-01 creating the record first');
    const cp = new CommissionPlanPage(page);
    await cp.gotoList();

    await cp.search(created.seriesNumber);
    await expect(cp.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    await cp.search('no-such-commission-plan-zzz-999');
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });

    await cp.search('');
  });

  test('TC-CP-L02 [+] Sort a column ascending/descending', async ({ page }) => {
    const cp = new CommissionPlanPage(page);
    await cp.gotoList();

    const idColumn = page.getByRole('columnheader', { name: /^ID/i });
    const initialSort = await idColumn.getAttribute('aria-sort');
    expect(initialSort === null || initialSort === 'none').toBeTruthy();

    await cp.sortByColumn(/^ID/i);
    const afterFirstClick = await idColumn.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(afterFirstClick);

    await cp.sortByColumn(/^ID/i);
    const afterSecondClick = await idColumn.getAttribute('aria-sort');
    expect(afterSecondClick).not.toBe(afterFirstClick);
    expect(['ascending', 'descending']).toContain(afterSecondClick);
  });

  test('TC-CP-L03 [+] Paginate between pages', async ({ page }) => {
    // This is a live, shared, cumulative environment - the total record count (and so total page
    // count) can sit right at the page-size boundary (10 per page, confirmed the smallest of this
    // shared pagination component's own [10, 20, 50] options, so page size can't be lowered to
    // force a second page instead). Rather than skip when there's currently only one page, create
    // just enough extra throwaway Commission Plans to guarantee a real page 2 exists, verify
    // pagination against it, then delete every extra record this test itself created so the
    // environment isn't left permanently bloated.
    test.setTimeout(150000);
    const cp = new CommissionPlanPage(page);
    await cp.gotoList();

    const paginationLabel = page.getByText(/Page\s*1\s*of\s*\d+/i);
    await expect(paginationLabel).toBeVisible({ timeout: 10000 });
    // Same settle wait BasePage.getPaginationLabel() uses for this shared pagination component -
    // wait out any loading spinner/skeleton before trusting the label text, so a still-mid-render
    // "Page 1 of 1" isn't misread as the real total and doesn't trigger unnecessary filler creation.
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
      // +1 beyond a full page's worth to guarantee overflow into page 2, not just fill page 1.
      const neededToOverflow = Math.max(1, 10 - rowsOnPage1 + 1);
      for (let i = 0; i < neededToOverflow; i++) {
        await cp.createCommissionPlan({
          title: `TC-CP-L03 pagination filler ${Date.now()}-${i}`,
          type: 'Fixed Rate',
          commissionAmount: '1',
        });
        const created = await cp.saveAndCapture();
        extraCreated.push(created.seriesNumber);
        await page.waitForURL(cp.listPath, { timeout: 20000 });
      }
      await cp.gotoList();
    }

    try {
      await expect(page.getByText(/Page\s*1\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
      await cp.goToPage(2);
      await expect(page.getByText(/Page\s*2\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
    } finally {
      for (const seriesNumber of extraCreated) {
        await cp.gotoList();
        await cp.deleteRow(seriesNumber);
      }
    }
  });

  test('TC-CP-L04 [+] Row action menu shows Edit/Duplicate/Delete', async ({ page }) => {
    test.skip(!created, 'depends on TC-CP-CRUD-01 creating the record first');
    const cp = new CommissionPlanPage(page);
    await cp.gotoList();

    // Confirmed live: this row menu offers Edit/Duplicate/Delete - no "View" item (a row's own
    // cell link is the only way to reach the View page, unlike some other Accounting modules).
    await cp.openRowMenu(created.seriesNumber);
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('TC-CP-L05 [+] Navigation between Listing, Add, Edit, and Detail pages', async ({ page }) => {
    test.setTimeout(45000);
    test.skip(!created, 'depends on TC-CP-CRUD-01 creating the record first');
    const cp = new CommissionPlanPage(page);
    await cp.gotoList();
    await expect(page).toHaveURL(new RegExp(cp.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));

    await cp.addButton.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(new RegExp(cp.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await cp.discardButton.click().catch(() => {});

    await cp.gotoList();
    await cp.openRow(created.seriesNumber);
    await waitForIdle(page);
    const viewUrl = page.url();
    expect(viewUrl).not.toContain('add-commission-plan');
    // Confirmed live: View page has no direct Edit button, only "Actions" - Edit is reached via
    // the row's own "..." menu (see TC-CP-CRUD-03's own note on this).
    await expect(page.getByRole('button', { name: /^Actions$/i })).toBeVisible({ timeout: 10000 });

    await cp.editViaMenu(created.seriesNumber);
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeVisible({ timeout: 10000 });
    await cp.discardButton.click().catch(() => {});
  });

  test('TC-CP-CRUD-04 [+] Delete the created Commission Plan', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-CP-CRUD-01 creating the record first');
    const cp = new CommissionPlanPage(page);

    // This is this suite's own disposable record (not shared production master data), so unlike
    // Debit Note/etc's own delete-UI-only cases, this actually completes the delete.
    await cp.deleteRow(created.seriesNumber);

    await cp.gotoList();
    await cp.search(created.seriesNumber);
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });
    await cp.search('');
  });
});
