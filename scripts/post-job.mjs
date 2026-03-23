import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
chromium.use(StealthPlugin());

const params = JSON.parse(process.argv[2]);
const { platform, generatedText, budget, paymentType, deadlineDays } = params;

const CW_EMAIL = process.env.CW_EMAIL;
const CW_PASSWORD = process.env.CW_PASSWORD;
const LA_EMAIL = process.env.LA_EMAIL;
const LA_PASSWORD = process.env.LA_PASSWORD;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const humanDelay = () => sleep(500 + Math.random() * 800);

function extractTitle(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[0].replace(/^[＼\\\/]+|[＼\\\/]+$/g, "").trim().slice(0, 50);
}

async function humanType(locator, text) {
  await locator.click();
  await sleep(300);
  await locator.fill("");
  await sleep(200);
  await locator.fill(text);
}

async function loginCrowdworks(page) {
  console.log("cw_login_start");
  await page.goto("https://crowdworks.jp/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);

  if (!page.url().includes("/login")) {
    console.log("cw_already_logged_in");
    return true;
  }

  await humanType(page.locator('input[name="username"]').first(), CW_EMAIL);
  await humanDelay();
  await humanType(page.locator('input[name="password"]').first(), CW_PASSWORD);
  await humanDelay();

  try {
    const cb = page.locator('input[type="checkbox"]').first();
    if (await cb.count() > 0) await cb.check();
  } catch {}

  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await sleep(4000);

  if (page.url().includes("/login")) {
    // CAPTCHAの可能性 - スクリーンショット保存してエラー
    await page.screenshot({ path: path.join(__dirname, "../data/login-error.png") });
    console.error("cw_login_failed: CAPTCHAまたは認証エラー");
    return false;
  }

  console.log("cw_login_ok");
  return true;
}

async function loginLancers(page) {
  console.log("la_login_start");
  await page.goto("https://www.lancers.jp/user/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);

  if (!page.url().includes("/login") && !page.url().includes("/sign_up")) {
    console.log("la_already_logged_in");
    return true;
  }

  await humanType(page.locator('input[type="email"]').first(), LA_EMAIL);
  await humanDelay();
  await humanType(page.locator('input[type="password"]').first(), LA_PASSWORD);
  await humanDelay();
  await page.locator('button[type="submit"]').first().click();
  await sleep(4000);

  if (page.url().includes("/login")) {
    await page.screenshot({ path: path.join(__dirname, "../data/login-error.png") });
    console.error("la_login_failed");
    return false;
  }

  console.log("la_login_ok");
  return true;
}

// カテゴリ名をCWのテキストにマッピング
const CW_CATEGORY_MAP = {
  "AI・業務効率化": "AI-BPO",
  "システム開発・プログラミング": "システム開発",
  "Web制作・Webデザイン": "ホームページ制作",
  "デザイン・イラスト": "デザイン",
  "動画・映像制作": "動画・映像",
  "ライティング・記事作成": "ライティング",
  "マーケティング・SNS・集客": "マーケティング",
  "ビジネスサポート・事務": "事務・カンタン作業",
  "翻訳・通訳": "翻訳・通訳",
};

async function clickNextButton(page) {
  // 「次へ」「選択する」「続ける」ボタンを探してクリック
  const nextBtn = page.getByRole("button", { name: /次へ|選択する|続ける|進む/ }).first();
  if (await nextBtn.count() > 0) {
    await nextBtn.click();
    await sleep(2000);
    return true;
  }
  // aタグの場合
  const nextLink = page.locator("a").filter({ hasText: /^次へ$|^選択する$|^続ける$/ }).first();
  if (await nextLink.count() > 0) {
    await nextLink.click();
    await sleep(2000);
    return true;
  }
  return false;
}

async function postToCrowdworks(page) {
  const title = extractTitle(generatedText);
  console.log("title:" + title);

  await page.goto("https://crowdworks.jp/job_offers/new", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  // ステップ1: カテゴリ3段階選択（col1ボタン → col3ボタン）
  const cwCategory = CW_CATEGORY_MAP[params.category] ?? params.category;
  console.log("selecting_category:" + cwCategory);

  // カテゴリと対応するcol3（最終選択）のマッピング
  const CW_COL3_MAP = {
    "システム開発": "業務システム・ソフトウェア",
    "AI-BPO": "AI-BPO（AI活用の業務改善）",
    "ホームページ制作": "ホームページ制作",
    "デザイン": "デザイン",
    "動画・映像": "動画・映像",
    "ライティング": "ライティング",
    "マーケティング": "マーケティング",
    "事務・カンタン作業": "事務・カンタン作業",
    "翻訳・通訳": "翻訳・通訳",
  };

  try {
    // 「すべてのカテゴリから選ぶ」タブをクリック
    const allCatTab = page.locator('a, button').filter({ hasText: "すべてのカテゴリから選ぶ" }).first();
    if (await allCatTab.count() > 0) { await allCatTab.click(); await sleep(1000); }

    // 列1: メインカテゴリ（button要素）をクリック
    const col1 = page.locator("button").filter({ hasText: new RegExp(`^${cwCategory}$`) }).first();
    if (await col1.count() > 0) {
      await col1.click();
      await sleep(1500);
      console.log("col1_clicked");
    }

    // 列3: 対応するサブサブカテゴリをクリック → フォームが同ページに展開
    const col3Text = CW_COL3_MAP[cwCategory];
    if (col3Text) {
      const col3 = page.locator("button").filter({ hasText: new RegExp(`^${col3Text}$`) }).first();
      if (await col3.count() > 0) {
        await col3.click();
        await sleep(2000);
        console.log("col3_clicked:" + col3Text);
      }
    } else {
      // col3が不明な場合は最初のボタン（col1除く）を探す
      const allBtns = await page.locator("button").allTextContents();
      const col1Items = ["人気のカテゴリから選ぶ","すべてのカテゴリから選ぶ","AI-BPO（AI活用の業務改善）","システム開発","AI（人工知能）・機械学習","アプリ・スマートフォン開発","ホームページ制作・Webデザイン","ECサイト・ネットショップ構築","デザイン","動画・映像・アニメーション","音楽・音響・ナレーション","ビジネス・マーケティング・企画","ライティング・記事作成","事務・カンタン作業","写真・画像","3D-CG制作","ネーミング・アイデア","翻訳・通訳サービス","製品設計・開発","相談アドバイス・暮らし・社会","プロジェクト・保守運用メンバー募集"];
      const col3Candidates = allBtns.filter(b => !col1Items.some(c => b.trim() === c));
      if (col3Candidates.length > 0) {
        const col3Btn = page.locator("button").filter({ hasText: new RegExp(`^${col3Candidates[0].trim()}$`) }).first();
        if (await col3Btn.count() > 0) { await col3Btn.click(); await sleep(2000); console.log("col3_fallback_clicked:" + col3Candidates[0].trim()); }
      }
    }
  } catch (e) { console.log("category_error:" + e.message); }

  await page.screenshot({ path: path.join(__dirname, "../data/cw-form-page.png") });
  console.log("form_url:" + page.url());

  // ステップ2: フォーム入力（タイトル・詳細・予算・期限）
  // タイトル
  try {
    const titleInput = page.locator('input[name="job_offer[title]"]').first();
    if (await titleInput.count() > 0) { await humanType(titleInput, title); await humanDelay(); console.log("title_filled"); }
  } catch (e) { console.log("title_error:" + e.message); }

  // 詳細（contenteditable リッチテキストエディタ）
  try {
    const editor = page.locator('[contenteditable="true"]').first();
    if (await editor.count() > 0) {
      await editor.click();
      await sleep(500);
      await editor.fill(generatedText);
      await humanDelay();
      console.log("desc_filled_contenteditable");
    } else {
      // フォールバック: textarea
      const desc = page.locator('textarea').first();
      if (await desc.count() > 0) { await humanType(desc, generatedText); await humanDelay(); console.log("desc_filled_textarea"); }
    }
  } catch (e) { console.log("desc_error:" + e.message); }

  // 予算（selectまたはinput）
  if (budget) {
    try {
      const budgetNum = budget.replace(/[^0-9]/g, "");
      // select形式の場合
      const budgetSel = page.locator('select[name="budget"]').first();
      if (await budgetSel.count() > 0) {
        const opts = await budgetSel.locator("option").allTextContents();
        // 最も近い金額オプションを選ぶ
        const target = opts.find(o => o.replace(/[^0-9]/g, "") >= budgetNum) ?? opts[opts.length - 2];
        if (target) { await budgetSel.selectOption({ label: target }); await humanDelay(); console.log("budget_selected:" + target); }
      }
      // input形式の場合
      const exactRadio = page.locator('input[name="budget_type"][value="exact"]').first();
      if (await exactRadio.count() > 0) {
        await exactRadio.check();
        await humanDelay();
        const budgetInput = page.locator('input[name="exact_budget"]').first();
        if (await budgetInput.count() > 0) { await humanType(budgetInput, budgetNum); await humanDelay(); console.log("budget_filled_exact"); }
      }
    } catch (e) { console.log("budget_error:" + e.message); }
  }

  // 応募期限
  try {
    const sel = page.locator('select[name="job_offer[expired_on]"]').first();
    if (await sel.count() > 0) {
      const options = await sel.locator("option").allTextContents();
      const target = options.find((o) => o.includes(`${deadlineDays}日後`)) ?? options[1];
      if (target) { await sel.selectOption({ label: target }); await humanDelay(); console.log("deadline_set:" + target); }
    }
  } catch {}

  await sleep(1000);
  await page.screenshot({ path: path.join(__dirname, "../data/cw-form-filled.png") });

  // 確認・プレビューへ
  try {
    const confirmBtn = page.getByRole("button", { name: /確認|プレビュー/ }).first();
    if (await confirmBtn.count() > 0) { await confirmBtn.click(); await sleep(3000); console.log("confirm_clicked"); }
  } catch {}

  await page.screenshot({ path: path.join(__dirname, "../data/cw-preview.png") });

  // 投稿
  try {
    const submitBtn = page.getByRole("button", { name: /投稿|公開|送信/ }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await sleep(4000);
      console.log("posted_url:" + page.url());
    }
  } catch {}
}

async function postToLancers(page) {
  const title = extractTitle(generatedText);

  await page.goto("https://www.lancers.jp/work/create", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);

  try {
    const oldForm = page.locator('a:has-text("旧依頼フォーム")').first();
    if (await oldForm.count() > 0) { await oldForm.click(); await sleep(3000); }
  } catch {}

  try {
    const titleInput = page.locator('input[name*="title"]').first();
    if (await titleInput.count() > 0) { await humanType(titleInput, title); await humanDelay(); }
  } catch {}

  try {
    const desc = page.locator('textarea[name*="description"], textarea[name*="detail"]').first();
    if (await desc.count() > 0) { await humanType(desc, generatedText); await humanDelay(); }
  } catch {}

  if (budget) {
    try {
      const budgetInput = page.locator('input[name*="budget"], input[name*="price"]').first();
      if (await budgetInput.count() > 0) {
        await humanType(budgetInput, budget.replace(/[^0-9]/g, ""));
        await humanDelay();
      }
    } catch {}
  }

  try {
    const confirmBtn = page.getByRole("button", { name: /確認|次へ/ }).first();
    if (await confirmBtn.count() > 0) { await confirmBtn.click(); await sleep(3000); }
  } catch {}

  try {
    const submitBtn = page.getByRole("button", { name: /依頼|投稿|公開|送信/ }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await sleep(4000);
      console.log("posted_url:" + page.url());
    }
  } catch {}
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const context = await browser.newContext({
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    if (platform === "crowdworks") {
      const ok = await loginCrowdworks(page);
      if (!ok) throw new Error("login_failed");
      await postToCrowdworks(page);
    } else {
      const ok = await loginLancers(page);
      if (!ok) throw new Error("login_failed");
      await postToLancers(page);
    }
    console.log("success");
  } catch (err) {
    console.error("error:" + err.message);
  } finally {
    await sleep(1000);
    await browser.close();
  }
}

main();
