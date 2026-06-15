const errors = [];
let healthResponse = null;
let hasAppError = false;
let screenshotPath = String.fromCharCode(47,116,109,112,47,97,118,97,116,101,114,114,97,45,104,111,109,101,46,112,110,103);
const healthUrl = String.fromCharCode(104,116,116,112,115,58,47,47,97,118,97,116,101,114,114,97,46,112,114,111,47,97,112,105,47,104,101,97,108,116,104);
const homeUrl = String.fromCharCode(104,116,116,112,115,58,47,47,97,118,97,116,101,114,114,97,46,112,114,111,47);
const chromeExe = process.env.PW_CHROME;

const cp = await import(String.fromCharCode(99,104,105,108,100,95,112,114,111,99,101,115,115));
const fs = await import(String.fromCharCode(102,115));

try {
  healthResponse = cp.execSync(String.fromCharCode(99,117,114,108,32,45,115,83,32) + healthUrl, { encoding: String.fromCharCode(117,116,102,56), timeout: 30000 }).trim();
} catch (e) {
  healthResponse = String(e.message || e);
}

const pw = await import(String.fromCharCode(112,108,97,121,119,114,105,103,104,116));
const launchOpts = { headless: true };
if (chromeExe) launchOpts.executablePath = chromeExe;
const browser = await pw.chromium.launch(launchOpts);
const page = await browser.newPage();
page.on(String.fromCharCode(112,97,103,101,101,114,114,111,114), (err) => errors.push({ type: String.fromCharCode(112,97,103,101,101,114,114,111,114), message: err.message || String(err) }));
page.on(String.fromCharCode(99,111,110,115,111,108,101), (msg) => { if (msg.type() === String.fromCharCode(101,114,114,111,114)) errors.push({ type: String.fromCharCode(99,111,110,115,111,108,101), message: msg.text() }); });

try {
  await page.goto(homeUrl, { waitUntil: String.fromCharCode(110,101,116,119,111,114,107,105,100,108,101), timeout: 60000 });
} catch (e) {
  errors.push({ type: String.fromCharCode(110,97,118,105,103,97,116,105,111,110), message: e.message || String(e) });
}

const bodyText = (await page.textContent(String.fromCharCode(98,111,100,121)).catch(() => String.fromCharCode())) || String.fromCharCode();
for (const n of [String.fromCharCode(65,112,112,108,105,99,97,116,105,111,110,32,101,114,114,111,114), String.fromCharCode(99,108,105,101,110,116,45,115,105,100,101,32,101,120,99,101,112,116,105,111,110)]) {
  if (bodyText.includes(n)) hasAppError = true;
}

try {
  await page.screenshot({ path: screenshotPath, fullPage: true });
} catch (e) {
  screenshotPath = null;
  errors.push({ type: String.fromCharCode(115,99,114,101,101,110,115,104,111,116), message: e.message || String(e) });
}
await browser.close();
console.log(JSON.stringify({ hasAppError, errors, healthResponse, screenshotPath: screenshotPath && fs.existsSync(screenshotPath) ? screenshotPath : null }, null, 2));
