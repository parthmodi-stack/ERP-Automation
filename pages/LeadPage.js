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

    this.leadStatusDropdown = page.getByRole('combobox', { name: 'Search Lead Status' });
    this.priorityDropdown   = page.getByRole('combobox', { name: 'Search Priority' });
    this.sourceDropdown     = page.getByRole('combobox', { name: 'Search Source' });
    this.industryDropdown   = page.getByRole('combobox', { name: 'Search Industry' });
    this.locationDropdown   = page.getByRole('combobox', { name: 'Search Location' });
    this.departmentDropdown = page.getByRole('combobox', { name: 'Search Department' });

    // Follow Up modal - the header's own "Add" button (address rows have their
    // own Add too, further down), so scope to .first() here.
    this.followUpAddButton     = page.getByRole('button', { name: 'Add' }).first();
    this.followUpTypeDropdown  = page.getByRole('combobox', { name: 'Search Follow Up Type' });
    this.remindMeDropdown      = page.getByRole('combobox', { name: 'Search Remind Me' });
    this.followUpSaveButton    = page.getByRole('button', { name: 'Save', exact: true }).last();

    // Tabs / navigation
    this.nextButton       = page.getByRole('button', { name: 'Next' });
    this.basicDetailsTab  = page.getByRole('tab', { name: 'Basic Details' });
    this.addressTab       = page.getByRole('tab', { name: 'Address' });
    this.contactTab       = page.getByRole('tab', { name: 'Contact' });

    // Address tab - the auto-generated address row is edited in place via its
    // pencil/disk icon buttons rather than through a modal.
    this.addressRow            = page.locator('table >> tr').nth(1);
    this.address1Input          = page.getByPlaceholder('Enter Address').first();
    this.address2Input          = page.getByPlaceholder('Enter Address').nth(1);
    this.zipCodeInput           = page.getByPlaceholder('Enter Zip Code');
    this.cityInput               = page.getByPlaceholder('Enter City');
    this.countryDropdown        = page.getByRole('combobox', { name: 'Select country' });
    this.stateDropdown          = page.getByRole('combobox', { name: 'Select state' });

    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    // List / view page - Actions menu (mirrors LocationPage's pattern)
    this.actionsButton      = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem       = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem  = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem     = page.getByRole('menuitem', { name: 'Delete' });
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
    this.vatInvalidError          = page.getByText('VAT number should have exactly 15 digits', { exact: true });
    this.duplicateNameError       = page.getByText(/lead company name already exists/i);
  }

  async goto() {
    await this.page.goto('/dashboard/crm/orders/lead/add-lead');
    await this.page.waitForLoadState('networkidle');
    await this.basicDetailsTab.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Guessed URL segment ('/lead' list, '/view-lead', '/edit-lead') follows the
  // same list/view-X/edit-X convention as LocationPage/AttributePage -
  // unverified against the live app, adjust if the real routes differ.
  async gotoList() {
    await this.page.goto('/dashboard/crm/orders/lead');
    await this.page.waitForLoadState('networkidle');
  }

  async openView(companyName) {
    await this.gotoList();
    await this.page.getByText(companyName, { exact: true }).first().click();
    await this.page.waitForURL('**/view-lead');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(companyName) {
    await this.openView(companyName);
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-lead');
    await this.page.waitForLoadState('networkidle');
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async fillBasicDetails({ companyName, phone, email, vatNumber, crnNumber, responsiblePerson }) {
    if (companyName !== undefined) await this.companyNameInput.fill(companyName);
    if (phone !== undefined) await this.phoneInput.fill(phone);
    if (email !== undefined) await this.emailInput.fill(email);
    if (vatNumber !== undefined) await this.vatInput.fill(vatNumber);
    if (crnNumber !== undefined) await this.crnInput.fill(crnNumber);
    if (responsiblePerson !== undefined) await this.responsiblePersonInput.fill(responsiblePerson);
  }

  async selectLeadStatus(value) {
    await selectDropdown(this.page, this.leadStatusDropdown, value, value);
  }

  async selectPriority(value) {
    await selectDropdown(this.page, this.priorityDropdown, value, value);
  }

  async selectSource(value) {
    await selectDropdown(this.page, this.sourceDropdown, value, value);
  }

  async selectIndustry(value) {
    await selectDropdown(this.page, this.industryDropdown, value, value);
  }

  async selectLocation(value) {
    await selectDropdown(this.page, this.locationDropdown, value, value);
  }

  async selectDepartment(value) {
    await selectDropdown(this.page, this.departmentDropdown, value, value);
  }

  async addFollowUp({ followUpType, remindMe }) {
    await this.followUpAddButton.click();
    await selectDropdown(this.page, this.followUpTypeDropdown, followUpType, followUpType);
    await selectDropdown(this.page, this.remindMeDropdown, remindMe, remindMe);
    await this.followUpSaveButton.click();
  }

  // Tab headers are always rendered regardless of which panel is active, so
  // waiting for the target tab to be visible doesn't confirm the click
  // actually switched tabs (observed: a blocked Next silently left the
  // previous tab active, and this.addressRow then matched the wrong table).
  // Assert aria-selected instead to confirm the switch really happened.
  async goToAddressTab() {
    await this.nextButton.click();
    await expect(this.addressTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  }

  async goToContactTab() {
    await this.nextButton.click();
    await expect(this.contactTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  }

  // First column button on the row is the edit (pencil) icon.
  async openAddressRowEdit() {
    await this.addressRow.locator('button').first().click();
  }

  // Second column button on the row is the save (disk) icon.
  async saveAddressRow() {
    await this.addressRow.locator('button').nth(1).click();
  }

  async fillAddressRow({ address1, address2, zipCode, country, state, city }) {
    await this.openAddressRowEdit();

    if (address1 !== undefined) await this.address1Input.fill(address1);
    if (address2 !== undefined) await this.address2Input.fill(address2);
    if (zipCode !== undefined) await this.zipCodeInput.fill(zipCode);
    if (country !== undefined) await selectDropdown(this.page, this.countryDropdown, country, country);
    if (state !== undefined) await selectDropdown(this.page, this.stateDropdown, state, state);
    if (city !== undefined) await this.cityInput.fill(city);

    await this.saveAddressRow();
  }

  async save() {
    await this.saveButton.click();
  }

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

    await this.save();
  }
}

module.exports = LeadPage;
