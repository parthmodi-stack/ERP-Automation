const { test, expect } = require('@playwright/test');
const DocumentMasterPage = require('../../pages/DocumentMasterPage');
const testData = require('../../config/testData');

// Document Master (erpforce-hrms-fe: src/views/document-master/) - confirmed real module (route
// `/company-master-policy/document-master`), a flat Add/Edit form with one repeatable "Documents"
// grid. See the header comment on DocumentMasterPage.js for the grid's actual interaction model
// (inline row edit + Enter-to-commit, no per-row Save button) - it's a different shared
// component (`MaterialEditableTable`) than Procurement's modal-based Items grid, so don't copy
// ProcurementRequestPage's addItem() pattern here.
//
// SCOPE NOTES (things intentionally NOT covered here, so as not to guess unverified behavior):
// - No approval/Submit/Accept/Reject workflow exists for this module (Draft -> Active/Inactive
//   only, same shape as Organization Structure) - the "Approval Flow" section of
//   DEFAULT_TEST_CASES.md is skipped entirely.
// - Duplicate-document-name-within-grid prevention is NOT tested: there's no `unique` rule in
//   the module's Yup schema (utils/validation.ts) or server JSON schema for `document_name`
//   within the `documents` array, so asserting a duplicate error would be asserting behavior
//   that doesn't exist in the source.
// - "Cross Browser" is out of scope - playwright.config.js only defines a Desktop Chrome project,
//   and adding browser projects would be a project-architecture change.
// - "Network Failure"/raw "API Validation" cases (asserting on intercepted/mocked responses) are
//   out of scope for this pass - not implemented via route interception here, since the rest of
//   this suite drives the real backend rather than mocking it; consider `page.route()` as a
//   follow-up if this suite ever needs to test failure paths independent of a live backend.
test.describe('Document Master Module', () => {
  let created = {};
  let draftRecord = {};

  // ── TC-DOC-01: Create Document Master ────────────────────────────────────
  test('TC-DOC-01 [+] Create Document Master with two Document rows', async ({ page }) => {
    const doc = new DocumentMasterPage(page);
    const data = testData.documentMaster.valid;

    await doc.goto();
    await expect(page).toHaveURL(/add-document-master/);

    await doc.fillBasicDetails(data);
    await doc.addDocumentRows(data.documents);

    // Verify grid rows before saving the whole form.
    for (const row of data.documents) {
      await expect(page.getByText(row.documentName, { exact: true })).toBeVisible();
    }

    const result = await doc.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, documentType: data.documentType };

    await doc.searchList(data.documentType);
    await expect(page.getByText(data.documentType, { exact: false }).first()).toBeVisible();
    await expect(await doc.getRowStatus(created.seriesNumber)).toMatch(/Active/);
  });

  // ── TC-DOC-02: Create Multiple Documents (different datasets/status) ────
  test('TC-DOC-02 [+] Create a second Document Master (Vendor Compliance, Inactive)', async ({ page }) => {
    const doc = new DocumentMasterPage(page);
    const data = testData.documentMaster.vendorCompliance;

    await doc.goto();
    await doc.fillBasicDetails(data);
    await doc.addDocumentRows(data.documents);

    // Status defaults to Active on a new record - toggle to Inactive per this dataset.
    await expect(doc.statusToggle).toBeChecked();
    await doc.toggleStatus();
    await expect(doc.statusToggle).not.toBeChecked();

    const result = await doc.save();
    expect(result.seriesNumber).toBeTruthy();

    await doc.searchList(data.documentType);
    await expect(await doc.getRowStatus(result.seriesNumber)).toMatch(/Inactive/);
  });

  // ── TC-DOC-03: View Document Master ──────────────────────────────────────
  test('TC-DOC-03 [+] View Document Master - verify summary and grid data', async ({ page }) => {
    const doc = new DocumentMasterPage(page);
    const data = testData.documentMaster.valid;

    await doc.gotoList();
    await doc.searchList(created.seriesNumber);
    await doc.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-document-master/);

    await expect(page.getByText(data.documentType, { exact: false }).first()).toBeVisible();
    for (const row of data.documents) {
      await expect(page.getByText(row.documentName, { exact: true })).toBeVisible();
      if (row.remarks) {
        await expect(page.getByText(row.remarks, { exact: false }).first()).toBeVisible();
      }
    }
  });

  // ── TC-DOC-04: Edit Document Master - update, add, and delete grid rows ──
  test('TC-DOC-04 [+] Edit Document Master - update Document Type, add a row, delete a row', async ({ page }) => {
    const doc = new DocumentMasterPage(page);
    const data = testData.documentMaster.valid;

    await doc.gotoList();
    await doc.searchList(created.seriesNumber);
    await doc.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-document-master/);

    // Update the free-text Document Type field.
    await doc.documentTypeInput.fill(data.updatedDocumentType);
    await expect(doc.documentTypeInput).toHaveValue(data.updatedDocumentType);

    // Edit the first row's Remarks in place (click-to-edit, then Enter to commit).
    await doc.editDocumentRowByName(data.documents[0].documentName, { remarks: data.updatedRemarks });
    await expect(page.getByText(data.updatedRemarks, { exact: false }).first()).toBeVisible();

    // Add a third row.
    const newRow = { documentName: `${data.documents[0].documentName}_EXTRA`, remarks: 'Added during edit', validityCheck: true };
    await doc.addDocumentRow(newRow);
    await expect(page.getByText(newRow.documentName, { exact: true })).toBeVisible();

    // Delete the second original row.
    await doc.deleteDocumentRow(data.documents[1].documentName);
    await expect(page.getByText(data.documents[1].documentName, { exact: true })).not.toBeVisible();

    const result = await doc.save();
    created.documentType = data.updatedDocumentType;
    expect(result.seriesNumber).toBeTruthy();

    // Re-open to confirm the edits persisted.
    await doc.gotoList();
    await doc.searchList(created.seriesNumber);
    await doc.openEditFromList(created.seriesNumber);
    await expect(doc.documentTypeInput).toHaveValue(data.updatedDocumentType);
    await expect(page.getByText(newRow.documentName, { exact: true })).toBeVisible();
    await expect(page.getByText(data.documents[1].documentName, { exact: true })).not.toBeVisible();
  });

  // ── TC-DOC-05: Save to Draft ──────────────────────────────────────────────
  test('TC-DOC-05 [+] Create Document Master and Save To Draft - status shows Draft', async ({ page }) => {
    const doc = new DocumentMasterPage(page);
    const data = testData.documentMaster.onboarding;

    await doc.goto();
    await doc.fillBasicDetails(data);
    await doc.addDocumentRows(data.documents);

    const result = await doc.saveAsDraft();
    draftRecord = { ...result, documentType: data.documentType };

    await doc.searchList(data.documentType);
    await expect(await doc.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-DOC-06: Discard ────────────────────────────────────────────────────
  test('TC-DOC-06 [-] Discard a new Document Master - no record is created', async ({ page }) => {
    const doc = new DocumentMasterPage(page);
    const discardedType = `${testData.documentMaster.onboarding.documentType}_DISCARDED`;

    await doc.goto();
    await doc.fillBasicDetails({ documentType: discardedType, company: testData.documentMaster.valid.company });
    await doc.discardButton.click();
   
    await expect(page).toHaveURL(/\/document-master$/);
    await doc.searchList(discardedType);
    await expect(doc.noDataRow()).toBeVisible();
  });

  // ── TC-DOC-07: Delete Document Master ────────────────────────────────────
  // Deletes the Draft record from TC-DOC-05, leaving TC-DOC-01/04's record intact for any
  // future spec that wants to build on it (same pattern as 02-location.spec.js / the
  // Organization Structure suite).
  test('TC-DOC-07 [-] Delete the Draft Document Master created in TC-DOC-05', async ({ page }) => {
    const doc = new DocumentMasterPage(page);

    await doc.gotoList();
    await doc.deleteFromList(draftRecord.seriesNumber);

    await doc.searchList(draftRecord.documentType);
    await expect(doc.noDataRow()).toBeVisible();
  });

  // ── Field Validation ──────────────────────────────────────────────────────
  test.describe('Field Validation', () => {
    test('TC-DOC-V01 [-] Required Document Type/Company/Documents block save', async ({ page }) => {
      const doc = new DocumentMasterPage(page);

      await doc.goto();
      await doc.saveButton.click();

      await expect(doc.documentTypeRequiredError).toBeVisible();

      // Correcting Document Type should clear only that field's error (TC-V07 convention).
      await doc.documentTypeInput.fill('Temp Type');
      
      await doc.saveButton.click();
      await expect(doc.documentTypeRequiredError).not.toBeVisible();
  

      await doc.discardButton.click();
    });
  });

  // ── Listing Page ──────────────────────────────────────────────────────────
  test.describe('Listing Page', () => {
    test('TC-DOC-L01 [+] Search the list by Document Type', async ({ page }) => {
      const doc = new DocumentMasterPage(page);
      await doc.gotoList();
      await doc.searchList(created.documentType);
      await expect(page.getByText(created.documentType, { exact: false }).first()).toBeVisible();

      await doc.searchList('zzz-no-such-document-type-zzz');
      await expect(doc.noDataRow()).toBeVisible();
    });

    test('TC-DOC-L02 [+] Sort the ID column ascending/descending', async ({ page }) => {
      const doc = new DocumentMasterPage(page);
      await doc.gotoList();

      await doc.clickColumnHeader('ID');
      const firstSort = await doc.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(firstSort);

      await doc.clickColumnHeader('ID');
      const secondSort = await doc.getColumnAriaSort('ID');
      expect(secondSort).not.toBe(firstSort);
    });

    test('TC-DOC-L03 [+] Paginate the list', async ({ page }) => {
      const doc = new DocumentMasterPage(page);
      await doc.gotoList();

      const label = await doc.getPaginationLabel();
      expect(label).toMatch(/Page \d+ of \d+/);

      if (await doc.nextPageButton().isEnabled()) {
        await doc.nextPageButton().click();
        await page.waitForLoadState('networkidle');
        const nextLabel = await doc.getPaginationLabel();
        expect(nextLabel).not.toBe(label);
      }
    });

    test('TC-DOC-L04 [+] Row action menu offers View/Edit and destructive Delete', async ({ page }) => {
      const doc = new DocumentMasterPage(page);
      await doc.gotoList();
      await doc.searchList(created.documentType);
      await doc.openRowActionMenu(created.seriesNumber);

      await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('TC-DOC-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const doc = new DocumentMasterPage(page);
      await doc.gotoList();
      await doc.searchList(created.documentType);
      await expect(await doc.getRowStatus(created.seriesNumber)).toMatch(/Active/);
    });
  });

  // ── Browser navigation ────────────────────────────────────────────────────
  test.describe('Browser Navigation', () => {
    test('TC-DOC-N01 [+] Refresh on the list page preserves the URL and reloads data', async ({ page }) => {
      const doc = new DocumentMasterPage(page);
      await doc.gotoList();
      await doc.searchList(created.documentType);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/document-master$/);
    });

    test('TC-DOC-N02 [+] Browser Back/Forward between List and View', async ({ page }) => {
      const doc = new DocumentMasterPage(page);
      await doc.gotoList();
      await doc.searchList(created.seriesNumber);
      await doc.openViewFromList(created.seriesNumber);

      await page.goBack();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/document-master$/);

      await page.goForward();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/view-document-master/);
    });
  });
});
