const { test, expect } = require('@playwright/test');
const LeadPage = require('../../pages/LeadPage');
const testData = require('../../config/testData');

test.describe('Lead Management', () => {

  // ── TC-LEAD-01: Create Lead ──────────────────────────────────────────────
  test('TC-LEAD-01 [+] Create Lead with basic details, follow up, address and contact', { tag: '@smoke' }, async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.createLead(data);

    // Verify redirect to the Leads list
    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/);

    // Open the newly created lead and confirm the saved data
    await page.getByText(data.companyName).first().click();

    await expect(page.getByText(data.leadStatus, { exact: false })).toBeVisible();
    await expect(page.getByText(data.priority)).toBeVisible();
    await expect(page.getByText(data.email)).toBeVisible();
    await expect(page.getByText(data.crnNumber)).toBeVisible();
    await expect(page.getByText(data.responsiblePerson)).toBeVisible();
  });

  // ── TC-LEAD-02: Create Lead with required fields only ────────────────────
  test('TC-LEAD-02 [+] Create Lead with only required fields (no Follow Up)', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;

    await lead.createLead(data);

    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/);
    await expect(page.getByText(data.companyName).first()).toBeVisible();
  });

  // ── TC-LEAD-03: View Lead ─────────────────────────────────────────────────
  test('TC-LEAD-03 [+] View Lead - verify all saved field values on detail page', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.openView(data.companyName);

    await expect(page.getByText(data.companyName).first()).toBeVisible();
    await expect(page.getByText(data.leadStatus, { exact: false })).toBeVisible();
    await expect(page.getByText(data.priority)).toBeVisible();
    await expect(page.getByText(data.email)).toBeVisible();
    await expect(page.getByText(data.vatNumber)).toBeVisible();
    await expect(page.getByText(data.crnNumber)).toBeVisible();
    await expect(page.getByText(data.responsiblePerson)).toBeVisible();
  });

  // ── TC-LEAD-04: Edit Lead - Update Company Name, Phone, Email ────────────
  test('TC-LEAD-04 [+] Edit Lead - update Company Name, Phone and Email', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.openEdit(data.companyName);
    await expect(lead.companyNameInput).toHaveValue(data.companyName);

    await lead.companyNameInput.fill(data.updatedCompanyName);
    await lead.phoneInput.fill(data.updatedPhone);
    await lead.emailInput.fill(data.updatedEmail);

    await lead.goToAddressTab();
    await lead.goToContactTab();
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 10000 });
    await expect(page.getByText(data.updatedCompanyName).first()).toBeVisible();
  });

  // ── TC-LEAD-05: Edit Lead - Change Lead Status & Priority ────────────────
  test('TC-LEAD-05 [+] Edit Lead - change Lead Status and Priority', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.openEdit(data.updatedCompanyName);
    await lead.selectLeadStatus(data.updatedLeadStatus);
    await lead.selectPriority(data.updatedPriority);

    await lead.goToAddressTab();
    await lead.goToContactTab();
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 10000 });

    await lead.openView(data.updatedCompanyName);
    await expect(page.getByText(data.updatedLeadStatus, { exact: false })).toBeVisible();
    await expect(page.getByText(data.updatedPriority)).toBeVisible();
  });

  // ── TC-LEAD-06: Edit Lead - Update Address Fields ────────────────────────
  test('TC-LEAD-06 [+] Edit Lead - update address fields and verify changes', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.openEdit(data.updatedCompanyName);
    await lead.goToAddressTab();
    await lead.fillAddressRow({
      address1: data.updatedAddress1,
      city:     data.updatedCity,
      zipCode:  data.updatedZipCode,
    });

    await lead.goToContactTab();
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 10000 });

    // Re-open to confirm address changes persisted
    await lead.openEdit(data.updatedCompanyName);
    await lead.goToAddressTab();
    await lead.openAddressRowEdit();
    await expect(lead.address1Input).toHaveValue(data.updatedAddress1);
    await expect(lead.cityInput).toHaveValue(data.updatedCity);
    await expect(lead.zipCodeInput).toHaveValue(data.updatedZipCode);
  });

  // ── TC-LEAD-07: Duplicate Lead ───────────────────────────────────────────
  test('TC-LEAD-07 [+/-] Duplicate Lead - validate duplicate name then save with new name', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.openView(data.updatedCompanyName);
    await lead.actionsButton.click();
    await lead.duplicateMenuItem.waitFor({ state: 'visible' });
    await lead.duplicateMenuItem.click();

    // Duplicate opens the add-lead form pre-filled with copied data
    await page.waitForURL('**/add-lead');
    await page.waitForLoadState('networkidle');
    await expect(lead.companyNameInput).toHaveValue(data.updatedCompanyName);

    await lead.goToAddressTab();
    await lead.goToContactTab();

    // Negative: save without changing the Company Name -> expect validation
    await lead.save();
    await expect(lead.duplicateNameError).toBeVisible({ timeout: 5000 });

    // Positive: change to a unique name and save
    await lead.basicDetailsTab.click();
    await lead.companyNameInput.fill(data.duplicatedCompanyName);
    await lead.goToAddressTab();
    await lead.goToContactTab();
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 10000 });
    await expect(page.getByText(data.duplicatedCompanyName).first()).toBeVisible();
  });

  // ── TC-LEAD-08: Delete Lead ───────────────────────────────────────────────
  test('TC-LEAD-08 [-] Delete the duplicated lead created in TC-LEAD-07', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.openView(data.duplicatedCompanyName);

    await lead.actionsButton.click();
    await lead.deleteMenuItem.waitFor({ state: 'visible' });
    await lead.deleteMenuItem.click();

    await lead.confirmDeleteButton.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    await lead.confirmDeleteButton.click();

    await page.waitForURL(/lead/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(data.duplicatedCompanyName, { exact: true })).not.toBeVisible();
  });

  // ── TC-LEAD-09: Missing Company Name ─────────────────────────────────────
  test('TC-LEAD-09 [-] Attempt to proceed with empty Company Name', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.missingCompanyName;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.companyNameRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-10: Invalid Email format ─────────────────────────────────────
  test('TC-LEAD-10 [-] Attempt to proceed with an invalid Email format', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.invalidEmail;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.emailInvalidError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-11: Invalid Phone Number ─────────────────────────────────────
  // The Phone input strips non-numeric characters as typed, so letters like
  // "abcd" resolve to empty and surface the same required-field message as
  // leaving the field blank - there's no separate invalid-format state.
  test('TC-LEAD-11 [-] Attempt to proceed with a non-numeric Phone Number (stripped to empty)', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.invalidPhone;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.phoneRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-12: Invalid VAT Number ───────────────────────────────────────
  test('TC-LEAD-12 [-] Attempt to proceed with an invalid VAT Number', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.invalidVat;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.vatInvalidError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-13: Missing Lead Status / Priority ───────────────────────────
  test('TC-LEAD-13 [-] Attempt to proceed without selecting Lead Status and Priority', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;

    await lead.goto();
    await lead.fillBasicDetails(data);
    // Intentionally skip selectLeadStatus()/selectPriority()
    await lead.clickNext();

    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-14: Address row missing Country/State ────────────────────────
  test('TC-LEAD-14 [-] Attempt to save Address row without Country and State', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();

    await lead.openAddressRowEdit();
    await lead.address1Input.fill(data.address1);
    await lead.zipCodeInput.fill(data.zipCode);
    await lead.cityInput.fill(data.city);
    // Intentionally skip Country/State selection
    await lead.saveAddressRow();

    await expect(lead.countryRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.stateRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-LEAD-15: Duplicate Company Name on create ─────────────────────────
  test('TC-LEAD-15 [-] Attempt to create a Lead with a Company Name that already exists', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.goto();
    await lead.fillBasicDetails({ ...data, companyName: data.updatedCompanyName });
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data);
    await lead.goToContactTab();
    await lead.save();

    await expect(lead.duplicateNameError).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/add-lead/);
  });

});
