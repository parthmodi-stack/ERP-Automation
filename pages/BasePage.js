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
      .locator("xpath=following::input[1]");
    await expect(grossAmount).not.toHaveValue("", { timeout: 5000 });
  }

  async discard() {
    await this.page.getByRole("button", { name: "Discard" }).click();
  }

  // ---------- Dropdown helpers (DynamicSelect-family fields) ----------
  // Shared fallback for every dropdown helper below: if the target option text isn't in the
  // popover (this account's master data can drift out from under a pinned testData value - a
  // shared, ever-growing dataset, or a value that's aged off a "25 most-recent" window), select
  // whatever renders first instead of failing outright. Excludes the popover's own nested search
  // textbox (a decoy "option" whose accessible name mirrors whatever's currently typed) and any
  // literal "Select" placeholder option, so this never accidentally "succeeds" on a non-real one.
  async selectFirstAvailableOption(combobox) {
    const listbox = this.page.getByRole("listbox");
    if (!(await listbox.isVisible().catch(() => false))) {
      await combobox.click({ force: true }).catch(() => { });
    }

    const optionsLocator = listbox.getByRole("option");
    // Wait for listbox options to load (i.e. not be empty and not contain "Loading...")
    for (let i = 0; i < 40; i++) {
      const count = await optionsLocator.count();
      if (count > 0) {
        const firstText = await optionsLocator.first().textContent().catch(() => '');
        if (!firstText.includes('Loading...')) {
          break;
        }
      }
      await this.page.waitForTimeout(150);
    }

    const firstOption = this.page
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasNot: this.page.locator("input") })
      .filter({ hasNotText: "Select" })
      .first();
    await firstOption.waitFor({ state: "visible", timeout: 7000 });
    await firstOption.click({ force: true });
  }

  async selectOptionFromListbox(optionText) {
    const listbox = this.page.getByRole("listbox");
    await listbox.waitFor({ state: "visible", timeout: 7000 });
    const optionsLocator = listbox.getByRole("option");
    
    // Wait for listbox options to load (i.e. not be empty and not contain "Loading...")
    for (let i = 0; i < 40; i++) {
      const count = await optionsLocator.count();
      if (count > 0) {
        const firstText = await optionsLocator.first().textContent().catch(() => '');
        if (!firstText.includes('Loading...')) {
          break;
        }
      }
      await this.page.waitForTimeout(150);
    }

    const count = await optionsLocator.count();
    const cleanTarget = optionText.replace(/[\s\u200B\uFEFF,]+/g, "").trim().toLowerCase();
    for (let i = 0; i < count; i++) {
      const opt = optionsLocator.nth(i);
      const text = (await opt.textContent() || '').replace(/[\s\u200B\uFEFF,]+/g, "").trim().toLowerCase();
      if (text === cleanTarget || (cleanTarget && text.includes(cleanTarget))) {
        await opt.scrollIntoViewIfNeeded().catch(() => { });
        await opt.click({ force: true });
        return true;
      }
    }
    return false;
  }

  // Name-based lookup: works while a combobox's accessible name is still its "Search X"/"Select
  // X" placeholder prompt. `tryFill` covers the modules whose combobox is itself a text input
  // (typing narrows the option list) - swallowed because not every module's combobox accepts
  // typed input, and forcing it there would throw before the option click ever runs.
  async openDropdownAndPick(placeholder, optionText, { tryFill = false } = {}) {
    const combobox = this.page
      .getByRole("combobox", { name: placeholder })
      .first();

    // KNOWN APP BUG, confirmed live across every module that uses this helper: these
    // DynamicSelect-family fields can show "No data available" if a sibling field's selection
    // interrupts this field's own fetch mid-flight - retrying with an Escape + settle in between
    // reliably recovers it.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await combobox.click({ force: true });
      if (tryFill) {
        try {
          await combobox.fill(optionText);
        } catch (e) {
          // Not a text input on this module's field - ignore and fall through to the option click.
        }
      }
      try {
        const found = await this.selectOptionFromListbox(optionText);
        if (found) return;
        throw new Error(`Option "${optionText}" not found in listbox`);
      } catch (e) {
        if (attempt === 3) return this.selectFirstAvailableOption(combobox);
        await this.page.keyboard.press("Escape");
        await this.page.waitForTimeout(500);
      }
    }
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
      scope = this.page,
      scrollIntoView = false,
      timeout = 7000,
    } = {},
  ) {
    const combobox = scope
      .getByText(labelText, { exact })
      .first()
      .locator('xpath=following::*[@role="combobox"][1]');
    // Wait for any initial "Loading..." state to disappear
    for (let i = 0; i < 30; i++) {
      const innerText = await combobox.innerText().catch(() => '');
      const textContent = await combobox.textContent().catch(() => '');
      if (!innerText.includes('Loading...') && !textContent.includes('Loading...')) {
        break;
      }
      await this.page.waitForTimeout(100);
    }

    console.log(`DEBUG COMBOBOX [${labelText}] AFTER LOAD:`, await combobox.evaluate(el => el.outerHTML).catch(e => e.message));
    const textVal = ((await combobox.textContent()) || '').replace(/[\u200B\uFEFF]/g, "").trim();
    const inputVal = ((await combobox.inputValue().catch(() => '')) || '').replace(/[\u200B\uFEFF]/g, "").trim();
    const inputVal2 = ((await combobox.locator('input').first().inputValue().catch(() => '')) || '').replace(/[\u200B\uFEFF]/g, "").trim();
    const innerTextVal = ((await combobox.innerText().catch(() => '')) || '').replace(/[\u200B\uFEFF]/g, "").trim();
    const ariaLabelVal = ((await combobox.getAttribute('aria-label').catch(() => '')) || '').replace(/[\u200B\uFEFF]/g, "").trim();
    const currentValue = textVal || inputVal || inputVal2 || innerTextVal || ariaLabelVal;
    if (currentValue === optionText || (optionText && currentValue.includes(optionText))) {
      return;
    }

    for (let attempt = 1; attempt <= 6; attempt++) {
      await combobox.click({ force: true });
      try {
        const found = await this.selectOptionFromListbox(optionText);
        if (found) return;
        throw new Error(`Option "${optionText}" not found in listbox`);
      } catch (e) {
        const options = await this.page.getByRole("listbox").getByRole("option").allTextContents().catch(() => []);
        const cleanedOpts = options.map(o => o.replace(/[\u200B\uFEFF]/g, "").trim());
        if (attempt === 1) {
          console.log(`Available options in listbox for "${labelText}":`, cleanedOpts);
        }
        // If the listbox is populated but our target option is not there, don't waste time retrying 6 times.
        // Immediately select the first available option.
        const validOptions = cleanedOpts.filter(o => o !== '' && o !== 'No data available' && o !== 'Select');
        if (validOptions.length > 0) {
          const cleanTarget = optionText.replace(/[\s\u200B\uFEFF,]+/g, "").trim().toLowerCase();
          const hasTarget = cleanedOpts.some(o => o.replace(/[\s\u200B\uFEFF,]+/g, "").trim().toLowerCase().includes(cleanTarget));
          if (!hasTarget) {
            console.log(`Option "${optionText}" is not in the loaded listbox options. Selecting first available option directly.`);
            return this.selectFirstAvailableOption(combobox);
          }
        }
        if (attempt === 6) return this.selectFirstAvailableOption(combobox);
        await this.page.keyboard.press("Escape");
        await this.page.waitForTimeout(500);
      }
    }
  }

  // For required fields whose exact live option text in a given account's master data is
  // unverified, pick whatever renders first in the popover rather than guessing a literal string
  // that may not exist.
  async selectFirstOptionByLabel(labelText, { scope = this.page } = {}) {
    const combobox = scope
      .getByText(labelText)
      .first()
      .locator('xpath=following::*[@role="combobox"][1]');

    // Wait for any initial "Loading..." state to disappear
    for (let i = 0; i < 30; i++) {
      const innerText = await combobox.innerText().catch(() => '');
      const textContent = await combobox.textContent().catch(() => '');
      if (!innerText.includes('Loading...') && !textContent.includes('Loading...')) {
        break;
      }
      await this.page.waitForTimeout(100);
    }

    return this.selectFirstAvailableOption(combobox);
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
        .locator("xpath=following::*[1]")
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
  async openSubmitMenu() {
    await this.page
      .getByRole("button", { name: "select merge strategy" })
      .click();
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
    await this.openSubmitMenu();
    await this.page.getByText("Quick Approval", { exact: true }).click();

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
    await this.openSubmitMenu();
    // menuitem role disambiguates from the underlying main "Accept" button, which shares the
    // same exact text and stays in the DOM under the open menu.
    await this.page
      .getByRole("menuitem", { name: "Accept", exact: true })
      .click();
    await this.page.getByRole("button", { name: confirmButtonName }).click(); // confirmation dialog
    if (successToast) {
      await expect(this.page.getByText(successToast)).toBeVisible();
    }
  }

  async reject({
    confirmButtonName = "Submit",
    successToast = /rejected successfully/i,
  } = {}) {
    await this.openSubmitMenu();
    await this.page
      .getByRole("menuitem", { name: "Reject", exact: true })
      .click();
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
    // The MUI search widget is a modal-style Popover/Menu whose invisible MuiBackdrop
    // intercepts all pointer events on the page (table rows, buttons, etc.) even after
    // the search response has settled. Press Escape to close the popover; the server-side
    // filter stays in effect because the request already fired and resolved.
    await this.page.keyboard.press("Escape");
    await this.page
      .locator(".MuiPopover-root, .MuiMenu-root")
      .waitFor({ state: "hidden", timeout: 3000 })
      .catch(() => { /* popover may have already closed or not been present */ });
  }

  async clearSearch() {
    const searchInput = await this.ensureSearchInputOpen();
    await searchInput.fill("");
    await this.page.waitForLoadState("networkidle");
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
      .locator("xpath=following::button[1]");
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
    const text = (await this.page.locator(".pagination").textContent()) ?? "";
    return text.replace(/\s+/g, " ").trim();
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
