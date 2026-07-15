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
};

module.exports = testData;
