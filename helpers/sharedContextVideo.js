const path = require('path');
const fs = require('fs');

const VIDEO_DIR = path.join('test-results', 'videos');

// Playwright's `use.video: 'on'` only auto-records for its own built-in
// `page` fixture. Specs that share one `page` across all their test cases
// (created via browser.newContext() in a test.beforeAll, e.g. 01-attribute,
// 03-bin, 08-stock-transfer) bypass that fixture entirely, so they get no
// video unless the context is explicitly told to record one.
function videoContextOptions() {
  return { recordVideo: { dir: VIDEO_DIR } };
}

// Call from the spec's test.afterAll. Closes the context (which flushes the
// one continuous recording covering every test case in the file) and saves
// it under a name derived from the spec file - the excel-reporter's onEnd
// falls back to this same convention for rows whose test didn't get its own
// per-test video attachment.
async function finalizeSharedVideo(page, specFilename) {
  const video = page.video();
  if (!video) return null;

  await page.context().close();
  const savedPath = await video.path();

  const destPath = path.join(VIDEO_DIR, `${path.basename(specFilename, path.extname(specFilename))}.webm`);
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await fs.promises.rename(savedPath, destPath);
  return destPath;
}

module.exports = { videoContextOptions, finalizeSharedVideo, VIDEO_DIR };
