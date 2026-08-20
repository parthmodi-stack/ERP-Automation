const { test, expect } = require('@playwright/test');
const LeadPage = require('../../pages/LeadPage');
const testData = require('../../config/testData');
const crmChain = require('../../config/crmChain');
const factory = require('../../config/testDataFactory');

test.describe('Lead Management', () => {
  // Threaded by id across TC-LEAD-01/03/04/05/06/07/08 below (later tests reuse the record an
  // earlier one created - same "tests in one file run in-order on one worker" convention as every
  // other multi-step suite in this repo). CONFIRMED LIVE: searching the list by company name (the
  // original approach) times out once a record isn't on the list's default page - a large,
  // ever-growing shared dataset where that's now the common case, not the exception. Direct-by-id
  // navigation (LeadPage.gotoView/gotoEdit, fed by saveAndCaptureId()'s own API-response capture)
  // sidesteps that class of flakiness entirely.
  let leadId;
  let duplicatedLeadId;

  // ── TC-LEAD-01: Create Lead ──────────────────────────────────────────────
  test('TC-LEAD-01 [+] Create Lead with basic details, follow up, address and contact', async ({ page }) => {
    const lead = new LeadPage(page);
    // If TC-FULLFLOW-01 (erpforce-full-inventory-to-procurement.spec.js) already ran this session,
    // it hands off the exact Location/Department it created via config/crmChain.js - use those
    // instead of testData.lead.valid's own pinned 'Almeda'/'parth' so this Lead (and the
    // Opportunity TC-OPP-01 converts it into) reference that same real master data. Falls back to
    // testData.lead.valid when run standalone, same self-healing convention as ensureCrmChain.js.
    const chain = crmChain.load();
    const data = {
      ...testData.lead.valid,
      ...(chain.fullFlowLocation ? { location: chain.fullFlowLocation } : {}),
      ...(chain.fullFlowDepartment ? { department: chain.fullFlowDepartment } : {}),
    };

    const created = await lead.createLead(data);
    leadId = created.id;
    expect(leadId).toBeTruthy();

    // Verify redirect to the Leads list
    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/);

    // Open the newly created lead directly by id and confirm the saved data.
    await lead.gotoView(leadId);

    // .first(): each of these can legitimately appear more than once on the view page (status
    // shown both as a field value and inside some summary/log text) - a bare getByText() throws
    // a strict-mode violation rather than asserting visibility.
    await expect(page.getByText(data.companyName).first()).toBeVisible();
    await expect(page.getByText(data.leadStatus, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(data.priority).first()).toBeVisible();
    await expect(page.getByText(data.email).first()).toBeVisible();
    await expect(page.getByText(data.crnNumber).first()).toBeVisible();
    // responsiblePerson ("Ahmed Khan") is no longer shown as its own labeled field in General
    // Detail (confirmed live - the section lists ID/Lead Company/Customer/Phone/Email/Website/
    // Entity/Currency/VAT/CRN/Lead Status/Conversion Probability/Reference No./Priority/Type/
    // Status, nothing labeled "Responsible Person") - dropped rather than asserted on a section
    // this test hasn't confirmed the real location/label of.

    // Hand off to 02-opportunity.spec.js (see config/crmChain.js) - the Opportunity's own
    // "Customer" field is searchable by this exact company name once the Lead is saved.
    crmChain.save({ leadCompanyName: data.companyName });
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
    test.skip(!leadId, 'depends on TC-LEAD-01 creating a Lead first');

    await lead.gotoView(leadId);

    // .first() on every one of these: each can legitimately appear more than once on the view
    // page (e.g. Lead Status shown both as a breadcrumb-area chip and as its own field value) -
    // same strict-mode-violation fix TC-LEAD-01 already applies to this identical set of checks.
    await expect(page.getByText(data.companyName).first()).toBeVisible();
    await expect(page.getByText(data.leadStatus, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(data.priority).first()).toBeVisible();
    await expect(page.getByText(data.email).first()).toBeVisible();
    await expect(page.getByText(data.vatNumber).first()).toBeVisible();
    await expect(page.getByText(data.crnNumber).first()).toBeVisible();
    // responsiblePerson ("Ahmed Khan") is no longer shown as its own labeled field on the view
    // page - same confirmed-live finding TC-LEAD-01 already documents for this identical check;
    // this test just wasn't updated to match when that was found. Dropped here too.
  });

  // ── TC-LEAD-04: Edit Lead - Update Company Name, Phone, Email ────────────
  test('TC-LEAD-04 [+] Edit Lead - update Company Name, Phone and Email', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;
    test.skip(!leadId, 'depends on TC-LEAD-01 creating a Lead first');

    await lead.gotoEdit(leadId);
    await expect(lead.companyNameInput).toHaveValue(data.companyName);

    await lead.companyNameInput.fill(data.updatedCompanyName);
    await lead.phoneInput.fill(data.updatedPhone);
    await lead.emailInput.fill(data.updatedEmail);

    await lead.goToAddressTab();
    await lead.goToContactTab();
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 25000 });
    await lead.gotoView(leadId);
    await expect(page.getByText(data.updatedCompanyName).first()).toBeVisible();

    // This permanently renames the TC-LEAD-01 record - refresh the cross-file handoff
    // (config/crmChain.js) with the NEW name, or 02-opportunity.spec.js's own TC-OPP-01 would
    // keep searching for the pre-rename name (which no longer exists anywhere) and time out.
    crmChain.save({ leadCompanyName: data.updatedCompanyName });
  });

  // ── TC-LEAD-05: Edit Lead - Change Lead Status & Priority ────────────────
  test('TC-LEAD-05 [+] Edit Lead - change Lead Status and Priority', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;
    test.skip(!leadId, 'depends on TC-LEAD-01 creating a Lead first');

    await lead.gotoEdit(leadId);
    await lead.selectLeadStatus(data.updatedLeadStatus);
    await lead.selectPriority(data.updatedPriority);

    await lead.goToAddressTab();
    await lead.goToContactTab();
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 25000 });

    await lead.gotoView(leadId);
    await expect(page.getByText(data.updatedLeadStatus, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(data.updatedPriority).first()).toBeVisible();
  });

  // ── TC-LEAD-06: Edit Lead - Update Address Fields ────────────────────────
  test('TC-LEAD-06 [+] Edit Lead - update address fields and verify changes', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;
    test.skip(!leadId, 'depends on TC-LEAD-01 creating a Lead first');

    await lead.gotoEdit(leadId);
    await lead.goToAddressTab();
    await lead.fillAddressRow({
      address1: data.updatedAddress1,
      city:     data.updatedCity,
      zipCode:  data.updatedZipCode,
    });

    await lead.goToContactTab();
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 25000 });

    // Re-open to confirm address changes persisted. LeadPage has no fixed address1Input/
    // cityInput/zipCodeInput properties (the Address table's columns are resolved dynamically by
    // header position, not exposed as static locators - see addressCellByHeader()), so read each
    // cell's own input the same way fillAddressRow() itself does.
    await lead.gotoEdit(leadId);
    await lead.goToAddressTab();
    await lead.openAddressRowEdit();
    await expect((await lead.addressCellByHeader('Address 1')).locator('input')).toHaveValue(data.updatedAddress1);
    await expect((await lead.addressCellByHeader('City')).locator('input')).toHaveValue(data.updatedCity);
    await expect((await lead.addressCellByHeader('Zip Code')).locator('input')).toHaveValue(data.updatedZipCode);
  });

  // ── TC-LEAD-07: Duplicate Lead ───────────────────────────────────────────
  test('TC-LEAD-07 [+/-] Duplicate Lead - validate duplicate name then save with new name', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;
    test.skip(!leadId, 'depends on TC-LEAD-01/06 leaving a Lead in place first');

    await lead.gotoView(leadId);
    await lead.actionsButton.click();
    await lead.duplicateMenuItem.waitFor({ state: 'visible' });
    await lead.duplicateMenuItem.click();

    // Duplicate opens the add-lead form pre-filled with copied data
    await page.waitForURL('**/add-lead');
    await page.waitForLoadState('networkidle');
    await expect(lead.companyNameInput).toHaveValue(data.updatedCompanyName);
    // Same "click Next before react-hook-form's field Controllers finish registering" race
    // already documented elsewhere in this suite (e.g. Payment Entry's own TC-PE-VAL-01) - a
    // short settle wait first reliably lets Next actually switch tabs on this pre-filled form.
    await page.waitForTimeout(500);
    // CONFIRMED LIVE: "Duplicate" visually pre-fills Lead Status/Priority/Source/Industry/
    // Location/Department (all shown correctly in a failure screenshot), but Next can still
    // silently refuse to switch tabs with no visible error - one of these Controller-backed
    // dropdowns isn't actually wired into react-hook-form's state despite rendering the copied
    // label. Re-asserting each one via the same selectDropdownIfNeeded() every other creation
    // test already uses is a no-op when the value is genuinely fine and only re-selects (fixing
    // the registration) when it isn't.
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);

    await lead.goToAddressTab();
    await lead.goToContactTab();

    // Negative: save without changing the Company Name -> expect validation. Use saveOnce()
    // (single click, no retry) - CONFIRMED LIVE: save()'s own retry-if-URL-unchanged clicks Save
    // a second time when the first click is still rejected, and that second click silently
    // creates the duplicate for real before this assertion ever runs.
    await lead.saveOnce();
    await expect(lead.duplicateNameError).toBeVisible({ timeout: 5000 });

    // Positive: change to a unique name and save
    await lead.basicDetailsTab.click();
    await lead.companyNameInput.fill(data.duplicatedCompanyName);
    // "Duplicate" also copied TC-LEAD-01's own email verbatim - same collision class as
    // TC-LEAD-15/18, so freshen it here too before this second real create, or a duplicate-email
    // check could block/interfere with this save the same way it did there.
    await lead.emailInput.fill(factory.uniqueEmail('automation.lead.duplicate'));
    await lead.goToAddressTab();
    await lead.goToContactTab();
    const duplicated = await lead.saveAndCaptureId();
    duplicatedLeadId = duplicated.id;
    expect(duplicatedLeadId).toBeTruthy();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 25000 });
  });

  // ── TC-LEAD-08: Delete Lead ───────────────────────────────────────────────
  test('TC-LEAD-08 [-] Delete the duplicated lead created in TC-LEAD-07', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;
    test.skip(!duplicatedLeadId, 'depends on TC-LEAD-07 creating the duplicated Lead first');

    await lead.gotoView(duplicatedLeadId);

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

  // ── TC-LEAD-14: Address row missing State ─────────────────────────────────
  test('TC-LEAD-14 [-] Attempt to save Address row without State', async ({ page }) => {
    const lead = new LeadPage(page);
    // Own distinct Company Name - CONFIRMED LIVE: reusing testData.lead.minimal's own companyName
    // verbatim collides with TC-LEAD-02's own earlier real create using that identical fixture,
    // which blocks the Next-button transition with a "company name already exists" validation -
    // goToAddressTab() never actually reaches the Address tab, so its own internal
    // toHaveAttribute wait times out before this test's real assertion is even reached.
    const data = { ...testData.lead.minimal, companyName: factory.uniqueName('Automation_Lead_MissingState') };

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
    await (await lead.addressCellByHeader('Address 1')).locator('input').fill(data.address1);
    await (await lead.addressCellByHeader('Zip Code')).locator('input').fill(data.zipCode);
    await (await lead.addressCellByHeader('City')).locator('input').fill(data.city);
    // Intentionally skip State selection only - CONFIRMED LIVE: Country can no longer be left
    // blank at all (it always arrives pre-filled to some default, see LeadPage.fillAddressRow's
    // own header comment on that default drifting over time) - "Country is required" can never
    // trigger anymore, so this test can only still exercise the State-required path.
    await lead.saveAddressRow();

    await expect(lead.stateRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-LEAD-15: Duplicate Company Name on create ─────────────────────────
  test('TC-LEAD-15 [-] Attempt to create a Lead with a Company Name that already exists', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.valid;

    await lead.goto();
    // Company Name is the ONE field intentionally reused verbatim (data.updatedCompanyName, which
    // TC-LEAD-04 already renamed the TC-LEAD-01 record to) - that's the exact collision this test
    // wants to trigger. Email must NOT also collide with TC-LEAD-01's own record, or the backend's
    // duplicate-email check could fire/interfere before the duplicate-name check we're asserting on.
    await lead.fillBasicDetails({
      ...data,
      companyName: data.updatedCompanyName,
      email: factory.uniqueEmail('automation.lead.dupname'),
    });
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data);
    await lead.goToContactTab();
    // saveOnce() (single click, no retry) - see TC-LEAD-07's own identical comment on why
    // save()'s retry-if-URL-unchanged defeats this exact kind of "still-blocked" assertion.
    await lead.saveOnce();

    await expect(lead.duplicateNameError).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/add-lead/);
  });

});
