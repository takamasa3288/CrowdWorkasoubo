import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
chromium.use(StealthPlugin());

const PROFILE_DIR = path.join(__dirname, "../data/browser-profile");
const DATA_DIR = path.join(__dirname, "../data/samples");

fs.mkdirSync(DATA_DIR, { recursive: true });

// コマンドライン引数からURLを取得
const url = process.argv[2];
if (!url) {
  console.error("使い方: node scripts/scrape-sample.mjs <URL>");
  process.exit(1);
}

async function main() {
  console.log("🚀 ブラウザ起動中...");

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
    console.log(`📄 取得中: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // ログインページにリダイレクトされた場合
    if (page.url().includes("/login")) {
      console.log("❌ ログインが必要です。先に login-and-scrape.mjs を実行してください。");
      await browser.close();
      process.exit(1);
    }

    // ページ全文テキストを取得
    const text = await page.evaluate(() => {
      // 不要な要素を除外してテキスト抽出
      const remove = ["script", "style", "nav", "header", "footer", ".sidebar", ".ad"];
      remove.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      });
      return document.body.innerText;
    });

    // URLからファイル名を生成
    const jobId = url.match(/\/(\d+)/)?.[1] || Date.now().toString();
    const outputPath = path.join(DATA_DIR, `sample-${jobId}.txt`);
    fs.writeFileSync(outputPath, text, "utf-8");

    console.log(`✅ 保存完了: ${outputPath}`);
    console.log(`📝 文字数: ${text.length}文字`);
    console.log("\n--- 先頭200文字 ---");
    console.log(text.slice(0, 200));

  } catch (err) {
    console.error("❌ エラー:", err.message);
  } finally {
    await browser.close();
  }
}

main();
