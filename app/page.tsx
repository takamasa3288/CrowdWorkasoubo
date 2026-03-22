"use client";

import { useState, useRef, useCallback } from "react";
import categories from "@/data/categories.json";

// 音声入力フック（プッシュトゥトーク + AI整形）
function useVoiceInput(onResult: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SR) {
      alert("このブラウザは音声入力に対応していません（Chrome推奨）");
      return;
    }

    transcriptRef.current = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SR() as any;
    recognition.lang = "ja-JP";
    recognition.interimResults = true; // 中間結果も取得（これがないと長文が拾えない）
    recognition.continuous = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // 確定済み＋暫定中間結果を全部結合して常に最新状態を保持
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      transcriptRef.current = text;
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stop = useCallback(async () => {
    recognitionRef.current?.stop();
    setIsRecording(false);

    const raw = transcriptRef.current.trim();
    if (!raw) return;

    // 短いテキストはそのまま（API呼び出し不要）
    if (raw.length <= 15) {
      onResult(raw);
      return;
    }

    // Haikuで整形
    setIsCleaning(true);
    try {
      const res = await fetch("/api/voice-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: raw }),
      });
      const data = await res.json();
      onResult(data.text || raw);
    } catch {
      onResult(raw); // 失敗時はそのまま
    } finally {
      setIsCleaning(false);
    }
  }, [onResult]);

  return { isRecording, isCleaning, start, stop };
}

// thin-stroke マイクSVG
const MicIcon = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="1" width="6" height="12" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

// 録音中の波形SVG
const WaveIcon = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
    <line x1="2" y1="12" x2="2" y2="12"/>
    <line x1="6" y1="9" x2="6" y2="15"/>
    <line x1="10" y1="5" x2="10" y2="19"/>
    <line x1="14" y1="7" x2="14" y2="17"/>
    <line x1="18" y1="9" x2="18" y2="15"/>
    <line x1="22" y1="12" x2="22" y2="12"/>
  </svg>
);

// マイクボタン本体（プッシュトゥトーク）
function PushMicButton({
  isRecording, isCleaning, start, stop,
}: {
  isRecording: boolean;
  isCleaning: boolean;
  start: () => void;
  stop: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); start(); }}
      onMouseUp={stop}
      onMouseLeave={() => { if (isRecording) stop(); }}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={stop}
      disabled={isCleaning}
      title={isRecording ? "離すと確定・整形" : isCleaning ? "AI整形中..." : "押しながら話す"}
      style={{
        width: "28px",
        height: "28px",
        borderRadius: "7px",
        border: "none",
        backgroundColor: isRecording
          ? "rgba(239,68,68,0.12)"
          : isCleaning
          ? "rgba(99,102,241,0.1)"
          : "transparent",
        cursor: isCleaning ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background-color 0.1s",
        outline: "none",
        flexShrink: 0,
        boxShadow: isRecording
          ? "0 0 0 2px rgba(239,68,68,0.35)"
          : isCleaning
          ? "0 0 0 2px rgba(99,102,241,0.25)"
          : "none",
        userSelect: "none",
      }}
    >
      {isCleaning ? (
        // 整形中：くるくるアニメ
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : isRecording ? (
        <WaveIcon color="#ef4444" />
      ) : (
        <MicIcon color="#aaa" />
      )}
    </button>
  );
}

// テキストエリア用：底部ツールバー付きラッパー
function TextareaWithMic({
  value, setValue, placeholder, rows,
}: {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  rows: number;
}) {
  const append = useCallback((text: string) => {
    setValue(value ? value + "\n" + text : text);
  }, [value, setValue]);
  const { isRecording, isCleaning, start, stop } = useVoiceInput(append);

  return (
    <div style={{ border: "1px solid #e5e4df", borderRadius: "10px", overflow: "hidden", backgroundColor: "#fafaf8" }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          resize: "none",
          padding: "12px 14px",
          fontSize: "14px",
          color: "#333",
          backgroundColor: "transparent",
          fontFamily: "inherit",
          lineHeight: 1.6,
          boxSizing: "border-box",
        }}
      />
      <div style={{
        borderTop: "1px solid #eeede8",
        backgroundColor: "#f5f4ef",
        padding: "5px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "4px",
      }}>
        {isRecording && <span style={{ fontSize: "11px", color: "#ef4444" }}>録音中…</span>}
        {isCleaning && <span style={{ fontSize: "11px", color: "#6366f1" }}>AI整形中…</span>}
        <PushMicButton isRecording={isRecording} isCleaning={isCleaning} start={start} stop={stop} />
      </div>
    </div>
  );
}

// 一行入力用：右端にマイクボタン
function InputWithMic({
  value, setValue, placeholder,
}: {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
}) {
  const append = useCallback((text: string) => {
    setValue(value ? value + " " + text : text);
  }, [value, setValue]);
  const { isRecording, isCleaning, start, stop } = useVoiceInput(append);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          border: "1px solid #e5e4df",
          borderRadius: "10px",
          padding: "10px 44px 10px 14px",
          fontSize: "14px",
          color: "#333",
          backgroundColor: "#fafaf8",
          outline: "none",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />
      <div style={{ position: "absolute", right: "8px" }}>
        <PushMicButton isRecording={isRecording} isCleaning={isCleaning} start={start} stop={stop} />
      </div>
    </div>
  );
}

// ヘッダーロゴSVG（ノードグラフ風）
const LogoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4" r="2"/>
    <circle cx="4" cy="20" r="2"/>
    <circle cx="20" cy="20" r="2"/>
    <line x1="12" y1="6" x2="5.5" y2="18"/>
    <line x1="12" y1="6" x2="18.5" y2="18"/>
    <line x1="6" y1="20" x2="18" y2="20"/>
  </svg>
);

type Platform = "crowdworks" | "lancers";

interface PriceRange {
  min: number;
  max: number;
  unit: string;
  note?: string;
}

interface Subcategory {
  name: string;
  priceRange?: PriceRange;
}

interface Category {
  id: string;
  name: string;
  priceRange?: PriceRange;
  subcategories: Subcategory[];
}

const ENTHUSIASM_LEVELS = [
  { value: 1, label: "作業者募集", description: "シンプルに条件・業務を提示" },
  { value: 2, label: "スタンダード", description: "丁寧で親しみやすいトーン" },
  { value: 3, label: "仲間・パートナー募集", description: "熱量高め・長期関係志向" },
];

const DEADLINE_OPTIONS: Record<string, { label: string; days: number }[]> = {
  crowdworks: [
    { label: "3日", days: 3 },
    { label: "7日", days: 7 },
    { label: "14日（最長）", days: 14 },
  ],
  lancers: [
    { label: "3日", days: 3 },
    { label: "5日", days: 5 },
    { label: "7日（最長）", days: 7 },
  ],
};

const PAYMENT_TYPES = [
  { value: "fixed", label: "固定報酬制", description: "成果物に対して報酬を支払う" },
  { value: "hourly", label: "時間単価制", description: "稼働時間に対して報酬を支払う" },
] as const;

type PaymentType = "fixed" | "hourly";

function formatPrice(n: number): string {
  return n.toLocaleString("ja-JP");
}

const RequiredBadge = () => (
  <span style={{ backgroundColor: "#dc2626", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "3px", marginLeft: "6px", display: "inline-block", lineHeight: "1.6", verticalAlign: "middle", letterSpacing: "0.02em" }}>必須</span>
);

const OptionalBadge = () => (
  <span style={{ backgroundColor: "#f1f0eb", color: "#aaa", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "3px", marginLeft: "6px", display: "inline-block", lineHeight: "1.6", verticalAlign: "middle" }}>任意</span>
);

export default function Home() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [enthusiasmLevel, setEnthusiasmLevel] = useState<number>(2);
  const [jobContent, setJobContent] = useState<string>("");
  const [jobVolume, setJobVolume] = useState<string>("");
  const [requiredSkills, setRequiredSkills] = useState<string>("");
  const [continuity, setContinuity] = useState<"single" | "ongoing" | "undecided" | null>(null);
  const [priorities, setPriorities] = useState<string>("");
  const [ngConditions, setNgConditions] = useState<string>("");
  const [officeVisit, setOfficeVisit] = useState<"yes" | "no" | null>(null);
  const [officeVisitNote, setOfficeVisitNote] = useState<string>("");
  const [applicationItems, setApplicationItems] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [budgetUnit, setBudgetUnit] = useState<string>("円");
  const [deadlineDays, setDeadlineDays] = useState<number | null>(null);
  const [generatedText, setGeneratedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [tokenUsage, setTokenUsage] = useState<{ inputTokens: number; outputTokens: number } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const currentCategories: Category[] =
    platform ? (categories[platform] as Category[]) : [];

  const currentPriceRange: PriceRange | null =
    selectedSubcategory?.priceRange ?? selectedCategory?.priceRange ?? null;

  const handlePlatformChange = (p: Platform) => {
    setPlatform(p);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setBudget("");
    setDeadlineDays(null);
    setGeneratedText("");
    setError("");
  };

  const handleCategoryChange = (catId: string) => {
    const cat = currentCategories.find((c) => c.id === catId) || null;
    setSelectedCategory(cat);
    setSelectedSubcategory(null);
    setBudget("");
    setPaymentType(null);
    if (cat?.priceRange) setBudgetUnit(cat.priceRange.unit);
  };

  const handleSubcategoryChange = (subName: string) => {
    const sub = selectedCategory?.subcategories.find((s) => s.name === subName) || null;
    setSelectedSubcategory(sub);
    setBudget("");
    if (sub?.priceRange) setBudgetUnit(sub.priceRange.unit);
  };

  const handleGenerate = async () => {
    if (!platform || !selectedCategory || !paymentType || !deadlineDays || !jobContent.trim() || !requiredSkills.trim()) {
      setError("プラットフォーム・カテゴリ・支払い方式・募集期日・作業内容・必要スキルをすべて入力してください");
      return;
    }

    const jobDetails = [
      `【作業内容】\n${jobContent.trim()}`,
      jobVolume.trim() ? `【案件ボリューム・頻度】\n${jobVolume.trim()}` : "",
      continuity ? `【継続性】${continuity === "single" ? "単発" : continuity === "ongoing" ? "継続" : "未定"}` : "",
      `【必要なスキル・使用ツール】\n${requiredSkills.trim()}`,
      priorities.trim() ? `【重視するポイント】\n${priorities.trim()}` : "",
      ngConditions.trim() ? `【ご遠慮いただきたい方】\n${ngConditions.trim()}` : "",
      officeVisit === "yes"
        ? `【来社】必須ではないが来れる方は大歓迎！ぜひ一緒に働きたい${officeVisitNote.trim() ? `\nオフィス所在地：${officeVisitNote.trim()}` : ""}\n※「可能であれば〜来れる方大歓迎！！」のように、強く歓迎する表現で自然に文中に盛り込むこと。条件・必須とは書かないこと`
        : officeVisit === "no"
        ? "【来社】なし（完全リモート）"
        : "",
      applicationItems.trim() ? `【応募時に記載してほしいこと】\n${applicationItems.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    setError("");
    setIsLoading(true);
    setGeneratedText("");
    setTokenUsage(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          category: selectedCategory.name,
          subcategory: selectedSubcategory?.name || "",
          paymentType,
          enthusiasmLevel,
          jobDetails,
          budget: budget ? `${budget}${budgetUnit}` : "",
          priceRangeNote: currentPriceRange?.note || "",
          deadlineDays: deadlineDays ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成エラー");

      setGeneratedText(data.text);
      setTokenUsage(data.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setPlatform(null);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setPaymentType(null);
    setEnthusiasmLevel(2);
    setJobContent("");
    setJobVolume("");
    setRequiredSkills("");
    setContinuity(null);
    setPriorities("");
    setNgConditions("");
    setOfficeVisit(null);
    setOfficeVisitNote("");
    setApplicationItems("");
    setBudget("");
    setBudgetUnit("円");
    setDeadlineDays(null);
    setGeneratedText("");
    setError("");
    setTokenUsage(null);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #e5e4df",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#333",
    backgroundColor: "#fafaf8",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "26px 28px",
    marginBottom: "14px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.035)",
  };

  const stepLabelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#444",
    marginBottom: "8px",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0efe9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* ヘッダー */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #e8e7e2", padding: "0 32px" }}>
        <div style={{ maxWidth: "780px", margin: "0 auto", padding: "18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "30px", height: "30px", backgroundColor: "#1a1a1a", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogoIcon />
            </div>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>募集文ジェネレーター</span>
          </div>
          <span style={{ fontSize: "12px", color: "#999" }}>CrowdWorks · Lancers</span>
        </div>
      </div>

      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ページタイトル */}
        <div style={{ marginBottom: "36px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#1a1a1a", margin: 0, lineHeight: 1.3 }}>
            募集文を作成する
          </h1>
          <p style={{ fontSize: "14px", color: "#888", margin: "8px 0 0" }}>
            必要事項を入力すると、AIが最適化された募集文を生成します
          </p>
        </div>

        {/* STEP 1: プラットフォーム */}
        <div style={cardStyle}>
          <div style={stepLabelStyle}>
            <span style={{ backgroundColor: "#1a1a1a", color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>1</span>
            プラットフォーム
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {(["crowdworks", "lancers"] as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePlatformChange(p)}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: platform === p ? "1.5px solid #1a1a1a" : "1.5px solid #e5e4df",
                  backgroundColor: platform === p ? "#1a1a1a" : "#fff",
                  color: platform === p ? "#fff" : "#555",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {p === "crowdworks" ? "クラウドワークス" : "ランサーズ"}
              </button>
            ))}
          </div>
        </div>

        {/* STEP 2: カテゴリ */}
        {platform && (
          <div style={cardStyle}>
            <div style={stepLabelStyle}>
              <span style={{ backgroundColor: "#1a1a1a", color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>2</span>
              カテゴリ
            </div>
            <select
              value={selectedCategory?.id || ""}
              onChange={(e) => handleCategoryChange(e.target.value)}
              style={{ ...inputStyle, marginBottom: "12px" }}
            >
              <option value="">カテゴリを選択</option>
              {currentCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {selectedCategory && (
              <>
                <select
                  value={selectedSubcategory?.name || ""}
                  onChange={(e) => handleSubcategoryChange(e.target.value)}
                  style={{ ...inputStyle }}
                >
                  <option value="">サブカテゴリ（任意）</option>
                  {selectedCategory.subcategories.map((sub) => (
                    <option key={sub.name} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
                {currentPriceRange && (
                  <div style={{ marginTop: "12px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "10px 14px" }}>
                    <p style={{ fontSize: "12px", color: "#92400e", margin: 0, fontWeight: 500 }}>
                      公式相場：{formatPrice(currentPriceRange.min)}〜{formatPrice(currentPriceRange.max)}{currentPriceRange.unit}
                    </p>
                    {currentPriceRange.note && (
                      <p style={{ fontSize: "12px", color: "#b45309", margin: "4px 0 0" }}>{currentPriceRange.note}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP 3: 支払い方式 */}
        {selectedCategory && (
          <div style={cardStyle}>
            <div style={stepLabelStyle}>
              <span style={{ backgroundColor: "#1a1a1a", color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>3</span>
              支払い方式
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {PAYMENT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setPaymentType(pt.value)}
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: paymentType === pt.value ? "1.5px solid #1a1a1a" : "1.5px solid #e5e4df",
                    backgroundColor: paymentType === pt.value ? "#1a1a1a" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "3px", color: paymentType === pt.value ? "#fff" : "#333" }}>
                    {pt.label}
                  </div>
                  <div style={{ fontSize: "12px", color: paymentType === pt.value ? "rgba(255,255,255,0.7)" : "#999" }}>
                    {pt.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: 募集トーン */}
        {selectedCategory && (
          <div style={cardStyle}>
            <div style={stepLabelStyle}>
              <span style={{ backgroundColor: "#1a1a1a", color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>4</span>
              募集トーン
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {ENTHUSIASM_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setEnthusiasmLevel(level.value)}
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: enthusiasmLevel === level.value ? "1.5px solid #1a1a1a" : "1.5px solid #e5e4df",
                    backgroundColor: enthusiasmLevel === level.value ? "#1a1a1a" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "3px", color: enthusiasmLevel === level.value ? "#fff" : "#333" }}>
                    {level.label}
                  </div>
                  <div style={{ fontSize: "11px", color: enthusiasmLevel === level.value ? "rgba(255,255,255,0.7)" : "#999" }}>
                    {level.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: 募集金額 */}
        {selectedCategory && (
          <div style={cardStyle}>
            <div style={stepLabelStyle}>
              <span style={{ backgroundColor: "#1a1a1a", color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>5</span>
              募集金額
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>未入力の場合は金額なしで生成</span>
            </div>
            {currentPriceRange && (
              <p style={{ fontSize: "12px", color: "#b45309", marginBottom: "12px", marginTop: 0 }}>
                公式相場：{formatPrice(currentPriceRange.min)}〜{formatPrice(currentPriceRange.max)}{currentPriceRange.unit}
              </p>
            )}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder={currentPriceRange ? `例：${formatPrice(currentPriceRange.min)}` : "例：50,000"}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="text"
                value={budgetUnit}
                onChange={(e) => setBudgetUnit(e.target.value)}
                placeholder="単位"
                style={{ ...inputStyle, width: "90px", flex: "none" }}
              />
            </div>
          </div>
        )}

        {/* STEP 6: 募集期日 */}
        {selectedCategory && platform && (
          <div style={cardStyle}>
            <div style={stepLabelStyle}>
              <span style={{ backgroundColor: "#1a1a1a", color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>6</span>
              募集期日
              <span style={{ marginLeft: "4px", fontSize: "11px", color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {platform === "crowdworks" ? "（最長14日）" : "（最長7日）"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {DEADLINE_OPTIONS[platform].map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setDeadlineDays(deadlineDays === opt.days ? null : opt.days)}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "10px",
                    border: deadlineDays === opt.days ? "1.5px solid #1a1a1a" : "1.5px solid #e5e4df",
                    backgroundColor: deadlineDays === opt.days ? "#1a1a1a" : "#fff",
                    color: deadlineDays === opt.days ? "#fff" : "#555",
                    fontWeight: 500,
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: 業務詳細 */}
        {selectedCategory && (
          <div style={cardStyle}>
            <div style={stepLabelStyle}>
              <span style={{ backgroundColor: "#1a1a1a", color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>7</span>
              業務詳細
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

              <div>
                <label style={labelStyle}>作業内容 <RequiredBadge /></label>
                <TextareaWithMic
                  value={jobContent}
                  setValue={setJobContent}
                  placeholder={"例：企業の施設・サービスを紹介するショート動画の編集\n・用途：Instagram Reels / TikTok（縦型9:16、30〜60秒）\n・弊社カメラマンが撮影した素材を支給、編集のみお任せ"}
                  rows={4}
                />
              </div>

              <div>
                <label style={labelStyle}>案件ボリューム・頻度 <OptionalBadge /></label>
                <InputWithMic
                  value={jobVolume}
                  setValue={setJobVolume}
                  placeholder="例：月4本 / 1本あたり2〜3時間 / 半年〜1年の継続案件が多いです"
                />
              </div>

              <div>
                <label style={labelStyle}>継続性 <OptionalBadge /></label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {([
                    { value: "single", label: "単発" },
                    { value: "ongoing", label: "継続" },
                    { value: "undecided", label: "未定" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setContinuity(continuity === opt.value ? null : opt.value)}
                      style={{
                        padding: "9px 20px",
                        borderRadius: "9px",
                        border: continuity === opt.value ? "1.5px solid #1a1a1a" : "1.5px solid #e5e4df",
                        backgroundColor: continuity === opt.value ? "#1a1a1a" : "#fff",
                        color: continuity === opt.value ? "#fff" : "#555",
                        fontWeight: 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "inherit",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>必要なスキル・使用ツール <RequiredBadge /></label>
                <TextareaWithMic
                  value={requiredSkills}
                  setValue={setRequiredSkills}
                  placeholder={"例：\n・Adobe Premiere Pro等の有料ツール使用経験\n・動画編集歴1年以上（スクール期間除く）\n・ポートフォリオあること"}
                  rows={4}
                />
              </div>

              <div>
                <label style={labelStyle}>重視するポイント <OptionalBadge /></label>
                <TextareaWithMic
                  value={priorities}
                  setValue={setPriorities}
                  placeholder={"例：\n・クオリティ重視（企業プロモーション系の実績歓迎）\n・納期厳守（遅れる場合は事前連絡できる方）\n・レスポンスが早い方"}
                  rows={3}
                />
              </div>

              <div>
                <label style={labelStyle}>ご遠慮いただきたい方 <OptionalBadge /></label>
                <TextareaWithMic
                  value={ngConditions}
                  setValue={setNgConditions}
                  placeholder={"例：\n・YouTube編集・ショート動画編集がメインの方\n・納期に遅れる＆連絡もない方\n・ポートフォリオがない方"}
                  rows={3}
                />
              </div>

              <div>
                <label style={labelStyle}>来社 <OptionalBadge /></label>
                <div style={{ display: "flex", gap: "8px", marginBottom: officeVisit === "yes" ? "10px" : "0" }}>
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setOfficeVisit(officeVisit === v ? null : v)}
                      style={{
                        padding: "8px 20px",
                        borderRadius: "8px",
                        border: officeVisit === v ? "2px solid #333" : "2px solid #e5e4df",
                        backgroundColor: officeVisit === v ? "#333" : "#fafaf8",
                        color: officeVisit === v ? "#fff" : "#555",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      {v === "yes" ? "あり" : "なし"}
                    </button>
                  ))}
                </div>
                {officeVisit === "yes" && (
                  <InputWithMic
                    value={officeVisitNote}
                    setValue={setOfficeVisitNote}
                    placeholder="例：東京都中央区日本橋付近（週1〜2回）"
                  />
                )}
              </div>

              <div>
                <label style={labelStyle}>応募時に記載してほしいこと <OptionalBadge /></label>
                <TextareaWithMic
                  value={applicationItems}
                  setValue={setApplicationItems}
                  placeholder={"例：\n・簡単な自己紹介\n・業務経験・実績\n・ポートフォリオURL\n・使用ツール\n・希望単価\n・稼働可能時間"}
                  rows={4}
                />
              </div>

            </div>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "14px 18px", marginBottom: "16px", fontSize: "13px", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {/* 生成ボタン */}
        {selectedCategory && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              style={{
                flex: 1,
                backgroundColor: isLoading ? "#666" : "#1a1a1a",
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
                padding: "16px 24px",
                borderRadius: "12px",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "background-color 0.15s",
                fontFamily: "inherit",
                letterSpacing: "0.01em",
              }}
            >
              {isLoading ? "生成中..." : "募集文を生成する"}
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1.5px solid #e8e7e2",
                backgroundColor: "#fff",
                color: "#666",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              リセット
            </button>
          </div>
        )}

        {/* 生成結果 */}
        {generatedText && (
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>生成結果</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {tokenUsage && (
                  <span style={{ fontSize: "11px", color: "#bbb" }}>
                    {tokenUsage.inputTokens + tokenUsage.outputTokens} tokens
                  </span>
                )}
                <button
                  onClick={handleCopy}
                  style={{
                    fontSize: "12px",
                    backgroundColor: copied ? "#f0fdf4" : "#f5f4ef",
                    color: copied ? "#16a34a" : "#555",
                    border: copied ? "1px solid #bbf7d0" : "1px solid #e8e7e2",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                    fontWeight: 500,
                  }}
                >
                  {copied ? "コピー済み ✓" : "コピー"}
                </button>
              </div>
            </div>
            <pre style={{ fontSize: "13px", color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.8, margin: 0, fontFamily: "inherit" }}>
              {generatedText}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
