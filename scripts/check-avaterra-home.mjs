import { chromium } from "playwright";
import { execSync } from "child_process";
import fs from "fs";

const linuxChrome = "/home/denisok/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const errors = [];
let hasAppError = false;
let health = null;
let screenshotPath = process.platform === "win32"
  ? "\\\\wsl.localhost\\Ubuntu\\tmp\\avaterra-home.png"
  : "/tmp/avaterra-home.png";

const launchOpts = { headless: true };
if (process.platform === "linux" && fs.existsSync(linuxChrome)) {
  launchOpts.executablePath = linuxChrome;
}

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();

page.on("pageerror", (err) => {
  errors.push({ type: "pageerror", message: String(err?.message || err) });
});
page.on("console", (msg) => {
  if (msg.type() === "error") {
    errors.push({ type: "console", message: msg.text() });
  }
});

try {
  await page.goto("https://avaterra.pro/", { waitUntil: "networkidle", timeout: 60000 });
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const lower = bodyText.toLowerCase();
  hasAppError =
    lower.includes("application error") ||
    lower.includes("client-side exception");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (e) {
    screenshotPath = null;
    errors.push({ type: "screenshot", message: String(e?.message || e) });
  }
} catch (e) {
  errors.push({ type: "navigation", message: String(e?.message || e) });
}

await browser.close();

try {
  health = execSync("curl -sS -m 30 https://avaterra.pro/api/health", { encoding: "utf8" });
} catch (e) {
  health = String(e.stdout || e.message || e);
}

console.log(JSON.stringify({ hasAppError, errors, health, screenshotPath }, null, 2));