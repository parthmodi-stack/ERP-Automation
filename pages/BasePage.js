const { expect } = require("@playwright/test");

// Shared across ProcurementRequestPage and PurchaseAgreementPage (and any future document-style
// module page object). Only methods that are byte-identical between the two, or a strict
// superset improvement of both, live here - anything with a real behavioral difference (dropdown
// search/retry quirks, save/approval wording, field names) stays in its own page object. Merging
// those would risk reintroducing bugs that took multiple rounds of live debugging to fix.
class BasePage {
  constructor(page) {
    this.page = page;
    // Fail fast on a 401/403 instead of letting the test keep waiting on whatever UI element
    // never renders as a result (e.g. an empty dropdown, a blocked navigation) and timing out
    // 15-30s later with a confusing, unrelated-looking error. A stale/expired auth.json session
    // is a real, distinct failure mode from an actual UI/locator bug and should be reported as
    // such immediately.
    page.on("response", (response) => {
      const status = response.status();
      if (status === 401 || status === 403) {
        const message = `Auth failure: ${status} ${response
          .request()
          .method()} ${response.url()} - session is likely expired/invalid (check auth.json / re-run global-setup), not a UI bug.`;
        // eslint-disable-next-line no-console
        console.error(message);
        throw new Error(message);
      }
    });
  }

  // Gross/Tax/Net/Total amounts in an item modal are computed by a debounced effect after
  // Quantity/Rate change; saving before it fires submits null amounts, which the backend
  // rejects as a "details mismatch".
  async waitForItemAmountsToSettle(modal) {
    const grossAmount = modal
      .locator("text=Gross Amount")
      .locator("xpath=./following::input[1]");
    await expect(grossAmount).not.toHaveValue("", { timeout: 5000 });
  }

  async discard() {
    await this.page.getByRole("button", { name: "Discard" }).click();
  }

  // ---------- Dropdown helpers (DynamicSelect-family fields) ----------
  // A DynamicSearchSelect field (erpforce-common-hub-fe's dynamic-select.tsx) mounts its popover
  // the instant it opens - BEFORE its options fetch resolves - and passes through transient
  // "Loading..." / "No data available" states in the meantime. The ONLY robust way to interact
  // with it is a web-first, auto-retrying locator on the target option itself: Playwright keeps
  // re-evaluating until the real option actually renders, patiently tolerating those transient
  // states. This mirrors the proven-working Vendor Return Authorization item modal, which selects
  // its Item purely via `getByText(option).click()` and never inspects a spinner or loading flag.
  // (An earlier one-shot `count()`+loop here was NOT web-first: it snapshotted the listbox once,
  // and if that snapshot happened to land in the transient empty window it saw only "No data
  // available" and failed, even though the options arrived a moment later - the root cause of the
  // Landed Cost item-modal failures.)

  // Deliberate, explicit opt-in for fields whose exact live option text is unverified in this
  // account's master data (see selectFirstOptionByLabel) - picking whatever renders first is a
  // real test decision there, not error recovery, so it stays a distinct, separately-called API.
  async selectFirstAvailableOption(combobox) {
    await combobox.click().catch(() => { });
    const firstOption = this.page
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasNot: this.page.locator("input") })
      .filter({ hasNotText: /Select|No data available/ })
      .first();
    await firstOption.waitFor({ state: "visible", timeout: 7000 });
    await firstOption.click();
  }

  // Web-first option selection. `hasText` (string) already matches case-insensitively and
  // whitespace-normalized, so it subsumes the manual zero-width/whitespace cleaning the old
  // one-shot scan did by hand. `expect(...).toBeVisible` auto-retries until the option renders
  // (or the timeout elapses), which is what lets it ride out the field's transient loading state
  // instead of racing it. Returns a boolean so callers that branch on presence (e.g. RfqPage's
  // re-select-Entity flow) keep working unchanged.
  async selectOptionFromListbox(optionText, { timeout = 10000 } = {}) {
    const option = this.page
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasNot: this.page.locator("input") })
      .filter({ hasText: optionText })
      .first();
    try {
      await expect(option).toBeVisible({ timeout });
    } catch (e) {
      return false;
    }
    await option.scrollIntoViewIfNeeded().catch(() => { });
    await option.click();
    await expect(this.page.getByRole("listbox")).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    return true;
  }

  // Name-based lookup: works while a combobox's accessible name is still its "Search X"/"Select
  // X" placeholder prompt. `tryFill` covers the modules whose combobox is itself a text input
  // (typing narrows the option list) - swallowed because not every module's combobox accepts
  // typed input, and forcing it there would throw before the option click ever runs.
  async openDropdownAndPick(placeholder, optionText, { tryFill = false, timeout = 10000 } = {}) {
    const combobox = this.page
      .getByRole("combobox", { name: placeholder })
      .first();

    await combobox.click();
    if (tryFill) {
      try {
        await combobox.fill(optionText);
      } catch (e) {
        // Not a text input on this module's field - ignore and fall through to the option click.
      }
    }

    const found = await this.selectOptionFromListbox(optionText, { timeout });
    if (found) return;

    const available = await this.page.getByRole("listbox").getByRole("option").allTextContents();
    throw new Error(
      `openDropdownAndPick("${placeholder}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()))}`
    );
  }

  // Structural, label-based lookup - unlike name-based lookup above, this doesn't care whether
  // the combobox's accessible name is currently a "Search X"/"Select X" prompt or an
  // already-selected value, so it's used for fields that pre-populate on Edit, or whose paragraph
  // label renders with a trailing required-field asterisk in the same text node (`exact: false`
  // for those - a bare `exact: true` match against the label alone never matches "X *").
  // `scope` lets callers scope the label lookup to a modal/dialog instead of the whole page (item
  // entry modals reuse the same field labels, e.g. "Location", as the main form).
  async selectFieldByLabel(
    labelText,
    optionText,
    {
      exact = true,
      scope = this.page.getByRole('main'),
      timeout = 10000,
    } = {},
  ) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    const fieldContainer = scope
      .getByText(exact ? labelText : labelRegex, { exact })
      .first()
      .locator('xpath=..');
    const combobox = fieldContainer.getByRole('combobox').first();

    const textVal = ((await combobox.textContent()) || '').replace(/[\u200B\uFEFF]/g, "").trim();
    const inputVal = ((await combobox.inputValue().catch(() => '')) || '').replace(/[\u200B\uFEFF]/g, "").trim();
    const currentValue = textVal || inputVal;
    if (currentValue === optionText || (optionText && currentValue.includes(optionText))) {
      return;
    }

    await combobox.click();
    const found = await this.selectOptionFromListbox(optionText, { timeout });
    if (found) return;

    const available = await this.page.getByRole("listbox").getByRole("option").allTextContents();
    throw new Error(
      `selectFieldByLabel("${labelText}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()))}`
    );
  }

  // For required fields whose exact live option text in a given account's master data is
  // unverified, pick whatever renders first in the popover rather than guessing a literal string
  // that may not exist.
  async selectFirstOptionByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    const combobox = scope
      .getByText(labelRegex)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    return this.selectFirstAvailableOption(combobox);
  }

  // `scope` defaults to 'main' (the original, still-correct default for every plain-form module),
  // but a Drawer/sidebar-based Location field (e.g. Organization Structure's node sidebars) may
  // render outside the main landmark - pass that sidebar's own locator as `scope` in that case.
  async createLocationFromFooter(locationName, companyName, { scope = this.page.getByRole('main') } = {}) {
    const escapedLabel = 'Location'.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    const container = scope
      .getByText(labelRegex)
      .first()
      .locator('xpath=..');
    const combobox = container.getByRole('combobox').first();

    // 1. Click the combobox to open the listbox
    await combobox.click();

    // 2. Click "+ Create New Location" from the footer
    await this.page.getByText('Create New Location', { exact: false }).click();

    // 3. Wait for the dialog to be visible
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    // 4. Fill in Location Name and a unique Location Code
    await dialog.getByPlaceholder('inventory.item.locationModal.location_name_placeholder').fill(locationName);
    const code = 'LOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    await dialog.getByPlaceholder('inventory.item.locationModal.location_code_placeholder').fill(code);

    // 5. Select Company inside the dialog
    await this.selectFieldByLabel(
      'accounting.authorize_commission.fields.company_label',
      companyName,
      { exact: false, scope: dialog }
    );

    // 6. Save the new location
    await dialog.getByRole('button', { name: 'Save' }).click();

    // 7. Wait for the dialog to close
    await dialog.waitFor({ state: 'hidden' });

    // 8. Select the newly created location from the open listbox
    const selected = await this.selectOptionFromListbox(locationName, { timeout: 7000 });
    if (!selected) {
      // Ensure any dialog/backdrop is fully hidden/detached before manual selection fallback
      await this.page.waitForSelector('.MuiDialog-root', { state: 'detached', timeout: 5000 }).catch(() => {});
      await this.page.waitForSelector('.MuiBackdrop-root', { state: 'detached', timeout: 5000 }).catch(() => {});
      await this.selectFieldByLabel('Location', locationName, { exact: false, scope });
    }
  }

  // Structural lookup for a plain text/number/date input whose visible "label" is a plain <p>,
  // NOT a real MUI-associated <label> (confirmed live on Leave Policy Master: the paragraph and
  // its `<input>` are sibling DOM nodes with no `for`/`aria-labelledby` link at all) - getByLabel()
  // never matches these, and some of these inputs (e.g. a number spinbutton with no placeholder)
  // have no other accessible name either, so getByPlaceholder isn't a full substitute. Same
  // trailing-required-asterisk handling as selectFieldByLabel/selectFirstOptionByLabel above.
  // Apply this ANY time getByLabel/getByPlaceholder times out on a plain input field in a new
  // module - it's the same underlying app pattern, not a one-off Leave Policy Master quirk.
  fieldInputByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
    return scope
      .getByText(labelRegex)
      .first()
      .locator('xpath=..')
      .locator('input')
      .first();
  }

  // ---------- Date helpers ----------
  formatDateToday() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}-${d.getFullYear()}`;
  }

  // seriesNumber is the exact text rendered in the list's ID column (e.g. "PR-2026-000149") - see
  // the comment on each subclass's saveAndCaptureId for why this can't be derived from the raw id.
  // NOT getByRole('link', ...): confirmed live that page.getByRole('link') matches ZERO elements
  // anywhere on these listing pages, even though a plain page.locator('a') finds the exact same
  // element with the exact same text - the table's row-cell anchors have no real `href`
  // attribute (SPA-style onClick navigation instead), so they get no implicit ARIA link role
  // under strict getByRole() semantics, even though Playwright's own (more lenient) ARIA-
  // snapshot debug tool still labels them "link" for readability. Match by text instead, which
  // works regardless of the element's role.
  rowBySeriesNumber(seriesNumber) {
    return this.page.locator("tr", {
      has: this.page.getByText(seriesNumber, { exact: true }),
    });
  }

  async openRowActionMenu(seriesNumber) {
    if (!seriesNumber)
      throw new Error(
        `openRowActionMenu() called with a falsy seriesNumber (${seriesNumber}) - a prior create/save step likely failed.`,
      );
    const row = this.rowBySeriesNumber(seriesNumber);
    await row.locator("button").first().click(); // "..." menu button
  }

  // Narration is a real <textarea>; its value isn't part of innerText(), unlike comboboxes.
  async getEditNarrationValue() {
    return this.page.getByPlaceholder("Enter Narration").inputValue();
  }

  // .first() guards against labels that collide with an Items-grid column of the same name
  // (e.g. "Location"), where a hidden sort-indicator badge can also match the xpath axis. Some
  // values (e.g. Vendor) render as multiple text nodes in a flex container (name next to an
  // avatar-related element) with extra whitespace at the join - collapse runs of whitespace so
  // comparisons against a plainly-typed value like "Alex Smith" don't fail.
  async getFieldValueOnView(label) {
    const text =
      (await this.page
        .getByText(label, { exact: true })
        .first()
        .locator("xpath=./following::*[1]")
        .first()
        .textContent()) ?? "";
    return text.trim().replace(/\s+/g, " ");
  }

  // Combobox-based fields (Entity, Purchase Representative, Vendor, Currency, Location,
  // Department) show their selected value as the combobox's own visible/accessible text. MUI's
  // clear-selection icon button leaves a stray zero-width space in innerText(). .first() guards
  // against a label that also appears elsewhere on the page (e.g. a read-only Summary sidebar).
  async getEditComboboxValue(label) {
    const text = await this.page
      .getByText(label, { exact: true })
      .first()
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    return text.replace(/[\u200B\uFEFF]/g, "").trim();
  }

  // ---------- Delete ----------
  // confirm-modal.tsx's default confirm button text is always t('common.delete') = "Delete", but
  // a couple of modules' own confirmation dialog uses a differently-labeled button ("Confirm") -
  // the regex is a safe superset of both, so this single implementation covers every module
  // without needing a per-page override.
  async confirmDelete() {
    const dialog = this.page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: /Delete|Confirm/i })
      .first()
      .click();
    await expect(dialog).not.toBeVisible();
  }

  async deleteFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole("menuitem", { name: "Delete" }).click();
    await this.confirmDelete();
  }

  async deleteFromView() {
    await this.page.getByRole("button", { name: "Actions" }).click();
    await this.page.getByRole("menuitem", { name: "Delete" }).click();
    await this.confirmDelete();
  }

  async isDeleteAvailableFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    const available = await this.page
      .getByRole("menuitem", { name: "Delete" })
      .count();
    await this.page.keyboard.press("Escape");
    return available > 0;
  }

  // Opt-in cleanup utility - not wired into any existing spec's afterAll, since several suites'
  // "Listing Page" test blocks deliberately depend on earlier tests' records still existing in
  // the shared, ever-growing dataset (see config/testData.js's own comments on this). Available
  // for any NEW spec that wants to clean up its own throwaway records at the end of a run.
  async deleteRecords(seriesNumbers) {
    for (const seriesNumber of seriesNumbers) {
      await this.deleteFromList(seriesNumber);
    }
  }

  // ---------- Approval flow ----------
  // The "Submit"/"Accept" button is a split-button: the main button either fires a default
  // action immediately (Submit) or is a no-op (Accept) - the menu with Quick Approval/Accept/
  // Reject only opens via its adjacent caret button (a shared generic accessible name across
  // every such split-button in the app), not the main button itself.
  // Same class of flaky-click issue as addItem()/editFirstItem()/saveAndCaptureId() elsewhere in
  // this file (confirmed live, TC-PREQ-05): under real network/render latency the caret's click
  // can land before the MUI Menu popover is ready to mount, so it silently no-ops and the menu
  // never opens - a caller then times out waiting for a menuitem/text that was never going to
  // appear, since nothing here ever retried. Verify the menu actually opened before returning,
  // and re-click if it didn't.
  async openSubmitMenu() {
    const caret = this.page.getByRole("button", { name: "select merge strategy" });
    const menu = this.page.getByRole("menu");
    for (let attempt = 1; attempt <= 4; attempt++) {
      await caret.click();
      try {
        await menu.waitFor({ state: "visible", timeout: 3000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        // The menu may have opened then closed again (a stray click can toggle it shut) -
        // normalize back to a known-closed state before the next attempt.
        await this.page.keyboard.press("Escape").catch(() => {});
      }
    }
  }

  // Retries the WHOLE open-menu-then-click sequence, not just the click - MUI's Menu popover can
  // keep remounting its MenuList briefly right after opening (confirmed live, TC-PREQ-05: the
  // "Reject" menuitem locator resolved, then went unstable, then was reported fully detached from
  // the DOM mid-click, well within Playwright's own auto-retrying actionability wait). Re-clicking
  // the SAME stale node can't recover from a detach; a fresh openSubmitMenu() call re-opens onto
  // a newly-settled menu instead. `byText` covers Quick Approval's own locator (getByText, not a
  // menuitem-role lookup) so all three approval actions share this one retry path.
  async clickSubmitMenuItem(name, { byText = false } = {}) {
    const locatorFor = () =>
      byText
        ? this.page.getByText(name, { exact: true })
        : this.page.getByRole("menuitem", { name, exact: true });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.openSubmitMenu();
      try {
        await locatorFor().click({ timeout: 5000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press("Escape").catch(() => {});
        await this.page.waitForTimeout(300);
      }
    }
  }

  // Shared across every approval-workflow module (Procurement Request/Purchase Agreement/
  // Purchase Order/Vendor Return Authorization) - only the toast wording differs, and every
  // module's existing wording already matches these default regexes. Pass `successToast: null`
  // to skip the assertion where a module's own toast is known to be too transient to reliably
  // catch (see PurchaseAgreementPage.accept()).
  async quickApproval(
    userName,
    { successToast = /submitted for approval/i } = {},
  ) {
    await this.clickSubmitMenuItem("Quick Approval", { byText: true });

    const dialog = this.page
      .getByRole("dialog")
      .filter({ hasText: "Quick Approval" });
    await dialog.getByText("Select").click();
    // A case-sensitive RegExp gives a substring match, needed since the user list can have
    // near-duplicate entries differing only by case, and each option's accessible name also
    // includes its avatar-initials prefix (an `exact: true` match would never work at all).
    await this.page.getByRole("option", { name: new RegExp(userName) }).click();
    await this.page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: "Send Request" }).click();
    if (successToast) {
      await expect(this.page.getByText(successToast)).toBeVisible();
    }
  }

  async accept({
    confirmButtonName = "Submit",
    successToast = /approved successfully/i,
  } = {}) {
    // menuitem role disambiguates from the underlying main "Accept" button, which shares the
    // same exact text and stays in the DOM under the open menu.
    await this.clickSubmitMenuItem("Accept");
    await this.page.getByRole("button", { name: confirmButtonName }).click(); // confirmation dialog
    if (successToast) {
      await expect(this.page.getByText(successToast)).toBeVisible();
    }
  }

  async reject({
    confirmButtonName = "Submit",
    successToast = /rejected successfully/i,
  } = {}) {
    await this.clickSubmitMenuItem("Reject");
    await this.page.getByRole("button", { name: confirmButtonName }).click(); // confirmation dialog
    if (successToast) {
      await expect(this.page.getByText(successToast)).toBeVisible();
    }
  }

  // ---------- Row status (shared MaterialTable status badge) ----------
  // Structurally identical across every module - only the status-word vocabulary differs. Each
  // page keeps its own thin `getRowStatus(seriesNumber)` wrapper passing its own regex, so that
  // module's status vocabulary stays visible/greppable in its own file.
  async getRowStatusMatching(seriesNumber, statusRegex) {
    const row = this.rowBySeriesNumber(seriesNumber);
    return (await row.getByText(statusRegex).first().textContent()) ?? "";
  }

  // ---------- Listing page (shared MaterialTable, identical across every module) ----------
  // The search input's only accessible name is its placeholder - a hardcoded, non-translated
  // "Search" across every module's listing page (erpforce-common-hub-fe's action-bar.tsx), not
  // module-specific text. It's collapsed behind an icon-only toggle button by default (no
  // accessible name - confirmed live via ARIA snapshot: two unlabeled icon buttons sit between
  // the "Table View"/"View" toggle and "Add", the first of the two being the search toggle) -
  // it doesn't exist in the DOM at all until that's clicked.
  async ensureSearchInputOpen() {
    const searchInput = this.page.getByPlaceholder("Search", { exact: true });
    if (await searchInput.isVisible().catch(() => false)) {
      return searchInput;
    }
    await this.page
      .getByRole("button", { name: "Add" })
      .first()
      .locator("xpath=preceding-sibling::button[2]")
      .click();
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    return searchInput;
  }

  async searchList(term) {
    const searchInput = await this.ensureSearchInputOpen();
    // The list refetches on a debounced keystroke, but under this environment's real network
    // latency that round trip can take well over a second (confirmed live: a fixed 800ms wait
    // here left the table showing its PRE-search rows, well before the `search=<term>` request
    // had actually resolved) - wait for the real response instead of a guessed fixed delay.
    const [response] = await Promise.all([
      this.page
        .waitForResponse((r) => r.url().includes("search="), { timeout: 10000 })
        .catch(() => null),
      searchInput.fill(term),
    ]);
    if (response) {
      await this.page.waitForLoadState("networkidle");
    } else {
      // Fallback if no matching response was observed (e.g. searching for an empty string).
      await this.page.waitForTimeout(800);
    }
    // Dismiss the search popover by clicking safely outside at the top-left of the page, past the sidebar.
    await this.page.locator('body').click({ position: { x: 300, y: 10 }, force: true }).catch(() => {});
    await this.page.locator(".MuiPopover-root, .MuiMenu-root").first().waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  }

  async clearSearch() {
    const searchInput = await this.ensureSearchInputOpen();
    await searchInput.fill("");
    await this.page.waitForLoadState("networkidle");
    // Dismiss the search popover by clicking safely outside at the top-left of the page, past the sidebar.
    await this.page.locator('body').click({ position: { x: 300, y: 10 }, force: true }).catch(() => {});
    await this.page.locator(".MuiPopover-root, .MuiMenu-root").first().waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  }

  async getFirstRowSeriesNumber() {
    const firstRowLink = this.page.locator('table tbody tr').first().locator('td').nth(2).locator('a');
    return (await firstRowLink.innerText().catch(() => '')).trim();
  }

  // t('common.noData') = "No Data" - rendered inside a Box.no-data (an image + this text), not
  // a real <tr>, by the shared MaterialTable's renderEmptyRowsFallback when the filtered result
  // set is empty.
  noDataRow() {
    return this.page.getByText("No Data", { exact: true });
  }

  columnHeader(name) {
    return this.page.getByRole("columnheader", { name });
  }

  async getColumnAriaSort(name) {
    return this.columnHeader(name).getAttribute("aria-sort");
  }

  async clickColumnHeader(name) {
    await this.columnHeader(name).click();
  }

  // ---------- Pagination (shared component, pagination.tsx) ----------
  // The Prev/Next icon buttons render with NO aria-label (a bare MUI IconButton wrapping an
  // unlabelled chevron icon) - locate them structurally off the "Go To :" label instead of by
  // accessible name, since there is none to match against.
  prevPageButton() {
    return this.page
      .getByText("Go To :", { exact: true })
      .locator("xpath=./following::button[1]");
  }

  nextPageButton() {
    return this.page.locator(".pagination").locator("button").last();
  }

  // The page-number input is a plain MUI TextField with id="outlined-required" and no
  // associated <label> (no htmlFor), so it has no accessible name for a role-based lookup.
  goToPageInput() {
    return this.page.locator("#outlined-required");
  }

  async goToPage(pageNumber) {
    await this.goToPageInput().fill(String(pageNumber));
    await this.goToPageInput().press("Enter");
  }

  // "Page X of Y" is rendered as several separate Typography text nodes, not one string - an
  // exact-text locator against the whole phrase never matches. Read the pagination container's
  // own collapsed text content and let the caller regex-match against it instead.
  async getPaginationLabel() {
    await this.page.locator(".pagination").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await this.page
      .locator(".MuiSkeleton-root, .MuiCircularProgress-root, .MuiLinearProgress-root, [role='progressbar']")
      .first()
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {});
    await this.page.waitForTimeout(200);
    const text = (await this.page.locator(".pagination").textContent()) ?? "";
    return text.replace(/\s+/g, " ").trim();
  }

  // ---------- Page size (shared pagination.tsx) ----------
  // "Items per page :" Select renders its own value as a MUI Select (role="combobox" once
  // MUI resolves it) with no accessible name of its own - the CSS class is the only stable
  // hook (confirmed in source: pagination.tsx's own `pageSizeOptions = [10, 20, 50]`).
  pageSizeSelect() {
    return this.page.locator(".page-size-select-pagination");
  }

  async changePageSize(size) {
    await this.pageSizeSelect().click();
    await this.page.getByRole("option", { name: String(size), exact: true }).click();
    await this.page.waitForLoadState("networkidle");
  }

  // ---------- Filters (shared filter.tsx, react-querybuilder + QueryBuilderMaterial) ----------
  // WRITTEN FROM SOURCE (erpforce-common-hub-fe/src/components/filter/filter.tsx +
  // components/{field-select,operator-select,value-editor,add-filter}.tsx), NOT YET LIVE-VERIFIED
  // against a real filter row - same "unverified live" caveat this repo already uses for
  // VendorReturnAuthorizationPage. This is a generic AND/OR rule-builder, not a fixed panel of
  // named per-field inputs: a rule is built by picking a Field, then an Operator, then a Value
  // whose editor type (select/date/text) depends on that field's schema-declared inputType.
  async openFilters() {
    await this.page.getByRole("button", { name: "Filter", exact: true }).click();
    await this.page
      .getByRole("dialog")
      .filter({ hasText: "Filters" })
      .waitFor({ state: "visible", timeout: 10000 });
  }

  filterDialog() {
    return this.page.getByRole("dialog").filter({ hasText: "Filters" });
  }

  // Each call adds one more rule row (react-querybuilder's own "Add Filter" action) - callers
  // select field/operator/value for that row via the other filter methods below before adding
  // a second one.
  async addFilterRule() {
    await this.filterDialog().getByRole("button", { name: "Add Filter" }).click();
  }

  // Field/Operator are both plain MUI Selects (field-select.tsx/operator-select.tsx) sharing the
  // same "select-drps" class with no distinguishing accessible name - `rowIndex` picks which rule
  // row's pair of selects to act on (each row renders exactly one Field select then one Operator
  // select, in that DOM order).
  async selectFilterField(fieldLabel, rowIndex = 0) {
    const row = this.filterDialog().locator(".rule").nth(rowIndex);
    await row.locator(".select-drps").first().click();
    await this.selectOptionFromListbox(fieldLabel);
  }

  async selectFilterOperator(operatorLabel, rowIndex = 0) {
    const row = this.filterDialog().locator(".rule").nth(rowIndex);
    await row.locator(".select-drps").nth(1).click();
    await this.selectOptionFromListbox(operatorLabel);
  }

  // value-editor.tsx picks a TextField/DatePicker/SearchableSelect based on the field's own
  // inputType - a plain `.fill()` covers the TextField/DatePicker cases (DatePicker's slotProps
  // set a `YYYY-MM-DD` placeholder text input); the `select` case (FK-reference and enum fields
  // like Status) needs its own popover-option click instead, via selectFilterValueOption below.
  async fillFilterValue(value, rowIndex = 0) {
    const row = this.filterDialog().locator(".rule").nth(rowIndex);
    await row.locator(".select-drps input, .select-drps").last().fill(value);
  }

  async selectFilterValueOption(optionText, rowIndex = 0) {
    const row = this.filterDialog().locator(".rule").nth(rowIndex);
    await row.locator(".select-drps").last().click();
    await this.selectOptionFromListbox(optionText);
  }

  async applyFilters() {
    await this.filterDialog().getByRole("button", { name: "Apply", exact: true }).click();
    await this.page.waitForLoadState("networkidle");
  }

  async closeFilterDialog() {
    await this.filterDialog().getByRole("button", { name: "Cancel", exact: true }).click();
  }

  // "Clear all filters" (inside the still-open dialog) resets the query builder itself; the
  // separately-rendered "Clear Filter" button (action-bar.tsx, only visible once at least one
  // filter chip is already applied) resets the applied list filter without reopening the dialog -
  // callers use whichever is actually on screen at the time.
  async clearAllFilters() {
    const dialog = this.filterDialog();
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Clear all filters" }).click();
      await this.applyFilters();
      return;
    }
    await this.page.getByRole("button", { name: "Clear Filter", exact: true }).click();
    await this.page.waitForLoadState("networkidle");
  }

  // ---------- Row action menu (status/permission gating) ----------
  // Unlike the View page's Actions menu (where a disabled action is often absent from the DOM
  // entirely, see isDeleteAvailableFromList), the list row's "..." menu renders every action and
  // marks status/permission-ineligible ones aria-disabled instead of omitting them.
  async isRowActionDisabled(seriesNumber, actionName) {
    await this.openRowActionMenu(seriesNumber);
    const item = this.page.getByRole("menuitem", {
      name: actionName,
      exact: true,
    });
    const ariaDisabled = await item.getAttribute("aria-disabled");
    await this.page.keyboard.press("Escape");
    return ariaDisabled === "true";
  }
}

module.exports = BasePage;
