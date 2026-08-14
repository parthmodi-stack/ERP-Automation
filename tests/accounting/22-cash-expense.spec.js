const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const CashExpensePage = require('../../pages/accounting/CashExpensePage');

// =============================================================================
// Cash Expense - single-file coverage
// =============================================================================
//
// Cash Expense (Invoice > Cash Expenses) is similar to Purchase Invoice (same Vendor/Payment
// Terms/Currency/Item Entries shape), for an expense paid directly rather than tied to a PO/GRN
// flow:
//
//   TC-CE-LIST-01  Listing page loads with expected Add control
//   TC-CE-ADD-01   Add form required-field validation
//   TC-CE-CRUD-01  Create a Cash Expense with one item entry
//   TC-CE-CRUD-02  Submit For Approval and Accept moves it to Approved

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Cash Expense Management', () => {
  test('TC-CE-LIST-01 [+] Listing page loads with expected Add control', async ({ page }) => {
    const ce = new CashExpensePage(page);
    await ce.gotoList();

    await expect(page.locator('main').getByText('Cash Expense', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(ce.addButton).toBeVisible();
  });

  test('TC-CE-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const ce = new CashExpensePage(page);
    await ce.openAdd();

    await ce.save();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-cash-expense/);
  });
});

test.describe.serial('Cash Expense - Create and Approve', () => {
  const data = testData.accounting.cashExpense;
  const itemEntry = () => ({
    item:        data.item.dropdownOption,
    quantity:    data.item.quantity,
    rate:        data.item.rate,
    taxTemplate: data.item.taxTemplate,
  });

  let createdId;
  let actualVendor;

  test('TC-CE-CRUD-01 [+] Create a Cash Expense with one item entry', async ({ page }) => {
    test.setTimeout(90000);
    const ce = new CashExpensePage(page);

    ({ actualVendor } = await ce.createItemInvoice(
      {
        vendor:          data.vendor,
        currency:        data.currency,
        paymentTerm:     data.paymentTerm,
        vendorInvoiceNo: data.valid.vendorInvoiceNo,
        accountPayable:  data.accountPayable,
        shippingAddress: data.shippingAddress,
      },
      [itemEntry()]
    ));
    expect(actualVendor).toBeTruthy();

    await ce.save();
    // KNOWN ISSUE (paused pending a backend fix): Save silently no-ops here - no toast, no
    // field error, no navigation, even with every visible required field filled (Vendor,
    // Payment Terms, Vendor Invoice No, Currency, Account, Shipping Address, one item entry).
    // Do not "fix" this by guessing at more required fields until confirmed resolved server-side.
    await page.waitForURL(ce.listPath, { timeout: 40000 });
    await waitForIdle(page);

    await ce.openNewestRow();
    createdId = page.url().match(/cash-expenses\/(\d+)\//)?.[1];
    expect(createdId).toBeTruthy();
    await expect(page.getByText(actualVendor).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-CE-CRUD-02 [+] Submit For Approval and Accept moves it to Approved', async ({ page }) => {
    test.setTimeout(90000);
    test.skip(!createdId, 'depends on TC-CE-CRUD-01 creating a Cash Expense first');
    const ce = new CashExpensePage(page);

    await ce.gotoView(createdId);
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });

    // Uses AccountingDocumentPage's own caret-menu approval flow (openSubmitMenu/
    // clickSubmitMenuItem), not a direct click on the page's main "Accept" button - confirmed
    // on Expense Reimbursement's Expense Report page that button is a no-op decoy sitting in the
    // same split-button group as the caret (see acceptApproval()'s doc comment in
    // AccountingDocumentPage.js).
    await ce.quickApproval(testData.accounting.paymentEntry.approverName);
    await waitForIdle(page, 1000);
    await ce.acceptApproval();
    await waitForIdle(page, 1500);

    await expect(ce.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });
  });
});
