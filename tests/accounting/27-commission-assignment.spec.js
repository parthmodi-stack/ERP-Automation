const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const CommissionAssignmentPage = require('../../pages/accounting/CommissionAssignmentPage');

// =============================================================================
// Commission Assignment - single-file coverage
// =============================================================================
//
// Commission Assignment (Accounting > Commissions > Commission Assignment) is master data with no
// approval workflow - confirmed live its View page has only an "Actions" button, no
// Submit/Accept/Reject/status chip. Same archetype as Commission Plan/Commission Target - this
// suite creates and uses its own disposable record for the full lifecycle (Create -> Detail ->
// Update -> Listing checks -> real Delete) rather than mutating/reading pre-existing shared data.
// Delete runs last in file order since it destroys the record every other test depends on.
//
// The "Salesperson" section is a repeatable INLINE-EDITABLE table row, not a modal dialog (see
// CommissionAssignmentPage.js's own header comment) - each row cross-references an existing
// Commission Plan and (optionally) Commission Target record already in this environment.
//
//   TC-CA-LIST-01  Listing page loads with expected Add control
//   TC-CA-ADD-01   Add form required-field validation
//   TC-CA-CRUD-01  Create a Commission Assignment with one Salesperson line item
//   TC-CA-CRUD-02  Detail/Read: created record's data displays correctly
//   TC-CA-CRUD-03  Update: edit Description, verify it reflects on Detail + Listing
//   TC-CA-L01..L05 Listing: search, sort, pagination, row action menu, navigation
//   TC-CA-CRUD-04  Delete: actually deletes the record (it's disposable, created by this suite)

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Commission Assignment Management', () => {
  test('TC-CA-LIST-01 [+] Listing page loads with expected Add control', { tag: '@smoke' }, async ({ page }) => {
    const ca = new CommissionAssignmentPage(page);
    await ca.gotoList();

    await expect(page.locator('main').getByText('Commission Assignment', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(ca.addButton).toBeVisible();
  });

  test('TC-CA-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const ca = new CommissionAssignmentPage(page);
    await ca.openAdd();

    await ca.saveButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-commission-assignment/);
  });
});

test.describe.serial('Commission Assignment - Create, Read, Update, Listing, Delete', () => {
  const data = testData.accounting.commissionAssignment.valid;
  const updatedDescription = testData.accounting.commissionAssignment.updatedDescription;
  let created;

  test('TC-CA-CRUD-01 [+] Create a Commission Assignment with one Salesperson line item', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90000);
    const ca = new CommissionAssignmentPage(page);

    await ca.createCommissionAssignment(
      { title: data.title, description: data.description },
      [{
        salesperson:    data.lineItem.salesperson,
        commissionPlan: data.lineItem.commissionPlan,
        target:         data.lineItem.target,
        endDateDay:     data.lineItem.endDateDay,
      }]
    );

    created = await ca.saveAndCapture();
    expect(created.id).toBeTruthy();
    expect(created.seriesNumber).toBeTruthy();

    await page.waitForURL(ca.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Final check by series number (the record's own stable, unique identifier).
    await expect(ca.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });
  });

  test('TC-CA-CRUD-02 [+] Detail page displays the created record\'s data correctly', { tag: '@smoke' }, async ({ page }) => {
    test.skip(!created, 'depends on TC-CA-CRUD-01 creating the record first');
    const ca = new CommissionAssignmentPage(page);
    await ca.gotoList();
    await ca.openRow(created.seriesNumber);
    await waitForIdle(page);

    await expect(page.getByText(data.title).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(data.description).first()).toBeVisible();
    await expect(page.getByText(data.lineItem.salesperson).first()).toBeVisible();
    await expect(page.getByText(data.lineItem.commissionPlan).first()).toBeVisible();
  });

  test('TC-CA-CRUD-03 [+] Update the Description field and verify it reflects on Detail and Listing', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-CA-CRUD-01 creating the record first');
    const ca = new CommissionAssignmentPage(page);
    // Confirmed live: like Commission Plan/Target, this View page has no direct Edit button, only
    // "Actions" - Edit is reached via the row's own "..." menu instead.
    await ca.editViaMenu(created.seriesNumber);
    await waitForIdle(page);

    await ca.fillDescription(updatedDescription);
    await ca.save();
    await page.waitForURL(ca.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Reflects on Listing (row still present under the same identifying series number).
    await expect(ca.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    // Reflects on Detail.
    await ca.openRow(created.seriesNumber);
    await waitForIdle(page);
    await expect(page.getByText(updatedDescription).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-CA-L01 [+] Search/filter the list', async ({ page }) => {
    test.skip(!created, 'depends on TC-CA-CRUD-01 creating the record first');
    const ca = new CommissionAssignmentPage(page);
    await ca.gotoList();

    await ca.search(created.seriesNumber);
    await expect(ca.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    await ca.search('no-such-commission-assignment-zzz-999');
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });

    await ca.search('');
  });

  test('TC-CA-L02 [+] Sort a column ascending/descending', async ({ page }) => {
    const ca = new CommissionAssignmentPage(page);
    await ca.gotoList();

    const idColumn = page.getByRole('columnheader', { name: /^ID/i });
    const initialSort = await idColumn.getAttribute('aria-sort');
    expect(initialSort === null || initialSort === 'none').toBeTruthy();

    await ca.sortByColumn(/^ID/i);
    const afterFirstClick = await idColumn.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(afterFirstClick);

    await ca.sortByColumn(/^ID/i);
    const afterSecondClick = await idColumn.getAttribute('aria-sort');
    expect(afterSecondClick).not.toBe(afterFirstClick);
    expect(['ascending', 'descending']).toContain(afterSecondClick);
  });

  test('TC-CA-L03 [+] Paginate between pages', async ({ page }) => {
    // This is a live, shared, cumulative environment - the total record count (and so total page
    // count) can sit right at the page-size boundary (10 per page, the smallest of this shared
    // pagination component's own [10, 20, 50] options). Rather than skip when there's currently
    // only one page, create just enough extra throwaway Commission Assignments to guarantee a
    // real page 2 exists, verify pagination against it, then delete every extra record created.
    test.setTimeout(150000);
    const ca = new CommissionAssignmentPage(page);
    await ca.gotoList();

    const paginationLabel = page.getByText(/Page\s*1\s*of\s*\d+/i);
    await expect(paginationLabel).toBeVisible({ timeout: 10000 });
    // Settle wait (same pattern used for Commission Plan/Target) - avoids misreading a
    // still-mid-render "Page 1 of 1" as the real total.
    await page
      .locator('.MuiSkeleton-root, .MuiCircularProgress-root, .MuiLinearProgress-root, [role="progressbar"]')
      .first()
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    const labelText = (await paginationLabel.textContent()) ?? '';
    const totalPages = Number(labelText.match(/of\s*(\d+)/i)?.[1] ?? '1');

    const extraCreated = [];
    try {
      if (totalPages < 2) {
        const rowsOnPage1 = await page.locator('table tbody tr').count();
        const neededToOverflow = Math.max(1, 10 - rowsOnPage1 + 1);
        for (let i = 0; i < neededToOverflow; i++) {
          await ca.createCommissionAssignment(
            { title: `TC-CA-L03 pagination filler ${Date.now()}-${i}` },
            [{
              salesperson: data.lineItem.salesperson,
              commissionPlan: data.lineItem.commissionPlan,
              target: data.lineItem.target,
              endDateDay: data.lineItem.endDateDay,
            }]
          );
          const filler = await ca.saveAndCapture();
          extraCreated.push(filler.seriesNumber);
          await page.waitForURL(ca.listPath, { timeout: 20000 });
        }
        await ca.gotoList();
      }

      await expect(page.getByText(/Page\s*1\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
      await ca.goToPage(2);
      await expect(page.getByText(/Page\s*2\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
    } finally {
      for (const seriesNumber of extraCreated) {
        await ca.gotoList();
        await ca.deleteRow(seriesNumber);
      }
    }
  });

  test('TC-CA-L04 [+] Row action menu shows Edit/Duplicate/Delete', async ({ page }) => {
    test.skip(!created, 'depends on TC-CA-CRUD-01 creating the record first');
    const ca = new CommissionAssignmentPage(page);
    await ca.gotoList();

    // Confirmed live: this row menu offers Edit/Duplicate/Delete - no "View" item, same as
    // Commission Plan/Target.
    await ca.openRowMenu(created.seriesNumber);
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('TC-CA-L05 [+] Navigation between Listing, Add, Edit, and Detail pages', async ({ page }) => {
    test.setTimeout(45000);
    test.skip(!created, 'depends on TC-CA-CRUD-01 creating the record first');
    const ca = new CommissionAssignmentPage(page);
    await ca.gotoList();
    await expect(page).toHaveURL(new RegExp(ca.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));

    await ca.addButton.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(new RegExp(ca.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await ca.discardButton.click().catch(() => {});

    await ca.gotoList();
    await ca.openRow(created.seriesNumber);
    await waitForIdle(page);
    const viewUrl = page.url();
    expect(viewUrl).not.toContain('add-commission-assignment');
    // Confirmed live: View page has no direct Edit button, only "Actions" - Edit is reached via
    // the row's own "..." menu (see TC-CA-CRUD-03's own note on this).
    await expect(page.getByRole('button', { name: /^Actions$/i })).toBeVisible({ timeout: 10000 });

    await ca.editViaMenu(created.seriesNumber);
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeVisible({ timeout: 10000 });
    await ca.discardButton.click().catch(() => {});
  });

  test('TC-CA-CRUD-04 [+] Delete the created Commission Assignment', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-CA-CRUD-01 creating the record first');
    const ca = new CommissionAssignmentPage(page);

    // This is this suite's own disposable record (not shared production master data), so this
    // actually completes the delete rather than only verifying the confirm-dialog UI.
    await ca.deleteRow(created.seriesNumber);

    await ca.gotoList();
    await ca.search(created.seriesNumber);
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });
    await ca.search('');
  });
});
