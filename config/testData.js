const ts = Date.now();

const testData = {
  baseUrl: "https://dev.erpforce.co",

  credentials: {
    valid: {
      email: "parth.modi+450@trootech.com",
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
    wrongPassword: {
      email: "parth.modi+450@trootech.com",
      password: "WrongPass@999",
    },
    emptyEmail: {
      email: "",
      password: "Admin@123",
    },
    emptyPassword: {
      email: "parth.modi+450@trootech.com",
      password: "",
    },
  },

  uom: {
    valid: {
      unitName: `Automation_UOM_${ts}`,
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
      name: `Test_Attribute_${ts}`,
      fieldType: "Select",
      values: ["Value 1", "Value 2"],
      duplicatedName: `Test_Attribute_COPY_${ts}`,
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
      name: `Automation_Category_${ts}`,
      description: "Automated test category for electronics",
      skuPrefix: "AUTO",
      startingSku: "1",
      skuPreview: "AUTO-00001",
      attribute: "Iphone Variant",
      updatedName: `Automation_Category_UPDATED_${ts}`,
      duplicatedName: `Automation_Category_COPY_${ts}`,
    },
  },

  discountedItem: {
    valid: {
      skuNumber: `DISC-AUTO-${ts}`,
      name: `Automation_Discount_${ts}`,
      discountType: "Sales",
      account: "Sales Revenue",
      discountCategory: "Rate",
      discountRate: "10",
      description: "Automated test discount created by Playwright",
    },
  },

  // bin.location references the same name that location tests create in TC-LOC-02
  bin: {
    valid: {
      name: `Test_Bin_${ts}`,
      location: `Test_Location_Playwright_UPDATED_${ts}`,
      binType: "Internal Location",
      entity: "erp-force",
      updatedName: `Test_Bin_UPDATED_${ts}`,
      duplicatedName: `Test_Bin_COPY_${ts}`,
    },
  },

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
      itemName: "Regression_1-00006 - Reg_item1_rental", // corrected: old value did not exist
      narration: `Automation procurement request ${ts}`,
      updatedNarration: `Automation procurement request EDITED ${ts}`,
      // Currency defaults to INR on the Add form, but - like Location - does NOT round-trip
      // onto the Edit form (confirmed live: blank "Search Currency" immediately after
      // navigating to Edit, before any other field is touched). Any Edit+Save flow must
      // re-select it explicitly or Save silently fails required-field validation.
      currency: "INR",
      quantity: "5",
      updatedQuantity: "8",
      rate: "100",
    },
    reject: {
      purchaseRepresentative: "Vivek  Kansara",
      vendor: "venugopal  ", // trailing double space is part of the real name
      // NOT "Junagadh WC-1": confirmed live via network inspection that the Location field's
      // own API call (`inventory/v1/warehouse-location/?...&order=id:-1&limit=25`) always
      // returns only the 25 most-recently-created records with NO working name/search filter
      // (typing into its search input fires zero new requests) - any location outside that
      // ever-shifting recent window can never be selected through the UI. Reuse the same
      // pinned value already proven reachable elsewhere in this suite instead of a value that
      // depends on how much other Location-suite junk data has piled up since.
      location: "Dhule",
      itemName: "Regression_1-00006 - Reg_item1_rental", // corrected: old value did not exist
      narration: `Automation procurement request reject flow ${ts}`,
      currency: "INR",
      quantity: "3",
      rate: "50",
    },
    // Must be the CURRENTLY LOGGED-IN test user (credentials.valid = parth.modi+450@trootech.com,
    // displayed in the app header as "Parth regression"), not an arbitrary employee - the
    // Accept/Reject split-button on a record's View page only renders for whoever the pending
    // approval was actually sent to. Sending it to a different employee (this was "Dipen Modi"
    // before) leaves the logged-in session with only a lone "Cancel" button and no way to accept
    // (confirmed live via repeated polling - no split-button ever appears in that case, at any
    // point after Quick Approval). Matches the option "Pr Parth regression" in the same picker.
    approverName: "Parth regression",
  },

  purchaseAgreement: {
    valid: {
      name: `Automation purchase agreement ${ts}`,
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
      narration: `Automation purchase agreement ${ts}`,
      updatedNarration: `Automation purchase agreement EDITED ${ts}`,
      entity: "erp-force", // verified - default/only entity option
      updatedLocation: "Dhule", // verified - exists exactly as written
      minOrderQty: "5",
      updatedMinOrderQty: "8",
      rate: "100",
    },
    reject: {
      name: `Automation purchase agreement reject flow ${ts}`,
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
      narration: `Automation purchase agreement reject flow ${ts}`,
      // NOT "INR": confirmed live via screenshot that vendor "Royal Mine Industries"' own linked
      // currency list doesn't contain a plain "INR" entry (only "INR-RAJ1", a different exact
      // string, alongside Morocco/Irani Rial/Paraguayan guarani/etc.) - Currency's options are
      // scoped to whatever's linked to the selected vendor, so use one that's actually there.
      currency: "INR-RAJ1",
      minOrderQty: "3",
      rate: "50",
    },
    // Must be the CURRENTLY LOGGED-IN test user (credentials.valid = parth.modi+450@trootech.com,
    // displayed in the app header as "Parth regression"), not an arbitrary employee - the
    // Accept/Reject split-button on a record's View page only renders for whoever the pending
    // approval was actually sent to. Sending it to a different employee (this was "Dipen Modi"
    // before) leaves the logged-in session with only a lone "Cancel" button and no way to accept
    // (confirmed live via repeated polling - no split-button ever appears in that case, at any
    // point after Quick Approval). Matches the option "Pr Parth regression" in the same picker.
    approverName: "Parth regression",
  },

  rfq: {
    valid: {
      vendor: "PC new Vendor",
      purchaseRepresentative: "QA  Nikita",
      itemName: "Regression_1-00006 - Reg_item1_rental",
      narration: `Automation RFQ ${ts}`,
      updatedNarration: `Automation RFQ EDITED ${ts}`,
      requestedQuantity: "5",
      updatedRequestedQuantity: "8",
    },
    cancel: {
      vendor: "PC new Vendor",
      purchaseRepresentative: "QA  Nikita",
      itemName: "Regression_1-00006 - Reg_item1_rental",
      narration: `Automation RFQ cancel flow ${ts}`,
      requestedQuantity: "3",
    },
  },
};

module.exports = testData;
