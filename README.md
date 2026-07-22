# ERP-Automation

Playwright end-to-end tests for ERPForce (`erpforce-fe`), organized by module using the Page
Object Model.

## Setup

```bash
npm install
npx playwright install chromium   # first time only
```

Update `config/testData.js` if needed:
- `testData.baseUrl` - the running `erpforce-fe` instance (defaults to `http://localhost:7172`).
- `testData.credentials.valid` - the login used by `global-setup.js` to seed `auth.json`, the
  shared session reused by every test via `storageState: 'auth.json'` in `playwright.config.js`.

The target app must be running and reachable at `testData.baseUrl` before running any suite.

## Running tests

```bash
npm test                 # full suite (all modules)
npm run test:headed      # full suite, visible browser
npm run test:smoke       # only tests tagged @smoke
npm run test:login       # auth flow only
npm run test:accounting  # Accounting module only
npm run test:report      # open the last HTML report
```

Tests run with `workers: 1` (sequential) because specs intentionally build on data created by
earlier specs within the same file/module (see the "shares state" notes at the top of each spec
file) - do not parallelize without first removing that coupling.

## Structure

```
pages/
  base/           Shared Page Object base classes (one per module archetype)
  <module>/       Page Objects for a specific module, e.g. accounting/, (flat files for inventory)
tests/
  <module>/       Spec files for a module, named NN-entity.spec.js
config/testData.js Centralized test data, namespaced per module/entity
helpers/          Cross-module UI helpers (e.g. helpers/dropdown.js for search-dropdown widgets)
fixtures/         Static files used by tests (e.g. an upload fixture)
```

## Accounting module

`pages/base/SettingsEntityPage.js` and `pages/base/AccountingDocumentPage.js` model the two
recurring screen archetypes found in `erpforce-fe`'s Accounting module:

- **Settings entity** (Chart of Accounts, Currency, Tax Code, Bank, Bank Account, and by
  extension Tax Category, Tax Template, Fiscal Year, Payment Term, Journal Types, Voucher
  Settings, Accounting Settings): simple list → add/edit → view CRUD, entirely driven by a
  backend form schema (`FormParser`). To automate a new entity here: create a page object
  extending `SettingsEntityPage` with its `entityKey`/`listPath`/`addPath`/`displayNameField`,
  then call `registerSettingsEntityTests(...)` from `tests/accounting/settings-entity.contract.js`
  in a new spec file - see `tests/accounting/02-currency.spec.js` for the minimal example.
- **Document with approval workflow** (Journal Entry, Sales/Purchase Invoice, Cash Expense,
  Credit/Debit Note, Payment/Collection, Expense Reimbursement, Budget, Asset/Asset Transfer,
  Commission*): list → add (with line items) → edit → view, plus Submit for Approval / Accept /
  Reject / Mark as Void. Extend `AccountingDocumentPage` - see
  `pages/accounting/JournalEntryPage.js` and `tests/accounting/06-journal-entry.spec.js`.

### Important: form field names are backend-driven

Settings-entity forms are rendered from `getFormDataByResource(<resource>)`, not hardcoded in
the frontend - the field list only exists at runtime. Before trusting/extending
`config/testData.js`'s `accounting.*` values, open the relevant Add form in the running app (or
run `npx playwright codegen <baseUrl>/dashboard/accounting/...`) and confirm each field's `name`
attribute matches the `<entityKey>.<field>` assumptions documented in each page object's
file-level comment.

See `ACCOUNTING_FINDINGS.md` for known frontend gaps and framework follow-ups discovered while
building this suite.
