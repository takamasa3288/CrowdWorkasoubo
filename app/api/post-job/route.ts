import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { platform, generatedText, budget, paymentType, deadlineDays, category } = body;

  if (!platform || !generatedText) {
    return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
  }

  const scriptPath = path.join(process.cwd(), "scripts/post-job.mjs");
  const params = JSON.stringify({ platform, generatedText, budget, paymentType, deadlineDays, category });

  return new Promise<NextResponse>((resolve) => {
    const logs: string[] = [];
    let postedUrl = "";

    const child = spawn("node", [scriptPath, params], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_NO_WARNINGS: "1",
        CW_EMAIL: process.env.CW_EMAIL ?? "",
        CW_PASSWORD: process.env.CW_PASSWORD ?? "",
        LA_EMAIL: process.env.LA_EMAIL ?? "",
        LA_PASSWORD: process.env.LA_PASSWORD ?? "",
      },
    });

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      logs.push(text);
      if (text.startsWith("posted_url:")) {
        postedUrl = text.replace("posted_url:", "");
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      logs.push("ERR: " + data.toString().trim());
    });

    child.on("close", (code: number) => {
      const success = code === 0 && logs.some((l) => l === "success");
      resolve(
        NextResponse.json({
          success,
          postedUrl,
          logs,
        })
      );
    });

    // タイムアウト90秒
    setTimeout(() => {
      child.kill();
      resolve(NextResponse.json({ success: false, error: "タイムアウト", logs }, { status: 500 }));
    }, 90000);
  });
}
