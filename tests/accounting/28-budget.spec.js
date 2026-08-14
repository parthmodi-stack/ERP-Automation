const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const BudgetPage = require('../../pages/accounting/BudgetPage');

// =============================================================================
// Budget - single-file coverage (simple CRUD scope, not advanced budget workflows)
// =============================================================================
//
// Budget (Accounting > Budget) is a document module with an approval workflow (Draft-less: Save
// creates it directly in "Pending" status, same status model as Asset Transfer - confirmed live).
// This suite creates and uses its own disposable record for the full lifecycle (Create -> Detail
// -> Update -> Listing checks -> Delete) rather than mutating/reading pre-existing shared data.
//
// The "Select Account" picker is a multi-step flow (category popover -> tab -> "Add Accounts"
// dialog -> checkbox + Update -> real line-items table populates) - see BudgetPage.js's own class
// doc comment for the full confirmed sequence. Per this task's explicit scope ("simple CRUD, not
// advanced budget workflows"), this suite only exercises category-level selection (checking the
// whole "Assets" category) and does not fill per-account/per-month line item amounts, nor does it
// exercise Submit/Quick Approval/Accept - those are separate approval-workflow concerns already
// covered by this suite's pattern on other document modules (e.g. Asset Transfer, Debit Note).
//
//   TC-BUD-LIST-01  Listing page loads with expected Add control
//   TC-BUD-ADD-01   Add form required-field validation
//   TC-BUD-CRUD-01  Create a Budget with required fields + one Select Account category
//   TC-BUD-CRUD-02  Detail/Read: created record's data displays correctly
//   TC-BUD-CRUD-03  Update: edit Total Amount, verify it reflects on Detail + Listing
//   TC-BUD-L01..L05 Listing: search, sort, pagination, row action menu, navigation
//   TC-BUD-CRUD-04  Delete: verify actual delete behavior on this suite's own disposable record

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Budget Management', () => {
  test('TC-BUD-LIST-01 [+] Listing page loads with expected Add control', { tag: '@smoke' }, async ({ page }) => {
    const bud = new BudgetPage(page);
    await bud.gotoList();

    await expect(page.locator('main').getByText('Budget', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(bud.addButton).toBeVisible();
  });

  test('TC-BUD-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const bud = new BudgetPage(page);
    await bud.openAdd();

    await bud.saveButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-budget/);
  });
});

test.describe.serial('Budget - Create, Read, Update, Listing, Delete', () => {
  const data = testData.accounting.budget.valid;
  const updatedTotalAmount = testData.accounting.budget.updatedTotalAmount;
  let created;

  test('TC-BUD-CRUD-01 [+] Create a Budget with required fields and one Select Account category', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90000);
    const bud = new BudgetPage(page);

    await bud.createBudget({
      budgetName:      data.budgetName,
      budgetType:      data.budgetType,
      financialYear:   data.financialYear,
      totalAmount:     data.totalAmount,
      budgetPeriod:    data.budgetPeriod,
      budgetMonths:    data.budgetMonths,
      accountCategory: data.accountCategory,
    });

    created = await bud.saveAndCapture();
    expect(created.id).toBeTruthy();
    expect(created.seriesNumber).toBeTruthy();

    await page.waitForURL(bud.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Final check by series number (the record's own stable, unique identifier).
    await expect(bud.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });
  });

  test('TC-BUD-CRUD-02 [+] Detail page displays the created record\'s data correctly', { tag: '@smoke' }, async ({ page }) => {
    test.skip(!created, 'depends on TC-BUD-CRUD-01 creating the record first');
    const bud = new BudgetPage(page);
    await bud.gotoView(created.id);

    await expect(page.getByText(data.budgetName).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(data.budgetType).first()).toBeVisible();
    await expect(page.getByText(data.budgetPeriod).first()).toBeVisible();
    await expect(page.getByText(data.budgetMonths).first()).toBeVisible();
    // Confirms the multi-step Select Account flow actually populated real line items (not just
    // the category tab) - Assets' own known sub-accounts should render in the line-items table.
    await expect(page.getByText('Stock').first()).toBeVisible();
    await expect(page.getByText('Fixed Assets').first()).toBeVisible();
    await expect(bud.approvalStatusChipOnView()).toHaveText(/Pending/i);
  });

  test('TC-BUD-CRUD-03 [+] Update the Total Amount and verify it reflects on Detail and Listing', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-BUD-CRUD-01 creating the record first');
    const bud = new BudgetPage(page);
    await bud.gotoEdit(created.id);
    await waitForIdle(page);

    await bud.fillTotalAmount(updatedTotalAmount);
    await bud.save();
    await page.waitForURL(bud.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Reflects on Listing (row still present under the same identifying series number).
    await expect(bud.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    // Reflects on Detail.
    await bud.gotoView(created.id);
    await waitForIdle(page);
    await expect(page.getByText(updatedTotalAmount).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-BUD-L01 [+] Search/filter the list', async ({ page }) => {
    test.skip(!created, 'depends on TC-BUD-CRUD-01 creating the record first');
    const bud = new BudgetPage(page);
    await bud.gotoList();

    await bud.search(created.seriesNumber);
    await expect(bud.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    await bud.search('no-such-budget-zzz-999');
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });

    await bud.search('');
  });

  test('TC-BUD-L02 [+] Sort a column ascending/descending', async ({ page }) => {
    const bud = new BudgetPage(page);
    await bud.gotoList();

    const idColumn = page.getByRole('columnheader', { name: /^ID/i });
    const initialSort = await idColumn.getAttribute('aria-sort');
    expect(initialSort === null || initialSort === 'none').toBeTruthy();

    await bud.sortByColumn(/^ID/i);
    const afterFirstClick = await idColumn.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(afterFirstClick);

    await bud.sortByColumn(/^ID/i);
    const afterSecondClick = await idColumn.getAttribute('aria-sort');
    expect(afterSecondClick).not.toBe(afterFirstClick);
    expect(['ascending', 'descending']).toContain(afterSecondClick);
  });

  test('TC-BUD-L03 [+] Paginate between pages', async ({ page }) => {
    const bud = new BudgetPage(page);
    await bud.gotoList();

    const paginationLabel = page.getByText(/Page\s*1\s*of\s*\d+/i);
    await expect(paginationLabel).toBeVisible({ timeout: 10000 });
    // Settle wait (same pattern used across this suite's other Accounting listing pages) - avoids
    // misreading a still-mid-render "Page 1 of 1" as the real total.
    await page
      .locator('.MuiSkeleton-root, .MuiCircularProgress-root, .MuiLinearProgress-root, [role="progressbar"]')
      .first()
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    const labelText = (await paginationLabel.textContent()) ?? '';
    const totalPages = Number(labelText.match(/of\s*(\d+)/i)?.[1] ?? '1');
    // Confirmed live this environment already has 2 pages of Budget records - no filler-record
    // fallback needed here (unlike the Commission modules' own newer/sparser data).
    test.skip(totalPages < 2, 'only one page of Budget records exists right now - nothing to paginate to');

    await bud.goToPage(2);
    await expect(page.getByText(/Page\s*2\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
  });

  test('TC-BUD-L04 [+] Row action menu reflects status-appropriate actions', async ({ page }) => {
    test.skip(!created, 'depends on TC-BUD-CRUD-01 creating the record first');
    const bud = new BudgetPage(page);
    await bud.gotoList();

    // Confirmed live: a Pending Budget's row menu offers View/Edit/Submit for Approval/Quick
    // Approval/Delete.
    await bud.openRowMenu(created.seriesNumber);
    await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('TC-BUD-L05 [+] Navigation between Listing, Add, Edit, and Detail pages', async ({ page }) => {
    test.setTimeout(45000);
    test.skip(!created, 'depends on TC-BUD-CRUD-01 creating the record first');
    const bud = new BudgetPage(page);
    await bud.gotoList();
    await expect(page).toHaveURL(new RegExp(bud.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));

    await bud.addButton.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(new RegExp(bud.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await bud.discardButton.click().catch(() => {});

    await bud.gotoView(created.id);
    await waitForIdle(page);
    // Confirmed live: unlike Commission modules, Budget's View page has a direct Edit button.
    await expect(page.getByRole('button', { name: /^Edit$/i })).toBeVisible({ timeout: 10000 });

    await bud.gotoEdit(created.id);
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeVisible({ timeout: 10000 });
    await bud.discardButton.click().catch(() => {});
  });

  test('TC-BUD-CRUD-04 [+/-] Delete the created Budget (or confirm the block, whichever this environment enforces)', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-BUD-CRUD-01 creating the record first');
    const bud = new BudgetPage(page);
    await bud.gotoList();
    await bud.openRowMenu(created.seriesNumber);

    const deleteMenuItem = page.getByRole('menuitem', { name: 'Delete', exact: true });
    await expect(deleteMenuItem).toBeVisible({ timeout: 10000 });
    await deleteMenuItem.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: /Delete|Confirm/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await waitForIdle(page);

    // This is this suite's own disposable record (not shared production master data) - verify it
    // no longer appears in the list.
    await bud.search(created.seriesNumber);
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });
    await bud.search('');
  });
});
