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

  async waitForNetworkIdle(timeout = 3000) {
    await this.page
      .waitForLoadState("networkidle", { timeout })
      .catch(() => null);
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
    // A combobox's aria-controls attribute names exactly which listbox popover belongs to it -
    // read it BEFORE clicking (it's assigned at mount time and stays fixed) so this can target
    // that specific listbox by id afterward. CONFIRMED LIVE this matters: opening a "+ Create
    // New ..." dialog from a field's own footer link (e.g. BasePage.createLocationFromFooter, or
    // any selectModalDropdown(modal, label, true) call) does NOT close the ORIGINATING dropdown's
    // own listbox underneath the dialog - a page-wide `getByRole('listbox')` query then resolves
    // ambiguously across both, and can silently click into the stale, wrong one while the real,
    // intended dropdown never receives a selection - leaving it permanently open and blocking
    // every later click on the page. Falls back to the old page-wide query if a combobox
    // implementation doesn't set aria-controls.
    const controlsId = await combobox.getAttribute("aria-controls").catch(() => null);
    await combobox.click().catch(() => {});
    // aria-controls names the listbox element's OWN id directly (confirmed live), so this locator
    // already IS the listbox - no further .getByRole("listbox") needed on it. Only the fallback
    // (this.page, when a combobox doesn't set aria-controls) still needs that role query.
    const listbox = controlsId ? this.page.locator(`[id="${controlsId}"]`) : this.page.getByRole("listbox");
    // CONFIRMED LIVE (TC-PREQ-27, Payment Terms on a Create-PO-from-Request page): the "+
    // Create New ..." footer action is a static option that's already in the DOM the instant the
    // popover opens, while the field's REAL (fetched) options can attach a beat later - `.first()`
    // + `waitFor({ state: 'visible' })` re-polls the DOM, but it stops as soon as ANY match is
    // visible, so it can resolve to the footer link before the real options ever render and end up
    // opening its own "Add ..." modal instead of selecting a value. Exclude it so this only ever
    // waits for/clicks a genuine option.
    const firstOption = listbox
      .getByRole("option")
      .filter({ hasNot: this.page.locator("input") })
      .filter({ hasNotText: /Select|No data available|Create New/ })
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
    const listboxOptions = this.page
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasNot: this.page.locator("input") });

    // Prefer an exact-text match first - the plain-string `hasText` filter below is a substring
    // match, which silently picks the WRONG option whenever the live list has another entry that
    // merely contains optionText (confirmed live: Organization Structure's Designation list
    // includes "HR branch Manager1" alongside a literal "Manager" option - a substring filter's
    // .first() picked "HR branch Manager1" because it happened to render earlier in DOM order).
    // Only fall back to the substring filter if no exact match ever appears, preserving existing
    // behavior for every other caller's option text (icons/whitespace variants, etc.).
    const escaped = optionText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const exactOption = listboxOptions
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) })
      .first();
    const substringOption = listboxOptions
      .filter({ hasText: optionText })
      .first();

    let option = exactOption;
    try {
      await expect(option).toBeVisible({ timeout: Math.min(3000, timeout) });
    } catch (e) {
      option = substringOption;
      try {
        await expect(option).toBeVisible({
          timeout: Math.max(timeout - 3000, 1000),
        });
      } catch (e2) {
        return false;
      }
    }
    await option.scrollIntoViewIfNeeded().catch(() => {});
    await option.click();
    await expect(this.page.getByRole("listbox"))
      .not.toBeVisible({ timeout: 5000 })
      .catch(() => {});
    return true;
  }

  // Name-based lookup: works while a combobox's accessible name is still its "Search X"/"Select
  // X" placeholder prompt. `tryFill` covers the modules whose combobox is itself a text input
  // (typing narrows the option list) - swallowed because not every module's combobox accepts
  // typed input, and forcing it there would throw before the option click ever runs.
  async openDropdownAndPick(
    placeholder,
    optionText,
    { tryFill = false, timeout = 10000 } = {},
  ) {
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

    const available = await this.page
      .getByRole("listbox")
      .getByRole("option")
      .allTextContents();
    throw new Error(
      `openDropdownAndPick("${placeholder}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(
        available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()),
      )}`,
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
    { exact = true, scope = this.page.getByRole("main"), timeout = 10000 } = {},
  ) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, "i");
    const fieldContainer = scope
      .getByText(exact ? labelText : labelRegex, { exact })
      .first()
      .locator("xpath=..");
    const combobox = fieldContainer.getByRole("combobox").first();
    return this.selectInCombobox(combobox, optionText, {
      timeout,
      labelForError: labelText,
    });
  }

  // Extracted from selectFieldByLabel so a page object whose fields need a differently-scoped
  // combobox lookup (e.g. OrganizationStructurePage.sidebarFieldCombobox, where the label's own
  // parent isn't a safe scope - see that file for why) can reuse this same click/retry/typing
  // logic against an already-resolved combobox locator instead of duplicating it.
  async selectInCombobox(
    combobox,
    optionText,
    { timeout = 10000, labelForError = "" } = {},
  ) {
    const textVal = ((await combobox.textContent()) || "")
      .replace(/[\u200B\uFEFF]/g, "")
      .trim();
    const inputVal = ((await combobox.inputValue().catch(() => "")) || "")
      .replace(/[\u200B\uFEFF]/g, "")
      .trim();
    const currentValue = textVal || inputVal;
    if (
      currentValue === optionText ||
      (optionText && currentValue.includes(optionText))
    ) {
      return;
    }

    await combobox.click();
    let found = await this.selectOptionFromListbox(optionText, {
      timeout: Math.min(3000, timeout),
    });
    if (found) return;

    // Try typing/searching for the option if it wasn't found in the initial open list
    try {
      const input = combobox.locator("input").first();
      if (await input.isVisible()) {
        await input.fill(optionText);
      } else {
        await combobox.fill(optionText);
      }
      await this.page.waitForTimeout(500); // small delay for filter request
      found = await this.selectOptionFromListbox(optionText, {
        timeout: Math.max(5000, timeout - 3000),
      });
      if (found) return;
    } catch (e) {
      // Swallowed: combobox or input may not be editable
    }

    const available = await this.page
      .getByRole("listbox")
      .getByRole("option")
      .allTextContents();
    throw new Error(
      `selectFieldByLabel("${labelForError}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(
        available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()),
      )}`,
    );
  }

  // For required fields whose exact live option text in a given account's master data is
  // unverified, pick whatever renders first in the popover rather than guessing a literal string
  // that may not exist.
  async selectFirstOptionByLabel(
    labelText,
    { scope = this.page.getByRole("main") } = {},
  ) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, "i");
    const combobox = scope
      .getByText(labelRegex)
      .first()
      .locator("xpath=..")
      .getByRole("combobox")
      .first();
    return this.selectFirstAvailableOption(combobox);
  }

  // `scope` defaults to 'main' (the original, still-correct default for every plain-form module),
  // but a Drawer/sidebar-based Location field (e.g. Organization Structure's node sidebars) may
  // render outside the main landmark - pass that sidebar's own locator as `scope` in that case.
  // `combobox` lets a caller pass its own pre-resolved trigger locator instead of the generic
  // "Location" label lookup - needed for fields whose label can render under a broken/untranslated
  // i18n key (e.g. Procurement Request/RFQ's own Location field) where a plain "Location" text
  // match would miss it entirely.
  async createLocationFromFooter(
    locationName,
    companyName,
    { scope = this.page.getByRole("main"), combobox } = {},
  ) {
    if (!combobox) {
      const escapedLabel = "Location".replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, "i");
      const container = scope.getByText(labelRegex).first().locator("xpath=..");
      combobox = container.getByRole("combobox").first();
    }

    // 1. Close any open dropdown before clicking (if listbox is already visible, clicking the
    // combobox will fail with pointer interception) - same pattern ProcurementRequestPage.selectLocation
    // uses for recovery (confirmed live fix across document-style modules). A single Escape isn't
    // always enough: a field's own debounced search request can still be in flight and re-open its
    // popover asynchronously moments later, independent of Escape having closed it a beat earlier
    // (same root cause documented on ProcurementRequestPage.closeAnyOpenPopover) - retry the close
    // instead of firing Escape once and hoping it sticks.
    for (let i = 0; i < 3; i++) {
      const openListbox = this.page.getByRole("listbox");
      if (!(await openListbox.isVisible().catch(() => false))) break;
      await this.page.keyboard.press("Escape").catch(() => {});
      await this.page
        .locator("body")
        .click({ position: { x: 2, y: 2 }, force: true })
        .catch(() => {});
      await openListbox.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
    }

    // 2. Click the combobox to open the listbox
    await combobox.click();

    // 3. Click "+ Create New Location" from the footer - the SAME broken-i18n-key bug that can
    // make the field's own label read "crm.salesOrder.fields.location_label *" (see
    // selectLocation's comment) also affects this footer link on Purchase Order specifically
    // (confirmed live: renders literally as "+ Create New crm.salesOrder.fields.location_label"),
    // so match on "Create New" alone rather than the full "Create New Location" string - there's
    // only ever one such footer link in an open popover at a time.
    await this.page.getByText(/Create New/i).click();

    // 4. Wait for the dialog to be visible
    const dialog = this.page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });

    // 5. Fill in Location Name and a unique Location Code. This dialog's own translation
    // namespace (inventory.item.locationModal) can fail to load on some routes (confirmed live
    // on Purchase Order specifically) - title/labels/placeholders all render as raw i18n keys
    // ("inventory.item.locationModal.location_name_placeholder" instead of "Enter Name"), unlike
    // every other module using this same footer action. Fall back to the dialog's first/second
    // text input by position when the expected placeholder isn't there at all.
    const nameField = dialog.getByPlaceholder("Enter Name");
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill(locationName);
    } else {
      await dialog.locator('input[type="text"]').nth(0).fill(locationName);
    }

    const code = "LOC-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    const codeField = dialog.getByPlaceholder("Enter Short Code");
    if (await codeField.isVisible().catch(() => false)) {
      await codeField.fill(code);
    } else {
      await dialog.locator('input[type="text"]').nth(1).fill(code);
    }

    // 6. Select Entity (Company) inside the dialog - MUST match the outer form's own currently
    // selected company (the `companyName` argument, usually resolved by the caller via
    // getSelectedCompany()), not just "whatever's first available": the outer form's own
    // Location field is itself scoped to its currently-selected company
    // (filterFields="company_id") - confirmed live that a location created under a DIFFERENT
    // entity than the outer form's selection never appears in that field's option list
    // afterward, no matter how long you wait or how many times you reopen it (a real permanent
    // cross-entity scoping mismatch, not a timing/indexing issue). Try companyName itself first;
    // only fall back to "first available" (then this account's own single real entity,
    // "Trootech") if companyName isn't a real option here - e.g. "erp-force" is this suite's
    // pinned entity name for its other, remote environment, not this local one.
    try {
      await this.selectFieldByLabel("Entity", companyName, {
        exact: false,
        scope: dialog,
        timeout: 5000,
      });
    } catch (e) {
      try {
        await this.selectFirstOptionByLabel("Entity", { scope: dialog });
        // Verify it was actually selected (not just opening the dropdown) - this field is a MUI
        // div-based combobox, not a real <input>/<textarea>/<select>, so `.inputValue()` (used
        // here previously) THROWS unconditionally regardless of whether selection succeeded
        // (confirmed live: "Node is not an <input>, <textarea> or <select> element" fires even
        // immediately after a real, correct selection) - read the combobox's displayed text
        // instead and check it's no longer the placeholder.
        const entityCombobox = dialog
          .getByText(/^Entity\s*\*?$/, { exact: false })
          .first()
          .locator("xpath=..")
          .getByRole("combobox")
          .first();
        const selectedText = ((await entityCombobox.textContent().catch(() => "")) || "").trim();
        if (!selectedText || /^(Select|Search)\s/i.test(selectedText)) {
          throw new Error(
            "Entity field still shows its placeholder after selectFirstOptionByLabel",
          );
        }
      } catch (e2) {
        await this.selectFieldByLabel("Entity", "Trootech", {
          exact: false,
          scope: dialog,
          timeout: 5000,
        });
      }
    }

    // 7. Save the new location
    await dialog.getByRole("button", { name: "Save" }).click();

    // 8. Wait for the dialog to close
    await dialog.waitFor({ state: "hidden" });

    // 9. Select the newly created location from the open listbox
    const selected = await this.selectOptionFromListbox(locationName, {
      timeout: 7000,
    });
    if (!selected) {
      // Ensure any dialog/backdrop is fully hidden/detached before manual selection fallback
      await this.page
        .waitForSelector(".MuiDialog-root", {
          state: "detached",
          timeout: 5000,
        })
        .catch(() => {});
      await this.page
        .waitForSelector(".MuiBackdrop-root", {
          state: "detached",
          timeout: 5000,
        })
        .catch(() => {});
      // Re-open the SAME combobox resolved above (not a fresh "Location" label lookup, which
      // would miss a broken/untranslated label) and retry the selection directly.
      // Close any lingering dropdowns first, same as the initial click (step 1).
      await this.page.keyboard.press("Escape").catch(() => {});
      await combobox.click();
      const found = await this.selectOptionFromListbox(locationName, {
        timeout: 7000,
      });
      if (!found) {
        throw new Error(
          `createLocationFromFooter("${locationName}"): created but never appeared selectable in the dropdown.`,
        );
      }
    }
  }

  // Shared helper for modal DynamicSearchSelect fields (PO item/expense modals, GRN traceability
  // Bin dropdown), whose label renders as a Typography (data-name), NOT a real <label>, and whose
  // <input> carries no name - so resolve the combobox structurally off the label text within the
  // given `modal`/dialog scope. `value === true` -> pick the first real option (for required
  // fields whose exact option text is unverified in this account); a string -> pick that option.
  async selectModalDropdown(modal, labelText, value = true) {
    const combobox = modal
      .getByText(new RegExp(`^${labelText}`, "i"))
      .first()
      .locator("xpath=..")
      .getByRole("combobox")
      .first();
    if (value === true) {
      await this.selectFirstAvailableOption(combobox);
    } else {
      await combobox.click();
      await this.selectOptionFromListbox(String(value), { timeout: 7000 });
    }
    await this.page.waitForTimeout(200);
  }

  // Structural lookup for a plain text/number/date input whose visible "label" is a plain <p>,
  // NOT a real MUI-associated <label> (confirmed live on Leave Policy Master: the paragraph and
  // its `<input>` are sibling DOM nodes with no `for`/`aria-labelledby` link at all) - getByLabel()
  // never matches these, and some of these inputs (e.g. a number spinbutton with no placeholder)
  // have no other accessible name either, so getByPlaceholder isn't a full substitute. Same
  // trailing-required-asterisk handling as selectFieldByLabel/selectFirstOptionByLabel above.
  // Apply this ANY time getByLabel/getByPlaceholder times out on a plain input field in a new
  // module - it's the same underlying app pattern, not a one-off Leave Policy Master quirk.
  fieldInputByLabel(labelText, { scope = this.page.getByRole("main") } = {}) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
    return scope
      .getByText(labelRegex)
      .first()
      .locator("xpath=..")
      .locator("input")
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

  // Summary sidebar accordion value reader (View/Edit right panel), shared across every
  // document-style module (Procurement Request/Purchase Agreement/Purchase Order/GRN). The
  // summary label strings are hardcoded literals passed through t() with no matching i18n key,
  // so several render verbatim with baked-in trailing whitespace (e.g. "Grand Total ",
  // "Subtotal Excluding Taxes ") or typos ("Total Taxes and Charges Addeds") - match structurally
  // via a trimmed, whitespace-tolerant regex rather than an exact string, and read the value node
  // that immediately follows the label. Callers pass the label trimmed (e.g. "Grand Total").
  async getSummaryValue(label) {
    const escaped = label.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escaped}\\s*$`, "i");
    const text = await this.page
      .getByText(labelRegex)
      .first()
      .locator("xpath=./following::*[1]")
      .first()
      .textContent();
    return (text ?? "").trim();
  }

  // Combobox-based fields (Entity, Purchase Representative, Vendor, Currency, Location,
  // Department) show their selected value as the combobox's own visible/accessible text. MUI's
  // clear-selection icon button leaves a stray zero-width space in innerText(). .first() guards
  // against a label that also appears elsewhere on the page (e.g. a read-only Summary sidebar).
  // CONFIRMED LIVE (Purchase Order's Edit form): a required field's label bakes in a trailing "*"
  // in the SAME text node ("Vendor *"), unlike the read-only View page's own label for the same
  // field (plain "Vendor", no asterisk - see getFieldValueOnView) - an exact:true match against
  // the bare label alone finds ZERO matches there and hangs. The tolerant regex is a strict
  // superset of the old exact match (a label with no asterisk still matches identically), so this
  // is safe as the new default for every existing caller.
  async getEditComboboxValue(label) {
    const escapedLabel = label.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, "i");
    const valueLocator = this.page
      .getByText(labelRegex)
      .first()
      .locator("xpath=following-sibling::*[1]");
    // The combobox briefly renders "Loading..." right after navigating to Edit, while its linked
    // value resolves asynchronously - reading innerText() immediately can race that and capture
    // the placeholder instead of the real value (confirmed live: TC-VRA-06 intermittently read
    // back "Loading..." for Vendor).
    await expect(valueLocator)
      .not.toHaveText(/^Loading\.\.\.$/i, { timeout: 8000 })
      .catch(() => {});
    const text = await valueLocator.innerText();
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

  // ---------- Stuck-loading recovery (shared DynamicSelect-family bug) ----------
  // A DynamicSearchSelect field's dependent-fetch chain (Vendor cascading into Entity/Currency/
  // Purchase Representative, etc.) can get stuck showing "Loading..." indefinitely on a bare page
  // load/navigation, not just after a user-driven re-selection (confirmed live, TC-RFQ-09: the
  // Edit RFQ page loaded with Vendor/Entity/Currency/Purchase Representative ALL permanently stuck
  // on "Loading..." with a spinning progressbar, no interaction needed to trigger it - this is the
  // same class of "isAlreadyLoaded stuck true" bug already documented on this file's dropdown
  // helpers, just triggered by a page load race instead of a sibling-field re-render race). Once
  // stuck, the underlying component keeps re-rendering (the spinner never actually stops), which
  // makes ANY Playwright locator action targeting that region hang until the full test timeout -
  // and a hard test timeout in this suite's own convention restarts the whole worker, wiping every
  // shared `let` in the spec file and cascading the failure through every later test (confirmed
  // live: TC-RFQ-09's own timeout here left `editRfq`/`approvedRfq` undefined for TC-RFQ-10 through
  // TC-RFQ-13 and the Listing Page block, none of which touch this bug directly). A single page
  // reload reliably clears the stuck fetch (a fresh initial load, not a re-render) - callers that
  // land on a form where dependent fields might still be resolving should call this right after
  // their own "form is ready" wait, BEFORE any locator action can get stuck on a still-loading
  // field. Generic and reusable across every module built on this DynamicSelect component, not
  // RFQ-specific - wire it into any new module's own gotoAdd()/gotoEdit()/gotoView() too.
  async recoverFromStuckLoadingFields({ timeout = 8000 } = {}) {
    const loading = this.page.getByText("Loading...", { exact: true }).first();
    if (!(await loading.isVisible().catch(() => false))) return;

    try {
      await expect(loading).not.toBeVisible({ timeout });
    } catch (e) {
      await this.page.reload();
      await this.page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {});
    }
  }

  // ---------- Dialog/Backdrop recovery (shared MUI Dialog pattern) ----------
  // A MUI Dialog's own close animation/backdrop teardown doesn't always finish before the next
  // synchronous test step runs - `expect(modal).not.toBeVisible()` right after a Save/Cancel only
  // proves the dialog ITSELF left the accessibility tree, not that its backdrop/container div has
  // fully detached from the DOM (confirmed live, TC-RFQ-15: clicking a row's edit icon right after
  // a PRIOR item modal closed kept intercepting on a lingering "MuiDialog-container"/
  // "MuiBackdrop-root" from that prior modal, for the full 90s test timeout - same underlying
  // class of issue as ProcurementRequestPage's own closeAnyOpenPopover(), just for a Dialog instead
  // of a dropdown popover). Retrying the whole click against a freshly re-resolved backdrop check
  // is what actually recovers, not waiting longer on the same attempt.
  async dismissLingeringDialog() {
    const backdrop = this.page
      .locator(".MuiDialog-root, .MuiBackdrop-root")
      .first();
    if (await backdrop.isVisible().catch(() => false)) {
      await this.page.keyboard.press("Escape").catch(() => {});
      await backdrop
        .waitFor({ state: "hidden", timeout: 3000 })
        .catch(() => {});
    }
  }

  // Generic retry-click wrapper for any action that can race a lingering dialog/backdrop from a
  // just-closed modal (opening the "Add Item" modal, a row's edit icon, etc.) - `locatorFactory`
  // is called fresh on every attempt (not a single captured locator) so a stale reference from a
  // failed attempt is never reused. Reusable across every module, not just RFQ/Procurement
  // Request's own item-modal flows.
  async clickWithDialogRetry(
    locatorFactory,
    { attempts = 4, timeout = 5000 } = {},
  ) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.dismissLingeringDialog();
      try {
        await locatorFactory().click({ timeout });
        return;
      } catch (e) {
        if (attempt === attempts) throw e;
      }
    }
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
    const caret = this.page.getByRole("button", {
      name: "select merge strategy",
    });
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
  // menuitem-role lookup) so all three approval actions share this one retry path. `name` can be a
  // string or RegExp (Playwright's own getByRole/getByText `name` option accepts both - `exact`
  // is simply ignored when it's a RegExp), so callers with an uncertain/partial label (e.g. RFQ's
  // Create > Order/Response menu) can reuse this without needing an exact string match. `.first()`
  // disambiguates a label that could match more than one rendered element.
  async clickSubmitMenuItem(name, { byText = false } = {}) {
    const locatorFor = () =>
      (byText
        ? this.page.getByText(name, { exact: true })
        : this.page.getByRole("menuitem", { name, exact: true })
      ).first();
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
    const searchBtn = this.page
      .getByRole("button", { name: "Add" })
      .first()
      .locator("xpath=preceding-sibling::button[2]");
    // The icon click opens an MUI Menu (action-bar.tsx) whose open transition can occasionally
    // swallow a single click with no visible effect (confirmed live: same click, same button,
    // works on retry) - retry a few times rather than burning the whole budget on one attempt.
    // Gating the click behind its own isVisible() check is itself unreliable (confirmed live:
    // isVisible() reported false on this exact button in the same instant a direct .click() with
    // its own actionability wait succeeded) - call click() directly and let its built-in wait/retry
    // do the actionability check, rather than skipping the click on a flaky pre-check.
    for (let attempt = 0; attempt < 3; attempt++) {
      await searchBtn.click({ timeout: 4000 }).catch(() => {});
      const opened = await searchInput
        .waitFor({ state: "visible", timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (opened) break;
    }
    await searchInput.click().catch(() => {});
    await this.page.waitForTimeout(300);
    return searchInput;
  }

  async searchList(term) {
    if (!term) {
      console.warn("searchList() skipped: term is undefined or empty");
      return;
    }
    const searchInput = await this.ensureSearchInputOpen();
    const encodedTerm = encodeURIComponent(term ?? "");
    const [response] = await Promise.all([
      this.page
        .waitForResponse((r) => r.url().includes(`search=${encodedTerm}`), {
          timeout: 10000,
        })
        .catch(() => null),
      searchInput.fill(term),
    ]);
    if (response) {
      await this.page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {});
      // await this.waitForNetworkIdle();
    } else {
      // Fallback if no matching response was observed (e.g. searching for an empty string).
      await this.page.waitForTimeout(800);
    }
    // Dismiss the search popover by clicking safely outside at the top-left of the page, past the sidebar.
    await this.page
      .locator("body")
      .click({ position: { x: 300, y: 10 }, force: true })
      .catch(() => {});
    await this.page
      .locator(".MuiPopover-root, .MuiMenu-root")
      .first()
      .waitFor({ state: "hidden", timeout: 3000 })
      .catch(() => {});
    // CONFIRMED LIVE (TC-PREQ-L01): SearchBar (erpforce-common-hub-fe) recreates its debounced
    // search callback in a useEffect keyed on the parent's own `handleSearch` reference, and that
    // effect's cleanup cancels whatever debounce is still pending - a second searchList() call
    // fired right after this one's own result-driven re-renders are still trickling in reliably
    // lands its own debounced call in that cancel/recreate window and never fires a request at
    // all (reproduced 3/3 runs with no pause; 0/1 once callers give the UI ~2s to settle first).
    // Let it settle here, once, so every caller (not just back-to-back searches) is covered.
    await this.page.waitForTimeout(1500);
  }

  async clearSearch() {
    const searchInput = await this.ensureSearchInputOpen();
    await searchInput.fill("");
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // await this.waitForNetworkIdle();
    // Dismiss the search popover by clicking safely outside at the top-left of the page, past the sidebar.
    await this.page
      .locator("body")
      .click({ position: { x: 300, y: 10 }, force: true })
      .catch(() => {});
    await this.page
      .locator(".MuiPopover-root, .MuiMenu-root")
      .first()
      .waitFor({ state: "hidden", timeout: 3000 })
      .catch(() => {});
  }

  async getFirstRowSeriesNumber() {
    const firstRowLink = this.page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(2)
      .locator("a");
    return (await firstRowLink.innerText().catch(() => "")).trim();
  }

  // t('common.noData') = "No Data" - rendered inside a Box.no-data (an image + this text), not
  // a real <tr>, by the shared MaterialTable's renderEmptyRowsFallback when the filtered result
  // set is empty.
  noDataRow() {
    return this.page.getByText("No Data", { exact: true });
  }

  // `exact` defaults to false (unchanged for every existing caller's single-word column names),
  // but a module whose grid has multiple columns sharing a common substring (CONFIRMED LIVE:
  // Purchase Order's "Date"/"Confirmation Date"/"Expected Receipt Date" columns all
  // substring-match a bare name:"Date" lookup, strict-mode-violating) needs exact:true to
  // disambiguate - opt in per call rather than changing the shared default.
  columnHeader(name, { exact = false } = {}) {
    return this.page.getByRole("columnheader", { name, exact });
  }

  async getColumnAriaSort(name, opts) {
    return this.columnHeader(name, opts).getAttribute("aria-sort");
  }

  async clickColumnHeader(name, opts) {
    await this.columnHeader(name, opts).click();
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
    await this.page
      .locator(".pagination")
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {});
    await this.page
      .locator(
        ".MuiSkeleton-root, .MuiCircularProgress-root, .MuiLinearProgress-root, [role='progressbar']",
      )
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
    await this.page
      .getByRole("option", { name: String(size), exact: true })
      .click();
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // await this.waitForNetworkIdle();
  }

  // ---------- Filters (shared filter.tsx, react-querybuilder + QueryBuilderMaterial) ----------
  // WRITTEN FROM SOURCE (erpforce-common-hub-fe/src/components/filter/filter.tsx +
  // components/{field-select,operator-select,value-editor,add-filter}.tsx), NOT YET LIVE-VERIFIED
  // against a real filter row - same "unverified live" caveat this repo already uses for
  // VendorReturnAuthorizationPage. This is a generic AND/OR rule-builder, not a fixed panel of
  // named per-field inputs: a rule is built by picking a Field, then an Operator, then a Value
  // whose editor type (select/date/text) depends on that field's schema-declared inputType.
  async openFilters() {
    await this.page
      .getByRole("button", { name: "Filter", exact: true })
      .click();
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
    await this.filterDialog()
      .getByRole("button", { name: "Add Filter" })
      .click();
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
    await this.filterDialog()
      .getByRole("button", { name: "Apply", exact: true })
      .click();
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // await this.waitForNetworkIdle();
  }

  async closeFilterDialog() {
    await this.filterDialog()
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
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
    await this.page
      .getByRole("button", { name: "Clear Filter", exact: true })
      .click();
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // await this.waitForNetworkIdle();
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
