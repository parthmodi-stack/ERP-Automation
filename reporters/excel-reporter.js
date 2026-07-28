const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { VIDEO_DIR } = require('../helpers/sharedContextVideo');

// Test titles follow this repo's "TC-<AREA>-<NN> [+|-|+/-] <description>"
// convention (see CLAUDE.md) - parse the id/type prefix back out of the
// title so the report doesn't need a hand-maintained list of test cases.
const TYPE_LABELS = {
  '+':   'Positive',
  '-':   'Negative',
  '−':   'Negative',
  '+/-': 'Mixed',
};

const STATUS_LABELS = {
  passed:      'Passed',
  failed:      'Failed',
  timedOut:    'Timed Out',
  skipped:     'Skipped',
  interrupted: 'Interrupted',
};

const STATUS_COLORS = {
  Passed:      'FF2E7D32',
  Failed:      'FFC62828',
  'Timed Out': 'FFC62828',
  Interrupted: 'FFC62828',
  Skipped:     'FF757575',
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

// Runs at the end of every `playwright test` invocation (see playwright.config.js's
// `reporter` array) and (re)writes one row per test actually executed in that run -
// so the sheet always reflects the latest results instead of a hand-maintained list.
class ExcelReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || 'Inventory_Test_Cases.xlsx';
    this.rows = [];
  }

  onTestEnd(test, result) {
    const rawTitle = test.title;
    const { testCaseId, type, description } = parseTitle(rawTitle);

    const specFile   = path.relative(process.cwd(), test.location.file).replace(/\\/g, '/');
    const moduleName = test.parent && test.parent.title ? test.parent.title : '';
    const tags       = typeof test.tags === 'function' ? test.tags() : (test.tags || []);
    const isSmoke    = Array.isArray(tags) && tags.includes('@smoke');

    // `use.video: 'on'` in playwright.config.js records one per test; Playwright
    // exposes it as a 'video' attachment on the result, not a fixed filename.
    const videoAttachment = result.attachments.find((a) => a.name === 'video');
    const videoPath = videoAttachment && videoAttachment.path
      ? path.relative(process.cwd(), videoAttachment.path).replace(/\\/g, '/')
      : '';

    this.rows.push({
      module:      moduleName,
      specFile,
      testCaseId,
      description: description || rawTitle,
      type,
      smoke:       isSmoke ? 'Yes' : 'No',
      status:      STATUS_LABELS[result.status] || result.status,
      durationMs:  result.duration,
      retries:     result.retry,
      error:       result.error ? String(result.error.message || result.error).split('\n')[0] : '',
      videoPath,
    });
  }

  async onEnd() {
    // Specs that share one `page` across all their test cases (created via
    // browser.newContext in a test.beforeAll, e.g. 01-attribute, 03-bin,
    // 08-stock-transfer) bypass Playwright's per-test video fixture, so their
    // rows arrive here with no attachment. Those specs save one video for the
    // whole file instead (see helpers/sharedContextVideo.js); fall back to
    // that convention-based path, now that every test has finished and the
    // file has been written.
    this.rows.forEach((row) => {
      if (row.videoPath) return;
      const base = path.basename(row.specFile, path.extname(row.specFile));
      const fallback = path.join(VIDEO_DIR, `${base}.webm`);
      if (fs.existsSync(path.join(process.cwd(), fallback))) {
        row.videoPath = fallback.replace(/\\/g, '/');
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Test Execution Report');

    sheet.columns = [
      { header: 'Sl No',                 key: 'slNo',       width: 6 },
      { header: 'Module',                key: 'module',     width: 28 },
      { header: 'Spec File',             key: 'specFile',   width: 32 },
      { header: 'Test Case ID',          key: 'testCaseId', width: 14 },
      { header: 'Test Case Description', key: 'description', width: 80 },
      { header: 'Type',                  key: 'type',       width: 10 },
      { header: 'Smoke',                 key: 'smoke',      width: 8 },
      { header: 'Status',                key: 'status',     width: 12 },
      { header: 'Duration (ms)',         key: 'durationMs', width: 14 },
      { header: 'Retries',               key: 'retries',    width: 8 },
      { header: 'Error',                 key: 'error',      width: 60 },
      { header: 'Video Path',            key: 'videoPath',  width: 60 },
    ];
    sheet.getRow(1).font = { bold: true };

    this.rows.forEach((row, i) => {
      const addedRow = sheet.addRow({ slNo: i + 1, ...row });
      const color = STATUS_COLORS[row.status];
      if (color) {
        addedRow.getCell('status').font = { color: { argb: color }, bold: true };
      }
      if (row.videoPath) {
        const videoCell = addedRow.getCell('videoPath');
        videoCell.value = { text: row.videoPath, hyperlink: row.videoPath };
        videoCell.font = { color: { argb: 'FF1565C0' }, underline: true };
      }
    });

    if (this.rows.length) {
      sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columns.length } };
    }

    const outPath = path.join(process.cwd(), this.outputFile);
    try {
      await workbook.xlsx.writeFile(outPath);
      console.log(`\nExcel test report written: ${outPath} (${this.rows.length} test case${this.rows.length === 1 ? '' : 's'})`);
    } catch (err) {
      // Most commonly EBUSY/EPERM because the report is still open in Excel.
      // Don't let a locked file crash the run - write alongside it instead.
      if (err && (err.code === 'EBUSY' || err.code === 'EPERM')) {
        const fallbackPath = outPath.replace(/\.xlsx$/, `.new.xlsx`);
        await workbook.xlsx.writeFile(fallbackPath);
        console.warn(`\n${outPath} is open elsewhere (close it in Excel) - wrote results to ${fallbackPath} instead.`);
      } else {
        throw err;
      }
    }
  }
}

module.exports = ExcelReporter;
