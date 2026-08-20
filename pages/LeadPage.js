const { expect } = require('@playwright/test');
const { selectDropdown } = require('../helpers/dropdown');

class LeadPage {
  constructor(page) {
    this.page = page;

    // Basic Details tab
    this.companyNameInput      = page.getByPlaceholder('Enter lead company Name');
    this.phoneInput             = page.getByPlaceholder('Enter Phone Number').first();
    this.emailInput             = page.getByPlaceholder('Enter Email ID').first();
    this.vatInput               = page.getByPlaceholder('Enter VAT Number');
    this.crnInput                = page.getByPlaceholder('Enter CRN Number');
    this.responsiblePersonInput = page.locator('input[name="lead.responsible_person"]');

    // Lead Status and (as of a recent live app change) Priority can both arrive on the Add Lead
    // form PRE-SELECTED to a default value ("Cold Call"/"Medium" confirmed live), so their
    // combobox never has the placeholder accessible name ("Search Lead Status"/"Search
    // Priority") to match against once filled (same problem on Edit, where it always shows the
    // current value) - a name-based locator resolves to zero elements and hangs. Locate every
    // select here structurally instead, via its own label paragraph's container, same fix
    // already proven for Lead Status - this also makes selectDropdownIfNeeded's own emptiness
    // check reliable, since these locators now always resolve to something.
    const byLabel = (label) => page.getByText(label, { exact: true }).first().locator('xpath=..').getByRole('combobox').first();
    this.leadStatusDropdown = byLabel('Lead Status');
    this.priorityDropdown   = byLabel('Priority');
    this.sourceDropdown     = byLabel('Source');
    this.industryDropdown   = byLabel('Industry');
    this.locationDropdown   = byLabel('Location');
    this.departmentDropdown = byLabel('Department');
    // CONFIRMED LIVE (inspection run): "Entity"/"Currency"/"Salesperson" combobox triggers are
    // found the same structural way as the labels above, but their own label text carries a
    // required-asterisk suffix ("Entity *") rather than being exact - byLabel()'s exact match
    // would never resolve, so these three use their own startsWith-style text locator instead.
    const byRequiredLabel = (label) => page.getByText(label, { exact: false }).first().locator('xpath=..').getByRole('combobox').first();
    this.entityDropdown      = byRequiredLabel('Entity *');
    this.currencyDropdown    = byRequiredLabel('Currency *');
    this.salespersonDropdown = byRequiredLabel('Salesperson *');

    // Type radio (Company/Individual) - CONFIRMED LIVE: Company is pre-checked by default: the
    // Individual-only fields (First/Middle/Last Name) only render after clicking "Individual".
    this.companyTypeRadio    = page.getByText('Company', { exact: true }).first();
    this.individualTypeRadio = page.getByText('Individual', { exact: true }).first();
    this.firstNameInput  = page.locator('input[name="lead.first_name"]');
    this.middleNameInput = page.locator('input[name="lead.middle_name"]');
    this.lastNameInput   = page.locator('input[name="lead.last_name"]');

    // Follow Up modal - the header's own "Add" button (address rows have their
    // own Add too, further down), so scope to .first() here.
    // CONFIRMED LIVE: a bare "first Add button on the page" guess can resolve to an unrelated
    // icon-only button (e.g. a column-reorder toggle) that has no text content but still matches
    // role=button - same class of ambiguous-"Add"-button issue already fixed for Opportunity's
    // Items table. Scope structurally to the button whose own text is literally "Add",
    // following the "Follow Up" section heading, so it can't drift onto some other control.
    this.followUpAddButton = page.getByText('Follow Up', { exact: true }).first()
      .locator('xpath=following::button[normalize-space(.)="Add"][1]');
    this.followUpTypeDropdown  = page.getByRole('combobox', { name: 'Search Follow Up Type' });
    this.remindMeDropdown      = page.getByRole('combobox', { name: 'Search Remind Me' });
    this.followUpSaveButton    = page.getByRole('button', { name: 'Save', exact: true }).last();

    // Log modal ("Add New Log" - opened from the Summary sidebar's Logs tab, present on Add/Edit/
    // View). Save is scoped to the currently-open dialog so it can never collide with the page's
    // own Save button.
    this.addLogButton = page.getByRole('button', { name: 'Add New Log', exact: true });
    this.logTitleInput = page.locator('input[name="logs.title"]');
    this.logCommunicationTypeDropdown = page.locator('[id="mui-component-select-logs.communication_type"]');
    this.logDateInput = page.locator('input[name="logs.date"]');
    this.logTimeInput = page.locator('input[name="logs.time"]');
    this.logSaveButton = page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true });

    // Tabs / navigation
    this.nextButton       = page.getByRole('button', { name: 'Next' });
    this.basicDetailsTab  = page.getByRole('tab', { name: 'Basic Details' });
    this.addressTab       = page.getByRole('tab', { name: 'Address' });
    this.contactTab       = page.getByRole('tab', { name: 'Contact' });

    // Address tab - the auto-generated address row is edited in place via its pencil/disk icon
    // buttons rather than through a modal. CONFIRMED LIVE: this is now a wide, horizontally-
    // scrolling table (Address Type, Addressee, Default shipping/Billing, Country Code, Contact
    // Number, Address 1/2/3, Zip Code, Country, State, City, Summary) - several columns
    // (Address 1/2/3) share the exact same "Enter Address" placeholder, so placeholder-order
    // locators silently target the wrong column. Every field below is resolved by column
    // position relative to its own header text instead (see cellByHeader()).
    this.addressRow = page.locator('table tbody tr').first();

    // CONFIRMED LIVE: a leftover row-level Save icon button (Address/Contact table) shares the
    // exact same accessible name "Save" - scope to the real submit button specifically so it
    // never collides with one of those.
    this.saveButton = page.locator('button[type="submit"][form="lead"]');
    this.saveAsDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });

    // List / view page - Actions menu (mirrors LocationPage's pattern)
    this.actionsButton      = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem       = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem  = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem     = page.getByRole('menuitem', { name: 'Delete' });
    // CONFIRMED AGAINST SOURCE (view-lead/components/header-buttons.tsx): when a Lead is a Draft,
    // Edit/Delete render as plain top-level buttons (no "Actions" dropdown at all) - only a
    // saved/non-draft Lead uses the Actions menu above.
    this.draftEditButton    = page.getByRole('button', { name: 'Edit', exact: true });
    this.draftDeleteButton  = page.getByRole('button', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });

    // companyNameRequiredError/phoneRequiredError/responsiblePersonRequiredError/
    // countryRequiredError/stateRequiredError/vatInvalidError are confirmed
    // against the live dev environment. emailInvalidError's regex also matched
    // real copy. duplicateNameError is still an unverified guess.
    this.companyNameRequiredError = page.getByText('Company is required', { exact: true });
    // The Phone input strips non-numeric characters as typed, so any invalid
    // value resolves to empty and surfaces this same required-field message.
    this.phoneRequiredError            = page.getByText('Phone number is required', { exact: true });
    this.responsiblePersonRequiredError = page.getByText('Responsible person is required', { exact: true });
    this.countryRequiredError     = page.getByText('Country is required', { exact: true });
    this.stateRequiredError       = page.getByText('State is required', { exact: true });
    this.emailInvalidError        = page.getByText(/valid email/i);
    this.emailRequiredError       = page.getByText('Email is required', { exact: true });
    this.vatInvalidError          = page.getByText('VAT number should have exactly 15 digits', { exact: true });
    this.crnInvalidError          = page.getByText(/CRN .*10 digits/i);
    this.duplicateNameError       = page.getByText(/lead company name already exists/i);
    this.entityRequiredError      = page.getByText(/Entity is required/i);
    this.salespersonRequiredError = page.getByText(/Salesperson is required/i);
    this.firstNameRequiredError   = page.getByText('First name is required', { exact: true });
    this.lastNameRequiredError    = page.getByText('Last name is required', { exact: true });
    this.responsiblePersonMinLengthError = page.getByText(/Responsible person must be at least/i);
  }

  async goto() {
    // CONFIRMED LIVE: same stuck-on-its-own-bare-loading-spinner class of bug as every other
    // module in this suite - a single networkidle wait can hang well past a generous timeout on
    // a cold first load, and only a reload recovers it.
    await this.page.goto('/dashboard/crm/orders/lead/add-lead', { timeout: 60000 });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.basicDetailsTab.waitFor({ state: 'visible', timeout: 15000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
  }

  // Guessed URL segment ('/lead' list, '/view-lead', '/edit-lead') follows the
  // same list/view-X/edit-X convention as LocationPage/AttributePage -
  // unverified against the live app, adjust if the real routes differ.
  async gotoList() {
    await this.page.goto('/dashboard/crm/orders/lead', { timeout: 60000 });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const rowLink = this.page.locator('tbody a[href*="/view-lead"]').first();
      const visible = await rowLink.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 4) return; // list can also legitimately be empty - don't hard-fail on that
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  async openView(companyName) {
    await this.gotoList();
    const companyText = this.page.getByText(companyName, { exact: true }).first();
    const visible = await companyText.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) {
      // CONFIRMED LIVE: this is a large, shared dataset - a freshly created Lead isn't guaranteed
      // to land on the list's default page/sort (same issue already documented/fixed elsewhere in
      // this suite, e.g. erpforce-rfq-full-workflow.spec.js's own gotoRfqListAndSearch). Search for
      // it explicitly via the list's own search toggle (BasePage.ensureSearchInputOpen's proven
      // pattern - LeadPage doesn't extend BasePage, so reimplemented inline here).
      const searchInput = this.page.getByPlaceholder('Search', { exact: true });
      if (!(await searchInput.isVisible().catch(() => false))) {
        await this.page.getByRole('button', { name: 'Add' }).first()
          .locator('xpath=preceding-sibling::button[2]').click();
        await searchInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      }
      await searchInput.click().catch(() => {});
      await this.page.waitForTimeout(300);
      await searchInput.fill(companyName).catch(() => {});
      // CONFIRMED LIVE elsewhere in this suite: this ActionBar search is debounced ~1.2s - a
      // fixed 800ms wait fires before the debounced request/re-render completes, especially on
      // this large, ever-growing shared dataset. Wait for the real target to actually appear
      // instead of guessing a timeout - the subsequent click below still needs a match to exist.
      await companyText.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    }
    await companyText.click();
    await this.page.waitForURL('**/view-lead');
    await this.page.waitForLoadState('networkidle');
  }

  // CONFIRMED AGAINST SOURCE (erpforce-fe modules/crm/src/views/orders/lead/view-lead/components/
  // header-buttons.tsx): this is THE real Lead->Opportunity link - there is no "lead_id" field on
  // the Opportunity form at all (linkingField.exists === false). "Convert" only renders once the
  // Lead is saved (is_draft falsy) and the user has Opportunity.canAdd; onClick does
  // `navigate(ADD_OPPORTUNITY, { state: { lead: data } })`, passing the full Lead record via
  // router state (NOT a URL param) - Add Opportunity then fetches the lead by id and pre-fills/
  // locks its Customer field to it. This only works as a real in-app navigation (clicking the
  // button), never by page.goto()'ing the Add Opportunity URL directly.
  async convertToOpportunity() {
    await this.page.getByRole('button', { name: 'Convert', exact: true }).click();
    await this.page.waitForURL('**/add-opportunity');
    // CONFIRMED LIVE: the URL changing doesn't mean the form itself has actually rendered yet -
    // this SPA can get genuinely STUCK on a blank page after this navigation (not just slow) - a
    // single wait, however generous, never resolves that, but a hard reload reliably recovers it
    // (same documented fix as erpforce-full-inventory-to-procurement.spec.js's own
    // waitVisibleWithReload). Retry with a reload rather than trust one wait.
    // Capped at ONE reload (not several).
    const closingDateLabel = this.page.getByText('Expected Closing Date', { exact: false }).first();
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await closingDateLabel.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 2) return;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  async openEdit(companyName) {
    await this.openView(companyName);
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-lead');
    await this.page.waitForLoadState('networkidle');
  }

  /** Direct-by-id navigation - see saveAndCaptureId()'s own comment on why this is preferred over openEdit(companyName). */
  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create step likely failed.`);
    await this.page.goto(`/dashboard/crm/orders/lead/${id}/edit-lead`, { timeout: 60000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async fillBasicDetails({ companyName, phone, email, vatNumber, crnNumber, responsiblePerson }) {
    if (companyName !== undefined) await this.companyNameInput.fill(companyName);
    if (phone !== undefined) {
      // CONFIRMED LIVE: phone number must be unique across Leads (same class of constraint as
      // Company Name) - config/testData.js's own phone fixtures are computed ONCE per test-run
      // process (a shared `ts`/`tsDigits`), so multiple tests that each complete a REAL create
      // using the same fixture object (e.g. TC-LEAD-02 and TC-LEAD-18 both use
      // testData.lead.minimal as-is) submit the IDENTICAL phone, and every create after the first
      // silently fails uniqueness. Only touch values that actually look like a real phone number
      // (all digits) - leave already-invalid negative-test fixtures (e.g. 'abcd') untouched so
      // this doesn't accidentally turn an intentionally-invalid input into a valid one.
      // Keep the same length/shape as the original (a single leading digit + 8 more), just
      // resolved fresh at fill-time instead of reusing testData.js's own require-time `ts` -
      // avoids exceeding whatever max-length validation the phone field itself enforces.
      const uniquePhone = /^\d+$/.test(phone) ? phone[0] + String(Date.now()).slice(-8) : phone;
      await this.phoneInput.fill(uniquePhone);
    }
    // NOTE: unlike phone, email is deliberately filled verbatim here, not auto-freshened -
    // TC-LEAD-01/03 assert the exact static testData.lead.valid.email text appears on the
    // created/viewed record, so silently mutating it here breaks those assertions. Where a real
    // duplicate-email collision actually exists across two separate real creates (TC-LEAD-15 vs
    // TC-LEAD-01, TC-LEAD-18 vs TC-LEAD-02), the affected test overrides `email` itself with a
    // unique value before calling fillBasicDetails, the same way TC-LEAD-18 already overrides
    // companyName.
    if (email !== undefined) await this.emailInput.fill(email);
    if (vatNumber !== undefined) await this.vatInput.fill(vatNumber);
    if (crnNumber !== undefined) await this.crnInput.fill(crnNumber);
    if (responsiblePerson !== undefined) await this.responsiblePersonInput.fill(responsiblePerson);
  }

  // CONFIRMED LIVE: selecting "Individual" swaps Company Name out for First/Middle/Last Name.
  async selectLeadType(type) {
    if (type === 'Individual') {
      await this.individualTypeRadio.click();
    } else {
      await this.companyTypeRadio.click();
    }
    await this.page.waitForTimeout(300);
  }

  async fillIndividualName({ firstName, middleName, lastName }) {
    if (firstName !== undefined) await this.firstNameInput.fill(firstName);
    if (middleName !== undefined) await this.middleNameInput.fill(middleName);
    if (lastName !== undefined) await this.lastNameInput.fill(lastName);
  }

  async selectEntity(value) {
    await this.selectDropdownIfNeeded(this.entityDropdown, value);
  }

  // CONFIRMED LIVE: Salesperson and Entity both arrive pre-filled ("Dipen Modi"/"erp-force" -
  // the logged-in user's own defaults) - to test either's "required" rule it must be actively
  // cleared first via the field's own clear (X) control rather than simply never touched.
  // CONFIRMED LIVE: the real control is a <button aria-label="clear selection"> holding a
  // CloseIcon svg, a sibling of the combobox inside the shared MuiInputBase-root wrapper - not
  // "Clear" (capital C, exact) as first guessed, which never matched anything.
  async clearMuiSelect(dropdown) {
    const clearBtn = dropdown.locator('xpath=..').getByRole('button', { name: 'clear selection' });
    await clearBtn.click();
    await this.page.waitForTimeout(300);
  }

  async clearSalesperson() {
    await this.clearMuiSelect(this.salespersonDropdown);
  }

  async clearEntity() {
    await this.clearMuiSelect(this.entityDropdown);
  }

  // CONFIRMED LIVE: Priority (and possibly other selects below) can now also arrive pre-filled
  // with a default value, the same "Cold Call" behavior this file's own leadStatusDropdown
  // comment already documents for Lead Status - once pre-filled, the trigger's accessible name
  // becomes the selected value itself ("Medium") instead of the placeholder ("Search Priority"),
  // so a bare selectDropdown() call targeting the placeholder-named locator never resolves to
  // anything and hangs for the full timeout. Same "only act when it actually differs" guard this
  // codebase already uses elsewhere (PurchaseInvoicePage.selectCurrencyIfNeeded,
  // erpforce-procure-to-pay.spec.js's selectFirstIfEmpty) - skip re-selecting a field that
  // already shows the desired value.
  async selectDropdownIfNeeded(combobox, value, opts = {}) {
    const currentText = ((await combobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
    if (currentText === value) return; // already the desired value - nothing to do
    await selectDropdown(this.page, combobox, value, value, opts);
  }

  async selectLeadStatus(value) {
    await this.selectDropdownIfNeeded(this.leadStatusDropdown, value);
  }

  async selectPriority(value) {
    await this.selectDropdownIfNeeded(this.priorityDropdown, value);
  }

  // CONFIRMED LIVE: this account's Source master data list is currently genuinely empty (no
  // options at all, not just missing the specific value requested) - optional so a run doesn't
  // hard-fail on a field that isn't actually required to save (no sourceRequiredError exists on
  // this page, unlike companyName/phone/responsiblePerson/country/state above).
  async selectSource(value) {
    await this.selectDropdownIfNeeded(this.sourceDropdown, value, { optional: true });
  }

  async selectIndustry(value) {
    await this.selectDropdownIfNeeded(this.industryDropdown, value);
  }

  async selectLocation(value) {
    await this.selectDropdownIfNeeded(this.locationDropdown, value);
  }

  async selectDepartment(value) {
    await this.selectDropdownIfNeeded(this.departmentDropdown, value);
  }

  async addFollowUp({ followUpType, remindMe }) {
    await this.followUpAddButton.click();
    await this.page.waitForTimeout(500);
    // CONFIRMED LIVE: this modal's Time field re-renders continuously (behaves like a live
    // clock), which keeps destabilizing sibling fields - Playwright's normal actionability wait
    // ("element is not stable") never settles, consuming the full action timeout no matter how
    // long a fixed wait goes first. Force the click to bypass that check, then drive the menu
    // directly via its own known id (mui-component-select-follow_up.follow_up_type ->
    // menu-follow_up.follow_up_type, same pairing convention as StockTransferPage.selectMuiField
    // elsewhere in this suite) instead of the shared selectDropdown() helper, which doesn't
    // support force.
    await this.followUpTypeDropdown.click({ force: true });
    const typeMenu = this.page.locator('[id="menu-follow_up.follow_up_type"]');
    await typeMenu.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    if (followUpType) {
      await typeMenu.getByText(followUpType, { exact: false }).first().click({ force: true }).catch(() => {});
    } else {
      await typeMenu.locator('li').nth(1).click({ force: true }).catch(() => {});
    }
    await this.page.waitForTimeout(300);

    if (remindMe) {
      await this.remindMeDropdown.click({ force: true }).catch(() => {});
      const remindMenu = this.page.locator('[id="menu-follow_up.remind_me"]');
      if (await remindMenu.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
        await remindMenu.getByText(remindMe, { exact: false }).first().click({ force: true }).catch(() => {});
      }
      await this.page.waitForTimeout(300);
    }
    await this.followUpSaveButton.click();
  }

  async selectLogCommunicationType(value) {
    await this.logCommunicationTypeDropdown.click({ force: true });
    const menu = this.page.locator('[id="menu-logs.communication_type"]');
    await menu.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    if (value) {
      await menu.getByText(value, { exact: false }).first().click({ force: true }).catch(() => {});
    } else {
      await menu.locator('li').nth(1).click({ force: true }).catch(() => {});
    }
    await this.page.waitForTimeout(300);
  }

  // Tab headers are always rendered regardless of which panel is active, so
  // waiting for the target tab to be visible doesn't confirm the click
  // actually switched tabs (observed: a blocked Next silently left the
  // previous tab active, and this.addressRow then matched the wrong table).
  // Assert aria-selected instead to confirm the switch really happened.
  // CONFIRMED LIVE: Next can silently swallow its first click (same react-hook-form Controller-
  // registration race documented on save()/TC-PE-VAL-01 elsewhere) even on an otherwise fully
  // valid, freshly-filled form with no visible error - retry once, same convention as save().
  // The settle wait BEFORE the aria-selected check matters: checking immediately after click()
  // resolves races the switch every time (before the DOM/state update renders), which on
  // Contact - the LAST tab - fired a pointless second click at a "Next" button that had already
  // disappeared once the switch actually succeeded, hanging for the full click timeout. The
  // retry click itself is best-effort for the same reason.
  async goToAddressTab() {
    await this.nextButton.click();
    await this.page.waitForTimeout(500);
    if (!(await this.addressTab.getAttribute('aria-selected').then((v) => v === 'true').catch(() => false))) {
      await this.nextButton.click().catch(() => {});
    }
    await expect(this.addressTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  }

  async goToContactTab() {
    await this.nextButton.click();
    await this.page.waitForTimeout(500);
    if (!(await this.contactTab.getAttribute('aria-selected').then((v) => v === 'true').catch(() => false))) {
      await this.nextButton.click().catch(() => {});
    }
    await expect(this.contactTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  }

  // Column position relative to its own header text, same index-lookup technique this suite
  // already uses for StockTransferPage's Track Detail column - reliable regardless of how many
  // other columns share an identical placeholder/label. Row-indexed so a second/third Address
  // row can be targeted too, not just the auto-generated first one.
  // CONFIRMED LIVE: this table also has its own "Country Code" column (the phone dial code, e.g.
  // "+64"), positioned BEFORE "Country" itself - a bare `^${headerText}` prefix match for
  // "Country" matches "Country Code" first (`.first()` picks whichever comes first in DOM order),
  // silently returning the wrong cell with no error (e.g. TC-LEAD-14's own Country/State-missing
  // negative test was unaffected since it never reads the cell back, but fillAddressRow's Country
  // handling below depends on this being right). The negative lookahead excludes that specific
  // collision (harmless for every other header here, none of which are followed by " Code")
  // without needing an exact end-anchor, since this table's own header text carries extra
  // trailing content of its own (a stray "0" observed via allTextContents()) that an exact
  // `$`-anchored match can't safely account for.
  async addressCellByHeaderForRow(rowIndex, headerText) {
    const index = await this.page.getByRole('columnheader', { name: new RegExp(`^${headerText}(?!\\sCode)`) }).first().evaluate(
      (th) => Array.from(th.parentElement.children).indexOf(th)
    );
    return this.addressRowAt(rowIndex).locator('td').nth(index);
  }

  async addressCellByHeader(headerText) {
    return this.addressCellByHeaderForRow(0, headerText);
  }

  addressRowAt(index) {
    return this.page.locator('table tbody tr').nth(index);
  }

  // CONFIRMED LIVE: the auto-generated row can start in either state - already editable
  // (Cancel/Save icons, real <input>s in each cell) or "saved" display mode (pencil/trash icons,
  // plain text) - click the row's first button (the pencil, when present) to guarantee edit mode
  // before any cell is filled. A harmless no-op if the row was already editable.
  async openAddressRowEditAt(index) {
    await this.addressRowAt(index).locator('button').first().click().catch(() => {});
    await this.page.waitForTimeout(300);
  }

  async openAddressRowEdit() {
    await this.openAddressRowEditAt(0);
  }

  // Second button in the row (once editable) is the Save (disk) icon.
  async saveAddressRowAt(index) {
    await this.addressRowAt(index).locator('button').nth(1).click();
  }

  async saveAddressRow() {
    await this.saveAddressRowAt(0);
  }

  // The Address table's own "Add" button, scoped to the Address tabpanel so it can't drift onto
  // Follow Up's or Log's own unrelated "Add" buttons elsewhere on the same page.
  // CONFIRMED LIVE: a row-action icon's own MUI tooltip (e.g. "Delete") can be left open/mid-
  // animation from whatever prior action just happened, and keeps intercepting pointer events on
  // anything nearby (including this Add button) well past its own hover - a neutral corner-click
  // dismisses it, same class of stray-popper issue documented elsewhere in this suite.
  async addAddressRow() {
    await this.page.mouse.move(2, 2);
    await this.page.mouse.click(2, 2);
    await this.page.waitForTimeout(300);
    const before = await this.page.locator('table tbody tr').count();
    await this.page.getByRole('tabpanel', { name: 'Address' }).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(this.page.locator('table tbody tr')).toHaveCount(before + 1, { timeout: 5000 });
  }

  async selectAddressTypeAt(rowIndex, value) {
    const cell = await this.addressCellByHeaderForRow(rowIndex, 'Address Type');
    const trigger = cell.getByRole('combobox').first();
    await this.selectDropdownIfNeeded(trigger, value);
  }

  async fillAddresseeAt(rowIndex, value) {
    const cell = await this.addressCellByHeaderForRow(rowIndex, 'Addressee');
    await cell.locator('input').fill(value);
  }

  async toggleDefaultShippingAt(rowIndex) {
    const cell = await this.addressCellByHeaderForRow(rowIndex, 'Default shipping address');
    await cell.locator('input[type="checkbox"]').click();
  }

  async toggleDefaultBillingAt(rowIndex) {
    const cell = await this.addressCellByHeaderForRow(rowIndex, 'Default Billing address');
    await cell.locator('input[type="checkbox"]').click();
  }

  // CONFIRMED LIVE: addAddressRow()'s new row lands directly in edit mode (no openAddressRowEdit
  // needed) at index 0, with the PREVIOUSLY-first row pushed down to index 1 - fields are unique
  // in the DOM since only one Address row is ever mid-edit at a time, so these operate directly
  // on `name=`/placeholder-text rather than needing a row index. Unlike row 0's own Country
  // (which arrives pre-filled to "India"), this new row's Country and State both start genuinely
  // empty ("Select country"/"Select state") and need real selection, not just a skip-if-filled
  // check.
  async fillNewAddressRow({ addressType, addressee, address1, country, state, city }) {
    if (addressType) {
      await selectDropdown(this.page, this.page.locator('[id="mui-component-select-address_type"]'), addressType, addressType);
    }
    if (addressee !== undefined) await this.page.locator('input[name="contact_name"]').fill(addressee);
    if (address1 !== undefined) await this.page.locator('input[name="street_1"]').fill(address1);
    if (city !== undefined) await this.page.locator('input[name="city"]').fill(city);
    if (country) {
      await selectDropdown(this.page, this.page.locator('[id="mui-component-select-country"]'), country, country);
    }
    if (state) {
      await selectDropdown(this.page, this.page.locator('[id="mui-component-select-state"]'), state, state);
    }
  }

  async toggleNewRowDefaultShipping() {
    await this.page.locator('input[name="default_shipping_address"]').click();
  }

  async toggleNewRowDefaultBilling() {
    await this.page.locator('input[name="default_billing_address"]').click();
  }

  async saveNewAddressRow() {
    await this.addressRowAt(0).getByRole('button', { name: 'Save', exact: true }).click();
  }

  async cancelNewAddressRow() {
    await this.addressRowAt(0).getByRole('button', { name: 'Cancel', exact: true }).click();
  }

  // Contact table - same "Add prepends a new, already-editable row at index 0" pattern
  // confirmed live for the Address table above.
  // CONFIRMED LIVE: the "No Data" empty-state itself renders as its own placeholder <tr> - when
  // the table starts genuinely empty, clicking Add REPLACES that placeholder with the new
  // editable row rather than adding alongside it, so a bare "row count + 1" check breaks in that
  // case. Count only real rows (excluding "No Data") both before and after.
  async addContactRow() {
    await this.page.mouse.move(2, 2);
    await this.page.mouse.click(2, 2);
    await this.page.waitForTimeout(300);
    const tabpanel = this.page.getByRole('tabpanel', { name: 'Contact' });
    const realRows = () => tabpanel.locator('table tbody tr').filter({ hasNotText: 'No Data' });
    const before = await realRows().count();
    await tabpanel.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(realRows()).toHaveCount(before + 1, { timeout: 5000 });
  }

  async fillNewContactRow({ name, email }) {
    const tabpanel = this.page.getByRole('tabpanel', { name: 'Contact' });
    if (name !== undefined) await tabpanel.locator('input[name="name"]').fill(name);
    if (email !== undefined) await tabpanel.locator('input[name="email"]').fill(email);
  }

  contactRowAt(index) {
    return this.page.getByRole('tabpanel', { name: 'Contact' }).locator('table tbody tr').nth(index);
  }

  async saveNewContactRow() {
    await this.contactRowAt(0).getByRole('button', { name: 'Save', exact: true }).click();
  }

  async fillAddressRow({ address1, address2, zipCode, country, state, city }) {
    await this.openAddressRowEdit();

    if (address1 !== undefined) await (await this.addressCellByHeader('Address 1')).locator('input').fill(address1);
    if (address2 !== undefined) await (await this.addressCellByHeader('Address 2')).locator('input').fill(address2);
    if (zipCode !== undefined) await (await this.addressCellByHeader('Zip Code')).locator('input').fill(zipCode);
    if (city !== undefined) await (await this.addressCellByHeader('City')).locator('input').fill(city);

    // CONFIRMED LIVE: Country arrives pre-filled to SOME default - previously "India", observed
    // as "Afghanistan" more recently (this environment's own default apparently drifts over time,
    // same class of live-data-drift issue seen elsewhere in this suite, e.g. Accounting's
    // Currency fallback picking whatever's first). Since State is only ever a valid State/
    // Province for WHATEVER country is currently selected, an unselected `country` param here
    // silently breaks any caller whose `state` value only matches a different country than the
    // live default - confirmed live: this blocks the Address row from ever validating, with no
    // visible error until Next is clicked and the row is inspected directly. Actively select
    // Country whenever the caller specifies one, instead of trusting the pre-fill. Both dropdowns
    // are the same DynamicSelect-family combobox `helpers/dropdown.js`'s selectDropdown() already
    // handles elsewhere in this suite (id="mui-component-select-country"/"...-state", confirmed
    // live) - reuse it directly rather than hand-rolling the same open/search/click/fallback
    // sequence again. CONFIRMED LIVE: an earlier hand-rolled version of this that opened the
    // dropdown but never typed into its own search box silently fell back to whatever renders
    // first in the long, unfiltered (likely virtualized) options list - "Afghanistan" sorts first
    // alphabetically - even when 'United Arab Emirates' genuinely exists further down; always
    // search by the target text so selectDropdown's own exact-match check actually has a chance.
    if (country !== undefined) {
      const countryTrigger = (await this.addressCellByHeader('Country')).locator('[role="combobox"]').first();
      await selectDropdown(this.page, countryTrigger, country, country, { optional: true });
    }

    if (state !== undefined) {
      const stateTrigger = (await this.addressCellByHeader('State')).locator('[role="combobox"]').first();
      await selectDropdown(this.page, stateTrigger, state, state, { optional: true });
    }

    await this.saveAddressRow();
  }

  // CONFIRMED LIVE: a stale MUI backdrop left over from an earlier dropdown selection (same quirk
  // documented in helpers/dropdown.js and already worked around in OpportunityPage.save()) can
  // silently swallow this click with no visible error and no navigation - dismiss any stray
  // backdrop first, and retry once if the click still didn't navigate anywhere.
  async save() {
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2).catch(() => {});
    await this.page.waitForTimeout(300);
    const urlBefore = this.page.url();
    await this.saveButton.click();
    await this.page.waitForTimeout(2000);
    if (this.page.url() === urlBefore) {
      await this.saveButton.click();
    }
  }

  // CONFIRMED LIVE: save()'s own retry-if-URL-unchanged is wrong for a test that's asserting a
  // validation error blocks the save (e.g. duplicate-name checks) - the retry's second click can
  // go through even after the first one was rejected, silently creating the record for real
  // before the test ever gets to check for the error. Same backdrop-dismiss hygiene as save(),
  // but exactly one click, no retry - use this whenever the assertion right after IS the
  // still-blocked-on-this-page check.
  async saveOnce() {
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2).catch(() => {});
    await this.page.waitForTimeout(300);
    await this.saveButton.click();
  }

  /**
   * Save, capturing the created record's id/series_number straight from the create API response
   * (`POST /sales/v1/lead/` -> `{ data: { lead: { lead: { id, series_number, ... } } } }` -
   * confirmed live, doubly-nested `lead.lead`) - a direct-by-id `gotoView()` afterward is far more
   * reliable than searching the list by company name, which is confirmed live to time out on this
   * large, ever-growing shared dataset once a record isn't on the list's default page (the search
   * fallback's own debounced re-fetch isn't always caught in time either).
   * @returns {Promise<{id: string, seriesNumber: string}>}
   */
  async saveAndCaptureId() {
    const [, response] = await Promise.all([
      this.saveButton.click(),
      this.page.waitForResponse(
        (r) => r.url().endsWith('/sales/v1/lead/') && r.request().method() === 'POST',
        { timeout: 15000 },
      ),
    ]);
    const body = await response.json();
    const record = body.data.lead.lead;
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  /** Direct-by-id navigation - see saveAndCaptureId()'s own comment on why this is preferred over openView(companyName). */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create step likely failed.`);
    await this.page.goto(`/dashboard/crm/orders/lead/${id}/view-lead`, { timeout: 60000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  /**
   * @returns {Promise<{id: string, seriesNumber: string}>} the created record's id/series_number -
   * existing callers that don't need this can simply ignore the return value.
   */
  async createLead(data) {
    await this.goto();
    await this.fillBasicDetails(data);
    await this.selectLeadStatus(data.leadStatus);
    await this.selectPriority(data.priority);
    await this.selectSource(data.source);
    await this.selectIndustry(data.industry);
    if (data.followUpType) {
      await this.addFollowUp(data);
    }
    await this.selectLocation(data.location);
    await this.selectDepartment(data.department);

    await this.goToAddressTab();
    await this.fillAddressRow(data);

    await this.goToContactTab();

    return this.saveAndCaptureId();
  }
}

module.exports = LeadPage;
