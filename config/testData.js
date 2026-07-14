// Pinned via global-setup.js (process.env.TEST_RUN_TS) so every worker process in a run shares
// the same value. Without this, Playwright recycles the worker process after any test failure;
// a fresh worker re-evaluates this module and computes a new Date.now(), so every test after the
// first failure ends up searching for a record name that a *different* (discarded) worker
// process actually created - a real bug this suite hit and fixed. Falls back to Date.now() when
// required outside a Playwright run (e.g. a standalone `node -e` sanity check).
const ts = Date.now();

const testData = {
  baseUrl: 'http://localhost:7172',
  // baseUrl: 'https://dev.erpforce.co',
  credentials: {
    valid: {
      email:    'kashyap.jivani@trootech.com',
      password: 'Admin@123',
    },
    invalidEmail: {
      email:    'notexist@fake.com',
      password: 'Admin@123',
    },
    wrongPassword: {
      email:    'parth.modi+450@trootech.com',
      password: 'WrongPass@999',
    },
    emptyEmail: {
      email:    '',
      password: 'Admin@123',
    },
    emptyPassword: {
      email:    'parth.modi+450@trootech.com',
      password: '',
    },
  },

  uom: {
    valid: {
      unitName:    `Automation_UOM_${ts}`,
      symbol:      'AUTO',
      description: 'Automation Test UOM',
      entry: {
        uomName:    'AUTO_BASE',
        symbol:     'AB',
        isBaseUnit: true,
      },
    },
    missingName: {
      unitName:    '',
      symbol:      'SYM1',
      description: 'UOM missing name',
    },
    missingSymbol: {
      unitName:    'NoSymbol_UOM',
      symbol:      '',
      description: 'UOM missing symbol',
    },
    duplicate: {
      unitName:    'Automation_UOM',
      symbol:      'DUP1',
      description: 'Duplicate UOM test',
    },
    entryMissingName: {
      entry: {
        uomName:    '',
        symbol:     'XYZ',
        isBaseUnit: false,
      },
    },
    entryMissingSymbol: {
      entry: {
        uomName:    'ENTRY_TEST',
        symbol:     '',
        isBaseUnit: false,
      },
    },
  },

  attribute: {
    valid: {
      name:          `Test_Attribute_${ts}`,
      fieldType:     'Select',
      values:        ['Value 1', 'Value 2'],
      duplicatedName: `Test_Attribute_COPY_${ts}`,
    },
  },

  location: {
    valid: {
      name:                   `Test_Location_Playwright_${ts}`,
      shortName:              'TLP',
      address1:               '123 Automation Street',
      address2:               'Suite 456',
      address3:               'Block B',
      zipCode:                '400001',
      city:                   'Dubai',
      summary:                'Created via Playwright automation script',
      makeInventoryAvailable: true,
      updatedName:            `Test_Location_Playwright_UPDATED_${ts}`,
      duplicatedName:         `Test_Location_Playwright_COPY_${ts}`,
      updatedAddress1:        '456 Updated Avenue',
      updatedCity:            'Abu Dhabi',
      updatedZipCode:         '500001',
    },
  },

  itemCategory: {
    valid: {
      name:           `Automation_Category_${ts}`,
      description:    'Automated test category for electronics',
      skuPrefix:      'AUTO',
      startingSku:    '1',
      skuPreview:     'AUTO-00001',
      attribute:      'Iphone Variant',
      updatedName:    `Automation_Category_UPDATED_${ts}`,
      duplicatedName: `Automation_Category_COPY_${ts}`,
    },
  },

  discountedItem: {
    valid: {
      skuNumber:        `DISC-AUTO-${ts}`,
      name:             `Automation_Discount_${ts}`,
      discountType:     'Sales',
      account:          'Sales Revenue',
      discountCategory: 'Rate',
      discountRate:     '10',
      description:      'Automated test discount created by Playwright',
    },
  },

  // bin.location references the same name that location tests create in TC-LOC-02
  bin: {
    valid: {
      name:           `Test_Bin_${ts}`,
      location:       `Test_Location_Playwright_UPDATED_${ts}`,
      binType:        'Internal Location',
      entity:         'erp-force',
      updatedName:    `Test_Bin_UPDATED_${ts}`,
      duplicatedName: `Test_Bin_COPY_${ts}`,
    },
  },

  // Accounting module - field lists for Settings entities are backend-driven (FormParser /
  // getFormDataByResource), so the keys below are a starting point only. Confirm each entity's
  // real field names by opening its Add form in the running app (or via `npx playwright codegen`)
  // before relying on these values, then update this block accordingly.
  accounting: {
    // RBAC test accounts for chart-of-accounts.rbac.spec.js's `page` fixture. None are filled
    // in yet - every role below is null until real restricted-permission accounts are
    // provisioned in this environment, which is why every RBAC test currently skips itself
    // (see the fixture's test.skip call). Fill in { email, password } once available. See
    // ACCOUNTING_FINDINGS.md "RBAC test coverage" for what each role needs to grant/deny.
    rbacRoles: {
      fullAccess: null, // filled in below with credentials.valid - canView/canAdd/canEdit/canDelete all true
      readOnly:   null, // canView=true, canAdd/canEdit/canDelete=false
      noAdd:      null, // canAdd=false, others true
      noEdit:     null, // canEdit=false, others true
      noDelete:   null, // canDelete=false, others true
    },

    // valid.name / valid.updatedName are the generic display-name keys consumed by
    // tests/accounting/settings-entity.contract.js; each Page Object maps `name` onto its real
    // backend field via `displayNameField` (see pages/base/SettingsEntityPage.js).
    chartOfAccounts: {
      valid: {
        parentType:  'Assets',
        accountType: 'Current Assets',
        name:        `Automation_COA_${ts}`,
        updatedName: `Automation_COA_UPDATED_${ts}`,
      },
      missingRequired: {
        name: '',
      },
      // Used by chart-of-accounts.crud.spec.js. `enabled` accounts for the confirmed-live
      // Status-checkbox inversion (see ChartOfAccountsPage.setStatusEnabled) - pass a plain
      // true/false here, not a checkbox state.
      crud: {
        valid: {
          parentType:  'Assets',
          accountType: 'Current Assets',
          name:        `Automation_COA_CRUD_${ts}`,
          allowedJournal: 'Cheque Receipt Voucher',
          updatedName: `Automation_COA_CRUD_UPDATED_${ts}`,
          description: 'Created by the Chart of Accounts CRUD spec',
          enabled:     true,
        },
        missingRequired: {
          name: '',
        },
      },
    },

    // Confirmed against the running app's add-currency form: real fields are currency_name,
    // fraction, fraction_unit, smallest_fraction_value, symbol, number_format, exchange_rate.
    // There is no currency_code field (an earlier, unverified guess). Also confirmed live:
    // duplicate currency_name is currently accepted with NO uniqueness validation (see
    // ACCOUNTING_FINDINGS.md) - `duplicate` reuses valid.name with an otherwise-complete,
    // valid payload to demonstrate this.
    currency: {
      valid: {
        name:                    `Automation_Currency_${ts}`,
        updatedName:             `Automation_Currency_UPDATED_${ts}`,
        symbol:                  '$',
        fraction:                'Cents',
        fraction_unit:           '100',
        smallest_fraction_value: '0.01',
        exchange_rate:           '1',
      },
      missingRequired: {
        name: '',
      },
      duplicate: {
        name:                    `Automation_Currency_${ts}`, // intentionally same as valid.name
        symbol:                  '$',
        fraction:                'Cents',
        fraction_unit:           '100',
        smallest_fraction_value: '0.01',
        exchange_rate:           '1',
      },
    },

    // Confirmed against the running app's add-tax-code form (submitting with only name/rate
    // surfaced 4 more required fields): effective_start_date, effective_end_date,
    // tax_category_id (a searchable select - 'VAT' is an existing seeded option),
    // applies_to (a plain select with options Net/Gross).
    taxCode: {
      valid: {
        name:                 `Automation_TaxCode_${ts}`,
        updatedName:          `Automation_TaxCode_UPDATED_${ts}`,
        rate:                 '5',
        effective_start_date: '01-01-2026',
        effective_end_date:   '31-12-2026',
        tax_category_id:      'VAT',
        applies_to:           'Net',
      },
      missingRequired: {
        name: '',
      },
      boundaryRates: {
        zero:     '0',
        maxValid: '100',
        negative: '-1',
      },
    },

    // Confirmed against the running app's add-bank form: swift_number is required alongside name.
    bank: {
      valid: {
        name:         `Automation_Bank_${ts}`,
        updatedName:  `Automation_Bank_UPDATED_${ts}`,
        swift_number: `AUTOSWIFT${String(ts).slice(-6)}`,
      },
      missingRequired: {
        name: '',
      },
    },

    // Confirmed against the running app's add-bank-account form: field-array prefix is
    // `add_bank_Account` (capital A). Required fields beyond name/bank/account_number are
    // type_id (select - 'Current Account' is a seeded option), iban_code, branch_code.
    bankAccount: {
      // `bank` is a dedicated record created by 05-bank-account.spec.js itself (via BankPage) in
      // a beforeAll hook, kept independent of 04-bank.spec.js's own bank (which that suite
      // deletes as part of its own lifecycle) so this spec file can run standalone.
      valid: {
        bank:           `Automation_Bank_ForAccount_${ts}`,
        name:           `Automation_BankAccount_${ts}`,
        updatedName:    `Automation_BankAccount_UPDATED_${ts}`,
        account_number: `AC-${ts}`,
        type_id:        'Current Account',
        iban_code:      `AE07AUTOMATION${String(ts).slice(-6)}`,
        branch_code:    `BR${String(ts).slice(-4)}`,
      },
      missingRequired: {
        name: '',
      },
    },

    // Confirmed against the running app's add-tax-category form: sales_account_id and
    // purchase_account_id are both COA selects whose default (no-search) option list surfaces
    // only 4 accounts in this environment - searching "Sales"/"Purchase" by name returns "No data
    // available" (no COA account is literally named that here), so these two pre-existing
    // default-list accounts are used instead; the field doesn't appear to filter by account type.
    taxCategory: {
      valid: {
        name:               `Automation_TaxCategory_${ts}`,
        updatedName:        `Automation_TaxCategory_UPDATED_${ts}`,
        sales_account_id:   'Employee Expense Reimbursement',
        purchase_account_id: 'Depreciation Expense',
        description:        'Created by the Tax Category automation suite',
      },
      missingRequired: {
        name: '',
      },
    },

    // Confirmed against the running app's add-tax-template form: `tax_codes` is a searchable
    // select of existing Tax Code records, and this environment has none surviving by default
    // (03-tax-code.spec.js's own CRUD lifecycle deletes its record at the end). Tax Code itself
    // requires a tax_category_id - confirmed live that the 'VAT' category taxCode.valid assumes
    // no longer exists either (search returns "No data available") - so 12-tax-template.spec.js's
    // beforeAll seeds BOTH a fresh Tax Category and a Tax Code referencing it, neither ever
    // deleted, specifically so `valid.tax_codes` always has a real option to select.
    taxTemplate: {
      seedTaxCategoryName: `Automation_TaxTemplate_TCAT_${ts}`,
      seedTaxCodeName: `Automation_TaxTemplate_TC_${ts}`,
      valid: {
        name:        `Automation_TaxTemplate_${ts}`,
        updatedName: `Automation_TaxTemplate_UPDATED_${ts}`,
        tax_codes:   `Automation_TaxTemplate_TC_${ts}`,
      },
      missingRequired: {
        name: '',
      },
    },

    // Confirmed against the running app's add-fiscal-year form: real fields are year_name,
    // year_start_date, year_end_date, company_ids (only real option in this single-company
    // environment is "Trootech" - see journalEntry's comment). The list currently has zero rows,
    // so a far-future date range is used purely to avoid any future overlap-validation surprises,
    // not because one is currently known to exist.
    fiscalYear: {
      valid: {
        name:            `Automation_FiscalYear_${ts}`,
        updatedName:     `Automation_FiscalYear_UPDATED_${ts}`,
        year_start_date: '01-01-2030',
        year_end_date:   '31-12-2030',
        company_ids:     'Trootech',
      },
      missingRequired: {
        name: '',
      },
    },

    // Confirmed against the running app's add-payment-term form: required fields are name,
    // due_date_based_on and credit_days; mode_of_payment is optional but included since it's a
    // real, always-visible field. Existing rows already include "Net 30"/"Gross10" (used
    // elsewhere as purchase-invoice payment terms), so a fresh timestamped name avoids colliding
    // with those.
    paymentTerm: {
      valid: {
        name:               `Automation_PaymentTerm_${ts}`,
        updatedName:        `Automation_PaymentTerm_UPDATED_${ts}`,
        due_date_based_on:  "Day's after Invoice date",
        credit_days:        '30',
        mode_of_payment:    'Bank Draft',
      },
      missingRequired: {
        name: '',
      },
    },

    // Confirmed against the running app's add-currency-exchange form: from_currency_id/
    // to_currency_id are searchable selects scoped to this suite's own custom Currency (Settings
    // > Currency) records, NOT the broader currency list Purchase Invoice/Payment Entry draw from
    // ("US Dollars"/"INR" both return "No data available" here). 15-currency-exchange.spec.js's
    // beforeAll seeds two dedicated, never-deleted Currency records specifically for this pair.
    currencyExchange: {
      seedFromCurrencyName: `Automation_CE_From_${ts}`,
      seedToCurrencyName:   `Automation_CE_To_${ts}`,
      valid: {
        date:              '14-07-2026',
        from_currency_id:  `Automation_CE_From_${ts}`,
        to_currency_id:    `Automation_CE_To_${ts}`,
        exchange_rate:     '3.6725',
        updatedExchangeRate: '3.75',
      },
      missingRequired: {
        date: '14-07-2026',
        // from_currency_id/to_currency_id/exchange_rate intentionally left unset
      },
    },

    // Confirmed against the running app's add-accounting-setting form: company_id, department_id
    // and location_id are the ONLY required fields (this triple is the row's uniqueness key -
    // saving a combination that already exists is rejected with a snackbar, not a field error).
    // "Trootech" is this environment's one company; "Test"/"Delhi" and "Admin"/"Mumbai" are real
    // seeded Department/Location options confirmed live - picked to avoid colliding with
    // pre-existing rows for other Company/Department/Location combinations already in this list.
    accountingSetting: {
      valid: {
        company_id:    'Trootech',
        department_id: 'Test',
        location_id:   'Delhi',
      },
      updatedLocation: 'Houston',
      duplicate: {
        company_id:    'Trootech',
        department_id: 'Admin',
        location_id:   'Mumbai',
      },
    },

    // Confirmed against the running app's add-journal-type form: the only fields are `name` and
    // `is_payment` (a plain unprefixed checkbox - see JournalTypePage.js). This environment has
    // no existing custom Journal Type rows, so duplicate-name behavior is unverified - omitted
    // rather than guessed.
    journalType: {
      valid: {
        name:        `Automation_JournalType_${ts}`,
        updatedName: `Automation_JournalType_UPDATED_${ts}`,
        isPayment:   false,
      },
      missingRequired: {
        name: '',
      },
    },

    // Confirmed against the running app: company_id and currency_id both come pre-defaulted
    // (single company "Trootech", default currency "INR" in this environment) - re-selecting the
    // already-selected option leaves a stale full-viewport MUI Select backdrop that blocks every
    // subsequent click (see helpers/dropdown.js's mouse-corner-dismiss workaround), so `header`
    // intentionally omits companyId/currencyId and only sets journal_type_id, which has no
    // default. 'Journal Voucher' and 'Cash'/'Bank' are real seeded accounts/types, not guesses.
    journalEntry: {
      valid: {
        header: {
          journalTypeId: 'Journal Voucher',
        },
        lineItems: [
          { account: 'Cash', debitAmount: '1000', narration: 'Automation debit line' },
          { account: 'Bank', creditAmount: '1000', narration: 'Automation credit line' },
        ],
      },
      unbalanced: {
        lineItems: [
          { account: 'Cash', debitAmount: '1000' },
          { account: 'Bank', creditAmount: '500' },
        ],
      },
      singleLine: {
        lineItems: [{ account: 'Cash', debitAmount: '500' }],
      },
    },

    // Confirmed against the running app: `party`/`bankAccount` reference real seeded records
    // (a vendor and a bank account already present in this environment), not fabricated names -
    // there's no "Create New Party"/"Create New Bank Account" step in this pilot. `advance: true`
    // bypasses the "Bills is required" validation (see PaymentEntryPage.js) since no vendor in
    // this environment currently has an outstanding bill to allocate against.
    paymentEntry: {
      cash: {
        type: 'Cash',
        partyType: 'Vendor',
        party: 'Keyur  Italiya',
        currency: 'INR',
        amount: '500',
        narration: `Automation Cash Payment ${ts}`,
        advance: true,
      },
      bank: {
        type: 'Bank',
        partyType: 'Vendor',
        party: 'Keyur  Italiya',
        currency: 'INR',
        amount: '500',
        bankAccount: 'Test Acc',
        narration: `Automation Bank Payment ${ts}`,
        advance: true,
      },
      cheque: {
        type: 'Cheque',
        partyType: 'Vendor',
        party: 'Keyur  Italiya',
        currency: 'INR',
        amount: '11.11',
        bankAccount: 'Test Acc',
        chequeNumber: `CHQ-${ts}`,
        chequeDate: '10-07-2026',
        chequeBank: 'Automation Test Bank',
        narration: `Automation Cheque Payment ${ts}`,
        advance: true,
      },
      missingRequired: {
        type: 'Cash',
        advance: true,
        // party_type/entry_id/currency/amount all intentionally left unset
      },
    },

    // Seed data confirmed live against the running app (2026-07-14), NOT the values
    // 08-purchase-invoice-payment-pdc.spec.js uses - that file's vendor ('Keyur  Italiya') and
    // item ('Test Item') no longer exist in this environment, which was the root cause of
    // purchase-invoice.crud.spec.js's first run failing end-to-end. Also confirmed live:
    // - Currency must be 'US Dollars', not 'INR' - searching "INR" collides with an unrelated
    //   "INR-RAJ1" option and helpers/dropdown.js's fallback silently selects the wrong currency
    //   instead (no exact single match ever registers for "INR" in this environment).
    // - A plain "Save" (not Save-to-Draft) additionally requires a Shipping Address on the
    //   Address & Contact tab ("Shipping Address is required") even though Vendor Address/Contact
    //   Person auto-fill from the vendor's own saved address - Save-to-Draft skips this check.
    purchaseInvoice: {
      vendor:          'Royal Mine Industries',
      currency:        'US Dollars',
      paymentTerm:     'Net 30',
      shippingAddress: 'Rajkot',
      // `name` is the item's actual display name as it renders inside the invoice's own item
      // table/view (confirmed live - no SKU prefix there); `dropdownOption` is the full
      // "<SKU> - <name>" string the item-entry modal's search dropdown requires as its exact,
      // matchable option text. Keep both - using `dropdownOption` for on-page assertions never
      // matches, since the SKU prefix isn't part of the rendered cell text.
      item: {
        name:           'Playwright Auto Item',
        dropdownOption: 'ELEC-000071 - Playwright Auto Item',
        quantity:       '2',
        rate:           '500',
        taxTemplate:    'UAE VAT',
      },
      valid: {
        vendorInvoiceNo: `PI-AUTOMATION-${ts}`,
      },
      updated: {
        vendorInvoiceNo: `PI-AUTOMATION-${ts}-UPDATED`,
        quantity:        '3',
      },
    },

    // ---- Master Data: Customer Management ----
  //
  // Routes:
  //   List:  /dashboard/accounting/master-data/customer-management
  //   Add:   /dashboard/accounting/master-data/customer-management/add-customer
  //   Edit:  /dashboard/accounting/master-data/customer-management/:id/edit-customer
  //   View:  /dashboard/accounting/master-data/customer-management/:id/view-customer
  //
  // account_type: 'Individual' | 'Company'  (confirmed from parties.service.js)
  // Individual required fields: first_name + last_name
  // Company required field: company_name (labelled "Entity Name" in the UI)
  // Both types require at least one Address and at least one Contact before Save.
  //
  // account_id on the Accounting tab is the Account Receivable COA record.
  // Update the seeded names below to match what actually exists in your environment.
  // ── Customer Management ──────────────────────────────────────────────────────
  //
  // Routes (CRM module, also duplicated in accounting module):
  //   List:  /dashboard/accounting/master-data/customer-management
  //   Add:   .../add-customer
  //   Edit:  .../:id/edit-customer
  //   View:  .../:id/view-customer
  //
  // account_type: 'Individual' | 'Company'  (parties.service.js)
  //   Individual → first_name + last_name required
  //   Company    → company_name required (label "Entity Name")
  //
  // At least one Address AND one Contact are required before Save.
  // Accounting tab → account_id = Accounts Receivable COA.
  //
  // Address object keys must match PartyPage.addAddress() params:
  //   addressType, contactName, mobile, street1, zipCode, country, defaultBilling
  //
  // Update seeded names (accountName, paymentTerm, currencies) to match your environment.
  customerManagement: {
    individual: {
      accountType:     'Individual',
      firstName:       'Auto',
      lastName:        `Cust_${ts}`,
      // No vatNumber/crn — VAT requires exactly 15 digits, CRN exactly 10 digits;
      // invalid values show inline errors that block the Next button.
      address: {
        addressType:    'Office',
        contactName:    'Auto Cust Contact',
        street1:        '10 Automation Avenue',
        zipCode:        '100001',
        defaultBilling: true,
      },
      contact: {
        name:        'Auto Cust Contact',
        email:       `autocust.${ts}@example.com`,
        designation: 'QA Tester',
      },
      accountName:     'Accounts Receivable',
      paymentTerm:     'Net 30',
      currencies:      ['INR'],
      displayName:     `Auto Cust_${ts}`,
      updatedLastName: `Cust_${ts}_UPD`,
    },
    company: {
      accountType:        'Company',
      companyName:        `AutoCorp_${ts}`,
      // No vatNumber/crn for same reason
      address: {
        addressType:    'Office',
        contactName:    'Corp Contact',
        street1:        '20 Business Park',
        zipCode:        '200002',
        defaultBilling: true,
      },
      contact: {
        name:        'Corp Contact Person',
        email:       `autocorp.${ts}@example.com`,
        designation: 'Manager',
      },
      accountName:        'Accounts Receivable',
      paymentTerm:        'Net 30',
      currencies:         ['INR'],
      displayName:        `AutoCorp_${ts}`,
      updatedCompanyName: `AutoCorp_${ts}_UPD`,
    },
    missingRequired: {
      accountType: 'Individual',
      firstName:   '',
      lastName:    '',
    },
  },

  vendorManagement: {
    individual: {
      accountType:     'Individual',
      firstName:       'Auto',
      lastName:        `Vend_${ts}`,
      address: {
        addressType:    'Office',
        contactName:    'Auto Vend Contact',
        street1:        '30 Supplier Lane',
        zipCode:        '300003',
        defaultBilling: true,
      },
      contact: {
        name:        'Auto Vend Contact',
        email:       `autovend.${ts}@example.com`,
        designation: 'Sales Rep',
      },
      accountName:     'Accounts Payable',
      paymentTerm:     'Net 30',
      currencies:      ['INR'],
      displayName:     `Auto Vend_${ts}`,
      updatedLastName: `Vend_${ts}_UPD`,
    },
    company: {
      accountType:        'Company',
      companyName:        `AutoVendCorp_${ts}`,
      address: {
        addressType:    'Office',
        contactName:    'VendCorp Contact',
        street1:        '40 Trade Centre',
        zipCode:        '400004',
        defaultBilling: true,
      },
      contact: {
        name:        'VendCorp Contact Person',
        email:       `autovendcorp.${ts}@example.com`,
        designation: 'Account Manager',
      },
      accountName:        'Accounts Payable',
      paymentTerm:        'Net 30',
      currencies:         ['INR'],
      displayName:        `AutoVendCorp_${ts}`,
      updatedCompanyName: `AutoVendCorp_${ts}_UPD`,
    },
    missingRequired: {
      accountType: 'Individual',
      firstName:   '',
      lastName:    '',
    },
  },
  },  // closes accounting
};

// The "full access" RBAC role reuses the one admin login this suite already has - it's a real,
// working account, just not one with restricted permissions.
testData.accounting.rbacRoles.fullAccess = testData.credentials.valid;

module.exports = testData;
