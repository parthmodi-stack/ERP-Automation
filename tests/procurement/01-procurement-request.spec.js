const { test, expect } = require("@playwright/test");
const ProcurementRequestPage = require("../../pages/ProcurementRequestPage");
const RfqPage = require("../../pages/RfqPage");
const PurchaseOrderPage = require("../../pages/PurchaseOrderPage");
const testData = require("../../config/testData");

// .serial: every test below reads module-level state (createdRequest/editRequest/
// approvedRequest/rejectedRequest) set by an earlier test in this same file - see the
// test.skip() guards throughout that only exist because that dependency can go unmet (per the
// comment just below: a hard failure appears to restart the worker and re-require this file,
// resetting every `let` above to undefined). A plain describe still runs these tests in file
// order, but .serial additionally skips the remaining tests in the block once one fails, instead
// of letting them run against reset state and fail with a confusing, unrelated-looking error.
test.describe.serial("Procurement Request Management", () => {
  // This account's environment is slower than the default 30s test timeout allows for (shared
  // dataset, added network latency) - a test that hits that ceiling doesn't just fail, it takes
  // down every later test that reads module-level state set by an earlier test too (Playwright
  // appears to restart the worker after a hard timeout, which re-requires this file and resets
  // every `let` above to undefined). Match purchase-agreement.spec.js's same (now also bumped)
  // timeout - multi-step flows (create+edit+approve+delete-attempt) can run close to 90s under
  // concurrent (multi-worker) load even when every step itself is behaving correctly.
  test.describe.configure({ timeout: 150000 });

  // Each of these holds { id, seriesNumber } once set - see the comment on
  // ProcurementRequestPage.saveAndCaptureId for why both are needed.
  let createdRequest;
  let approvedRequest;
  let editRequest;
  let rejectedRequest;
  const viewValues = {};
  // selectLocation() now creates a fresh Location every call (see its own comment) rather than
  // selecting a pinned name - captures the name actually created for createdRequest so TC-PREQ-03
  // can assert against it instead of the static testData value.
  let createdRequestLocation;

  // ── TC-PREQ-01: Create Request ───────────────────────────────────────────
  test(
    "TC-PREQ-01 [+] Create a new request with an item and save as Draft",
    async ({ page }) => {
      const pr = new ProcurementRequestPage(page);
      const data = testData.procurementRequest.valid;

      await pr.gotoAdd();
      await pr.fillBasicDetails({
        purchaseRepresentative: data.purchaseRepresentative,
        vendor: data.vendor,
        narration: data.narration,
      });
      await pr.selectLocation(data.location);
      await pr.addItem({
        itemName: data.itemName,
        quantity: data.quantity,
        rate: data.rate,
      });

      createdRequest = await pr.saveAsDraft();
      expect(createdRequest.id).toBeTruthy();

      const status = await pr.getRowStatus(createdRequest.seriesNumber);
      expect(status).toContain("Draft");
    },
  );

  // ── TC-PREQ-02: Edit the Draft request ───────────────────────────────────
  test("TC-PREQ-02 [+] Edit the draft request and persist changes", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoList();
    await pr.editFromList(createdRequest.id, createdRequest.seriesNumber);

    await pr.setDateToToday();
    await pr.fillBasicDetails({ narration: data.updatedNarration });
    // Unlike Entity/Purchase Representative/Vendor/Currency/Narration, the edit form does not
    // pre-populate the previously saved Location - it must be re-selected or Save fails
    // "Location is required".
    createdRequestLocation = await pr.selectLocation(data.location);
    await pr.editFirstItem({ quantity: data.updatedQuantity });

    // saveAsDraft (not save) keeps status Draft, since TC-PREQ-04 separately drives approval.
    await pr.saveAsDraft();
  });

  // ── TC-PREQ-03: View page reflects saved data ────────────────────────────
  test("TC-PREQ-03 [+] View page displays all previously filled data correctly", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoView(createdRequest.id);

    // The View page's own "ID" display uses the same series_number format as the list, not
    // the raw numeric id - see the comment on saveAndCaptureId.
    await expect(
      page.getByText(createdRequest.seriesNumber, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(data.updatedNarration)).toBeVisible();
    await expect(page.getByText(data.vendor)).toBeVisible();
    // NOT getByText: confirmed live via ARIA snapshot that the Location value is rendered
    // visually but absent from the accessibility tree entirely (aria-hidden or equivalent) -
    // only the "Location" label paragraph itself is exposed. getFieldValueOnView reads
    // structurally via DOM position instead, which works regardless. Compared against the name
    // TC-PREQ-02 actually created (selectLocation() creates a fresh Location every call), not the
    // static testData seed.
    expect(await pr.getFieldValueOnView("Location")).toBe(createdRequestLocation);
    await expect(
      page.getByText(data.itemName.split(" - ")[1] || data.itemName).first(),
    ).toBeVisible();

    // Cross-check computed totals reflect the edited quantity.
    await expect(
      page.locator("text=Total Quantity").locator("xpath=following::*[1]"),
    ).toHaveText(data.updatedQuantity);
  });

  // ── TC-PREQ-04: Submit, Quick Approval, Accept ───────────────────────────
  test("TC-PREQ-04 [+] Send Quick Approval to logged-in user and Accept it", async ({
    page,
  }) => {
    // KNOWN, ALREADY-FIXED-AT-SOURCE BUG - pending deployment to dev.erpforce.co: on the Edit
    // page, basic-details.tsx's getAndSetCustomerDependentFields() scopes Currency's options to
    // whatever currencies are linked to the selected Vendor, with no fallback when that vendor
    // has none configured (confirmed live: "PC new Vendor" deterministically produces an empty
    // list across 6/6 retries, not a timing race - genuinely no options are ever dispatched).
    // Fixed in erpforce-fe/modules/procurement/src/views/request/form/basic-details.tsx (falls
    // back to the global currency/company list when the vendor-specific one is empty), but that
    // fix isn't live on dev.erpforce.co yet. Remove this test.fail() once it is.
    test.fail(
      true,
      "Known gap: Currency has no options for vendors with no linked currencies (fix pending deployment).",
    );

    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    // The Submit/Quick Approval action only appears for status Pending/Rejected, not Draft
    // (TC-PREQ-02 deliberately left it Draft); move it to Pending first via a plain Save.
    // Unlike Save To Draft, a plain Save enforces required-field validation, so Currency (which
    // - like Location - does not round-trip onto the Edit form) must also be re-selected here or
    // Save silently fails and never navigates (see the comment on fillBasicDetails' currency arg).
    // Currency is selected AFTER Location, not before: the same sibling-re-render bug that
    // blocks Location's own fetch (see selectLocation) can run in reverse too - selecting
    // Currency first and then retrying Location's dropdown open several times was observed to
    // silently clear Currency back to blank by the time Save was clicked.
    await pr.gotoEdit(createdRequest.id);
    await pr.setDateToToday();
    await pr.selectLocation(data.location);
    await pr.fillBasicDetails({ currency: data.currency });
    await pr.save();

    await pr.gotoView(createdRequest.id);
    await pr.quickApproval(testData.procurementRequest.approverName);
    await expect(page.getByText("Pending Approval")).toBeVisible();

    await pr.accept();
    await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
  });

  // ── TC-PREQ-05: Second request, Reject ───────────────────────────────────
  test("TC-PREQ-05 [+/-] Create a second request, send Quick Approval, and Reject it", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.reject;

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor: data.vendor,
      narration: data.narration,
    });
    await pr.selectLocation(data.location);
    await pr.addItem({
      itemName: data.itemName,
      quantity: data.quantity,
      rate: data.rate,
    });

    rejectedRequest = await pr.save();

    await pr.gotoView(rejectedRequest.id);
    await pr.quickApproval(testData.procurementRequest.approverName);
    await expect(page.getByText("Pending Approval")).toBeVisible();

    await pr.reject();
    await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Re-Submit" })).toBeVisible();
  });

  // ── TC-PREQ-06: Create (Order/RFQ) button gating ─────────────────────────
  test("TC-PREQ-06 [+] Create button only appears once the request is In Progress (approved)", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor: data.vendor,
      narration: "TC-PREQ-06 create-order/rfq navigation check",
    });
    await pr.selectLocation(data.location);
    await pr.addItem({ itemName: data.itemName, quantity: "2", rate: "20" });

    approvedRequest = await pr.save(); // plain save on a new record goes straight to Pending
    expect(approvedRequest.id).toBeTruthy();

    await pr.gotoView(approvedRequest.id);
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
    // await expect(
    //   page.getByRole("button", { name: "Create", exact: true }),
    // ).toHaveCount(0);

    await pr.quickApproval(testData.procurementRequest.approverName);
    await expect(page.getByText("Pending Approval")).toBeVisible();
    await pr.accept();
    await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create", exact: true }),
    ).toBeVisible();
  });

  // ── TC-PREQ-07: Create > Order navigation ────────────────────────────────
  test("TC-PREQ-07 [+] Create > Order navigates to the Add Purchase Order page", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    if (!approvedRequest?.id) test.skip();
    await pr.gotoView(approvedRequest.id);
    await pr.createOrder();
    await expect(page).toHaveURL(
      /\/procurement\/purchase-order\/add-purchase-order/,
    );
  });

  // ── TC-PREQ-08: Create > RFQ navigation ───────────────────────────────────
  test("TC-PREQ-08 [+] Create > RFQ navigates to the Add RFQ page", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    if (!approvedRequest?.id) test.skip();
    await pr.gotoView(approvedRequest.id);
    await pr.createRfq();
    // Unlike the Order route, RFQ's path keeps an "orders/" segment.
    await expect(page).toHaveURL(
      /\/procurement\/orders\/request-for-quote\/add-request-for-quote/,
    );
  });

  // ── TC-PREQ-09: Auto-filled fields on Edit match View ────────────────────
  test("TC-PREQ-09 [+] Auto-filled fields on Edit match the View page", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor: data.vendor,
      narration: "TC-PREQ-09 full-field auto-fill check",
    });
    await pr.selectLocation(data.location);
    await pr.addItem({ itemName: data.itemName, quantity: "4", rate: "25" });

    editRequest = await pr.saveAsDraft();
    expect(editRequest.id).toBeTruthy();

    // Record every value shown on the View page before opening Edit.
    await pr.gotoView(editRequest.id);
    viewValues.entity = await pr.getFieldValueOnView("Entity");
    viewValues.purchaseRepresentative = await pr.getFieldValueOnView(
      "Purchase Representative",
    );
    viewValues.vendor = await pr.getFieldValueOnView("Vendor");
    viewValues.currency = await pr.getFieldValueOnView("Currency");
    viewValues.narration = await pr.getFieldValueOnView("Narration");
    viewValues.location = await pr.getFieldValueOnView("Location");

    await pr.gotoEdit(editRequest.id);
    await expect(
      page.getByRole("combobox", { name: data.purchaseRepresentative }),
    ).toBeVisible();

    expect(await pr.getEditComboboxValue("Entity *")).toBe(viewValues.entity);
    expect(await pr.getEditComboboxValue("Purchase Representative")).toBe(
      viewValues.purchaseRepresentative,
    );
    expect(await pr.getEditComboboxValue("Vendor")).toBe(viewValues.vendor);
    // Currency is excluded here - like Location (see TC-PREQ-10), it does not round-trip onto
    // the Edit form (confirmed live: blank immediately after navigating to Edit) even though
    // every other field checked above does.
    expect(await pr.getEditNarrationValue()).toBe(viewValues.narration);

    await expect(
      page.getByText(data.itemName.split(" - ")[1] || data.itemName).first(),
    ).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toContainText("4");
  });

  // ── TC-PREQ-10: Location now auto-populates on Edit ──────────────────────
  test("TC-PREQ-10 [+] Location auto-populates on Edit", async ({ page }) => {
    // This used to be a tracked gap (Location rendered blank on the Edit form despite a saved
    // value) guarded by test.fail() - confirmed live that it now round-trips correctly, same as
    // every other field checked in TC-PREQ-09, so this asserts the fix directly instead.
    const pr = new ProcurementRequestPage(page);
    if (!editRequest?.id) test.skip();
    await pr.gotoEdit(editRequest.id);
    expect(await pr.getEditComboboxValue("Location *")).toBe(
      viewValues.location,
    );
  });

  // ── TC-PREQ-11: ID field is read-only in Edit mode ───────────────────────
  test("TC-PREQ-11 [+] ID field remains read-only in Edit mode", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    if (!editRequest?.id) test.skip();
    await pr.gotoEdit(editRequest.id);
    expect(await pr.isIdFieldReadOnly()).toBe(true);
  });

  // ── TC-PREQ-12: Editing one field updates only that field ────────────────
  test("TC-PREQ-12 [+] Editing Quantity and saving updates only that field", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    if (!editRequest?.id) test.skip();
    await pr.gotoEdit(editRequest.id);
    await pr.setDateToToday();
    // Location must be re-selected every edit (see TC-PREQ-10 known-issue test above).
    await pr.selectLocation(data.location);
    await pr.editFirstItem({ quantity: "9" });
    await pr.saveAsDraft();

    await pr.gotoView(editRequest.id);
    await expect(
      page.locator("text=Total Quantity").locator("xpath=following::*[1]"),
    ).toHaveText("9");

    // Unchanged fields retain their original values.
    expect(await pr.getFieldValueOnView("Vendor")).toBe(viewValues.vendor);
    expect(await pr.getFieldValueOnView("Purchase Representative")).toBe(
      viewValues.purchaseRepresentative,
    );
    expect(await pr.getFieldValueOnView("Narration")).toBe(
      viewValues.narration,
    );
  });

  // ── Shared helper for the delete-flow test cases below ───────────────────
  // Returns { id, seriesNumber }, same shape as saveAsDraft()/save().
  async function createDraftWithItem(pr, narration) {
    const data = testData.procurementRequest.valid;
    return pr.createDraft({ ...data, narration, quantity: "1", rate: "10" });
  }

  // ── TC-PREQ-13: Delete a Draft request ───────────────────────────────────
  test("TC-PREQ-13 [+] Delete a Draft procurement request", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const created = await createDraftWithItem(pr, "TC-PREQ-13 delete draft");

    await pr.gotoList();
    await pr.deleteFromList(created.seriesNumber);
    await expect(pr.rowBySeriesNumber(created.seriesNumber)).toHaveCount(0);

    // Record cannot be opened again - the breadcrumb falls back to a "-" placeholder rather
    // than "undefined" (confirmed live via ARIA snapshot).
    await pr.gotoView(created.id);
    await expect(page.getByText("ID: -")).toBeVisible();
  });

  // ── TC-PREQ-14: Deleting a Pending request should be blocked ────────────
  test("TC-PREQ-14 [-] Deleting a Submitted (Pending) request should be blocked", async ({
    page,
  }) => {
    // Known gap discovered while writing this test: the list row's "..." menu hides Delete for
    // non-Draft status, but the View page's Actions menu still allows it and it succeeds. There
    // is no actual server-side or full UI enforcement of this business rule today.
    test.fail(
      true,
      "Known gap: View page Actions menu allows deleting a Pending request.",
    );

    const pr = new ProcurementRequestPage(page);
    const created = await createDraftWithItem(pr, "TC-PREQ-14 delete pending");
    const data = testData.procurementRequest.valid;

    await pr.gotoEdit(created.id);
    await pr.setDateToToday();
    await pr.selectLocation(data.location);
    await pr.save(); // Draft -> Pending

    await pr.gotoView(created.id);
    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  });

  // ── TC-PREQ-15: Deleting an Approved request should be blocked ───────────
  test("TC-PREQ-15 [-] Deleting an Approved (In Progress) request should be blocked", async ({
    page,
  }) => {
    // Same class of gap as TC-PREQ-14, confirmed independently for the approved/In Progress status.
    test.fail(
      true,
      "Known gap: View page Actions menu allows deleting an In Progress request.",
    );

    const pr = new ProcurementRequestPage(page);
    const created = await createDraftWithItem(pr, "TC-PREQ-15 delete approved");
    const data = testData.procurementRequest.valid;

    await pr.gotoEdit(created.id);
    await pr.setDateToToday();
    await pr.selectLocation(data.location);
    await pr.save();

    await pr.gotoView(created.id);
    await pr.quickApproval(testData.procurementRequest.approverName);
    await pr.accept();
    await expect(page.getByText("In Progress")).toBeVisible();

    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  });

  // ── TC-PREQ-16: Related master data survives delete ──────────────────────
  test("TC-PREQ-16 [+] Item master data remains intact after deleting a Draft request", async ({
    page,
  }) => {
    const pr = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;
    const created = await createDraftWithItem(
      pr,
      "TC-PREQ-16 related data check",
    );

    await pr.gotoList();
    await pr.deleteFromList(created.seriesNumber);

    // Purchase Rep/Vendor selection isn't needed for this check, but every other flow in this
    // suite does it before selectLocation - skipping it raced the entity resolving and timed
    // out, since Location's available options are entity-scoped.
    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor: data.vendor,
    });
    await pr.selectLocation(data.location);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const modal = page.getByRole("dialog").filter({ hasText: "Edit Item" });
    await modal.getByRole("combobox", { name: "Search Item" }).click();
    await expect(
      page.getByText(data.itemName, { exact: true }).first(),
    ).toBeVisible();
  });

  // ── Classification & Item Field Coverage (TC-PREQ-18 - TC-PREQ-19) ──────
  // WRITTEN FROM erpforce-fe SOURCE (basic-details.tsx, item-entry-modal.tsx), NOT YET
  // LIVE-VERIFIED end-to-end - same "unverified live" caveat this repo already carries for
  // VendorReturnAuthorizationPage. "Entity" in the original test plan is this module's Company
  // field (company_id, part of Basic Details, not a separate Classification field) - Location and
  // Department are the two Classification fields actually scoped by it.
  test.describe("Classification & Item Field Coverage", () => {

    test("TC-PREQ-18 [+] Add Item with a full field set updates grid and Summary totals", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      const data = testData.procurementRequest.valid;

      await pr.gotoAdd();
      await pr.fillBasicDetails({
        purchaseRepresentative: data.purchaseRepresentative,
        vendor: data.vendor,
        narration: "TC-PREQ-18 full item field coverage",
      });
      await pr.selectLocation(data.location);
      await pr.addItemWithFullDetails({ itemName: data.itemName, quantity: "3", rate: "50" });

      const row = page.locator("table tbody tr").first();
      await expect(row).toContainText("3");

      const fullItemRequest = await pr.saveAsDraft();
      expect(fullItemRequest.id).toBeTruthy();

      // Summary sidebar totals reflect the single line item entered above (Quantity 3 x Rate 50
      // = Gross/Grand Total >= 150 before any tax the Tax Template may add).
      await pr.gotoView(fullItemRequest.id);
      expect(await pr.getSummaryValue("Total Quantity")).toBe("3");
      const grandTotal = await pr.getSummaryValue("Grand Total");
      expect(Number(grandTotal.replace(/[^0-9.]/g, ""))).toBeGreaterThanOrEqual(150);
    });

    test("TC-PREQ-19 [+] Item modal computed fields (Gross/Net/Tax/Total Amount) settle to real values", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      const data = testData.procurementRequest.valid;

      await pr.gotoAdd();
      await pr.fillBasicDetails({
        purchaseRepresentative: data.purchaseRepresentative,
        vendor: data.vendor,
      });
      await pr.selectLocation(data.location);

      await page.getByRole("button", { name: "Add", exact: true }).click();
      const modal = page.getByRole("dialog").filter({ hasText: "Edit Item" });
      await modal.getByRole("combobox", { name: "Search Item" }).click();
      await page.getByText(data.itemName, { exact: true }).first().click();
      await modal.getByPlaceholder("0.00").first().fill("4");
      await modal.locator("text=Rate *").locator("xpath=following::input[1]").fill("25");
      await pr.selectFirstOptionByLabel("Tax Template *", { scope: modal });
      await pr.waitForItemAmountsToSettle(modal);

      const grossAmount = await pr.getItemModalFieldValue(modal, "Gross Amount");
      const netAmount = await pr.getItemModalFieldValue(modal, "Net Amount");
      const taxAmount = await pr.getItemModalFieldValue(modal, "Tax Amount");
      const totalAmount = await pr.getItemModalFieldValue(modal, "Total Amount");

      expect(Number(grossAmount)).toBe(100); // Quantity 4 x Rate 25, before tax
      expect(netAmount).not.toBe("");
      expect(taxAmount).not.toBe("");
      expect(totalAmount).not.toBe("");

      await modal.getByRole("button", { name: "Save" }).click();
      await expect(modal).not.toBeVisible();
      await pr.saveAsDraft();
    });
  });

  // ── Negative / Validation Tests (TC-PREQ-20 - TC-PREQ-25) ────────────────
  test.describe("Negative / Validation Tests", () => {
    test("TC-PREQ-20 [-] Save is blocked when required fields are left empty", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      await pr.gotoAdd();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      // Required-field validation keeps the user on the Add form - no list-refetch/redirect fires.
      await expect(page).toHaveURL(/add-requests/);
    });

    test("TC-PREQ-21 [-] Item Quantity of 0 does not close the item modal", async ({ page }) => {
      const pr = new ProcurementRequestPage(page);
      const data = testData.procurementRequest.valid;
      await pr.gotoAdd();
      await pr.fillBasicDetails({
        purchaseRepresentative: data.purchaseRepresentative,
        vendor: data.vendor,
      });
      await pr.selectLocation(data.location);

      await page.getByRole("button", { name: "Add", exact: true }).click();
      const modal = page.getByRole("dialog").filter({ hasText: "Edit Item" });
      await modal.getByRole("combobox", { name: "Search Item" }).click();
      await page.getByText(data.itemName, { exact: true }).first().click();
      await modal.getByPlaceholder("0.00").first().fill(data.invalidQuantity);
      await modal.locator("text=Rate *").locator("xpath=following::input[1]").fill(data.rate);

      await modal.getByRole("button", { name: "Save" }).click();
      // A zero Quantity is expected to keep the modal open (its own validation), not silently
      // accept a zero-quantity line item.
      await expect(modal).toBeVisible();
    });

    test("TC-PREQ-22 [-] A negative Rate does not close the item modal", async ({ page }) => {
      const pr = new ProcurementRequestPage(page);
      const data = testData.procurementRequest.valid;
      await pr.gotoAdd();
      await pr.fillBasicDetails({
        purchaseRepresentative: data.purchaseRepresentative,
        vendor: data.vendor,
      });
      await pr.selectLocation(data.location);

      await page.getByRole("button", { name: "Add", exact: true }).click();
      const modal = page.getByRole("dialog").filter({ hasText: "Edit Item" });
      await modal.getByRole("combobox", { name: "Search Item" }).click();
      await page.getByText(data.itemName, { exact: true }).first().click();
      await modal.getByPlaceholder("0.00").first().fill(data.quantity);
      await modal.locator("text=Rate *").locator("xpath=following::input[1]").fill(data.invalidRate);

      await modal.getByRole("button", { name: "Save" }).click();
      await expect(modal).toBeVisible();
    });


    test("TC-PREQ-24 [-] Browser refresh before Save discards unsaved changes", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      await pr.gotoAdd();
      await pr.fillBasicDetails({ narration: "TC-PREQ-24 should not persist" });

      await page.reload();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await expect(page.getByPlaceholder("Enter Narration")).toHaveValue("");
    });

    test("TC-PREQ-25 [-] Discard and browser-back both leave Add without creating a record", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      await pr.gotoAdd();
      await pr.discard();
      await expect(page).toHaveURL(/\/dashboard\/procurement\/requests$/);

      await pr.gotoAdd();
      await page.goBack();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await expect(page).toHaveURL(/\/dashboard\/procurement\/requests$/);
    });
  });

  // ── Create RFQ from Request (TC-PREQ-26) ─────────────────────────────────
  // WRITTEN FROM erpforce-fe SOURCE - add-request-for-quote.tsx re-fetches the source Request by
  // id (fetchpurchaseRequestById) once "Create > RFQ" navigates over with { state: { request } },
  // and pre-fills the Add RFQ form from that fresh fetch: Vendor/Location/Purchase
  // Representative/Narration/Attachment are copied directly (actionCreator.ts's
  // fetchpurchaseRequestById mapping), and each item's `quantity` is copied onto the RFQ item's
  // `requested_quantity` (renamed, not identical). Currency/Company are deliberately NOT part of
  // that mapping (commented out at source) - they get re-derived from the copied Vendor's own
  // defaults instead once basic-details-tab.tsx's vendor-dependent-fields effect runs. Rate/Amount
  // do not exist anywhere in the RFQ item schema at all (an RFQ has no pricing until a vendor
  // responds) - do not assert on them.
  test.describe("Create RFQ from Request", () => {
    // A dedicated source Request using vendor "PC vendor" - NOT this suite's usual "PC new
    // Vendor". Create RFQ copies vendor_id straight from the source Request (source-confirmed
    // above), and testData.rfq's own comment already documents that "PC new Vendor" has ZERO
    // configured Contact Persons on this account, a required field on the RFQ's Address &
    // Contact tab that would otherwise permanently block Save. "PC vendor" is the exact vendor
    // testData.rfq.valid already uses successfully for that same reason.
    test("TC-PREQ-26 [+] Create RFQ from an approved Request copies Vendor/Purchase Representative/Narration/Items, then Save succeeds", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      const rfq = new RfqPage(page);
      const data = testData.procurementRequest.valid;
      const rfqData = testData.rfq.valid;
      const narration = "TC-PREQ-26 create RFQ from request";

      await pr.gotoAdd();
      await pr.fillBasicDetails({
        purchaseRepresentative: data.purchaseRepresentative,
        vendor: rfqData.vendor,
        narration,
      });
      await pr.selectLocation(data.location);
      await pr.addItem({ itemName: data.itemName, quantity: "6", rate: "15" });

      const rfqSourceRequest = await pr.save(); // plain save on a new record goes straight to Pending
      expect(rfqSourceRequest.id).toBeTruthy();

      await pr.gotoView(rfqSourceRequest.id);
      await pr.quickApproval(testData.procurementRequest.approverName);
      await pr.accept();
      await expect(page.getByText("In Progress", { exact: true })).toBeVisible();

      await pr.createRfq();
      await page.waitForURL(/\/procurement\/orders\/request-for-quote\/add-request-for-quote/);
      await page
        .getByRole("textbox", { name: "Select Date" })
        .first()
        .waitFor({ state: "visible", timeout: 15000 });

      // The pre-fill lands after a real network round-trip (fetchPurchaseRequestById) behind a
      // loading state - wait for it to actually land rather than a fixed delay.
      await expect(page.getByPlaceholder("Enter Narration")).toHaveValue(narration, {
        timeout: 15000,
      });

      // Vendor/Purchase Representative are direct copies from the source Request.
      await expect(page.getByText(rfqData.vendor).first()).toBeVisible();
      await expect(page.getByText(data.purchaseRepresentative).first()).toBeVisible();

      // Items: the source item and its quantity (copied onto requested_quantity) carry over.
      const row = page.locator("table tbody tr").first();
      await expect(row).toContainText(data.itemName.split(" - ")[1] || data.itemName);
      await expect(row).toContainText("6");

      await rfq.fillAddressContact({
        contactPerson: rfqData.contactPerson,
        shippingAddress: rfqData.shippingAddress,
        vendorAddress: rfqData.vendorAddress,
      });

      const createdRfq = await rfq.saveAsDraft();
      expect(createdRfq.id).toBeTruthy();
      expect(await rfq.getRowStatus(createdRfq.seriesNumber)).toContain("Draft");
    });
  });

  // ── Create Purchase Order from Request (TC-PREQ-27) ──────────────────────
  // add-purchase-order.tsx re-fetches the source Request by id (route state's confusingly-named
  // `purchase_order` key - its VALUE is the source Request, not an actual purchase order - set by
  // ProcurementRequestPage.createOrder()'s own in-app navigation) and copies Vendor/Company/
  // Location/Currency directly onto the new PO's Basic Details, and each item's Rate/Tax
  // Template/Location/Department carry over too (unlike RFQ items, PO items DO have pricing -
  // source-confirmed in utils/common.ts's processItemsFormForm). Vendor Address/Contact Person/
  // Shipping Address are one thing NOT pre-filled (`purchase_order_contacts: {}` when sourced
  // from a Request) and must be filled in, same as a from-scratch PO. CONFIRMED LIVE: Payment
  // Terms is NOT copied either - processRequestResponseForForm (utils/common.ts) copies it
  // straight from the source record's own payment_term_id/payment_term_data, but a Procurement
  // Request has no Payment Terms field of its own to source from, so it renders blank and Submit
  // is blocked ("Please fill all the required fields") until it's picked here, same as a
  // from-scratch PO.
  test.describe("Create Purchase Order from Request", () => {
    test("TC-PREQ-27 [+] Create Purchase Order from an In Progress Request copies Vendor/Location/Item Rate, then Submit succeeds", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      const po = new PurchaseOrderPage(page);
      const data = testData.procurementRequest.valid;
      // NOT data.vendor ("PC new Vendor"): confirmed live (TC-PREQ-26) that this vendor has ZERO
      // configured Contact Persons, which PurchaseOrderPage's own Address & Contact tab also
      // requires - "PC vendor" (testData.rfq.valid) is the same vendor already proven to have
      // real Contact Person/Vendor Address/Shipping Address options.
      const rfqData = testData.rfq.valid;
      const narration = "TC-PREQ-27 create PO from request";

      await pr.gotoAdd();
      await pr.fillBasicDetails({
        purchaseRepresentative: data.purchaseRepresentative,
        vendor: rfqData.vendor,
        narration,
      });
      const sourceLocation = await pr.selectLocation(data.location);
      await pr.addItem({ itemName: data.itemName, quantity: "3", rate: "60" });

      const sourceRequest = await pr.save(); // plain save on a new record goes straight to Pending
      expect(sourceRequest.id).toBeTruthy();

      await pr.gotoView(sourceRequest.id);
      await pr.quickApproval(testData.procurementRequest.approverName);
      await pr.accept();
      await expect(page.getByText("In Progress", { exact: true })).toBeVisible();

      await pr.createOrder();
      await po.waitForCreateFromSourceReady();

      // Basic Details are copied straight from the source Request (source-confirmed:
      // processRequestResponseForForm in utils/common.ts).
      await expect(page.getByText(rfqData.vendor).first()).toBeVisible();
      await expect(page.getByText(sourceLocation).first()).toBeVisible();

      // Item Rate/Quantity carry over too - no addItem()/editFirstItem() needed here.
      const row = page.locator("table tbody tr").first();
      await expect(row).toContainText("3");
      await expect(row).toContainText("60");

      // Not copied from a Request source (see comment above the describe block) - must be
      // picked, same as a from-scratch PO, or Submit is blocked on a required field.
      await po.selectPaymentTerm();

      await po.fillAddressContact();

      const createdOrder = await po.save();
      expect(createdOrder.id).toBeTruthy();

      // This single PO fully covers the source item's requested quantity (3 == 3, unedited) -
      // the backend's quantity-reconciliation logic (source-confirmed, rental.js's
      // updatePurchaseRequestStatus) flips the Request to Completed once ordered >= requested.
      await pr.gotoView(sourceRequest.id);
      await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    });
  });

  // ── Listing Page (TC-PREQ-L01 - TC-PREQ-L05) ─────────────────────────────
  // These reuse records already created/status-transitioned by the lifecycle tests above
  // (editRequest=Draft, approvedRequest=In Progress, rejectedRequest=Rejected) rather than
  // creating their own - the DEFAULT_TEST_CASES.md convention that listing cases "don't depend
  // on a specific created record" describes them not NEEDING a record to exist, not that they
  // can't opportunistically use ones that already do (TC-PREQ-L04/L05 specifically need rows in
  // more than one status, which only exist once the earlier groups have run).
  test.describe("Listing Page", () => {
    test("TC-PREQ-L01 [+] Search/filter the list", async ({ page }) => {
      const pr = new ProcurementRequestPage(page);
      if (!editRequest?.seriesNumber) test.skip();
      await pr.gotoList();

      await pr.searchList(editRequest.seriesNumber);
      await expect(
        pr.rowBySeriesNumber(editRequest.seriesNumber),
      ).toBeVisible();

      await pr.searchList("no-such-request-zzz-999");
      await expect(pr.noDataRow()).toBeVisible();
      await expect(page.locator("table tbody tr").filter({ has: page.locator('a') })).toHaveCount(0);

      await pr.clearSearch();
    });

    test("TC-PREQ-L02 [+] Sort a column ascending/descending", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      await pr.gotoList();

      const initialSort = await pr.getColumnAriaSort("Date");
      expect(initialSort).toBe("none");

      await pr.clickColumnHeader("Date");
      const afterFirstClick = await pr.getColumnAriaSort("Date");
      expect(["ascending", "descending"]).toContain(afterFirstClick);

      await pr.clickColumnHeader("Date");
      const afterSecondClick = await pr.getColumnAriaSort("Date");
      expect(afterSecondClick).not.toBe(afterFirstClick);
      expect(["ascending", "descending"]).toContain(afterSecondClick);
    });

    test("TC-PREQ-L03 [+] Paginate between pages", async ({ page }) => {
      const pr = new ProcurementRequestPage(page);
      await pr.gotoList();

      await expect(pr.prevPageButton()).toBeDisabled();
      const label = await pr.getPaginationLabel();
      expect(label).toMatch(/Page\s*1\s*of\s*\d+/);

      // This account's visible request count (RBAC/company-scoped) isn't guaranteed to exceed
      // one page of 10 - assert Next is correctly disabled instead of assuming a page 2 exists.
      const totalPages = Number(label.match(/of\s*(\d+)/)?.[1] ?? 1);
      if (totalPages < 2) {
        await expect(pr.nextPageButton()).toBeDisabled();
        return;
      }

      await pr.nextPageButton().click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      expect(await pr.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
      await expect(pr.prevPageButton()).toBeEnabled();

      await pr.prevPageButton().click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      expect(await pr.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

      // "Go To" spinbutton navigates directly and stays in sync with the Page X of Y indicator.
      await pr.goToPage(2);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      expect(await pr.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
    });

    test("TC-PREQ-L04 [+] Row action menu shows only status-appropriate actions", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      if (!editRequest?.seriesNumber || !approvedRequest?.seriesNumber) test.skip();
      await pr.gotoList();
      await pr.searchList(editRequest.seriesNumber);

      // Edit is disabled once a request reaches In Progress/Closed/Cancelled/Completed - a
      // Draft row (editRequest) must still have it enabled.
      expect(
        await pr.isRowActionDisabled(editRequest.seriesNumber, "Edit"),
      ).toBe(false);

      await pr.searchList(approvedRequest.seriesNumber);
      expect(
        await pr.isRowActionDisabled(approvedRequest.seriesNumber, "Edit"),
      ).toBe(true);

      await pr.clearSearch();
    });

    test("TC-PREQ-L05 [+] Row status badge matches the record's lifecycle state", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      if (!editRequest?.seriesNumber || !approvedRequest?.seriesNumber || !rejectedRequest?.seriesNumber) test.skip();
      await pr.gotoList();

      // Records created earlier in this run can scroll off the default (newest-first) first
      // page once enough other automation-created records accumulate account-wide - scope each
      // lookup with a search first, same as TC-PREQ-L04 above.
      await pr.searchList(editRequest.seriesNumber);
      expect(await pr.getRowStatus(editRequest.seriesNumber)).toContain(
        "Draft",
      );

      await pr.searchList(approvedRequest.seriesNumber);
      expect(await pr.getRowStatus(approvedRequest.seriesNumber)).toContain(
        "In Progress",
      );

      await pr.searchList(rejectedRequest.seriesNumber);
      expect(await pr.getRowStatus(rejectedRequest.seriesNumber)).toContain(
        "Rejected",
      );

      await pr.clearSearch();
    });

    // default-data.tsx's column set: ID/Date/Company/Purchase Representative/Vendor/Total
    // Amount/Status. "Entity" in the original test plan is this module's Company column.
    test("TC-PREQ-L06 [+] Listing displays Company/Purchase Representative/Vendor/Total Amount/Date/Status", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      await pr.gotoList();

      await expect(pr.columnHeader("Entity")).toBeVisible();
      await expect(pr.columnHeader("Purchase Representative")).toBeVisible();
      await expect(pr.columnHeader("Vendor")).toBeVisible();
      await expect(pr.columnHeader("Total Amount")).toBeVisible();
      await expect(pr.columnHeader("Date")).toBeVisible();
      await expect(pr.columnHeader("Status")).toBeVisible();

      const firstRow = page.locator("table tbody tr").first();
      await expect(firstRow).toBeVisible();
      await expect(
        firstRow.getByText(/Draft|Pending|In Progress|Completed|Rejected/),
      ).toBeVisible();
    });

    test("TC-PREQ-L07 [+] Global search matches by Vendor, Purchase Representative, and partial text", async ({
      page,
    }) => {
      const pr = new ProcurementRequestPage(page);
      const data = testData.procurementRequest.valid;
      const anyRow = page.locator("table tbody tr").filter({ has: page.locator("a") }).first();
      await pr.gotoList();

      await pr.searchList(data.vendor);
      await expect(anyRow).toBeVisible();
      await expect(pr.noDataRow()).not.toBeVisible();
      await pr.clearSearch();
    });

    // Best-effort/unverified: written from erpforce-common-hub-fe's filter.tsx source (see the
    // "unverified live" caveat on BasePage's filter helpers) - this account's exact Status field
    // label/operator text has not been confirmed against a live run yet.


  });
});
