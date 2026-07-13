# Accounting Module - Automation Findings & Recommendations

Findings gathered while building the Playwright pilot suite in `tests/accounting/` against
`erpforce-fe`'s Accounting module (`modules/accounting/src`). Grouped by audience.

## For the frontend team

1. **No `data-testid` (or `id`) attributes anywhere in the Accounting module.** Confirmed via a
   repo-wide search of `modules/accounting/src` - zero hits. This suite instead relies on form
   `name` attributes (`add_<entity>.<field>`), the `form="add_<entity>"` attribute on Save
   buttons, and BEM CSS classes (e.g. `.journalEntry--StatusChip--Approved`). These work today
   but are more brittle than dedicated test hooks: i18n text changes, CSS refactors, or MUI
   internals shifting can all break selectors that have nothing to do with the underlying
   behavior. **Recommendation:** add `data-testid` to Save/Discard buttons, row action menu
   items, and status chips at minimum - the highest-value, lowest-effort places to start.

2. **`journal-item-modal.tsx:83-89`** - the credit/debit amount validation only checks
   `value.match(/[0-9]/)` (string contains a digit anywhere), not that it's a well-formed
   positive number. Inputs like `"12abc"` or `"-100"` pass this check. Recommend a proper numeric
   + non-negative validator.

3. **`views/settings/voucher-settings/form/form.tsx:63-100`** - only `Company` is marked
   `required`; `Template` (the numbering pattern) has no required validation, so a voucher
   setting can be saved with no template selected. `generateVoucherPreview` then silently falls
   back to a default template (`config-table-utils.tsx:24`) rather than surfacing this to the
   user. Worth confirming this fallback is intentional.

4. **No client-side `max_length` on free-text fields in custom (non-FormParser) forms** - e.g.
   `narration`/`bill_no` in `journal-item-modal.tsx` and `item-entry-modal.tsx`. Arbitrarily long
   strings can be typed and submitted; only the backend would reject/truncate them. Good
   regression-test candidate once a limit is defined.

5. **`item-entry-modal.tsx:422-477`** - discount rate/amount bidirectional sync is driven by
   mutable `useRef` flags (`lastUserEdited`/`lastChangedBy`) rather than derived state. Rapid
   alternating edits (rate → amount → rate within one render cycle) are a plausible source of
   stale-value bugs; flagged as a regression-test target, not confirmed broken.

6. **`add-payment-request.tsx:611-621`** - the narration "required" check is a manual
   `onBlur`/`setIsError` toggle rather than integrated into the RHF/Yup pipeline used elsewhere in
   the same form. Inconsistent pattern; worth verifying the error state resets correctly on
   resubmission.

## For whoever extends this test suite

7. **Settings-entity form fields are 100% backend-driven** (`FormParser` +
   `getFormDataByResource`), so page objects can't hardcode a field list the way the
   already-automated Inventory module does. `config/testData.js`'s `accounting.*` values are
   best-effort placeholders based on what the source code explicitly references (e.g. COA's
   `parent_type_id`/`account_type_id`/`parent_account_id`/`account_code`) - **every other field
   name must be confirmed against the running app** (open the Add form, inspect `name`
   attributes, or use `npx playwright codegen`) before these tests will reliably pass.

8. **Accept/Reject/Mark-as-Void are skipped in `06-journal-entry.spec.js`** (`TC-JE-11/12/13`).
   These require the logged-in test user to be the entry's assigned approver, which depends on
   company/approver configuration in the target environment, not on anything this suite controls.
   To enable them: either configure the existing admin test user as an approver for the test
   company, or add a second "approver" test account and route the submit → accept/reject flow
   through it.

9. **RBAC/permission-restricted tests are not included.** `config/testData.js` has exactly one
   (admin) credential set. `usePermissions()` is used pervasively and consistently across every
   Accounting screen (confirmed in `chart-of-accounts.tsx`, `journal-entry.tsx`, and their view
   pages), so a second test account with reduced Accounting permissions would let a future pass
   assert that Add/Edit/Delete/Approve controls are correctly hidden or disabled.

10. **Journal Entry rows have no natural unique display name** (unlike Settings entities, which
    have a name/code the tests choose). `06-journal-entry.spec.js` works around this by capturing
    the created entry's URL in a module-level variable and reusing it across
    view/edit/duplicate/submit tests within the same file - reasonable for a `workers: 1`
    sequential suite, but not something that would survive parallelization. If the suite is ever
    parallelized, this and the existing Inventory suites' data-sharing-across-specs pattern would
    both need reworking (e.g. one browser context per test creating and cleaning up its own
    record, driven by a real API setup call rather than UI actions).

## Out of scope for this pass (tracked for follow-up)

Sales/Purchase Invoices, Payments/Collections, Credit/Debit Notes, Expense Reimbursement,
Budget, Assets, Commissions, Master Data (Customer/Vendor), and all Report screens are not yet
automated. They fit the same two archetypes (`AccountingDocumentPage` / `SettingsEntityPage`),
plus Reports would need a third, simpler base class (filter bar + read-only table + export) since
they use a different `ReportsTable` component rather than `MaterialTable`.
