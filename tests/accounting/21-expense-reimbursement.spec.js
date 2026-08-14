const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const ExpenseReimbursementPage = require('../../pages/accounting/ExpenseReimbursementPage');
const ChartOfAccountsPage = require('../../pages/accounting/ChartOfAccountsPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Opens a fresh, throwaway tab, creates a Chart of Accounts record with the given
 * parentType/accountType, and closes the tab - same `createIfMissing` fallback pattern
 * AssetManagementPage.createAccountOnNewTab uses, needed here because this environment has no
 * "Cash Account" master data yet for the Payment Entry form's own (mandatory) Cash Account field.
 */
async function createAccountOnNewTab(page, { parentType, accountType, name }) {
  const newTab = await page.context().newPage();
  const coa = new ChartOfAccountsPage(newTab);
  await coa.openAdd();
  await coa.create({ parentType, accountType, name });
  await coa.save();
  await newTab.waitForURL(coa.listPath, { timeout: 15000 });
  await newTab.waitForLoadState('networkidle').catch(() => {});
  await newTab.close();
}

// =============================================================================
// Expense Reimbursement - single-file coverage
// =============================================================================
//
// Expense Reimbursement (Accounting > Expense > Expense Reimbursement) is created here but
// approved from a separate "Expense Report" listing (a sibling nav item under the same Expense
// section), then paid via that same approved report's own Actions -> "Make Payment Entry":
//
//   TC-ER-LIST-01  Listing page loads with expected Add control
//   TC-ER-ADD-01   Add form required-field validation
//   TC-ER-CRUD-01  Create an Expense Reimbursement with a required Expense Entry line item
//   TC-ER-CRUD-02  Locate it on the Expense Report listing, Submit for Approval and Accept
//   TC-ER-CRUD-03  From the approved report, Actions -> Make Payment Entry, pay the line item

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Expense Reimbursement Management', () => {
  test('TC-ER-LIST-01 [+] Listing page loads with expected Add control', async ({ page }) => {
    const er = new ExpenseReimbursementPage(page);
    await er.gotoList();

    await expect(page.locator('main').getByText('Expense Reimbursement', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(er.addButton).toBeVisible();
  });

  test('TC-ER-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const er = new ExpenseReimbursementPage(page);
    await er.openAdd();

    // Client-side validation blocks Save with no fields filled - no request ever fires, so this
    // clicks the button directly rather than via save()'s response-capturing wrapper (which is
    // only meaningful for an actual successful save).
    await er.saveButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-expense-reimbursement/);
  });
});

test.describe.serial('Expense Reimbursement -> Report Approval -> Payment Entry', () => {
  const data = testData.accounting.expenseReimbursement;
  let reportUrl;
  let created;

  // Verifies via the save response's own id/series_number rather than the View page - see
  // ExpenseReimbursementPage.save()'s doc comment for the confirmed FE crash
  // (`data.tax_code_data?.map is not a function`) that blanks that page for every record with a
  // Tax Template on its Expense Entry line (Tax Template is mandatory, so this hits every record).
  test('TC-ER-CRUD-01 [+] Create an Expense Reimbursement with a required Expense Entry line item', async ({ page }) => {
    test.setTimeout(90000);
    const er = new ExpenseReimbursementPage(page);

    await er.createExpenseReimbursement(
      {
        employee:         data.employee,
        journal:          data.journal,
        currency:         data.currency,
        exchangeRate:     data.exchangeRate,
        description:      data.description,
        expenseEntryType: data.expenseEntryType,
      },
      [{ category: data.item.category, taxTemplate: data.item.taxTemplate, amount: data.item.amount, refNumber: data.item.refNumber }]
    );

    created = await er.save();
    expect(created.id).toBeTruthy();
    expect(created.seriesNumber).toBeTruthy();

    await page.waitForURL(er.listPath, { timeout: 20000 });
    await waitForIdle(page);

    // Confirm the record actually landed in the list (list rendering is unaffected by the View
    // page's own crash) by its series_number, rather than opening the row's View page.
    await expect(er.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });
  });

  test('TC-ER-CRUD-02 [+] Locate it on the Expense Report listing, Submit for Approval and Accept', async ({ page }) => {
    test.setTimeout(90000);
    const er = new ExpenseReimbursementPage(page);
    const approverName = testData.accounting.paymentEntry.approverName;

    await er.openNewestReportRow();
    reportUrl = page.url();
    await expect(page.getByText(data.description).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
    // Uses AccountingDocumentPage's own caret-menu approval flow (openSubmitMenu/
    // clickSubmitMenuItem), not a direct click on the page's main "Accept" button - confirmed
    // live that button is a no-op decoy sitting in the same split-button group as the caret (see
    // acceptApproval()'s doc comment); clicking it directly left the record on "Submitted".
    await er.quickApproval(approverName);
    await waitForIdle(page, 1000);
    await er.acceptApproval();
    await waitForIdle(page, 1500);

    await expect(er.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });
  });

  test('TC-ER-CRUD-03 [+] From the approved report, Actions -> Make Payment Entry, pay the line item', async ({ page }) => {
    test.setTimeout(90000);
    test.skip(!reportUrl, 'depends on TC-ER-CRUD-02 approving the report first');

    await page.goto(reportUrl);
    await waitForIdle(page);

    const actionsBtn = page.getByRole('button', { name: /^Actions$/i });
    await expect(actionsBtn).toBeVisible({ timeout: 10000 });
    await actionsBtn.click();
    // Confirmed live: the Actions menu item is labelled exactly "Payment Entry" - a loose
    // /Payment Entry/i match would also hit the sibling "View Payment Entry" item.
    const paymentEntryItem = page.getByRole('menuitem', { name: 'Payment Entry', exact: true });
    await expect(paymentEntryItem).toBeVisible({ timeout: 10000 });
    await paymentEntryItem.click();
    await waitForIdle(page, 1500);
    // Confirms the click actually navigated to a Payment Entry form, not a silent no-op.
    // Confirmed live the real URL is .../expense/payment/add-payment - not a "payment-entry" path.
    await expect(page).toHaveURL(/expense\/payment\/add-payment/i, { timeout: 10000 });

    // Confirmed live: unlike standalone Payment Entry (bank_account_cash/bank/cheque, per type),
    // this screen's field-array prefix is `add_payment_entry` with a single plain `bank_account`
    // field regardless of Cash/Bank/Cheque type - required here even for the default Cash type.
    // Journal is also required and blank by default.
    await selectDropdown(page, page.locator('[id*="mui-component-select-add_payment_entry.journal"]').first(), data.journal, data.journal);
    await page.waitForTimeout(500);
    // This environment has no "Cash Account" master data yet - create one via Chart of Accounts
    // (parentType "Assets" / accountType "Cash") on a throwaway tab if the dropdown comes back
    // empty, same createIfMissing fallback AssetManagementPage's own account fields use.
    const cashAccountName = `Automation_CashAccount_${data.item.refNumber}`;
    await selectDropdown(
      page,
      page.locator('[id*="mui-component-select-add_payment_entry.bank_account"]').first(),
      'Test Acc',
      'Test Acc',
      { createIfMissing: () => createAccountOnNewTab(page, { parentType: 'Assets', accountType: 'Cash', name: cashAccountName }) }
    );
    await page.waitForTimeout(500);

    // Same "linked entries" pattern as Collection Entry's own Invoice Entries: the row's payment
    // amount is NOT directly editable in the table - its pencil/Edit icon opens a small dialog
    // with the real payment_amount field, which needs a blur (Tab) + settle wait before the row
    // total recomputes, and the row's own checkbox must be checked afterward.
    const lineRow = page.locator('table tbody tr').first();
    await expect(lineRow).toBeVisible({ timeout: 10000 });
    await lineRow.locator('button').first().click();
    const rowDialog = page.getByRole('dialog');
    await expect(rowDialog).toBeVisible({ timeout: 10000 });
    const paymentAmountField = rowDialog.locator('[name*="payment_amount"]').first();
    await expect(paymentAmountField).toBeVisible({ timeout: 10000 });
    await paymentAmountField.fill(String(data.item.amount));
    await paymentAmountField.press('Tab');
    await page.waitForTimeout(800);
    await rowDialog.getByRole('button', { name: /^Save$/i }).click();
    await rowDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(500);

    const lineCheckbox = lineRow.locator('input[type="checkbox"]');
    if (await lineCheckbox.isVisible({ timeout: 3000 }).catch(() => false) && !(await lineCheckbox.isChecked())) {
      await lineCheckbox.check();
    }

    // Header "Amount *" mirrors Collection Entry's own required header total - fill it to match
    // what was just applied to the line item.
    const headerAmountField = page.locator('[name="add_payment_entry.amount"]').first();
    if (await headerAmountField.isEditable().catch(() => false)) {
      await headerAmountField.fill(String(data.item.amount));
    }

    const saveBtn = page.locator('button[type="submit"]').last();
    await expect(saveBtn).toBeEnabled({ timeout: 10000 });
    // Captures the save request's own response instead of trusting a URL-change/toast heuristic -
    // "View Payment Entry" was already present in the Actions menu even before this step, so a
    // UI-state comparison can't prove creation; only a successful save response can.
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'POST' && ['xhr', 'fetch'].includes(r.request().resourceType()),
        { timeout: 15000 }
      ),
      saveBtn.click(),
    ]);
    await waitForIdle(page, 1000);
    expect(response.ok(), `expected the Payment Entry save request to succeed (status ${response.status()})`).toBeTruthy();
    const body = await response.json().catch(() => null);
    expect(body?.data, `expected the save response to contain the created record (got: ${JSON.stringify(body)})`).toBeTruthy();
  });
});
