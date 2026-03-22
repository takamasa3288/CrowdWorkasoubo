"use client";

import { useState, useRef, useCallback } from "react";
import categories from "@/data/categories.json";

// 音声入力フック
function useVoiceInput(onResult: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const toggle = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("このブラウザは音声入力に対応していません（Chrome推奨）");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording, onResult]);

  return { isRecording, toggle };
}

// マイクボタンコンポーネント
function MicButton({ value, setValue }: { value: string; setValue: (v: string) => void }) {
  const append = useCallback((text: string) => {
    setValue(value ? value + "\n" + text : text);
  }, [value, setValue]);

  const { isRecording, toggle } = useVoiceInput(append);

  return (
    <button
      type="button"
      onClick={toggle}
      title={isRecording ? "録音中（クリックで停止）" : "音声入力"}
      style={{
        position: "absolute",
        right: "10px",
        bottom: "10px",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "none",
        backgroundColor: isRecording ? "#ef4444" : "#e8e7e2",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s",
        flexShrink: 0,
        boxShadow: isRecording ? "0 0 0 3px rgba(239,68,68,0.25)" : "none",
      }}
    >
      {isRecording ? (
        // 録音中：波形アイコン
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <rect x="3" y="8" width="3" height="8" rx="1.5"/>
          <rect x="8.5" y="4" width="3" height="16" rx="1.5"/>
          <rect x="14" y="6" width="3" height="12" rx="1.5"/>
          <rect x="19.5" y="9" width="3" height="6" rx="1.5"/>
        </svg>
      ) : (
        // 待機中：マイクアイコン
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#555">
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
          <path d="M19 10a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V21H9v2h6v-2h-2v-2.06A9 9 0 0 0 21 10h-2z"/>
        </svg>
      )}
    </button>
  );
}

type Platform = "crowdworks" | "lancers";

interface PriceRange {
  min: number;
  max: number;
  unit: string;
  note?: string;
}

interface Subcategory {
  name: string;
  priceRange: PriceRange;
}

interface Category {
  id: string;
  name: string;
  priceRange: PriceRange;
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
  const [workLocation, setWorkLocation] = useState<string>("");
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
    if (cat) setBudgetUnit(cat.priceRange.unit);
  };

  const handleSubcategoryChange = (subName: string) => {
    const sub = selectedCategory?.subcategories.find((s) => s.name === subName) || null;
    setSelectedSubcategory(sub);
    setBudget("");
    if (sub) setBudgetUnit(sub.priceRange.unit);
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
      workLocation.trim() ? `【来社・勤務形態】\n${workLocation.trim()}` : "",
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
    setWorkLocation("");
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
    border: "1px solid #e8e7e2",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#333",
    backgroundColor: "#fafaf8",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "28px 32px",
    marginBottom: "16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
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
            <div style={{ width: "28px", height: "28px", backgroundColor: "#1a1a1a", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: "14px" }}>✦</span>
            </div>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a" }}>募集文ジェネレーター</span>
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
                  border: platform === p ? "2px solid #1a1a1a" : "2px solid #e8e7e2",
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
              style={{ ...inputStyle, marginBottom: "12px", appearance: "auto" }}
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
                  style={{ ...inputStyle, appearance: "auto" }}
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
                    border: paymentType === pt.value ? "2px solid #1a1a1a" : "2px solid #e8e7e2",
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
                    border: enthusiasmLevel === level.value ? "2px solid #1a1a1a" : "2px solid #e8e7e2",
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
                    border: deadlineDays === opt.days ? "2px solid #1a1a1a" : "2px solid #e8e7e2",
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
                <div style={{ position: "relative" }}>
                  <textarea
                    value={jobContent}
                    onChange={(e) => setJobContent(e.target.value)}
                    placeholder={"例：企業の施設・サービスを紹介するショート動画の編集\n・用途：Instagram Reels / TikTok（縦型9:16、30〜60秒）\n・弊社カメラマンが撮影した素材を支給、編集のみお任せ"}
                    rows={4}
                    style={{ ...inputStyle, resize: "none", paddingBottom: "44px" }}
                  />
                  <MicButton value={jobContent} setValue={setJobContent} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>案件ボリューム・頻度 <OptionalBadge /></label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={jobVolume}
                    onChange={(e) => setJobVolume(e.target.value)}
                    placeholder="例：月4本 / 1本あたり2〜3時間 / 半年〜1年の継続案件が多いです"
                    style={{ ...inputStyle, paddingRight: "48px" }}
                  />
                  <MicButton value={jobVolume} setValue={setJobVolume} />
                </div>
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
                        border: continuity === opt.value ? "2px solid #1a1a1a" : "2px solid #e8e7e2",
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
                <div style={{ position: "relative" }}>
                  <textarea
                    value={requiredSkills}
                    onChange={(e) => setRequiredSkills(e.target.value)}
                    placeholder={"例：\n・Adobe Premiere Pro等の有料ツール使用経験\n・動画編集歴1年以上（スクール期間除く）\n・ポートフォリオあること"}
                    rows={4}
                    style={{ ...inputStyle, resize: "none", paddingBottom: "44px" }}
                  />
                  <MicButton value={requiredSkills} setValue={setRequiredSkills} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>重視するポイント <OptionalBadge /></label>
                <div style={{ position: "relative" }}>
                  <textarea
                    value={priorities}
                    onChange={(e) => setPriorities(e.target.value)}
                    placeholder={"例：\n・クオリティ重視（企業プロモーション系の実績歓迎）\n・納期厳守（遅れる場合は事前連絡できる方）\n・レスポンスが早い方"}
                    rows={3}
                    style={{ ...inputStyle, resize: "none", paddingBottom: "44px" }}
                  />
                  <MicButton value={priorities} setValue={setPriorities} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>ご遠慮いただきたい方 <OptionalBadge /></label>
                <div style={{ position: "relative" }}>
                  <textarea
                    value={ngConditions}
                    onChange={(e) => setNgConditions(e.target.value)}
                    placeholder={"例：\n・YouTube編集・ショート動画編集がメインの方\n・納期に遅れる＆連絡もない方\n・ポートフォリオがない方"}
                    rows={3}
                    style={{ ...inputStyle, resize: "none", paddingBottom: "44px" }}
                  />
                  <MicButton value={ngConditions} setValue={setNgConditions} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>来社・勤務形態 <OptionalBadge /></label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    placeholder="例：完全リモート / 東京都中央区（週1〜2回の来社が望ましい）"
                    style={{ ...inputStyle, paddingRight: "48px" }}
                  />
                  <MicButton value={workLocation} setValue={setWorkLocation} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>応募時に記載してほしいこと <OptionalBadge /></label>
                <div style={{ position: "relative" }}>
                  <textarea
                    value={applicationItems}
                    onChange={(e) => setApplicationItems(e.target.value)}
                    placeholder={"例：\n・簡単な自己紹介\n・業務経験・実績\n・ポートフォリオURL\n・使用ツール\n・希望単価\n・稼働可能時間"}
                    rows={4}
                    style={{ ...inputStyle, resize: "none", paddingBottom: "44px" }}
                  />
                  <MicButton value={applicationItems} setValue={setApplicationItems} />
                </div>
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
