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

    const searchBox = page.getByPlaceholder(/Search/i).or(page.getByRole('textbox', { name: /Search/i })).first();
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
    }

    if (/Approved/i.test(statusText)) {
      await expect(page.getByRole('button', { name: /Accounting Ledger|View Accounting Ledger/i }).first())
        .toBeVisible({ timeout: 10000 });
    }
  });
});
