import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
chromium.use(StealthPlugin());

// 永続プロファイル（ここに保存すれば次回以降もCookieが残る）
const PROFILE_DIR = path.join(__dirname, "../data/browser-profile");
const DATA_DIR = path.join(__dirname, "../data");

fs.mkdirSync(PROFILE_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// 人間らしいランダム待機
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const humanDelay = () => sleep(300 + Math.random() * 700);

// 人間らしいタイピング（ロケーター使用）
async function humanType(locator, text) {
  await locator.click();
  await humanDelay();
  await locator.fill("");
  for (const char of text) {
    await locator.pressSequentially(char, { delay: 50 + Math.random() * 100 });
  }
}

async function loginCrowdworks(page) {
  console.log("📄 クラウドワークス ログインページへ...");
  await page.goto("https://crowdworks.jp/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000 + Math.random() * 1000);

  // すでにログイン済みか確認
  if (!page.url().includes("/login")) {
    console.log("✅ クラウドワークス: 既にログイン済み");
    return true;
  }

  console.log("✍️  認証情報を入力中...");
  await humanType(page.getByRole("textbox", { name: "メールアドレス" }), "t.yonenaga@hashtag.ne.jp");
  await humanDelay();
  await humanType(page.getByRole("textbox", { name: "パスワード" }), "taka0803");
  await humanDelay();

  // ログイン状態を30日保存（チェックをON）
  try {
    const rememberMe = page.locator('input[type="checkbox"]').first();
    if (await rememberMe.count() > 0) await rememberMe.check();
  } catch {}

  await humanDelay();
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  // ログイン完了またはCAPTCHA出現を待つ
  await sleep(3000);

  // CAPTCHAが出た場合: 自動で再試行（ページリロード）
  let retries = 3;
  while (page.url().includes("/login") && retries-- > 0) {
    console.log(`⚠️  ログイン失敗 or CAPTCHA検出。リトライ中... (残り${retries}回)`);
    await sleep(2000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(2000);

    if (page.url().includes("/login")) {
      // 再度ログイン試行
      try {
        await page.getByRole("textbox", { name: "メールアドレス" }).fill("t.yonenaga@hashtag.ne.jp");
        await humanDelay();
        await page.getByRole("textbox", { name: "パスワード" }).fill("taka0803");
        await humanDelay();
        await page.getByRole("button", { name: "ログイン", exact: true }).click();
        await sleep(3000);
      } catch {}
    }
  }

  if (page.url().includes("/login")) {
    console.log("❌ クラウドワークス ログイン失敗");
    return false;
  }

  console.log("✅ クラウドワークス ログイン成功！");
  return true;
}

async function loginLancers(page) {
  console.log("\n📄 ランサーズ ログインページへ...");
  await page.goto("https://www.lancers.jp/user/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000 + Math.random() * 1000);

  if (!page.url().includes("/login") && !page.url().includes("/sign_up")) {
    console.log("✅ ランサーズ: 既にログイン済み");
    return true;
  }

  console.log("✍️  認証情報を入力中...");
  try {
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[name*="Email"]').first();
    await humanType(emailInput, "t.yonenaga@hashtag.ne.jp");
    await humanDelay();
    const pwInput = page.locator('input[type="password"]').first();
    await humanType(pwInput, "taka0803");
    await humanDelay();
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await sleep(3000);
  } catch (e) {
    console.log("  入力エラー:", e.message);
  }

  if (page.url().includes("/login") || page.url().includes("/sign_up")) {
    console.log("❌ ランサーズ ログイン失敗");
    return false;
  }

  console.log("✅ ランサーズ ログイン成功！");
  return true;
}

async function scrapeFormFields(page) {
  return await page.evaluate(() => {
    const results = [];
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.type === "hidden") return;
      const labelEl =
        document.querySelector(`label[for="${el.id}"]`) ||
        el.closest("li, .form-group, tr, .field")?.querySelector("label, dt, th, legend");
      const label = labelEl?.textContent?.trim() || el.placeholder || el.name || "";
      const parentEl = el.closest("li, .form-group, tr, .field");
      const required =
        el.required ||
        el.getAttribute("aria-required") === "true" ||
        !!parentEl?.querySelector(".required, abbr[title*='必須'], [class*='required']");
      const options = el.tagName === "SELECT"
        ? Array.from(el.options).map((o) => o.text.trim()).filter(Boolean)
        : [];
      results.push({ type: el.type || el.tagName.toLowerCase(), name: el.name || "", label: label.replace(/\s+/g, " ").trim(), required, placeholder: el.placeholder || "", options });
    });
    return results;
  });
}

async function main() {
  console.log("🚀 ブラウザ起動中（ステルスモード）...\n");

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

  try {
    // ===== クラウドワークス =====
    const cwOk = await loginCrowdworks(page);
    if (cwOk) {
      // メニューの「新しい仕事を依頼」リンクURLを取得
      await page.goto("https://crowdworks.jp/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(2000);
      const newJobLink = await page.locator('a:has-text("新しい仕事を依頼")').first().getAttribute("href").catch(() => null);
      console.log("📋 新しい仕事を依頼URL:", newJobLink);

      const cwTarget = newJobLink
        ? (newJobLink.startsWith("http") ? newJobLink : "https://crowdworks.jp" + newJobLink)
        : "https://crowdworks.jp/job_offers/new";

      await page.goto(cwTarget, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(3000);
      console.log("📋 CW投稿フォームURL:", page.url());
      await page.screenshot({ path: path.join(DATA_DIR, "cw-form.png"), fullPage: true });
      const fields = await scrapeFormFields(page);
      fs.writeFileSync(path.join(DATA_DIR, "cw-form-fields.json"), JSON.stringify(fields, null, 2));
      console.log("✅ CWフォーム項目を保存:", fields.length, "件");
      fields.forEach(f => console.log(`  [${f.required ? "必須" : "任意"}] ${f.label || f.name} (${f.type})`));
    }

    // ===== ランサーズ =====
    const laOk = await loginLancers(page);
    if (laOk) {
    // ランサーズ：旧依頼フォームから進む
      await page.goto("https://www.lancers.jp/work/create", { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(2000);

      // 「旧依頼フォームはこちら」リンクをクリック
      const oldFormLink = page.locator('a:has-text("旧依頼フォーム")').first();
      if (await oldFormLink.count() > 0) {
        await oldFormLink.click();
        await sleep(3000);
      }

      console.log("\n📋 ランサーズ投稿フォームURL:", page.url());
      await page.screenshot({ path: path.join(DATA_DIR, "la-form.png"), fullPage: true });
      const laFields = await scrapeFormFields(page);
      fs.writeFileSync(path.join(DATA_DIR, "la-form-fields.json"), JSON.stringify(laFields, null, 2));
      console.log("✅ ランサーズフォーム項目を保存:", laFields.length, "件");
      laFields.forEach(f => console.log(`  [${f.required ? "必須" : "任意"}] ${f.label || f.name} (${f.type})`));
    }

  } catch (err) {
    console.error("❌ エラー:", err.message);
    await page.screenshot({ path: path.join(DATA_DIR, "error.png") });
  } finally {
    await browser.close();
    console.log("\n🏁 完了");
  }
}

main();
