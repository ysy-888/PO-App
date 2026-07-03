import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { wrapPrintHtml } from "./html.js";

let browserPromise = null;
// Reuse one warm Chromium across requests — launching per-PDF costs several
// seconds and spikes memory harder than keeping a single instance alive.
// Set PDF_NO_REUSE=1 to restore launch-per-request behavior.
const reuseBrowser = !process.env.PDF_NO_REUSE;

async function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.RENDER || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return chromium.executablePath();
  }
  try {
    const { default: puppeteerFull } = await import("puppeteer");
    return puppeteerFull.executablePath();
  } catch {
    return chromium.executablePath();
  }
}

async function launchBrowser() {
  const isServerless = Boolean(process.env.RENDER || process.env.AWS_LAMBDA_FUNCTION_VERSION);
  const executablePath = await resolveExecutablePath();
  return puppeteer.launch({
    args: isServerless
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 816, height: 1056 },
    executablePath,
    headless: true,
  });
}

async function getBrowser() {
  if (!reuseBrowser) return launchBrowser();
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser && browser.connected) return browser;
    // Previous instance crashed or failed to launch — start fresh.
    browserPromise = null;
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

export async function htmlToPdfBuffer(htmlBody) {
  const html = wrapPrintHtml(htmlBody);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
    if (!reuseBrowser) {
      await browser.close();
    }
  }
}

export async function htmlToPdfAttachment(htmlBody, filename) {
  const buffer = await htmlToPdfBuffer(htmlBody);
  return {
    filename,
    mimeType: "application/pdf",
    contentBase64: buffer.toString("base64"),
  };
}
