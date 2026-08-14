// Generates a catalog of every regression test case straight from the spec files' own source -
// no live run involved (unlike reporters/excel-reporter.js, which only captures tests actually
// executed in a given `playwright test` invocation). Parses each `test('TC-<AREA>-<NN> [+|-] ...'`
// title using this repo's own "TC-<AREA>-<NN> [+|-|+/-] <description>" convention (see CLAUDE.md).
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const REGRESSION_DIR = path.join(__dirname, '..', 'tests', 'regression');
const OUTPUT_FILE = path.join(__dirname, '..', 'Regression_Test_Cases.xlsx');

const TYPE_LABELS = {
  '+': 'Positive',
  '-': 'Negative',
  '−': 'Negative',
  '+/-': 'Mixed',
};

function parseTitle(rawTitle) {
  const idMatch = rawTitle.match(/^(TC-[A-Z0-9]+-\d+)\s*/);
  const testCaseId = idMatch ? idMatch[1] : '';
  const rest = idMatch ? rawTitle.slice(idMatch[0].length) : rawTitle;

  const typeMatch = rest.match(/^\[([+\-−/]+)\]\s*/);
  const type = typeMatch ? (TYPE_LABELS[typeMatch[1]] || 'Positive') : 'Positive';
  const description = typeMatch ? rest.slice(typeMatch[0].length) : rest;

  return { testCaseId, type, description };
}

function extractTestsFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const specFile = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');

  const describeMatch = source.match(/test\.describe\(\s*['"]([^'"]+)['"]/);
  const moduleName = describeMatch ? describeMatch[1] : '';

  const rows = [];
  const testRegex = /(?<!\.)\btest\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = testRegex.exec(source)) !== null) {
    const rawTitle = match[1];
    const { testCaseId, type, description } = parseTitle(rawTitle);
    rows.push({
      module: moduleName,
      specFile,
      testCaseId,
      description: description || rawTitle,
      type,
    });
  }
  return rows;
}

async function main() {
  const files = fs.readdirSync(REGRESSION_DIR)
    .filter((f) => f.endsWith('.spec.js'))
    .sort()
    .map((f) => path.join(REGRESSION_DIR, f));

  const rows = files.flatMap(extractTestsFromFile);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Regression Test Cases');

  sheet.columns = [
    { header: 'Sl No', key: 'slNo', width: 6 },
    { header: 'Module', key: 'module', width: 28 },
    { header: 'Spec File', key: 'specFile', width: 36 },
    { header: 'Test Case ID', key: 'testCaseId', width: 14 },
    { header: 'Test Case Description', key: 'description', width: 90 },
    { header: 'Type', key: 'type', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((row, i) => sheet.addRow({ slNo: i + 1, ...row }));

  if (rows.length) {
    sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columns.length } };
  }

  await workbook.xlsx.writeFile(OUTPUT_FILE);
  console.log(`Regression catalog written: ${OUTPUT_FILE} (${rows.length} test cases)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
