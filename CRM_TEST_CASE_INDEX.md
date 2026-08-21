# CRM — Full Test Case Index

A single reference listing every CRM test case across the whole suite, so all CRM coverage can be
found in one place without hunting through files. **This is a read-only index — no test code was
moved or modified to produce it.** Extracted directly from each file's own `test(...)` calls, not
guessed.

**The one `@smoke2`-tagged test (`TC-CRMFULL-01`) is called out explicitly below and was not
touched.** Every other file in this index carries an explicit source comment stating it has no
`@smoke2` tag and must never run as part of that chain — that convention is unchanged.

Total: **179 test cases** across 16 files.

---

## 1. Full E2E Smoke Chain — `tests/02-erpforce-crm-lead-to-delivery-order.spec.js` (1 test)

| TC ID | Test Name | Tags |
|---|---|---|
| TC-CRMFULL-01 | [+] Login -> Lead -> Opportunity -> Quotation -> Sales Order -> Delivery Order (Delivered) | **@smoke2** |

---

## 2. Lead Management (39 tests)

### `tests/regression/01-lead.spec.js` (15)

| TC ID | Test Name |
|---|---|
| TC-LEAD-01 | [+] Create Lead with basic details, follow up, address and contact |
| TC-LEAD-02 | [+] Create Lead with only required fields (no Follow Up) |
| TC-LEAD-03 | [+] View Lead - verify all saved field values on detail page |
| TC-LEAD-04 | [+] Edit Lead - update Company Name, Phone and Email |
| TC-LEAD-05 | [+] Edit Lead - change Lead Status and Priority |
| TC-LEAD-06 | [+] Edit Lead - update address fields and verify changes |
| TC-LEAD-07 | [+/-] Duplicate Lead - validate duplicate name then save with new name |
| TC-LEAD-08 | [-] Delete the duplicated lead created in TC-LEAD-07 |
| TC-LEAD-09 | [-] Attempt to proceed with empty Company Name |
| TC-LEAD-10 | [-] Attempt to proceed with an invalid Email format |
| TC-LEAD-11 | [-] Attempt to proceed with a non-numeric Phone Number (stripped to empty) |
| TC-LEAD-12 | [-] Attempt to proceed with an invalid VAT Number |
| TC-LEAD-13 | [-] Attempt to proceed without selecting Lead Status and Priority |
| TC-LEAD-14 | [-] Attempt to save Address row without Country and State |
| TC-LEAD-15 | [-] Attempt to create a Lead with a Company Name that already exists |

### `tests/regression/06-lead-extended.spec.js` (24)

| TC ID | Test Name |
|---|---|
| TC-LEAD-16 | [+] Create Individual-type lead with First/Middle/Last Name |
| TC-LEAD-N01 | [-] Attempt to proceed with Entity cleared |
| TC-LEAD-N02 | [-] Individual lead missing First Name |
| TC-LEAD-N03 | [-] Individual lead missing Last Name |
| TC-LEAD-N04 | [-] Attempt to proceed with blank Responsible Person |
| TC-LEAD-N05 | [-] Attempt to proceed with a 1-character Responsible Person |
| TC-LEAD-N06 | [-] Attempt to proceed with a CRN that is not exactly 10 digits |
| TC-LEAD-N07 | [-] Attempt to proceed with Salesperson cleared |
| TC-LEAD-N18 | [-] Attempt to proceed with blank Email |
| TC-LEAD-18 | [+] Add a second Address row |
| TC-LEAD-N19 | [-] Two Address rows both marked Default Shipping is rejected |
| TC-LEAD-N20 | [-] Two Address rows both marked Default Billing is rejected |
| TC-LEAD-N19b | [-] Second Address row missing Address Type and Addressee is rejected |
| TC-LEAD-19 | [+] Add a second Contact row |
| TC-LEAD-N21 | [-] Second Contact row missing Name and Email is rejected |
| TC-LEAD-N22 | [-] Second Contact row with an invalid Email format is rejected |
| TC-LEAD-17 | [+] Save Lead as Draft, then edit and fully submit |
| TC-LEAD-20 | [+] Delete a Draft Lead via its plain Delete button |
| TC-LEAD-N25 | [-] Follow-up modal blocked when Type is not selected |
| TC-LEAD-N26 | [-] Follow-up modal blocked when Date is cleared |
| TC-LEAD-21 | [+] Add a Communication Log |
| TC-LEAD-N27 | [-] Log modal blocked when Title is empty |
| TC-LEAD-N28 | [-] Log modal blocked when Communication Type is not selected |
| TC-LEAD-N29 | [-] Log modal blocked when Date is cleared |

---

## 3. Opportunity Management (12 tests)

### `tests/regression/02-opportunity.spec.js` (1)

| TC ID | Test Name |
|---|---|
| TC-OPP-01 | [+] Create Opportunity by converting an existing Lead |

### `tests/regression/07-opportunity-extended.spec.js` (11)

| TC ID | Test Name |
|---|---|
| TC-OPP-N01 | [-] Attempt to save with no Customer selected |
| TC-OPP-N02 | [-] Attempt to save with no Expected Closing Date |
| TC-OPP-N03 | [-] Attempt to save with no Location selected |
| TC-OPP-N04 | [-] Attempt to save with zero Items |
| TC-OPP-N05 | [-] Attempt to save with a VAT Number that is not exactly 15 digits |
| TC-OPP-N06 | [-] Attempt to save with a CRN that is not exactly 10 digits |
| TC-OPP-02 | [+] Create Opportunity standalone via manual Customer search |
| TC-OPP-03 | [+] Edit Opportunity - update Expected Revenue and Priority |
| TC-OPP-04 | [+] View Opportunity - verify saved field values on detail page |
| TC-OPP-05 | [+] Delete an Opportunity via Actions menu |
| TC-OPP-06 | [+] Add a second Item to the Items table |

---

## 4. Quotation Management (11 tests)

### `tests/regression/03-quotation.spec.js` (2)

| TC ID | Test Name |
|---|---|
| TC-QUO-01 | [+] Create Quotation by converting an existing Opportunity, then Accept it |
| TC-QUO-02 | [+] Create Quotation from a freshly created Opportunity via Make Quotation |

### `tests/regression/08-quotation-extended.spec.js` (9)

| TC ID | Test Name |
|---|---|
| TC-QUO-N01 | [-] Attempt to save with no Payment Terms selected |
| TC-QUO-N02 | [-] Attempt to save with no Expiration Date |
| TC-QUO-N03 | [-] Attempt to save with a VAT Number that is not exactly 15 digits |
| TC-QUO-N05 | [-] Quick Approval Send Request blocked with zero approvers selected |
| TC-QUO-03 | [+] Edit Quotation - update Reference Number |
| TC-QUO-04 | [+] View Quotation - verify saved field values on detail page |
| TC-QUO-05 | [+] Delete a Quotation via Actions menu |
| TC-QUO-06 | [+] Quick Approval Reject flow reaches Rejected status |
| TC-QUO-07 | [+] Add a second Item to the Items table |

---

## 5. Sales Order Management (7 tests)

### `tests/crm/04-sales-order.spec.js` (1)

| TC ID | Test Name |
|---|---|
| TC-SO-01 | [+] Create Sales Order by converting an Accepted Quotation |

### `tests/regression/09-sales-order-extended.spec.js` (6)

| TC ID | Test Name |
|---|---|
| TC-SO-N01 | [-] Quick Approval Send Request blocked with zero approvers selected |
| TC-SO-02 | [+] Edit Sales Order - update PO Number |
| TC-SO-03 | [+] View Sales Order - verify saved field values on detail page |
| TC-SO-04 | [+] Delete a Sales Order via Actions menu |
| TC-SO-05 | [+] Quick Approval Reject flow reaches Rejected status |
| TC-SO-06 | [+] Add a second Item to the Items table |

---

## 6. Delivery Order Management (49 tests)

### `tests/crm/05-delivery-order.spec.js` (1)

| TC ID | Test Name |
|---|---|
| TC-DO-01 | [+] Create Delivery Order from an Accepted Sales Order and complete its lifecycle to Delivered |

### `tests/regression/10-delivery-order-list.spec.js` (15)

| TC ID | Test Name |
|---|---|
| TC-DO-02 | [+] Setup: create a fresh Delivery Order for List Page tests |
| TC-DO-03 | [+] Delivery Orders list page loads with all expected columns |
| TC-DO-04 | [+] Breadcrumb navigation from detail page returns to list |
| TC-DO-05 | [+] Status badge renders for each record |
| TC-DO-06 | [+] Sort by ID toggles ascending/descending order |
| TC-DO-07 | [+] Sort by Date toggles ascending/descending order |
| TC-DO-08 | [+] Sort by Status toggles ascending/descending |
| TC-DO-09 | [+] Default items per page is 20 |
| TC-DO-10 | [+] Change items per page updates grid size |
| TC-DO-11 | [+] Next/Previous pagination buttons navigate pages (conditionally skipped if only one page of data exists) |
| TC-DO-12 | [+] Go To a specific valid page number (conditionally skipped if only one page of data exists) |
| TC-DO-13 | [-] Go To an out-of-range page number is handled gracefully |
| TC-DO-14 | [+] "+ Add Calculation" footer is present on the grid |
| TC-DO-15 | [+] Click a Delivery Order row link navigates to its detail page |
| TC-DO-16 | [+] Row action menu offers Edit and Delete |

### `tests/regression/11-delivery-order-detail.spec.js` (30)

| TC ID | Test Name |
|---|---|
| TC-DO-17 | [+] Setup: create and progress a fresh Delivery Order to Delivered |
| TC-DO-18 | [+] Open delivery order detail page shows header ID and status |
| TC-DO-19 | [+] Verify Sales Order field is a clickable hyperlink and navigates correctly |
| TC-DO-20 | [+] Verify Customer field shows the correct lead/customer name |
| TC-DO-21 | [+] Verify Operation Type shows "Delivery Order" |
| TC-DO-22 | [+] Verify Salesperson field |
| TC-DO-23 | [+] Verify Entity field |
| TC-DO-24 | [+] Verify Reference Number shows "-" placeholder when empty |
| TC-DO-25 | [+] Verify PO Number shows "-" placeholder when empty |
| TC-DO-26 | [+] Verify PO Date shows "-" placeholder when empty |
| TC-DO-27 | [+] Items table visible with all expected columns |
| TC-DO-28 | [+] Items table shows the item created for this Delivery Order |
| TC-DO-29 | [+] Verify Quantity/On Hand/Reserved/Delivered Quantity render numeric values |
| TC-DO-30 | [+] Expand summary panel below items table |
| TC-DO-31 | [+] Switch to Package tab |
| TC-DO-32 | [+] Switch to Address and Contact tab |
| TC-DO-33 | [+] Switch to Shipping tab |
| TC-DO-34 | [+] Switch to Promotion tab |
| TC-DO-35 | [+] Tab data persists when switching between tabs |
| TC-DO-36 | [-] Known gap: Transportation section header renders untranslated i18n key |
| TC-DO-37 | [-] Known gap: Driver/Vehicle Number field labels render untranslated i18n keys |
| TC-DO-38 | [+] Verify Department in Classification section |
| TC-DO-39 | [+] Attachment section shows placeholder when empty |
| TC-DO-40 | [+] Print/Send Email/Return Delivery/Create Invoice buttons appear once Delivered |
| TC-DO-41 | [+] Click Print button opens a print dialog/preview without error |
| TC-DO-42 | [+] Click Send Email opens an email dialog with a recipient pre-filled |
| TC-DO-43 | [+] Create Invoice from a Delivered Delivery Order |
| TC-DO-44 | [-] Known gap: Accounting Ledger action button renders untranslated i18n key (BUG-01) |
| TC-DO-45 | [+] Go back button returns to the previous page |
| TC-DO-46 | [+] Module switcher opens with available modules listed |

### `tests/regression/12-delivery-order-negative.spec.js` (3)

| TC ID | Test Name |
|---|---|
| TC-DO-47 | [-] Access a non-existent Delivery Order via URL does not crash |
| TC-DO-48 | [-] Unauthenticated direct URL access redirects to login |
| TC-DO-49 | [-] Network loss during list page load shows an error, does not freeze |

---

## 7. CRM Settings (61 tests)

### Shipping Rule — `tests/crm/06-shipping-rule.spec.js` (16)

| TC ID | Test Name |
|---|---|
| TC-SHIP-01 | [+] Create Shipping Rule with all required fields |
| TC-SHIP-05 | [+] View Shipping Rule - all saved fields render correctly |
| TC-SHIP-V07 | [-] BUG - Submit button does not exist on View (`test.fail()` - expected to fail, keeps the gap visible) |
| TC-SHIP-06 | [+] Edit Shipping Rule - existing values preload, ID stays read-only |
| TC-SHIP-08 | [+] Edit a single field (Shipping Cost) - only that field updates |
| TC-SHIP-09 | [+] Toggle is_active to Inactive - persists on reopening Edit |
| TC-SHIP-15 | [+] Create Shipping Rule and Save To Draft - status shows Draft |
| TC-SHIP-V01 | [-] Required fields left empty block Save |
| TC-SHIP-V02 | [-] Non-numeric input in Shipping/Handling Cost is rejected |
| TC-SHIP-V04 | [+] Correcting an empty required field clears its inline error |
| TC-SHIP-10 | [+] Delete a Shipping Rule successfully |
| TC-SHIP-11 | [+] Related master data (Company) remains usable after delete |
| TC-SHIP-12 | [+] Search the Shipping Rule list - matching term |
| TC-SHIP-12b | [-] Search the Shipping Rule list - no matches shows "No Data" |
| TC-SHIP-13 | [+] Sort the Shipping Rule list by Name column |
| TC-SHIP-14 | [+] Paginate the Shipping Rule list |

### Customer Segments — `tests/crm/07-customer-segment.spec.js` (16)

| TC ID | Test Name |
|---|---|
| TC-CSEG-01 | [+] Create Customer Segment with required fields |
| TC-CSEG-03 | [+] View Customer Segment - all saved fields render correctly |
| TC-CSEG-08 | [+] Edit Customer Segment - existing values preload, ID stays read-only |
| TC-CSEG-07 | [+] Edit a single field (Name) - only that field updates |
| TC-CSEG-04 | [+] autoassign checkbox enables Purchase Amount/Count fields |
| TC-CSEG-05 | [+] Create with autoassign checked - Purchase Amount/Count persist |
| TC-CSEG-14 | [+] Create Customer Segment and Save To Draft - status shows Draft |
| TC-CSEG-V05 | [-] BUG - Submit does nothing |
| TC-CSEG-V01 | [-] Required fields left empty block Save |
| TC-CSEG-V04 | [+] Correcting an empty required field clears its inline error |
| TC-CSEG-10 | [+] Delete a Customer Segment successfully |
| TC-CSEG-11 | [+] Related master data (Company) remains usable after delete |
| TC-CSEG-12 | [+] Search the Customer Segments list - matching term |
| TC-CSEG-12b | [-] Search the Customer Segments list - no matches shows "No Data" |
| TC-CSEG-13a | [+] Sort the Customer Segments list by Name column |
| TC-CSEG-13b | [+] Paginate the Customer Segments list |

### Delivery Settings — `tests/crm/08-delivery-settings.spec.js` (7)

| TC ID | Test Name |
|---|---|
| TC-DLVS-01 | [+] Toggle each checkbox and persist, then restore original values |
| TC-DLVS-02 | [+] Update quote_percentage and persist, then restore original value |
| TC-DLVS-V05 | [-] BUG - quote_percentage renders a raw i18n key as its label/placeholder |
| TC-DLVS-V01 | [-] Non-numeric quote_percentage - no schema exists to block it |
| TC-DLVS-V02 | [-] Negative quote_percentage - no lower bound exists |
| TC-DLVS-V03 | [-] quote_percentage above 100 - no upper bound exists |
| TC-DLVS-V04 | [+] Rapid double-click Save does not corrupt the single record |

### Promotions — `tests/crm/09-promotions.spec.js` (21)

| TC ID | Test Name |
|---|---|
| TC-PROMO-01 | [+] Create a Fixed Amount promotion |
| TC-PROMO-05 | [+] View Promotion - all saved fields render correctly |
| TC-PROMO-V08 | [-] BUG - Quick Approval modal never opens |
| TC-PROMO-04 | [+] Edit a Promotion and persist changes |
| TC-PROMO-08 | [+] limit_usage checkbox enables limit_usage_count |
| TC-PROMO-09 | [+] Add a coupon via Add-Coupon-Modal - persists despite trigger-label bug |
| TC-PROMO-11 | [+] Add Fixed Amount reward - condition=Item |
| TC-PROMO-12 | [+] Add a second Fixed Amount reward - condition=Order Total |
| TC-PROMO-06 | [+] type becomes disabled once rewards exist |
| TC-PROMO-19 | [+] Create Promotion and Save To Draft - status shows Draft |
| TC-PROMO-16 | [+] Delete a Promotion successfully |
| TC-PROMO-17 | [+] end_date before start_date is rejected |
| TC-PROMO-18a | [+] Search the Promotions list |
| TC-PROMO-18b | [-] Search the Promotions list - no matches shows "No Data" |
| TC-PROMO-18c | [+] Sort the Promotions list by Name column |
| TC-PROMO-18d | [+] Paginate the Promotions list |
| TC-PROMO-V01 | [-] Required fields left empty block Save |
| TC-PROMO-V03 | [-] limit_usage_count required when limit_usage is checked |
| TC-PROMO-V07 | [+] Correcting an empty required field clears its inline error |
| TC-PROMO-02 | [+] Create a Percentage promotion with a reward |
| TC-PROMO-03 | [+] Create a Buy X Get Y promotion with a reward |

---

## Totals by area

| Area | Files | Tests |
|---|---|---|
| Full E2E Smoke Chain | 1 | 1 (**@smoke2**) |
| Lead Management | 2 | 39 |
| Opportunity Management | 2 | 12 |
| Quotation Management | 2 | 11 |
| Sales Order Management | 2 | 7 |
| Delivery Order Management | 4 | 49 |
| CRM Settings (Shipping Rule/Customer Segments/Delivery Settings/Promotions) | 4 | 61 |
| **Grand Total** | **16 files** | **179** |

Detailed field-level test-case documentation (steps/preconditions/expected results, not just names)
for the CRM Settings section exists separately in `CRM_SETTINGS_TEST_CASES.md`.
