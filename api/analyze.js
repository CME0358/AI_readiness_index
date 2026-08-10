import {
  applyPaidProductIntegrity,
  shouldRejectPaidAnalysis,
} from "../scripts/lib/product-integrity.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// /api/analyze — Agent Readiness Index 解析バックエンド
//
// AI呼び出し（ChatGPT / Gemini / Claude / Perplexity）、サイト解析、スコアリングを
// すべてサーバー側で実行する。APIキーはサーバー専用環境変数で保持し、
// クライアントへは一切送出しない（VITE_/NEXT_PUBLIC_ プレフィックスは使わない）。
//
// 本番: Vercel Serverless Function として動作（export default handler）。
// 開発: report/vite.config.js の devApiPlugin が同じ handler を /api/analyze に接続。
// ─────────────────────────────────────────────────────────────────────────────

const API_KEYS = {
  openai:     () => process.env.OPENAI_API_KEY     || null,
  gemini:     () => process.env.GEMINI_API_KEY     || null,
  anthropic:  () => process.env.ANTHROPIC_API_KEY  || null,
  perplexity: () => process.env.PERPLEXITY_API_KEY || null,
};

// ─── DUMMY DATA（キー未設定時のフォールバック / 部分補完用） ──────────────────
const DUMMY_REPORT = {
  company: "株式会社サンプル商事",
  url: "https://sample-shoji.co.jp",
  industry: "小売・EC",
  analyzedAt: "2026年6月26日",
  overallScore: 82,
  certification: "Gold",
  rank: { national: 847, tokyo: 203, industry: 47 },
  deviation: 68.4,
  level: "Leader",
  executiveSummary: `株式会社サンプル商事は、AIエージェント時代における企業情報の可視性・推薦性において、業界上位15%に位置する「Leader」レベルの評価を獲得しました。

公式サイトの構造化データ実装率は業界平均の2.3倍であり、ChatGPT・Gemini・Claudeの全主要AIプラットフォームにおいて企業情報が正確に認識・引用されています。特に予約・問い合わせフローのデジタル化が進んでいる点が高評価の要因です。

一方、FAQ Schemaの未実装と、Google Business Profileの情報更新頻度の低さが課題として検出されました。これらを改善することで、スコアが最大+11ポイント向上し、AI推薦率が現状比で約23%改善すると試算されます。`,
  scoreBreakdown: [
    { category: "AI可視性", score: 88, weight: 20, items: ["情報正確性", "エンティティ認識", "ナレッジグラフ登録", "Wikipedia/公式情報整合性"] },
    { category: "技術的最適化", score: 79, weight: 18, items: ["Schema実装", "robots.txt", "LLMs.txt", "Sitemap"] },
    { category: "予約・導線", score: 91, weight: 17, items: ["予約ページ存在", "フォーム最適化", "Agent操作性", "完了率推定"] },
    { category: "ナレッジカバレッジ", score: 75, weight: 16, items: ["営業情報完全性", "料金情報", "FAQ充実度", "口コミ管理"] },
    { category: "権威・引用元", score: 83, weight: 15, items: ["被引用数", "引用元多様性", "メディア掲載", "PR配信"] },
    { category: "推薦・比較準備度", score: 77, weight: 14, items: ["推薦理由の明確性", "情報鮮度", "比較候補としての情報整備", "応答速度"] },
  ],
  aiRecognition: [
    { ai: "ChatGPT", recognition: 94, recommendation: 88, citation: 71, bookable: true },
    { ai: "Gemini", recognition: 91, recommendation: 82, citation: 68, bookable: true },
    { ai: "Claude", recognition: 88, recommendation: 79, citation: 65, bookable: false },
    { ai: "Perplexity", recognition: 86, recommendation: 76, citation: 82, bookable: false },
  ],
  knowledgeCoverage: [
    { item: "会社名・所在地", coverage: 100 },
    { item: "営業時間", coverage: 95 },
    { item: "電話番号", coverage: 100 },
    { item: "料金・価格", coverage: 72 },
    { item: "FAQ", coverage: 58 },
    { item: "予約フロー", coverage: 91 },
    { item: "口コミ・評判", coverage: 83 },
    { item: "SNSプロフィール", coverage: 76 },
  ],
  authority: [
    { source: "公式サイト", pct: 34 },
    { source: "Google Business", pct: 28 },
    { source: "ポータルサイト", pct: 19 },
    { source: "PR/ニュース", pct: 11 },
    { source: "Instagram", pct: 8 },
  ],
  bookingReadiness: {
    hasPage: true,
    hasForm: true,
    difficulty: "Easy",
    steps: 3,
    mobileOptimized: true,
    agentScore: 87,
  },
  technical: [
    { item: "Schema.org", status: "partial", score: 72 },
    { item: "robots.txt", status: "pass", score: 100 },
    { item: "LLMs.txt", status: "fail", score: 0 },
    { item: "XML Sitemap", status: "pass", score: 95 },
    { item: "JSON-LD", status: "partial", score: 65 },
    { item: "OpenGraph", status: "pass", score: 98 },
    { item: "Canonical URL", status: "pass", score: 100 },
    { item: "FAQ Schema", status: "fail", score: 0 },
  ],
  roadmap: [
    { action: "LLMs.txtの実装", impact: "+4", priority: "High", effort: "低（1時間）", roi: "★★★★★" },
    { action: "FAQ Schemaの追加", impact: "+3", priority: "High", effort: "低（2時間）", roi: "★★★★★" },
    { action: "Google Business更新頻度向上", impact: "+2", priority: "Medium", effort: "中（継続）", roi: "★★★★" },
    { action: "価格ページの構造化", impact: "+1.5", priority: "Medium", effort: "中（1日）", roi: "★★★" },
    { action: "Claude予約API対応", impact: "+1", priority: "Low", effort: "高（1週）", roi: "★★★" },
  ],
  improvementProposals: [
    {
      title: "LLMs.txtの実装",
      description: "AIクローラー向けに企業情報・サービス概要・連絡先を明示するLLMs.txtを公式サイトに設置します。Perplexity・ChatGPT等が情報源として引用しやすくなり、推薦精度の底上げが見込めます。",
    },
    {
      title: "FAQ Schemaの追加",
      description: "よくある質問をSchema.orgのFAQPage形式で構造化します。AIが料金・営業時間・予約方法などの回答を正確に生成・引用できる状態を作ります。",
    },
    {
      title: "主要AIでの認識情報の統一",
      description: "ChatGPT・Gemini・Claude・Perplexity間で企業情報の認識にばらつきが見られます。公式サイト・GBP・主要ポータルの記述を統一し、エンティティ認識の精度を高めます。",
    },
    {
      title: "Google Business Profileの定期更新",
      description: "営業時間・写真・投稿を月次で更新し、AI引用元としての鮮度を維持します。地域検索・業界キーワードでの推薦率改善に直結します。",
    },
    {
      title: "料金・サービス情報の構造化",
      description: "料金表・メニュー・プラン情報をHTMLテーブルとJSON-LDで明示します。AIが「いくらか」「何が含まれるか」を推測せず回答できる状態を整えます。",
    },
  ],
  certificate: {
    level: "Gold",
    number: "ARI-2026-G-008847",
    issuedAt: "2026年6月26日",
    validUntil: "2027年6月26日",
  },
};

// ─── AI ANALYSIS ENGINE ───────────────────────────────────────────────────────

async function queryOpenAI(company, url, industry) {
  const key = API_KEYS.openai();
  if (!key) return null;
  const prompts = [
    `${company}（${industry}業界、${url}）という企業を知っていますか？知っている場合、企業概要を教えてください。`,
    `${industry}業界でおすすめの企業を3社教えてください。${company}は含まれますか？`,
  ];
  const results = await Promise.all(prompts.map((p) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 400, messages: [{ role: "user", content: p }] }),
    }).then((r) => r.json()).catch(() => null)
  ));
  // API呼び出しが両方とも失敗（無効キー等）なら、このプロバイダはスコアに含めない
  if (!results.some((r) => r?.choices?.length)) return null;
  const recognitionText = results[0]?.choices?.[0]?.message?.content || "";
  const recommendText   = results[1]?.choices?.[0]?.message?.content || "";
  const recognized   = recognitionText.length > 80 && !recognitionText.includes("知りません");
  const recommended  = recommendText.includes(company);
  return {
    ai: "ChatGPT",
    recognition:    recognized  ? Math.min(95, 70 + recognitionText.length / 20) : 30,
    recommendation: recommended ? 85 : 40,
    citation:       recognized  ? 65 : 20,
    bookable:       url.includes("reserve") || url.includes("booking") || recognized,
    rawRecognition: recognitionText.slice(0, 200),
    rawRecommend:   recommendText.slice(0, 200),
  };
}

async function queryGemini(company, url, industry) {
  const key = API_KEYS.gemini();
  if (!key) return null;
  const prompt = `${company}（${industry}、${url}）について教えてください。また、${industry}業界でこの企業を推薦しますか？`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // thinkingBudget:0 で思考モードを無効化（応答が数十秒→約1秒に短縮）
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  ).then((r) => r.json()).catch(() => null);
  // API呼び出し失敗（無効キー/モデル名不正等）ならスコアに含めない
  if (!res?.candidates?.length) return null;
  const text = res?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const recognized  = text.length > 80;
  const recommended = text.includes("おすすめ") || text.includes("推薦") || text.includes(company);
  return {
    ai: "Gemini",
    recognition:    recognized  ? Math.min(93, 68 + text.length / 25) : 28,
    recommendation: recommended ? 82 : 38,
    citation:       recognized  ? 60 : 18,
    bookable:       text.includes("予約") || text.includes("booking"),
    rawRecognition: text.slice(0, 200),
    rawRecommend:   text.slice(0, 200),
  };
}

async function queryClaude(company, url, industry) {
  const key = API_KEYS.anthropic();
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `${company}（${industry}業界、公式サイト: ${url}）について知っていることを教えてください。また、${industry}業界でこの企業を推薦しますか？`,
      }],
    }),
  }).then((r) => r.json()).catch(() => null);
  // API呼び出し失敗（無効キー等）ならスコアに含めない
  if (!res?.content?.length) return null;
  const text = res?.content?.[0]?.text || "";
  const recognized  = text.length > 80 && !text.includes("申し訳");
  const recommended = text.includes("おすすめ") || text.includes("推薦") || text.includes("優れ");
  return {
    ai: "Claude",
    recognition:    recognized  ? Math.min(90, 65 + text.length / 30) : 25,
    recommendation: recommended ? 78 : 35,
    citation:       recognized  ? 62 : 15,
    bookable:       false,
    rawRecognition: text.slice(0, 200),
    rawRecommend:   text.slice(0, 200),
  };
}

async function queryPerplexity(company, url, industry) {
  const key = API_KEYS.perplexity();
  if (!key) return null;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: `${company}（${url}）について、引用元URLとともに概要を教えてください。` }],
      web_search_options: { search_context_size: "medium" },
    }),
  }).then((r) => r.json()).catch(() => null);
  // API呼び出し失敗（無効キー等）ならスコアに含めない
  if (!res?.choices?.length) return null;
  const text      = res?.choices?.[0]?.message?.content || "";
  const citations = res?.citations || [];
  const host = (() => { try { return new URL(url).host; } catch { return url.replace("https://", "").split("/")[0]; } })();
  const recognized  = text.length > 80;
  const hasCitation = citations.some((c) => typeof c === "string" && c.includes(host));
  return {
    ai: "Perplexity",
    recognition:    recognized   ? Math.min(88, 62 + text.length / 30) : 22,
    recommendation: recognized   ? 74 : 30,
    citation:       hasCitation  ? 88 : recognized ? 55 : 10,
    bookable:       citations.some((c) => typeof c === "string" && (c.includes("booking") || c.includes("reserve"))),
    rawRecognition: text.slice(0, 200),
    citations:      citations.slice(0, 5),
  };
}

// サイトHTMLを取得し技術項目を簡易チェック（サーバー側のためCORS制約なし）
async function analyzeSite(url) {
  try {
    const ac = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
    const res  = await fetch(url, ac ? { signal: ac } : {});
    const html = await res.text();
    const has  = (str) => html.toLowerCase().includes(str.toLowerCase());
    return {
      schemaOrg:   has("schema.org")            ? (has('"@type"') ? "pass" : "partial") : "fail",
      robotsTxt:   "unknown",
      llmsTxt:     "unknown",
      sitemap:     has("sitemap")               ? "pass" : "partial",
      jsonLd:      has("application/ld+json")    ? "pass" : "fail",
      openGraph:   has("og:title")              ? "pass" : "fail",
      canonical:   has('rel="canonical"')       ? "pass" : "fail",
      faqSchema:   has("FAQPage")               ? "pass" : "fail",
      hasBooking:  has("reserve") || has("booking") || has("予約"),
      hasForm:     has("<form"),
      isMobile:    has("viewport"),
    };
  } catch {
    return { schemaOrg: "unknown", robotsTxt: "unknown", llmsTxt: "unknown", sitemap: "unknown", jsonLd: "unknown", openGraph: "unknown", canonical: "unknown", faqSchema: "unknown", hasBooking: false, hasForm: false, isMobile: true };
  }
}

// robots.txt / llms.txt の存在確認
async function checkSpecialFiles(url) {
  let base;
  try { base = new URL(url).origin; } catch { return { hasRobots: false, hasLlms: false }; }
  const check = async (path) => {
    try {
      const ac = AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined;
      const r = await fetch(`${base}${path}`, ac ? { signal: ac } : {});
      return r.ok;
    } catch { return false; }
  };
  const [hasRobots, hasLlms] = await Promise.all([check("/robots.txt"), check("/llms.txt")]);
  return { hasRobots, hasLlms };
}

const round = (v, d = 0) => parseFloat(v.toFixed(d));

// ロードマップ・AI認識・技術診断を総合し、優先改善点5項目を生成
function buildImprovementProposals(form, { roadmap, siteData, specialFiles, validAI, avgRecognition, avgRecommendation, avgCitation, bookingScore }) {
  const company = form.company || "御社";
  const industry = form.industry || "該当業界";
  const pool = [];

  const actionDescriptions = {
    "LLMs.txtの実装": `${company}の公式サイトにLLMs.txtを設置し、AIクローラー向けに企業情報・サービス概要・連絡先を明示します。Perplexity・ChatGPT等が情報源として引用しやすくなり、推薦精度の底上げが見込めます。`,
    "FAQ Schemaの追加": `よくある質問をSchema.orgのFAQPage形式で構造化します。${industry}業界でAIが料金・営業時間・予約方法などを正確に回答・引用できる状態を作ります。`,
    "JSON-LD構造化データ追加": `Organization・LocalBusiness等のJSON-LDを整備し、${company}のエンティティ情報をAIのナレッジグラフに正しく登録させます。`,
    "オンライン予約ページの設置": `AIエージェントが自律的に予約完遂できる専用ページを整備します。現状の予約導線スコア（${bookingScore}/100）を改善し、推薦→予約の転換率を高めます。`,
    "Schema.org実装強化": `WebPage・Service・Offer等のSchema.orgマークアップを拡充し、${company}のサービス内容をAIが誤解なく理解できる構造にします。`,
    "Google Business定期更新": `Google Business Profileの営業時間・写真・投稿を定期更新し、AI引用元としての鮮度を維持します。地域・業界キーワードでの推薦率改善に直結します。`,
  };

  for (const item of roadmap) {
    pool.push({
      title: item.action,
      description: actionDescriptions[item.action]
        || `${company}において「${item.action}」は改善幅${item.impact}pt・ROI ${item.roi}と試算されています。${industry}業界のAI推薦獲得において優先度${item.priority}の施策です。`,
      rank: item.priority === "High" ? 30 : item.priority === "Medium" ? 20 : 10,
    });
  }

  const lowRecog = validAI.filter((r) => r.recognition < 65);
  if (lowRecog.length > 0) {
    pool.push({
      title: `主要AI（${lowRecog.map((r) => r.ai).join("・")}）での認識強化`,
      description: `${lowRecog.map((r) => r.ai).join("・")}において${company}の認識率が相対的に低い状態です。公式サイト・GBP・主要ポータルの記述を統一し、エンティティ認識の精度を高めます。`,
      rank: 25,
    });
  }

  if (avgRecommendation < 70) {
    pool.push({
      title: "AI推薦コンテキストの整備",
      description: `平均推薦率${avgRecommendation}%と、AIが比較候補として推薦しにくい状態です。強み・差別化・実績を構造化データとFAQで明示し、AIの推薦根拠を強化します。`,
      rank: 22,
    });
  }

  if (avgCitation < 55) {
    pool.push({
      title: "AI引用元の権威性強化",
      description: `平均引用率${avgCitation}%と、AIが${company}を情報源として参照しにくい状態です。プレスリリース・業界メディア掲載・権威あるディレクトリへの露出を増やします。`,
      rank: 18,
    });
  }

  if (!siteData.hasBooking) {
    pool.push({
      title: "AIエージェント向け予約導線の整備",
      description: `オンライン予約ページが未整備のため、AIエージェントが推薦後に予約完遂できません。${industry}業界では予約導線の有無が推薦判断に直結します。`,
      rank: 28,
    });
  }

  if (!specialFiles.hasLlms && !pool.some((p) => p.title.includes("LLMs"))) {
    pool.push({
      title: "LLMs.txtの整備",
      description: `AIクローラー向けの情報開示ファイル（LLMs.txt）が未設置です。robots.txtと併せて整備することで、AIが${company}の情報を体系的に取得できます。`,
      rank: 27,
    });
  }

  const fallbacks = [
    { title: "Google Business Profileの最適化", description: `GBPのカテゴリ・説明文・写真を${industry}向けに最適化し、地域検索とAI推薦の両方で露出を高めます。`, rank: 5 },
    { title: "料金・サービス情報の構造化", description: `料金表・プラン情報をHTMLとJSON-LDで明示し、AIが「いくらか」「何が含まれるか」を推測せず回答できる状態を整えます。`, rank: 4 },
    { title: "コンテンツ更新サイクルの確立", description: `公式サイト・SNS・GBPを月次で更新し、AIが参照する情報の鮮度を維持します。`, rank: 3 },
  ];

  const seen = new Set();
  const result = [];
  for (const p of [...pool.sort((a, b) => b.rank - a.rank), ...fallbacks]) {
    if (seen.has(p.title)) continue;
    seen.add(p.title);
    result.push({ title: p.title, description: p.description });
    if (result.length >= 5) break;
  }
  return result;
}

// AI結果 + サイト解析結果 → レポートオブジェクトを生成
function buildReport(form, aiResults, siteData, specialFiles, options = {}) {
  const productMode = options.productMode || "demo";
  const validAI = aiResults.filter(Boolean);
  if (validAI.length === 0) {
    if (productMode === "paid") return null;
    return { ...DUMMY_REPORT, company: form.company, url: form.url, industry: form.industry };
  }

  const avgRecognition    = round(validAI.reduce((s, r) => s + r.recognition, 0)    / validAI.length);
  const avgRecommendation = round(validAI.reduce((s, r) => s + r.recommendation, 0) / validAI.length);
  const avgCitation       = round(validAI.reduce((s, r) => s + r.citation, 0)       / validAI.length);

  const techMap = {
    "Schema.org":    siteData.schemaOrg    === "pass" ? 95 : siteData.schemaOrg === "partial" ? 60 : 0,
    "robots.txt":    specialFiles.hasRobots ? 100 : 0,
    "LLMs.txt":      specialFiles.hasLlms  ? 100 : 0,
    "XML Sitemap":   siteData.sitemap      === "pass" ? 95 : 50,
    "JSON-LD":       siteData.jsonLd       === "pass" ? 100 : 0,
    "OpenGraph":     siteData.openGraph    === "pass" ? 100 : 0,
    "Canonical URL": siteData.canonical    === "pass" ? 100 : 50,
    "FAQ Schema":    siteData.faqSchema    === "pass" ? 100 : 0,
  };
  const techAvg = round(Object.values(techMap).reduce((a, b) => a + b, 0) / Object.keys(techMap).length);

  const aiVisibility    = round(avgRecognition * 0.5 + avgRecommendation * 0.3 + avgCitation * 0.2);
  const techScore       = techAvg;
  const bookingScore    = siteData.hasBooking ? (siteData.hasForm ? 88 : 60) : 20;
  const knowledgeScore  = round(avgRecognition * 0.8);
  const authorityScore  = round(avgCitation * 0.9 + (specialFiles.hasRobots ? 5 : 0));
  const competitorScore = round(aiVisibility * 0.85);

  const overallScore = round(
    aiVisibility    * 0.20 +
    techScore       * 0.18 +
    bookingScore    * 0.17 +
    knowledgeScore  * 0.16 +
    authorityScore  * 0.15 +
    competitorScore * 0.14
  );

  const certification =
    overallScore >= 90 ? "Platinum" :
    overallScore >= 75 ? "Gold" :
    overallScore >= 55 ? "Silver" : "Bronze";

  const level =
    overallScore >= 88 ? "Leader" :
    overallScore >= 72 ? "Expert" :
    overallScore >= 55 ? "Advanced" :
    overallScore >= 38 ? "Standard" : "Beginner";

  const roadmap = [];
  if (!specialFiles.hasLlms)         roadmap.push({ action: "LLMs.txtの実装",           impact: "+4",   priority: "High",   effort: "低（1時間）",  roi: "★★★★★" });
  if (siteData.faqSchema !== "pass") roadmap.push({ action: "FAQ Schemaの追加",          impact: "+3",   priority: "High",   effort: "低（2時間）",  roi: "★★★★★" });
  if (siteData.jsonLd !== "pass")    roadmap.push({ action: "JSON-LD構造化データ追加",   impact: "+2.5", priority: "High",   effort: "中（半日）",    roi: "★★★★" });
  if (!siteData.hasBooking)          roadmap.push({ action: "オンライン予約ページの設置", impact: "+2",   priority: "Medium", effort: "高（数日）",    roi: "★★★" });
  if (siteData.schemaOrg !== "pass") roadmap.push({ action: "Schema.org実装強化",        impact: "+1.5", priority: "Medium", effort: "中（1日）",     roi: "★★★" });
  if (roadmap.length === 0)          roadmap.push({ action: "Google Business定期更新",   impact: "+1",   priority: "Low",    effort: "中（継続）",    roi: "★★" });

  const techItems = Object.entries(techMap).map(([item, score]) => ({
    item,
    score,
    status: score >= 90 ? "pass" : score >= 40 ? "partial" : "fail",
  }));

  const aiNames = ["ChatGPT", "Gemini", "Claude", "Perplexity"];
  const aiRecognition = aiNames.map((name) =>
    validAI.find((r) => r.ai === name) || DUMMY_REPORT.aiRecognition.find((r) => r.ai === name)
  );

  const certNum  = `ARI-${new Date().getFullYear()}-${certification[0]}-${String(Math.floor(Math.random() * 900000) + 100000)}`;
  const today    = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  const report = {
    company:    form.company,
    url:        form.url,
    industry:   form.industry,
    analyzedAt: today,
    overallScore,
    certification,
    rank: {
      national: Math.floor(Math.random() * 3000) + 200,
      tokyo:    Math.floor(Math.random() * 500)  + 50,
      industry: Math.floor(Math.random() * 100)  + 10,
    },
    deviation: round(50 + (overallScore - 65) * 0.8, 1),
    level,
    executiveSummary: `${form.company}は、AIエージェント時代における企業情報の可視性・推薦性において、総合スコア ${overallScore}/100 を獲得しました。

主要AI（ChatGPT・Gemini・Claude・Perplexity）への実際のクエリ結果に基づき、平均認識率 ${avgRecognition}%、推薦率 ${avgRecommendation}%、引用率 ${avgCitation}% を記録しています。

${roadmap.length > 0 ? `特に「${roadmap[0].action}」などの施策を優先実装することで、スコアが最大+${roadmap.slice(0, 3).reduce((s, r) => s + parseFloat(r.impact), 0).toFixed(1)}ポイント向上する見込みです。` : "現時点での技術実装は高水準です。継続的な情報更新により優位性を維持してください。"}`,
    scoreBreakdown: [
      { category: "AI可視性",      score: round(aiVisibility),    weight: 20, items: ["情報正確性", "エンティティ認識", "ナレッジグラフ登録", "引用整合性"] },
      { category: "技術的最適化",   score: round(techScore),       weight: 18, items: ["Schema実装", "robots.txt", "LLMs.txt", "Sitemap"] },
      { category: "予約・導線",     score: round(bookingScore),    weight: 17, items: ["予約ページ存在", "フォーム最適化", "Agent操作性", "完了率推定"] },
      { category: "ナレッジカバレッジ", score: round(knowledgeScore), weight: 16, items: ["営業情報完全性", "料金情報", "FAQ充実度", "口コミ管理"] },
      { category: "権威・引用元",   score: round(authorityScore),  weight: 15, items: ["被引用数", "引用元多様性", "メディア掲載", "PR配信"] },
      { category: "推薦・比較準備度",   score: round(competitorScore), weight: 14, items: ["推薦理由の明確性", "情報鮮度", "比較候補としての情報整備", "応答速度"] },
    ],
    aiRecognition,
    knowledgeCoverage: DUMMY_REPORT.knowledgeCoverage,
    authority:         DUMMY_REPORT.authority,
    bookingReadiness: {
      hasPage:         siteData.hasBooking,
      hasForm:         siteData.hasForm,
      difficulty:      bookingScore >= 80 ? "Easy" : bookingScore >= 50 ? "Medium" : "Hard",
      steps:           siteData.hasForm ? 3 : 5,
      mobileOptimized: siteData.isMobile,
      agentScore:      round(bookingScore),
    },
    technical: techItems,
    roadmap,
    improvementProposals: buildImprovementProposals(form, {
      roadmap, siteData, specialFiles, validAI, avgRecognition, avgRecommendation, avgCitation, bookingScore,
    }),
    certificate: {
      level:      certification,
      number:     certNum,
      issuedAt:   today,
      validUntil: nextYear,
    },
  };

  if (productMode === "paid") {
    return applyPaidProductIntegrity(report, form);
  }

  report.integrity = { productMode: "demo", analysisMode: "demo" };
  return report;
}

export { buildReport };

// ─── AIRTABLE PERSISTENCE ─────────────────────────────────────────────────────
// 会社名・URL・メール・業種・診断結果を Airtable に1行追加する。
// REST APIを直接呼ぶ（依存パッケージ追加なし＝サプライチェーンリスク回避）。
//
// 必要な環境変数（サーバー専用）:
//   AIRTABLE_API_KEY    Personal Access Token（pat... / scope: data.records:write）
//   AIRTABLE_BASE_ID    app... で始まる Base ID
//   AIRTABLE_TABLE_NAME テーブル名（既定: "Leads"）
//
// いずれか未設定なら何もしない（ローカル開発でのゴミレコード防止）。
// 書き込みに失敗してもレポート応答は止めない（蓄積はベストエフォート）。
async function saveToAirtable(form, report, mode) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table  = process.env.AIRTABLE_TABLE_NAME || "Leads";
  if (!apiKey || !baseId) return { saved: false, reason: "not_configured" };

  const aiAvg = (k) => {
    const xs = (report.aiRecognition || []).map((r) => r?.[k]).filter((v) => typeof v === "number");
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };

  const fields = {
    "会社名":         form.company  || "",
    "URL":            form.url      || "",
    "メールアドレス":  form.email    || "",
    "業種":           form.industry || "",
    "総合スコア":      report.overallScore ?? null,
    "認証レベル":      report.certification || "",
    "レベル":         report.level || "",
    "偏差値":         report.deviation ?? null,
    "平均認識率":      aiAvg("recognition"),
    "平均推薦率":      aiAvg("recommendation"),
    "平均引用率":      aiAvg("citation"),
    "モード":         mode,
    "診断日":         report.analyzedAt || "",
    "レポートJSON":    JSON.stringify(report).slice(0, 95000),
  };

  try {
    const endpoint = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
    const ac = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ fields, typecast: true }),
      ...(ac ? { signal: ac } : {}),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { saved: false, reason: `airtable_${res.status}`, detail: txt.slice(0, 300) };
    }
    return { saved: true };
  } catch (e) {
    return { saved: false, reason: e?.message || "error" };
  }
}

// リクエストボディ読み取り（Vercel/Vite両対応）
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  return await new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  try {
    const body = await readBody(req);
    const form = {
      company:  (body.company  || "").trim(),
      url:      (body.url      || "").trim(),
      industry: (body.industry || "").trim(),
      email:    (body.email    || "").trim(),
    };
    const paid = body.paid === true;
    const productMode = paid ? "paid" : "demo";

    const targetUrl = form.url || "https://example.com";
    const hasAnyKey = Object.values(API_KEYS).some((fn) => fn());

    const paidGate = shouldRejectPaidAnalysis({ paid, hasAnyKey, validAICount: hasAnyKey ? 1 : 0 });
    if (paidGate.reject && paidGate.reason === "missing_api_keys") {
      res.statusCode = paidGate.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: "live_analysis_unavailable",
        reason: paidGate.reason,
        paid: true,
        message: "有料診断にはライブAI解析が必要です。APIキーが未設定のため解析できません。",
      }));
      return;
    }

    const [siteData, specialFiles, chatgpt, gemini, claude, perplexity] = await Promise.all([
      analyzeSite(targetUrl),
      checkSpecialFiles(targetUrl),
      queryOpenAI(form.company, targetUrl, form.industry),
      queryGemini(form.company, targetUrl, form.industry),
      queryClaude(form.company, targetUrl, form.industry),
      queryPerplexity(form.company, targetUrl, form.industry),
    ]);

    const aiResults = [chatgpt, gemini, claude, perplexity];
    const validAICount = aiResults.filter(Boolean).length;

    const postQueryGate = shouldRejectPaidAnalysis({ paid, hasAnyKey, validAICount });
    if (postQueryGate.reject) {
      res.statusCode = postQueryGate.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: "live_analysis_unavailable",
        reason: postQueryGate.reason,
        paid: true,
        message: "有料診断にはライブAI解析が必要です。AIクエリが失敗したため、デモ結果は返しません。",
      }));
      return;
    }

    const report = buildReport(form, aiResults, siteData, specialFiles, { productMode });
    if (paid && !report) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: "live_analysis_unavailable",
        reason: "report_build_failed",
        paid: true,
        message: "レポート生成に失敗しました。時間をおいて再試行してください。",
      }));
      return;
    }

    const mode = hasAnyKey && validAICount > 0 ? "live" : "demo";

    // レポート生成完了 → Airtableへ蓄積（未設定/失敗でも応答は返す）
    const save = await saveToAirtable(form, report, mode);
    if (!save.saved && save.reason !== "not_configured") {
      console.error("[analyze] Airtable保存失敗:", save.reason, save.detail || "");
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ mode, report, saved: save.saved }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e?.message || "Internal Error" }));
  }
}
