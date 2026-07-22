require('dotenv').config({ quiet: true });

const ts = Date.now();
// Fixed-length numeric suffix (last 8 digits of ts) for fields like Phone/VAT/CRN
// that must stay a realistic length/format but still be unique per run - the app
// rejects a repeated Phone/VAT/CRN as "already exists" against a prior run's data.
const tsDigits = String(ts).slice(-8);

const testData = {
  // See .env.sample - copy it to .env to point the suite at a different environment.
  baseUrl: process.env.BASE_URL || 'https://dev.erpforce.co',

  credentials: {
    valid: {
      email:    'parth.modi+450@trootech.com',
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

  lead: {
    valid: {
      companyName:       `Automation_Lead_${ts}`,
      phone:              `5${tsDigits}`,
      email:              `automation.lead.${ts}@acmeglobal.com`,
      vatNumber:          `1002345${tsDigits}`,
      crnNumber:          `12${tsDigits}`,
      responsiblePerson: 'Ahmed Khan',
      leadStatus:         'Cold Call',
      priority:           'Medium',
      source:             'Test',
      industry:           'IT and Digital Services',
      followUpType:       'Call',
      remindMe:           '1 Hour',
      location:           'Almeda',
      department:         'parth', // confirmed valid dept - see DEPARTMENT in tests/procurement/01-procurement-request-flow.spec.js
      address1:           'Office 12, Business Tower',
      address2:           'Sheikh Zayed Road',
      zipCode:            '00000',
      country:            'United Arab Emirates',
      state:              'Dubai',
      city:               'Dubai',
      updatedCompanyName:    `Automation_Lead_UPDATED_${ts}`,
      updatedPhone:           `4${tsDigits}`,
      updatedEmail:           `automation.lead.updated.${ts}@acmeglobal.com`,
      duplicatedCompanyName: `Automation_Lead_COPY_${ts}`,
      updatedLeadStatus:      'Follow Up',
      updatedPriority:        'High',
      updatedAddress1:        '456 Updated Avenue',
      updatedCity:            'Abu Dhabi',
      updatedZipCode:         '500001',
    },

    // Minimal required-fields-only fixture (no Follow Up, no VAT/CRN, no Address 2)
    minimal: {
      companyName:       `Automation_Lead_Minimal_${ts}`,
      phone:              `6${tsDigits}`,
      email:              `automation.lead.minimal.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
      leadStatus:         'Cold Call',
      priority:           'Medium',
      source:             'Test',
      industry:           'IT and Digital Services',
      location:           'Almeda',
      department:         'parth', // confirmed valid dept - see DEPARTMENT in tests/procurement/01-procurement-request-flow.spec.js
      address1:           'Office 12, Business Tower',
      zipCode:            '00000',
      country:            'United Arab Emirates',
      state:              'Dubai',
      city:               'Dubai',
    },

    // Negative fixtures - each overrides only the field under test on top of
    // otherwise-valid data (including responsiblePerson, itself required),
    // so the invalid value under test is isolated as the only failing field.
    missingCompanyName: {
      companyName:        '',
      phone:               '501234567',
      email:               `automation.lead.negative.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
    },
    invalidEmail: {
      companyName:        `Automation_Lead_InvalidEmail_${ts}`,
      phone:               '501234567',
      email:               'not-an-email',
      responsiblePerson: 'Ahmed Khan',
    },
    // The Phone input strips non-numeric characters as they're typed, so
    // letters resolve to an empty value and surface the same required-field
    // error as leaving it blank - there's no separate "invalid format" state.
    invalidPhone: {
      companyName:        `Automation_Lead_InvalidPhone_${ts}`,
      phone:               'abcd',
      email:               `automation.lead.invalidphone.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
    },
    invalidVat: {
      companyName:        `Automation_Lead_InvalidVat_${ts}`,
      phone:               `7${tsDigits}`,
      email:               `automation.lead.invalidvat.${ts}@acmeglobal.com`,
      responsiblePerson: 'Ahmed Khan',
      // Deliberately short (not 15 digits) but still unique per run - a static
      // literal here previously got flagged "already exists" from a prior run
      // before the length validation could even fire.
      vatNumber:           tsDigits.slice(0, 3),
    },
  },

  // stockTransfer.destinationLocation references the same name that location
  // tests create/rename to in TC-LOC-02 (see 02-location.spec.js). Stock
  // Transfer records have no user-entered name field (they're identified by
  // an auto-generated numeric ID), so this location name is what the spec
  // uses to find "its" row in the list instead of a name fixture.
  stockTransfer: {
    valid: {
      operationType:      'Receipt',
      destinationLocation: `Test_Location_Playwright_UPDATED_${ts}`,
      requestQuantity:    '10',
      rate:               '100',
      transferQuantity:   '10',
    },
  },
};

module.exports = testData;
