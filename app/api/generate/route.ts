import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

// サンプル募集文を読み込む
function loadSamples(enthusiasmLevel: number): string {
  const samplesDir = path.join(process.cwd(), "data/samples");
  const sampleFiles: Record<number, string[]> = {
    1: ["level1-data-collection.txt"],
    2: ["level2-video-editing-partner.txt", "level2-reel-editing.txt"],
    3: ["level3-project-leader.txt", "level3-instagram-director.txt"],
  };

  const files = sampleFiles[enthusiasmLevel] ?? sampleFiles[2];
  const samples: string[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(samplesDir, file), "utf-8");
      samples.push(content.trim());
    } catch {
      // ファイルが読めない場合はスキップ
    }
  }

  return samples.join("\n\n---\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, category, subcategory, paymentType, enthusiasmLevel, jobDetails, budget, priceRangeNote, deadlineDays } =
      body;

    if (!platform || !category || !jobDetails) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const platformName = platform === "crowdworks" ? "クラウドワークス" : "ランサーズ";

    // 熱量レベルに応じたトーン指示
    const toneMap: Record<number, { label: string; instruction: string }> = {
      1: {
        label: "シンプル作業者募集",
        instruction:
          "業務内容・条件・報酬を簡潔に伝えるビジネスライクな文章。感情表現は最小限。必要なスキルと条件を明確に箇条書きで示す。【 】形式の見出しを使い、シンプルに整理する。",
      },
      2: {
        label: "スタンダード",
        instruction:
          "丁寧かつ親しみやすい文章。業務内容を■見出し形式で分かりやすく説明する。業務フローがある場合は矢印で図示する。「ご遠慮いただきたい方」で応募者をフィルタリングする。末尾に温かいメッセージを添える。",
      },
      3: {
        label: "チームメンバー・パートナー募集",
        instruction:
          "一緒に働く仲間・パートナーを探すニュアンス。冒頭に「＼〜／」のキャッチコピーを入れる。「タスク消化型の外注ではなく」などの表現でポジションの重さを強調する。会社背景・ビジョンを伝え、長期関係を意識した熱量高めの文章にする。",
      },
    };

    const tone = toneMap[enthusiasmLevel] ?? toneMap[2];
    const samples = loadSamples(enthusiasmLevel);
    const paymentTypeLabel = paymentType === "hourly" ? "時間単価制" : "固定報酬制";

    const systemPrompt = `あなたはクラウドソーシングの募集文章の専門家です。
${platformName}向けに最適化された、質の高い募集文を作成してください。

【トーン】${tone.label}
【文章スタイル】${tone.instruction}

【参考サンプル】
以下は実際に使用した募集文のサンプルです。文体・構成・見出し形式を参考にしてください。

${samples}

【厳守ルール】
- タイトルも含めて # ## ### などのMarkdown記法を絶対に使わないこと
- ** 〜 ** などの太字Markdown記法を絶対に使わないこと
- 絵文字（📋🤝⚠️など）を一切使わないこと
- 見出しは【　】形式のみ使用すること（例：【業務内容】【応募条件】）
- 箇条書きは「・」のみ使用すること
- 冒頭タイトルを書く場合は「＼〜／」形式か、見出しなしでそのまま本文を書き始めること
- サンプルの業務内容をそのままコピーしないこと（あくまで文体・構成の参考）
- ${platformName}のユーザーに自然な人間らしい文章にすること
- AI生成っぽい硬い表現・型通りの構成を避けること
- 大げさな表現や誇張は避けること`;

    const userPrompt = `以下の情報をもとに募集文を作成してください。

プラットフォーム: ${platformName}
カテゴリ: ${category}${subcategory ? `\nサブカテゴリ: ${subcategory}` : ""}
支払い方式: ${paymentTypeLabel}${budget ? `\n募集金額: ${budget}` : ""}${deadlineDays ? `\n募集期間: ${deadlineDays}日間` : ""}${priceRangeNote ? `\n（公式相場参考: ${priceRangeNote}）` : ""}

業務詳細:
${jobDetails}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const generatedText =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({
      text: generatedText,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "文章生成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
