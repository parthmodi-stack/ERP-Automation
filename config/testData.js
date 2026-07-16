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

module.exports = testData;
