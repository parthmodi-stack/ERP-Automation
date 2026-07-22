const { test, expect } = require('@playwright/test');

// ─── Configuration ───────────────────────────────────────────────────────────
const REQUESTS_URL = '/dashboard/procurement/requests';

// Test data — references existing master data in the app (not created by this test)
const PURCHASE_REP = 'QA Nikita';
const VENDOR       = 'PC new Vendor';
const LOCATION     = 'Almeda';
const DEPARTMENT   = 'parth';
const QUANTITY     = '10';
const RATE         = '100';
const APPROVER     = 'Parth regression'; // currently logged-in user — must self-approve to complete the flow in one session

test.describe('Procurement Request Flow', () => {

  test('TC-PROC-01 [+] Create, submit, and approve a procurement request', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90000); // multi-stage flow: create → submit → approve

    // Step 1: Navigate to Requests list and open Add form
    await page.goto(REQUESTS_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page).toHaveURL(/add-requests/);

    // Step 2: Select Purchase Representative
    await page.getByRole('combobox', { name: 'Search Purchase Representative' }).click();
    await page.getByText(PURCHASE_REP, { exact: true }).click();

    // Step 3: Select Vendor
    await page.getByRole('combobox', { name: 'Search Vendor' }).click();
    await page.getByText(VENDOR, { exact: true }).click();

    // Step 4: Select Location
    // NOTE: this env has an untranslated locale key on the header Location
    // label ("crm.salesOrder.fields.location_label" instead of "Location"),
    // so match loosely on "location" instead of the exact expected text.
    // The dropdown's default (unfiltered) view only renders its most recent
    // ~25 records - the inventory suite's own repeated runs create a new
    // "Test_Location_Playwright_UPDATED_*" location every time, which has
    // buried "Almeda" out of that default view. Type into the combobox to
    // filter down to it instead of relying on it being in the default list.
    await page.getByRole('combobox', { name: /search.*location/i }).first().click();
    // Focus only lands on the dropdown's inner filter input a moment after
    // the click opens it - typing immediately can land on the wrong element.
    await page.waitForTimeout(500);
    await page.keyboard.type(LOCATION);
    await page.waitForTimeout(800);
    await page.getByText(LOCATION, { exact: true }).first().click();

    // Step 5: Select Department
    await page.getByRole('combobox', { name: 'Search Department' }).first().click();
    await page.getByText(DEPARTMENT, { exact: true }).first().click();

    // Step 6: Open the Add Item modal
    // NOTE: the button's accessible name is just "Add" — the "+" is decorative.
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Step 7: Select any available item — the exact item doesn't matter for
    // this flow. The first "option" in the listbox is actually the search
    // box itself (its accessible name mirrors whatever was typed into it),
    // and the next is the disabled "Select Item" placeholder, so skip both
    // and pick the first real, enabled entry.
    const itemDialog = page.getByRole('dialog', { name: 'Edit Item' });
    await itemDialog.getByRole('combobox', { name: 'Search Item' }).click();
    const itemOption = page.getByRole('listbox')
      .locator('li[role="option"]:not([aria-disabled="true"])')
      .filter({ hasNot: page.locator('input') })
      .first();
    const itemName = await itemOption.textContent();
    await itemOption.click();
    console.log(`  → Selected item: ${itemName}`);

    // Step 8: Fill Quantity and Rate
    // These fields have no <label> wrapper (a heading <p> followed by a
    // sibling containing the input), and getByLabel('Quantity')/('Rate')
    // collide with the table's "Sort by Quantity/Rate" aria-labels, so scope
    // to the dialog and walk from the field's heading paragraph instead.
    const fillLineItemField = (label, value) =>
      itemDialog.locator('p', { hasText: label, exact: true })
        .locator('xpath=following-sibling::*[1]')
        .getByRole('spinbutton')
        .fill(value);

    await fillLineItemField('Quantity *', QUANTITY);
    await fillLineItemField('Rate *', RATE);

    // Step 9: Select Location and Department for the line item
    // Scoped to the item dialog — the header form has its own "Classification"
    // section title that also matches an unscoped text locator. The option
    // click is scoped to the currently open listbox rather than page-wide
    // text + .last(), since the header's already-selected Location/Department
    // values are also plain visible text and can outrank the real option.
    await itemDialog.getByText('classification', { exact: true }).scrollIntoViewIfNeeded();
    await itemDialog.getByRole('combobox', { name: 'Search Location' }).click();
    // Same default-list-is-buried issue as the header Location field above -
    // type to filter down to it instead of relying on the default list.
    // (Same focus-lands-late timing as above - wait before typing.)
    await page.waitForTimeout(500);
    await page.keyboard.type(LOCATION);
    await page.waitForTimeout(800);
    await page.getByRole('listbox').getByText(LOCATION, { exact: true }).click();
    await itemDialog.getByRole('combobox', { name: 'Search Department' }).click();
    await page.getByRole('listbox').getByText(DEPARTMENT, { exact: true }).click();

    // Step 10: Save the item modal
    await page.getByRole('button', { name: 'Save' }).click();

    // Step 11: Save the request
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/requests$/);

    // Step 12: Open the newly created request (most recent row)
    // NOTE: clicking td.nth(1) (the checkbox column) never navigates anywhere,
    // it just leaves the assertion below trivially true on the list page
    // itself (which always shows some "Pending" row). Click the row's actual
    // ID link instead, and confirm arrival via the Submit button.
    await page.locator('table tbody tr').first().getByRole('link').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();

    // Step 13: Submit for Quick Approval
    await page.locator('button:has-text("Submit") + button').click();
    await page.getByText('Quick Approval').click();

    // Step 14: Select approver and send
    // This is a checkbox multi-select — it stays open after picking an
    // option, covering the Send Request button, so it must be explicitly
    // closed (Escape) before that button becomes clickable.
    const approvalDialog = page.getByRole('dialog', { name: 'Quick Approval' });
    await approvalDialog.getByRole('combobox', { name: 'Select' }).click();
    await page.getByRole('listbox').getByText(APPROVER, { exact: true }).click();
    await page.keyboard.press('Escape');
    await approvalDialog.getByRole('button', { name: 'Send Request' }).click();
    await expect(page.getByText('Pending Approval').first()).toBeVisible();

    // Step 15: Accept the request
    await page.locator('button:has-text("Accept") + button').click();
    await page.getByRole('menuitem', { name: 'Accept', exact: true }).click();
    await page.getByRole('button', { name: 'Submit' }).click();

    // Step 16: Verify final status
    await expect(page.getByText('In Progress').first()).toBeVisible();
  });
});
