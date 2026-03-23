import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, jobDetails, paymentType, budget } = body;

    if (!category || !jobDetails) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `以下の募集情報をもとに、クラウドワークス・ランサーズ向けの募集タイトルを5案作成してください。

【募集情報】
カテゴリ: ${category}
支払い方式: ${paymentType === "fixed" ? "固定報酬制" : "時間単価制"}${budget ? `\n募集金額: ${budget}` : ""}
${jobDetails}

【タイトル作成ルール】
- 40文字以内
- 具体的な業務内容・スキルを含める
- 「募集」「お仕事」などの平凡な言葉を避ける
- 応募者が検索しそうなキーワードを自然に入れる
- マークダウン記法（##、**など）や絵文字は絶対に使わない
- 各案は1行で書く
- 番号や記号のプレフィックスをつけず、タイトル本文だけを書く

5案を改行区切りで出力してください。`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const titles = raw
      .split("\n")
      .map((l) => l.trim().replace(/^[\d\.\-\・]+\s*/, "").replace(/^【.*?】/, "").trim())
      .filter((l) => l.length > 0 && l.length <= 50)
      .slice(0, 5);

    return NextResponse.json({ titles });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "エラー" }, { status: 500 });
  }
}
