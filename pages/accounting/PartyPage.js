const { expect } = require('@playwright/test');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Page Object for Customer Management and Vendor Management.
 *
 * CONFIRMED FROM SOURCE (seeder + frontend):
 *
 *  Form tabs — both customer and vendor have identical 5-tab structure:
 *    Tab 1  Basic Details  (tab_order: 1)  — account_type switcher, name fields, phone, etc.
 *    Tab 2  Address        (tab_order: 2)  — `addresses` table field → AddressModal
 *    Tab 3  Contact        (tab_order: 3)  — `contacts`  table field → ContactModal
 *    Tab 4  Purchase       (tab_order: 4)  — payment_term, companies, industry
 *    Tab 5  Accounting     (tab_order: 5)  — account_id (COA), currencies, credit_limit
 *
 *  Tab text (from accounting.json translations):
 *    "Basic Details" | "Address" | "Contact" | "Purchase" | "Accounting"
 *
 *  Navigation: Next button (disabled until current tab passes validation).
 *  Save button: form="add_customer" / form="add_vendor" type="submit" — always visible.
 *
 *  Account type switcher (Tab 1):
 *    Renders as two styled MUI buttons: "Individual" | "Company"
 *    Individual → first_name (required) + last_name (required)
 *    Company    → company_name (required, label "Entity Name")
 *
 *  Address modal (Tab 2 → Add button → dialog):
 *    address_type  MUI Select  (listbox options: Billing, Shipping …)
 *    contact_name  text input  placeholder "Enter Contact Name"
 *    address1      text input  placeholder "Enter Street"
 *    zip_code      text input  placeholder "Enter Zip Code"
 *    default_billing_address  checkbox
 *
 *  Contact modal (Tab 3 → Add button → dialog):
 *    name          text input  placeholder "Enter Contact Name"
 *    designation   text input  (label "Designation")
 *    email         email input
 *    mobile        phone input
 *
 *  Field name attributes follow FormParser naming: "add_customer.<field>" / "add_vendor.<field>"
 */
class PartyPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {'customer' | 'vendor'} partyType
   */
  constructor(page, partyType = 'customer') {
    this.page      = page;
    this.partyType = partyType;

    const isCustomer   = partyType === 'customer';
    this.entityKey     = isCustomer ? 'add_customer' : 'add_vendor';
    this.editEntityKey = isCustomer ? 'edit_customer' : 'edit_vendor';

    this.listPath = isCustomer
      ? '/dashboard/accounting/master-data/customer-management'
      : '/dashboard/accounting/master-data/vendor-management';
    this.addPath = isCustomer
      ? '/dashboard/accounting/master-data/customer-management/add-customer'
      : '/dashboard/accounting/master-data/vendor-management/add-vendor';

    // ── ActionBar ──
    this.addButton     = page.getByRole('button', { name: 'Add' }).first();
    this.searchTrigger = page.locator('.action-bar--RightContent [data-testid="SearchIcon"]');
    this.searchInput   = page.getByPlaceholder('Search', { exact: true });

    // ── Form buttons ──
    // Save: form="add_customer" / form="add_vendor" type="submit" (always visible)
    this.saveButton = page.locator(
      `button[form="${this.entityKey}"][type="submit"],` +
      `button[form="${this.editEntityKey}"][type="submit"]`
    );
    this.discardButton = page.getByRole('button', { name: /Discard/i }).first();
    this.nextButton    = page.getByRole('button', { name: /^Next$/i });

    // ── View / row actions ──
    this.actionsButton       = page.getByRole('button', { name: 'Actions', exact: true });
    this.editMenuItem        = page.getByRole('menuitem', { name: 'Edit', exact: true });
    this.deleteMenuItem      = page.getByRole('menuitem', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });
    this.toast               = page.locator('#notistack-snackbar');
  }

  // ─── field helpers ──────────────────────────────────────────────────────────

  /** FormParser input: name="add_customer.<field>" */
  field(fieldName) {
    return this.page.locator(
      `[name="${this.entityKey}.${fieldName}"],` +
      `[name="${this.editEntityKey}.${fieldName}"]`
    );
  }

  /** MUI Select trigger for a FormParser field */
  selectTrigger(fieldName) {
    return this.page.locator(
      `[id="mui-component-select-${this.entityKey}.${fieldName}"],` +
      `[id="mui-component-select-${this.editEntityKey}.${fieldName}"]`
    );
  }

  async fillField(fieldName, value) {
    const f = this.field(fieldName);
    await expect(f).toBeVisible({ timeout: 8000 });
    await f.fill(String(value));
  }

  async selectField(fieldName, searchText, optionText = searchText) {
    const t = this.selectTrigger(fieldName);
    await expect(t).toBeVisible({ timeout: 8000 });
    await selectDropdown(this.page, t, searchText, optionText);
  }

  // ─── navigation ─────────────────────────────────────────────────────────────

  async gotoList() {
    await this.page.goto(this.listPath);
    await this.page.waitForLoadState('networkidle');
  }

  async openAdd() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL(`**${this.addPath}**`, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    // Wait for FormParser to mount and render the switcher
    await this.page.waitForTimeout(1000);
  }

  async openRow(nameText) {
    await this.gotoList();
    await this.page.getByRole('link', { name: nameText, exact: true }).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(nameText) {
    await this.openRow(nameText);
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ─── tab navigation ──────────────────────────────────────────────────────────

  /**
   * Clicks a tab by its visible text label.
   * Falls back to clicking Next if the tab isn't directly clickable (locked).
   * @param {string} tabLabel  e.g. 'Address', 'Contact', 'Accounting'
   */
  async goToTab(tabLabel) {
    // Try direct tab click first
    const tab = this.page.getByRole('tab', { name: tabLabel, exact: true });
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await this.page.waitForTimeout(600);
      return;
    }

    // Tabs may not be clickable directly until activated via Next.
    // Click Next until we find the target tab is active or the target field is visible.
    for (let i = 0; i < 6; i++) {
      const next = this.nextButton;
      if (!(await next.isVisible({ timeout: 2000 }).catch(() => false))) break;
      if (await next.isDisabled({ timeout: 500 }).catch(() => false)) break;
      await next.click();
      await this.page.waitForTimeout(700);

      // Check if target tab is now active/visible
      const activeTab = this.page.locator('[role="tab"][aria-selected="true"]');
      const activeText = await activeTab.textContent().catch(() => '');
      if (activeText.toLowerCase().includes(tabLabel.toLowerCase())) return;
    }
  }

  // ─── account type ────────────────────────────────────────────────────────────

  /**
   * Selects "Individual" or "Company".
   *
   * CONFIRMED from page snapshot: the switcher renders as a MUI radiogroup,
   * NOT as buttons. The DOM shows:
   *   <radiogroup>
   *     <radio "Individual" [checked]>   Individual
   *     <radio "Company">                Company
   *   </radiogroup>
   *
   * "Individual" is pre-selected by default, so we only need to click for "Company".
   * @param {'Individual' | 'Company'} type
   */
  async selectAccountType(type) {
    if (type === 'Individual') {
      // Already checked by default — just verify and return
      const radio = this.page.locator('input[type="radio"]').filter({ hasText: /individual/i })
        .or(this.page.getByRole('radio', { name: 'Individual' }));
      // Check it only if it's not already checked (no-op for the default state)
      const checked = await this.page.getByRole('radio', { name: 'Individual' })
        .isChecked({ timeout: 5000 }).catch(() => false);
      if (!checked) {
        await this.page.getByRole('radio', { name: 'Individual' }).click();
        await this.page.waitForTimeout(400);
      }
      return;
    }

    // Company: click the radio or the surrounding label/generic (MUI renders a
    // styled wrapper around the hidden radio input)
    const companyRadio = this.page.getByRole('radio', { name: 'Company' });
    if (await companyRadio.isVisible({ timeout: 5000 }).catch(() => false)) {
      await companyRadio.click();
      await this.page.waitForTimeout(400);
      return;
    }
    // Fallback: click the visible "Company" text wrapper (MUI renders the label text
    // inside a <generic> next to the radio)
    await this.page.getByText('Company', { exact: true }).last().click();
    await this.page.waitForTimeout(400);
  }

  // ─── Tab 1: Basic Details ─────────────────────────────────────────────────────

  async fillBasicDetails({
    accountType = 'Individual',
    firstName, middleName, lastName, companyName,
    phone, email, website, vatNumber, crn,
  } = {}) {
    await this.selectAccountType(accountType);

    if (accountType === 'Individual') {
      if (firstName) await this.fillField('first_name', firstName);
      if (middleName) {
        const f = this.field('middle_name');
        if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(middleName);
      }
      if (lastName) await this.fillField('last_name', lastName);
    } else {
      if (companyName) {
        // Confirmed from snapshot: placeholder is "Enter company name" (NOT "Enter entity name")
        // The field name attribute is add_customer.company_name / add_vendor.company_name
        const f = this.field('company_name');
        await expect(f).toBeVisible({ timeout: 8000 });
        await f.fill(companyName);
      }
    }

    if (phone) {
      const f = this.field('contact_no');
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(phone);
    }
    if (email) {
      const f = this.field('email_ids');
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(email);
    }
    if (website) {
      const f = this.field('website');
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(website);
    }
    if (vatNumber) {
      const f = this.field('vat_number');
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(vatNumber);
    }
    if (crn) {
      const f = this.field('crn');
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(crn);
    }
  }

  // ─── Tab 2: Address modal ─────────────────────────────────────────────────────

  /**
   * While on the Address tab, clicks the Add (+) button to open the AddressModal
   * and fills in address details.
   *
   * Address modal fields (confirmed from seeder + translations):
   *   address_type  → MUI Select (options: Billing, Shipping, Other …)
   *   contact_name  → text input "Enter Contact Name"
   *   address1      → text input "Enter Street"
   *   zip_code      → text input "Enter Zip Code"
   *   default_billing_address → checkbox
   */
  async addAddress({
    addressType    = 'Billing',
    contactName    = '',
    street1        = '123 Test Street',
    zipCode        = '00000',
    defaultBilling = true,
  } = {}) {
    // The Address tab renders a single table (name="addresses") with an Add (+) button
    const addBtn = this.page.getByRole('button', { name: 'Add' }).last();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // ── address_type: plain MUI Select (not DynamicSearchSelect) ──
    // Trigger is the first combobox / MuiSelect-select in the dialog
    const typeTrigger = dialog.locator('.MuiSelect-select, [role="combobox"]').first();
    if (await typeTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeTrigger.click();
      await this.page.waitForTimeout(300);
      // Options render in a portal outside the dialog (MUI Popover)
      await this.page.getByRole('option', { name: addressType, exact: true }).last().click();
      await this.page.waitForTimeout(200);
    }

    // ── contact_name ──
    if (contactName) {
      const f = dialog.getByPlaceholder(/Enter Contact Name/i).first();
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(contactName);
    }

    // ── address1 / street ──
    const streets = dialog.getByPlaceholder(/Enter Street/i);
    if (await streets.count() > 0) {
      await streets.first().fill(street1);
    }

    // ── zip_code ──
    if (zipCode) {
      const f = dialog.getByPlaceholder(/Enter Zip Code/i).first();
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(zipCode);
    }

    // ── default billing checkbox ──
    if (defaultBilling) {
      const cb = dialog.locator('input[type="checkbox"]').first();
      if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (!(await cb.isChecked().catch(() => false))) await cb.click();
      }
    }

    // ── save ──
    const saveBtn = dialog.getByRole('button', { name: /^Save$/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await this.page.waitForTimeout(400);
  }

  // ─── Tab 3: Contact modal ─────────────────────────────────────────────────────

  /**
   * While on the Contact tab, clicks the Add (+) button to open the ContactModal.
   *
   * Contact modal fields:
   *   name         → text "Enter Contact Name"
   *   designation  → text (label "Designation")
   *   email        → email input
   *   mobile       → phone input
   */
  async addContact({
    name        = 'Auto Contact',
    designation = '',
    email       = '',
    mobile      = '',
  } = {}) {
    const addBtn = this.page.getByRole('button', { name: 'Add' }).last();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // name
    const nameF = dialog.getByPlaceholder(/Enter Contact Name/i).first();
    if (await nameF.isVisible({ timeout: 3000 }).catch(() => false)) await nameF.fill(name);

    // designation
    if (designation) {
      const f = dialog.getByPlaceholder(/designation/i).first()
        .or(dialog.getByLabel(/designation/i).first());
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(designation);
    }

    // email
    if (email) {
      const f = dialog.locator('input[type="email"]').first();
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(email);
    }

    // mobile
    if (mobile) {
      const f = dialog.locator('input[type="tel"]').first()
        .or(dialog.getByLabel(/Mobile/i).first());
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.fill(mobile);
    }

    const saveBtn = dialog.getByRole('button', { name: /^Save$/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await this.page.waitForTimeout(400);
  }

  // ─── Tab 5: Accounting ────────────────────────────────────────────────────────

  async selectAccount(searchText, optionText = searchText) {
    const t = this.selectTrigger('account_id');
    if (await t.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectDropdown(this.page, t, searchText, optionText);
    }
  }

  async selectPaymentTerm(searchText, optionText = searchText) {
    const t = this.selectTrigger('payment_term');
    if (await t.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectDropdown(this.page, t, searchText, optionText);
    }
  }

  async selectCurrencies(names = []) {
    for (const name of names) {
      const t = this.selectTrigger('currencies');
      if (await t.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectDropdown(this.page, t, name, name);
      }
    }
  }

  // ─── master create sequence ──────────────────────────────────────────────────

  /**
   * Fills the complete add-party form across all 5 tabs.
   *
   * Tab flow:
   *   1. Fill Basic Details (name, phone, etc.)
   *   2. Click Next → Address tab  → add address
   *   3. Click Next → Contact tab  → add contact
   *   4. Click Next → Purchase tab (skipped unless paymentTerm is provided)
   *   5. Click Next → Accounting tab → select account, currencies
   *
   * Does NOT call save() — do that explicitly in the test.
   *
   * @param {{
   *   accountType?:  'Individual' | 'Company',
   *   firstName?:    string,
   *   middleName?:   string,
   *   lastName?:     string,
   *   companyName?:  string,
   *   phone?:        string,
   *   email?:        string,
   *   vatNumber?:    string,
   *   crn?:          string,
   *   address?:      object | false,
   *   contact?:      object | false,
   *   paymentTerm?:  string,
   *   accountName?:  string,
   *   currencies?:   string[],
   * }} data
   */
  async create(data = {}) {
    const {
      accountType = 'Individual',
      firstName, middleName, lastName, companyName,
      phone, email, vatNumber, crn,
      address, contact,
      paymentTerm, accountName, currencies,
    } = data;

    // ── Tab 1: Basic Details ──
    await this.fillBasicDetails({
      accountType, firstName, middleName, lastName, companyName,
      phone, email, vatNumber, crn,
    });

    // ── Next → Tab 2: Address ──
    await this._clickNext('Address');
    if (address !== false) {
      await this.addAddress(typeof address === 'object' ? address : {});
    }

    // ── Next → Tab 3: Contact ──
    await this._clickNext('Contact');
    if (contact !== false) {
      await this.addContact(typeof contact === 'object' ? contact : {});
    }

    // ── Next → Tab 4: Purchase/Sales ──
    // Customer form Tab 4 = "Sales", Vendor form Tab 4 = "Purchase"
    const tab4Label = this.partyType === 'customer' ? 'Sales' : 'Purchase';
    await this._clickNext(tab4Label);
    if (paymentTerm) {
      await this.selectPaymentTerm(paymentTerm);
    }

    // ── Next → Tab 5: Accounting ──
    await this._clickNext('Accounting');
    if (accountName)           await this.selectAccount(accountName);
    if (currencies?.length)    await this.selectCurrencies(currencies);
  }

  /**
   * Navigates to the expected tab by clicking it directly.
   *
   * CONFIRMED from page snapshot: all tabs ("Basic Details", "Address", "Contact",
   * "Sales", "Accounting", "Transaction History", "Item Sold") are rendered and
   * directly clickable in the tab list — they do NOT require Next to unlock.
   *
   * Next button is used only to trigger Tab 1 validation before moving to Tab 2.
   * We click it once, then switch to direct tab clicks for all subsequent tabs.
   *
   * @param {string} expectedTabLabel  e.g. 'Address', 'Contact', 'Accounting'
   */
  async _clickNext(expectedTabLabel) {
    // Always try to click the tab directly first — it's the most reliable path
    const tab = this.page.getByRole('tab', { name: expectedTabLabel, exact: true });
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await this.page.waitForTimeout(600);
      // Verify it became selected
      const selected = await tab.getAttribute('aria-selected').catch(() => null);
      if (selected === 'true') return;
    }

    // Fallback: try Next button (for cases where direct tab click is rejected)
    const next = this.nextButton;
    if (!(await next.isVisible({ timeout: 2000 }).catch(() => false))) return;

    // Wait up to 3 seconds for Next to become enabled
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!(await next.isDisabled({ timeout: 300 }).catch(() => false))) break;
      await this.page.waitForTimeout(300);
    }
    if (await next.isDisabled({ timeout: 300 }).catch(() => true)) return;

    await next.click();
    await this.page.waitForTimeout(700);
  }

  async save() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async discard() {
    await this.discardButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ─── search ──────────────────────────────────────────────────────────────────

  async search(text) {
    // Try the hidden-behind-icon pattern (same as SettingsEntityPage)
    if (!(await this.searchInput.isVisible({ timeout: 1000 }).catch(() => false))) {
      // Search may be behind a SearchIcon button
      const searchIcon = this.page.locator('[data-testid="SearchIcon"]').first();
      if (await searchIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchIcon.click();
        await this.searchInput.waitFor({ state: 'visible', timeout: 5000 });
      }
    }

    // If still not visible, try alternative locator patterns for this list's search
    let input = this.searchInput;
    if (!(await input.isVisible({ timeout: 1000 }).catch(() => false))) {
      input = this.page.getByPlaceholder(/search/i).first();
    }

    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill('');
      await input.fill(text);
      // Wait for debounced API call
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await this.page.waitForTimeout(600);
      await this.page.mouse.click(2, 2);
      await this.page.waitForTimeout(300);
    }
  }

  row(nameText) {
    return this.page.locator('table tbody tr').filter({ hasText: nameText });
  }
}

module.exports = PartyPage;
