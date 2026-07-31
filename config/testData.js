require('dotenv').config();
const ts = Date.now();
const factory = require("./testDataFactory");
const tsDigits = String(ts).slice(-8);
const testData = {
  baseUrl: process.env.BASE_URL || "http://localhost:7173",

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
    // Every other Settings field (currency_id, inventory_valuation_in/out, and ~35 other
    // account-mapping selects) auto-fills its own default once Company is picked. "Trootech" is
    // this environment's one company; "Procurement"/"Administration" are real seeded Department
    // options confirmed live (the previously-assumed "Test"/"Admin" no longer exist - selecting
    // them silently fell back to whatever real option the dropdown defaults to instead).
    // Confirmed live: a specific Location value can only ever be used successfully ONCE in this
    // environment's whole lifetime - even deleting the row that used it doesn't free it back up,
    // Save just silently fails again. `valid`/`updatedLocation` are timestamped so every run uses
    // a genuinely new Location (created on the fly via the dropdown's own "+ Create New" option -
    // see AccountingSettingPage.create()'s `createNewLocation`), rather than a static name that
    // only ever works on the very first run. `duplicate` deliberately stays static/reused - it's
    // supposed to already exist so the duplicate-rejection path actually triggers - the spec's own
    // self-heal step creates it once if missing and leaves it in place after that.
    accountingSetting: {
      valid: {
        company_id:    'Trootech',
        department_id: 'Procurement',
        location_id:   `Automation_Location_${ts}`,
      },
      updatedLocation: `Automation_Location_${ts}_UPD`,
      duplicate: {
        company_id:    'Trootech',
        department_id: 'Administration',
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
      // `party` was 'Keyur  Italiya' - confirmed live that vendor no longer exists in this
      // environment (see the purchaseInvoice block's own comment below, where the same stale
      // vendor was already swapped out) - switched to 'Royal Mine Industries', the same
      // confirmed-live, currently-existing vendor purchaseInvoice already uses.
      cash: {
        type: 'Cash',
        partyType: 'Vendor',
        party: 'Royal Mine Industries',
        currency: 'INR',
        amount: '500',
        narration: `Automation Cash Payment ${ts}`,
        advance: true,
      },
      bank: {
        type: 'Bank',
        partyType: 'Vendor',
        party: 'Royal Mine Industries',
        currency: 'INR',
        amount: '500',
        bankAccount: 'Test Acc',
        narration: `Automation Bank Payment ${ts}`,
        advance: true,
      },
      cheque: {
        type: 'Cheque',
        partyType: 'Vendor',
        party: 'Royal Mine Industries',
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
    // applyToInvoiceRow), so `amount`/invoicePaymentAmount here must match that invoice's own
    // total. The original '1050' assumed quantity 2 x rate 500 = 1000 gross + 50 tax - confirmed
    // live the Collection dialog's own "Invoice Amount" instead reads 1000 (no tax component
    // included there), so '1050' overpays by 50 and is rejected with "Payment cannot be added
    // more than the due amount: 1000" (TC-SI-COLL-01). Use 1000 - the confirmed-live real total.
    collection: {
      cash: {
        type: 'Cash',
        partyType: 'Customer',
        currency: 'INR',
        amount: '1000',
        narration: `Automation Collection ${ts}`,
        invoicePaymentAmount: '1000',
      },
      cheque: {
        type: 'Cheque',
        partyType: 'Customer',
        currency: 'INR',
        amount: '1000',
        bankAccount: 'Test Acc',
        chequeNumber: `COLL-CHQ-${ts}`,
        chequeDate: '30-09-2026',
        chequeBank: 'Automation Test Bank',
        narration: `Automation Cheque Collection ${ts}`,
        invoicePaymentAmount: '1000',
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

    // Expense Reimbursement - approved/paid via a separate "Expense Report" listing (sibling
    // nav item under Accounting > Expense, not a submenu of this list). `employee`/`journal`/
    // `currency`/`expenseEntryType`/`item.category`/`item.taxTemplate` are best-effort seed names
    // (this suite's ExpenseReimbursementPage.js falls back to whatever real option already
    // exists via selectDropdown()'s search+fallback cascade if these don't match exactly - same
    // reasoning as every other module's own vendor/item/tax fields).
    expenseReimbursement: {
      employee:        'John Smith Doe',
      journal:         'Journal Voucher',
      currency:        'INR',
      exchangeRate:    '1',
      description:     `Automation Expense Reimbursement ${ts}`,
      expenseEntryType: 'Expense',
      item: {
        category:    'Client-related Expenses',
        taxTemplate: 'UAE VAT',
        amount:      '500',
        // Confirmed live: despite the "Reference Number" label, this field is a real
        // type="number" input - a free-text value like "ER-AUTOMATION-<ts>" throws
        // "Cannot type text into input[type=number]", and the raw 13-digit `ts` epoch alone
        // throws "Out of range value for column 'ref_number'" (an INT column server-side) -
        // truncated to 6 digits to stay safely within range while still varying per run.
        refNumber:   `${ts % 1000000}`,
      },
    },

    // Cash Expense - similar to purchaseInvoice above (same Vendor/Payment Terms/Currency/Item
    // Entries shape), except "Vendor Invoice No" is required here. Reuses purchaseInvoice's own
    // vendor/item best-effort seed names and fallback reasoning.
    cashExpense: {
      vendor:          'Royal Mine Industries',
      currency:        'US Dollars',
      paymentTerm:     'Net 30',
      // Confirmed live the Save toast blocks with "Please fill all the required fields" unless
      // both of these are set - same as Purchase Invoice's own required Shipping Address, plus
      // this module's own required "Account" field (unlike Sales Invoice's account_receivable_id,
      // which has zero real options in this environment, this one does).
      accountPayable:  'Accounts Payable',
      shippingAddress: 'Rajkot',
      valid: {
        vendorInvoiceNo: `CE-AUTOMATION-${ts}`,
      },
      item: {
        dropdownOption: 'ELEC-000071 - Playwright Auto Item',
        quantity:       '2',
        rate:           '500',
        taxTemplate:    'UAE VAT',
      },
    },

    // Asset Management - account fields (fixedAssetAccount/depreciationAccount/expenseAccount)
    // are deliberately unique-per-run (via `ts`) so this suite always exercises
    // AssetManagementPage's create-if-missing fallback (a throwaway-tab Chart of Accounts
    // create) rather than coincidentally matching a record from an earlier run.
    assetManagement: {
      assetType:           'Computer',
      location:            'Rajkot',
      department:          'Accounting',
      acquisitionDate:      '01-07-2026',
      assetValue:           '1000',
      notDepreciableValue:  '0',
      bookValue:            '1000',
      depreciationMethod:   'Straight line',
      // Best-effort guess - selectDropdown()'s search+fallback substitutes whatever real
      // Computation option exists in this environment if this exact text doesn't match.
      computation:          'Monthly',
      assetName:            `Automation Asset ${ts}`,
      seriesNumber:         `AST-AUTOMATION-${ts}`,
      fixedAssetAccount:    `Automation_FixedAsset_${ts}`,
      depreciationAccount:  `Automation_Depreciation_${ts}`,
      expenseAccount:       `Automation_Expense_${ts}`,
    },

    // Asset Transfer - the prerequisite Asset is created fresh each run (via AssetManagementPage,
    // same account-creation shape as `assetManagement` above) rather than reused from the shared
    // environment's existing assets: this environment has several duplicate-named assets (e.g.
    // 3x "Dell XPS 21") that selectDropdown()'s exact-match search can't reliably disambiguate by
    // name, so a uniquely-named prerequisite asset is the only way to deterministically know
    // which record's Location actually changed after the transfer.
    assetTransfer: {
      prereqAsset: {
        assetType:           'Computer',
        seriesNumber:        `AT-PREREQ-${ts}`,
        assetName:           `Automation Transfer Prereq Asset ${ts}`,
        location:            'Mumbai',
        department:          'Procurement',
        acquisitionDate:     '01-07-2026',
        assetValue:          '1000',
        notDepreciableValue: '0',
        bookValue:           '1000',
        depreciationMethod:  'Straight line',
        computation:         'Monthly',
        fixedAssetAccount:   `Automation_AT_FixedAsset_${ts}`,
        depreciationAccount: `Automation_AT_Depreciation_${ts}`,
        expenseAccount:      `Automation_AT_Expense_${ts}`,
      },
      transferName:          `Automation Asset Transfer ${ts}`,
      // Despite the "Reference Number" label this is a real type="number" input (same quirk
      // ExpenseReimbursementPage's own refNumber documents) - numeric-only, truncated to stay
      // within a plausible range while still varying per run.
      referenceNumber:       `${ts % 1000000}`,
      // Confirmed live: this environment's Location list has both "Mumbai" (used as the
      // prerequisite Asset's own source location above) and "Baroda" - a genuinely different,
      // real destination distinct from the source, not a best-effort guess.
      destinationLocation:  'Baroda',
      destinationDepartment: 'Finance',
    },

    // Commission Plan - master data (no approval workflow, plain Active/Inactive status). Create
    // was previously blocked by a confirmed live app bug (a dead duplicate form section polluting
    // Save's payload with a stray `company_id` field) - confirmed fixed (both duplicate sections
    // are gone from the Add form now), so this suite creates and uses its own disposable record
    // for the full CRUD lifecycle rather than mutating/reading a pre-existing shared one.
    commissionPlan: {
      valid: {
        title:            `Automation Commission Plan ${ts}`,
        type:              'Fixed Rate',
        commissionAmount:  '500',
        description:       `Automation-created commission plan ${ts}`,
        // Confirmed live: this environment's Location/Department lists are real but this exact
        // pair isn't pinned/verified against a specific option - selectLocation()/selectDepartment()
        // both fall back gracefully (optional: true) if these exact names don't match.
        location:          'Mumbai',
        department:        'Finance',
      },
      updatedDescription: `Updated by automation ${ts}`,
    },

    // Commission Target - master data (no approval workflow), same archetype as commissionPlan
    // above. This suite creates and uses its own disposable record for the full CRUD lifecycle.
    commissionTarget: {
      valid: {
        salesperson:  'Dipen Modi', // matches credentials.valid's own logged-in user
        type:         'Monthly',
        startDate:    '01-07-2026',
        // No endDate - confirmed live that field is disabled/auto-computed from startDate+type.
        targetAmount: '5000',
        // Confirmed live real options in this environment - selectLocation()/selectDepartment()
        // both fall back gracefully (optional: true) if these exact names don't match.
        location:     'Mumbai',
        department:   'Finance',
      },
      updatedTargetAmount: '7500',
    },

    // Commission Assignment - master data (no approval workflow), same archetype as
    // commissionPlan/commissionTarget above. This suite creates and uses its own disposable
    // record for the full CRUD lifecycle. The "Salesperson" line item references real, existing
    // Commission Plan/Commission Target records already in this environment (best-effort seed
    // names - selectDropdown()'s search+fallback substitutes a real option if these don't match
    // exactly) rather than ones this suite creates itself, since cross-referencing a specific
    // record by name is simpler than provisioning one - see CommissionAssignmentPage.js's own
    // header comment for why the line item is an inline table row, not a modal.
    commissionAssignment: {
      valid: {
        title:       `Automation Commission Assignment ${ts}`,
        description: `Automation-created commission assignment ${ts}`,
        lineItem: {
          salesperson:    'Dipen Modi', // matches credentials.valid's own logged-in user
          commissionPlan: 'Sales Commission Plan',
          target:         'CMT-2025-000039',
          // Day-of-month for the calendar-picker helper (see fillLineItemEndDate) - the masked
          // date input doesn't reliably accept typed/filled values, confirmed live. Start Date
          // auto-defaults to today and isn't user-settable (see class doc comment), so only End
          // Date needs a day picked here.
          endDateDay:     25,
        },
      },
      updatedDescription: `Updated by automation ${ts}`,
    },

    // Budget - document with an approval workflow (Draft-less: Save creates it directly in
    // "Pending" status, same status model as Asset Transfer). This suite creates and uses its own
    // disposable record for the CRUD lifecycle.
    budget: {
      valid: {
        budgetName:      `Automation Budget ${ts}`,
        budgetType:      'Company budget',
        // Best-effort seed - selectDropdown()'s search+fallback substitutes a real option if this
        // exact Financial Year name doesn't match (this environment's Financial Year list is
        // large and includes several near-duplicates like "2024-2025 (New)").
        financialYear:   '2024-2025 (New)',
        totalAmount:     '50000',
        budgetPeriod:    'Monthly',
        budgetMonths:    'January',
        // Top-level account category selected via the multi-step "Select Account" picker (see
        // BudgetPage.js's own class doc comment) - confirmed live real options are Assets/
        // Expense/Income/Liabilities/Equity.
        accountCategory: 'Assets',
      },
      updatedTotalAmount: '75000',
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
      // Recently added, required field on the Accounting tab (confirmed live - Save silently
      // stays on the add form with "This Field is required" under "Default tax template" if
      // omitted); 'UAE VAT' is the same confirmed-live Tax Template used elsewhere in this suite.
      defaultTaxTemplate: 'UAE VAT',
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
      defaultTaxTemplate: 'UAE VAT',
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
      defaultTaxTemplate: 'UAE VAT',
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
      defaultTaxTemplate: 'UAE VAT',
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
      // A name SEED, NOT a pinned real record. This field's dropdown only shows the 25 most-
      // recently-created Locations with no working search filter, so ANY pinned literal value
      // (this one used to be a real, reachable "Dhule" record) eventually gets evicted by newer
      // automation-created Locations account-wide (confirmed live: RFQ's own Shipping Address hit
      // the identical issue). ProcurementRequestPage.selectLocation() now always creates a brand
      // new Location from the field's own "+ Create New Location" footer action, scoped to
      // whichever Company is currently selected - this value is just the seed for that generated
      // name, so it never needs to match an existing record.
      location: "Automation_Request_Location",
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
      // A name seed, not a pinned real record - see procurementRequest.valid.location's own
      // comment for why (selectLocation() always creates a fresh Location now).
      location: "Automation_Request_Location_Reject",
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
      // A name seed, not a pinned real record - see PurchaseAgreementPage.selectLocation's own
      // comment for why (it always creates a fresh Location now).
      location: "Automation_Agreement_Location",
      itemName: "Regression_1-00006 - Reg_item1_rental", // corrected: old value did not exist
      narration: factory.narration("Automation purchase agreement"),
      updatedNarration: factory.narration(
        "Automation purchase agreement EDITED",
      ),
      entity: "erp-force", // verified - default/only entity option
      // A name seed, not a pinned real record - see PurchaseAgreementPage.selectLocation's own
      // comment for why (it always creates a fresh Location now).
      updatedLocation: "Automation_Agreement_Location_Updated",
      minOrderQty: "5",
      updatedMinOrderQty: "8",
      rate: "100",
    },
    reject: {
      name: factory.uniqueName("Automation_purchase_agreement_reject_flow"),
      agreementType: "Blanket",
      purchaseRepresentative: "Dipen  Modi",
      vendor: "Royal Mine Industries",
      // A name seed, not a pinned real record - see PurchaseAgreementPage.selectLocation's own
      // comment for why (it always creates a fresh Location now).
      location: "Automation_Agreement_Location_Reject",
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
      itemName: "Regression_1-00001 - Reg-item1",
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
      itemName: "Regression_1-00001 - Reg-item1",
      narration: factory.narration("Automation purchase order reject flow"),
      quantity: "3",
      rate: "50",
    },
    // Must be the CURRENTLY LOGGED-IN test user - see the identical comment on
    // procurementRequest.approverName/purchaseAgreement.approverName for why. Matches
    // credentials.valid = dipen.modi@trootech.com.
    approverName: "Dipen Modi",

    // Multi-item dataset (TC-PO-A01): two distinct real items so the Items grid, Summary
    // Total Quantity, and Grand Total can be asserted across more than one line. The second
    // item reuses the same live-verified master record family as `valid` to avoid pinning a
    // second literal that may rot out of the option window.
    multiItem: {
      items: [
        { itemName: "Regression_1-00001 - Reg-item1", quantity: "2", rate: "100" },
        { itemName: "Regression_1-00001 - Reg-item1", quantity: "3", rate: "50" },
      ],
    },

    // Expense dataset (TC-PO-A04): the Expense Detail modal's required fields. Account/Tax
    // Template/Location option text in this account is unverified, so the page object selects
    // the first available option for each rather than a guessed literal (see
    // PurchaseOrderPage.addExpense). Only `rate` is a free literal.
    expense: {
      rate: "75",
    },

    // Tax dataset (TC-PO-A02): a single item plus a Tax Template selected in the item modal.
    // Exact template text unverified -> page object picks the first option; the assertion is
    // that Taxes & Charges Added becomes non-zero, not a specific figure.
    tax: {
      itemName: "Regression_1-00001 - Reg-item1",
      quantity: "4",
      rate: "100",
    },

    // Discount dataset (TC-PO-A03): a single item plus a Discount Item selected in the item
    // modal (its discount_rate auto-fills). Same "first available option" strategy for the
    // discount record; assertion is that Item Discount becomes non-zero.
    discount: {
      itemName: "Regression_1-00001 - Reg-item1",
      quantity: "4",
      rate: "100",
    },
  },

  // Goods Receipt Note (GRN) - a child of an APPROVED Purchase Order, reached via the PO
  // View page's "Receive" split-button (source: purchase-orders/.../header-buttons.tsx). There
  // is NO standalone GRN list route, NO Draft/Submit, and NO approval workflow: the only form
  // buttons are Discard + Save, status is Pending -> Validated (boolean is_validated), and
  // Validate lives on the GRN View page and is blocked until every item has traceability
  // (source: view-goods-receipt-note.tsx). All header fields (Vendor/Currency/Company/Location/
  // items) auto-populate from the PO - only Reference No./Narration/received Quantity/Rate are
  // editable, and item rows cannot be manually added (grid is PO-derived).
  grn: {
    // The PO these GRN tests receive against is created fresh + approved in-suite (a GRN needs
    // an Approved PO with remaining quantity), so no pinned PO id lives here. Reuses the same
    // PO create dataset.
    referenceNumber: factory.referenceNumber("GRN-REF"),
    narration: factory.narration("Automation GRN"),
    updatedNarration: factory.narration("Automation GRN EDITED"),
    // received_quantity for the single-item happy path. Kept <= the PO line quantity (5 in
    // purchaseOrder.valid) so it never trips the "quantity exceeds remaining" guard.
    receivedQuantity: "2",
    // For the partial-receipt scenario (TC-GRN-E01): receive less than ordered, then assert the
    // PO/GRN remaining quantity reflects the shortfall.
    partialQuantity: "1",
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
      // NOT "test address, Maharashtra, India": confirmed live (TC-PREQ-26) that "PC vendor"'s
      // Vendor Address dropdown only has ONE real option, "test address, dhule, Maharashtra,
      // India" (note the "dhule, " in the middle) - the old value was missing that segment, so
      // it could never be found in the listbox.
      vendorAddress: "test address, dhule, Maharashtra, India",
      // A name SEED, not a pinned real value - RfqPage.selectLocation() always creates a brand
      // new Location via the field's own "+ Create New Location" footer action (same reasoning
      // as procurementRequest.valid.location's own comment), so this never needs to match an
      // existing record.
      location: "Automation_Rfq_Location",
    },
    cancel: {
      vendor: "PC vendor",
      purchaseRepresentative: "QA  Nikita",
      contactPerson: "manan",
      shippingAddress: "Dhule",
      location: "Automation_Rfq_Location_Cancel",
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
      // "Test Operations" no longer exists as a real Parent Department option in the live
      // environment (confirmed via selectFieldByLabel's live dropdown dump) - "Debug Department"
      // does and is stable/pinnable, same reasoning as this file's other pinned FK-reference
      // values.
      parentDepartment: "Debug Department",
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
      parentDepartment: "Debug Department",
      status: "Active",
    },
    inactive: {
      departmentCode: factory.uniqueName("DEPT_INACTIVE"),
      departmentName: factory.uniqueName("Inactive_Department"),
      parentDepartment: "Debug Department",
      status: "Inactive",
      description: "Inactive department for testing",
    },
    // Company is required (utils/validation.ts: yup.number().required() on company_id) - pass
    // `company: null` (not undefined) so DepartmentMasterPage.fillForm skips selecting a Company
    // instead of falling back to its 'erp-force' default.
    missingCompany: {
      company: null,
      departmentCode: factory.uniqueName("DEPT_NOCOMP"),
      departmentName: "No Company Department",
    },
    // saveAsDraft (postV1DepartmentsDraft) bypasses methods.trigger() validation entirely
    // (confirmed in add-department.hrms.tsx) - Department Code is deliberately omitted here to
    // exercise that bypass; Publishing this same draft later requires filling Code first.
    // Name deliberately avoids the substrings "Draft"/"Active"/"Inactive" - getRowStatus's
    // `getByText(/Draft|Active|Inactive/).first()` would otherwise match the Name cell (which
    // renders before the Status cell) instead of the actual status badge.
    draftMinimal: {
      departmentName: factory.uniqueName("Automation_Dept_ToPublish"),
    },
    // No max-length/regex/sanitization exists on Department Name beyond required + max(255)
    // (utils/validation.ts) - these confirm the app stores arbitrary text as-is and React escapes
    // it on render (no script execution, no raw HTML injection).
    xssName: `XSS_${factory.uniqueName("Dept")}_<script>alert(1)</script>`,
    sqlInjectionName: `SQLI_${factory.uniqueName("Dept")}_' OR 1=1 --`,
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

  // Salary Structure Master (erpforce-hrms-fe: src/views/salary-structure-master/) - route
  // `/dashboard/hrms/company-master-policy/salary-structure-master`. Single scrolling form (4
  // accordions: Basic Details / Components / Overtime / Classification), NOT a tab wizard like
  // Leave Policy. Draft vs Active/Inactive only - no approval workflow. Field labels below are the
  // exact rendered English strings confirmed from erpforce-be/translations/hrms.json, not guesses.
  salaryStructureMaster: {
    valid: {
      // FK-reference: same live-verified Company used by Leave Policy/Company Calendar in this
      // account. Selecting it also auto-fills the (disabled) Currency field via the company's
      // currency_data (confirmed in form.tsx getSelectedData) - so Currency has no pinned value.
      company: "erp-force",
      // Employment Type is a STATIC DynamicSelect - options are exactly "Unlimited" / "Limited"
      // (hardcoded in form.tsx), NOT free-form or master-data-backed. Not to be faker-generated.
      employmentType: "Unlimited",
      // Grade is a DynamicSearchSelect (apiType='grades'). This account's Grade master data has no
      // stable/pinnable option text confirmed live, so the page object picks the first available
      // option (selectFirstOptionByLabel) rather than asserting a literal here - same caution as
      // Leave Policy's Location. Leave this undefined on purpose.
      grade: undefined,
      // Department is a DynamicDependentField filtered by Company. "QA" is confirmed present under
      // erp-force (reused from leavePolicyMaster.valid.department).
      department: "QA",
      // Location is a DynamicDependentField filtered by Company; created on the fly via the
      // dropdown's own "Create New Location" footer (see BasePage.createLocationFromFooter),
      // since this account has no stable pinnable Location name.
      location: factory.uniqueName("Automation_Location"),
      structureName: factory.uniqueName("Automation_SalaryStructure"),
      updatedStructureName: factory.uniqueName("Automation_SalaryStructure_UPDATED"),
      minSalary: "10000",
      maxSalary: "50000",
    },
    // Free-text name variants for validation cases.
    draftMinimal: {
      structureName: factory.uniqueName("Automation_SalaryStructure_Draft"),
    },
    // TODO: identify a second real, distinct Company in the live/dev environment before enabling
    // the Company-switch dependency case (changing Company must clear Location/Department). Do NOT
    // default this to "erp-force".
    companyB: undefined,
    negative: {
      onlySpacesName: "   ",
      negativeSalary: "-100",
      // min > max pair - trips both min_less_than_max and max_greater_than_min yup tests.
      minGreaterThanMax: { minSalary: "50000", maxSalary: "1000" },
      nonNumericSalary: "abc",
    },
    // Exact rendered error strings (erpforce-be/translations/*.json), interpolated with the field
    // label. Used for explicit assertions instead of loose regex where the wording is confirmed.
    errors: {
      companyRequired: "Company is required",
      structureNameRequired: "Salary Structure Name is required",
      gradeRequired: "Grades is required",
      employmentTypeRequired: "Employment Type is required",
      maxSalaryRequired: "Maximum Salary is required",
      minPositive: "Minimum Salary must be a positive number",
      maxPositive: "Maximum Salary must be a positive number",
      minLessThanMax: "Minimum salary must be less than maximum salary",
      maxGreaterThanMin: "Maximum salary must be greater than minimum salary",
      overtimePercentageMax: "The percentage should not be more than 100",
    },
  },

  // Loan Configuration (erpforce-hrms-fe: src/views/loan-configuration/) - route
  // `/dashboard/hrms/loan-configuration`. Single scrolling form (5 accordions), NOT a tab wizard.
  // Draft vs Active/Inactive only - no approval workflow. Company is the same live-verified
  // "erp-force" value used by every other HRMS module in this suite. Category options are a
  // STATIC frontend enum (loanCategoryOptions in utils/default-data.tsx) - "Personal Loan"/"Home
  // Loan"/"Car Loan"/"Education Loan"/"Business Loan" - not master-data-backed, so these are safe
  // to hardcode, unlike Company/Location/Department.
  loanConfiguration: {
    valid: {
      company: "erp-force",
      category: "Personal Loan",
      loanName: factory.uniqueName("Automation_LoanConfig"),
      updatedLoanName: factory.uniqueName("Automation_LoanConfig_UPDATED"),
      maxLoanAmountValue: "50000",
      maxTenureMonths: "24",
      interestRate: "10",
      latePenaltyValue: "500",
    },
    negative: {
      negativeMaxLoanAmount: "-1000",
      negativeInterestRate: "-5",
      overMaxInterestRate: "100.01",
      negativeMinCtc: "-1",
      negativeMaxActiveLoans: "-2",
    },
  },

  lead: {
    valid: {
      companyName: `Automation_Lead_${ts}`,
      phone: `5${tsDigits}`,
      email: `automation.lead.${ts}@acmeglobal.com`,
      vatNumber: `1002345${tsDigits}`,
      crnNumber: `12${tsDigits}`,
      responsiblePerson: 'Ahmed Khan',
      leadStatus: 'Cold Call',
      priority: 'Medium',
      source: 'Test',
      industry: 'IT and Digital Services',
      followUpType: 'Call',
      remindMe: '1 Hour',
      location: 'Almeda',
      department: 'parth', // confirmed valid dept - see DEPARTMENT in tests/procurement/01-procurement-request-flow.spec.js
      address1: 'Office 12, Business Tower',
      address2: 'Sheikh Zayed Road',
      zipCode: '00000',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      updatedCompanyName: `Automation_Lead_UPDATED_${ts}`,
      updatedPhone: `4${tsDigits}`,
      updatedEmail: `automation.lead.updated.${ts}@acmeglobal.com`,
      duplicatedCompanyName: `Automation_Lead_COPY_${ts}`,
      updatedLeadStatus: 'Follow Up',
      updatedPriority: 'High',
      updatedAddress1: '456 Updated Avenue',
      updatedCity: 'Abu Dhabi',
      updatedZipCode: '500001',
    },

    // Minimal required-fields-only fixture (no Follow Up, no VAT/CRN, no Address 2)
    minimal: {
      companyName: `Automation_Lead_Minimal_${ts}`,
      phone: `6${tsDigits}`,
      email: `automation.lead.minimal.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
      leadStatus: 'Cold Call',
      priority: 'Medium',
      source: 'Test',
      industry: 'IT and Digital Services',
      location: 'Almeda',
      department: 'parth', // confirmed valid dept - see DEPARTMENT in tests/procurement/01-procurement-request-flow.spec.js
      address1: 'Office 12, Business Tower',
      zipCode: '00000',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
    },

    // Negative fixtures - each overrides only the field under test on top of
    // otherwise-valid data (including responsiblePerson, itself required),
    // so the invalid value under test is isolated as the only failing field.
    missingCompanyName: {
      companyName: '',
      phone: '501234567',
      email: `automation.lead.negative.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
    },
    invalidEmail: {
      companyName: `Automation_Lead_InvalidEmail_${ts}`,
      phone: '501234567',
      email: 'not-an-email',
      responsiblePerson: 'Ahmed Khan',
    },
    // The Phone input strips non-numeric characters as they're typed, so
    // letters resolve to an empty value and surface the same required-field
    // error as leaving it blank - there's no separate "invalid format" state.
    invalidPhone: {
      companyName: `Automation_Lead_InvalidPhone_${ts}`,
      phone: 'abcd',
      email: `automation.lead.invalidphone.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
    },
    invalidVat: {
      companyName: `Automation_Lead_InvalidVat_${ts}`,
      phone: `7${tsDigits}`,
      email: `automation.lead.invalidvat.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
      // Deliberately short (not 15 digits) but still unique per run - a static
      // literal here previously got flagged "already exists" from a prior run
      // before the length validation could even fire.
      vatNumber: tsDigits.slice(0, 3),
    },
  },

  // stockTransfer.destinationLocation references the same name that location
  // tests create/rename to in TC-LOC-02 (see 02-location.spec.js). Stock
  // Transfer records have no user-entered name field (they're identified by
  // an auto-generated numeric ID), so this location name is what the spec
  // uses to find "its" row in the list instead of a name fixture.
  stockTransfer: {
    valid: {
      operationType: 'Receipt',
      destinationLocation: `Test_Location_Playwright_UPDATED_${ts}`,
      requestQuantity: '10',
      rate: '100',
      transferQuantity: '10',
    },
  },

  // Manufacturing module - tests/manufacturing/ was empty before this suite; Demand Planning is
  // the first screen automated here. It's a read-only reporting view (filter -> shortfall list),
  // not a CRUD screen, so its fixtures look different from every other module's: most values here
  // feed a live-verified UI flow (Inventory Item + Reordering Rule creation), and one field
  // (apiBaseUrl) exists only because Demand Planning's precondition data has NO complete UI path -
  // see tests/manufacturing/01-demand-planning.spec.js's header comment for the full reasoning.
  manufacturing: {
    // The backend host the frontend itself calls directly for every API request (confirmed live
    // via network capture - distinct from `baseUrl` above, the frontend's own origin). Needed
    // because there is no UI path that reliably creates stock from zero: Inventory Adjustment's
    // "Available Quantity" field is read-only (confirmed live - it corrects Reserve/Back Order
    // against EXISTING stock, not new stock), and there's no dedicated Reordering Rules endpoint
    // either (nested inside the Inventory Item payload only) - so the one gap (raw stock creation)
    // is seeded directly against this API, authenticated with the running session's own token (see
    // helpers/apiSeed.js). Override via MANUFACTURING_API_BASE_URL if this ever targets a
    // non-local environment where the API isn't at this fixed local port.
    apiBaseUrl: process.env.MANUFACTURING_API_BASE_URL || 'http://127.0.0.1:4011',

    demandPlanning: {
      // Add Inventory Item wizard fixtures below are live-verified against THIS environment's
      // actual dropdown option lists, confirmed via a dropdown-options dump - 07-inventory-item
      // .spec.ts's CATEGORY='Electronics'/DEPARTMENT='Test Operations' do NOT exist here and would
      // hang that spec's selectFromDropdown() on an empty filtered list forever. Category/UOM/
      // Costing Method/Department are free choices among many real options; Location is NOT -
      // see below.
      category: 'Laptop',
      uom: 'Unit',
      costingMethod: 'FIFO',
      department: 'Procurement',
      salesPrice: '750',
      leadTime: '7',
      weight: '3.5',
      hsnCode: 'HSN998877',
      averageCost: '350',

      // Location MUST be a location this repo already treats as pinned/stable elsewhere (see the
      // `location.duplicate.location_id: 'Mumbai'` comment earlier in this file) - Demand
      // Planning's reorder-point join silently drops any item whose stock row's location_id
      // doesn't exactly match its reordering_rules.location_id
      // (`LEFT JOIN reordering_rules rr ON wl.id = rr.location_id AND rr.item_id = sd.item_id`,
      // then `if (item.reorder_point === null) return;`) - confirmed live: this is the single
      // most likely cause of "why is my new item not showing up" if a future edit changes one
      // occurrence of this name but not the other. TC-DP-02 deliberately uses a SECOND, different
      // real location to prove this join behavior rather than just asserting it from the backend
      // summary's prose.
      location: 'Mumbai',
      mismatchLocation: 'Baroda', // also confirmed live in this environment's Location dropdown

      minimumQuantity: 50,
      maximumQuantity: 200,
      availableQuantity: 10, // below minimumQuantity - required_quantity should resolve to 40

      // Demand Planning's own "Type" filter - other confirmed live option is 'Production'.
      type: 'Procurement',

      // TC-DP-03's netting case reaches the Add Request page via Demand Planning's own Detail
      // view (openDetailView -> selectDetailRow -> createPurchaseRequestFromSelection), which
      // pre-fills Entity/Currency/Item/Quantity/Rate directly from the selected row - only
      // Location is left to fill, so this is the one remaining fixture value needed. 'Mumbai' is
      // a live-confirmed real, EXISTING option in Procurement Request's own Location dropdown in
      // THIS environment, directly selectable with no search typed at all (confirmed live) - the
      // spec selects it directly rather than via ProcurementRequestPage.selectLocation(), which
      // always creates a brand-new location instead of reusing one that already exists.
      pr: {
        location: 'Mumbai',
      },

      // TC-DP-06 (Type='Production', "Show Below Reorder Point" unchecked) needs an item with
      // real Production-type demand (demand_quantity sourced from something other than a
      // Reordering Rule shortfall) - there is no confirmed UI or API path to generate that
      // ourselves yet (Manufacturing's Work Order screen reached by DIRECT navigation is an empty
      // stub, confirmed live - it only does anything when reached via Demand Planning's own
      // Detail view, see TC-DP-06), so this reuses an existing, live-verified shared item instead
      // of creating one, the same way FK-reference values elsewhere in this file do.
      production: {
        itemName: 'New Product1', // item_id 123, confirmed live in the Production+unchecked list
      },
    },

    // Bill of Material (dashboard/manufacturing/bill-of-material) - unlike Work Order/BOM reached
    // by direct navigation elsewhere (empty stubs, see demandPlanning.production's comment above),
    // THIS route is a real, fully-built document module (Add/View/Edit/Delete/Duplicate,
    // Draft/Pending/Approved statuses) - confirmed live. Item/UOM/Material-row-Item fixtures are
    // deliberately left to "first available option" (see pages/BillOfMaterialPage.js) rather than
    // pinned literals - this environment's Item list is dominated by short-lived automation
    // records from other suites (Demand Planning's own Automation_DemandPlanning_* items), so any
    // literal name pinned here would need constant re-verification as those churn.
    billOfMaterial: {
      location: 'Mumbai',
      quantity: 10,
      materialQuantity: 1,
    },

    // Work Order (dashboard/manufacturing/orders/work-order) - real document module, requires an
    // Approved Bill of Material for whichever Item is selected (pages/WorkOrderPage.js's own
    // ensureBomForItem() creates one on the fly when missing, matching this repo's established
    // self-healing-dependency pattern - see 03-bin.spec.js for the precedent). Location has no
    // visible required-field asterisk but IS required (confirmed live - saving without it surfaces
    // "Loacation is required", a real app typo).
    //
    // releaseMaterial pins "RM1" as the Materials row for any auto-created BOM (see
    // ensureBomForItem) - Release checks whether that material actually has Available stock, and
    // RM1's stock is often fully reserved/committed by other automation runs. Seeding stock
    // directly via the backend API (POST inventory/v1/stock, apiSeed.js's seedStock - the same
    // helper Demand Planning's own suite uses for ITS zero-stock gap) does NOT satisfy this check
    // (confirmed live: it writes a real stock row but Release still blocks with the same 400).
    // Only a real Stock Transfer "Receipt" taken all the way through its own Track Detail
    // (Lot/Serial Number traceability) step and Validate actually clears it - see
    // 03-work-order.spec.js's TC-WO-04 for that flow, built on pages/StockTransferPage.js.
    // updatedQuantity is what TC-WO-03's Edit test changes Quantity to - a distinct fixture value
    // instead of deriving it via arithmetic on `quantity` (e.g. "+5"), so it stays a single source
    // of truth: TC-WO-06's own Build Order has to fully account for whatever the Work Order's
    // ACTUAL quantity is at that point (which is this value, since TC-WO-03 already changed it),
    // or the Work Order only partially builds and stays "In progress" instead of "Completed"
    // (confirmed live).
    workOrder: {
      location: 'Mumbai',
      quantity: 5,
      updatedQuantity: 10,
      releaseMaterial: {
        itemName: 'RM1',
        availableQuantity: 500,
      },
    },

    // Unbuild Order (dashboard/manufacturing/orders/unbuild-order) - only reachable via a
    // COMPLETED Build Order's own "Unbuild" action (see pages/UnbuildOrderPage.js's own header
    // comment for the two confirmed bugs blocking direct creation and the initial Add form's own
    // Save button). quantityToUnbuild matches workOrder.quantity above since this suite creates
    // its own dedicated Work Order -> Build Order chain at that same quantity.
    unbuildOrder: {
      quantityToUnbuild: 5,
    },
  },
};

// The "full access" RBAC role reuses the one admin login this suite already has - it's a real,
// working account, just not one with restricted permissions.
testData.accounting.rbacRoles.fullAccess = testData.credentials.valid;

module.exports = testData;
