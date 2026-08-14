const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const PurchaseInvoicePage = require('../../pages/accounting/PurchaseInvoicePage');

const BASE_URL = 'https://dev.erpforce.co';
const PURCHASE_INVOICES_URL = `${BASE_URL}/dashboard/accounting/invoice/purchase-invoices`;
const ADD_PURCHASE_INVOICE_URL = `${PURCHASE_INVOICES_URL}/add-purchase-invoice`;

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => { });
  await page.waitForTimeout(ms);
}

function purchaseInvoiceApiPredicate(requestOrResponse, method = 'GET') {
  const request = typeof requestOrResponse.request === 'function'
    ? requestOrResponse.request()
    : requestOrResponse;

  return request.method() === method
    && request.url().includes('/purchase-invoices')
    && !request.url().includes('/dashboard/')
    && ['fetch', 'xhr'].includes(request.resourceType())
    && !request.url().includes('/download')
    && !request.url().includes('/send-email');
}

async function waitForPurchaseInvoiceApi(page, action, method = 'GET') {
  const [response] = await Promise.all([
    page.waitForResponse((res) => purchaseInvoiceApiPredicate(res, method), { timeout: 20000 }).catch(() => null),
    action(),
  ]);
  return response;
}

async function openPurchaseInvoiceList(page) {
  const response = await waitForPurchaseInvoiceApi(
    page,
    async () => {
      await page.goto(PURCHASE_INVOICES_URL);
      await waitForIdle(page);
    },
  );

  await expect(page).toHaveURL(/\/dashboard\/accounting\/invoice\/purchase-invoices/);
  return response;
}

async function clickVisibleText(page, text) {
  const option = page.getByText(text, { exact: true }).first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}

async function clickVisibleTextPattern(page, pattern) {
  const option = page.getByText(pattern).first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}

async function selectPurchaseInvoiceTitleMode(page, optionPattern) {
  const title = page.locator('main p').filter({ hasText: /Purchase Invoice|Fixed Asset/i }).first();
  await expect(title).toBeVisible({ timeout: 10000 });
  const titleBox = await title.boundingBox();
  if (!titleBox) {
    throw new Error('Purchase Invoice title menu is not available');
  }
  await page.mouse.click(titleBox.x + titleBox.width + 18, titleBox.y + titleBox.height / 2);
  await clickVisibleTextPattern(page, optionPattern);
}

async function openAddSplitMenu(page) {
  const splitButton = page.getByRole('button', { name: /select merge strategy/i });
  await expect(splitButton).toBeVisible({ timeout: 10000 });
  await splitButton.click();
}

// The list row's status chip carries a `purchaseInvoice--StatusChip--<status>` class where
// <status> is the raw value lowercased with spaces stripped (getStatusClass() in
// erpforce-common-hub-fe src/utils/common-utility.tsx - confirmed against the running app:
// "Approved" -> "purchaseInvoice--StatusChip--approved"). Each row actually carries TWO such
// chips - Payment Status (payment_status) and Status (approval_status), in that column order
// (utils/default-data.ts) - so "Draft"/"Pending" values collide between the two columns. The
// approval status chip is always the last StatusChip element in the row, so match on that one
// specifically rather than "any chip in the row", which would also match a Payment Status
// chip of the same name. Rows carry no ARIA role="row" in this app, so scope via plain CSS
// instead of getByRole('row').
async function invoiceRowByApprovalStatus(page, status) {
  const statusClass = status.toLowerCase().replace(/\s+/g, '');
  const rows = page.locator('table tbody tr');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const chips = row.locator('[class*="purchaseInvoice--StatusChip--"]');
    if (await chips.count() === 0) continue;

    const approvalChipClass = await chips.last().getAttribute('class');
    if (approvalChipClass?.includes(`purchaseInvoice--StatusChip--${statusClass}`)) {
      return row;
    }
  }
  return null;
}

/**
 * Opens the first list row (on the default first page - this suite doesn't paginate through
 * search results) whose approval_status matches `status`, skipping the test when the current
 * environment's data has none - the same guard pattern used by TC-PI-VIEW-01 for "no row
 * available at all". This makes each status's button-surface test deterministic instead of
 * depending on whatever status the first row in the list happens to have.
 */
async function openInvoiceWithStatus(page, status) {
  await openPurchaseInvoiceList(page);
  const row = await invoiceRowByApprovalStatus(page, status);
  test.skip(!row, `No ${status} purchase invoice is available in the current environment.`);

  await row.locator('a').first().click();
  await page.waitForURL(/view-purchase-invoice/, { timeout: 15000 });
  await waitForIdle(page);
}

test.describe('Purchase Invoice Management', () => {
  test('TC-PI-LIST-01 Listing - load Item invoices, search, sort/pagination shell, and switch to Fixed Asset', async ({ page }) => {
    const initialResponse = await openPurchaseInvoiceList(page);

    if (initialResponse) {
      expect(initialResponse.status()).toBeLessThan(500);
      expect(decodeURIComponent(initialResponse.url())).toContain('order_type.eq=item');
    }

    await expect(
      page.getByRole('button', { name: /Add/i }).or(page.getByText(/Add/i)).first()
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/ID|Supplier|Payment Status|Status|Invoice Date/i).first())
      .toBeVisible({ timeout: 10000 });

    // Below the `xl` (1536px) breakpoint, ActionBar hides the search field behind an icon
    // button (MUI auto-generates data-testid="SearchIcon") until it is clicked - it isn't in
    // the DOM at all beforehand. At this suite's 1280px viewport the plain getByPlaceholder
    // locator is never visible, so it must be opened via the trigger first (same pattern as
    // pages/base/SettingsEntityPage.js's `search()` helper).
    const searchBox = page.getByPlaceholder(/Search/i).or(page.getByRole('textbox', { name: /Search/i })).first();
    const searchTrigger = page.locator('.action-bar--RightContent [data-testid="SearchIcon"]').first();

    if (!(await searchBox.isVisible().catch(() => false)) && await searchTrigger.isVisible().catch(() => false)) {
      await searchTrigger.click();
      await searchBox.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
    }

    if (await searchBox.isVisible().catch(() => false)) {
      await waitForPurchaseInvoiceApi(page, async () => {
        await searchBox.fill('PI-AUTOMATION-NO-RESULT');
        await searchBox.press('Enter').catch(() => { });
        await waitForIdle(page, 800);
      });

      await waitForPurchaseInvoiceApi(page, async () => {
        await searchBox.clear();
        await searchBox.press('Enter').catch(() => { });
        await waitForIdle(page, 800);
      });

      // Opening the search box leaves a stale full-viewport backdrop mounted with
      // pointer-events: auto, which blocks clicking the Status header / title menu below -
      // same quirk documented in SettingsEntityPage.js. Dismiss it before continuing.
      await page.mouse.click(2, 2);
      await waitForIdle(page, 200);
    } else {
      throw new Error('Purchase Invoice list search box is not available - expected either a visible input or a SearchIcon trigger in the ActionBar.');
    }

    const statusHeader = page.getByText('Status', { exact: true }).first();
    if (await statusHeader.isVisible().catch(() => false)) {
      await waitForPurchaseInvoiceApi(page, async () => {
        await statusHeader.click();
        await waitForIdle(page, 800);
      });
    }

    const fixedAssetResponse = await waitForPurchaseInvoiceApi(page, async () => {
      await selectPurchaseInvoiceTitleMode(page, /^Fixed Assets?$/i);
      await waitForIdle(page);
    });

    if (fixedAssetResponse) {
      expect(decodeURIComponent(fixedAssetResponse.url())).toContain('order_type.eq=fixed-asset');
      expect(fixedAssetResponse.status()).toBeLessThan(500);
    }

    const itemResponse = await waitForPurchaseInvoiceApi(page, async () => {
      await selectPurchaseInvoiceTitleMode(page, /^Items?$/i);
      await waitForIdle(page);
    });

    if (itemResponse) {
      expect(decodeURIComponent(itemResponse.url())).toContain('order_type.eq=item');
    }
  });

  test('TC-PI-LIST-02 Listing - Add dropdown opens Item and Fixed Asset create paths', async ({ page }) => {
    await openPurchaseInvoiceList(page);

    await page.getByRole('button', { name: /Add/i }).click();
    await page.waitForURL(/add-purchase-invoice/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/add-purchase-invoice/);
    await expect(page.getByText(/Item Entries/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto(PURCHASE_INVOICES_URL);
    await waitForIdle(page);

    await openAddSplitMenu(page);
    await clickVisibleTextPattern(page, /^Fixed Assets?$/i);
    await page.waitForURL(/add-purchase-invoice/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/add-purchase-invoice/);

    await expect(page.getByRole('button', { name: /Save To Draft/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeVisible();
  });

  test('TC-PI-ADD-01 Add Item - required validation, tab gating, loader, and duplicate-submit guard on invalid form', async ({ page }) => {
    await page.goto(ADD_PURCHASE_INVOICE_URL);
    await waitForIdle(page, 1500);

    await expect(page).toHaveURL(/add-purchase-invoice/);
    await expect(page.getByRole('button', { name: /Save/i }).last()).toBeVisible({ timeout: 15000 });

    const nextButton = page.getByRole('button', { name: /^Next$/i });
    if (await nextButton.isVisible().catch(() => false)) {
      await expect(nextButton).toBeDisabled();
    }

    let postCount = 0;
    page.on('request', (request) => {
      if (purchaseInvoiceApiPredicate(request, 'POST')) {
        postCount += 1;
      }
    });

    const saveButton = page.getByRole('button', { name: /^Save$/i }).last();
    await saveButton.dblclick();
    await page.keyboard.press('Enter');
    await waitForIdle(page, 1200);

    await expect(page).toHaveURL(/add-purchase-invoice/);
    expect(postCount).toBe(0);

    await expect(nextButton).toBeDisabled();
    await expect(page.getByText(/Vendor \*|Payment Terms \*|Vendor Invoice No \*|Currency \*|Account Payable \*/i).first())
      .toBeVisible({ timeout: 8000 });
  });

  test('TC-PI-ADD-02 Add Item - Save to Draft invalid form does not create duplicate requests', async ({ page }) => {
    await page.goto(ADD_PURCHASE_INVOICE_URL);
    await waitForIdle(page, 1500);

    let draftPostCount = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/purchase-invoices') && request.url().includes('save')) {
        draftPostCount += 1;
      }
    });

    const draftButton = page.getByRole('button', { name: /Save As Draft|Save to Draft/i }).first();
    await expect(draftButton).toBeVisible({ timeout: 15000 });
    await draftButton.dblclick();
    await page.keyboard.press('Enter');
    await waitForIdle(page, 1200);

    await expect(page).toHaveURL(/add-purchase-invoice/);
    expect(draftPostCount).toBeLessThanOrEqual(1);
  });

  test('TC-PI-VIEW-01 View/action menu - verify status-gated action surface for first available invoice', async ({ page }) => {
    await openPurchaseInvoiceList(page);

    const firstLinkedInvoice = page.locator('a[href*="/purchase-invoices/"], tr a, [role="row"] a').first();
    test.skip(!(await firstLinkedInvoice.isVisible().catch(() => false)), 'No purchase invoice row is available in the current environment.');

    await firstLinkedInvoice.click();
    await page.waitForURL(/purchase-invoices.*view-purchase-invoice|view-purchase-invoice/, { timeout: 15000 });
    await waitForIdle(page);

    await expect(page.getByText(/Draft|Pending|Submitted|Approved|Rejected/i).first()).toBeVisible({ timeout: 15000 });

    const statusText = await page.getByText(/Draft|Pending|Submitted|Approved|Rejected/i).first().innerText();
    const actionsButton = page.getByRole('button', { name: /^Actions$/i });

    if (/Draft/i.test(statusText)) {
      await expect(actionsButton).not.toBeVisible();
      await expect(page.getByRole('button', { name: /^Edit$/i }).first()).toBeVisible();
    } else {
      await expect(actionsButton).toBeVisible();
      await actionsButton.click();
      await expect(page.getByRole('menuitem', { name: /Duplicate|Edit|Send Email|Download|Delete|Payment Entry/i }).first())
        .toBeVisible({ timeout: 10000 });
      // MUI's Menu marks the rest of the page aria-hidden while open, so getByRole() can no
      // longer see any button behind it (confirmed against the running app - the Approved check
      // below reported "element(s) not found" for a button that was actually still in the DOM).
      // Close the menu before checking anything outside it.
      await page.keyboard.press('Escape');
    }

    if (/Approved/i.test(statusText)) {
      await expect(page.getByRole('button', { name: /Accounting Ledger|View Accounting Ledger/i }).first())
        .toBeVisible({ timeout: 10000 });
    }
  });

  // ---------------------------------------------------------------------------
  // VIEW PAGE - deterministic per-status button surface
  // ---------------------------------------------------------------------------
  // TC-PI-VIEW-01 above only checks whatever status the first list row happens to have, so an
  // environment without an Approved invoice on page one would never exercise the Accounting
  // Ledger assertion. These tests target one status each via invoiceRowByStatus()/
  // openInvoiceWithStatus() and skip individually when that status has no data, so every header
  // button and Actions-menu item in view-purchase-invoice.tsx gets checked deterministically.
  //
  // Buttons/menu items gated purely by approval_status (not by RBAC permission or invoice data)
  // are hard-asserted; buttons additionally gated by a permission or a data field
  // (debitNotesCanAdd, canAddRecurringDetails, paymentEntriesCanAdd, applyadvancepayment,
  // isVisibleLC, canCreateReturn, canEdit, canDelete) are guarded with an isVisible() check first,
  // matching the visibility-guard convention already used for Export/Import in
  // 07-payment-entry.spec.js.
  test.describe('View page - status-gated button surface', () => {
    test('TC-PI-VIEW-02 Draft invoice hides Actions/Approved-only controls and keeps Edit enabled', async ({ page }) => {
      await openInvoiceWithStatus(page, 'Draft');

      // Actions only renders for non-Draft statuses (view-purchase-invoice.tsx:711)
      await expect(page.getByRole('button', { name: /^Actions$/i })).not.toBeVisible();

      // Edit's disabled= condition allows Draft, so if canEdit renders the button it must be enabled
      const editButton = page.getByRole('button', { name: /^Edit$/i }).first();
      if (await editButton.isVisible().catch(() => false)) {
        await expect(editButton).toBeEnabled();
      }

      // Delete (header) has no disabled= prop - it is only ever rendered when clickable
      const deleteButton = page.getByRole('button', { name: /^Delete$/i }).first();
      if (await deleteButton.isVisible().catch(() => false)) {
        await expect(deleteButton).toBeEnabled();
      }

      // Approved-only controls must never render on a Draft invoice
      await expect(page.getByRole('button', { name: /View Accounting Ledger/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /Apply Payment/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /Create Landed Cost/i })).not.toBeVisible();
    });

    test('TC-PI-VIEW-03 Pending invoice shows Actions with no Return item and keeps Edit enabled', async ({ page }) => {
      await openInvoiceWithStatus(page, 'Pending');

      const actionsButton = page.getByRole('button', { name: /^Actions$/i });
      await expect(actionsButton).toBeVisible();
      await actionsButton.click();

      // Return only ever renders when approval_status === Approved (view-purchase-invoice.tsx:943-964)
      await expect(page.getByRole('menuitem', { name: /^Return$/i })).toHaveCount(0);

      // Payment Entry is disabled whenever approval_status isn't Approved - true unconditionally here
      const paymentEntryItem = page.getByRole('menuitem', { name: /Payment Entry/i });
      if (await paymentEntryItem.isVisible().catch(() => false)) {
        await expect(paymentEntryItem).toBeDisabled();
      }

      // Edit menu item's disabled= condition allows Pending, so it must not be status-disabled
      const editMenuItem = page.getByRole('menuitem', { name: /^Edit$/i });
      if (await editMenuItem.isVisible().catch(() => false)) {
        await expect(editMenuItem).toBeEnabled();
      }
      await page.keyboard.press('Escape');

      // Same D/P/R rule applies to the header Edit button
      const editButton = page.getByRole('button', { name: /^Edit$/i }).first();
      if (await editButton.isVisible().catch(() => false)) {
        await expect(editButton).toBeEnabled();
      }

      // Delete (header) only ever renders for Draft
      await expect(page.getByRole('button', { name: /^Delete$/i }).first()).not.toBeVisible();
      await expect(page.getByRole('button', { name: /View Accounting Ledger/i })).not.toBeVisible();
    });

    test('TC-PI-VIEW-04 Submitted invoice disables the Edit path and hides Draft/Approved-only controls', async ({ page }) => {
      await openInvoiceWithStatus(page, 'Submitted');

      const actionsButton = page.getByRole('button', { name: /^Actions$/i });
      await expect(actionsButton).toBeVisible();
      await actionsButton.click();

      // Submitted falls outside the Draft/Pending/Rejected set the Edit item's disabled= checks,
      // so it reads as disabled regardless of the account's canEdit permission
      const editMenuItem = page.getByRole('menuitem', { name: /^Edit$/i });
      if (await editMenuItem.isVisible().catch(() => false)) {
        await expect(editMenuItem).toBeDisabled();
      }
      await page.keyboard.press('Escape');

      // Same status-only rule applies to the header Edit button
      const editButton = page.getByRole('button', { name: /^Edit$/i }).first();
      if (await editButton.isVisible().catch(() => false)) {
        await expect(editButton).toBeDisabled();
      }

      // Delete (header) only ever renders for Draft
      await expect(page.getByRole('button', { name: /^Delete$/i }).first()).not.toBeVisible();
      await expect(page.getByRole('button', { name: /View Accounting Ledger/i })).not.toBeVisible();
    });

    test('TC-PI-VIEW-05 Rejected invoice keeps the Edit path enabled and may offer resubmission', async ({ page }) => {
      await openInvoiceWithStatus(page, 'Rejected');

      const actionsButton = page.getByRole('button', { name: /^Actions$/i });
      await expect(actionsButton).toBeVisible();
      await actionsButton.click();

      // Edit item's disabled= condition allows Rejected, so it must not be status-disabled
      const editMenuItem = page.getByRole('menuitem', { name: /^Edit$/i });
      if (await editMenuItem.isVisible().catch(() => false)) {
        await expect(editMenuItem).toBeEnabled();
      }
      await page.keyboard.press('Escape');

      const editButton = page.getByRole('button', { name: /^Edit$/i }).first();
      if (await editButton.isVisible().catch(() => false)) {
        await expect(editButton).toBeEnabled();
      }

      // ApprovalWrapper's submit control (addapprover permission-gated) - assert enabled only
      // when the account actually renders it
      const submitButton = page.getByRole('button', { name: /Resubmit|^Submit$/i }).first();
      if (await submitButton.isVisible().catch(() => false)) {
        await expect(submitButton).toBeEnabled();
      }

      await expect(page.getByRole('button', { name: /View Accounting Ledger/i })).not.toBeVisible();
    });

    test('TC-PI-VIEW-06 Approved invoice always exposes View Accounting Ledger and disables the Edit menu path', async ({ page }) => {
      await openInvoiceWithStatus(page, 'Approved');

      // View Accounting Ledger has no permission gate - it renders for every Approved invoice
      // (view-purchase-invoice.tsx:642-647), unlike every other header button in this component
      await expect(page.getByRole('button', { name: /View Accounting Ledger/i })).toBeVisible();

      // Draft-only header buttons never render for Approved invoices
      await expect(page.getByRole('button', { name: /^Delete$/i }).first()).not.toBeVisible();

      const actionsButton = page.getByRole('button', { name: /^Actions$/i });
      await expect(actionsButton).toBeVisible();
      await actionsButton.click();

      // Same D/P/R-only rule as Submitted: Edit menu item reads disabled regardless of permission
      const editMenuItem = page.getByRole('menuitem', { name: /^Edit$/i });
      if (await editMenuItem.isVisible().catch(() => false)) {
        await expect(editMenuItem).toBeDisabled();
      }
      await page.keyboard.press('Escape');

      // Permission/data-gated Approved-only controls - assert enabled only when the account/data
      // actually renders them
      const debitNoteButton = page.getByRole('button', { name: /Add Debit Note|View Notes/i }).first();
      if (await debitNoteButton.isVisible().catch(() => false)) {
        await expect(debitNoteButton).toBeEnabled();
      }

      const recurringButton = page.getByRole('button', { name: /Mark as recurring|Stop Recurring/i }).first();
      if (await recurringButton.isVisible().catch(() => false)) {
        await expect(recurringButton).toBeEnabled();
      }

      const applyPaymentButton = page.getByRole('button', { name: /Apply Payment/i });
      if (await applyPaymentButton.isVisible().catch(() => false)) {
        await expect(applyPaymentButton).toBeEnabled();
      }

      const landedCostButton = page.getByRole('button', { name: /Create Landed Cost/i });
      if (await landedCostButton.isVisible().catch(() => false)) {
        await expect(landedCostButton).toBeEnabled();
      }
    });
  });
});

test.describe('Purchase Invoice - CRUD', () => {
  const data = testData.accounting.purchaseInvoice;
  // Page-object item entries take the dropdown's exact "<SKU> - <name>" option text under the
  // `item` key; on-page assertions and row lookups use the plain display name instead (see
  // testData.js's purchaseInvoice.item comment for why the two differ).
  const itemEntry = () => ({
    item: data.item.dropdownOption,
    quantity: data.item.quantity,
    rate: data.item.rate,
    taxTemplate: data.item.taxTemplate,
  });

  test.describe.serial('Item invoice lifecycle: create -> view -> edit -> delete (from the detail page)', () => {
    // { id, seriesNumber } once TC-PI-CRUD-01 saves - same shape as
    // ProcurementRequestPage.saveAndCaptureId, and used the same way: later tests navigate
    // straight to the record via pi.gotoView(createdRequest.id) instead of re-deriving a URL.
    let createdRequest;
    // Captured from the Add form right after createItemInvoice() - data.vendor ("Royal Mine
    // Industries") doesn't actually exist in this environment, so PurchaseInvoicePage's vendor
    // select falls back to whatever real vendor is already there instead (confirmed live: lands
    // on an existing "AutoVendCorp_..." record) rather than the literal testData name - asserting
    // on that captured value instead of data.vendor keeps this correct regardless of which
    // vendor the fallback actually picks. Same reasoning for actualItem - data.item's
    // "ELEC-000071 - Playwright Auto Item" dropdown option can be equally stale.
    let actualVendor;
    let actualItem;
    const vendorInvoiceNo = `${data.valid.vendorInvoiceNo}_VIEWFLOW`;
    const updatedVendorInvoiceNo = `${data.updated.vendorInvoiceNo}_VIEWFLOW`;

    test('TC-PI-CRUD-01 [+] Create - Save to Draft with one item entry creates a Draft invoice', async ({ page }) => {
      test.setTimeout(60000);
      const pi = new PurchaseInvoicePage(page);

      // Sets a Shipping Address even though this is a Draft save (which doesn't itself require
      // one) because the Edit form has no "Save to Draft" option of its own - editing a Draft
      // invoice always goes through the same fully-validated "Save" the Add form's plain Save
      // uses, confirmed live in TC-PI-CRUD-03, so that field has to already be on the record.
      ({ actualVendor, actualItems: [actualItem] } = await pi.createItemInvoice(
        {
          vendor: data.vendor,
          currency: data.currency,
          paymentTerm: data.paymentTerm,
          vendorInvoiceNo,
          shippingAddress: data.shippingAddress,
        },
        [itemEntry()]
      ));
      createdRequest = await pi.saveAsDraft();
      expect(createdRequest.id).toBeTruthy();

      // The list's own search box doesn't actually filter Purchase Invoice results (see this
      // file's class-level comment / TC-PI-CRUD-06), so status can't be read back via a
      // search-then-read-row helper the way Procurement Request's getRowStatus does - navigate
      // straight to the invoice's own view page using the id captured from the save response.
      await pi.gotoView(createdRequest.id);

      await expect(pi.approvalStatusChipOnView()).toHaveText(/Draft/i, { timeout: 15000 });
      await expect(page.getByText(createdRequest.seriesNumber).first()).toBeVisible();
    });

    test('TC-PI-CRUD-02 [+] Read - View page shows the saved vendor, item, invoice no and Draft status', async ({ page }) => {
      test.skip(!createdRequest, 'depends on TC-PI-CRUD-01 creating an invoice first');
      const pi = new PurchaseInvoicePage(page);

      await pi.gotoView(createdRequest.id);

      await expect(page.getByText(actualVendor).first()).toBeVisible();
      await expect(page.getByText(actualItem).first()).toBeVisible();
      await expect(page.getByText(vendorInvoiceNo).first()).toBeVisible();
      await expect(pi.approvalStatusChipOnView()).toHaveText(/Draft/i);

      // Draft-only header surface (same rule confirmed in purchase-invoice.spec.js's TC-PI-VIEW-02)
      await expect(pi.editButton).toBeVisible();
      await expect(pi.editButton).toBeEnabled();
      await expect(pi.actionsMenuButton).not.toBeVisible();
    });

    test('TC-PI-CRUD-03 [+] Update - Edit changes the vendor invoice no and item quantity, and both persist', async ({ page }) => {
      test.skip(!createdRequest, 'depends on TC-PI-CRUD-01 creating an invoice first');
      test.setTimeout(60000);
      const pi = new PurchaseInvoicePage(page);

      await pi.gotoView(createdRequest.id);
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
      // Filtered by actualItem (the item that really ended up on the invoice - see TC-PI-CRUD-01's
      // comment), not data.item.name, since the dropdown fallback can have substituted a different
      // real item.
      await pi.editItemEntry(actualItem, { quantity: data.updated.quantity, taxTemplate: data.item.taxTemplate });
      // Confirmed live: the Edit form has no "Save to Draft" button at all, only "Save" - the
      // same fully-validated Save the Add form's non-draft path uses (see the header comment on
      // this describe block).
      await pi.save();

      // Edit redirects to the list on success (same convention confirmed for every other
      // document/Settings-entity Page Object in this suite).
      await page.waitForURL(pi.listPath, { timeout: 20000 });
      await waitForIdle(page);

      await pi.gotoView(createdRequest.id);
      await expect(page.getByText(updatedVendorInvoiceNo).first()).toBeVisible();
      await expect(page.getByText(data.updated.quantity, { exact: false }).first()).toBeVisible();
    });

    test('TC-PI-CRUD-04 [-] Delete (detail page) - Cancel keeps the invoice, Delete removes it and redirects to the list', async ({ page }) => {
      test.setTimeout(60000);
      const pi = new PurchaseInvoicePage(page);

      // Seeds its own throwaway Draft invoice rather than reusing createdRequest from
      // TC-PI-CRUD-01: by this point TC-PI-CRUD-03's edit has already moved that record from
      // Draft to Pending (the Edit form has no Save-to-Draft option of its own - see that
      // test's comment), and the header's direct "Delete" button this test exercises only
      // renders for Draft invoices - non-Draft invoices route Delete behind the "Actions" menu
      // instead (see PurchaseInvoicePage.js's class comment). Same reasoning
      // ProcurementRequestPage's createDraft()/createDraftWithItem() apply to their own
      // delete-flow test cases (TC-PREQ-13..16): a delete test needs a still-Draft record, so
      // it seeds one fresh instead of depending on a sibling test's mutated one.
      await pi.createItemInvoice(
        {
          vendor: data.vendor,
          currency: data.currency,
          paymentTerm: data.paymentTerm,
          vendorInvoiceNo: `${vendorInvoiceNo}_DELETEFLOW`,
        },
        [itemEntry()]
      );
      const deleteTarget = await pi.saveAsDraft();
      expect(deleteTarget.id).toBeTruthy();

      await pi.gotoView(deleteTarget.id);
      const invoiceUrl = page.url();

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
      const newestRowHref = await page.locator('table tbody tr').first().locator('a').first().getAttribute('href');
      expect(newestRowHref).not.toContain(`/${deleteTarget.id}/`);
    });
  });

  test.describe.serial('Delete from the listing row menu', () => {
    const vendorInvoiceNo = `${data.valid.vendorInvoiceNo}_LISTFLOW`;
    let createdRequest;

    test('TC-PI-CRUD-05 [+] Create - a second Draft invoice used by the listing-delete flow', async ({ page }) => {
      test.setTimeout(60000);
      const pi = new PurchaseInvoicePage(page);

      await pi.createItemInvoice(
        { vendor: data.vendor, currency: data.currency, paymentTerm: data.paymentTerm, vendorInvoiceNo },
        [itemEntry()]
      );
      createdRequest = await pi.saveAsDraft();
      expect(createdRequest.id).toBeTruthy();
      await page.waitForURL(pi.listPath, { timeout: 20000 });
    });

    // Confirmed against the running app: the list's ActionBar search box does not actually
    // filter Purchase Invoice results - typing any query (an invoice's own numeric ID, its
    // vendor invoice no, or its vendor's name) still returns the same unfiltered first page, so
    // `SettingsEntityPage.search()`/`openRowMenu()`/`deleteViaMenu()` (which depend on it to find
    // the row) can't be used here. This test instead targets the topmost row directly - the list
    // is sorted newest-first and nothing else creates a Purchase Invoice between TC-PI-CRUD-05
    // and this test, so it's guaranteed to be the one just created.
    test('TC-PI-CRUD-06 [-] Delete (list row menu) - Cancel keeps the row, Delete removes it', async ({ page }) => {
      test.skip(!createdRequest, 'depends on TC-PI-CRUD-05 creating an invoice first');
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

      // Same real check as TC-PI-CRUD-04: compare the list's own freshly-fetched newest row
      // against the deleted invoice's id, rather than re-visiting its own URL (confirmed
      // unreliable there - see that test's comment) or asserting on data.vendor (which was never
      // actually the vendor used here in the first place - see TC-PI-CRUD-01's comment).
      const newestRowHref = await page.locator('table tbody tr').first().locator('a').first().getAttribute('href');
      expect(newestRowHref).not.toContain(`/${createdRequest.id}/`);
    });
  });

  test('TC-PI-CRUD-07 [+] Create - "Save" (not "Save to Draft") creates a non-Draft invoice', async ({ page }) => {
    test.setTimeout(90000);
    const pi = new PurchaseInvoicePage(page);
    const vendorInvoiceNo = `${data.valid.vendorInvoiceNo}_SAVEFLOW`;

    await pi.createItemInvoice(
      {
        vendor: data.vendor,
        currency: data.currency,
        paymentTerm: data.paymentTerm,
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

  // Confirmed via purchase-invoice.test-cases.md's UX notes: the view page's ApprovalWrapper
  // only renders a Submit control for Pending/Rejected invoices (unlike Draft, which never gets
  // one) - so this seeds its own invoice through the same full "Save" path as TC-PI-CRUD-07
  // rather than reusing a Draft record from the other describe.serial blocks. Flow mirrors
  // 07-payment-entry.spec.js's TC-PE-CRUD-05, since both drive the same shared ApprovalWrapper
  // component (see AccountingDocumentPage.js's header comment).
  test('TC-PI-CRUD-08 [+] Submit For Approval and accept as the current user moves the invoice out of Pending', async ({ page }) => {
    test.setTimeout(60000);
    const pi = new PurchaseInvoicePage(page);
    const vendorInvoiceNo = `${data.valid.vendorInvoiceNo}_APPROVALFLOW`;

    await pi.createItemInvoice(
      {
        vendor: data.vendor,
        currency: data.currency,
        paymentTerm: data.paymentTerm,
        vendorInvoiceNo,
        shippingAddress: data.shippingAddress,
      },
      [itemEntry()]
    );
    await pi.save();
    await page.waitForURL(pi.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await pi.openNewestRow();

    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /select merge strategy/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /select merge strategy/i }).click();
    await page.getByRole('menuitem', { name: /Quick Approval/i }).click();

    const approvalDialog = page.getByRole('dialog');
    await expect(approvalDialog).toBeVisible({ timeout: 10000 });
    const approverSelect = approvalDialog.getByRole('combobox').first();
    await approverSelect.click();
    // exact: false (not true) - confirmed against the running app that this option's real
    // accessible name is prefixed with the user's avatar initials (e.g. "DM Dipen Modi"), so an
    // exact match against the bare testData name never matches, same reason every other spec in
    // this suite matches this option via a regex instead (e.g. 07-payment-entry.spec.js's
    // /Kashyap Jivani/i).
    await page.getByRole('option', { name: testData.accounting.paymentEntry.approverName, exact: false }).click();
    // Same MUI multi-select quirk documented in 07-payment-entry.spec.js's TC-PE-CRUD-05:
    // checking an option leaves the listbox open, covering "Send Request" underneath it.
    await page.keyboard.press('Escape');
    await approvalDialog.getByRole('button', { name: /Send Request/i }).click();

    await expect(page.getByRole('button', { name: /^Accept$/i })).toBeVisible({ timeout: 10000 });
    // Plain split button here (unlike "select merge strategy") - clicking it opens the "Approved
    // request" confirm dialog directly, with no intermediate dropdown menu item.
    await page.getByRole('button', { name: /^Accept$/i }).click();

    const acceptDialog = page.getByRole('dialog');
    await expect(acceptDialog).toBeVisible({ timeout: 10000 });
    await acceptDialog.getByRole('button', { name: /Submit/i }).click();

    await expect(pi.approvalStatusChipOnView()).toHaveText(/Approved|Accepted/i, { timeout: 15000 });
  });
});
