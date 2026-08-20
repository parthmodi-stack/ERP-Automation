const { test, expect } = require('@playwright/test');
const LeadPage = require('../../pages/LeadPage');
const testData = require('../../config/testData');
const factory = require('../../config/testDataFactory');

// ── tests/crm/06-lead-extended.spec.js ───────────────────────────────────────────────────────
// Extended Lead positive/negative coverage NOT already exercised by tests/crm/01-lead.spec.js
// (TC-LEAD-01 through TC-LEAD-15). Numbered from TC-LEAD-16 onward (positive) and TC-LEAD-N01
// onward (negative) to avoid colliding with that file's own IDs. No @smoke2 tag anywhere in
// this file - it must never run as part of the smoke2 chain.
test.describe('Lead Management - Extended', () => {

  // ── TC-LEAD-16: Create Individual-type lead ─────────────────────────────
  test('TC-LEAD-16 [+] Create Individual-type lead with First/Middle/Last Name', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.individual;

    await lead.goto();
    await lead.selectLeadType('Individual');
    await lead.fillIndividualName(data);
    await lead.fillBasicDetails(data);
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

    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/);
    await expect(page.getByText(data.lastName, { exact: false }).first()).toBeVisible();
  });

  // ── TC-LEAD-N01: Missing Entity ──────────────────────────────────────────
  test('TC-LEAD-N01 [-] Attempt to proceed with Entity cleared', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.missingEntity;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clearEntity();
    await lead.clickNext();

    await expect(lead.entityRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-N02: Individual lead missing First Name ─────────────────────
  test('TC-LEAD-N02 [-] Individual lead missing First Name', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.individual;

    await lead.goto();
    await lead.selectLeadType('Individual');
    await lead.fillIndividualName({ lastName: data.lastName });
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.firstNameRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-N03: Individual lead missing Last Name ───────────────────────
  test('TC-LEAD-N03 [-] Individual lead missing Last Name', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.individual;

    await lead.goto();
    await lead.selectLeadType('Individual');
    await lead.fillIndividualName({ firstName: data.firstName });
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.lastNameRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-N04: Responsible Person blank ────────────────────────────────
  test('TC-LEAD-N04 [-] Attempt to proceed with blank Responsible Person', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.blankResponsiblePerson;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.responsiblePersonRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-N05: Responsible Person too short ────────────────────────────
  test('TC-LEAD-N05 [-] Attempt to proceed with a 1-character Responsible Person', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.shortResponsiblePerson;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.responsiblePersonMinLengthError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-N06: Invalid CRN ──────────────────────────────────────────────
  test('TC-LEAD-N06 [-] Attempt to proceed with a CRN that is not exactly 10 digits', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.invalidCrn;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.crnInvalidError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-N07: Missing Salesperson ──────────────────────────────────────
  test('TC-LEAD-N07 [-] Attempt to proceed with Salesperson cleared', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.missingSalesperson;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clearSalesperson();
    await lead.clickNext();

    await expect(lead.salespersonRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-N18: Blank Email ──────────────────────────────────────────────
  test('TC-LEAD-N18 [-] Attempt to proceed with blank Email', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.blankEmail;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.clickNext();

    await expect(lead.emailRequiredError).toBeVisible({ timeout: 5000 });
    await expect(lead.basicDetailsTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── TC-LEAD-18: Add a second Address row ─────────────────────────────────
  test('TC-LEAD-18 [+] Add a second Address row', async ({ page }) => {
    const lead = new LeadPage(page);
    // Own distinct Company Name AND Email - CONFIRMED LIVE: reusing testData.lead.minimal's own
    // companyName/email verbatim collides with TC-LEAD-02 (01-lead.spec.js's own earlier real
    // create using that identical fixture - both files run in the same worker process by default,
    // so testData.js's require-time `ts` is identical across them), silently blocking this test's
    // own Next transition with a duplicate-name/duplicate-email validation that has no other
    // visible signal. Phone is auto-freshened inside LeadPage.fillBasicDetails() itself since no
    // test anywhere asserts on the exact phone text; company name and email are NOT auto-freshened
    // there because TC-LEAD-01/03 assert on the exact static email, and TC-LEAD-15 deliberately
    // relies on reusing an existing company name to test duplicate-name detection - so each caller
    // that needs a fresh value provides its own, as done here.
    const data = {
      ...testData.lead.minimal,
      companyName: factory.uniqueName('Automation_Lead_SecondAddress'),
      email: factory.uniqueEmail('automation.lead.secondaddress'),
    };
    const second = testData.lead.secondAddress;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data);

    await lead.addAddressRow();
    await lead.fillNewAddressRow({
      addressType: second.addressType,
      addressee: second.addressee,
      address1: second.address1,
      country: data.country,
      state: data.state,
      city: second.city,
    });
    await lead.saveNewAddressRow();

    // CONFIRMED LIVE: once saved, the table re-sorts back to its natural order - the newly saved
    // row does NOT stay pinned at index 0 (that position is only "whichever row is mid-edit").
    await expect(page.locator('table tbody tr', { hasText: second.addressee })).toBeVisible({ timeout: 5000 });
  });

  // ── TC-LEAD-N19: Two Address rows both Default Shipping ──────────────────
  test('TC-LEAD-N19 [-] Two Address rows both marked Default Shipping is rejected', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const second = testData.lead.secondAddress;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data); // row 0 auto-gets default shipping+billing = true

    await lead.addAddressRow();
    await lead.fillNewAddressRow({
      addressType: second.addressType,
      addressee: second.addressee,
      address1: second.address1,
      country: data.country,
      state: data.state,
      city: second.city,
    });
    await lead.toggleNewRowDefaultShipping();
    await lead.saveNewAddressRow();

    // CONFIRMED LIVE: on a shipping-default conflict the row's inline Save is rejected - the row
    // stays mid-edit (Cancel/Save still showing) rather than committing back to Edit/Delete icons.
    await expect(lead.addressRowAt(0).getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('table tbody tr')).toHaveCount(2);
  });

  // ── TC-LEAD-N20: Two Address rows both Default Billing ────────────────────
  test('TC-LEAD-N20 [-] Two Address rows both marked Default Billing is rejected', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const second = testData.lead.secondAddress;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data);

    await lead.addAddressRow();
    await lead.fillNewAddressRow({
      addressType: second.addressType,
      addressee: second.addressee,
      address1: second.address1,
      country: data.country,
      state: data.state,
      city: second.city,
    });
    await lead.toggleNewRowDefaultBilling();
    await lead.saveNewAddressRow();

    await expect(lead.addressRowAt(0).getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('table tbody tr')).toHaveCount(2);
  });

  // ── TC-LEAD-N19b: Address row missing Address Type/Addressee ──────────────
  test('TC-LEAD-N19b [-] Second Address row missing Address Type and Addressee is rejected', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const second = testData.lead.secondAddress;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data);

    await lead.addAddressRow();
    // Intentionally skip Address Type and Addressee - fill only the other required fields.
    await lead.fillNewAddressRow({
      address1: second.address1,
      country: data.country,
      state: data.state,
      city: second.city,
    });
    await lead.saveNewAddressRow();

    await expect(lead.addressRowAt(0).getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('table tbody tr')).toHaveCount(2);
  });

  // ── TC-LEAD-19: Add a second Contact row ──────────────────────────────────
  test('TC-LEAD-19 [+] Add a second Contact row', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const second = testData.lead.secondContact;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data);
    await lead.goToContactTab();

    await lead.addContactRow();
    await lead.fillNewContactRow(second);
    await lead.saveNewContactRow();

    await expect(page.locator('table tbody tr', { hasText: second.name })).toBeVisible({ timeout: 5000 });
  });

  // ── TC-LEAD-N21: Contact row missing Name/Email ───────────────────────────
  test('TC-LEAD-N21 [-] Second Contact row missing Name and Email is rejected', async ({ page }) => {
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
    await lead.fillAddressRow(data);
    await lead.goToContactTab();

    await lead.addContactRow();
    // Intentionally leave Name and Email blank.
    await lead.saveNewContactRow();

    await expect(lead.contactRowAt(0).getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 3000 });
  });

  // ── TC-LEAD-N22: Contact row invalid Email ────────────────────────────────
  test('TC-LEAD-N22 [-] Second Contact row with an invalid Email format is rejected', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const bad = testData.lead.secondContactInvalidEmail;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.selectLeadStatus(data.leadStatus);
    await lead.selectPriority(data.priority);
    await lead.selectSource(data.source);
    await lead.selectIndustry(data.industry);
    await lead.selectLocation(data.location);
    await lead.selectDepartment(data.department);
    await lead.goToAddressTab();
    await lead.fillAddressRow(data);
    await lead.goToContactTab();

    await lead.addContactRow();
    await lead.fillNewContactRow(bad);
    await lead.saveNewContactRow();

    await expect(lead.contactRowAt(0).getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 3000 });
  });

  // ── TC-LEAD-17: Save Lead as Draft, then edit and submit ──────────────────
  test('TC-LEAD-17 [+] Save Lead as Draft, then edit and fully submit', async ({ page }) => {
    test.setTimeout(120000);
    const lead = new LeadPage(page);
    const partial = testData.lead.draft;
    const full = testData.lead.minimal;

    await lead.goto();
    await lead.fillBasicDetails(partial);
    await lead.saveAsDraftButton.click();
    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 10000 });

    await lead.openView(partial.companyName);
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible({ timeout: 5000 });

    await lead.draftEditButton.click();
    await page.waitForURL('**/edit-lead', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // The draft was created with responsiblePerson+phone+email already filled, which auto-
    // creates a first Address/Contact row - go check what's actually still missing rather than
    // blindly re-filling everything (Lead Status/Priority/etc. may already carry the Add page's
    // own defaults through from the original draft save).
    await lead.goToAddressTab();
    await page.waitForTimeout(500);
    // "No Data" itself renders as its own placeholder <tr> when the table is empty - exclude it
    // so an empty table isn't miscounted as "1 real row".
    const addressRowCount = await page.getByRole('tabpanel', { name: 'Address' }).locator('table tbody tr').filter({ hasNotText: 'No Data' }).count();
    console.log('DEBUG TC-LEAD-17: address row count on Edit =', addressRowCount);
    if (addressRowCount === 0) {
      await lead.addAddressRow();
      await lead.fillNewAddressRow({ ...full, addressType: 'Office' });
      await lead.saveNewAddressRow();
    } else {
      await lead.fillAddressRow(full);
    }
    await lead.goToContactTab();
    await page.waitForTimeout(500);
    // CONFIRMED LIVE: unlike Address, an auto-created Contact row does NOT persist through a
    // Save-to-Draft/re-open-via-Edit round trip - the Contact table can come back "No Data" here
    // even though the same draft's Address row survived, so add one explicitly if needed. Scoped
    // to the Contact tabpanel specifically - a bare page-wide table-row count can still catch the
    // PREVIOUS tab's table mid-transition and report a stale, wrong count.
    const contactRowCount = await page.getByRole('tabpanel', { name: 'Contact' }).locator('table tbody tr').filter({ hasNotText: 'No Data' }).count();
    console.log('DEBUG TC-LEAD-17: contact row count on Edit =', contactRowCount);
    if (contactRowCount === 0) {
      await lead.addContactRow();
      await lead.fillNewContactRow({ name: full.responsiblePerson, email: full.email });
      await lead.saveNewContactRow();
      await page.waitForTimeout(800);
    }
    await lead.save();

    await page.waitForURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 10000 });
    await lead.openView(partial.companyName);
    await page.waitForURL('**/view-lead', { timeout: 15000 });
    // Scoped to the breadcrumb's own status chip (view-lead.tsx's `ID: {id} <Chip>` block) - a
    // bare page-wide "Draft" text search can otherwise match unrelated rows if openView() lands
    // back on the list instead of the individual record.
    await expect(page.locator('div').filter({ hasText: /^ID: \d+/ }).getByText('Draft', { exact: true })).not.toBeVisible({ timeout: 5000 });
  });

  // ── TC-LEAD-20: Delete a Draft Lead ────────────────────────────────────────
  test('TC-LEAD-20 [+] Delete a Draft Lead via its plain Delete button', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.draftToDelete;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await lead.saveAsDraftButton.click();
    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 10000 });

    await lead.openView(data.companyName);
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible({ timeout: 5000 });

    await lead.draftDeleteButton.click();
    await lead.confirmDeleteButton.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    await lead.confirmDeleteButton.click();

    await page.waitForURL(/lead/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Scoped to the list table's own data rows - a bare page-wide text search can otherwise
    // double-match (e.g. a lingering breadcrumb/search-history reference to the same name).
    await expect(page.locator('table tbody tr', { hasText: data.companyName })).toHaveCount(0, { timeout: 10000 });
  });

  // ── TC-LEAD-N25: Follow-up modal blocked when Type not selected ───────────
  test('TC-LEAD-N25 [-] Follow-up modal blocked when Type is not selected', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await page.waitForTimeout(500);

    await lead.followUpAddButton.click();
    await page.waitForTimeout(800);
    // Intentionally skip selecting Follow Up Type - Date/Time both already default to now.
    await lead.followUpSaveButton.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  });

  // ── TC-LEAD-N26: Follow-up modal blocked when Date/Time missing ───────────
  test('TC-LEAD-N26 [-] Follow-up modal blocked when Date is cleared', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await page.waitForTimeout(500);

    await lead.followUpAddButton.click();
    await page.waitForTimeout(800);
    await lead.followUpTypeDropdown.click({ force: true });
    const typeMenu = page.locator('[id="menu-follow_up.follow_up_type"]');
    await typeMenu.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await typeMenu.locator('li').nth(1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // Date arrives pre-filled with today's date - clear it explicitly to test the required rule.
    await page.locator('input[name="follow_up.follow_up_date_time[0].date"]').fill('');
    await lead.followUpSaveButton.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  });

  // ── TC-LEAD-21: Add a Communication Log ────────────────────────────────────
  test('TC-LEAD-21 [+] Add a Communication Log', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const logTitle = `Automation Log ${Date.now()}`;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await page.waitForTimeout(500);

    await lead.addLogButton.click();
    await page.waitForTimeout(800);
    await lead.logTitleInput.fill(logTitle);
    await lead.selectLogCommunicationType('Phone call');
    await lead.logSaveButton.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(logTitle, { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  // ── TC-LEAD-N27: Log modal blocked when Title is empty ─────────────────────
  test('TC-LEAD-N27 [-] Log modal blocked when Title is empty', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await page.waitForTimeout(500);

    await lead.addLogButton.click();
    await page.waitForTimeout(800);
    // Intentionally skip Title.
    await lead.selectLogCommunicationType('Phone call');
    await lead.logSaveButton.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  });

  // ── TC-LEAD-N28: Log modal blocked when Communication Type not selected ────
  test('TC-LEAD-N28 [-] Log modal blocked when Communication Type is not selected', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const logTitle = `Automation Log ${Date.now()}`;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await page.waitForTimeout(500);

    await lead.addLogButton.click();
    await page.waitForTimeout(800);
    await lead.logTitleInput.fill(logTitle);
    // Intentionally skip Communication Type.
    await lead.logSaveButton.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  });

  // ── TC-LEAD-N29: Log modal blocked when Date is cleared ─────────────────────
  test('TC-LEAD-N29 [-] Log modal blocked when Date is cleared', async ({ page }) => {
    const lead = new LeadPage(page);
    const data = testData.lead.minimal;
    const logTitle = `Automation Log ${Date.now()}`;

    await lead.goto();
    await lead.fillBasicDetails(data);
    await page.waitForTimeout(500);

    await lead.addLogButton.click();
    await page.waitForTimeout(800);
    await lead.logTitleInput.fill(logTitle);
    await lead.selectLogCommunicationType('Phone call');
    // Date arrives pre-filled with today's date - clear it explicitly.
    await lead.logDateInput.fill('');
    await lead.logSaveButton.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  });

});
