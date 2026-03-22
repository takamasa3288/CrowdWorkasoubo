import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();
  if (!transcript) return NextResponse.json({ text: "" });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: "音声認識テキストを自然な日本語に整えてください。誤変換や言い淀みを直し、元の意図を保ちながら簡潔にまとめてください。余計な説明は不要です。整形後のテキストだけ返してください。",
    messages: [{ role: "user", content: transcript }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : transcript;
  return NextResponse.json({
    text,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  });
}
