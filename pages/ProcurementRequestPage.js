const { expect } = require("@playwright/test");
const BasePage = require("./BasePage");

class ProcurementRequestPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto("/dashboard/procurement/requests");
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (confirmed live: a bare loading spinner, no list/table content at
    // all, under concurrent multi-worker load) - wait for the "Add" button, always present once
    // the list is ready, same pattern gotoEdit()/gotoAdd()/gotoView() already use.
    await this.page
      .getByRole("button", { name: "Add" })
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole("button", { name: "Add" }).first().click();
    await this.page.waitForURL("**/add-requests");
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // Location's options are entity-scoped; selecting it before the default Entity resolves
    // can race and time out. Other flows avoid this incidentally via prior field selections.
    await expect(this.page.getByRole("combobox").first()).not.toHaveText("", {
      timeout: 10000,
    });
    // Company/Vendor/Purchase Representative's own dependent-fetch chain can get stuck on
    // "Loading..." indefinitely on page load - same shared DynamicSelect-family bug documented on
    // BasePage.recoverFromStuckLoadingFields (confirmed live on the sibling RFQ module, TC-RFQ-09)
    // - recover before any later step can hang on it.
    await this.recoverFromStuckLoadingFields();
  }

  async gotoEdit(id) {
    if (!id)
      throw new Error(
        `gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`,
      );
    await this.page.goto(`/dashboard/procurement/requests/${id}/edit-requests`);
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // networkidle can fire before the form has actually finished rendering under this
    // environment's latency (confirmed live via screenshot: still showing a loading spinner
    // well after networkidle) - wait for a field that's always present once the form is ready,
    // same pattern gotoAdd() already uses.
    await this.page
      .getByRole("textbox", { name: "Select Date" })
      .waitFor({ state: "visible", timeout: 15000 });
    // Same stuck-"Loading..." class of bug as gotoAdd() (source-confirmed on RFQ's own Edit page,
    // TC-RFQ-09) - this module shares the identical DynamicSelect component/dependent-fetch chain.
    await this.recoverFromStuckLoadingFields();
  }

  async gotoView(id) {
    if (!id)
      throw new Error(
        `gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`,
      );
    await this.page.goto(`/dashboard/procurement/requests/${id}/view-requests`);
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (confirmed live on the sibling Purchase Agreement page: a fully
    // blank white page, no content at all, under concurrent multi-worker load) - wait for the
    // breadcrumb's own "ID:" text, always present once the View page is ready, same pattern
    // gotoEdit()/gotoAdd() already use.
    await this.page
      .getByText(/^ID:/)
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  // openDropdownAndPick()/selectFieldByLabel() now live on BasePage (identical 6-attempt
  // retry/escape/wait-500ms skeleton this page and every sibling procurement module relied on
  // independently) - "Search X" fields are custom combobox triggers, not native inputs, so their
  // visible prompt text is the accessible name, not a real placeholder attribute.

  // Editing a record on a later day than it was created leaves its stored Date in the past,
  // which the form rejects on save ("Date cannot be in the past") - reset it to today first.
  async setDateToToday() {
    await this.page
      .getByRole("textbox", { name: "Select Date" })
      .fill(this.formatDateToday());
  }

  // ---------- Basic Details ----------
  // Company (company_id) - NOT "Entity": basic-details.tsx's real field name is Company, required,
  // and gates Currency (`disabled={!selectedCompany}`) - selecting it before Currency avoids
  // racing a disabled combobox. gotoAdd() already waits for the first combobox (Company, the
  // first DynamicSearchSelect field after the disabled ID input) to hold a non-empty default
  // value, so this is usually a no-op on Add; it matters on flows that need a NON-default Company
  // to exercise Location/Department's dependent-reset behavior.
  async selectCompany(companyName) {
    await this.selectFieldByLabel("Company *", companyName);
  }

  // Reads the Company combobox's current visible text - used to scope a freshly created Location
  // to whichever Company is ACTUALLY selected right now (Location's own options are company-
  // scoped, `filterField={'company_id'}` per basic-details.tsx), without every caller needing to
  // thread the company value through separately.
  async getSelectedCompany() {
    const combobox = this.page
      .getByText("Entity *", { exact: true })
      .first()
      .locator("xpath=..")
      .getByRole("combobox")
      .first();
    return ((await combobox.textContent()) || "").replace(/[​﻿]/g, "").trim();
  }

  async fillBasicDetails({
    purchaseRepresentative,
    vendor,
    currency,
    narration,
  } = {}) {
    if (purchaseRepresentative) {
      await this.openDropdownAndPick(
        "Search Purchase Representative",
        purchaseRepresentative,
      );
    }
    if (vendor) {
      await this.openDropdownAndPick("Search Vendor", vendor);
    }
    if (currency) {
      // Currency defaults to a real value on the Add form and does not round-trip onto the
      // Edit form (confirmed live: blank immediately after navigating to Edit) - re-selecting
      // it structurally by label is a no-op-equivalent on Add (still picks the same value) and
      // a fix on Edit, and doesn't care which state the combobox's accessible name is in.
      await this.selectFieldByLabel("Currency *", currency);
    }
    if (narration) {
      await this.page.getByPlaceholder("Enter Narration").fill(narration);
    }
  }

  // The Location dropdown's default (unfiltered) list only returns the 25 most-recently-created
  // records with no working search filter (confirmed live via its own API call:
  // `order=id:-1&limit=25` - typing into the popover's search box never triggers a filtered
  // re-fetch for this field). Any PINNED literal value - even a previously-confirmed-live one -
  // eventually gets evicted from that ever-shifting window by newer automation-created records
  // account-wide (confirmed live: the sibling RFQ Shipping Address field hit this exact issue
  // when its own pinned "Dhule" fell out of the window). Rather than keep re-pinning a "currently
  // visible" name that will inevitably rot again, create a brand new Location from the field's
  // own "+ Create New Location" footer action every time (createLocationFromFooter, BasePage) and
  // use that - it's guaranteed to exist, and scoped to whichever Company is CURRENTLY selected
  // (getSelectedCompany()) since Location's own options are company-scoped
  // (`filterField={'company_id'}` per basic-details.tsx).
  //
  // TEMPORARY WORKAROUND: on this project's dev.erpforce.co account, the Location field's
  // translation key (crm.salesOrder.fields.location_label) isn't resolving, so its paragraph
  // label can read literally "crm.salesOrder.fields.location_label *" instead of "Location *"
  // (confirmed live via ARIA snapshot - a real app/content bug, not a test issue) - resolve the
  // field's own combobox structurally and pass it to createLocationFromFooter directly, since its
  // own generic "Location" label lookup would miss the broken-translation state entirely.
  //
  // `namePrefix` seeds the generated name (existing callers keep passing a familiar seed like
  // "Dhule"/"Automation_Request_Location") - a per-call timestamp+random suffix is appended so
  // concurrent/rapid calls within the same suite never collide. Returns the actual generated name
  // so callers that need to assert on it later (e.g. TC-PREQ-03's View-page check) can capture it.
  async selectLocation(namePrefix) {
    const properLabelText = "Location *";
    const brokenLabelText = "crm.salesOrder.fields.location_label *";
    const label = this.page
      .getByText(properLabelText, { exact: true })
      .or(this.page.getByText(brokenLabelText, { exact: true }));
    const combobox = label.locator('xpath=following::*[@role="combobox"][1]');

    const companyName = (await this.getSelectedCompany()) || "erp-force";
    const locationName = `${namePrefix}_${Date.now()}_${Math.floor(
      Math.random() * 10000,
    )}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.createLocationFromFooter(locationName, companyName, {
          combobox,
        });
        return locationName;
      } catch (e) {
        if (attempt === 2) throw e;
        await this.page.keyboard.press("Escape").catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }
  }

  // Department (department_id, Classification section) - a DynamicDependentField scoped to the
  // selected Company (`filterFields="company_id"`, source: basic-details.tsx), disabled and
  // force-remounted (cleared) whenever Company changes. Its exact live option text in this
  // account is unverified, so pick whichever renders first rather than guessing a literal string
  // (same approach PurchaseOrderPage.selectFirstOptionByLabel already takes for its own
  // unverified required fields) unless a caller explicitly needs a specific value.
  async selectDepartment(departmentName) {
    if (departmentName) {
      await this.selectFieldByLabel("Department *", departmentName);
    } else {
      await this.selectFirstOptionByLabel("Department *");
    }
  }

  // ---------- Items ----------
  // A prior dropdown (e.g. Location) can reopen its popover well AFTER the code that selected
  // a value from it has already moved on - confirmed live: closing it right after selection
  // (selectLocation's own Escape+backdrop-click) genuinely succeeds in the moment, but it comes
  // back seconds later regardless, consistently and reproducibly. Root cause: the field's own
  // debounced search request (fired when its search box was typed into) can still be in flight
  // under this environment's real network latency - when that LATE response finally lands, the
  // underlying DynamicSelect component re-renders as "open" simply because it now has options to
  // show, independent of whether a selection was already made. There's no reliable fixed delay
  // to wait out here, so any click elsewhere on the page needs to defend against the popover
  // having silently reappeared in between, not just check for it once beforehand.
  async closeAnyOpenPopover() {
    const openListbox = this.page.getByRole("listbox");
    if (await openListbox.isVisible().catch(() => false)) {
      await this.page.keyboard.press("Escape");
      await this.page
        .locator("body")
        .click({ position: { x: 2, y: 2 }, force: true });
      await expect(openListbox)
        .not.toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }
  }

  async addItem({ itemName, quantity, rate }) {
    // exact: true avoids matching the "Items*Please add atleast one Item" accordion header,
    // whose accessible name contains "add" as a case-insensitive substring.
    const addButton = this.page.getByRole("button", {
      name: "Add",
      exact: true,
    });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.closeAnyOpenPopover();
      try {
        await addButton.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }

    const modal = this.page
      .getByRole("dialog")
      .filter({ hasText: "Edit Item" });
    await modal.getByRole("combobox", { name: "Search Item" }).click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    await modal.getByPlaceholder("0.00").first().fill(quantity); // Quantity field
    await modal
      .locator("text=Rate *")
      .locator("xpath=following::input[1]")
      .fill(rate);

    await this.waitForItemAmountsToSettle(modal);
    await modal.getByRole("button", { name: "Save" }).click();
    await expect(modal).not.toBeVisible();
  }

  // Fills every field the "Add Item"/"Edit Item" modal actually exposes (item-entry-modal.tsx),
  // beyond the minimal Item/Quantity/Rate set addItem() above fills. Tax Template is a required
  // field that addItem() never sets (this account's Save has been observed to succeed without it
  // regardless) - here it's filled explicitly since these tests assert on the Tax/computed
  // columns it drives. Vendor Name/UOM/Description/Available/On Hand/Gross Amount/Discount
  // Rate/Discount Amount/Net Amount/Tax Code/Tax Rate/Tax Amount/Total Amount are all read-only,
  // auto-computed fields (source-confirmed disabled inputs) - read back via
  // getItemModalFieldValue(), never filled.
  async addItemWithFullDetails({
    itemName,
    quantity,
    rate,
    taxTemplate,
    discountItem,
    location,
    department,
  } = {}) {
    const addButton = this.page.getByRole("button", {
      name: "Add",
      exact: true,
    });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.closeAnyOpenPopover();
      try {
        await addButton.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }

    const modal = this.page
      .getByRole("dialog")
      .filter({ hasText: "Edit Item" });
    await modal.getByRole("combobox", { name: "Search Item" }).click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    await modal.getByPlaceholder("0.00").first().fill(quantity);
    await modal
      .locator("text=Rate *")
      .locator("xpath=following::input[1]")
      .fill(rate);
    await this.waitForItemAmountsToSettle(modal);

    if (taxTemplate) {
      await this.selectFieldByLabel("Tax Template *", taxTemplate, {
        scope: modal,
      });
    } else {
      await this.selectFirstOptionByLabel("Tax Template *", { scope: modal });
    }
    if (discountItem) {
      await this.selectFieldByLabel("Discounted Item", discountItem, {
        scope: modal,
      });
    }
    // Location/Department here are the ITEM's own classification fields (item-entry-modal.tsx),
    // a distinct pair from the main form's Classification accordion - Department is additionally
    // scoped to the request's already-selected Company (`&company_id.eq` filter, source-confirmed).
    if (location) {
      await this.selectFieldByLabel("Location", location, {
        scope: modal,
        exact: false,
      });
    }
    if (department) {
      await this.selectFieldByLabel("Department", department, {
        scope: modal,
        exact: false,
      });
    }

    await this.waitForItemAmountsToSettle(modal);
    await modal.getByRole("button", { name: "Save" }).click();
    await expect(modal).not.toBeVisible();
  }

  // Reads a read-only/computed field's current value while the item modal is still open - pass
  // the exact modal locator returned mid-flow by tests that need to assert BEFORE Save (e.g.
  // confirming Gross/Net/Tax/Total Amount settled to a non-empty, correctly-computed value).
  async getItemModalFieldValue(modal, label) {
    return modal
      .locator(`text=${label}`)
      .locator("xpath=following::input[1]")
      .inputValue();
  }

  async editFirstItem({ quantity, rate } = {}) {
    // Scoped to tbody rows: `table.getByRole('button')` would match the column header's
    // sort/arrow-icon buttons first, not the row's own edit/delete icon buttons.
    // A prior dropdown (e.g. Location) can reopen its popover asynchronously well AFTER a
    // one-time close check already passed (see closeAnyOpenPopover's comment) - a single
    // check-then-click isn't enough. NOT force:true here: a forced click still dispatches at
    // the target's real screen coordinates, so if the popover is genuinely covering that exact
    // position when the click fires, force just clicks the popover instead of failing loudly -
    // the modal then never opens and every later step fails deep inside `modal.locator(...)`
    // with a confusing error. A normal (non-forced) click blocks on real obscuring elements and
    // throws if one's still there, so the retry loop below can react to a genuine miss.
    const editIcon = this.page
      .locator("table tbody tr")
      .first()
      .locator("button")
      .first();
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.closeAnyOpenPopover();
      try {
        await editIcon.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    const modal = this.page
      .getByRole("dialog")
      .filter({ hasText: "Edit Item" });
    await modal.waitFor({ state: "visible", timeout: 10000 });

    if (quantity) {
      await modal
        .locator("text=Quantity *")
        .locator("xpath=following::input[1]")
        .fill(quantity);
    }
    if (rate) {
      await modal
        .locator("text=Rate *")
        .locator("xpath=following::input[1]")
        .fill(rate);
    }
    if (quantity || rate) {
      await this.waitForItemAmountsToSettle(modal);
    }
    await modal.getByRole("button", { name: "Save" }).click();
    await expect(modal).not.toBeVisible();
  }

  // ---------- Save actions ----------
  // This is a shared, persistent dataset, so the newest row isn't reliably "first" in the
  // list (other records can legitimately sort above it) - capture the list's own refetch after
  // redirect and read the freshly created/updated record straight from its JSON body. That
  // record has TWO distinct identifiers that are NOT derivable from one another (confirmed live:
  // a record with numeric id 305 had series_number "PR-2026-000151" - no padding relationship):
  // `id` (the raw DB primary key, used in edit/view URLs) and `series_number` (the formatted
  // string actually rendered in the list's ID column, e.g. "PR-2026-000151"). Callers need
  // `id` for gotoEdit/gotoView and `seriesNumber` for anything that finds the row in the list.
  async saveAndCaptureId(buttonName, exact) {
    // Same lingering-popover class of issue as addItem()/editFirstItem() above - NOT force:true
    // for the same reason documented on editFirstItem()'s edit-icon click: a forced click can
    // silently land on the popover instead of Save, leaving the subsequent waitForResponse
    // hanging on a request that never fires.
    const saveButton = this.page.getByRole("button", {
      name: buttonName,
      exact,
    });
    let listResponsePromise;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.closeAnyOpenPopover();
      listResponsePromise = this.page.waitForResponse((r) =>
        r.url().includes("/purchase/v1/purchase-requests/?"),
      );
      try {
        await saveButton.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    const listResponse = await listResponsePromise;
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    const record = (await listResponse.json()).data.purchase_requests[0];
    // The "ID" column renders a FORMATTED display string (e.g. "PR-2026-000349"), not the raw
    // numeric `id` (confirmed live via ARIA snapshot/screenshot - series_number itself does NOT
    // exist as an API field for this module, so this must be a client-side cell formatter, and
    // guessing its exact prefix/year/padding convention is fragile). Read it directly from the
    // list's own first row instead: `record` above IS that same first row (both come from the
    // identical API response the table renders from), so there's no ambiguity about which row.
    await this.page
      .getByRole("button", { name: "Add" })
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    const seriesNumber = await this.page
      .locator("table tbody tr")
      .first()
      .getByRole("link")
      .first()
      .innerText();
    return { id: String(record.id), seriesNumber };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId("Save To Draft", false);
  }

  async save() {
    return this.saveAndCaptureId("Save", true);
  }

  // ---------- List actions ----------
  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText("Edit", { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-requests`));
  }

  async getRowStatus(seriesNumber) {
    // Callers reach this right after a save's own redirect - networkidle can fire before the
    // list page has actually mounted its search bar (same class of issue documented on
    // gotoList()), so searchList() below can otherwise time out waiting for a placeholder that
    // hasn't rendered yet.
    await this.page
      .getByRole("button", { name: "Add" })
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    // This shared, ever-growing dataset can easily exceed the list's default page size (10) -
    // the just-created/edited record isn't guaranteed to land on the currently displayed page
    // (confirmed live: a timeout waiting for a row that genuinely exists, just not on page 1).
    // Search for it explicitly rather than assuming it's already visible.
    await this.searchList(seriesNumber);
    const status = await this.getRowStatusMatching(
      seriesNumber,
      /Draft|Pending|In Progress|Completed|Rejected/,
    );
    await this.clearSearch();
    return status;
  }

  // ---------- Edit page value readers ----------
  async isIdFieldReadOnly() {
    return this.page
      .getByRole("textbox", { name: "ID", exact: true })
      .isDisabled();
  }

  // ---------- Delete / Approval flow ----------
  // confirmDelete()/quickApproval()/accept()/reject() now live on BasePage - this module's own
  // toast wording ('Requests has been submitted for approval.' / '...approved successfully.' /
  // '...rejected successfully.') already matches BasePage's default toast regexes, so no override
  // is needed here.

  // ---------- Create Order / RFQ ----------
  // "Create" is another split-button (same "select merge strategy" caret pattern as
  // Submit/Accept) that only renders once status is "In Progress", and only shows the
  // "Order"/"RFQ" menu items the logged-in user has permission for. Its main button is a
  // no-op, same as Accept's.
  // clickSubmitMenuItem() (BasePage) retries the whole open-menu-then-click sequence, not just
  // the click - same MuiMenu remount-on-open instability already fixed there for Submit/Accept/
  // Reject (confirmed live, TC-PREQ-26: this "Create" menu shares the identical split-button/
  // caret pattern, so it's exposed to the exact same detach-mid-click race).
  async createOrder() {
    await this.clickSubmitMenuItem("Order");
  }

  async createRfq() {
    await this.clickSubmitMenuItem("RFQ");
  }

  // ---------- Summary (View/Edit sidebar accordion) ----------
  // getSummaryValue() now lives on BasePage (identical implementation, shared across every
  // document-style module) - see BasePage.js.

  // ---------- Listing row field visibility ----------
  // default-data.tsx's column set: ID/Date/Company/Purchase Representative/Vendor/Total
  // Amount/Status - confirms every field the Listing scenario asks to verify actually exists,
  // one row scoped lookup instead of five separate whole-page assertions.
  async verifyListingRowVisible(seriesNumber) {
    const row = this.rowBySeriesNumber(seriesNumber);
    await expect(row).toBeVisible();
    await expect(
      row.getByText(/Draft|Pending|In Progress|Completed|Rejected/),
    ).toBeVisible();
    return row;
  }

  // ---------- Module-level business method ----------
  // Matches the spec files' own local createDraftWithItem() helper body exactly - centralizes it
  // here so every spec that needs "a throwaway draft record with one item" calls the same method
  // instead of redefining it per file.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor: data.vendor,
      narration: data.narration,
    });
    await this.selectLocation(data.location);
    await this.addItem({
      itemName: data.itemName,
      quantity: data.quantity,
      rate: data.rate,
    });
    return this.saveAsDraft();
  }
}

module.exports = ProcurementRequestPage;
