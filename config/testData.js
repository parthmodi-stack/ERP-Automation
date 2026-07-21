require('dotenv').config();
const ts = Date.now();
const factory = require("./testDataFactory");

const testData = {
  baseUrl: process.env.BASE_URL || "http://localhost:7172",

  credentials: {
    valid: {
      email: "dipen.modi@trootech.com",
      password: "Admin@123",
    },
    approverLogin: {
      email: "dipen.modi@trootech.com",
      password: "Admin@123",
    },
    invalidEmail: {
      email: "notexist@fake.com",
      password: "Admin@123",
    },
    // email must stay a REAL, valid account (matching credentials.valid) so the only thing
    // wrong is the password - otherwise TC-AUTH-03 would just be re-testing invalid email.
    wrongPassword: {
      email: "dipen.modi@trootech.com",
      password: "WrongPass@999",
    },
    emptyEmail: {
      email: "",
      password: "Admin@123",
    },
    // Same reasoning as wrongPassword above - keep the email valid so only the password is empty.
    emptyPassword: {
      email: "dipen.modi@trootech.com",
      password: "",
    },
  },

  uom: {
    valid: {
      unitName: factory.uniqueName("Automation_UOM"),
      symbol: "AUTO",
      description: "Automation Test UOM",
      entry: {
        uomName: "AUTO_BASE",
        symbol: "AB",
        isBaseUnit: true,
      },
    },
    missingName: {
      unitName: "",
      symbol: "SYM1",
      description: "UOM missing name",
    },
    missingSymbol: {
      unitName: "NoSymbol_UOM",
      symbol: "",
      description: "UOM missing symbol",
    },
    duplicate: {
      unitName: "Automation_UOM",
      symbol: "DUP1",
      description: "Duplicate UOM test",
    },
    entryMissingName: {
      entry: {
        uomName: "",
        symbol: "XYZ",
        isBaseUnit: false,
      },
    },
    entryMissingSymbol: {
      entry: {
        uomName: "ENTRY_TEST",
        symbol: "",
        isBaseUnit: false,
      },
    },
  },

  attribute: {
    valid: {
      name: factory.uniqueName("Test_Attribute"),
      fieldType: "Select",
      values: ["Value 1", "Value 2"],
      duplicatedName: factory.uniqueName("Test_Attribute_COPY"),
    },
  },

  location: {
    valid: {
      name: `Test_Location_Playwright_${ts}`,
      shortName: "TLP",
      address1: "123 Automation Street",
      address2: "Suite 456",
      address3: "Block B",
      zipCode: "400001",
      city: "Dubai",
      summary: "Created via Playwright automation script",
      makeInventoryAvailable: true,
      updatedName: `Test_Location_Playwright_UPDATED_${ts}`,
      duplicatedName: `Test_Location_Playwright_COPY_${ts}`,
      updatedAddress1: "456 Updated Avenue",
      updatedCity: "Abu Dhabi",
      updatedZipCode: "500001",
    },
  },

  itemCategory: {
    valid: {
      name: factory.uniqueName("Automation_Category"),
      description: "Automated test category for electronics",
      skuPrefix: "AUTO",
      startingSku: "1",
      skuPreview: "AUTO-00001",
      attribute: "Iphone Variant",
      updatedName: factory.uniqueName("Automation_Category_UPDATED"),
      duplicatedName: factory.uniqueName("Automation_Category_COPY"),
    },
  },

  discountedItem: {
    valid: {
      skuNumber: factory.referenceNumber("DISC-AUTO"),
      name: factory.uniqueName("Automation_Discount"),
      discountType: "Sales",
      account: "Sales Revenue",
      discountCategory: "Rate",
      discountRate: "10",
      description: "Automated test discount created by Playwright",
    },
  },

  // bin.location references the same name that location tests create in TC-LOC-02 - keep that
  // one field's shared `ts` coupling with location.valid.updatedName intact (factory.uniqueName()
  // generates a fresh, non-matching suffix per call, which would break the cross-reference).
  bin: {
    valid: {
      name: factory.uniqueName("Test_Bin"),
      location: `Test_Location_Playwright_UPDATED_${ts}`,
      binType: "Internal Location",
      entity: "erp-force",
      updatedName: factory.uniqueName("Test_Bin_UPDATED"),
      duplicatedName: factory.uniqueName("Test_Bin_COPY"),
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
      approverName: "Dipen Modi",
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

    // Sales Invoice - the Sales-side mirror of purchaseInvoice above. Confirmed against the
    // running app: `customer`/`item.taxCode` are best-effort seed names (this suite's
    // SalesInvoicePage.js falls back to whatever real customer/tax code already exists via
    // selectDropdown()'s search+fallback+create cascade if these don't match exactly - see
    // helpers/dropdown.js), same reasoning as purchaseInvoice's own vendor/item/taxTemplate.
    // Unlike Purchase Invoice, a plain "Save" here does NOT require anything from the
    // "Shipping" tab (confirmed live: that tab is shipping cost/rules, not an address, and Save
    // succeeded without touching it).
    salesInvoice: {
      customer:          'AutoCorp',
      currency:          'INR',
      paymentTerm:       'Net 30',
      accountReceivable: 'Accounts Receivable',
      item: {
        name:           'Playwright Auto Item',
        dropdownOption: 'ELEC-000071 - Playwright Auto Item',
        quantity:       '2',
        rate:           '500',
        taxCode:        'UAE VAT',
      },
    },

    // Collection Entry - the Sales-side mirror of paymentEntry above (money IN from a Customer,
    // via a specific Sales Invoice's Actions -> "Collection Entry" menu item rather than a
    // standalone add form). `party`/`bankAccount` reuse the same real seeded records
    // paymentEntry.cash/cheque already rely on (a Bank Account confirmed to exist - see
    // paymentEntry.bank's comment); `party` here should instead match whatever customer actually
    // ends up on the linked invoice (captured live, not hardcoded - see the spec file).
    // Confirmed live the Invoice Entries table lists EVERY outstanding invoice for that customer
    // (not just the one the Collection Entry was opened from) - this suite only applies payment
    // against our own invoice's row (matched by series number, see CollectionPage.
    // applyToInvoiceRow), so `amount`/invoicePaymentAmount here match just that one invoice's own
    // total (salesInvoice.item: quantity 2 x rate 500 = 1000 gross + 50 tax = 1050).
    collection: {
      cash: {
        type: 'Cash',
        partyType: 'Customer',
        currency: 'INR',
        amount: '1050',
        narration: `Automation Collection ${ts}`,
        invoicePaymentAmount: '1050',
      },
      cheque: {
        type: 'Cheque',
        partyType: 'Customer',
        currency: 'INR',
        amount: '1050',
        bankAccount: 'Test Acc',
        chequeNumber: `COLL-CHQ-${ts}`,
        chequeDate: '30-09-2026',
        chequeBank: 'Automation Test Bank',
        narration: `Automation Cheque Collection ${ts}`,
        invoicePaymentAmount: '1050',
      },
    },

    // Debit Note - raised against a Vendor, either standalone or tied to an approved Purchase
    // Invoice (bill). Confirmed live: `vendor` here is a best-effort seed name (this suite's
    // DebitNotePage.js falls back to whatever real Vendor already exists via selectDropdown()'s
    // search+fallback cascade if it doesn't match exactly - same reasoning as purchaseInvoice's
    // own vendor field) - always assert against the actualPartyName createDebitNote() returns,
    // not this literal value. `journalType`/`currency` are confirmed live to always have at
    // least one real option ("Journal Voucher"/company default currency).
    debitNote: {
      vendor:      'Royal Mine Industries',
      journalType: 'Journal Voucher',
      currency:    'US Dollars',
      reference:   `Automation Debit Note ${ts}`,
      amount:      '750',
      item: {
        dropdownOption: 'ELEC-000071 - Playwright Auto Item',
        quantity:       '1',
        rate:           '750',
        taxTemplate:    'UAE VAT',
      },
    },

    // Credit Note - the Sales-side mirror of debitNote above (raised against a Customer, tied
    // to an approved Sales Invoice instead of a Purchase Invoice). `customer`/`item.taxCode`
    // reuse salesInvoice's own best-effort seed names/fallback reasoning above.
    creditNote: {
      customer:    'AutoCorp',
      journalType: 'Journal Voucher',
      currency:    'INR',
      reference:   `Automation Credit Note ${ts}`,
      item: {
        dropdownOption: 'ELEC-000071 - Playwright Auto Item',
        quantity:       '1',
        rate:           '750',
        taxCode:        'UAE VAT',
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
  // Vendor/item/location/representative/approver values below are foreign-key references to
  // existing master data (same pattern as bin.valid.entity above), not freeform strings this
  // suite creates. purchaseRepresentative/vendor/approverName were live-verified against this
  // project's actual https://dev.erpforce.co account (dumped the real combobox option lists -
  // several names in this dataset render with a double space between first/last name, which is
  // real data, not a typo; keep it exact for the `exact: true` locator match to work).
  // location/itemName/entity were ported as-is from the source project's local environment and
  // are UNVERIFIED here - see the migration summary for why (an untranslated i18n key currently
  // blocks the Procurement Request Location field entirely on this environment).
  procurementRequest: {
    valid: {
      purchaseRepresentative: "QA  Nikita", // corrected: renders with double space in live DOM
      vendor: "PC new Vendor",
      // A hardcoded, already-existing record - NOT `Test_Location_Playwright_UPDATED_${ts}`.
      // That pattern (used by bin.valid.location) only works when the Location suite
      // (02-location.spec.js) has already run in the SAME process and created a record under
      // this exact same `ts`, which only happens when running the full suite, not this
      // procurement folder in isolation. This module doesn't create its own Location, so it
      // needs a value guaranteed to already exist regardless of what else has run.
      location: "Dhule",
      // NOT "Entity": basic-details.tsx's own field is genuinely called Company (company_id),
      // "erp-force" is the same default/only-option value already verified elsewhere in this
      // file (purchaseAgreement.valid.entity, vendorReturnAuthorization.valid.company).
      company: "erp-force",
      itemName: "Regression_1-00006 - Reg_item1_rental", // corrected: old value did not exist
      narration: factory.narration("Automation procurement request"),
      updatedNarration: factory.narration(
        "Automation procurement request EDITED",
      ),
      // Currency defaults to INR on the Add form, but - like Location - does NOT round-trip
      // onto the Edit form (confirmed live: blank "Search Currency" immediately after
      // navigating to Edit, before any other field is touched). Any Edit+Save flow must
      // re-select it explicitly or Save silently fails required-field validation.
      currency: "INR",
      quantity: "5",
      updatedQuantity: "8",
      rate: "100",
      // Department's option list is scoped to the selected Company (item-entry-modal.tsx /
      // basic-details.tsx both filter by company_id) and its exact live option text in this
      // account is unverified - ProcurementRequestPage falls back to "whichever option renders
      // first" (selectFirstOptionByLabel) rather than a guessed literal string, same approach
      // already used for Purchase Order's Payment Terms/Contact Person/Shipping Address.
      invalidRate: "-50",
      invalidQuantity: "0",
    },
    reject: {
      purchaseRepresentative: "Vivek  Kansara",
      vendor: "PC new Vendor", // trailing double space is part of the real name
      // NOT "Junagadh WC-1": confirmed live via network inspection that the Location field's
      // own API call (`inventory/v1/warehouse-location/?...&order=id:-1&limit=25`) always
      // returns only the 25 most-recently-created records with NO working name/search filter
      // (typing into its search input fires zero new requests) - any location outside that
      // ever-shifting recent window can never be selected through the UI. Reuse the same
      // pinned value already proven reachable elsewhere in this suite instead of a value that
      // depends on how much other Location-suite junk data has piled up since.
      location: "Dhule",
      itemName: "Regression_1-00006 - Reg_item1_rental", // corrected: old value did not exist
      narration: factory.narration(
        "Automation procurement request reject flow",
      ),
      currency: "INR",
      quantity: "3",
      rate: "50",
    },
    // Must be the CURRENTLY LOGGED-IN test user, not an arbitrary employee - the Accept/Reject
    // split-button on a record's View page only renders for whoever the pending approval was
    // actually sent to. Sending it to a different employee (this was "Dipen Modi" before) leaves
    // the logged-in session with only a lone "Cancel" button and no way to accept (confirmed
    // live via repeated polling - no split-button ever appears in that case, at any point after
    // Quick Approval).
    // Matches credentials.valid = dipen.modi@trootech.com, confirmed live in the app header
    // ("D / Dipen Modi / Admin") - keep this in sync if credentials.valid ever changes again.
    approverName: "Dipen Modi",
  },

  purchaseAgreement: {
    valid: {
      name: factory.uniqueName("Automation_purchase_agreement"),
      agreementType: "Blanket",
      purchaseRepresentative: "Dipen  Modi",
      vendor: "PC new Vendor",
      // NOT "Ahmedabad": confirmed live (via the browser's own DevTools Network tab, zero
      // requests fire while typing) that Purchase Agreement's Location search box is a genuine
      // app bug - it never calls its filter API at all, unlike Procurement Request's Location
      // field which searches correctly. Only values already in the default unfiltered "25
      // most-recently-created" list are reachable here, so pin to one that's currently visible
      // without searching.
      location: "Dhule",
      itemName: "Regression_1-00006 - Reg_item1_rental", // corrected: old value did not exist
      narration: factory.narration("Automation purchase agreement"),
      updatedNarration: factory.narration(
        "Automation purchase agreement EDITED",
      ),
      entity: "erp-force", // verified - default/only entity option
      updatedLocation: "Dhule", // verified - exists exactly as written
      minOrderQty: "5",
      updatedMinOrderQty: "8",
      rate: "100",
    },
    reject: {
      name: factory.uniqueName("Automation_purchase_agreement_reject_flow"),
      agreementType: "Blanket",
      purchaseRepresentative: "Dipen  Modi",
      vendor: "Royal Mine Industries",
      // NOT "Ahmedabad": confirmed live (via the browser's own DevTools Network tab, zero
      // requests fire while typing) that Purchase Agreement's Location search box is a genuine
      // app bug - it never calls its filter API at all, unlike Procurement Request's Location
      // field which searches correctly. Only values already in the default unfiltered "25
      // most-recently-created" list are reachable here, so pin to one that's currently visible
      // without searching.
      location: "Dhule",
      itemName: "Regression_1-00006 - Reg_item1_rental", // corrected: old value did not exist
      narration: factory.narration("Automation purchase agreement reject flow"),
      // NOT "INR": confirmed live via screenshot that vendor "Royal Mine Industries"' own linked
      // currency list doesn't contain a plain "INR" entry (only "INR-RAJ1", a different exact
      // string, alongside Morocco/Irani Rial/Paraguayan guarani/etc.) - Currency's options are
      // scoped to whatever's linked to the selected vendor, so use one that's actually there.
      currency: "INR-RAJ1",
      minOrderQty: "3",
      rate: "50",
    },
    // Must be the CURRENTLY LOGGED-IN test user, not an arbitrary employee - the Accept/Reject
    // split-button on a record's View page only renders for whoever the pending approval was
    // actually sent to. Sending it to a different employee (this was "Dipen Modi" before) leaves
    // the logged-in session with only a lone "Cancel" button and no way to accept (confirmed
    // live via repeated polling - no split-button ever appears in that case, at any point after
    // Quick Approval).
    // Matches credentials.valid = dipen.modi@trootech.com, confirmed live in the app header
    // ("D / Dipen Modi / Admin") - keep this in sync if credentials.valid ever changes again.
    approverName: "Dipen Modi",
  },

  purchaseOrder: {
    // Vendor/entity/location/item/approver values are pinned to the same live-verified master
    // data already proven reachable by the sibling Procurement Request/Purchase Agreement
    // suites - not independently re-verified for Purchase Order specifically. Payment Terms/
    // Vendor Address/Contact Person/Shipping Address are required fields whose exact option
    // text in this account is unverified, so PurchaseOrderPage selects whichever option renders
    // first for those instead of a guessed literal string (see selectFirstOptionByLabel).
    valid: {
      vendor: "PC new Vendor",
      entity: "erp-force",
      currency: "INR",
      purchaseRepresentative: "QA  Nikita", // renders with a double space in the live DOM
      location: "Dhule",
      itemName: "Regression_1-00006 - Reg_item1_rental",
      narration: factory.narration("Automation purchase order"),
      updatedNarration: factory.narration("Automation purchase order EDITED"),
      quantity: "5",
      updatedQuantity: "8",
      rate: "100",
    },
    reject: {
      // Same vendor as valid: PO's Currency field isn't confirmed to be vendor-scoped the way
      // Purchase Agreement's is, so avoid pairing a different vendor with a currency that may
      // not be in its linked list.
      vendor: "PC new Vendor",
      entity: "erp-force",
      currency: "INR",
      purchaseRepresentative: "Dipen  Modi",
      location: "Dhule",
      itemName: "Regression_1-00006 - Reg_item1_rental",
      narration: factory.narration("Automation purchase order reject flow"),
      quantity: "3",
      rate: "50",
    },
    // Must be the CURRENTLY LOGGED-IN test user - see the identical comment on
    // procurementRequest.approverName/purchaseAgreement.approverName for why. Matches
    // credentials.valid = dipen.modi@trootech.com.
    approverName: "Dipen Modi",
  },

  rfq: {
    valid: {
      // NOT "PC new Vendor": confirmed live that this vendor has zero configured Contact
      // Persons (Address & Contact tab's Contact Person dropdown was empty), which is a
      // required field. "PC vendor" (note: different from "PC new Vendor" - easy to confuse)
      // has a real contact ("manan") - live-verified via the Contact Person option list.
      vendor: "PC vendor",
      purchaseRepresentative: "QA  Nikita",
      // Address & Contact tab fields - both required, NOT auto-filled by Vendor selection
      // (confirmed live: only Vendor Address auto-fills; Contact Person and Shipping Address
      // stay blank until explicitly selected, and Save fails validation without them).
      contactPerson: "manan",
      shippingAddress: "Dhule", // NOT "Nagpur": pushed out of the 25-most-recent window by accumulated test Location data (same issue as Purchase Agreement's Location field)
      itemName: "Regression_1-00006 - Reg_item1_rental",
      narration: factory.narration("Automation RFQ"),
      updatedNarration: factory.narration("Automation RFQ EDITED"),
      requestedQuantity: "5",
      updatedRequestedQuantity: "8",
      vendorAddress: "test address, Maharashtra, India",
    },
    cancel: {
      vendor: "PC vendor",
      purchaseRepresentative: "QA  Nikita",
      contactPerson: "manan",
      shippingAddress: "Dhule",
      itemName: "Regression_1-00006 - Reg_item1_rental",
      narration: factory.narration("Automation RFQ cancel flow"),
      requestedQuantity: "3",
    },
  },

  // Vendor/currency/company/location/item values reuse the same live-verified master data
  // already proven reachable by the sibling Procurement Request/Purchase Order suites, not
  // independently re-verified for Vendor Return Authorization specifically (this module's page
  // object/spec were written from erpforce-fe source reading, not iterative live debugging - see
  // the "UNVERIFIED LIVE" comment on VendorReturnAuthorizationPage.js). Supplier Address/Contact
  // Person/Shipping Address are required but have no known-good literal value in this account, so
  // VendorReturnAuthorizationPage.fillAddressContact() picks whichever option renders first for
  // each instead (same approach PurchaseOrderPage.selectFirstOptionByLabel takes for its own
  // unverified Vendor Address/Contact Person/Shipping Address fields) - no testData entries are
  // needed for those three.
  vendorReturnAuthorization: {
    valid: {
      vendor: "PC new Vendor",
      currency: "INR",
      exchangeRate: "1",
      company: "erp-force", // verified elsewhere in this file - default/only company option
      location: "Dhule",
      purchaseRepresentative: "QA  Nikita", // renders with a double space in the live DOM
      referenceNo: factory.referenceNumber("AUTO-VRA"),
      narration: factory.narration("Automation vendor return authorization"),
      updatedNarration: factory.narration(
        "Automation vendor return authorization EDITED",
      ),
      // uom is intentionally omitted: item-entry-modal.tsx auto-fills UoM from the selected
      // Item's own default (autofillItemVendorName -> setValue('vra_items.uom_id', ...)), same as
      // every sibling module's item modal - no manual selection needed.
      itemName: "Regression_1-00006 - Reg_item1_rental",
      quantity: "5",
      updatedQuantity: "8",
      rate: "100",
      supplier_address_id: "test address, Maharashtra, India",
      contact_person_id: "PC new Vendor",
      shipping_address_id: "Dhule",
      approverName: "Dipen Modi",
    },
    reject: {
      // Same vendor as valid: Currency isn't confirmed to be vendor-scoped the way Purchase
      // Agreement's is for this module, so avoid pairing a different vendor with a currency that
      // may not be in its linked list (see purchaseAgreement.reject's comment on this class of
      // issue).
      vendor: "PC new Vendor",
      currency: "INR",
      exchangeRate: "1",
      company: "erp-force",
      location: "Dhule",
      purchaseRepresentative: "Dipen  Modi",
      narration: factory.narration(
        "Automation vendor return authorization reject flow",
      ),
      itemName: "Regression_1-00006 - Reg_item1_rental",
      quantity: "3",
      rate: "50",
      supplier_address_id: "test address, Maharashtra, India",
      contact_person_id: "PC new Vendor",
      shipping_address_id: "Dhule", // verified present in the Shipping Address option list
    },
    // Must be the CURRENTLY LOGGED-IN test user - see the identical comment on
    // procurementRequest.approverName/purchaseAgreement.approverName/purchaseOrder.approverName
    // for why. Matches credentials.valid = dipen.modi@trootech.com.
    approverName: "Dipen Modi",
  },


  landedCost: {
    valid: {
      receipt: "PO-GRN-2026-000246",
      itemName: "345 - act",
      narration: "Automation Landed Cost",
      cost: "100",
    }
  },
  // ========================
  // ORGANIZATION STRUCTURE
  // ========================
  // Unlike Location/Bin/UOM, Company/Location/Designation here are dropdown selections of
  // EXISTING master records (a React Flow graph builder, not a flat create form) - there's no
  // free-text company/location entry on this sidebar, so `company`/`designation` below are
  // best-effort preferred values, not guaranteed-unique generated names - if this account's real
  // master data doesn't have them, selectFieldByLabel throws (it does NOT silently fall back to
  // "first available"; only selectFirstOptionByLabel does that) so pick a value confirmed to
  // exist, or use selectFirstOptionByLabel explicitly instead. `location`/`updatedLocation` are
  // NOT existing master data at all - confirmed live this account has no stable/pinnable set of
  // real Location names, so OrganizationStructurePage.fillCompanySidebar always creates a fresh
  // Location via the dropdown's "Create New Location" footer using these as the NEW location's
  // name - hence the run-unique suffix, so repeated runs don't pile up identically-named records.
  organizationStructure: {
    valid: {
      company: "erp-force", // matches the Entity value used elsewhere (e.g. LocationPage.entityLabel)
      location: factory.uniqueName("Automation_Location"),
      designation: "Manager",
      updatedLocation: factory.uniqueName("Automation_Location_UPDATED"),
    },
    draft: {
      company: "erp-force",
      location: factory.uniqueName("Automation_Location_Draft"),
      designation: "Manager",
    },
  },

  // ========================
  // DEPARTMENT MASTER
  // ========================
  departmentMaster: {
    valid: {
      departmentCode: factory.uniqueName("DEPT"),
      departmentName: factory.uniqueName("Automation_Department"),
      parentDepartment: "Test Operations",
      noOfTeams: "3",
      noOfSubDepartments: "2",
      status: "Active",
      description: "Automated test department created by Playwright",
      updatedDepartmentName: factory.uniqueName("Automation_Department_UPDATED"),
      updatedParentDepartment: "HR Operations",
      duplicatedName: factory.uniqueName("Automation_Department_COPY"),
    },
    missingCode: {
      departmentCode: "",
      departmentName: "Test Department",
      parentDepartment: "Operations",
      status: "Active",
    },
    missingName: {
      departmentCode: "DEPT-TEST-001",
      departmentName: "",
      parentDepartment: "Operations",
      status: "Active",
    },
    missingParent: {
      departmentCode: "DEPT-TEST-002",
      departmentName: "Test Department",
      parentDepartment: "",
      status: "Active",
    },
    duplicate: {
      departmentCode: "AUTO-1783589685387",
      departmentName: "Automation Dept 1783589685387",
      parentDepartment: "Test Operations",
      status: "Active",
    },
    inactive: {
      departmentCode: factory.uniqueName("DEPT_INACTIVE"),
      departmentName: factory.uniqueName("Inactive_Department"),
      parentDepartment: "Test Operations",
      status: "Inactive",
      description: "Inactive department for testing",
    },
  },

  // ========================
  // DESIGNATION MASTER
  // ========================
  designationMaster: {
    valid: {
      id: `DSG-${ts}`,
      company: "erp-force",
      designationCode: factory.uniqueName("DESIG"),
      designationName: factory.uniqueName("Automation_Designation"),
      reportsTo: "Manager",
      level: "5",
      status: "Active",
      description: "Automated test designation created by Playwright",
      updatedDesignationName: factory.uniqueName("Automation_Designation_UPDATED"),
      updatedLevel: "7",
      updatedReportsTo: "Senior Manager",
      duplicatedName: factory.uniqueName("Automation_Designation_COPY"),
    },
    missingCode: {
      designationCode: "",
      designationName: "Test Designation",
      company: "erp-force",
      reportsTo: "Manager",
      level: "3",
    },
    missingName: {
      designationCode: "DSG-TEST-001",
      designationName: "",
      company: "erp-force",
      reportsTo: "Manager",
      level: "3",
    },
    missingLevel: {
      designationCode: "DSG-TEST-002",
      designationName: "Test Designation",
      company: "erp-force",
      reportsTo: "Manager",
      level: "",
    },
    duplicate: {
      designationCode: "QA-TEST-001",
      designationName: "QA Test Engineer - Updated",
      company: "erp-force",
      reportsTo: "CTO",
      level: "3",
    },
    qaEngineer: {
      designationCode: factory.uniqueName("QA_ENG"),
      designationName: "QA Engineer",
      company: "erp-force",
      reportsTo: "QA Manager",
      level: "4",
      status: "Active",
    },
    developmentLead: {
      designationCode: factory.uniqueName("DEV_LEAD"),
      designationName: "Development Lead",
      company: "erp-force",
      reportsTo: "Tech Director",
      level: "6",
      status: "Active",
    },
    hrSpecialist: {
      designationCode: factory.uniqueName("HR_SPEC"),
      designationName: "HR Specialist",
      company: "erp-force",
      reportsTo: "HR Manager",
      level: "3",
      status: "Active",
    },
    supportStaff: {
      designationCode: factory.uniqueName("SUPPORT"),
      designationName: "Support Staff",
      company: "erp-force",
      reportsTo: "Support Manager",
      level: "2",
      status: "Active",
    },
  },

  // ========================
  // DOCUMENT MASTER
  // ========================
  // Document Type/Document Name/Remarks are free text (factory-generated for uniqueness per run);
  // Company is a dropdown FK reference, pinned to the same real, live-verified "erp-force" value
  // used elsewhere in this suite (e.g. bin.valid.entity) - faker cannot invent a valid one.
  documentMaster: {
    valid: {
      documentType: factory.uniqueName("Passport_Verification"),
      company: "erp-force",
      documents: [
        {
          documentName: factory.uniqueName("Passport"),
          remarks: "Passport Verification Required",
          validityCheck: true,
        },
        {
          documentName: factory.uniqueName("PAN_Card"),
          remarks: "PAN Verification Pending",
          validityCheck: false,
        },
      ],
      updatedDocumentType: factory.uniqueName("Passport_Verification_UPDATED"),
      updatedRemarks: factory.narration("Updated remarks"),
    },
    onboarding: {
      documentType: factory.uniqueName("Employee_Onboarding"),
      company: "erp-force",
      documents: [
        { documentName: factory.uniqueName("Aadhaar_Card"), remarks: "Identity Proof", validityCheck: true },
        { documentName: factory.uniqueName("Driving_License"), remarks: "Address Verification", validityCheck: false },
      ],
    },
    vendorCompliance: {
      documentType: factory.uniqueName("Vendor_Compliance"),
      company: "erp-force",
      status: "Inactive",
      documents: [
        { documentName: factory.uniqueName("GST_Certificate"), remarks: "Tax Document", validityCheck: true },
        { documentName: factory.uniqueName("MSME_Certificate"), remarks: "Government Registration", validityCheck: false },
      ],
    },
    missingDocumentType: {
      documentType: "",
      company: "erp-force",
      documents: [{ documentName: factory.uniqueName("Missing_Doc_Type_Doc") }],
    },
    missingCompany: {
      documentType: factory.uniqueName("Missing_Company_Type"),
      company: "",
      documents: [{ documentName: factory.uniqueName("Missing_Company_Doc") }],
    },
    noDocuments: {
      documentType: factory.uniqueName("No_Docs_Type"),
      company: "erp-force",
      documents: [],
    },
    // Negative/edge-case free-text values for the Document Type and grid Document Name fields -
    // not tied to any one dataset above, reused across whichever TC-V0x case needs them.
    negative: {
      onlySpaces: "   ",
      specialChars: "<script>alert(1)</script>",
      sqlInjection: "' OR 1=1 --",
      longString: "A".repeat(500),
      hindi: "हिन्दी दस्तावेज़",
      chinese: "中文文档",
      japanese: "日本語ドキュメント",
      emoji: "Document 😀",
      leadingSpaces: "   Leading_Space_Document",
      trailingSpaces: "Trailing_Space_Document   ",
    },
  },

  // ========================
  // COMPANY CALENDAR
  // ========================
  // Calendar Name is free text (faker.company.name()-based, factory-generated for uniqueness);
  // Company/Department are dropdown FK references, pinned to the same real, live-verified values
  // used elsewhere in this suite (bin.valid.entity). Location is NOT pinned to an existing name -
  // confirmed live this account has no stable/pinnable set of real Location names, so
  // CompanyCalendarPage.fillClassification always creates a fresh Location via the dropdown's own
  // "Create New Location" footer using this as the NEW location's name, hence the run-unique
  // suffix. A new Add form already comes pre-filled with Mon-Fri 09:00-18:00 working hours /
  // 13:00-14:00 break and Sat/Sun as Week Off (confirmed in erpforce-hrms-fe's default-data.ts) -
  // `workingDays` below is only needed for tests that explicitly change a day.
  companyCalendar: {
    valid: {
      calendarName: factory.calendarName(),
      company: "erp-force",
      location: factory.uniqueName("Automation_Location"),
      department: "Debug Department",
      workingHours: { start: "09:00 AM", end: "06:00 PM" },
      breakTime: { start: "01:00 PM", end: "02:00 PM" },
      holidays: [
        {
          title: "Republic Day",
          startDate: "26-01-2026",
          endDate: "26-01-2026",
          type: "Full Day",
          description: "National Holiday",
        },
        {
          title: "Diwali",
          startDate: "08-11-2026",
          endDate: "09-11-2026",
          // Real select options are only "Full Day"/"Half Day" (confirmed in
          // erpforce-hrms-fe/src/views/company-calendar/utils/default-data.ts) - a multi-day
          // holiday is expressed via Start/End Date spanning two days, not a "Multiple Days" type.
          type: "Full Day",
          description: "Festival Holiday",
        },
      ],
      updatedCalendarName: factory.calendarName(),
    },
    missingCalendarName: {
      calendarName: "",
      company: "erp-force",
    },
    onlySpacesCalendarName: {
      calendarName: "   ",
      company: "erp-force",
    },
    // Cross-field time validation cases - exact messages confirmed in calendar-card.tsx.
    invalidWorkingHours: { start: "06:00 PM", end: "09:00 AM" }, // start after end
    breakOutsideWorkingHours: { start: "07:00 AM", end: "08:00 AM" }, // before working hours start
    holidayMissingTitle: { startDate: "26-01-2026", endDate: "26-01-2026", type: "Full Day" },
    holidayMissingStartDate: { title: "No Start Date Holiday", endDate: "26-01-2026", type: "Full Day" },
    holidayMissingEndDate: { title: "No End Date Holiday", startDate: "26-01-2026", type: "Full Day" },
    holidayEndBeforeStart: {
      title: "Backwards Holiday",
      startDate: "26-01-2026",
      endDate: "20-01-2026",
      type: "Full Day",
    },
  },

  // ========================
  // LEAVE POLICY MASTER
  // ========================
  // Leave Type Title is free text (factory-generated for uniqueness); Company/Leave
  // Category/Department are dropdown FK references, pinned to the same real, live-verified
  // "erp-force"/"QA" values used elsewhere in this suite (Company Calendar, Organization
  // Structure) - NOTE selectFieldByLabel does NOT fall back to "first available" on its own
  // (confirmed live; only selectFirstOptionByLabel does), so these must be values genuinely
  // confirmed to exist, not just "best effort". Location is NOT pinned - confirmed live this
  // account has no stable/pinnable set of real Location names, so
  // LeavePolicyMasterPage.fillLeaveTypeTab always creates a fresh Location via the dropdown's own
  // "Create New Location" footer using this as the NEW location's name, hence the run-unique
  // suffix. "companyB"/"companyWithNoLocations"/etc. below are placeholders per
  // LEAVE_POLICY_MASTER_TEST_CASES.md's Test Data Matrix - they MUST be identified against the
  // live/dev environment before use, not fabricated; using "erp-force" for all of them until then
  // would silently turn every Company-switch test into a same-company no-op.
  leavePolicyMaster: {
    valid: {
      company: "erp-force",
      leaveCategory: "Sick Leave",
      title: factory.uniqueName("Automation_LeaveType"),
      annualEntitlement: "12",
      accrualType: "Monthly",
      effectiveFrom: "01-01-2026",
      location: factory.uniqueName("Automation_Location"),
      department: "QA",
      updatedTitle: factory.uniqueName("Automation_LeaveType_UPDATED"),
    },
    // TODO: identify a second, real, distinct Company in the live/dev environment before using
    // this in a Company-switch dependency test - do not default this to "erp-force".
    companyB: undefined,
    negative: {
      onlySpacesTitle: "   ",
      negativeAnnualEntitlement: "-5",
      fractionalCarryForwardDays: "2.5",
    },
  },

};

// The "full access" RBAC role reuses the one admin login this suite already has - it's a real,
// working account, just not one with restricted permissions.
testData.accounting.rbacRoles.fullAccess = testData.credentials.valid;

module.exports = testData;
