Test: TC-RFQ-09 [+] Auto-filled fields on Edit match the View page

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> TC-RFQ-09 [+] Auto-filled fields on Edit match the View page
- Location: tests/procurement/03-rfq.spec.js:144:3

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e4]:
    - banner [ref=e5]:
        - generic [ref=e7]:
            - button "Switch module" [ref=e8] [cursor=pointer]:
                - img [ref=e9]
            - button "Go back" [ref=e20] [cursor=pointer]:
                - img [ref=e21]
            - navigation [ref=e23]:
                - button "Procurement" [ref=e24] [cursor=pointer]:
                    - generic [ref=e26]: Procurement
                - img [ref=e27]
                - img [ref=e29]
                - button "Request For Quote" [ref=e31] [cursor=pointer]
                - img [ref=e32]
            - button "notifications" [ref=e36] [cursor=pointer]:
                - generic [ref=e37]:
                    - img [ref=e38]
                    - generic: "0"
            - button "D Dipen Modi Admin" [ref=e42] [cursor=pointer]:
                - generic [ref=e44]: D
                - generic [ref=e45]:
                    - generic [ref=e46]: Dipen Modi
                    - generic [ref=e47]: Admin
    - generic [ref=e50]:
        - img "favicon" [ref=e53] [cursor=pointer]
        - button [ref=e55] [cursor=pointer]:
            - img [ref=e56]
        - list [ref=e60]:
            - listitem "Dashboard" [ref=e61]:
                - button [ref=e62] [cursor=pointer]:
                    - img [ref=e64]
            - listitem "Requests" [ref=e68]:
                - button [ref=e69] [cursor=pointer]:
                    - img [ref=e71]
            - listitem "Purchase Agreements" [ref=e79]:
                - button [ref=e80] [cursor=pointer]:
                    - img [ref=e82]
            - listitem "Orders" [ref=e90]:
                - button [ref=e91] [cursor=pointer]:
                    - img [ref=e93]
            - listitem "Reports" [ref=e99]:
                - button [ref=e100] [cursor=pointer]:
                    - img [ref=e102]
            - listitem "Settings" [ref=e105]:
                - button [ref=e106] [cursor=pointer]:
                    - img [ref=e108]
    - button [ref=e113] [cursor=pointer]:
        - img [ref=e114]
    - main [ref=e116]:
        - generic [ref=e117]:
            - generic [ref=e118]:
                - navigation [ref=e119]:
                    - list [ref=e120]:
                        - listitem [ref=e121]:
                            - link "Request for Quote" [ref=e123] [cursor=pointer]:
                                - /url: /dashboard/procurement/orders/request-for-quote
                        - listitem [ref=e124]: /
                        - listitem [ref=e125]:
                            - paragraph [ref=e127]:
                                - generic [ref=e128]: Edit Request for Quote
                - generic [ref=e130]:
                    - button "Next" [ref=e131] [cursor=pointer]: Next
                    - button "Save To Draft" [ref=e132] [cursor=pointer]: Save To Draft
                    - button "Discard" [ref=e133] [cursor=pointer]: Discard
                    - button "Save" [ref=e134] [cursor=pointer]: Save
            - generic [ref=e137]:
                - generic [ref=e140]:
                    - tablist [ref=e143]:
                        - tab "Basic Details" [selected] [ref=e144] [cursor=pointer]:
                            - paragraph [ref=e145]: Basic Details
                        - tab "Address & Contact" [ref=e146] [cursor=pointer]:
                            - paragraph [ref=e147]: Address & Contact
                    - tabpanel "Basic Details" [ref=e149]:
                        - generic [ref=e150]:
                            - generic [ref=e151]:
                                - paragraph [ref=e152]: ID
                                - generic [ref=e154]:
                                    - textbox "ID" [disabled] [ref=e155]: RFQ-2026-000251
                                    - group
                            - generic [ref=e156]:
                                - paragraph [ref=e157]: Date *
                                - generic [ref=e159]:
                                    - textbox "Select Date" [ref=e160]: 17-07-2026
                                    - button "Choose date, selected date is Jul 17, 2026" [ref=e162] [cursor=pointer]:
                                        - img [ref=e163]
                                    - group
                            - generic [ref=e174]:
                                - paragraph [ref=e175]: Vendor *
                                - generic [ref=e176]:
                                    - combobox "Loading..." [ref=e177] [cursor=pointer]:
                                        - paragraph [ref=e178]: Loading...
                                    - textbox
                                    - img
                                    - progressbar [ref=e180]:
                                        - img [ref=e181]
                                    - group
                            - generic [ref=e183]:
                                - paragraph [ref=e184]: Entity *
                                - generic [ref=e185]:
                                    - combobox "Loading..." [ref=e186] [cursor=pointer]:
                                        - paragraph [ref=e187]: Loading...
                                    - textbox
                                    - img
                                    - progressbar [ref=e189]:
                                        - img [ref=e190]
                                    - group
                            - generic [ref=e192]:
                                - paragraph [ref=e193]: Location
                                - generic [ref=e194]:
                                    - combobox "Search Location" [ref=e195] [cursor=pointer]
                                    - textbox
                                    - img
                                    - group
                            - generic [ref=e196]:
                                - paragraph [ref=e197]: Order Deadline
                                - generic [ref=e199]:
                                    - textbox "Select Date" [ref=e200]: DD-MM-YYYY
                                    - button "Choose date" [ref=e202] [cursor=pointer]:
                                        - img [ref=e203]
                                    - group
                            - generic [ref=e214]:
                                - paragraph [ref=e215]: Expected Required Date
                                - generic [ref=e217]:
                                    - textbox "Select Date" [ref=e218]
                                    - button "Choose date" [ref=e220] [cursor=pointer]:
                                        - img [ref=e221]
                                    - group
                            - generic [ref=e232]:
                                - paragraph [ref=e233]: Currency *
                                - generic [ref=e234]:
                                    - combobox "Loading..." [ref=e235] [cursor=pointer]:
                                        - paragraph [ref=e236]: Loading...
                                    - textbox
                                    - img
                                    - progressbar [ref=e238]:
                                        - img [ref=e239]
                                    - group
                            - generic [ref=e241]:
                                - paragraph [ref=e242]: Exchange Rate *
                                - generic [ref=e244]:
                                    - spinbutton [ref=e245]: "0.2"
                                    - group
                            - generic [ref=e246]:
                                - paragraph [ref=e247]: Purchase Representative
                                - generic [ref=e248]:
                                    - combobox "Loading..." [ref=e249] [cursor=pointer]:
                                        - paragraph [ref=e250]: Loading...
                                    - textbox
                                    - img
                                    - progressbar [ref=e252]:
                                        - img [ref=e253]
                                    - group
                            - generic [ref=e255]:
                                - paragraph [ref=e256]: Payment Terms
                                - generic [ref=e257]:
                                    - combobox "Search Payment Terms" [ref=e258] [cursor=pointer]
                                    - textbox
                                    - img
                                    - group
                            - generic [ref=e259]:
                                - paragraph [ref=e260]: Reference No.
                                - generic [ref=e262]:
                                    - textbox "Enter Reference No." [ref=e263]
                                    - group
                            - generic [ref=e264]:
                                - paragraph [ref=e265]: Terms & Condition
                                - generic [ref=e266]:
                                    - combobox "Search Terms & Condition" [ref=e267] [cursor=pointer]
                                    - textbox
                                    - img
                                    - group
                            - generic [ref=e269]:
                                - paragraph [ref=e270]: Narration
                                - generic [ref=e272]:
                                    - textbox "Enter Narration" [ref=e273]: TC-RFQ-09 full-field auto-fill check
                                    - group
                        - separator [ref=e274]
                        - generic [ref=e275]:
                            - button "Items*" [expanded] [ref=e276] [cursor=pointer]:
                                - paragraph [ref=e278]: Items*
                                - img [ref=e280]
                            - region "Items*" [ref=e285]:
                                - generic [ref=e287]:
                                    - table [ref=e292]:
                                        - rowgroup [ref=e293]:
                                            - row "Arrow Icon Awarded Item Sort by Item ascending Vendor Item Name Sort by Vendor Item Name ascending Purchase Order Sort by Purchase Order descending UoM Sort by UoM ascending Description Sort by Description ascending Specification Sort by Specification descending Requested Quantity Sort by Requested Quantity descending Estimated Order Quantity Per Year Sort by Estimated Order Quantity Per Year descending Location Sort by Location descending Department Sort by Department descending Narration Sort by Narration descending" [ref=e294]:
                                                - columnheader "Arrow Icon" [ref=e295]:
                                                    - generic [ref=e296]:
                                                        - button "Arrow Icon" [ref=e299] [cursor=pointer]:
                                                            - img "Arrow Icon" [ref=e300]
                                                        - separator [ref=e302]
                                                - columnheader "Awarded" [ref=e303]:
                                                    - generic [ref=e304]:
                                                        - generic [ref=e307]: Awarded
                                                        - separator [ref=e309]
                                                - columnheader "Item Sort by Item ascending" [ref=e310]:
                                                    - generic [ref=e311]:
                                                        - generic [ref=e312] [cursor=pointer]:
                                                            - generic [ref=e314]: Item
                                                            - generic "Sort by Item ascending" [ref=e315]:
                                                                - button "Sort by Item ascending" [ref=e316]:
                                                                    - img [ref=e317]
                                                                - generic: "0"
                                                        - separator [ref=e321]
                                                - columnheader "Vendor Item Name Sort by Vendor Item Name ascending" [ref=e322]:
                                                    - generic [ref=e323]:
                                                        - generic [ref=e324] [cursor=pointer]:
                                                            - generic [ref=e326]: Vendor Item Name
                                                            - generic "Sort by Vendor Item Name ascending" [ref=e327]:
                                                                - button "Sort by Vendor Item Name ascending" [ref=e328]:
                                                                    - img [ref=e329]
                                                                - generic: "0"
                                                        - separator [ref=e333]
                                                - columnheader "Purchase Order Sort by Purchase Order descending" [ref=e334]:
                                                    - generic [ref=e335]:
                                                        - generic [ref=e336] [cursor=pointer]:
                                                            - generic [ref=e338]: Purchase Order
                                                            - generic "Sort by Purchase Order descending" [ref=e339]:
                                                                - button "Sort by Purchase Order descending" [ref=e340]:
                                                                    - img [ref=e341]
                                                                - generic: "0"
                                                        - separator [ref=e345]
                                                - columnheader "UoM Sort by UoM ascending" [ref=e346]:
                                                    - generic [ref=e347]:
                                                        - generic [ref=e348] [cursor=pointer]:
                                                            - generic [ref=e350]: UoM
                                                            - generic "Sort by UoM ascending" [ref=e351]:
                                                                - button "Sort by UoM ascending" [ref=e352]:
                                                                    - img [ref=e353]
                                                                - generic: "0"
                                                        - separator [ref=e357]
                                                - columnheader "Description Sort by Description ascending" [ref=e358]:
                                                    - generic [ref=e359]:
                                                        - generic [ref=e360] [cursor=pointer]:
                                                            - generic [ref=e362]: Description
                                                            - generic "Sort by Description ascending" [ref=e363]:
                                                                - button "Sort by Description ascending" [ref=e364]:
                                                                    - img [ref=e365]
                                                                - generic: "0"
                                                        - separator [ref=e369]
                                                - columnheader "Specification Sort by Specification descending" [ref=e370]:
                                                    - generic [ref=e371]:
                                                        - generic [ref=e372] [cursor=pointer]:
                                                            - generic [ref=e374]: Specification
                                                            - generic "Sort by Specification descending" [ref=e375]:
                                                                - button "Sort by Specification descending" [ref=e376]:
                                                                    - img [ref=e377]
                                                                - generic: "0"
                                                        - separator [ref=e381]
                                                - columnheader "Requested Quantity Sort by Requested Quantity descending" [ref=e382]:
                                                    - generic [ref=e383]:
                                                        - generic [ref=e384] [cursor=pointer]:
                                                            - generic [ref=e386]: Requested Quantity
                                                            - generic "Sort by Requested Quantity descending" [ref=e387]:
                                                                - button "Sort by Requested Quantity descending" [ref=e388]:
                                                                    - img [ref=e389]
                                                                - generic: "0"
                                                        - separator [ref=e393]
                                                - columnheader "Estimated Order Quantity Per Year Sort by Estimated Order Quantity Per Year descending" [ref=e394]:
                                                    - generic [ref=e395]:
                                                        - generic [ref=e396] [cursor=pointer]:
                                                            - generic [ref=e398]: Estimated Order Quantity Per Year
                                                            - generic "Sort by Estimated Order Quantity Per Year descending" [ref=e399]:
                                                                - button "Sort by Estimated Order Quantity Per Year descending" [ref=e400]:
                                                                    - img [ref=e401]
                                                                - generic: "0"
                                                        - separator [ref=e405]
                                                - columnheader "Location Sort by Location descending" [ref=e406]:
                                                    - generic [ref=e407]:
                                                        - generic [ref=e408] [cursor=pointer]:
                                                            - generic [ref=e410]: Location
                                                            - generic "Sort by Location descending" [ref=e411]:
                                                                - button "Sort by Location descending" [ref=e412]:
                                                                    - img [ref=e413]
                                                                - generic: "0"
                                                        - separator [ref=e417]
                                                - columnheader "Department Sort by Department descending" [ref=e418]:
                                                    - generic [ref=e419]:
                                                        - generic [ref=e420] [cursor=pointer]:
                                                            - generic [ref=e422]: Department
                                                            - generic "Sort by Department descending" [ref=e423]:
                                                                - button "Sort by Department descending" [ref=e424]:
                                                                    - img [ref=e425]
                                                                - generic: "0"
                                                        - separator [ref=e429]
                                                - columnheader "Narration Sort by Narration descending" [ref=e430]:
                                                    - generic [ref=e431]:
                                                        - generic [ref=e432] [cursor=pointer]:
                                                            - generic [ref=e434]: Narration
                                                            - generic "Sort by Narration descending" [ref=e435]:
                                                                - button "Sort by Narration descending" [ref=e436]:
                                                                    - img [ref=e437]
                                                                - generic: "0"
                                                        - separator [ref=e441]
                                        - rowgroup [ref=e442]:
                                            - row "Reg_item1_rental Reg_item1_rental pics 4" [ref=e443] [cursor=pointer]:
                                                - cell [ref=e444]:
                                                    - button [ref=e445]:
                                                        - img [ref=e446]
                                                    - button [ref=e449]:
                                                        - img [ref=e450]
                                                - cell [ref=e454]
                                                - cell "Reg_item1_rental" [ref=e455]
                                                - cell "Reg_item1_rental" [ref=e456]:
                                                    - paragraph [ref=e457]: Reg_item1_rental
                                                - cell [ref=e458]
                                                - cell "pics" [ref=e459]
                                                - cell [ref=e460]
                                                - cell [ref=e461]
                                                - cell "4" [ref=e462]
                                                - cell [ref=e463]
                                                - cell [ref=e464]
                                                - cell [ref=e465]
                                                - cell [ref=e466]
                                        - rowgroup
                                    - button "Add" [ref=e468] [cursor=pointer]:
                                        - img [ref=e470]
                                        - text: Add
                        - generic [ref=e472]:
                            - button "Call For Tender" [expanded] [ref=e473] [cursor=pointer]:
                                - paragraph [ref=e475]: Call For Tender
                                - img [ref=e477]
                            - region "Items*" [ref=e482]:
                                - generic [ref=e484]:
                                    - table [ref=e489]:
                                        - rowgroup [ref=e490]:
                                            - row "Arrow Icon Vendor Item Name Sort by Vendor Item Name descending RFQ ID Sort by RFQ ID descending Expected Required Date Sort by Expected Required Date descending Status Sort by Status descending" [ref=e491]:
                                                - columnheader "Arrow Icon" [ref=e492]:
                                                    - generic [ref=e493]:
                                                        - button "Arrow Icon" [ref=e496] [cursor=pointer]:
                                                            - img "Arrow Icon" [ref=e497]
                                                        - separator [ref=e499]
                                                - columnheader "Vendor Item Name Sort by Vendor Item Name descending" [ref=e500]:
                                                    - generic [ref=e501]:
                                                        - generic [ref=e502] [cursor=pointer]:
                                                            - generic [ref=e504]: Vendor Item Name
                                                            - generic "Sort by Vendor Item Name descending" [ref=e505]:
                                                                - button "Sort by Vendor Item Name descending" [ref=e506]:
                                                                    - img [ref=e507]
                                                                - generic: "0"
                                                        - separator [ref=e511]
                                                - columnheader "RFQ ID Sort by RFQ ID descending" [ref=e512]:
                                                    - generic [ref=e513]:
                                                        - generic [ref=e514] [cursor=pointer]:
                                                            - generic [ref=e516]: RFQ ID
                                                            - generic "Sort by RFQ ID descending" [ref=e517]:
                                                                - button "Sort by RFQ ID descending" [ref=e518]:
                                                                    - img [ref=e519]
                                                                - generic: "0"
                                                        - separator [ref=e523]
                                                - columnheader "Expected Required Date Sort by Expected Required Date descending" [ref=e524]:
                                                    - generic [ref=e525]:
                                                        - generic [ref=e526] [cursor=pointer]:
                                                            - generic [ref=e528]: Expected Required Date
                                                            - generic "Sort by Expected Required Date descending" [ref=e529]:
                                                                - button "Sort by Expected Required Date descending" [ref=e530]:
                                                                    - img [ref=e531]
                                                                - generic: "0"
                                                        - separator [ref=e535]
                                                - columnheader "Status Sort by Status descending" [ref=e536]:
                                                    - generic [ref=e537]:
                                                        - generic [ref=e538] [cursor=pointer]:
                                                            - generic [ref=e540]: Status
                                                            - generic "Sort by Status descending" [ref=e541]:
                                                                - button "Sort by Status descending" [ref=e542]:
                                                                    - img [ref=e543]
                                                                - generic: "0"
                                                        - separator [ref=e547]
                                        - rowgroup [ref=e548]:
                                            - row "No Data" [ref=e549]:
                                                - cell "No Data" [ref=e550]:
                                                    - generic [ref=e551]:
                                                        - img [ref=e552]
                                                        - paragraph [ref=e553]: No Data
                                        - rowgroup
                                    - button "Add" [ref=e555] [cursor=pointer]:
                                        - img [ref=e557]
                                        - text: Add
                        - separator [ref=e559]
                        - generic [ref=e560]:
                            - button "Attachment" [expanded] [ref=e561] [cursor=pointer]:
                                - paragraph [ref=e563]: Attachment
                                - img [ref=e565]
                            - region "Items*" [ref=e570]:
                                - generic [ref=e573]:
                                    - paragraph [ref=e574]: Attach your file here
                                    - button "Upload" [ref=e576] [cursor=pointer]:
                                        - img [ref=e578]
                                        - paragraph [ref=e579]: Upload
                                        - button "Upload" [ref=e580]
                - generic [ref=e583]:
                    - button "Close summary" [ref=e584] [cursor=pointer]:
                        - img [ref=e585]
                    - generic [ref=e591]:
                        - separator [ref=e592]
                        - generic [ref=e593]:
                            - tablist [ref=e596]:
                                - tab "Summary" [selected] [ref=e597] [cursor=pointer]:
                                    - paragraph [ref=e598]: Summary
                            - tabpanel "Summary" [ref=e600]:
                                - generic [ref=e602]:
                                    - generic [ref=e603]:
                                        - paragraph [ref=e604]: ID
                                        - paragraph [ref=e605]: RFQ-2026-000251
                                    - generic [ref=e606]:
                                        - paragraph [ref=e607]: Date
                                        - paragraph [ref=e608]: 17-07-2026
                                    - generic [ref=e609]:
                                        - paragraph [ref=e610]: Vendor
                                        - paragraph
                                    - generic [ref=e611]:
                                        - paragraph [ref=e612]: Entity
                                        - paragraph [ref=e613]: "-"
                                    - generic [ref=e614]:
                                        - paragraph [ref=e615]: Location
                                        - paragraph [ref=e616]: "-"
                                    - generic [ref=e617]:
                                        - paragraph [ref=e618]: Expected Required Date
                                        - paragraph [ref=e619]: "-"
                                    - generic [ref=e620]:
                                        - paragraph [ref=e621]: Order Deadline
                                        - paragraph [ref=e622]: "-"
                                    - generic [ref=e623]:
                                        - paragraph [ref=e624]: Currency
                                        - paragraph [ref=e625]: "-"
                                    - generic [ref=e626]:
                                        - paragraph [ref=e627]: Exchange Rate
                                        - paragraph [ref=e628]: AED 0.20
                                    - generic [ref=e629]:
                                        - paragraph [ref=e630]: Purchase Representative
                                        - paragraph
                                    - generic [ref=e631]:
                                        - paragraph [ref=e632]: Payment Terms
                                        - paragraph [ref=e633]: "-"
                                    - generic [ref=e634]:
                                        - paragraph [ref=e635]: Reference No.
                                        - paragraph [ref=e636]: "-"
                                    - generic [ref=e637]:
                                        - paragraph [ref=e638]: Narration
                                        - paragraph [ref=e639]: TC-RFQ-09 full-field auto-fill check
```

Test: TC-RFQ-10 [+] ID field remains read-only in Edit mode

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> TC-RFQ-10 [+] ID field remains read-only in Edit mode
- Location: tests/procurement/03-rfq.spec.js:177:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'id')
```

# Test source

```ts
  79  |     await rfq.gotoEdit(createdRfq.id);
  80  |     await rfq.setDateToToday();
  81  |     // Re-select vendor to ensure dependent fields are populated for save.
  82  |     await rfq.fillBasicDetails({ vendor: data.vendor });
  83  |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  84  |     await rfq.save();
  85  |
  86  |     await rfq.gotoView(createdRfq.id);
  87  |     await expect(page.getByText('Open', { exact: true })).toBeVisible();
  88  |   });
  89  |
  90  |   // ── TC-RFQ-05: Cancel an Open RFQ ──────────────────────────────────────────
  91  |   test('TC-RFQ-05 [+] Cancel an Open RFQ changes status to Cancelled', async ({ page }) => {
  92  |     const rfq = new RfqPage(page);
  93  |
  94  |     await rfq.gotoView(createdRfq.id);
  95  |     await rfq.cancelFromView();
  96  |
  97  |     // After cancellation, status should be Cancelled.
  98  |     await rfq.gotoView(createdRfq.id);
  99  |     await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  100 |   });
  101 |
  102 |   // ── TC-RFQ-06: Create button visibility on Open status ─────────────────────
  103 |   test('TC-RFQ-06 [+] Create button appears once the RFQ is Open', async ({ page }) => {
  104 |     const rfq  = new RfqPage(page);
  105 |     const data = testData.rfq.valid;
  106 |
  107 |     // Create a new RFQ and move it to Open.
  108 |     await rfq.gotoAdd();
  109 |     await rfq.fillBasicDetails({
  110 |       vendor:                 data.vendor,
  111 |       purchaseRepresentative: data.purchaseRepresentative,
  112 |       narration:              'TC-RFQ-06 create-button visibility check',
  113 |     });
  114 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  115 |     await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });
  116 |
  117 |     approvedRfq = await rfq.save(); // plain save on new record → Open
  118 |     expect(approvedRfq.id).toBeTruthy();
  119 |
  120 |     await rfq.gotoView(approvedRfq.id);
  121 |     await expect(page.getByText('Open', { exact: true })).toBeVisible();
  122 |
  123 |     // The Create dropdown button should be visible for Open status.
  124 |     await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  125 |   });
  126 |
  127 |   // ── TC-RFQ-07: Create > Order navigation ───────────────────────────────────
  128 |   test('TC-RFQ-07 [+] Create > Order navigates to the Add Purchase Order page', async ({ page }) => {
  129 |     const rfq = new RfqPage(page);
  130 |     await rfq.gotoView(approvedRfq.id);
  131 |     await rfq.createOrder();
  132 |     await expect(page).toHaveURL(/\/procurement\/purchase-order\/add-purchase-order/);
  133 |   });
  134 |
  135 |   // ── TC-RFQ-08: Create > Response navigation ────────────────────────────────
  136 |   test('TC-RFQ-08 [+] Create > Response navigates to the Add Response page', async ({ page }) => {
  137 |     const rfq = new RfqPage(page);
  138 |     await rfq.gotoView(approvedRfq.id);
  139 |     await rfq.createResponse();
  140 |     await expect(page).toHaveURL(/\/request-for-quote\/add-response/);
  141 |   });
  142 |
  143 |   // ── TC-RFQ-09: Auto-filled fields on Edit match View ───────────────────────
  144 |   test('TC-RFQ-09 [+] Auto-filled fields on Edit match the View page', async ({ page }) => {
  145 |     const rfq  = new RfqPage(page);
  146 |     const data = testData.rfq.valid;
  147 |
  148 |     await rfq.gotoAdd();
  149 |     await rfq.fillBasicDetails({
  150 |       vendor:                 data.vendor,
  151 |       purchaseRepresentative: data.purchaseRepresentative,
  152 |       narration:              'TC-RFQ-09 full-field auto-fill check',
  153 |     });
  154 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  155 |     await rfq.addItem({ itemName: data.itemName, requestedQuantity: '4' });
  156 |
  157 |     editRfq = await rfq.saveAsDraft();
  158 |     expect(editRfq.id).toBeTruthy();
  159 |
  160 |     // Record every value shown on the View page before opening Edit.
  161 |     await rfq.gotoView(editRfq.id);
  162 |     viewValues.vendor   = await rfq.getFieldValueOnView('Vendor');
  163 |     viewValues.currency = await rfq.getFieldValueOnView('Currency');
  164 |     viewValues.narration = await rfq.getFieldValueOnView('Narration');
  165 |
  166 |     await rfq.gotoEdit(editRfq.id);
  167 |
  168 |     // Check that Vendor combobox is pre-populated.
  169 |     expect(await rfq.getEditComboboxValue('Vendor *')).toBe(viewValues.vendor);
  170 |     expect(await rfq.getEditNarrationValue()).toBe(viewValues.narration);
  171 |
  172 |     // Item row should be visible.
  173 |     await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
  174 |   });
  175 |
  176 |   // ── TC-RFQ-10: ID field is read-only in Edit mode ──────────────────────────
  177 |   test('TC-RFQ-10 [+] ID field remains read-only in Edit mode', async ({ page }) => {
  178 |     const rfq = new RfqPage(page);
> 179 |     await rfq.gotoEdit(editRfq.id);
      |                                ^ TypeError: Cannot read properties of undefined (reading 'id')
  180 |     expect(await rfq.isIdFieldReadOnly()).toBe(true);
  181 |   });
  182 |
  183 |   // ── TC-RFQ-11: Editing one field updates only that field ───────────────────
  184 |   test('TC-RFQ-11 [+] Editing Narration and saving updates only that field', async ({ page }) => {
  185 |     const rfq  = new RfqPage(page);
  186 |     const data = testData.rfq.valid;
  187 |
  188 |     await rfq.gotoEdit(editRfq.id);
  189 |     await rfq.setDateToToday();
  190 |     // Re-select vendor to ensure dependent fields are populated for save.
  191 |     await rfq.fillBasicDetails({
  192 |       vendor:    data.vendor,
  193 |       narration: 'TC-RFQ-11 - ONLY narration changed',
  194 |     });
  195 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  196 |     await rfq.saveAsDraft();
  197 |
  198 |     await rfq.gotoView(editRfq.id);
  199 |     // Changed field should be updated.
  200 |     expect(await rfq.getFieldValueOnView('Narration')).toBe('TC-RFQ-11 - ONLY narration changed');
  201 |     // Unchanged fields retain their original values.
  202 |     expect(await rfq.getFieldValueOnView('Vendor')).toBe(viewValues.vendor);
  203 |   });
  204 |
  205 |   // ── Shared helper for the delete-flow test cases below ─────────────────────
  206 |   // Returns { id, seriesNumber }, same shape as saveAsDraft()/save().
  207 |   async function createDraftRfq(rfq, narration) {
  208 |     const data = testData.rfq.valid;
  209 |     return rfq.createDraft({ ...data, narration, requestedQuantity: '1' });
  210 |   }
  211 |
  212 |   // ── TC-RFQ-12: Delete a Draft RFQ ──────────────────────────────────────────
  213 |   test('TC-RFQ-12 [+] Delete a Draft RFQ', async ({ page }) => {
  214 |     const rfq     = new RfqPage(page);
  215 |     const created = await createDraftRfq(rfq, 'TC-RFQ-12 delete draft');
  216 |
  217 |     await rfq.gotoList();
  218 |     await rfq.deleteFromList(created.seriesNumber);
  219 |     await expect(rfq.rowBySeriesNumber(created.seriesNumber)).toHaveCount(0);
  220 |
  221 |     // Record cannot be opened again.
  222 |     await rfq.gotoView(created.id);
  223 |     await expect(page.getByText(`ID: ${created.seriesNumber}`)).not.toBeVisible({ timeout: 5000 }).catch(() => {
  224 |       // View page may redirect or show undefined - either confirms deletion worked.
  225 |     });
  226 |   });
  227 |
  228 |   // ── TC-RFQ-13: Related master data survives delete ─────────────────────────
  229 |   test('TC-RFQ-13 [+] Item master data remains intact after deleting a Draft RFQ', async ({ page }) => {
  230 |     const rfq     = new RfqPage(page);
  231 |     const data    = testData.rfq.valid;
  232 |     const created = await createDraftRfq(rfq, 'TC-RFQ-13 related data check');
  233 |
  234 |     await rfq.gotoList();
  235 |     await rfq.deleteFromList(created.seriesNumber);
  236 |
  237 |     // Create a new RFQ and verify the item is still available.
  238 |     await rfq.gotoAdd();
  239 |     await rfq.fillBasicDetails({ vendor: data.vendor });
  240 |     await page.getByRole('button', { name: 'Add', exact: true }).click();
  241 |     const modal = page.getByRole('dialog');
  242 |     await modal.getByRole('combobox', { name: /Item/i }).click();
  243 |     await expect(page.getByText(data.itemName, { exact: true }).first()).toBeVisible();
  244 |   });
  245 |
  246 |   // ── Create Response from RFQ (TC-RFQ-15 - TC-RFQ-16) ───────────────────────
  247 |   // WRITTEN FROM erpforce-fe/erpforce-be SOURCE, NOT YET LIVE-VERIFIED end-to-end - same
  248 |   // "unverified live" caveat this repo already carries for VendorReturnAuthorizationPage. Uses
  249 |   // its own dedicated source RFQ (not the shared `approvedRfq`) so creating a Response here -
  250 |   // which flips the source RFQ's own status - can't disturb the Listing Page block below, which
  251 |   // still depends on `approvedRfq` staying "Open".
  252 |   test.describe('Create Response from RFQ', () => {
  253 |     test('TC-RFQ-15 [+] Create a Response from an Open RFQ moves it to Response Received', async ({
  254 |       page,
  255 |     }) => {
  256 |       const rfq = new RfqPage(page);
  257 |       const data = testData.rfq.valid;
  258 |       const narration = 'TC-RFQ-15 create response from rfq';
  259 |
  260 |       await rfq.gotoAdd();
  261 |       await rfq.fillBasicDetails({
  262 |         vendor: data.vendor,
  263 |         purchaseRepresentative: data.purchaseRepresentative,
  264 |         narration,
  265 |       });
  266 |       await rfq.fillAddressContact({
  267 |         contactPerson: data.contactPerson,
  268 |         shippingAddress: data.shippingAddress,
  269 |         vendorAddress: data.vendorAddress,
  270 |       });
  271 |       await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });
  272 |
  273 |       const sourceRfq = await rfq.save(); // plain save on a new record -> Open
  274 |       expect(sourceRfq.id).toBeTruthy();
  275 |
  276 |       await rfq.gotoView(sourceRfq.id);
  277 |       await expect(page.getByText('Open', { exact: true })).toBeVisible();
  278 |
  279 |       await rfq.createResponse();
```

Test: TC-RFQ-11 [+] Editing Narration and saving updates only that field

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> TC-RFQ-11 [+] Editing Narration and saving updates only that field
- Location: tests/procurement/03-rfq.spec.js:184:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'id')
```

# Test source

```ts
  88  |   });
  89  |
  90  |   // ── TC-RFQ-05: Cancel an Open RFQ ──────────────────────────────────────────
  91  |   test('TC-RFQ-05 [+] Cancel an Open RFQ changes status to Cancelled', async ({ page }) => {
  92  |     const rfq = new RfqPage(page);
  93  |
  94  |     await rfq.gotoView(createdRfq.id);
  95  |     await rfq.cancelFromView();
  96  |
  97  |     // After cancellation, status should be Cancelled.
  98  |     await rfq.gotoView(createdRfq.id);
  99  |     await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  100 |   });
  101 |
  102 |   // ── TC-RFQ-06: Create button visibility on Open status ─────────────────────
  103 |   test('TC-RFQ-06 [+] Create button appears once the RFQ is Open', async ({ page }) => {
  104 |     const rfq  = new RfqPage(page);
  105 |     const data = testData.rfq.valid;
  106 |
  107 |     // Create a new RFQ and move it to Open.
  108 |     await rfq.gotoAdd();
  109 |     await rfq.fillBasicDetails({
  110 |       vendor:                 data.vendor,
  111 |       purchaseRepresentative: data.purchaseRepresentative,
  112 |       narration:              'TC-RFQ-06 create-button visibility check',
  113 |     });
  114 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  115 |     await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });
  116 |
  117 |     approvedRfq = await rfq.save(); // plain save on new record → Open
  118 |     expect(approvedRfq.id).toBeTruthy();
  119 |
  120 |     await rfq.gotoView(approvedRfq.id);
  121 |     await expect(page.getByText('Open', { exact: true })).toBeVisible();
  122 |
  123 |     // The Create dropdown button should be visible for Open status.
  124 |     await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  125 |   });
  126 |
  127 |   // ── TC-RFQ-07: Create > Order navigation ───────────────────────────────────
  128 |   test('TC-RFQ-07 [+] Create > Order navigates to the Add Purchase Order page', async ({ page }) => {
  129 |     const rfq = new RfqPage(page);
  130 |     await rfq.gotoView(approvedRfq.id);
  131 |     await rfq.createOrder();
  132 |     await expect(page).toHaveURL(/\/procurement\/purchase-order\/add-purchase-order/);
  133 |   });
  134 |
  135 |   // ── TC-RFQ-08: Create > Response navigation ────────────────────────────────
  136 |   test('TC-RFQ-08 [+] Create > Response navigates to the Add Response page', async ({ page }) => {
  137 |     const rfq = new RfqPage(page);
  138 |     await rfq.gotoView(approvedRfq.id);
  139 |     await rfq.createResponse();
  140 |     await expect(page).toHaveURL(/\/request-for-quote\/add-response/);
  141 |   });
  142 |
  143 |   // ── TC-RFQ-09: Auto-filled fields on Edit match View ───────────────────────
  144 |   test('TC-RFQ-09 [+] Auto-filled fields on Edit match the View page', async ({ page }) => {
  145 |     const rfq  = new RfqPage(page);
  146 |     const data = testData.rfq.valid;
  147 |
  148 |     await rfq.gotoAdd();
  149 |     await rfq.fillBasicDetails({
  150 |       vendor:                 data.vendor,
  151 |       purchaseRepresentative: data.purchaseRepresentative,
  152 |       narration:              'TC-RFQ-09 full-field auto-fill check',
  153 |     });
  154 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  155 |     await rfq.addItem({ itemName: data.itemName, requestedQuantity: '4' });
  156 |
  157 |     editRfq = await rfq.saveAsDraft();
  158 |     expect(editRfq.id).toBeTruthy();
  159 |
  160 |     // Record every value shown on the View page before opening Edit.
  161 |     await rfq.gotoView(editRfq.id);
  162 |     viewValues.vendor   = await rfq.getFieldValueOnView('Vendor');
  163 |     viewValues.currency = await rfq.getFieldValueOnView('Currency');
  164 |     viewValues.narration = await rfq.getFieldValueOnView('Narration');
  165 |
  166 |     await rfq.gotoEdit(editRfq.id);
  167 |
  168 |     // Check that Vendor combobox is pre-populated.
  169 |     expect(await rfq.getEditComboboxValue('Vendor *')).toBe(viewValues.vendor);
  170 |     expect(await rfq.getEditNarrationValue()).toBe(viewValues.narration);
  171 |
  172 |     // Item row should be visible.
  173 |     await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
  174 |   });
  175 |
  176 |   // ── TC-RFQ-10: ID field is read-only in Edit mode ──────────────────────────
  177 |   test('TC-RFQ-10 [+] ID field remains read-only in Edit mode', async ({ page }) => {
  178 |     const rfq = new RfqPage(page);
  179 |     await rfq.gotoEdit(editRfq.id);
  180 |     expect(await rfq.isIdFieldReadOnly()).toBe(true);
  181 |   });
  182 |
  183 |   // ── TC-RFQ-11: Editing one field updates only that field ───────────────────
  184 |   test('TC-RFQ-11 [+] Editing Narration and saving updates only that field', async ({ page }) => {
  185 |     const rfq  = new RfqPage(page);
  186 |     const data = testData.rfq.valid;
  187 |
> 188 |     await rfq.gotoEdit(editRfq.id);
      |                                ^ TypeError: Cannot read properties of undefined (reading 'id')
  189 |     await rfq.setDateToToday();
  190 |     // Re-select vendor to ensure dependent fields are populated for save.
  191 |     await rfq.fillBasicDetails({
  192 |       vendor:    data.vendor,
  193 |       narration: 'TC-RFQ-11 - ONLY narration changed',
  194 |     });
  195 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  196 |     await rfq.saveAsDraft();
  197 |
  198 |     await rfq.gotoView(editRfq.id);
  199 |     // Changed field should be updated.
  200 |     expect(await rfq.getFieldValueOnView('Narration')).toBe('TC-RFQ-11 - ONLY narration changed');
  201 |     // Unchanged fields retain their original values.
  202 |     expect(await rfq.getFieldValueOnView('Vendor')).toBe(viewValues.vendor);
  203 |   });
  204 |
  205 |   // ── Shared helper for the delete-flow test cases below ─────────────────────
  206 |   // Returns { id, seriesNumber }, same shape as saveAsDraft()/save().
  207 |   async function createDraftRfq(rfq, narration) {
  208 |     const data = testData.rfq.valid;
  209 |     return rfq.createDraft({ ...data, narration, requestedQuantity: '1' });
  210 |   }
  211 |
  212 |   // ── TC-RFQ-12: Delete a Draft RFQ ──────────────────────────────────────────
  213 |   test('TC-RFQ-12 [+] Delete a Draft RFQ', async ({ page }) => {
  214 |     const rfq     = new RfqPage(page);
  215 |     const created = await createDraftRfq(rfq, 'TC-RFQ-12 delete draft');
  216 |
  217 |     await rfq.gotoList();
  218 |     await rfq.deleteFromList(created.seriesNumber);
  219 |     await expect(rfq.rowBySeriesNumber(created.seriesNumber)).toHaveCount(0);
  220 |
  221 |     // Record cannot be opened again.
  222 |     await rfq.gotoView(created.id);
  223 |     await expect(page.getByText(`ID: ${created.seriesNumber}`)).not.toBeVisible({ timeout: 5000 }).catch(() => {
  224 |       // View page may redirect or show undefined - either confirms deletion worked.
  225 |     });
  226 |   });
  227 |
  228 |   // ── TC-RFQ-13: Related master data survives delete ─────────────────────────
  229 |   test('TC-RFQ-13 [+] Item master data remains intact after deleting a Draft RFQ', async ({ page }) => {
  230 |     const rfq     = new RfqPage(page);
  231 |     const data    = testData.rfq.valid;
  232 |     const created = await createDraftRfq(rfq, 'TC-RFQ-13 related data check');
  233 |
  234 |     await rfq.gotoList();
  235 |     await rfq.deleteFromList(created.seriesNumber);
  236 |
  237 |     // Create a new RFQ and verify the item is still available.
  238 |     await rfq.gotoAdd();
  239 |     await rfq.fillBasicDetails({ vendor: data.vendor });
  240 |     await page.getByRole('button', { name: 'Add', exact: true }).click();
  241 |     const modal = page.getByRole('dialog');
  242 |     await modal.getByRole('combobox', { name: /Item/i }).click();
  243 |     await expect(page.getByText(data.itemName, { exact: true }).first()).toBeVisible();
  244 |   });
  245 |
  246 |   // ── Create Response from RFQ (TC-RFQ-15 - TC-RFQ-16) ───────────────────────
  247 |   // WRITTEN FROM erpforce-fe/erpforce-be SOURCE, NOT YET LIVE-VERIFIED end-to-end - same
  248 |   // "unverified live" caveat this repo already carries for VendorReturnAuthorizationPage. Uses
  249 |   // its own dedicated source RFQ (not the shared `approvedRfq`) so creating a Response here -
  250 |   // which flips the source RFQ's own status - can't disturb the Listing Page block below, which
  251 |   // still depends on `approvedRfq` staying "Open".
  252 |   test.describe('Create Response from RFQ', () => {
  253 |     test('TC-RFQ-15 [+] Create a Response from an Open RFQ moves it to Response Received', async ({
  254 |       page,
  255 |     }) => {
  256 |       const rfq = new RfqPage(page);
  257 |       const data = testData.rfq.valid;
  258 |       const narration = 'TC-RFQ-15 create response from rfq';
  259 |
  260 |       await rfq.gotoAdd();
  261 |       await rfq.fillBasicDetails({
  262 |         vendor: data.vendor,
  263 |         purchaseRepresentative: data.purchaseRepresentative,
  264 |         narration,
  265 |       });
  266 |       await rfq.fillAddressContact({
  267 |         contactPerson: data.contactPerson,
  268 |         shippingAddress: data.shippingAddress,
  269 |         vendorAddress: data.vendorAddress,
  270 |       });
  271 |       await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });
  272 |
  273 |       const sourceRfq = await rfq.save(); // plain save on a new record -> Open
  274 |       expect(sourceRfq.id).toBeTruthy();
  275 |
  276 |       await rfq.gotoView(sourceRfq.id);
  277 |       await expect(page.getByText('Open', { exact: true })).toBeVisible();
  278 |
  279 |       await rfq.createResponse();
  280 |       await rfq.waitForResponseFormReady();
  281 |
  282 |       // The pre-fill lands after a real network round-trip (fetchRequestForQuoteId behind the
  283 |       // scenes) - wait for it to actually land rather than a fixed delay.
  284 |       await expect(page.getByPlaceholder('Enter Narration')).toHaveValue(narration, {
  285 |         timeout: 15000,
  286 |       });
  287 |
  288 |       // Date carries over the source RFQ's own (now-past) date and must be reset, or Save fails
```

Test: TC-RFQ-12 [+] Delete a Draft RFQ

- # Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> TC-RFQ-12 [+] Delete a Draft RFQ
- Location: tests/procurement/03-rfq.spec.js:213:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByText('Location', { exact: true }).first().locator('xpath=following::*[@role="combobox"][1]')
    - locator resolved to <div tabindex="0" role="combobox" aria-expanded="true" aria-controls=":r12:" aria-haspopup="listbox" id="mui-component-select-rfq.location_id" aria-labelledby="mui-component-select-rfq.location_id" class="MuiSelect-select MuiSelect-outlined MuiInputBase-input MuiOutlinedInput-input MuiInputBase-inputSizeSmall MuiInputBase-inputAdornedEnd mui-51drbn-MuiSelect-select-MuiInputBase-input-MuiOutlinedInput-input">Search Location</div>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <input value="" id=":r28:" type="text" aria-invalid="false" placeholder="Search Location" class="MuiInputBase-input MuiOutlinedInput-input MuiInputBase-inputAdornedStart mui-9vvs02-MuiInputBase-input-MuiOutlinedInput-input"/> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    7 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <input value="" id=":r28:" type="text" aria-invalid="false" placeholder="Search Location" class="MuiInputBase-input MuiOutlinedInput-input MuiInputBase-inputAdornedStart mui-9vvs02-MuiInputBase-input-MuiOutlinedInput-input"/> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - generic [ref=e4]:
        - banner [ref=e5]:
            - generic [ref=e7]:
                - button [ref=e8] [cursor=pointer]:
                    - img [ref=e9]
                - button [ref=e20] [cursor=pointer]:
                    - img [ref=e21]
                - navigation [ref=e23]:
                    - button [ref=e24] [cursor=pointer]:
                        - generic [ref=e26]: Procurement
                    - img [ref=e27]
                    - img [ref=e29]
                    - button [ref=e31] [cursor=pointer]: Request For Quote
                    - img [ref=e32]
                - button [ref=e36] [cursor=pointer]:
                    - img [ref=e38]
                - button [ref=e42] [cursor=pointer]:
                    - generic [ref=e44]: D
                    - generic [ref=e45]:
                        - generic [ref=e46]: Dipen Modi
                        - generic [ref=e47]: Admin
        - generic [ref=e50]:
            - img [ref=e53] [cursor=pointer]
            - button [ref=e55] [cursor=pointer]:
                - img [ref=e56]
            - list [ref=e60]:
                - listitem [ref=e61]:
                    - button [ref=e62] [cursor=pointer]:
                        - img [ref=e64]
                - listitem [ref=e68]:
                    - button [ref=e69] [cursor=pointer]:
                        - img [ref=e71]
                - listitem [ref=e79]:
                    - button [ref=e80] [cursor=pointer]:
                        - img [ref=e82]
                - listitem [ref=e90]:
                    - button [ref=e91] [cursor=pointer]:
                        - img [ref=e93]
                - listitem [ref=e99]:
                    - button [ref=e100] [cursor=pointer]:
                        - img [ref=e102]
                - listitem [ref=e105]:
                    - button [ref=e106] [cursor=pointer]:
                        - img [ref=e108]
        - button [ref=e113] [cursor=pointer]:
            - img [ref=e114]
        - main [ref=e116]:
            - generic [ref=e117]:
                - generic [ref=e118]:
                    - navigation [ref=e119]:
                        - list [ref=e120]:
                            - listitem [ref=e121]:
                                - link [ref=e123] [cursor=pointer]:
                                    - /url: /dashboard/procurement/orders/request-for-quote
                                    - text: Request for Quote
                            - listitem [ref=e124]: /
                            - listitem [ref=e125]:
                                - paragraph [ref=e127]:
                                    - generic [ref=e128]: Add New Request for Quote
                    - generic [ref=e130]:
                        - button [ref=e131] [cursor=pointer]: Next
                        - button [ref=e132] [cursor=pointer]: Save To Draft
                        - button [ref=e133] [cursor=pointer]: Discard
                        - button [ref=e134] [cursor=pointer]: Save
                - generic [ref=e136]:
                    - generic [ref=e139]:
                        - tablist [ref=e142]:
                            - tab [selected] [ref=e143] [cursor=pointer]:
                                - paragraph [ref=e144]: Basic Details
                            - tab [ref=e145] [cursor=pointer]:
                                - paragraph [ref=e146]: Address & Contact
                        - tabpanel [ref=e148]:
                            - generic [ref=e149]:
                                - generic [ref=e150]:
                                    - paragraph [ref=e151]: ID
                                    - generic [ref=e153]:
                                        - textbox [disabled] [ref=e154]:
                                            - /placeholder: ID
                                        - group
                                - generic [ref=e155]:
                                    - paragraph [ref=e156]: Date *
                                    - generic [ref=e158]:
                                        - textbox [ref=e159]:
                                            - /placeholder: Select Date
                                            - text: 17-07-2026
                                        - button [ref=e161] [cursor=pointer]:
                                            - img [ref=e162]
                                        - group
                                - generic [ref=e173]:
                                    - paragraph [ref=e174]: Vendor *
                                    - generic [ref=e175]:
                                        - combobox [ref=e176] [cursor=pointer]: PC vendor
                                        - textbox: "1385"
                                        - img
                                        - button [ref=e178] [cursor=pointer]:
                                            - img [ref=e179]
                                        - group
                                - generic [ref=e181]:
                                    - paragraph [ref=e182]: Entity *
                                    - generic [ref=e183]:
                                        - combobox [ref=e184] [cursor=pointer]: erp-force
                                        - textbox: "1"
                                        - img
                                        - button [ref=e186] [cursor=pointer]:
                                            - img [ref=e187]
                                        - group
                                - generic [ref=e189]:
                                    - paragraph [ref=e190]: Location
                                    - generic [ref=e191]:
                                        - combobox [expanded] [ref=e192] [cursor=pointer]: Search Location
                                        - textbox
                                        - img
                                        - group
                                - generic [ref=e193]:
                                    - paragraph [ref=e194]: Order Deadline
                                    - generic [ref=e196]:
                                        - textbox [ref=e197]:
                                            - /placeholder: Select Date
                                        - button [ref=e199] [cursor=pointer]:
                                            - img [ref=e200]
                                        - group
                                - generic [ref=e211]:
                                    - paragraph [ref=e212]: Expected Required Date
                                    - generic [ref=e214]:
                                        - textbox [ref=e215]:
                                            - /placeholder: Select Date
                                        - button [ref=e217] [cursor=pointer]:
                                            - img [ref=e218]
                                        - group
                                - generic [ref=e229]:
                                    - paragraph [ref=e230]: Currency *
                                    - generic [ref=e231]:
                                        - combobox [ref=e232] [cursor=pointer]: AED
                                        - textbox: "2"
                                        - img
                                        - button [ref=e234] [cursor=pointer]:
                                            - img [ref=e235]
                                        - group
                                - generic [ref=e237]:
                                    - paragraph [ref=e238]: Exchange Rate *
                                    - generic [ref=e240]:
                                        - spinbutton [ref=e241]: "0.2"
                                        - group
                                - generic [ref=e242]:
                                    - paragraph [ref=e243]: Purchase Representative
                                    - generic [ref=e244]:
                                        - combobox [ref=e245] [cursor=pointer]: QA Nikita
                                        - textbox: "345"
                                        - img
                                        - button [ref=e247] [cursor=pointer]:
                                            - img [ref=e248]
                                        - group
                                - generic [ref=e250]:
                                    - paragraph [ref=e251]: Payment Terms
                                    - generic [ref=e252]:
                                        - combobox [ref=e253] [cursor=pointer]: Search Payment Terms
                                        - textbox
                                        - img
                                        - group
                                - generic [ref=e254]:
                                    - paragraph [ref=e255]: Reference No.
                                    - generic [ref=e257]:
                                        - textbox [ref=e258]:
                                            - /placeholder: Enter Reference No.
                                        - group
                                - generic [ref=e259]:
                                    - paragraph [ref=e260]: Terms & Condition
                                    - generic [ref=e261]:
                                        - combobox [ref=e262] [cursor=pointer]: Search Terms & Condition
                                        - textbox
                                        - img
                                        - group
                                - generic [ref=e264]:
                                    - paragraph [ref=e265]: Narration
                                    - generic [ref=e267]:
                                        - textbox [ref=e268]:
                                            - /placeholder: Enter Narration
                                            - text: TC-RFQ-12 delete draft
                                        - group
                            - separator [ref=e269]
                            - generic [ref=e270]:
                                - button [expanded] [ref=e271] [cursor=pointer]:
                                    - paragraph [ref=e273]: Items*
                                    - img [ref=e275]
                                - region [ref=e280]:
                                    - generic [ref=e282]:
                                        - table [ref=e287]:
                                            - rowgroup [ref=e288]:
                                                - row [ref=e289]:
                                                    - columnheader [ref=e290]:
                                                        - generic [ref=e291]:
                                                            - button [ref=e294] [cursor=pointer]:
                                                                - img [ref=e295]
                                                            - separator [ref=e297]
                                                    - columnheader [ref=e298]:
                                                        - generic [ref=e299]:
                                                            - generic [ref=e302]: Awarded
                                                            - separator [ref=e304]
                                                    - columnheader [ref=e305]:
                                                        - generic [ref=e306]:
                                                            - generic [ref=e307] [cursor=pointer]:
                                                                - generic [ref=e309]: Item
                                                                - button [ref=e311]:
                                                                    - img [ref=e312]
                                                            - separator [ref=e316]
                                                    - columnheader [ref=e317]:
                                                        - generic [ref=e318]:
                                                            - generic [ref=e319] [cursor=pointer]:
                                                                - generic [ref=e321]: Vendor Item Name
                                                                - button [ref=e323]:
                                                                    - img [ref=e324]
                                                            - separator [ref=e328]
                                                    - columnheader [ref=e329]:
                                                        - generic [ref=e330]:
                                                            - generic [ref=e331] [cursor=pointer]:
                                                                - generic [ref=e333]: Purchase Order
                                                                - button [ref=e335]:
                                                                    - img [ref=e336]
                                                            - separator [ref=e340]
                                                    - columnheader [ref=e341]:
                                                        - generic [ref=e342]:
                                                            - generic [ref=e343] [cursor=pointer]:
                                                                - generic [ref=e345]: UoM
                                                                - button [ref=e347]:
                                                                    - img [ref=e348]
                                                            - separator [ref=e352]
                                                    - columnheader [ref=e353]:
                                                        - generic [ref=e354]:
                                                            - generic [ref=e355] [cursor=pointer]:
                                                                - generic [ref=e357]: Description
                                                                - button [ref=e359]:
                                                                    - img [ref=e360]
                                                            - separator [ref=e364]
                                                    - columnheader [ref=e365]:
                                                        - generic [ref=e366]:
                                                            - generic [ref=e367] [cursor=pointer]:
                                                                - generic [ref=e369]: Specification
                                                                - button [ref=e371]:
                                                                    - img [ref=e372]
                                                            - separator [ref=e376]
                                                    - columnheader [ref=e377]:
                                                        - generic [ref=e378]:
                                                            - generic [ref=e379] [cursor=pointer]:
                                                                - generic [ref=e381]: Requested Quantity
                                                                - button [ref=e383]:
                                                                    - img [ref=e384]
                                                            - separator [ref=e388]
                                                    - columnheader [ref=e389]:
                                                        - generic [ref=e390]:
                                                            - generic [ref=e391] [cursor=pointer]:
                                                                - generic [ref=e393]: Estimated Order Quantity Per Year
                                                                - button [ref=e395]:
                                                                    - img [ref=e396]
                                                            - separator [ref=e400]
                                                    - columnheader [ref=e401]:
                                                        - generic [ref=e402]:
                                                            - generic [ref=e403] [cursor=pointer]:
                                                                - generic [ref=e405]: Location
                                                                - button [ref=e407]:
                                                                    - img [ref=e408]
                                                            - separator [ref=e412]
                                                    - columnheader [ref=e413]:
                                                        - generic [ref=e414]:
                                                            - generic [ref=e415] [cursor=pointer]:
                                                                - generic [ref=e417]: Department
                                                                - button [ref=e419]:
                                                                    - img [ref=e420]
                                                            - separator [ref=e424]
                                                    - columnheader [ref=e425]:
                                                        - generic [ref=e426]:
                                                            - generic [ref=e427] [cursor=pointer]:
                                                                - generic [ref=e429]: Narration
                                                                - button [ref=e431]:
                                                                    - img [ref=e432]
                                                            - separator [ref=e436]
                                            - rowgroup [ref=e437]:
                                                - row [ref=e438]:
                                                    - cell [ref=e439]:
                                                        - generic [ref=e440]:
                                                            - img [ref=e441]
                                                            - paragraph [ref=e442]: No Data
                                        - button [ref=e444] [cursor=pointer]:
                                            - img [ref=e446]
                                            - text: Add
                            - generic [ref=e448]:
                                - button [expanded] [ref=e449] [cursor=pointer]:
                                    - paragraph [ref=e451]: Call For Tender
                                    - img [ref=e453]
                                - region [ref=e458]:
                                    - generic [ref=e460]:
                                        - table [ref=e465]:
                                            - rowgroup [ref=e466]:
                                                - row [ref=e467]:
                                                    - columnheader [ref=e468]:
                                                        - generic [ref=e469]:
                                                            - button [ref=e472] [cursor=pointer]:
                                                                - img [ref=e473]
                                                            - separator [ref=e475]
                                                    - columnheader [ref=e476]:
                                                        - generic [ref=e477]:
                                                            - generic [ref=e478] [cursor=pointer]:
                                                                - generic [ref=e480]: Vendor Item Name
                                                                - button [ref=e482]:
                                                                    - img [ref=e483]
                                                            - separator [ref=e487]
                                                    - columnheader [ref=e488]:
                                                        - generic [ref=e489]:
                                                            - generic [ref=e490] [cursor=pointer]:
                                                                - generic [ref=e492]: RFQ ID
                                                                - button [ref=e494]:
                                                                    - img [ref=e495]
                                                            - separator [ref=e499]
                                                    - columnheader [ref=e500]:
                                                        - generic [ref=e501]:
                                                            - generic [ref=e502] [cursor=pointer]:
                                                                - generic [ref=e504]: Expected Required Date
                                                                - button [ref=e506]:
                                                                    - img [ref=e507]
                                                            - separator [ref=e511]
                                                    - columnheader [ref=e512]:
                                                        - generic [ref=e513]:
                                                            - generic [ref=e514] [cursor=pointer]:
                                                                - generic [ref=e516]: Status
                                                                - button [ref=e518]:
                                                                    - img [ref=e519]
                                                            - separator [ref=e523]
                                            - rowgroup [ref=e524]:
                                                - row [ref=e525]:
                                                    - cell [ref=e526]:
                                                        - generic [ref=e527]:
                                                            - img [ref=e528]
                                                            - paragraph [ref=e529]: No Data
                                        - button [ref=e531] [cursor=pointer]:
                                            - img [ref=e533]
                                            - text: Add
                            - separator [ref=e535]
                            - generic [ref=e536]:
                                - button [expanded] [ref=e537] [cursor=pointer]:
                                    - paragraph [ref=e539]: Attachment
                                    - img [ref=e541]
                                - region [ref=e546]:
                                    - generic [ref=e549]:
                                        - paragraph [ref=e550]: Attach your file here
                                        - button [ref=e552] [cursor=pointer]:
                                            - img [ref=e554]
                                            - paragraph [ref=e555]: Upload
                                            - button [ref=e556]
                    - generic [ref=e559]:
                        - separator [ref=e560]
                        - generic [ref=e561]:
                            - tablist [ref=e564]:
                                - tab [selected] [ref=e565] [cursor=pointer]:
                                    - paragraph [ref=e566]: Summary
                            - tabpanel [ref=e568]:
                                - generic [ref=e570]:
                                    - paragraph [ref=e572]: ID
                                    - generic [ref=e573]:
                                        - paragraph [ref=e574]: Date
                                        - paragraph [ref=e575]: 17-07-2026
                                    - generic [ref=e576]:
                                        - paragraph [ref=e577]: Vendor
                                        - paragraph [ref=e578]: PC vendor
                                    - generic [ref=e579]:
                                        - paragraph [ref=e580]: Entity
                                        - paragraph [ref=e581]: erp-force
                                    - generic [ref=e582]:
                                        - paragraph [ref=e583]: Location
                                        - paragraph [ref=e584]: "-"
                                    - generic [ref=e585]:
                                        - paragraph [ref=e586]: Expected Required Date
                                        - paragraph [ref=e587]: "-"
                                    - generic [ref=e588]:
                                        - paragraph [ref=e589]: Order Deadline
                                        - paragraph [ref=e590]: "-"
                                    - generic [ref=e591]:
                                        - paragraph [ref=e592]: Currency
                                        - paragraph [ref=e593]: AED
                                    - generic [ref=e594]:
                                        - paragraph [ref=e595]: Exchange Rate
                                        - paragraph [ref=e596]: AED 0.20
                                    - generic [ref=e597]:
                                        - paragraph [ref=e598]: Purchase Representative
                                        - paragraph [ref=e599]: QA Nikita
                                    - generic [ref=e600]:
                                        - paragraph [ref=e601]: Payment Terms
                                        - paragraph [ref=e602]: "-"
                                    - generic [ref=e603]:
                                        - paragraph [ref=e604]: Reference No.
                                        - paragraph [ref=e605]: "-"
                                    - generic [ref=e606]:
                                        - paragraph [ref=e607]: Narration
                                        - paragraph [ref=e608]: TC-RFQ-12 delete draft
    - listbox [ref=e611]:
        - option [ref=e612]:
            - generic [ref=e614]:
                - img [ref=e616]
                - textbox "Search Location" [ref=e618]
                - group
        - option "Select Location" [disabled] [selected]:
            - paragraph:
                - emphasis: Select Location
        - option "Loc_1784209526964_FDql" [ref=e619] [cursor=pointer]:
            - paragraph [ref=e621]: Loc_1784209526964_FDql
        - option "Loc_1784208360293_MtYJ" [ref=e622] [cursor=pointer]:
            - paragraph [ref=e624]: Loc_1784208360293_MtYJ
        - option "Loc_1784206016005_HTSI" [ref=e625] [cursor=pointer]:
            - paragraph [ref=e627]: Loc_1784206016005_HTSI
        - option "Automation_Location_1784205673259_kT9g" [ref=e628] [cursor=pointer]:
            - paragraph [ref=e630]: Automation_Location_1784205673259_kT9g
        - option "Loc_1784197761469_hF7k" [ref=e631] [cursor=pointer]:
            - paragraph [ref=e633]: Loc_1784197761469_hF7k
        - option "Loc_1784197643224_T1LR" [ref=e634] [cursor=pointer]:
            - paragraph [ref=e636]: Loc_1784197643224_T1LR
        - option "Loc_1784197485320_LUTd" [ref=e637] [cursor=pointer]:
            - paragraph [ref=e639]: Loc_1784197485320_LUTd
        - option "Loc_1784196588290_jKCa" [ref=e640] [cursor=pointer]:
            - paragraph [ref=e642]: Loc_1784196588290_jKCa
        - option "Loc_1784196478837_a8m7" [ref=e643] [cursor=pointer]:
            - paragraph [ref=e645]: Loc_1784196478837_a8m7
        - option "Loc_1784195229810_DRJl" [ref=e646] [cursor=pointer]:
            - paragraph [ref=e648]: Loc_1784195229810_DRJl
        - option "Loc_1784194560991_U0hD" [ref=e649] [cursor=pointer]:
            - paragraph [ref=e651]: Loc_1784194560991_U0hD
        - option "Loc_1784192730669_1ixz" [ref=e652] [cursor=pointer]:
            - paragraph [ref=e654]: Loc_1784192730669_1ixz
        - option "Loc_1784192382157_pfwO" [ref=e655] [cursor=pointer]:
            - paragraph [ref=e657]: Loc_1784192382157_pfwO
        - option "Loc_1784192092020_Ftat" [ref=e658] [cursor=pointer]:
            - paragraph [ref=e660]: Loc_1784192092020_Ftat
        - option "Loc_1784192016079_pEuz" [ref=e661] [cursor=pointer]:
            - paragraph [ref=e663]: Loc_1784192016079_pEuz
        - option "Loc_1784191758355_6DDg" [ref=e664] [cursor=pointer]:
            - paragraph [ref=e666]: Loc_1784191758355_6DDg
        - option "Loc_1784191635339_ECUW" [ref=e667] [cursor=pointer]:
            - paragraph [ref=e669]: Loc_1784191635339_ECUW
        - option "Loc_1784191581140_AD26" [ref=e670] [cursor=pointer]:
            - paragraph [ref=e672]: Loc_1784191581140_AD26
        - option "Loc_1784191125806_FHiF" [ref=e673] [cursor=pointer]:
            - paragraph [ref=e675]: Loc_1784191125806_FHiF
        - option "Loc_1784190607341_1LRT" [ref=e676] [cursor=pointer]:
            - paragraph [ref=e678]: Loc_1784190607341_1LRT
        - option "Loc_1784190543477_ZffE" [ref=e679] [cursor=pointer]:
            - paragraph [ref=e681]: Loc_1784190543477_ZffE
        - option "Loc_1784187175179_f0g9" [ref=e682] [cursor=pointer]:
            - paragraph [ref=e684]: Loc_1784187175179_f0g9
        - option "Test_Location_Playwright_1784043057642" [ref=e685] [cursor=pointer]:
            - paragraph [ref=e687]: Test_Location_Playwright_1784043057642
        - option "Test_Location_Playwright_UPDATED_1784034028836" [ref=e688] [cursor=pointer]:
            - paragraph [ref=e690]: Test_Location_Playwright_UPDATED_1784034028836
        - option "nepali" [ref=e691] [cursor=pointer]:
            - paragraph [ref=e693]: nepali
        - option "Create New Location" [ref=e694]:
            - separator [ref=e695]
            - menuitem "Create New Location" [active] [ref=e696] [cursor=pointer]:
                - img [ref=e697]
                - paragraph [ref=e699]: Create New Location
```

# Test source

```ts
  97  |   // (typing narrows the option list) - swallowed because not every module's combobox accepts
  98  |   // typed input, and forcing it there would throw before the option click ever runs.
  99  |   async openDropdownAndPick(placeholder, optionText, { tryFill = false, timeout = 10000 } = {}) {
  100 |     const combobox = this.page
  101 |       .getByRole("combobox", { name: placeholder })
  102 |       .first();
  103 |
  104 |     await combobox.click();
  105 |     if (tryFill) {
  106 |       try {
  107 |         await combobox.fill(optionText);
  108 |       } catch (e) {
  109 |         // Not a text input on this module's field - ignore and fall through to the option click.
  110 |       }
  111 |     }
  112 |
  113 |     const found = await this.selectOptionFromListbox(optionText, { timeout });
  114 |     if (found) return;
  115 |
  116 |     const available = await this.page.getByRole("listbox").getByRole("option").allTextContents();
  117 |     throw new Error(
  118 |       `openDropdownAndPick("${placeholder}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()))}`
  119 |     );
  120 |   }
  121 |
  122 |   // Structural, label-based lookup - unlike name-based lookup above, this doesn't care whether
  123 |   // the combobox's accessible name is currently a "Search X"/"Select X" prompt or an
  124 |   // already-selected value, so it's used for fields that pre-populate on Edit, or whose paragraph
  125 |   // label renders with a trailing required-field asterisk in the same text node (`exact: false`
  126 |   // for those - a bare `exact: true` match against the label alone never matches "X *").
  127 |   // `scope` lets callers scope the label lookup to a modal/dialog instead of the whole page (item
  128 |   // entry modals reuse the same field labels, e.g. "Location", as the main form).
  129 |   async selectFieldByLabel(
  130 |     labelText,
  131 |     optionText,
  132 |     {
  133 |       exact = true,
  134 |       scope = this.page.getByRole('main'),
  135 |       timeout = 10000,
  136 |     } = {},
  137 |   ) {
  138 |     const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  139 |     const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
  140 |     const fieldContainer = scope
  141 |       .getByText(exact ? labelText : labelRegex, { exact })
  142 |       .first()
  143 |       .locator('xpath=..');
  144 |     const combobox = fieldContainer.getByRole('combobox').first();
  145 |
  146 |     const textVal = ((await combobox.textContent()) || '').replace(/[\u200B\uFEFF]/g, "").trim();
  147 |     const inputVal = ((await combobox.inputValue().catch(() => '')) || '').replace(/[\u200B\uFEFF]/g, "").trim();
  148 |     const currentValue = textVal || inputVal;
  149 |     if (currentValue === optionText || (optionText && currentValue.includes(optionText))) {
  150 |       return;
  151 |     }
  152 |
  153 |     await combobox.click();
  154 |     const found = await this.selectOptionFromListbox(optionText, { timeout });
  155 |     if (found) return;
  156 |
  157 |     const available = await this.page.getByRole("listbox").getByRole("option").allTextContents();
  158 |     throw new Error(
  159 |       `selectFieldByLabel("${labelText}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()))}`
  160 |     );
  161 |   }
  162 |
  163 |   // For required fields whose exact live option text in a given account's master data is
  164 |   // unverified, pick whatever renders first in the popover rather than guessing a literal string
  165 |   // that may not exist.
  166 |   async selectFirstOptionByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
  167 |     const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  168 |     const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
  169 |     const combobox = scope
  170 |       .getByText(labelRegex)
  171 |       .first()
  172 |       .locator('xpath=..')
  173 |       .getByRole('combobox')
  174 |       .first();
  175 |     return this.selectFirstAvailableOption(combobox);
  176 |   }
  177 |
  178 |   // `scope` defaults to 'main' (the original, still-correct default for every plain-form module),
  179 |   // but a Drawer/sidebar-based Location field (e.g. Organization Structure's node sidebars) may
  180 |   // render outside the main landmark - pass that sidebar's own locator as `scope` in that case.
  181 |   // `combobox` lets a caller pass its own pre-resolved trigger locator instead of the generic
  182 |   // "Location" label lookup - needed for fields whose label can render under a broken/untranslated
  183 |   // i18n key (e.g. Procurement Request/RFQ's own Location field) where a plain "Location" text
  184 |   // match would miss it entirely.
  185 |   async createLocationFromFooter(locationName, companyName, { scope = this.page.getByRole('main'), combobox } = {}) {
  186 |     if (!combobox) {
  187 |       const escapedLabel = 'Location'.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  188 |       const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
  189 |       const container = scope
  190 |         .getByText(labelRegex)
  191 |         .first()
  192 |         .locator('xpath=..');
  193 |       combobox = container.getByRole('combobox').first();
  194 |     }
  195 |
  196 |     // 1. Click the combobox to open the listbox
> 197 |     await combobox.click();
      |                    ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  198 |
  199 |     // 2. Click "+ Create New Location" from the footer
  200 |     await this.page.getByText('Create New Location', { exact: false }).click();
  201 |
  202 |     // 3. Wait for the dialog to be visible
  203 |     const dialog = this.page.getByRole('dialog');
  204 |     await dialog.waitFor({ state: 'visible' });
  205 |
  206 |     // 4. Fill in Location Name and a unique Location Code
  207 |     await dialog.getByPlaceholder('inventory.item.locationModal.location_name_placeholder').fill(locationName);
  208 |     const code = 'LOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  209 |     await dialog.getByPlaceholder('inventory.item.locationModal.location_code_placeholder').fill(code);
  210 |
  211 |     // 5. Select Company inside the dialog
  212 |     await this.selectFieldByLabel(
  213 |       'accounting.authorize_commission.fields.company_label',
  214 |       companyName,
  215 |       { exact: false, scope: dialog }
  216 |     );
  217 |
  218 |     // 6. Save the new location
  219 |     await dialog.getByRole('button', { name: 'Save' }).click();
  220 |
  221 |     // 7. Wait for the dialog to close
  222 |     await dialog.waitFor({ state: 'hidden' });
  223 |
  224 |     // 8. Select the newly created location from the open listbox
  225 |     const selected = await this.selectOptionFromListbox(locationName, { timeout: 7000 });
  226 |     if (!selected) {
  227 |       // Ensure any dialog/backdrop is fully hidden/detached before manual selection fallback
  228 |       await this.page.waitForSelector('.MuiDialog-root', { state: 'detached', timeout: 5000 }).catch(() => {});
  229 |       await this.page.waitForSelector('.MuiBackdrop-root', { state: 'detached', timeout: 5000 }).catch(() => {});
  230 |       // Re-open the SAME combobox resolved above (not a fresh "Location" label lookup, which
  231 |       // would miss a broken/untranslated label) and retry the selection directly.
  232 |       await combobox.click();
  233 |       const found = await this.selectOptionFromListbox(locationName, { timeout: 7000 });
  234 |       if (!found) {
  235 |         throw new Error(`createLocationFromFooter("${locationName}"): created but never appeared selectable in the dropdown.`);
  236 |       }
  237 |     }
  238 |   }
  239 |
  240 |   // Structural lookup for a plain text/number/date input whose visible "label" is a plain <p>,
  241 |   // NOT a real MUI-associated <label> (confirmed live on Leave Policy Master: the paragraph and
  242 |   // its `<input>` are sibling DOM nodes with no `for`/`aria-labelledby` link at all) - getByLabel()
  243 |   // never matches these, and some of these inputs (e.g. a number spinbutton with no placeholder)
  244 |   // have no other accessible name either, so getByPlaceholder isn't a full substitute. Same
  245 |   // trailing-required-asterisk handling as selectFieldByLabel/selectFirstOptionByLabel above.
  246 |   // Apply this ANY time getByLabel/getByPlaceholder times out on a plain input field in a new
  247 |   // module - it's the same underlying app pattern, not a one-off Leave Policy Master quirk.
  248 |   fieldInputByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
  249 |     const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  250 |     const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
  251 |     return scope
  252 |       .getByText(labelRegex)
  253 |       .first()
  254 |       .locator('xpath=..')
  255 |       .locator('input')
  256 |       .first();
  257 |   }
  258 |
  259 |   // ---------- Date helpers ----------
  260 |   formatDateToday() {
  261 |     const d = new Date();
  262 |     return `${String(d.getDate()).padStart(2, "0")}-${String(
  263 |       d.getMonth() + 1,
  264 |     ).padStart(2, "0")}-${d.getFullYear()}`;
  265 |   }
  266 |
  267 |   // seriesNumber is the exact text rendered in the list's ID column (e.g. "PR-2026-000149") - see
  268 |   // the comment on each subclass's saveAndCaptureId for why this can't be derived from the raw id.
  269 |   // NOT getByRole('link', ...): confirmed live that page.getByRole('link') matches ZERO elements
  270 |   // anywhere on these listing pages, even though a plain page.locator('a') finds the exact same
  271 |   // element with the exact same text - the table's row-cell anchors have no real `href`
  272 |   // attribute (SPA-style onClick navigation instead), so they get no implicit ARIA link role
  273 |   // under strict getByRole() semantics, even though Playwright's own (more lenient) ARIA-
  274 |   // snapshot debug tool still labels them "link" for readability. Match by text instead, which
  275 |   // works regardless of the element's role.
  276 |   rowBySeriesNumber(seriesNumber) {
  277 |     return this.page.locator("tr", {
  278 |       has: this.page.getByText(seriesNumber, { exact: true }),
  279 |     });
  280 |   }
  281 |
  282 |   async openRowActionMenu(seriesNumber) {
  283 |     if (!seriesNumber)
  284 |       throw new Error(
  285 |         `openRowActionMenu() called with a falsy seriesNumber (${seriesNumber}) - a prior create/save step likely failed.`,
  286 |       );
  287 |     const row = this.rowBySeriesNumber(seriesNumber);
  288 |     await row.locator("button").first().click(); // "..." menu button
  289 |   }
  290 |
  291 |   // Narration is a real <textarea>; its value isn't part of innerText(), unlike comboboxes.
  292 |   async getEditNarrationValue() {
  293 |     return this.page.getByPlaceholder("Enter Narration").inputValue();
  294 |   }
  295 |
  296 |   // .first() guards against labels that collide with an Items-grid column of the same name
  297 |   // (e.g. "Location"), where a hidden sort-indicator badge can also match the xpath axis. Some
```

Test: TC-RFQ-13 [+] Item master data remains intact after deleting a Draft RFQ

- # Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> TC-RFQ-13 [+] Item master data remains intact after deleting a Draft RFQ
- Location: tests/procurement/03-rfq.spec.js:229:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByText('Location', { exact: true }).first().locator('xpath=following::*[@role="combobox"][1]')
    - locator resolved to <div tabindex="0" role="combobox" aria-expanded="true" aria-controls=":r12:" aria-haspopup="listbox" id="mui-component-select-rfq.location_id" aria-labelledby="mui-component-select-rfq.location_id" class="MuiSelect-select MuiSelect-outlined MuiInputBase-input MuiOutlinedInput-input MuiInputBase-inputSizeSmall MuiInputBase-inputAdornedEnd mui-51drbn-MuiSelect-select-MuiInputBase-input-MuiOutlinedInput-input">Search Location</div>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <input value="" id=":r28:" type="text" aria-invalid="false" placeholder="Search Location" class="MuiInputBase-input MuiOutlinedInput-input MuiInputBase-inputAdornedStart mui-9vvs02-MuiInputBase-input-MuiOutlinedInput-input"/> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    7 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <input value="" id=":r28:" type="text" aria-invalid="false" placeholder="Search Location" class="MuiInputBase-input MuiOutlinedInput-input MuiInputBase-inputAdornedStart mui-9vvs02-MuiInputBase-input-MuiOutlinedInput-input"/> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop mui-g3hgs1-MuiBackdrop-root-MuiModal-backdrop"></div> from <div role="presentation" id="menu-rfq.location_id" class="MuiPopover-root MuiMenu-root MuiModal-root mui-10nakn3-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - generic [ref=e4]:
        - banner [ref=e5]:
            - generic [ref=e7]:
                - button [ref=e8] [cursor=pointer]:
                    - img [ref=e9]
                - button [ref=e20] [cursor=pointer]:
                    - img [ref=e21]
                - navigation [ref=e23]:
                    - button [ref=e24] [cursor=pointer]:
                        - generic [ref=e26]: Procurement
                    - img [ref=e27]
                    - img [ref=e29]
                    - button [ref=e31] [cursor=pointer]: Request For Quote
                    - img [ref=e32]
                - button [ref=e36] [cursor=pointer]:
                    - img [ref=e38]
                - button [ref=e42] [cursor=pointer]:
                    - generic [ref=e44]: D
                    - generic [ref=e45]:
                        - generic [ref=e46]: Dipen Modi
                        - generic [ref=e47]: Admin
        - generic [ref=e50]:
            - img [ref=e53] [cursor=pointer]
            - button [ref=e55] [cursor=pointer]:
                - img [ref=e56]
            - list [ref=e60]:
                - listitem [ref=e61]:
                    - button [ref=e62] [cursor=pointer]:
                        - img [ref=e64]
                - listitem [ref=e68]:
                    - button [ref=e69] [cursor=pointer]:
                        - img [ref=e71]
                - listitem [ref=e79]:
                    - button [ref=e80] [cursor=pointer]:
                        - img [ref=e82]
                - listitem [ref=e90]:
                    - button [ref=e91] [cursor=pointer]:
                        - img [ref=e93]
                - listitem [ref=e99]:
                    - button [ref=e100] [cursor=pointer]:
                        - img [ref=e102]
                - listitem [ref=e105]:
                    - button [ref=e106] [cursor=pointer]:
                        - img [ref=e108]
        - button [ref=e113] [cursor=pointer]:
            - img [ref=e114]
        - main [ref=e116]:
            - generic [ref=e117]:
                - generic [ref=e118]:
                    - navigation [ref=e119]:
                        - list [ref=e120]:
                            - listitem [ref=e121]:
                                - link [ref=e123] [cursor=pointer]:
                                    - /url: /dashboard/procurement/orders/request-for-quote
                                    - text: Request for Quote
                            - listitem [ref=e124]: /
                            - listitem [ref=e125]:
                                - paragraph [ref=e127]:
                                    - generic [ref=e128]: Add New Request for Quote
                    - generic [ref=e130]:
                        - button [ref=e131] [cursor=pointer]: Next
                        - button [ref=e132] [cursor=pointer]: Save To Draft
                        - button [ref=e133] [cursor=pointer]: Discard
                        - button [ref=e134] [cursor=pointer]: Save
                - generic [ref=e136]:
                    - generic [ref=e139]:
                        - tablist [ref=e142]:
                            - tab [selected] [ref=e143] [cursor=pointer]:
                                - paragraph [ref=e144]: Basic Details
                            - tab [ref=e145] [cursor=pointer]:
                                - paragraph [ref=e146]: Address & Contact
                        - tabpanel [ref=e148]:
                            - generic [ref=e149]:
                                - generic [ref=e150]:
                                    - paragraph [ref=e151]: ID
                                    - generic [ref=e153]:
                                        - textbox [disabled] [ref=e154]:
                                            - /placeholder: ID
                                        - group
                                - generic [ref=e155]:
                                    - paragraph [ref=e156]: Date *
                                    - generic [ref=e158]:
                                        - textbox [ref=e159]:
                                            - /placeholder: Select Date
                                            - text: 17-07-2026
                                        - button [ref=e161] [cursor=pointer]:
                                            - img [ref=e162]
                                        - group
                                - generic [ref=e173]:
                                    - paragraph [ref=e174]: Vendor *
                                    - generic [ref=e175]:
                                        - combobox [ref=e176] [cursor=pointer]: PC vendor
                                        - textbox: "1385"
                                        - img
                                        - button [ref=e178] [cursor=pointer]:
                                            - img [ref=e179]
                                        - group
                                - generic [ref=e181]:
                                    - paragraph [ref=e182]: Entity *
                                    - generic [ref=e183]:
                                        - combobox [ref=e184] [cursor=pointer]: erp-force
                                        - textbox: "1"
                                        - img
                                        - button [ref=e186] [cursor=pointer]:
                                            - img [ref=e187]
                                        - group
                                - generic [ref=e189]:
                                    - paragraph [ref=e190]: Location
                                    - generic [ref=e191]:
                                        - combobox [expanded] [ref=e192] [cursor=pointer]: Search Location
                                        - textbox
                                        - img
                                        - group
                                - generic [ref=e193]:
                                    - paragraph [ref=e194]: Order Deadline
                                    - generic [ref=e196]:
                                        - textbox [ref=e197]:
                                            - /placeholder: Select Date
                                        - button [ref=e199] [cursor=pointer]:
                                            - img [ref=e200]
                                        - group
                                - generic [ref=e211]:
                                    - paragraph [ref=e212]: Expected Required Date
                                    - generic [ref=e214]:
                                        - textbox [ref=e215]:
                                            - /placeholder: Select Date
                                        - button [ref=e217] [cursor=pointer]:
                                            - img [ref=e218]
                                        - group
                                - generic [ref=e229]:
                                    - paragraph [ref=e230]: Currency *
                                    - generic [ref=e231]:
                                        - combobox [ref=e232] [cursor=pointer]: AED
                                        - textbox: "2"
                                        - img
                                        - button [ref=e234] [cursor=pointer]:
                                            - img [ref=e235]
                                        - group
                                - generic [ref=e237]:
                                    - paragraph [ref=e238]: Exchange Rate *
                                    - generic [ref=e240]:
                                        - spinbutton [ref=e241]: "0.2"
                                        - group
                                - generic [ref=e242]:
                                    - paragraph [ref=e243]: Purchase Representative
                                    - generic [ref=e244]:
                                        - combobox [ref=e245] [cursor=pointer]: QA Nikita
                                        - textbox: "345"
                                        - img
                                        - button [ref=e247] [cursor=pointer]:
                                            - img [ref=e248]
                                        - group
                                - generic [ref=e250]:
                                    - paragraph [ref=e251]: Payment Terms
                                    - generic [ref=e252]:
                                        - combobox [ref=e253] [cursor=pointer]: Search Payment Terms
                                        - textbox
                                        - img
                                        - group
                                - generic [ref=e254]:
                                    - paragraph [ref=e255]: Reference No.
                                    - generic [ref=e257]:
                                        - textbox [ref=e258]:
                                            - /placeholder: Enter Reference No.
                                        - group
                                - generic [ref=e259]:
                                    - paragraph [ref=e260]: Terms & Condition
                                    - generic [ref=e261]:
                                        - combobox [ref=e262] [cursor=pointer]: Search Terms & Condition
                                        - textbox
                                        - img
                                        - group
                                - generic [ref=e264]:
                                    - paragraph [ref=e265]: Narration
                                    - generic [ref=e267]:
                                        - textbox [ref=e268]:
                                            - /placeholder: Enter Narration
                                            - text: TC-RFQ-13 related data check
                                        - group
                            - separator [ref=e269]
                            - generic [ref=e270]:
                                - button [expanded] [ref=e271] [cursor=pointer]:
                                    - paragraph [ref=e273]: Items*
                                    - img [ref=e275]
                                - region [ref=e280]:
                                    - generic [ref=e282]:
                                        - table [ref=e287]:
                                            - rowgroup [ref=e288]:
                                                - row [ref=e289]:
                                                    - columnheader [ref=e290]:
                                                        - generic [ref=e291]:
                                                            - button [ref=e294] [cursor=pointer]:
                                                                - img [ref=e295]
                                                            - separator [ref=e297]
                                                    - columnheader [ref=e298]:
                                                        - generic [ref=e299]:
                                                            - generic [ref=e302]: Awarded
                                                            - separator [ref=e304]
                                                    - columnheader [ref=e305]:
                                                        - generic [ref=e306]:
                                                            - generic [ref=e307] [cursor=pointer]:
                                                                - generic [ref=e309]: Item
                                                                - button [ref=e311]:
                                                                    - img [ref=e312]
                                                            - separator [ref=e316]
                                                    - columnheader [ref=e317]:
                                                        - generic [ref=e318]:
                                                            - generic [ref=e319] [cursor=pointer]:
                                                                - generic [ref=e321]: Vendor Item Name
                                                                - button [ref=e323]:
                                                                    - img [ref=e324]
                                                            - separator [ref=e328]
                                                    - columnheader [ref=e329]:
                                                        - generic [ref=e330]:
                                                            - generic [ref=e331] [cursor=pointer]:
                                                                - generic [ref=e333]: Purchase Order
                                                                - button [ref=e335]:
                                                                    - img [ref=e336]
                                                            - separator [ref=e340]
                                                    - columnheader [ref=e341]:
                                                        - generic [ref=e342]:
                                                            - generic [ref=e343] [cursor=pointer]:
                                                                - generic [ref=e345]: UoM
                                                                - button [ref=e347]:
                                                                    - img [ref=e348]
                                                            - separator [ref=e352]
                                                    - columnheader [ref=e353]:
                                                        - generic [ref=e354]:
                                                            - generic [ref=e355] [cursor=pointer]:
                                                                - generic [ref=e357]: Description
                                                                - button [ref=e359]:
                                                                    - img [ref=e360]
                                                            - separator [ref=e364]
                                                    - columnheader [ref=e365]:
                                                        - generic [ref=e366]:
                                                            - generic [ref=e367] [cursor=pointer]:
                                                                - generic [ref=e369]: Specification
                                                                - button [ref=e371]:
                                                                    - img [ref=e372]
                                                            - separator [ref=e376]
                                                    - columnheader [ref=e377]:
                                                        - generic [ref=e378]:
                                                            - generic [ref=e379] [cursor=pointer]:
                                                                - generic [ref=e381]: Requested Quantity
                                                                - button [ref=e383]:
                                                                    - img [ref=e384]
                                                            - separator [ref=e388]
                                                    - columnheader [ref=e389]:
                                                        - generic [ref=e390]:
                                                            - generic [ref=e391] [cursor=pointer]:
                                                                - generic [ref=e393]: Estimated Order Quantity Per Year
                                                                - button [ref=e395]:
                                                                    - img [ref=e396]
                                                            - separator [ref=e400]
                                                    - columnheader [ref=e401]:
                                                        - generic [ref=e402]:
                                                            - generic [ref=e403] [cursor=pointer]:
                                                                - generic [ref=e405]: Location
                                                                - button [ref=e407]:
                                                                    - img [ref=e408]
                                                            - separator [ref=e412]
                                                    - columnheader [ref=e413]:
                                                        - generic [ref=e414]:
                                                            - generic [ref=e415] [cursor=pointer]:
                                                                - generic [ref=e417]: Department
                                                                - button [ref=e419]:
                                                                    - img [ref=e420]
                                                            - separator [ref=e424]
                                                    - columnheader [ref=e425]:
                                                        - generic [ref=e426]:
                                                            - generic [ref=e427] [cursor=pointer]:
                                                                - generic [ref=e429]: Narration
                                                                - button [ref=e431]:
                                                                    - img [ref=e432]
                                                            - separator [ref=e436]
                                            - rowgroup [ref=e437]:
                                                - row [ref=e438]:
                                                    - cell [ref=e439]:
                                                        - generic [ref=e440]:
                                                            - img [ref=e441]
                                                            - paragraph [ref=e442]: No Data
                                        - button [ref=e444] [cursor=pointer]:
                                            - img [ref=e446]
                                            - text: Add
                            - generic [ref=e448]:
                                - button [expanded] [ref=e449] [cursor=pointer]:
                                    - paragraph [ref=e451]: Call For Tender
                                    - img [ref=e453]
                                - region [ref=e458]:
                                    - generic [ref=e460]:
                                        - table [ref=e465]:
                                            - rowgroup [ref=e466]:
                                                - row [ref=e467]:
                                                    - columnheader [ref=e468]:
                                                        - generic [ref=e469]:
                                                            - button [ref=e472] [cursor=pointer]:
                                                                - img [ref=e473]
                                                            - separator [ref=e475]
                                                    - columnheader [ref=e476]:
                                                        - generic [ref=e477]:
                                                            - generic [ref=e478] [cursor=pointer]:
                                                                - generic [ref=e480]: Vendor Item Name
                                                                - button [ref=e482]:
                                                                    - img [ref=e483]
                                                            - separator [ref=e487]
                                                    - columnheader [ref=e488]:
                                                        - generic [ref=e489]:
                                                            - generic [ref=e490] [cursor=pointer]:
                                                                - generic [ref=e492]: RFQ ID
                                                                - button [ref=e494]:
                                                                    - img [ref=e495]
                                                            - separator [ref=e499]
                                                    - columnheader [ref=e500]:
                                                        - generic [ref=e501]:
                                                            - generic [ref=e502] [cursor=pointer]:
                                                                - generic [ref=e504]: Expected Required Date
                                                                - button [ref=e506]:
                                                                    - img [ref=e507]
                                                            - separator [ref=e511]
                                                    - columnheader [ref=e512]:
                                                        - generic [ref=e513]:
                                                            - generic [ref=e514] [cursor=pointer]:
                                                                - generic [ref=e516]: Status
                                                                - button [ref=e518]:
                                                                    - img [ref=e519]
                                                            - separator [ref=e523]
                                            - rowgroup [ref=e524]:
                                                - row [ref=e525]:
                                                    - cell [ref=e526]:
                                                        - generic [ref=e527]:
                                                            - img [ref=e528]
                                                            - paragraph [ref=e529]: No Data
                                        - button [ref=e531] [cursor=pointer]:
                                            - img [ref=e533]
                                            - text: Add
                            - separator [ref=e535]
                            - generic [ref=e536]:
                                - button [expanded] [ref=e537] [cursor=pointer]:
                                    - paragraph [ref=e539]: Attachment
                                    - img [ref=e541]
                                - region [ref=e546]:
                                    - generic [ref=e549]:
                                        - paragraph [ref=e550]: Attach your file here
                                        - button [ref=e552] [cursor=pointer]:
                                            - img [ref=e554]
                                            - paragraph [ref=e555]: Upload
                                            - button [ref=e556]
                    - generic [ref=e559]:
                        - separator [ref=e560]
                        - generic [ref=e561]:
                            - tablist [ref=e564]:
                                - tab [selected] [ref=e565] [cursor=pointer]:
                                    - paragraph [ref=e566]: Summary
                            - tabpanel [ref=e568]:
                                - generic [ref=e570]:
                                    - paragraph [ref=e572]: ID
                                    - generic [ref=e573]:
                                        - paragraph [ref=e574]: Date
                                        - paragraph [ref=e575]: 17-07-2026
                                    - generic [ref=e576]:
                                        - paragraph [ref=e577]: Vendor
                                        - paragraph [ref=e578]: PC vendor
                                    - generic [ref=e579]:
                                        - paragraph [ref=e580]: Entity
                                        - paragraph [ref=e581]: erp-force
                                    - generic [ref=e582]:
                                        - paragraph [ref=e583]: Location
                                        - paragraph [ref=e584]: "-"
                                    - generic [ref=e585]:
                                        - paragraph [ref=e586]: Expected Required Date
                                        - paragraph [ref=e587]: "-"
                                    - generic [ref=e588]:
                                        - paragraph [ref=e589]: Order Deadline
                                        - paragraph [ref=e590]: "-"
                                    - generic [ref=e591]:
                                        - paragraph [ref=e592]: Currency
                                        - paragraph [ref=e593]: AED
                                    - generic [ref=e594]:
                                        - paragraph [ref=e595]: Exchange Rate
                                        - paragraph [ref=e596]: AED 0.20
                                    - generic [ref=e597]:
                                        - paragraph [ref=e598]: Purchase Representative
                                        - paragraph [ref=e599]: QA Nikita
                                    - generic [ref=e600]:
                                        - paragraph [ref=e601]: Payment Terms
                                        - paragraph [ref=e602]: "-"
                                    - generic [ref=e603]:
                                        - paragraph [ref=e604]: Reference No.
                                        - paragraph [ref=e605]: "-"
                                    - generic [ref=e606]:
                                        - paragraph [ref=e607]: Narration
                                        - paragraph [ref=e608]: TC-RFQ-13 related data check
    - listbox [ref=e611]:
        - option [ref=e612]:
            - generic [ref=e614]:
                - img [ref=e616]
                - textbox "Search Location" [ref=e618]
                - group
        - option "Select Location" [disabled] [selected]:
            - paragraph:
                - emphasis: Select Location
        - option "Loc_1784209526964_FDql" [ref=e619] [cursor=pointer]:
            - paragraph [ref=e621]: Loc_1784209526964_FDql
        - option "Loc_1784208360293_MtYJ" [ref=e622] [cursor=pointer]:
            - paragraph [ref=e624]: Loc_1784208360293_MtYJ
        - option "Loc_1784206016005_HTSI" [ref=e625] [cursor=pointer]:
            - paragraph [ref=e627]: Loc_1784206016005_HTSI
        - option "Automation_Location_1784205673259_kT9g" [ref=e628] [cursor=pointer]:
            - paragraph [ref=e630]: Automation_Location_1784205673259_kT9g
        - option "Loc_1784197761469_hF7k" [ref=e631] [cursor=pointer]:
            - paragraph [ref=e633]: Loc_1784197761469_hF7k
        - option "Loc_1784197643224_T1LR" [ref=e634] [cursor=pointer]:
            - paragraph [ref=e636]: Loc_1784197643224_T1LR
        - option "Loc_1784197485320_LUTd" [ref=e637] [cursor=pointer]:
            - paragraph [ref=e639]: Loc_1784197485320_LUTd
        - option "Loc_1784196588290_jKCa" [ref=e640] [cursor=pointer]:
            - paragraph [ref=e642]: Loc_1784196588290_jKCa
        - option "Loc_1784196478837_a8m7" [ref=e643] [cursor=pointer]:
            - paragraph [ref=e645]: Loc_1784196478837_a8m7
        - option "Loc_1784195229810_DRJl" [ref=e646] [cursor=pointer]:
            - paragraph [ref=e648]: Loc_1784195229810_DRJl
        - option "Loc_1784194560991_U0hD" [ref=e649] [cursor=pointer]:
            - paragraph [ref=e651]: Loc_1784194560991_U0hD
        - option "Loc_1784192730669_1ixz" [ref=e652] [cursor=pointer]:
            - paragraph [ref=e654]: Loc_1784192730669_1ixz
        - option "Loc_1784192382157_pfwO" [ref=e655] [cursor=pointer]:
            - paragraph [ref=e657]: Loc_1784192382157_pfwO
        - option "Loc_1784192092020_Ftat" [ref=e658] [cursor=pointer]:
            - paragraph [ref=e660]: Loc_1784192092020_Ftat
        - option "Loc_1784192016079_pEuz" [ref=e661] [cursor=pointer]:
            - paragraph [ref=e663]: Loc_1784192016079_pEuz
        - option "Loc_1784191758355_6DDg" [ref=e664] [cursor=pointer]:
            - paragraph [ref=e666]: Loc_1784191758355_6DDg
        - option "Loc_1784191635339_ECUW" [ref=e667] [cursor=pointer]:
            - paragraph [ref=e669]: Loc_1784191635339_ECUW
        - option "Loc_1784191581140_AD26" [ref=e670] [cursor=pointer]:
            - paragraph [ref=e672]: Loc_1784191581140_AD26
        - option "Loc_1784191125806_FHiF" [ref=e673] [cursor=pointer]:
            - paragraph [ref=e675]: Loc_1784191125806_FHiF
        - option "Loc_1784190607341_1LRT" [ref=e676] [cursor=pointer]:
            - paragraph [ref=e678]: Loc_1784190607341_1LRT
        - option "Loc_1784190543477_ZffE" [ref=e679] [cursor=pointer]:
            - paragraph [ref=e681]: Loc_1784190543477_ZffE
        - option "Loc_1784187175179_f0g9" [ref=e682] [cursor=pointer]:
            - paragraph [ref=e684]: Loc_1784187175179_f0g9
        - option "Test_Location_Playwright_1784043057642" [ref=e685] [cursor=pointer]:
            - paragraph [ref=e687]: Test_Location_Playwright_1784043057642
        - option "Test_Location_Playwright_UPDATED_1784034028836" [ref=e688] [cursor=pointer]:
            - paragraph [ref=e690]: Test_Location_Playwright_UPDATED_1784034028836
        - option "nepali" [ref=e691] [cursor=pointer]:
            - paragraph [ref=e693]: nepali
        - option "Create New Location" [ref=e694]:
            - separator [ref=e695]
            - menuitem "Create New Location" [active] [ref=e696] [cursor=pointer]:
                - img [ref=e697]
                - paragraph [ref=e699]: Create New Location
```

# Test source

```ts
  97  |   // (typing narrows the option list) - swallowed because not every module's combobox accepts
  98  |   // typed input, and forcing it there would throw before the option click ever runs.
  99  |   async openDropdownAndPick(placeholder, optionText, { tryFill = false, timeout = 10000 } = {}) {
  100 |     const combobox = this.page
  101 |       .getByRole("combobox", { name: placeholder })
  102 |       .first();
  103 |
  104 |     await combobox.click();
  105 |     if (tryFill) {
  106 |       try {
  107 |         await combobox.fill(optionText);
  108 |       } catch (e) {
  109 |         // Not a text input on this module's field - ignore and fall through to the option click.
  110 |       }
  111 |     }
  112 |
  113 |     const found = await this.selectOptionFromListbox(optionText, { timeout });
  114 |     if (found) return;
  115 |
  116 |     const available = await this.page.getByRole("listbox").getByRole("option").allTextContents();
  117 |     throw new Error(
  118 |       `openDropdownAndPick("${placeholder}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()))}`
  119 |     );
  120 |   }
  121 |
  122 |   // Structural, label-based lookup - unlike name-based lookup above, this doesn't care whether
  123 |   // the combobox's accessible name is currently a "Search X"/"Select X" prompt or an
  124 |   // already-selected value, so it's used for fields that pre-populate on Edit, or whose paragraph
  125 |   // label renders with a trailing required-field asterisk in the same text node (`exact: false`
  126 |   // for those - a bare `exact: true` match against the label alone never matches "X *").
  127 |   // `scope` lets callers scope the label lookup to a modal/dialog instead of the whole page (item
  128 |   // entry modals reuse the same field labels, e.g. "Location", as the main form).
  129 |   async selectFieldByLabel(
  130 |     labelText,
  131 |     optionText,
  132 |     {
  133 |       exact = true,
  134 |       scope = this.page.getByRole('main'),
  135 |       timeout = 10000,
  136 |     } = {},
  137 |   ) {
  138 |     const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  139 |     const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
  140 |     const fieldContainer = scope
  141 |       .getByText(exact ? labelText : labelRegex, { exact })
  142 |       .first()
  143 |       .locator('xpath=..');
  144 |     const combobox = fieldContainer.getByRole('combobox').first();
  145 |
  146 |     const textVal = ((await combobox.textContent()) || '').replace(/[\u200B\uFEFF]/g, "").trim();
  147 |     const inputVal = ((await combobox.inputValue().catch(() => '')) || '').replace(/[\u200B\uFEFF]/g, "").trim();
  148 |     const currentValue = textVal || inputVal;
  149 |     if (currentValue === optionText || (optionText && currentValue.includes(optionText))) {
  150 |       return;
  151 |     }
  152 |
  153 |     await combobox.click();
  154 |     const found = await this.selectOptionFromListbox(optionText, { timeout });
  155 |     if (found) return;
  156 |
  157 |     const available = await this.page.getByRole("listbox").getByRole("option").allTextContents();
  158 |     throw new Error(
  159 |       `selectFieldByLabel("${labelText}"): option "${optionText}" never appeared in the dropdown within ${timeout}ms (waited through any loading state). Available: ${JSON.stringify(available.map((o) => o.replace(/[\u200B\uFEFF]/g, "").trim()))}`
  160 |     );
  161 |   }
  162 |
  163 |   // For required fields whose exact live option text in a given account's master data is
  164 |   // unverified, pick whatever renders first in the popover rather than guessing a literal string
  165 |   // that may not exist.
  166 |   async selectFirstOptionByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
  167 |     const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  168 |     const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
  169 |     const combobox = scope
  170 |       .getByText(labelRegex)
  171 |       .first()
  172 |       .locator('xpath=..')
  173 |       .getByRole('combobox')
  174 |       .first();
  175 |     return this.selectFirstAvailableOption(combobox);
  176 |   }
  177 |
  178 |   // `scope` defaults to 'main' (the original, still-correct default for every plain-form module),
  179 |   // but a Drawer/sidebar-based Location field (e.g. Organization Structure's node sidebars) may
  180 |   // render outside the main landmark - pass that sidebar's own locator as `scope` in that case.
  181 |   // `combobox` lets a caller pass its own pre-resolved trigger locator instead of the generic
  182 |   // "Location" label lookup - needed for fields whose label can render under a broken/untranslated
  183 |   // i18n key (e.g. Procurement Request/RFQ's own Location field) where a plain "Location" text
  184 |   // match would miss it entirely.
  185 |   async createLocationFromFooter(locationName, companyName, { scope = this.page.getByRole('main'), combobox } = {}) {
  186 |     if (!combobox) {
  187 |       const escapedLabel = 'Location'.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  188 |       const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
  189 |       const container = scope
  190 |         .getByText(labelRegex)
  191 |         .first()
  192 |         .locator('xpath=..');
  193 |       combobox = container.getByRole('combobox').first();
  194 |     }
  195 |
  196 |     // 1. Click the combobox to open the listbox
> 197 |     await combobox.click();
      |                    ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  198 |
  199 |     // 2. Click "+ Create New Location" from the footer
  200 |     await this.page.getByText('Create New Location', { exact: false }).click();
  201 |
  202 |     // 3. Wait for the dialog to be visible
  203 |     const dialog = this.page.getByRole('dialog');
  204 |     await dialog.waitFor({ state: 'visible' });
  205 |
  206 |     // 4. Fill in Location Name and a unique Location Code
  207 |     await dialog.getByPlaceholder('inventory.item.locationModal.location_name_placeholder').fill(locationName);
  208 |     const code = 'LOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  209 |     await dialog.getByPlaceholder('inventory.item.locationModal.location_code_placeholder').fill(code);
  210 |
  211 |     // 5. Select Company inside the dialog
  212 |     await this.selectFieldByLabel(
  213 |       'accounting.authorize_commission.fields.company_label',
  214 |       companyName,
  215 |       { exact: false, scope: dialog }
  216 |     );
  217 |
  218 |     // 6. Save the new location
  219 |     await dialog.getByRole('button', { name: 'Save' }).click();
  220 |
  221 |     // 7. Wait for the dialog to close
  222 |     await dialog.waitFor({ state: 'hidden' });
  223 |
  224 |     // 8. Select the newly created location from the open listbox
  225 |     const selected = await this.selectOptionFromListbox(locationName, { timeout: 7000 });
  226 |     if (!selected) {
  227 |       // Ensure any dialog/backdrop is fully hidden/detached before manual selection fallback
  228 |       await this.page.waitForSelector('.MuiDialog-root', { state: 'detached', timeout: 5000 }).catch(() => {});
  229 |       await this.page.waitForSelector('.MuiBackdrop-root', { state: 'detached', timeout: 5000 }).catch(() => {});
  230 |       // Re-open the SAME combobox resolved above (not a fresh "Location" label lookup, which
  231 |       // would miss a broken/untranslated label) and retry the selection directly.
  232 |       await combobox.click();
  233 |       const found = await this.selectOptionFromListbox(locationName, { timeout: 7000 });
  234 |       if (!found) {
  235 |         throw new Error(`createLocationFromFooter("${locationName}"): created but never appeared selectable in the dropdown.`);
  236 |       }
  237 |     }
  238 |   }
  239 |
  240 |   // Structural lookup for a plain text/number/date input whose visible "label" is a plain <p>,
  241 |   // NOT a real MUI-associated <label> (confirmed live on Leave Policy Master: the paragraph and
  242 |   // its `<input>` are sibling DOM nodes with no `for`/`aria-labelledby` link at all) - getByLabel()
  243 |   // never matches these, and some of these inputs (e.g. a number spinbutton with no placeholder)
  244 |   // have no other accessible name either, so getByPlaceholder isn't a full substitute. Same
  245 |   // trailing-required-asterisk handling as selectFieldByLabel/selectFirstOptionByLabel above.
  246 |   // Apply this ANY time getByLabel/getByPlaceholder times out on a plain input field in a new
  247 |   // module - it's the same underlying app pattern, not a one-off Leave Policy Master quirk.
  248 |   fieldInputByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
  249 |     const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  250 |     const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
  251 |     return scope
  252 |       .getByText(labelRegex)
  253 |       .first()
  254 |       .locator('xpath=..')
  255 |       .locator('input')
  256 |       .first();
  257 |   }
  258 |
  259 |   // ---------- Date helpers ----------
  260 |   formatDateToday() {
  261 |     const d = new Date();
  262 |     return `${String(d.getDate()).padStart(2, "0")}-${String(
  263 |       d.getMonth() + 1,
  264 |     ).padStart(2, "0")}-${d.getFullYear()}`;
  265 |   }
  266 |
  267 |   // seriesNumber is the exact text rendered in the list's ID column (e.g. "PR-2026-000149") - see
  268 |   // the comment on each subclass's saveAndCaptureId for why this can't be derived from the raw id.
  269 |   // NOT getByRole('link', ...): confirmed live that page.getByRole('link') matches ZERO elements
  270 |   // anywhere on these listing pages, even though a plain page.locator('a') finds the exact same
  271 |   // element with the exact same text - the table's row-cell anchors have no real `href`
  272 |   // attribute (SPA-style onClick navigation instead), so they get no implicit ARIA link role
  273 |   // under strict getByRole() semantics, even though Playwright's own (more lenient) ARIA-
  274 |   // snapshot debug tool still labels them "link" for readability. Match by text instead, which
  275 |   // works regardless of the element's role.
  276 |   rowBySeriesNumber(seriesNumber) {
  277 |     return this.page.locator("tr", {
  278 |       has: this.page.getByText(seriesNumber, { exact: true }),
  279 |     });
  280 |   }
  281 |
  282 |   async openRowActionMenu(seriesNumber) {
  283 |     if (!seriesNumber)
  284 |       throw new Error(
  285 |         `openRowActionMenu() called with a falsy seriesNumber (${seriesNumber}) - a prior create/save step likely failed.`,
  286 |       );
  287 |     const row = this.rowBySeriesNumber(seriesNumber);
  288 |     await row.locator("button").first().click(); // "..." menu button
  289 |   }
  290 |
  291 |   // Narration is a real <textarea>; its value isn't part of innerText(), unlike comboboxes.
  292 |   async getEditNarrationValue() {
  293 |     return this.page.getByPlaceholder("Enter Narration").inputValue();
  294 |   }
  295 |
  296 |   // .first() guards against labels that collide with an Items-grid column of the same name
  297 |   // (e.g. "Location"), where a hidden sort-indicator badge can also match the xpath axis. Some
```

Test: TC-RFQ-15 [+] Create a Response from an Open RFQ moves it to Response Received

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> Create Response from RFQ >> TC-RFQ-15 [+] Create a Response from an Open RFQ moves it to Response Received
- Location: tests/procurement/03-rfq.spec.js:253:5

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for locator('table tbody tr').first().locator('button').first()
    - locator resolved to <button tabindex="0" type="button" class="MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeSmall mui-hvz71z-MuiButtonBase-root-MuiIconButton-root">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div tabindex="-1" role="presentation" class="MuiDialog-container MuiDialog-scrollPaper mui-1sep8xo-MuiDialog-container">…</div> from <div role="presentation" class="MuiDialog-root MuiModal-root mui-1ypf0c-MuiModal-root-MuiDialog-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div aria-hidden="true" class="MuiBackdrop-root MuiModal-backdrop mui-15658zm-MuiBackdrop-root-MuiDialog-backdrop"></div> from <div role="presentation" class="MuiDialog-root MuiModal-root mui-1ypf0c-MuiModal-root-MuiDialog-root">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div tabindex="-1" role="presentation" class="MuiDialog-container MuiDialog-scrollPaper mui-1sep8xo-MuiDialog-container">…</div> from <div role="presentation" class="MuiDialog-root MuiModal-root mui-1ypf0c-MuiModal-root-MuiDialog-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    3 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div tabindex="-1" role="presentation" class="MuiDialog-container MuiDialog-scrollPaper mui-1sep8xo-MuiDialog-container">…</div> from <div role="presentation" class="MuiDialog-root MuiModal-root mui-1ypf0c-MuiModal-root-MuiDialog-root">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - generic [ref=e4]:
        - banner [ref=e5]:
            - generic [ref=e7]:
                - button [ref=e8] [cursor=pointer]:
                    - img [ref=e9]
                - button [ref=e20] [cursor=pointer]:
                    - img [ref=e21]
                - navigation [ref=e23]:
                    - button [ref=e24] [cursor=pointer]:
                        - generic [ref=e26]: Procurement
                    - img [ref=e27]
                    - img [ref=e29]
                    - button [ref=e31] [cursor=pointer]: Request For Quote
                    - img [ref=e32]
                - button [ref=e36] [cursor=pointer]:
                    - img [ref=e38]
                - button [ref=e42] [cursor=pointer]:
                    - generic [ref=e44]: D
                    - generic [ref=e45]:
                        - generic [ref=e46]: Dipen Modi
                        - generic [ref=e47]: Admin
        - generic [ref=e50]:
            - img [ref=e53] [cursor=pointer]
            - button [ref=e55] [cursor=pointer]:
                - img [ref=e56]
            - list [ref=e60]:
                - listitem [ref=e61]:
                    - button [ref=e62] [cursor=pointer]:
                        - img [ref=e64]
                - listitem [ref=e68]:
                    - button [ref=e69] [cursor=pointer]:
                        - img [ref=e71]
                - listitem [ref=e79]:
                    - button [ref=e80] [cursor=pointer]:
                        - img [ref=e82]
                - listitem [ref=e90]:
                    - button [ref=e91] [cursor=pointer]:
                        - img [ref=e93]
                - listitem [ref=e99]:
                    - button [ref=e100] [cursor=pointer]:
                        - img [ref=e102]
                - listitem [ref=e105]:
                    - button [ref=e106] [cursor=pointer]:
                        - img [ref=e108]
        - button [ref=e113] [cursor=pointer]:
            - img [ref=e114]
        - main [ref=e116]:
            - generic [ref=e117]:
                - generic [ref=e118]:
                    - navigation [ref=e119]:
                        - list [ref=e120]:
                            - listitem [ref=e121]:
                                - link [ref=e123] [cursor=pointer]:
                                    - /url: /dashboard/procurement/orders/request-for-quote
                                    - text: Request for Quote
                            - listitem [ref=e124]: /
                            - listitem [ref=e125]:
                                - paragraph [ref=e127]:
                                    - generic [ref=e128]: Add New Request for Quote Response
                    - generic [ref=e130]:
                        - button [ref=e131] [cursor=pointer]: Discard
                        - button [ref=e132] [cursor=pointer]: Save
                - generic [ref=e134]:
                    - generic [ref=e138]:
                        - generic [ref=e139]:
                            - button [expanded] [ref=e140] [cursor=pointer]:
                                - paragraph [ref=e142]: Basic Detail
                                - img [ref=e144]
                            - region [ref=e149]:
                                - generic [ref=e151]:
                                    - generic [ref=e152]:
                                        - paragraph [ref=e153]: ID
                                        - generic [ref=e155]:
                                            - textbox [disabled] [ref=e156]:
                                                - /placeholder: ID
                                                - text: RFQ-2026-000252
                                            - group
                                    - generic [ref=e157]:
                                        - paragraph [ref=e158]: Date *
                                        - generic [ref=e160]:
                                            - textbox [ref=e161]:
                                                - /placeholder: Select Date
                                                - text: 17-07-2026
                                            - button [ref=e163] [cursor=pointer]:
                                                - img [ref=e164]
                                            - group
                                    - generic [ref=e175]:
                                        - paragraph [ref=e176]: Vendor *
                                        - generic [ref=e177]:
                                            - combobox [disabled] [ref=e178]: PC vendor
                                            - textbox [disabled]: "1385"
                                            - img
                                            - group
                                    - generic [ref=e179]:
                                        - paragraph [ref=e180]: Order Deadline
                                        - generic [ref=e182]:
                                            - textbox [disabled] [ref=e183]:
                                                - /placeholder: Select Date
                                                - text: DD-MM-YYYY
                                            - generic [ref=e184]:
                                                - button [disabled]:
                                                    - img
                                            - group
                                    - generic [ref=e185]:
                                        - paragraph [ref=e186]: Expected Required Date
                                        - generic [ref=e188]:
                                            - textbox [disabled] [ref=e189]:
                                                - /placeholder: Select Date
                                            - generic [ref=e190]:
                                                - button [disabled]:
                                                    - img
                                            - group
                                    - generic [ref=e191]:
                                        - paragraph [ref=e192]: Currency *
                                        - generic [ref=e193]:
                                            - combobox [disabled] [ref=e194]: AED
                                            - textbox [disabled]: "2"
                                            - img
                                            - group
                                    - generic [ref=e195]:
                                        - paragraph [ref=e196]: Exchange Rate *
                                        - generic [ref=e198]:
                                            - textbox [ref=e199]:
                                                - /placeholder: Enter Exchange Rate
                                                - text: "0.2"
                                            - group
                                    - generic [ref=e200]:
                                        - paragraph [ref=e201]: Entity *
                                        - generic [ref=e202]:
                                            - combobox [disabled] [ref=e203]: erp-force
                                            - textbox [disabled]: "1"
                                            - img
                                            - group
                                    - generic [ref=e204]:
                                        - paragraph [ref=e205]: Purchase Representative
                                        - generic [ref=e206]:
                                            - combobox [disabled] [ref=e207]: QA Nikita
                                            - textbox [disabled]: "345"
                                            - img
                                            - group
                                    - generic [ref=e208]:
                                        - paragraph [ref=e209]: Payment Terms *
                                        - generic [ref=e210]:
                                            - combobox [expanded] [ref=e211] [cursor=pointer]: Search Payment Terms
                                            - textbox
                                            - img
                                            - group
                                    - generic [ref=e212]:
                                        - paragraph [ref=e213]: Lead Time
                                        - generic [ref=e215]:
                                            - spinbutton [ref=e216]
                                            - group
                                    - generic [ref=e217]:
                                        - paragraph [ref=e218]: Reference No.
                                        - generic [ref=e220]:
                                            - textbox [ref=e221]:
                                                - /placeholder: Enter Reference No.
                                            - group
                                    - generic [ref=e222]:
                                        - paragraph [ref=e223]: Incoterms
                                        - generic [ref=e224]:
                                            - combobox [ref=e225] [cursor=pointer]: Search Incoterms
                                            - textbox
                                            - img
                                            - group
                                    - generic [ref=e226]:
                                        - paragraph [ref=e227]: Narration
                                        - generic [ref=e229]:
                                            - textbox [ref=e230]:
                                                - /placeholder: Enter Narration
                                                - text: TC-RFQ-15 create response from rfq
                                            - group
                        - separator [ref=e231]
                        - generic [ref=e232]:
                            - button [expanded] [ref=e233] [cursor=pointer]:
                                - paragraph [ref=e235]: Items*
                                - img [ref=e237]
                            - region [ref=e242]:
                                - table [ref=e249]:
                                    - rowgroup [ref=e250]:
                                        - row [ref=e251]:
                                            - columnheader [ref=e252]:
                                                - generic [ref=e253]:
                                                    - button [ref=e256] [cursor=pointer]:
                                                        - img [ref=e257]
                                                    - separator [ref=e259]
                                            - columnheader [ref=e260]:
                                                - generic [ref=e261]:
                                                    - generic [ref=e264]: Awarded
                                                    - separator [ref=e266]
                                            - columnheader [ref=e267]:
                                                - generic [ref=e268]:
                                                    - generic [ref=e269] [cursor=pointer]:
                                                        - generic [ref=e271]: Item
                                                        - button [ref=e273]:
                                                            - img [ref=e274]
                                                    - separator [ref=e278]
                                            - columnheader [ref=e279]:
                                                - generic [ref=e280]:
                                                    - generic [ref=e281] [cursor=pointer]:
                                                        - generic [ref=e283]: Vendor Item Name
                                                        - button [ref=e285]:
                                                            - img [ref=e286]
                                                    - separator [ref=e290]
                                            - columnheader [ref=e291]:
                                                - generic [ref=e292]:
                                                    - generic [ref=e293] [cursor=pointer]:
                                                        - generic [ref=e295]: Purchase Order
                                                        - button [ref=e297]:
                                                            - img [ref=e298]
                                                    - separator [ref=e302]
                                            - columnheader [ref=e303]:
                                                - generic [ref=e304]:
                                                    - generic [ref=e305] [cursor=pointer]:
                                                        - generic [ref=e307]: Requested UoM
                                                        - button [ref=e309]:
                                                            - img [ref=e310]
                                                    - separator [ref=e314]
                                            - columnheader [ref=e315]:
                                                - generic [ref=e316]:
                                                    - generic [ref=e317] [cursor=pointer]:
                                                        - generic [ref=e319]: Vendor UoM
                                                        - button [ref=e321]:
                                                            - img [ref=e322]
                                                    - separator [ref=e326]
                                            - columnheader [ref=e327]:
                                                - generic [ref=e328]:
                                                    - generic [ref=e329] [cursor=pointer]:
                                                        - generic [ref=e331]: Description
                                                        - button [ref=e333]:
                                                            - img [ref=e334]
                                                    - separator [ref=e338]
                                            - columnheader [ref=e339]:
                                                - generic [ref=e340]:
                                                    - generic [ref=e341] [cursor=pointer]:
                                                        - generic [ref=e343]: Specification
                                                        - button [ref=e345]:
                                                            - img [ref=e346]
                                                    - separator [ref=e350]
                                            - columnheader [ref=e351]:
                                                - generic [ref=e352]:
                                                    - generic [ref=e353] [cursor=pointer]:
                                                        - generic [ref=e355]: Condition
                                                        - button [ref=e357]:
                                                            - img [ref=e358]
                                                    - separator [ref=e362]
                                            - columnheader [ref=e363]:
                                                - generic [ref=e364]:
                                                    - generic [ref=e365] [cursor=pointer]:
                                                        - generic [ref=e367]: Rate
                                                        - button [ref=e369]:
                                                            - img [ref=e370]
                                                    - separator [ref=e374]
                                            - columnheader [ref=e375]:
                                                - generic [ref=e376]:
                                                    - generic [ref=e377] [cursor=pointer]:
                                                        - generic [ref=e379]: Requested Quantity
                                                        - button [ref=e381]:
                                                            - img [ref=e382]
                                                    - separator [ref=e386]
                                            - columnheader [ref=e387]:
                                                - generic [ref=e388]:
                                                    - generic [ref=e389] [cursor=pointer]:
                                                        - generic [ref=e391]: Estimated Order Quantity Per Year
                                                        - button [ref=e393]:
                                                            - img [ref=e394]
                                                    - separator [ref=e398]
                                            - columnheader [ref=e399]:
                                                - generic [ref=e400]:
                                                    - generic [ref=e401] [cursor=pointer]:
                                                        - generic [ref=e403]: Minimum Order Quantity
                                                        - button [ref=e405]:
                                                            - img [ref=e406]
                                                    - separator [ref=e410]
                                            - columnheader [ref=e411]:
                                                - generic [ref=e412]:
                                                    - generic [ref=e413] [cursor=pointer]:
                                                        - generic [ref=e415]: Narration
                                                        - button [ref=e417]:
                                                            - img [ref=e418]
                                                    - separator [ref=e422]
                                    - rowgroup [ref=e423]:
                                        - row [ref=e424] [cursor=pointer]:
                                            - cell [ref=e425]:
                                                - button [ref=e426]:
                                                    - img [ref=e427]
                                                - button [ref=e430]:
                                                    - img [ref=e431]
                                            - cell [ref=e435]:
                                                - button [ref=e437]:
                                                    - img [ref=e438]
                                            - cell [ref=e440]: Reg_item1_rental
                                            - cell [ref=e441]:
                                                - paragraph [ref=e442]: Reg_item1_rental
                                            - cell [ref=e443]
                                            - cell [ref=e444]: pics
                                            - cell [ref=e445]
                                            - cell [ref=e446]
                                            - cell [ref=e447]
                                            - cell [ref=e448]
                                            - cell [ref=e449]
                                            - cell [ref=e450]: "2"
                                            - cell [ref=e451]
                                            - cell [ref=e452]
                                            - cell [ref=e453]
                        - separator [ref=e454]
                        - generic [ref=e455]:
                            - button [expanded] [ref=e456] [cursor=pointer]:
                                - paragraph [ref=e458]: Attachment
                                - img [ref=e460]
                            - region [ref=e465]:
                                - generic [ref=e468]:
                                    - paragraph [ref=e469]: Attach your file here
                                    - button [ref=e471] [cursor=pointer]:
                                        - img [ref=e473]
                                        - paragraph [ref=e474]: Upload
                                        - button [ref=e475]
                    - generic [ref=e477]:
                        - separator [ref=e478]
                        - generic [ref=e479]:
                            - tablist [ref=e482]:
                                - tab [selected] [ref=e483] [cursor=pointer]:
                                    - paragraph [ref=e484]: Summary
                                - tab [ref=e485] [cursor=pointer]:
                                    - paragraph [ref=e486]: Activity
                            - tabpanel [ref=e488]:
                                - generic [ref=e490]:
                                    - generic [ref=e491]:
                                        - paragraph [ref=e492]: ID
                                        - paragraph [ref=e493]: RFQ-2026-000252
                                    - generic [ref=e494]:
                                        - paragraph [ref=e495]: Date
                                        - paragraph [ref=e496]: 17-07-2026
                                    - generic [ref=e497]:
                                        - paragraph [ref=e498]: Vendor
                                        - paragraph [ref=e499]: PC vendor
                                    - generic [ref=e500]:
                                        - paragraph [ref=e501]: Order Deadline
                                        - paragraph [ref=e502]: "-"
                                    - generic [ref=e503]:
                                        - paragraph [ref=e504]: Expected Required Date
                                        - paragraph [ref=e505]: "-"
                                    - generic [ref=e506]:
                                        - paragraph [ref=e507]: Currency
                                        - paragraph [ref=e508]: AED
                                    - generic [ref=e509]:
                                        - paragraph [ref=e510]: Exchange Rate
                                        - paragraph [ref=e511]: AED 0.20
                                    - generic [ref=e512]:
                                        - paragraph [ref=e513]: Entity
                                        - paragraph [ref=e514]: erp-force
                                    - generic [ref=e515]:
                                        - paragraph [ref=e516]: Purchase Representative
                                        - paragraph [ref=e517]: QA Nikita
                                    - generic [ref=e518]:
                                        - paragraph [ref=e519]: Payment Terms
                                        - paragraph [ref=e520]: "-"
                                    - generic [ref=e521]:
                                        - paragraph [ref=e522]: Lead Time
                                        - paragraph [ref=e523]: "-"
                                    - generic [ref=e524]:
                                        - paragraph [ref=e525]: Reference No.
                                        - paragraph [ref=e526]: "-"
                                    - generic [ref=e527]:
                                        - paragraph [ref=e528]: Narration
                                        - paragraph [ref=e529]: TC-RFQ-15 create response from rfq
    - listbox [ref=e533]:
        - option [ref=e534]:
            - generic [ref=e536]:
                - img [ref=e538]
                - textbox [ref=e540]:
                    - /placeholder: Search Payment Terms
                - group
        - paragraph:
            - emphasis: Select Payment Terms
        - option [ref=e541] [cursor=pointer]:
            - paragraph [ref=e543]: test test
        - option [ref=e544] [cursor=pointer]:
            - paragraph [ref=e546]: Reg_item1
        - option [ref=e547] [cursor=pointer]:
            - paragraph [ref=e549]: "1"
        - option [ref=e550] [cursor=pointer]:
            - paragraph [ref=e552]: Late Payment
        - option [ref=e553] [cursor=pointer]:
            - paragraph [ref=e555]: New term 1
        - option [ref=e556] [cursor=pointer]:
            - paragraph [ref=e558]: rffff
        - option [ref=e559] [cursor=pointer]:
            - paragraph [ref=e561]: Recurring 45
        - option [ref=e562] [cursor=pointer]:
            - paragraph [ref=e564]: credit 13
        - option [ref=e565] [cursor=pointer]:
            - paragraph [ref=e567]: credit 20 day
        - option [ref=e568] [cursor=pointer]:
            - paragraph [ref=e570]: Net 10
        - option [ref=e571] [cursor=pointer]:
            - paragraph [ref=e573]: Test
        - option [ref=e574] [cursor=pointer]:
            - paragraph [ref=e576]: sdsd
        - option [ref=e577] [cursor=pointer]:
            - paragraph [ref=e579]: Net 10
        - option [ref=e580] [cursor=pointer]:
            - paragraph [ref=e582]: Early payment
        - option [ref=e583] [cursor=pointer]:
            - paragraph [ref=e585]: Net 120
        - option [ref=e586] [cursor=pointer]:
            - paragraph [ref=e588]: Payment at the time of service
        - option [ref=e589] [cursor=pointer]:
            - paragraph [ref=e591]: Net 60
        - option [ref=e592] [cursor=pointer]:
            - paragraph [ref=e594]: Early payment
        - option [ref=e595] [cursor=pointer]:
            - paragraph [ref=e597]: Cash on Delivery(COD)
        - option [ref=e598] [cursor=pointer]:
            - paragraph [ref=e600]: Net 30
        - option [ref=e601]:
            - separator [ref=e602]
            - menuitem [ref=e603] [cursor=pointer]:
                - img [ref=e604]
                - paragraph [ref=e606]: Create New Payment Terms
    - dialog "Add Payment Term" [ref=e609]:
        - generic [ref=e610]:
            - heading "Add Payment Term" [level=2] [ref=e611]:
                - paragraph [ref=e612]: Add Payment Term
                - button [ref=e613] [cursor=pointer]:
                    - img [ref=e614]
            - generic [ref=e617]:
                - generic [ref=e618]:
                    - paragraph [ref=e619]: Name *
                    - generic [ref=e621]:
                        - textbox "Enter name" [ref=e622]
                        - group
                - generic [ref=e623]:
                    - paragraph [ref=e624]: Due Date Based On *
                    - generic [ref=e625]:
                        - combobox "Search Due Date Based On" [ref=e626] [cursor=pointer]
                        - textbox
                        - img
                        - group
                - generic [ref=e627]:
                    - paragraph [ref=e628]: Credit Days *
                    - generic [ref=e630]:
                        - spinbutton [ref=e631]
                        - group
                - generic [ref=e632]:
                    - paragraph [ref=e633]: Mode of Payment
                    - generic [ref=e634]:
                        - combobox "Select mode of payment" [ref=e635] [cursor=pointer]
                        - textbox
                        - img
                        - group
                - generic [ref=e636]:
                    - paragraph [ref=e637]: Discount Type
                    - generic [ref=e638]:
                        - combobox "Select discount type" [ref=e639] [cursor=pointer]
                        - textbox
                        - img
                        - group
                - generic [ref=e640]:
                    - paragraph [ref=e641]: Discount
                    - generic [ref=e643]:
                        - spinbutton [ref=e644]
                        - group
                - generic [ref=e645]:
                    - paragraph [ref=e646]: Discount Due Date Based On
                    - generic [ref=e647]:
                        - combobox "Search Discount Due Date Based On" [ref=e648] [cursor=pointer]
                        - textbox
                        - img
                        - group
                - generic [ref=e649]:
                    - paragraph [ref=e650]: Discount Validity
                    - generic [ref=e652]:
                        - spinbutton [ref=e653]
                        - group
                - generic [ref=e654]:
                    - paragraph [ref=e655]: Description
                    - generic [ref=e657]:
                        - textbox "Enter description" [ref=e658]
                        - group
            - generic [ref=e660]:
                - button "Cancel" [ref=e661] [cursor=pointer]: Cancel
                - button "Save" [ref=e662] [cursor=pointer]: Save
```

# Test source

```ts
  256 |   }
  257 |
  258 |   async save() {
  259 |     return this.saveAndCaptureId('Save', true);
  260 |   }
  261 |
  262 |   // ---------- List actions ----------
  263 |   async editFromList(id, seriesNumber) {
  264 |     await this.openRowActionMenu(seriesNumber);
  265 |     await this.page.getByText('Edit', { exact: true }).click();
  266 |     await this.page.waitForURL(new RegExp(`${id}/edit-request-for-quote`));
  267 |   }
  268 |
  269 |   async getRowStatus(seriesNumber) {
  270 |     return this.getRowStatusMatching(seriesNumber, /Draft|Open|RFQ Sent|Response Received|Pending Order|Order|Completed|Cancelled/);
  271 |   }
  272 |
  273 |   // ---------- Edit page value readers ----------
  274 |   async isIdFieldReadOnly() {
  275 |     // The RFQ ID field is a disabled text input.
  276 |     const idField = this.page.locator('input[name="rfq.id"]');
  277 |     if (await idField.count() > 0) {
  278 |       return idField.isDisabled();
  279 |     }
  280 |     // Fallback: try via role
  281 |     return this.page.getByRole('textbox', { name: /ID/i }).first().isDisabled();
  282 |   }
  283 |
  284 |   // ---------- Delete ----------
  285 |   // confirmDelete() now lives on BasePage unchanged.
  286 |
  287 |   // ---------- Status actions (RFQ-specific) ----------
  288 |   // The RFQ module does NOT have an approval workflow. Instead, it has:
  289 |   // - Save (Draft → Open)
  290 |   // - Cancel (Open/Draft → Cancelled)
  291 |   // - Create (Order/Response/Agreement) — available on Open/RFQ Sent/Response Received
  292 |
  293 |   async cancelFromView() {
  294 |     await this.page.getByRole('button', { name: 'Actions' }).click();
  295 |     await this.page.getByText('Cancel', { exact: true }).click();
  296 |     // Confirmation dialog
  297 |     const dialog = this.page.getByRole('dialog');
  298 |     await dialog.getByRole('button', { name: 'Save' }).click();
  299 |     await expect(dialog).not.toBeVisible();
  300 |   }
  301 |
  302 |   // ---------- Create Order / Response / Agreement ----------
  303 |   // "Create" is a DropdownButton that only renders for certain statuses, but reuses the exact
  304 |   // same "select merge strategy" caret/MuiMenu pattern as the approval-workflow modules' submit
  305 |   // menu - clickSubmitMenuItem() (BasePage) already retries the whole open-menu-then-click
  306 |   // sequence for that shared pattern (same MuiMenu remount-on-open instability documented there),
  307 |   // so reuse it here instead of a bare openSubmitMenu() + one-shot click.
  308 |   async createOrder() {
  309 |     await this.clickSubmitMenuItem(/Order/i);
  310 |   }
  311 |
  312 |   async createResponse() {
  313 |     await this.clickSubmitMenuItem(/Response/i);
  314 |   }
  315 |
  316 |   // ---------- RFQ Response (Create > Response) ----------
  317 |   // WRITTEN FROM erpforce-fe/erpforce-be SOURCE, NOT YET LIVE-VERIFIED end-to-end - same
  318 |   // "unverified live" caveat this repo already carries for VendorReturnAuthorizationPage.
  319 |   // add-response-for-quote.tsx re-fetches the source RFQ by id (route state's
  320 |   // requestForQuoteData.id -> fetchRequestForQuoteId) and spreads the ENTIRE source RFQ object
  321 |   // into the response form (form.tsx's own reset({ rfq_response: { ...data, id: null } })) -
  322 |   // Vendor/Currency/Company/Purchase Representative/Narration/Items all arrive pre-filled from
  323 |   // that fresh fetch. Two things are NOT safe to leave as-is though: Date carries over the source
  324 |   // RFQ's own (now-past) date and must be reset via setDateToToday(), and Payment Terms is a
  325 |   // required field (Yup-enforced) that is NEVER pre-filled from the source RFQ at all - Save
  326 |   // fails validation without it.
  327 |   //
  328 |   // No URL/route param identifies which RFQ this is for (route: `.../request-for-quote/
  329 |   // add-response`, no id segment) - the page reads it purely from React Router location.state,
  330 |   // which only gets set by createResponse()'s own in-app click navigation above. A bare
  331 |   // page.goto() to this URL would redirect straight back to the RFQ list (source-confirmed), so
  332 |   // this method only waits for the navigation createResponse() already triggered - it doesn't (and
  333 |   // can't) navigate here directly itself.
  334 |   async waitForResponseFormReady() {
  335 |     await this.page.waitForURL(/\/request-for-quote\/add-response/);
  336 |     await this.page.getByRole('textbox', { name: 'Select Date' }).first().waitFor({ state: 'visible', timeout: 15000 });
  337 |   }
  338 |
  339 |   // Payment Terms' exact live option text in this account is unverified, so pick whichever
  340 |   // renders first rather than guessing a literal string (same approach PurchaseOrderPage takes
  341 |   // for its own unverified required fields) unless a caller explicitly needs a specific value.
  342 |   async selectResponsePaymentTerms(paymentTermName) {
  343 |     if (paymentTermName) {
  344 |       await this.selectFieldByLabel('Payment Terms *', paymentTermName);
  345 |     } else {
  346 |       await this.selectFirstOptionByLabel('Payment Terms *');
  347 |     }
  348 |   }
  349 |
  350 |   // Item/Vendor Item Name/Purchase Order/Requested Quantity/Estimated Quantity Per Year/
  351 |   // Description are all disabled, pre-filled read-only fields on this modal (response's own
  352 |   // item-entry-modal.tsx) - Rate is the one field genuinely required (Yup-enforced) and left
  353 |   // blank by the source-RFQ copy, so it's the only one that actually needs filling for Save to
  354 |   // pass item validation.
  355 |   async editResponseItemRate(rate) {
> 356 |     await this.page.locator('table tbody tr').first().locator('button').first().click();
      |                                                                                 ^ Error: locator.click: Test timeout of 90000ms exceeded.
  357 |     const modal = this.page.getByRole('dialog');
  358 |     await modal.waitFor({ state: 'visible', timeout: 10000 });
  359 |     await modal.locator('text=Rate').locator('xpath=following::input[1]').fill(rate);
  360 |     await modal.getByRole('button', { name: 'Save', exact: true }).click();
  361 |     await expect(modal).not.toBeVisible();
  362 |   }
  363 |
  364 |   // Response has a single Save action (no Draft concept reachable from the FE, source-confirmed:
  365 |   // no "Save as Draft" button anywhere in this form) - posts to `/v1/rfq/:id/response`, which also
  366 |   // flips the PARENT RFQ's own status to "Response Received" server-side (only from Open/RFQ
  367 |   // Sent, source-confirmed in rfq-response.service.js). Callers verify that flip via
  368 |   // gotoView(sourceRfqId) rather than this page's own view-response page, which (like the
  369 |   // Responses listing) also depends on React Router location.state and isn't reliably
  370 |   // deep-linkable the same way gotoView's plain id-based URL is.
  371 |   async saveResponse() {
  372 |     await Promise.all([
  373 |       this.page.waitForResponse((r) => r.request().method() === 'POST' && /\/rfq\/\d+\/response/.test(r.url())),
  374 |       this.page.getByRole('button', { name: 'Save', exact: true }).click(),
  375 |     ]);
  376 |     await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  377 |   }
  378 |
  379 |   // ---------- Module-level business method ----------
  380 |   // Matches the spec file's own local createDraftRfq() helper body exactly.
  381 |   async createDraft(data) {
  382 |     await this.gotoAdd();
  383 |     await this.fillBasicDetails({
  384 |       vendor: data.vendor,
  385 |       purchaseRepresentative: data.purchaseRepresentative,
  386 |       narration: data.narration,
  387 |     });
  388 |     // Optional field - only present on testData entries that explicitly opt into it (see
  389 |     // testData.rfq.valid.location's own comment).
  390 |     if (data.location) {
  391 |       await this.selectLocation(data.location);
  392 |     }
  393 |     await this.fillAddressContact({
  394 |       contactPerson: data.contactPerson,
  395 |       shippingAddress: data.shippingAddress,
  396 |       vendorAddress: data.vendorAddress,
  397 |     });
  398 |     await this.addItem({ itemName: data.itemName, requestedQuantity: data.requestedQuantity });
  399 |     return this.saveAsDraft();
  400 |   }
  401 | }
  402 |
  403 | module.exports = RfqPage;
  404 |
```

Test: TC-RFQ-L01 [+] Search/filter the list

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> Listing Page >> TC-RFQ-L01 [+] Search/filter the list
- Location: tests/procurement/03-rfq.spec.js:394:5

# Error details

```
TypeError: Cannot read properties of undefined (reading 'seriesNumber')
```

# Page snapshot

```yaml
- generic [ref=e4]:
    - banner [ref=e5]:
        - generic [ref=e7]:
            - button "Switch module" [ref=e8] [cursor=pointer]:
                - img [ref=e9]
            - button "Go back" [ref=e20] [cursor=pointer]:
                - img [ref=e21]
            - navigation [ref=e23]:
                - button "Procurement" [ref=e24] [cursor=pointer]:
                    - generic [ref=e26]: Procurement
                - img [ref=e27]
                - img [ref=e29]
            - button "notifications" [ref=e33] [cursor=pointer]:
                - generic [ref=e34]:
                    - img [ref=e35]
                    - generic: "0"
            - button "D Dipen Modi Admin" [ref=e39] [cursor=pointer]:
                - generic [ref=e41]: D
                - generic [ref=e42]:
                    - generic [ref=e43]: Dipen Modi
                    - generic [ref=e44]: Admin
    - generic [ref=e47]:
        - img "favicon" [ref=e50] [cursor=pointer]
        - button [ref=e52] [cursor=pointer]:
            - img [ref=e53]
        - list [ref=e57]:
            - listitem "Dashboard" [ref=e58]:
                - button [ref=e59] [cursor=pointer]:
                    - img [ref=e61]
            - listitem "Requests" [ref=e65]:
                - button [ref=e66] [cursor=pointer]:
                    - img [ref=e68]
            - listitem "Purchase Agreements" [ref=e76]:
                - button [ref=e77] [cursor=pointer]:
                    - img [ref=e79]
            - listitem "Orders" [ref=e87]:
                - button [ref=e88] [cursor=pointer]:
                    - img [ref=e90]
            - listitem "Reports" [ref=e96]:
                - button [ref=e97] [cursor=pointer]:
                    - img [ref=e99]
            - listitem "Settings" [ref=e102]:
                - button [ref=e103] [cursor=pointer]:
                    - img [ref=e105]
    - button [ref=e110] [cursor=pointer]:
        - img [ref=e111]
    - main [ref=e113]:
        - generic [ref=e114]:
            - generic [ref=e116]:
                - generic [ref=e117]:
                    - paragraph [ref=e118]: Request for Quote
                    - generic [ref=e119]:
                        - generic [ref=e120] [cursor=pointer]:
                            - img [ref=e121]
                            - paragraph [ref=e124]: Table View
                        - generic [ref=e126]:
                            - text: "|"
                            - button "View" [ref=e127] [cursor=pointer]:
                                - img [ref=e129]
                                - text: View
                - generic [ref=e131]:
                    - button [ref=e132] [cursor=pointer]:
                        - img [ref=e133]
                    - button [ref=e136] [cursor=pointer]:
                        - img [ref=e137]
                    - button "Add" [ref=e140] [cursor=pointer]:
                        - img [ref=e142]
                        - text: Add
                    - button "More Icon" [ref=e144] [cursor=pointer]:
                        - img "More Icon" [ref=e145]
            - generic [ref=e148]:
                - progressbar "No records to display" [ref=e150]:
                    - img [ref=e151]
                - table [ref=e153]:
                    - rowgroup [ref=e154]:
                        - row "Arrow Icon Toggle select all ID 0 Date 0 Reference No. 0 Vendor Item Name Status 0" [ref=e155]:
                            - columnheader "Arrow Icon" [ref=e156]:
                                - generic [ref=e157]:
                                    - button "Arrow Icon" [ref=e160] [cursor=pointer]:
                                        - img "Arrow Icon" [ref=e161]
                                    - separator [ref=e163]
                            - columnheader "Toggle select all" [ref=e164]:
                                - generic [ref=e167]:
                                    - generic "Toggle select all":
                                        - checkbox "Toggle select all" [disabled]
                                        - img
                            - columnheader "ID 0" [ref=e168]:
                                - generic [ref=e169]:
                                    - generic [ref=e170] [cursor=pointer]:
                                        - generic [ref=e172]: ID
                                        - generic [ref=e173]:
                                            - button [ref=e174]:
                                                - img [ref=e175]
                                            - generic: "0"
                                    - separator [ref=e179]
                            - columnheader "Date 0" [ref=e180]:
                                - generic [ref=e181]:
                                    - generic [ref=e182] [cursor=pointer]:
                                        - generic [ref=e184]: Date
                                        - generic [ref=e185]:
                                            - button [ref=e186]:
                                                - img [ref=e187]
                                            - generic: "0"
                                    - separator [ref=e191]
                            - columnheader "Reference No. 0" [ref=e192]:
                                - generic [ref=e193]:
                                    - generic [ref=e194] [cursor=pointer]:
                                        - generic [ref=e196]: Reference No.
                                        - generic [ref=e197]:
                                            - button [ref=e198]:
                                                - img [ref=e199]
                                            - generic: "0"
                                    - separator [ref=e203]
                            - columnheader "Vendor Item Name" [ref=e204]:
                                - generic [ref=e205]:
                                    - generic [ref=e208]: Vendor Item Name
                                    - separator [ref=e210]
                            - columnheader "Status 0" [ref=e211]:
                                - generic [ref=e212]:
                                    - generic [ref=e213] [cursor=pointer]:
                                        - generic [ref=e215]: Status
                                        - generic [ref=e216]:
                                            - button [ref=e217]:
                                                - img [ref=e218]
                                            - generic: "0"
                                    - separator [ref=e222]
                    - rowgroup [ref=e223]:
                        - row [ref=e224] [cursor=pointer]:
                            - cell [ref=e225]
                            - cell [ref=e227]
                            - cell [ref=e229]
                            - cell [ref=e231]
                            - cell [ref=e233]
                            - cell [ref=e235]
                            - cell [ref=e237]
                        - row [ref=e239] [cursor=pointer]:
                            - cell [ref=e240]
                            - cell [ref=e242]
                            - cell [ref=e244]
                            - cell [ref=e246]
                            - cell [ref=e248]
                            - cell [ref=e250]
                            - cell [ref=e252]
                        - row [ref=e254] [cursor=pointer]:
                            - cell [ref=e255]
                            - cell [ref=e257]
                            - cell [ref=e259]
                            - cell [ref=e261]
                            - cell [ref=e263]
                            - cell [ref=e265]
                            - cell [ref=e267]
                        - row [ref=e269] [cursor=pointer]:
                            - cell [ref=e270]
                            - cell [ref=e272]
                            - cell [ref=e274]
                            - cell [ref=e276]
                            - cell [ref=e278]
                            - cell [ref=e280]
                            - cell [ref=e282]
                        - row [ref=e284] [cursor=pointer]:
                            - cell [ref=e285]
                            - cell [ref=e287]
                            - cell [ref=e289]
                            - cell [ref=e291]
                            - cell [ref=e293]
                            - cell [ref=e295]
                            - cell [ref=e297]
                        - row [ref=e299] [cursor=pointer]:
                            - cell [ref=e300]
                            - cell [ref=e302]
                            - cell [ref=e304]
                            - cell [ref=e306]
                            - cell [ref=e308]
                            - cell [ref=e310]
                            - cell [ref=e312]
                        - row [ref=e314] [cursor=pointer]:
                            - cell [ref=e315]
                            - cell [ref=e317]
                            - cell [ref=e319]
                            - cell [ref=e321]
                            - cell [ref=e323]
                            - cell [ref=e325]
                            - cell [ref=e327]
                        - row [ref=e329] [cursor=pointer]:
                            - cell [ref=e330]
                            - cell [ref=e332]
                            - cell [ref=e334]
                            - cell [ref=e336]
                            - cell [ref=e338]
                            - cell [ref=e340]
                            - cell [ref=e342]
                        - row [ref=e344] [cursor=pointer]:
                            - cell [ref=e345]
                            - cell [ref=e347]
                            - cell [ref=e349]
                            - cell [ref=e351]
                            - cell [ref=e353]
                            - cell [ref=e355]
                            - cell [ref=e357]
                        - row [ref=e359] [cursor=pointer]:
                            - cell [ref=e360]
                            - cell [ref=e362]
                            - cell [ref=e364]
                            - cell [ref=e366]
                            - cell [ref=e368]
                            - cell [ref=e370]
                            - cell [ref=e372]
                    - rowgroup [ref=e374]:
                        - row "+ Add Calculation + Add Calculation + Add Calculation + Add Calculation + Add Calculation" [ref=e375]:
                            - cell [ref=e376]
                            - cell [ref=e377]
                            - cell "+ Add Calculation" [ref=e378]:
                                - paragraph [ref=e379] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e380]:
                                - paragraph [ref=e381] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e382]:
                                - paragraph [ref=e383] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e384]:
                                - paragraph [ref=e385] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e386]:
                                - paragraph [ref=e387] [cursor=pointer]: + Add Calculation
            - generic [ref=e388]:
                - generic [ref=e389]:
                    - generic [ref=e390]:
                        - button [ref=e391] [cursor=pointer]:
                            - img [ref=e392]
                        - tablist "basic tabs example" [ref=e397]:
                            - tab "The 'Default' page has been successfully created, complete with your saved filters, sorting options, and views." [selected] [ref=e398] [cursor=pointer]:
                                - generic "The 'Default' page has been successfully created, complete with your saved filters, sorting options, and views." [ref=e399]:
                                    - generic [ref=e400]: Default
                                - button [ref=e401]:
                                    - img [ref=e402]
                        - separator [ref=e404]
                        - button [ref=e406] [cursor=pointer]:
                            - img [ref=e407]
                    - generic [ref=e409]:
                        - button "Save" [disabled]:
                            - text: Save
                            - generic:
                                - img
                - generic [ref=e411]:
                    - paragraph [ref=e412]: "Items per page :"
                    - generic [ref=e413]:
                        - combobox [ref=e414] [cursor=pointer]: "20"
                        - textbox: "20"
                        - img
                        - group
                    - paragraph [ref=e415]: "Go To :"
                    - generic [ref=e417]:
                        - spinbutton [ref=e418]
                        - group
                    - button [disabled]:
                        - img
                    - paragraph [ref=e419]: Page
                    - paragraph [ref=e420]: "1"
                    - paragraph [ref=e421]: of
                    - paragraph [ref=e422]: "1"
                    - button [ref=e423] [cursor=pointer]:
                        - img [ref=e424]
```

# Test source

```ts
  298 |       // Saving a Response automatically flips the PARENT RFQ's own status to "Response Received"
  299 |       // (source-confirmed, rfq-response.service.js - only from Open/RFQ Sent).
  300 |       await rfq.gotoView(sourceRfq.id);
  301 |       await expect(page.getByText('Response Received', { exact: true })).toBeVisible();
  302 |     });
  303 |
  304 |     test('TC-RFQ-16 [-] Save is blocked when Payment Terms/Rate are left empty', async ({
  305 |       page,
  306 |     }) => {
  307 |       const rfq = new RfqPage(page);
  308 |       const data = testData.rfq.valid;
  309 |
  310 |       await rfq.gotoAdd();
  311 |       await rfq.fillBasicDetails({
  312 |         vendor: data.vendor,
  313 |         purchaseRepresentative: data.purchaseRepresentative,
  314 |         narration: 'TC-RFQ-16 response validation check',
  315 |       });
  316 |       await rfq.fillAddressContact({
  317 |         contactPerson: data.contactPerson,
  318 |         shippingAddress: data.shippingAddress,
  319 |         vendorAddress: data.vendorAddress,
  320 |       });
  321 |       await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });
  322 |
  323 |       const sourceRfq = await rfq.save();
  324 |       await rfq.gotoView(sourceRfq.id);
  325 |       await rfq.createResponse();
  326 |       await rfq.waitForResponseFormReady();
  327 |       await rfq.setDateToToday();
  328 |
  329 |       // Neither Payment Terms nor the item's Rate is filled in - Save is expected to be blocked
  330 |       // by required-field validation rather than silently creating a Response with no rate.
  331 |       await page.getByRole('button', { name: 'Save', exact: true }).click();
  332 |       await expect(page).toHaveURL(/\/request-for-quote\/add-response/);
  333 |     });
  334 |   });
  335 |
  336 |   // ── TC-RFQ-V01: Required Vendor validation ─────────────────────────────────
  337 |   test('TC-RFQ-V01 [-] Required Vendor left empty blocks save', async ({ page }) => {
  338 |     const rfq = new RfqPage(page);
  339 |     await rfq.gotoAdd();
  340 |
  341 |     // Try to save without filling Vendor (required field).
  342 |     await page.getByRole('button', { name: 'Save', exact: true }).click();
  343 |
  344 |     // Validation should block save - page should NOT navigate away.
  345 |     await expect(page).toHaveURL(/add-request-for-quote/);
  346 |   });
  347 |
  348 |   // ── TC-RFQ-V02: Required fields inline errors ──────────────────────────────
  349 |   test('TC-RFQ-V02 [-] Required fields show inline error and block save', async ({ page }) => {
  350 |     const rfq = new RfqPage(page);
  351 |     await rfq.gotoAdd();
  352 |
  353 |     // Fill ONLY the narration (not Vendor, not Company, not Currency - all required).
  354 |     await page.getByPlaceholder('Enter Narration').fill('Validation test narration');
  355 |     await page.getByRole('button', { name: 'Save', exact: true }).click();
  356 |
  357 |     // Validation errors should prevent navigation.
  358 |     await expect(page).toHaveURL(/add-request-for-quote/);
  359 |
  360 |     // At least one inline error message should be visible.
  361 |     await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 5000 });
  362 |   });
  363 |
  364 |   // ── TC-RFQ-V03: Known gap - Requested Quantity has no positive-value rule ──
  365 |   test('TC-RFQ-V03 [-] Known gap: Requested Quantity accepts zero/negative values', async ({ page }) => {
  366 |     // generateItemValiadtionSchema() in the RFQ item modal's validator only checks item_id/
  367 |     // vendor_name/uom_id - requested_quantity has no Yup rule and no HTML min= constraint, so
  368 |     // 0/negative values are never rejected (confirmed via source read, not live - see the
  369 |     // migration notes/memory for why this suite can't drive a full live run in this pass).
  370 |     // Track the gap rather than silently asserting the (missing) validation as if it existed.
  371 |     test.fail(true, 'Known gap: Requested Quantity has no positive-value validation rule.');
  372 |
  373 |     const rfq  = new RfqPage(page);
  374 |     const data = testData.rfq.valid;
  375 |
  376 |     await rfq.gotoAdd();
  377 |     await rfq.fillBasicDetails({
  378 |       vendor:                 data.vendor,
  379 |       purchaseRepresentative: data.purchaseRepresentative,
  380 |       narration:              'TC-RFQ-V03 zero-quantity validation check',
  381 |     });
  382 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  383 |     await rfq.addItem({ itemName: data.itemName, requestedQuantity: '0' });
  384 |     await rfq.saveAsDraft();
  385 |
  386 |     // Expected (currently failing) behavior: a validation error should have blocked the save.
  387 |     await expect(page.getByText(/greater than 0|must be positive/i).first()).toBeVisible({ timeout: 5000 });
  388 |   });
  389 |
  390 |   // ── Listing Page (TC-RFQ-L01 - TC-RFQ-L05) ─────────────────────────────────
  391 |   // Reuses records already created/status-transitioned by the lifecycle tests above
  392 |   // (editRfq=Draft, approvedRfq=Open, createdRfq=Cancelled after TC-RFQ-05).
  393 |   test.describe('Listing Page', () => {
  394 |     test('TC-RFQ-L01 [+] Search/filter the list', async ({ page }) => {
  395 |       const rfq = new RfqPage(page);
  396 |       await rfq.gotoList();
  397 |
> 398 |       await rfq.searchList(editRfq.seriesNumber);
      |                                    ^ TypeError: Cannot read properties of undefined (reading 'seriesNumber')
  399 |       await expect(rfq.rowBySeriesNumber(editRfq.seriesNumber)).toBeVisible();
  400 |
  401 |       await rfq.searchList('no-such-rfq-zzz-999');
  402 |       await expect(rfq.noDataRow()).toBeVisible();
  403 |       await expect(page.locator('table tbody tr').filter({ has: page.locator('a') })).toHaveCount(0);
  404 |
  405 |       await rfq.clearSearch();
  406 |     });
  407 |
  408 |     test('TC-RFQ-L02 [+] Sort a column ascending/descending', async ({ page }) => {
  409 |       const rfq = new RfqPage(page);
  410 |       await rfq.gotoList();
  411 |
  412 |       const initialSort = await rfq.getColumnAriaSort('Date');
  413 |       expect(initialSort).toBe('none');
  414 |
  415 |       await rfq.clickColumnHeader('Date');
  416 |       const afterFirstClick = await rfq.getColumnAriaSort('Date');
  417 |       expect(['ascending', 'descending']).toContain(afterFirstClick);
  418 |
  419 |       await rfq.clickColumnHeader('Date');
  420 |       const afterSecondClick = await rfq.getColumnAriaSort('Date');
  421 |       expect(afterSecondClick).not.toBe(afterFirstClick);
  422 |       expect(['ascending', 'descending']).toContain(afterSecondClick);
  423 |     });
  424 |
  425 |     test('TC-RFQ-L03 [+] Paginate between pages', async ({ page }) => {
  426 |       const rfq = new RfqPage(page);
  427 |       await rfq.gotoList();
  428 |
  429 |       await expect(rfq.prevPageButton()).toBeDisabled();
  430 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);
  431 |
  432 |       await rfq.nextPageButton().click();
  433 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  434 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
  435 |       await expect(rfq.prevPageButton()).toBeEnabled();
  436 |
  437 |       await rfq.prevPageButton().click();
  438 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  439 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);
  440 |
  441 |       await rfq.goToPage(2);
  442 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  443 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
  444 |     });
  445 |
  446 |     // Unlike Procurement Request/Purchase Agreement, RFQ's row action menu is NOT status-gated
  447 |     // at all - Edit/Duplicate/Delete are only gated by canEdit/canAdd/canDelete permissions
  448 |     // (confirmed via source read: request-for-quote.tsx's rowActionMenu never checks `status`).
  449 |     test('TC-RFQ-L04 [+] Row action menu is permission-gated only, not status-gated', async ({ page }) => {
  450 |       const rfq = new RfqPage(page);
  451 |       await rfq.gotoList();
  452 |
  453 |       await rfq.searchList(editRfq.seriesNumber); // Draft
  454 |       expect(await rfq.isRowActionDisabled(editRfq.seriesNumber, 'Edit')).toBe(false);
  455 |
  456 |       await rfq.searchList(createdRfq.seriesNumber); // Cancelled
  457 |       expect(await rfq.isRowActionDisabled(createdRfq.seriesNumber, 'Edit')).toBe(false);
  458 |
  459 |       await rfq.clearSearch();
  460 |     });
  461 |
  462 |     test('TC-RFQ-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
  463 |       const rfq = new RfqPage(page);
  464 |       await rfq.gotoList();
  465 |
  466 |       expect(await rfq.getRowStatus(editRfq.seriesNumber)).toContain('Draft');
  467 |       expect(await rfq.getRowStatus(approvedRfq.seriesNumber)).toContain('Open');
  468 |       expect(await rfq.getRowStatus(createdRfq.seriesNumber)).toContain('Cancelled');
  469 |     });
  470 |   });
  471 |
  472 |   // ── TC-RFQ-14: Known gap - Delete is not blocked for non-Draft records ─────
  473 |   test('TC-RFQ-14 [-] Known gap: Deleting a non-Draft (Cancelled) RFQ is not blocked', async ({ page }) => {
  474 |     // Same class of gap already documented on the sibling Procurement Request/Purchase
  475 |     // Agreement pages (TC-PREQ-14, TC-PAGR-11): showDeletBtnAction in header-buttons.tsx lists
  476 |     // nearly every status (including Cancelled), and there's no additional status check inside
  477 |     // the delete handler - the View page's Actions menu Delete item shows up and is clickable
  478 |     // regardless of lifecycle state, gated only by the canDelete permission.
  479 |     test.fail(true, 'Known gap: View page Actions menu allows deleting a Cancelled RFQ.');
  480 |
  481 |     const rfq = new RfqPage(page);
  482 |     await rfq.gotoView(createdRfq.id); // Cancelled, via TC-RFQ-05
  483 |     await page.getByRole('button', { name: 'Actions' }).click();
  484 |     await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  485 |   });
  486 |
  487 | });
  488 |
```

Test: TC-RFQ-L04 [+] Row action menu is permission-gated only, not status-gated

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> Listing Page >> TC-RFQ-L04 [+] Row action menu is permission-gated only, not status-gated
- Location: tests/procurement/03-rfq.spec.js:449:5

# Error details

```
TypeError: Cannot read properties of undefined (reading 'seriesNumber')
```

# Page snapshot

```yaml
- generic [ref=e4]:
    - banner [ref=e5]:
        - generic [ref=e7]:
            - button "Switch module" [ref=e8] [cursor=pointer]:
                - img [ref=e9]
            - button "Go back" [ref=e20] [cursor=pointer]:
                - img [ref=e21]
            - navigation [ref=e23]:
                - button "Procurement" [ref=e24] [cursor=pointer]:
                    - generic [ref=e26]: Procurement
                - img [ref=e27]
                - img [ref=e29]
            - button "notifications" [ref=e33] [cursor=pointer]:
                - generic [ref=e34]:
                    - img [ref=e35]
                    - generic: "0"
            - button "D Dipen Modi Admin" [ref=e39] [cursor=pointer]:
                - generic [ref=e41]: D
                - generic [ref=e42]:
                    - generic [ref=e43]: Dipen Modi
                    - generic [ref=e44]: Admin
    - generic [ref=e47]:
        - img "favicon" [ref=e50] [cursor=pointer]
        - button [ref=e52] [cursor=pointer]:
            - img [ref=e53]
        - list [ref=e57]:
            - listitem "Dashboard" [ref=e58]:
                - button [ref=e59] [cursor=pointer]:
                    - img [ref=e61]
            - listitem "Requests" [ref=e65]:
                - button [ref=e66] [cursor=pointer]:
                    - img [ref=e68]
            - listitem "Purchase Agreements" [ref=e76]:
                - button [ref=e77] [cursor=pointer]:
                    - img [ref=e79]
            - listitem "Orders" [ref=e87]:
                - button [ref=e88] [cursor=pointer]:
                    - img [ref=e90]
            - listitem "Reports" [ref=e96]:
                - button [ref=e97] [cursor=pointer]:
                    - img [ref=e99]
            - listitem "Settings" [ref=e102]:
                - button [ref=e103] [cursor=pointer]:
                    - img [ref=e105]
    - button [ref=e110] [cursor=pointer]:
        - img [ref=e111]
    - main [ref=e113]:
        - generic [ref=e114]:
            - generic [ref=e116]:
                - generic [ref=e117]:
                    - paragraph [ref=e118]: Request for Quote
                    - generic [ref=e119]:
                        - generic [ref=e120] [cursor=pointer]:
                            - img [ref=e121]
                            - paragraph [ref=e124]: Table View
                        - generic [ref=e126]:
                            - text: "|"
                            - button "View" [ref=e127] [cursor=pointer]:
                                - img [ref=e129]
                                - text: View
                - generic [ref=e131]:
                    - button [ref=e132] [cursor=pointer]:
                        - img [ref=e133]
                    - button [ref=e136] [cursor=pointer]:
                        - img [ref=e137]
                    - button "Add" [ref=e140] [cursor=pointer]:
                        - img [ref=e142]
                        - text: Add
                    - button "More Icon" [ref=e144] [cursor=pointer]:
                        - img "More Icon" [ref=e145]
            - generic [ref=e148]:
                - progressbar "No records to display" [ref=e150]:
                    - img [ref=e151]
                - table [ref=e153]:
                    - rowgroup [ref=e154]:
                        - row "Arrow Icon Toggle select all ID 0 Date 0 Reference No. 0 Vendor Item Name Status 0" [ref=e155]:
                            - columnheader "Arrow Icon" [ref=e156]:
                                - generic [ref=e157]:
                                    - button "Arrow Icon" [ref=e160] [cursor=pointer]:
                                        - img "Arrow Icon" [ref=e161]
                                    - separator [ref=e163]
                            - columnheader "Toggle select all" [ref=e164]:
                                - generic [ref=e167]:
                                    - generic "Toggle select all":
                                        - checkbox "Toggle select all" [disabled]
                                        - img
                            - columnheader "ID 0" [ref=e168]:
                                - generic [ref=e169]:
                                    - generic [ref=e170] [cursor=pointer]:
                                        - generic [ref=e172]: ID
                                        - generic [ref=e173]:
                                            - button [ref=e174]:
                                                - img [ref=e175]
                                            - generic: "0"
                                    - separator [ref=e179]
                            - columnheader "Date 0" [ref=e180]:
                                - generic [ref=e181]:
                                    - generic [ref=e182] [cursor=pointer]:
                                        - generic [ref=e184]: Date
                                        - generic [ref=e185]:
                                            - button [ref=e186]:
                                                - img [ref=e187]
                                            - generic: "0"
                                    - separator [ref=e191]
                            - columnheader "Reference No. 0" [ref=e192]:
                                - generic [ref=e193]:
                                    - generic [ref=e194] [cursor=pointer]:
                                        - generic [ref=e196]: Reference No.
                                        - generic [ref=e197]:
                                            - button [ref=e198]:
                                                - img [ref=e199]
                                            - generic: "0"
                                    - separator [ref=e203]
                            - columnheader "Vendor Item Name" [ref=e204]:
                                - generic [ref=e205]:
                                    - generic [ref=e208]: Vendor Item Name
                                    - separator [ref=e210]
                            - columnheader "Status 0" [ref=e211]:
                                - generic [ref=e212]:
                                    - generic [ref=e213] [cursor=pointer]:
                                        - generic [ref=e215]: Status
                                        - generic [ref=e216]:
                                            - button [ref=e217]:
                                                - img [ref=e218]
                                            - generic: "0"
                                    - separator [ref=e222]
                    - rowgroup [ref=e223]:
                        - row [ref=e224] [cursor=pointer]:
                            - cell [ref=e225]
                            - cell [ref=e227]
                            - cell [ref=e229]
                            - cell [ref=e231]
                            - cell [ref=e233]
                            - cell [ref=e235]
                            - cell [ref=e237]
                        - row [ref=e239] [cursor=pointer]:
                            - cell [ref=e240]
                            - cell [ref=e242]
                            - cell [ref=e244]
                            - cell [ref=e246]
                            - cell [ref=e248]
                            - cell [ref=e250]
                            - cell [ref=e252]
                        - row [ref=e254] [cursor=pointer]:
                            - cell [ref=e255]
                            - cell [ref=e257]
                            - cell [ref=e259]
                            - cell [ref=e261]
                            - cell [ref=e263]
                            - cell [ref=e265]
                            - cell [ref=e267]
                        - row [ref=e269] [cursor=pointer]:
                            - cell [ref=e270]
                            - cell [ref=e272]
                            - cell [ref=e274]
                            - cell [ref=e276]
                            - cell [ref=e278]
                            - cell [ref=e280]
                            - cell [ref=e282]
                        - row [ref=e284] [cursor=pointer]:
                            - cell [ref=e285]
                            - cell [ref=e287]
                            - cell [ref=e289]
                            - cell [ref=e291]
                            - cell [ref=e293]
                            - cell [ref=e295]
                            - cell [ref=e297]
                        - row [ref=e299] [cursor=pointer]:
                            - cell [ref=e300]
                            - cell [ref=e302]
                            - cell [ref=e304]
                            - cell [ref=e306]
                            - cell [ref=e308]
                            - cell [ref=e310]
                            - cell [ref=e312]
                        - row [ref=e314] [cursor=pointer]:
                            - cell [ref=e315]
                            - cell [ref=e317]
                            - cell [ref=e319]
                            - cell [ref=e321]
                            - cell [ref=e323]
                            - cell [ref=e325]
                            - cell [ref=e327]
                        - row [ref=e329] [cursor=pointer]:
                            - cell [ref=e330]
                            - cell [ref=e332]
                            - cell [ref=e334]
                            - cell [ref=e336]
                            - cell [ref=e338]
                            - cell [ref=e340]
                            - cell [ref=e342]
                        - row [ref=e344] [cursor=pointer]:
                            - cell [ref=e345]
                            - cell [ref=e347]
                            - cell [ref=e349]
                            - cell [ref=e351]
                            - cell [ref=e353]
                            - cell [ref=e355]
                            - cell [ref=e357]
                        - row [ref=e359] [cursor=pointer]:
                            - cell [ref=e360]
                            - cell [ref=e362]
                            - cell [ref=e364]
                            - cell [ref=e366]
                            - cell [ref=e368]
                            - cell [ref=e370]
                            - cell [ref=e372]
                    - rowgroup [ref=e374]:
                        - row "+ Add Calculation + Add Calculation + Add Calculation + Add Calculation + Add Calculation" [ref=e375]:
                            - cell [ref=e376]
                            - cell [ref=e377]
                            - cell "+ Add Calculation" [ref=e378]:
                                - paragraph [ref=e379] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e380]:
                                - paragraph [ref=e381] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e382]:
                                - paragraph [ref=e383] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e384]:
                                - paragraph [ref=e385] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e386]:
                                - paragraph [ref=e387] [cursor=pointer]: + Add Calculation
            - generic [ref=e388]:
                - generic [ref=e389]:
                    - generic [ref=e390]:
                        - button [ref=e391] [cursor=pointer]:
                            - img [ref=e392]
                        - tablist "basic tabs example" [ref=e397]:
                            - tab "The 'Default' page has been successfully created, complete with your saved filters, sorting options, and views." [selected] [ref=e398] [cursor=pointer]:
                                - generic "The 'Default' page has been successfully created, complete with your saved filters, sorting options, and views." [ref=e399]:
                                    - generic [ref=e400]: Default
                                - button [ref=e401]:
                                    - img [ref=e402]
                        - separator [ref=e404]
                        - button [ref=e406] [cursor=pointer]:
                            - img [ref=e407]
                    - generic [ref=e409]:
                        - button "Save" [disabled]:
                            - text: Save
                            - generic:
                                - img
                - generic [ref=e411]:
                    - paragraph [ref=e412]: "Items per page :"
                    - generic [ref=e413]:
                        - combobox [ref=e414] [cursor=pointer]: "20"
                        - textbox: "20"
                        - img
                        - group
                    - paragraph [ref=e415]: "Go To :"
                    - generic [ref=e417]:
                        - spinbutton [ref=e418]
                        - group
                    - button [disabled]:
                        - img
                    - paragraph [ref=e419]: Page
                    - paragraph [ref=e420]: "1"
                    - paragraph [ref=e421]: of
                    - paragraph [ref=e422]: "1"
                    - button [ref=e423] [cursor=pointer]:
                        - img [ref=e424]
```

# Test source

```ts
  353 |     // Fill ONLY the narration (not Vendor, not Company, not Currency - all required).
  354 |     await page.getByPlaceholder('Enter Narration').fill('Validation test narration');
  355 |     await page.getByRole('button', { name: 'Save', exact: true }).click();
  356 |
  357 |     // Validation errors should prevent navigation.
  358 |     await expect(page).toHaveURL(/add-request-for-quote/);
  359 |
  360 |     // At least one inline error message should be visible.
  361 |     await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 5000 });
  362 |   });
  363 |
  364 |   // ── TC-RFQ-V03: Known gap - Requested Quantity has no positive-value rule ──
  365 |   test('TC-RFQ-V03 [-] Known gap: Requested Quantity accepts zero/negative values', async ({ page }) => {
  366 |     // generateItemValiadtionSchema() in the RFQ item modal's validator only checks item_id/
  367 |     // vendor_name/uom_id - requested_quantity has no Yup rule and no HTML min= constraint, so
  368 |     // 0/negative values are never rejected (confirmed via source read, not live - see the
  369 |     // migration notes/memory for why this suite can't drive a full live run in this pass).
  370 |     // Track the gap rather than silently asserting the (missing) validation as if it existed.
  371 |     test.fail(true, 'Known gap: Requested Quantity has no positive-value validation rule.');
  372 |
  373 |     const rfq  = new RfqPage(page);
  374 |     const data = testData.rfq.valid;
  375 |
  376 |     await rfq.gotoAdd();
  377 |     await rfq.fillBasicDetails({
  378 |       vendor:                 data.vendor,
  379 |       purchaseRepresentative: data.purchaseRepresentative,
  380 |       narration:              'TC-RFQ-V03 zero-quantity validation check',
  381 |     });
  382 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  383 |     await rfq.addItem({ itemName: data.itemName, requestedQuantity: '0' });
  384 |     await rfq.saveAsDraft();
  385 |
  386 |     // Expected (currently failing) behavior: a validation error should have blocked the save.
  387 |     await expect(page.getByText(/greater than 0|must be positive/i).first()).toBeVisible({ timeout: 5000 });
  388 |   });
  389 |
  390 |   // ── Listing Page (TC-RFQ-L01 - TC-RFQ-L05) ─────────────────────────────────
  391 |   // Reuses records already created/status-transitioned by the lifecycle tests above
  392 |   // (editRfq=Draft, approvedRfq=Open, createdRfq=Cancelled after TC-RFQ-05).
  393 |   test.describe('Listing Page', () => {
  394 |     test('TC-RFQ-L01 [+] Search/filter the list', async ({ page }) => {
  395 |       const rfq = new RfqPage(page);
  396 |       await rfq.gotoList();
  397 |
  398 |       await rfq.searchList(editRfq.seriesNumber);
  399 |       await expect(rfq.rowBySeriesNumber(editRfq.seriesNumber)).toBeVisible();
  400 |
  401 |       await rfq.searchList('no-such-rfq-zzz-999');
  402 |       await expect(rfq.noDataRow()).toBeVisible();
  403 |       await expect(page.locator('table tbody tr').filter({ has: page.locator('a') })).toHaveCount(0);
  404 |
  405 |       await rfq.clearSearch();
  406 |     });
  407 |
  408 |     test('TC-RFQ-L02 [+] Sort a column ascending/descending', async ({ page }) => {
  409 |       const rfq = new RfqPage(page);
  410 |       await rfq.gotoList();
  411 |
  412 |       const initialSort = await rfq.getColumnAriaSort('Date');
  413 |       expect(initialSort).toBe('none');
  414 |
  415 |       await rfq.clickColumnHeader('Date');
  416 |       const afterFirstClick = await rfq.getColumnAriaSort('Date');
  417 |       expect(['ascending', 'descending']).toContain(afterFirstClick);
  418 |
  419 |       await rfq.clickColumnHeader('Date');
  420 |       const afterSecondClick = await rfq.getColumnAriaSort('Date');
  421 |       expect(afterSecondClick).not.toBe(afterFirstClick);
  422 |       expect(['ascending', 'descending']).toContain(afterSecondClick);
  423 |     });
  424 |
  425 |     test('TC-RFQ-L03 [+] Paginate between pages', async ({ page }) => {
  426 |       const rfq = new RfqPage(page);
  427 |       await rfq.gotoList();
  428 |
  429 |       await expect(rfq.prevPageButton()).toBeDisabled();
  430 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);
  431 |
  432 |       await rfq.nextPageButton().click();
  433 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  434 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
  435 |       await expect(rfq.prevPageButton()).toBeEnabled();
  436 |
  437 |       await rfq.prevPageButton().click();
  438 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  439 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);
  440 |
  441 |       await rfq.goToPage(2);
  442 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  443 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
  444 |     });
  445 |
  446 |     // Unlike Procurement Request/Purchase Agreement, RFQ's row action menu is NOT status-gated
  447 |     // at all - Edit/Duplicate/Delete are only gated by canEdit/canAdd/canDelete permissions
  448 |     // (confirmed via source read: request-for-quote.tsx's rowActionMenu never checks `status`).
  449 |     test('TC-RFQ-L04 [+] Row action menu is permission-gated only, not status-gated', async ({ page }) => {
  450 |       const rfq = new RfqPage(page);
  451 |       await rfq.gotoList();
  452 |
> 453 |       await rfq.searchList(editRfq.seriesNumber); // Draft
      |                                    ^ TypeError: Cannot read properties of undefined (reading 'seriesNumber')
  454 |       expect(await rfq.isRowActionDisabled(editRfq.seriesNumber, 'Edit')).toBe(false);
  455 |
  456 |       await rfq.searchList(createdRfq.seriesNumber); // Cancelled
  457 |       expect(await rfq.isRowActionDisabled(createdRfq.seriesNumber, 'Edit')).toBe(false);
  458 |
  459 |       await rfq.clearSearch();
  460 |     });
  461 |
  462 |     test('TC-RFQ-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
  463 |       const rfq = new RfqPage(page);
  464 |       await rfq.gotoList();
  465 |
  466 |       expect(await rfq.getRowStatus(editRfq.seriesNumber)).toContain('Draft');
  467 |       expect(await rfq.getRowStatus(approvedRfq.seriesNumber)).toContain('Open');
  468 |       expect(await rfq.getRowStatus(createdRfq.seriesNumber)).toContain('Cancelled');
  469 |     });
  470 |   });
  471 |
  472 |   // ── TC-RFQ-14: Known gap - Delete is not blocked for non-Draft records ─────
  473 |   test('TC-RFQ-14 [-] Known gap: Deleting a non-Draft (Cancelled) RFQ is not blocked', async ({ page }) => {
  474 |     // Same class of gap already documented on the sibling Procurement Request/Purchase
  475 |     // Agreement pages (TC-PREQ-14, TC-PAGR-11): showDeletBtnAction in header-buttons.tsx lists
  476 |     // nearly every status (including Cancelled), and there's no additional status check inside
  477 |     // the delete handler - the View page's Actions menu Delete item shows up and is clickable
  478 |     // regardless of lifecycle state, gated only by the canDelete permission.
  479 |     test.fail(true, 'Known gap: View page Actions menu allows deleting a Cancelled RFQ.');
  480 |
  481 |     const rfq = new RfqPage(page);
  482 |     await rfq.gotoView(createdRfq.id); // Cancelled, via TC-RFQ-05
  483 |     await page.getByRole('button', { name: 'Actions' }).click();
  484 |     await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  485 |   });
  486 |
  487 | });
  488 |
```

Test: TC-RFQ-L05 [+] Row status badge matches the record's lifecycle state

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: procurement/03-rfq.spec.js >> RFQ (Request for Quote) Management >> Listing Page >> TC-RFQ-L05 [+] Row status badge matches the record's lifecycle state
- Location: tests/procurement/03-rfq.spec.js:462:5

# Error details

```
TypeError: Cannot read properties of undefined (reading 'seriesNumber')
```

# Page snapshot

```yaml
- generic [ref=e4]:
    - banner [ref=e5]:
        - generic [ref=e7]:
            - button "Switch module" [ref=e8] [cursor=pointer]:
                - img [ref=e9]
            - button "Go back" [ref=e20] [cursor=pointer]:
                - img [ref=e21]
            - navigation [ref=e23]:
                - button "Procurement" [ref=e24] [cursor=pointer]:
                    - generic [ref=e26]: Procurement
                - img [ref=e27]
                - img [ref=e29]
            - button "notifications" [ref=e33] [cursor=pointer]:
                - generic [ref=e34]:
                    - img [ref=e35]
                    - generic: "0"
            - button "D Dipen Modi Admin" [ref=e39] [cursor=pointer]:
                - generic [ref=e41]: D
                - generic [ref=e42]:
                    - generic [ref=e43]: Dipen Modi
                    - generic [ref=e44]: Admin
    - generic [ref=e47]:
        - img "favicon" [ref=e50] [cursor=pointer]
        - button [ref=e52] [cursor=pointer]:
            - img [ref=e53]
        - list [ref=e57]:
            - listitem "Dashboard" [ref=e58]:
                - button [ref=e59] [cursor=pointer]:
                    - img [ref=e61]
            - listitem "Requests" [ref=e65]:
                - button [ref=e66] [cursor=pointer]:
                    - img [ref=e68]
            - listitem "Purchase Agreements" [ref=e76]:
                - button [ref=e77] [cursor=pointer]:
                    - img [ref=e79]
            - listitem "Orders" [ref=e87]:
                - button [ref=e88] [cursor=pointer]:
                    - img [ref=e90]
            - listitem "Reports" [ref=e96]:
                - button [ref=e97] [cursor=pointer]:
                    - img [ref=e99]
            - listitem "Settings" [ref=e102]:
                - button [ref=e103] [cursor=pointer]:
                    - img [ref=e105]
    - button [ref=e110] [cursor=pointer]:
        - img [ref=e111]
    - main [ref=e113]:
        - generic [ref=e114]:
            - generic [ref=e116]:
                - generic [ref=e117]:
                    - paragraph [ref=e118]: Request for Quote
                    - generic [ref=e119]:
                        - generic [ref=e120] [cursor=pointer]:
                            - img [ref=e121]
                            - paragraph [ref=e124]: Table View
                        - generic [ref=e126]:
                            - text: "|"
                            - button "View" [ref=e127] [cursor=pointer]:
                                - img [ref=e129]
                                - text: View
                - generic [ref=e131]:
                    - button [ref=e132] [cursor=pointer]:
                        - img [ref=e133]
                    - button [ref=e136] [cursor=pointer]:
                        - img [ref=e137]
                    - button "Add" [ref=e140] [cursor=pointer]:
                        - img [ref=e142]
                        - text: Add
                    - button "More Icon" [ref=e144] [cursor=pointer]:
                        - img "More Icon" [ref=e145]
            - generic [ref=e148]:
                - progressbar "No records to display" [ref=e150]:
                    - img [ref=e151]
                - table [ref=e153]:
                    - rowgroup [ref=e154]:
                        - row "Arrow Icon Toggle select all ID 0 Date 0 Reference No. 0 Vendor Item Name Status 0" [ref=e155]:
                            - columnheader "Arrow Icon" [ref=e156]:
                                - generic [ref=e157]:
                                    - button "Arrow Icon" [ref=e160] [cursor=pointer]:
                                        - img "Arrow Icon" [ref=e161]
                                    - separator [ref=e163]
                            - columnheader "Toggle select all" [ref=e164]:
                                - generic [ref=e167]:
                                    - generic "Toggle select all":
                                        - checkbox "Toggle select all" [disabled]
                                        - img
                            - columnheader "ID 0" [ref=e168]:
                                - generic [ref=e169]:
                                    - generic [ref=e170] [cursor=pointer]:
                                        - generic [ref=e172]: ID
                                        - generic [ref=e173]:
                                            - button [ref=e174]:
                                                - img [ref=e175]
                                            - generic: "0"
                                    - separator [ref=e179]
                            - columnheader "Date 0" [ref=e180]:
                                - generic [ref=e181]:
                                    - generic [ref=e182] [cursor=pointer]:
                                        - generic [ref=e184]: Date
                                        - generic [ref=e185]:
                                            - button [ref=e186]:
                                                - img [ref=e187]
                                            - generic: "0"
                                    - separator [ref=e191]
                            - columnheader "Reference No. 0" [ref=e192]:
                                - generic [ref=e193]:
                                    - generic [ref=e194] [cursor=pointer]:
                                        - generic [ref=e196]: Reference No.
                                        - generic [ref=e197]:
                                            - button [ref=e198]:
                                                - img [ref=e199]
                                            - generic: "0"
                                    - separator [ref=e203]
                            - columnheader "Vendor Item Name" [ref=e204]:
                                - generic [ref=e205]:
                                    - generic [ref=e208]: Vendor Item Name
                                    - separator [ref=e210]
                            - columnheader "Status 0" [ref=e211]:
                                - generic [ref=e212]:
                                    - generic [ref=e213] [cursor=pointer]:
                                        - generic [ref=e215]: Status
                                        - generic [ref=e216]:
                                            - button [ref=e217]:
                                                - img [ref=e218]
                                            - generic: "0"
                                    - separator [ref=e222]
                    - rowgroup [ref=e223]:
                        - row [ref=e224] [cursor=pointer]:
                            - cell [ref=e225]
                            - cell [ref=e227]
                            - cell [ref=e229]
                            - cell [ref=e231]
                            - cell [ref=e233]
                            - cell [ref=e235]
                            - cell [ref=e237]
                        - row [ref=e239] [cursor=pointer]:
                            - cell [ref=e240]
                            - cell [ref=e242]
                            - cell [ref=e244]
                            - cell [ref=e246]
                            - cell [ref=e248]
                            - cell [ref=e250]
                            - cell [ref=e252]
                        - row [ref=e254] [cursor=pointer]:
                            - cell [ref=e255]
                            - cell [ref=e257]
                            - cell [ref=e259]
                            - cell [ref=e261]
                            - cell [ref=e263]
                            - cell [ref=e265]
                            - cell [ref=e267]
                        - row [ref=e269] [cursor=pointer]:
                            - cell [ref=e270]
                            - cell [ref=e272]
                            - cell [ref=e274]
                            - cell [ref=e276]
                            - cell [ref=e278]
                            - cell [ref=e280]
                            - cell [ref=e282]
                        - row [ref=e284] [cursor=pointer]:
                            - cell [ref=e285]
                            - cell [ref=e287]
                            - cell [ref=e289]
                            - cell [ref=e291]
                            - cell [ref=e293]
                            - cell [ref=e295]
                            - cell [ref=e297]
                        - row [ref=e299] [cursor=pointer]:
                            - cell [ref=e300]
                            - cell [ref=e302]
                            - cell [ref=e304]
                            - cell [ref=e306]
                            - cell [ref=e308]
                            - cell [ref=e310]
                            - cell [ref=e312]
                        - row [ref=e314] [cursor=pointer]:
                            - cell [ref=e315]
                            - cell [ref=e317]
                            - cell [ref=e319]
                            - cell [ref=e321]
                            - cell [ref=e323]
                            - cell [ref=e325]
                            - cell [ref=e327]
                        - row [ref=e329] [cursor=pointer]:
                            - cell [ref=e330]
                            - cell [ref=e332]
                            - cell [ref=e334]
                            - cell [ref=e336]
                            - cell [ref=e338]
                            - cell [ref=e340]
                            - cell [ref=e342]
                        - row [ref=e344] [cursor=pointer]:
                            - cell [ref=e345]
                            - cell [ref=e347]
                            - cell [ref=e349]
                            - cell [ref=e351]
                            - cell [ref=e353]
                            - cell [ref=e355]
                            - cell [ref=e357]
                        - row [ref=e359] [cursor=pointer]:
                            - cell [ref=e360]
                            - cell [ref=e362]
                            - cell [ref=e364]
                            - cell [ref=e366]
                            - cell [ref=e368]
                            - cell [ref=e370]
                            - cell [ref=e372]
                    - rowgroup [ref=e374]:
                        - row "+ Add Calculation + Add Calculation + Add Calculation + Add Calculation + Add Calculation" [ref=e375]:
                            - cell [ref=e376]
                            - cell [ref=e377]
                            - cell "+ Add Calculation" [ref=e378]:
                                - paragraph [ref=e379] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e380]:
                                - paragraph [ref=e381] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e382]:
                                - paragraph [ref=e383] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e384]:
                                - paragraph [ref=e385] [cursor=pointer]: + Add Calculation
                            - cell "+ Add Calculation" [ref=e386]:
                                - paragraph [ref=e387] [cursor=pointer]: + Add Calculation
            - generic [ref=e388]:
                - generic [ref=e389]:
                    - generic [ref=e390]:
                        - button [ref=e391] [cursor=pointer]:
                            - img [ref=e392]
                        - tablist "basic tabs example" [ref=e397]:
                            - tab "The 'Default' page has been successfully created, complete with your saved filters, sorting options, and views." [selected] [ref=e398] [cursor=pointer]:
                                - generic "The 'Default' page has been successfully created, complete with your saved filters, sorting options, and views." [ref=e399]:
                                    - generic [ref=e400]: Default
                                - button [ref=e401]:
                                    - img [ref=e402]
                        - separator [ref=e404]
                        - button [ref=e406] [cursor=pointer]:
                            - img [ref=e407]
                    - generic [ref=e409]:
                        - button "Save" [disabled]:
                            - text: Save
                            - generic:
                                - img
                - generic [ref=e411]:
                    - paragraph [ref=e412]: "Items per page :"
                    - generic [ref=e413]:
                        - combobox [ref=e414] [cursor=pointer]: "20"
                        - textbox: "20"
                        - img
                        - group
                    - paragraph [ref=e415]: "Go To :"
                    - generic [ref=e417]:
                        - spinbutton [ref=e418]
                        - group
                    - button [disabled]:
                        - img
                    - paragraph [ref=e419]: Page
                    - paragraph [ref=e420]: "1"
                    - paragraph [ref=e421]: of
                    - paragraph [ref=e422]: "1"
                    - button [ref=e423] [cursor=pointer]:
                        - img [ref=e424]
```

# Test source

```ts
  366 |     // generateItemValiadtionSchema() in the RFQ item modal's validator only checks item_id/
  367 |     // vendor_name/uom_id - requested_quantity has no Yup rule and no HTML min= constraint, so
  368 |     // 0/negative values are never rejected (confirmed via source read, not live - see the
  369 |     // migration notes/memory for why this suite can't drive a full live run in this pass).
  370 |     // Track the gap rather than silently asserting the (missing) validation as if it existed.
  371 |     test.fail(true, 'Known gap: Requested Quantity has no positive-value validation rule.');
  372 |
  373 |     const rfq  = new RfqPage(page);
  374 |     const data = testData.rfq.valid;
  375 |
  376 |     await rfq.gotoAdd();
  377 |     await rfq.fillBasicDetails({
  378 |       vendor:                 data.vendor,
  379 |       purchaseRepresentative: data.purchaseRepresentative,
  380 |       narration:              'TC-RFQ-V03 zero-quantity validation check',
  381 |     });
  382 |     await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
  383 |     await rfq.addItem({ itemName: data.itemName, requestedQuantity: '0' });
  384 |     await rfq.saveAsDraft();
  385 |
  386 |     // Expected (currently failing) behavior: a validation error should have blocked the save.
  387 |     await expect(page.getByText(/greater than 0|must be positive/i).first()).toBeVisible({ timeout: 5000 });
  388 |   });
  389 |
  390 |   // ── Listing Page (TC-RFQ-L01 - TC-RFQ-L05) ─────────────────────────────────
  391 |   // Reuses records already created/status-transitioned by the lifecycle tests above
  392 |   // (editRfq=Draft, approvedRfq=Open, createdRfq=Cancelled after TC-RFQ-05).
  393 |   test.describe('Listing Page', () => {
  394 |     test('TC-RFQ-L01 [+] Search/filter the list', async ({ page }) => {
  395 |       const rfq = new RfqPage(page);
  396 |       await rfq.gotoList();
  397 |
  398 |       await rfq.searchList(editRfq.seriesNumber);
  399 |       await expect(rfq.rowBySeriesNumber(editRfq.seriesNumber)).toBeVisible();
  400 |
  401 |       await rfq.searchList('no-such-rfq-zzz-999');
  402 |       await expect(rfq.noDataRow()).toBeVisible();
  403 |       await expect(page.locator('table tbody tr').filter({ has: page.locator('a') })).toHaveCount(0);
  404 |
  405 |       await rfq.clearSearch();
  406 |     });
  407 |
  408 |     test('TC-RFQ-L02 [+] Sort a column ascending/descending', async ({ page }) => {
  409 |       const rfq = new RfqPage(page);
  410 |       await rfq.gotoList();
  411 |
  412 |       const initialSort = await rfq.getColumnAriaSort('Date');
  413 |       expect(initialSort).toBe('none');
  414 |
  415 |       await rfq.clickColumnHeader('Date');
  416 |       const afterFirstClick = await rfq.getColumnAriaSort('Date');
  417 |       expect(['ascending', 'descending']).toContain(afterFirstClick);
  418 |
  419 |       await rfq.clickColumnHeader('Date');
  420 |       const afterSecondClick = await rfq.getColumnAriaSort('Date');
  421 |       expect(afterSecondClick).not.toBe(afterFirstClick);
  422 |       expect(['ascending', 'descending']).toContain(afterSecondClick);
  423 |     });
  424 |
  425 |     test('TC-RFQ-L03 [+] Paginate between pages', async ({ page }) => {
  426 |       const rfq = new RfqPage(page);
  427 |       await rfq.gotoList();
  428 |
  429 |       await expect(rfq.prevPageButton()).toBeDisabled();
  430 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);
  431 |
  432 |       await rfq.nextPageButton().click();
  433 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  434 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
  435 |       await expect(rfq.prevPageButton()).toBeEnabled();
  436 |
  437 |       await rfq.prevPageButton().click();
  438 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  439 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);
  440 |
  441 |       await rfq.goToPage(2);
  442 |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  443 |       expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
  444 |     });
  445 |
  446 |     // Unlike Procurement Request/Purchase Agreement, RFQ's row action menu is NOT status-gated
  447 |     // at all - Edit/Duplicate/Delete are only gated by canEdit/canAdd/canDelete permissions
  448 |     // (confirmed via source read: request-for-quote.tsx's rowActionMenu never checks `status`).
  449 |     test('TC-RFQ-L04 [+] Row action menu is permission-gated only, not status-gated', async ({ page }) => {
  450 |       const rfq = new RfqPage(page);
  451 |       await rfq.gotoList();
  452 |
  453 |       await rfq.searchList(editRfq.seriesNumber); // Draft
  454 |       expect(await rfq.isRowActionDisabled(editRfq.seriesNumber, 'Edit')).toBe(false);
  455 |
  456 |       await rfq.searchList(createdRfq.seriesNumber); // Cancelled
  457 |       expect(await rfq.isRowActionDisabled(createdRfq.seriesNumber, 'Edit')).toBe(false);
  458 |
  459 |       await rfq.clearSearch();
  460 |     });
  461 |
  462 |     test('TC-RFQ-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
  463 |       const rfq = new RfqPage(page);
  464 |       await rfq.gotoList();
  465 |
> 466 |       expect(await rfq.getRowStatus(editRfq.seriesNumber)).toContain('Draft');
      |                                             ^ TypeError: Cannot read properties of undefined (reading 'seriesNumber')
  467 |       expect(await rfq.getRowStatus(approvedRfq.seriesNumber)).toContain('Open');
  468 |       expect(await rfq.getRowStatus(createdRfq.seriesNumber)).toContain('Cancelled');
  469 |     });
  470 |   });
  471 |
  472 |   // ── TC-RFQ-14: Known gap - Delete is not blocked for non-Draft records ─────
  473 |   test('TC-RFQ-14 [-] Known gap: Deleting a non-Draft (Cancelled) RFQ is not blocked', async ({ page }) => {
  474 |     // Same class of gap already documented on the sibling Procurement Request/Purchase
  475 |     // Agreement pages (TC-PREQ-14, TC-PAGR-11): showDeletBtnAction in header-buttons.tsx lists
  476 |     // nearly every status (including Cancelled), and there's no additional status check inside
  477 |     // the delete handler - the View page's Actions menu Delete item shows up and is clickable
  478 |     // regardless of lifecycle state, gated only by the canDelete permission.
  479 |     test.fail(true, 'Known gap: View page Actions menu allows deleting a Cancelled RFQ.');
  480 |
  481 |     const rfq = new RfqPage(page);
  482 |     await rfq.gotoView(createdRfq.id); // Cancelled, via TC-RFQ-05
  483 |     await page.getByRole('button', { name: 'Actions' }).click();
  484 |     await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  485 |   });
  486 |
  487 | });
  488 |
```
