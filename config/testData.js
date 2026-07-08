const ts = Date.now();

const testData = {
  baseUrl: 'https://dev.erpforce.co',

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
};

module.exports = testData;
