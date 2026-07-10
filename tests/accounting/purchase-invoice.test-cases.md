# Purchase Invoice Automation Test Cases

Source analyzed:
`erpforce-fe/modules/accounting/src/views/purchase-invoice`

Backend table:
`purchase_invoices`

Routes:
- List: `/dashboard/accounting/invoice/purchase-invoices`
- Add: `/dashboard/accounting/invoice/purchase-invoices/add-purchase-invoice`
- Edit: `/dashboard/accounting/invoice/purchase-invoices/:id/edit-purchase-invoice`
- View: `/dashboard/accounting/invoice/purchase-invoices/:id/view-purchase-invoice`

## Seed Data Required

- Vendor with active status, company, currency, payment term, payable account, default address, and contact person.
- Payable chart of account with same currency as vendor.
- Payable chart of account with different currency for negative validation.
- Tax template with at least one tax code.
- Discount item for purchase discount.
- Inventory item with UOM and purchase enabled.
- Inventory fixed asset item with depreciation metadata.
- Fixed asset record or permission to create one from the item modal.
- Purchase invoices seeded for each approval status: `Draft`, `Pending`, `Submitted`, `Approved`, `Rejected`.
- Purchase invoices seeded for payment statuses: `Draft`, `Pending`, `Unpaid`, `Partially Paid`, `Paid`, `In Transit`.
- Permission users:
  - Full accounting admin.
  - View-only user.
  - User without add/edit/delete/export/import.
  - Approver user with `approvalstatus.canEdit`.
  - User with and without `addapprover.canAdd`.

## Listing Page

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| PI-LIST-001 | P0 | Render Item listing | Open Purchase Invoices list. | Loader appears then table/grid content renders. API includes `order_type.eq=item`. Default columns include ID, Supplier, Payment Status, Status, Total Invoice Value, Invoice Date. |
| PI-LIST-002 | P0 | Switch to Fixed Asset listing | Click title menu `Fixed Asset`. | Title changes; API includes `order_type.eq=fixed-asset`; Item invoices are not shown. |
| PI-LIST-003 | P0 | Switch Fixed Asset back to Item | Click title menu `Item`. | API includes `order_type.eq=item`; Item invoices return. |
| PI-LIST-004 | P0 | Search invoices | Search by invoice series/vendor. | API/page state includes search; pagination resets to page 1; only matching rows render. |
| PI-LIST-005 | P1 | Clear search | Clear search input. | Full list reloads; no stale search remains. |
| PI-LIST-006 | P1 | No-result search | Search impossible value. | Empty state or zero rows render cleanly; no console/runtime error. |
| PI-LIST-007 | P1 | Filter by approval/payment status | Apply table filter. | API query contains selected filter; rows match status. |
| PI-LIST-008 | P1 | Sort visible columns | Sort Invoice Date, Supplier, Total Invoice Value. | API/page state updates sort; row order changes correctly. |
| PI-LIST-009 | P1 | Pagination | Navigate next/previous, change page size. | Correct `skip`/`limit`; footer total pages update; no stale rows. |
| PI-LIST-010 | P1 | Multiple pages | Navigate to page 2+ then open row and go back. | List returns to expected page or product-standard default. |
| PI-LIST-011 | P1 | Table/Grid view switch | Switch active view from table to grid and back. | Grid cards show series, amount, status, created info; table restores. |
| PI-LIST-012 | P0 | Add Item from dropdown | Open Add dropdown and choose Item. | Navigates to Add page in Item mode. |
| PI-LIST-013 | P0 | Add Fixed Asset from dropdown | Open Add dropdown and choose Fixed Asset. | Navigates to Add page in Fixed Asset mode; expense table hidden. |
| PI-LIST-014 | P1 | Export permission | Login with export permission and without it. | Export is visible only with `generateexcel.canView`; export resource is `purchase_invoice`. |
| PI-LIST-015 | P1 | Import permission | Login with import permission and without it. | Import module `purchase-invoices` appears only with permission. |
| PI-LIST-016 | P1 | Row selection | Select one/multiple rows. | Selected IDs are passed to ActionBar/export. |
| PI-LIST-017 | P0 | Loading state | Throttle invoice list API. | Table shows loading indicator and prevents misleading empty content. |
| PI-LIST-018 | P0 | API failure | Force list API 500. | Error toast/fallback shown; page does not crash. |

## Listing Row Action Menu

| ID | Status | Payment Status | Expected Actions |
|---|---|---|---|
| PI-ACT-001 | Draft | Draft/Pending/Unpaid | Edit enabled if `canEdit`; View enabled if `canViewById`; Duplicate enabled if `canAdd`; Submit for Approval enabled if `addapprover.canAdd`; Delete enabled if `canDelete`; Mark Recurring disabled. |
| PI-ACT-002 | Pending | Pending/Unpaid | Edit, View, Duplicate, Submit for Approval enabled by permission; Delete enabled unless payment restricted. |
| PI-ACT-003 | Rejected | Pending/Unpaid | Edit, View, Duplicate, Submit for Approval enabled by permission; Delete enabled unless payment restricted. |
| PI-ACT-004 | Submitted | Pending/Unpaid | View and Duplicate enabled by permission; Edit and Submit disabled; Delete should be disabled/restricted. |
| PI-ACT-005 | Approved | Pending/Unpaid | View and Duplicate enabled; Edit, Submit, Delete disabled. |
| PI-ACT-006 | Any | In Transit/Paid/Partially Paid | Delete disabled. |
| PI-ACT-007 | Any | Any | Remove each permission and verify corresponding action hidden/disabled. |

## Add Purchase Invoice - Item

| ID | Priority | Scenario | Expected Result |
|---|---|---|---|
| PI-ADD-ITEM-001 | P0 | Open Add Item page | Form loader disappears; default bill date and posting time populate. |
| PI-ADD-ITEM-002 | P0 | Save empty form | Required validation shown; no create API call. |
| PI-ADD-ITEM-003 | P0 | Next button tab gating | Next disabled until current tab valid; valid current tab advances. |
| PI-ADD-ITEM-004 | P0 | Vendor dependency | Selecting vendor loads supplier info, address/contact options, company/currency/payment term/payable account defaults. |
| PI-ADD-ITEM-005 | P1 | Company dependency | Company filters billing/shipping/place of supply and payable account. |
| PI-ADD-ITEM-006 | P1 | Payment term due date | Due date recalculates based on payment term and bill date. |
| PI-ADD-ITEM-007 | P1 | Currency exchange | Supplier currency fetches exchange and reverse rates. |
| PI-ADD-ITEM-008 | P0 | Entry add disabled before vendor/company | Item and expense add buttons disabled until both vendor and company are selected. |
| PI-ADD-ITEM-009 | P0 | Add valid item row | Item, UOM, quantity, rate, tax template create row; summary updates. |
| PI-ADD-ITEM-010 | P0 | Item validation | Missing item/UOM/tax template/rate/quantity and zero/negative values blocked. |
| PI-ADD-ITEM-011 | P1 | Item discount | Discount item enables discount rate/amount, recalculates gross, discount, tax, net, total. |
| PI-ADD-ITEM-012 | P1 | Add expense row | Account, rate, tax template create expense row; summary updates. |
| PI-ADD-ITEM-013 | P1 | Expense validation | Missing account/rate/tax template blocked; rate less than 1 blocked. |
| PI-ADD-ITEM-014 | P1 | Edit/delete rows | Edit changes persisted in row and summary; delete confirm removes row; cancel preserves row. |
| PI-ADD-ITEM-015 | P1 | Additional discount on Net Amount | Percentage/amount recalculates final amount and tax proportionally. |
| PI-ADD-ITEM-016 | P1 | Additional discount on Gross Amount | Discount uses gross amount basis. |
| PI-ADD-ITEM-017 | P0 | Additional discount validation | Amount exceeding total and percentage greater than 100 show validation. |
| PI-ADD-ITEM-018 | P1 | Round off | Round-off option disabled until enabled; becomes required; payload includes round-off difference. |
| PI-ADD-ITEM-019 | P0 | Save | POST create payload contains `order_type=item`, item/expense entries, dates, payable account, totals, tax, discount, attachments; redirects to list; row visible. |
| PI-ADD-ITEM-020 | P0 | Save to Draft | Draft API payload includes `approval_status=Draft`, `payment_status=Draft`; redirects; status visible as Draft. |
| PI-ADD-ITEM-021 | P0 | Duplicate submit guard | Double-click Save/Save to Draft and repeated Enter generate at most one API call; loader/disabled state visible. |
| PI-ADD-ITEM-022 | P1 | API failure | Failed create/draft shows error toast and keeps form data. |
| PI-ADD-ITEM-023 | P1 | Refresh/back/discard with unsaved changes | Verify product-standard behavior. Current code navigates directly on Discard; recommend unsaved-change confirmation. |

## Add Purchase Invoice - Fixed Asset

| ID | Priority | Scenario | Expected Result |
|---|---|---|---|
| PI-ADD-FA-001 | P0 | Open Add Fixed Asset page | Add page opens in Fixed Asset mode; expense table is hidden. |
| PI-ADD-FA-002 | P0 | Inventory Fixed Asset entry | Item Type required; item dropdown filters `type.eq=inventory-fixed-asset`; UOM visible; depreciation fields shown read-only. |
| PI-ADD-FA-003 | P0 | Fixed Asset entry | Existing asset dropdown shown; create-new-asset footer opens modal; UOM hidden; quantity fixed to 1 and disabled. |
| PI-ADD-FA-004 | P1 | Prevent mixed asset type | After first asset row, Item Type disabled; cannot mix asset item types unexpectedly. |
| PI-ADD-FA-005 | P0 | Fixed asset validations | Missing item/rate/tax template blocked; invalid rate/quantity blocked. |
| PI-ADD-FA-006 | P0 | Save Fixed Asset invoice | Payload contains `order_type=fixed-asset`, fixed asset item entries, no expense entries; listing Fixed Asset mode shows row. |
| PI-ADD-FA-007 | P1 | Save Fixed Asset draft | Draft payload and statuses correct. |
| PI-ADD-FA-008 | P1 | Duplicate fixed asset invoice | Existing code filters out `item_type=fixed-asset` entries during duplicate; verify product expectation. |

## Edit Purchase Invoice

| ID | Priority | Scenario | Expected Result |
|---|---|---|---|
| PI-EDIT-001 | P0 | Edit Draft/Pending/Rejected | Form loads existing values, status chip, rows, attachments, summary. |
| PI-EDIT-002 | P0 | Submitted/Approved edit restricted | Edit action disabled; direct edit URL blocked by BE or safely rejected. |
| PI-EDIT-003 | P0 | Update header fields | PUT payload contains changed vendor/company/currency/payment term/dates/account/narration. |
| PI-EDIT-004 | P0 | Update rows | Existing row IDs retained; new rows created in edit mode; deleted rows removed from persisted invoice. |
| PI-EDIT-005 | P0 | Currency mismatch | Payable account currency mismatch shows error; no PUT. |
| PI-EDIT-006 | P0 | No entries | Removing all entries shows item error; no PUT. |
| PI-EDIT-007 | P1 | Fixed Asset edit | Expense table hidden; asset data preserved in payload. |
| PI-EDIT-008 | P0 | Duplicate submit guard | Double-click Save/repeated Enter produces at most one PUT. |
| PI-EDIT-009 | P1 | PUT failure | Error toast shown; form data preserved. |
| PI-EDIT-010 | P0 | Save success | Redirects to list; view page reflects changes after refresh. |

## View Page And Status Actions

| ID | Priority | Scenario | Expected Result |
|---|---|---|---|
| PI-VIEW-001 | P0 | View invoice details | Loader disappears; tabs render; fields, entries, files, summary, status chip visible. |
| PI-VIEW-002 | P0 | Draft view | Edit visible/enabled; Delete visible if allowed; Actions menu hidden. |
| PI-VIEW-003 | P0 | Pending/Rejected submit | Submit for Approval visible if `addapprover.canAdd`; successful submit refreshes status. |
| PI-VIEW-004 | P0 | Submitted approve/reject | Approver with `approvalstatus.canEdit` sees accept/reject; Approved/Rejected status transition persists. |
| PI-VIEW-005 | P0 | Approved action surface | Edit hidden/disabled; ledger button visible; action menu visible. |
| PI-VIEW-006 | P0 | Payment Entry | Enabled only Approved, not Paid, and `PaymentEntries.entries.canAdd`; navigates with invoice state. |
| PI-VIEW-007 | P1 | Apply advance payment | Visible only Approved plus payment status Pending/Partially Paid plus permission; modal loads advances; Apply disabled until selection; success refreshes invoice. |
| PI-VIEW-008 | P0 | Delete restrictions | Delete disabled for In Transit/Paid/Partially Paid and missing permission; successful delete redirects to list. |
| PI-VIEW-009 | P1 | Send email | Permission-gated; success and failure toast verified; loader shown. |
| PI-VIEW-010 | P1 | Download report | Permission-gated; download API called; failure toast verified. |
| PI-VIEW-011 | P1 | Mark recurring | Approved plus permission only; Day/Weekly/Monthly/Yearly payload posted. |
| PI-VIEW-012 | P1 | Stop recurring | Stop confirmation posts `is_recurring=false` and refreshes invoice. |
| PI-VIEW-013 | P1 | Accounting ledger | Opens ledger with `ref_type=purchase_invoice`, `ref_id`, and company payload. |
| PI-VIEW-014 | P1 | Debit note | Approved invoice shows add/view debit note based on existing `debit_note_id` and permission. |
| PI-VIEW-015 | P1 | Purchase return | Visible only when `can_create_purchase_return` and Approved. |
| PI-VIEW-016 | P1 | Landed cost | Approved invoice with landed-cost item and inventory setting enabled shows Create Landed Cost. |

## API And Accounting Verification

- Create/update payload maps `bill_date`, `posting_time`, `due_date`, `vendor_id`, `payment_term_id`, `supplier_invoice_number`, `supplier_invoice_date`, `supplier_currency_id`, `company_id`, `account_payable_id`, `exchange_rate`, `round_off`, `round_off_option`, `round_off_amount`, `additional_discount_on`, `additional_discount_amount`, `additional_discount_percentage`, `total_invoice_amount`, `tax_amount`, `discount_amount`, `additional_discount`, `purchase_order_id`, `order_type`.
- Draft flow sets `approval_status=Draft` and `payment_status=Draft`.
- Item mode supports both item and expense entries.
- Fixed Asset mode hides expense entries and posts `order_type=fixed-asset`.
- Approved invoice should create or expose ledger impact through the Accounting Ledger action.
- Payment/advance payment should update `amount_paid`, `amount_due`, `party_amount_paid`, `party_amount_due`, and payment status according to BE rules.
- Delete should soft-delete and remove invoice from list results.

## UX And Validation Improvements To Track

- Add/Edit Save buttons show `FormLoader`, but the handlers do not include an early `submitLoading` guard. Add guard and disable Save while submitting to prevent duplicate requests.
- Save to Draft also needs an early guard against repeated clicks and Enter key submissions.
- Discard/back navigation currently appears to navigate away without unsaved-change confirmation.
- Listing allows Submit for Approval for Draft/Pending/Rejected, while view `ApprovalWrapper` shows submit only for Pending/Rejected. Align expected UX.
- Fixed Asset duplicate flow filters out existing `item_type=fixed-asset` rows. Confirm whether this is intended.
