import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "募集文ジェネレーター",
  description: "クラウドワークス・ランサーズ向け募集文をAIが生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
