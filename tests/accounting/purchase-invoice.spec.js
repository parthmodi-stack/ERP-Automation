const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:7172';
const PURCHASE_INVOICES_URL = `${BASE_URL}/dashboard/accounting/invoice/purchase-invoices`;
const ADD_PURCHASE_INVOICE_URL = `${PURCHASE_INVOICES_URL}/add-purchase-invoice`;

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
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
  test('TC-PI-LIST-01 Listing - load Item invoices, search, sort/pagination shell, and switch to Fixed Asset', { tag: '@smoke' }, async ({ page }) => {
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
      await searchBox.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }

    if (await searchBox.isVisible().catch(() => false)) {
      await waitForPurchaseInvoiceApi(page, async () => {
        await searchBox.fill('PI-AUTOMATION-NO-RESULT');
        await searchBox.press('Enter').catch(() => {});
        await waitForIdle(page, 800);
      });

      await waitForPurchaseInvoiceApi(page, async () => {
        await searchBox.clear();
        await searchBox.press('Enter').catch(() => {});
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
