import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
chromium.use(StealthPlugin());

const PROFILE_DIR = path.join(__dirname, "../data/browser-profile");
const COOKIES_PATH = path.join(__dirname, "../data/cw-cookies.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function humanType(locator, text) {
  await locator.click();
  await sleep(300);
  await locator.fill("");
  for (const char of text) {
    await locator.pressSequentially(char, { delay: 60 + Math.random() * 80 });
  }
}

async function main() {
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  const page = await browser.newPage();

  await page.goto("https://crowdworks.jp/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);

  if (!page.url().includes("/login")) {
    console.log("already_logged_in");
  } else {
    await humanType(page.getByRole("textbox", { name: "メールアドレス" }), "t.yonenaga@hashtag.ne.jp");
    await sleep(500);
    await humanType(page.getByRole("textbox", { name: "パスワード" }), "taka0803");
    await sleep(500);

    try {
      const rememberMe = page.locator('input[type="checkbox"]').first();
      if (await rememberMe.count() > 0) await rememberMe.check();
    } catch {}

    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await sleep(4000);
  }

  // Cookieを保存
  const cookies = await browser.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log("saved_cookies:" + cookies.length);

  await browser.close();
  console.log("done");
}

main();
