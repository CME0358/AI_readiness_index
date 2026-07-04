# Agent Readiness Hub — 情報設計書（実装仕様）v4

> **URL（確定案）:** `https://readiness.coaretail.com/research/`  
> **役割:** Agent Readiness **Research Hub** の中核ページ（公式リファレンス）  
> **位置づけ:** LPではない。**生きている標準化ハブ**（Research Updates + Evidence で更新され続ける）  
> **メッセージの核:** 「AI時代の企業評価基準を定義します」  
> **最終CV:** Research Hub → White Paper → ARI診断 → 改善 → コンサル（副次。主目的は評価体系の蓄積）  
> **デザイン:** `index.html` / `methodology.html` と同一ライトパレット（Inter / zinc / 黒CTA）  
> **一次情報:** `00_index/ARI_Research_Report.md` / `00_index/ARIサービス概要.md`  
> **作成:** 2026-07-04 / **v2–v3:** 2026-07-05 / **v4:** 2026-07-05（Research Updates・Evidence・完全Hub）

---

## 0. 設計原則

| やる | やらない |
| --- | --- |
| AI時代の企業評価基準を**定義・標準化**する | 施策一覧（FAQを増やそう等）で終わる |
| Principles → Framework → Methodology → Benchmark の4層を持つ | サービス名としての「Agent Readiness」売り |
| **Research Updates** で「このページは生きている」を証明する | 一回きりのキャンペーンLP感 |
| **Evidence Library** で根拠を分離・蓄積する | 主張だけのページ |
| Research としてのトーン（フッター含む） | 「研究所があるフリ」の過剰演出 |

**ページの本質（v4）**

```
Agent Readiness Research Hub
  │
  ├── Principles（憲法・7原則）
  ├── Framework（DRA・100点）
  ├── Methodology（100問・5社・専門家）
  ├── Benchmark（業界別・蓄積）
  ├── Evidence（根拠ライブラリ）     ← v4
  ├── Research Updates（更新履歴）   ← v4・生きている証明
  │
  ├── White Paper / FAQ / News / Cases / Experiments
  └── ARI Diagnosis → Improve → Consulting
```

**4層アーキテクチャ（ブランドの骨格・変更禁止）**

| 層 | 名称 | 役割 | 所在 |
| --- | --- | --- | --- |
| L1 | **Principles** | 憲法 | `#principles` → 将来 `/principles/` |
| L2 | **Framework** | 評価フレーム | `#dra` `#score` `#intent` |
| L3 | **Methodology** | 評価手法 | `#method` / `/methodology.html` |
| L4 | **Benchmark** | 実測データ | `/dental.html` → `/benchmarks/` |
| — | **Evidence** | 根拠の保管庫 | `/evidence/`（v4必須） |
| — | **Updates** | 研究の生命線 | `#updates` → `/updates/` |

施策（FAQ / Schema / 料金公開等）は **Principles を満たす実装手段**。Evidenceは **主張の根拠**。Updatesは **標準が生きている証明**。

**読者心理**

```
Hero + Version     「これは継続する標準だ」
Research Updates   「このページは生きている」
Timeline / Evolution 「歴史の延長線上にある」
Principles         「憲法がある」
Evidence           「根拠がある。主張だけではない」
Framework          「測れる」
CTA                「自社は何点だろう」
```

**PRファネル（v4・最強導線）**

```
旧:  PR → LP → 診断

新:  PR（研究公開）
       ↓
     Research Hub（/research/）
       ↓
     White Paper DL
       ↓
     ARI Diagnosis（/report/）
       ↓
     改善提案（/improve.html）
       ↓
     コンサル（readiness/mtgschedule）
```

**半年後の蓄積イメージ（すべてHubへ）**

```
AI5社比較（v1.0）
  → 病院版
  → 採用版
  → EC版
  → SaaS版
  → 士業版
  → …毎月 Research Updates に追記、Benchmarks / Evidence に蓄積
```

---

## ① 最適なページ構成（v4確定）

| # | Section ID | 見出し | 読者心理 | v4 |
| ---: | --- | --- | --- | --- |
| 00 | `#tldr` | TL;DR | 結論 | — |
| 01 | `#hero` | ニュース型Hero | 標準化の宣言 | — |
| 02 | `#meta` | Research Meta（Version） | 継続研究 | — |
| 03 | `#stats` | 研究成果（数字） | 規模 | — |
| 04 | `#updates` | Research Updates | **このページは生きている** | **必須** |
| 05 | `#why` | なぜこの研究を行ったのか | 必然性 | — |
| 06 | `#timeline` | Agent Readiness Timeline | 世界観 | — |
| 07 | `#evolution` | AI Evolution | ARIが必要な理由 | — |
| 08 | `#method` | 研究方法（フロー） | 再現性 | — |
| 09 | `#principles` | Agent Readiness Principles | **憲法** | — |
| 10 | `#intent` | AIは何をしたいのか？ | 判断の順序 | — |
| 11 | `#quotes` | AIの共通回答 | 一次データ | — |
| 12 | `#consensus` | 5社一致の7項目 | 原則の実装手段 | — |
| 13 | `#definition` | Agent Readinessとは | 定義 | — |
| 14 | `#dra` | DRAモデル（Framework） | 評価骨格 | — |
| 15 | `#score` | 100点評価 | 「自社は何点？」 | — |
| 16 | `#evidence` | Evidence（根拠への導線） | 主張に根拠がある | **必須** |
| 17 | `#limitations` | この研究の限界 | 誠実さ | — |
| 18 | `#findings` | この資料で分かること | DL価値 | — |
| 19 | `#toc` | ホワイトペーパー目次 | 中身 | — |
| 20 | `#roadmap` | 今後の研究予定 | 継続 | RoadmapはUpdatesと接続 |
| 21 | `#download` | 無料ダウンロード | White Paper | — |
| 22 | `#next` | 次のステップ | 診断→改善→コンサル | — |
| 23 | `#faq` | よくある質問 | 引用用 | — |
| 24 | `#glossary` | 用語集 | DefinedTerm | — |
| 25 | `#citation` | Citation Policy | 引用規約 | — |
| 26 | `#hub` | Agent Readiness Hub | 完全エンティティマップ | **強化** |

**情報の重心**

```
Hero（標準化の宣言）
  ↓
Meta（Version）
  ↓
Stats
  ↓
★ Research Updates（生きている証明）← v4
  ↓
Timeline / AI Evolution
  ↓
Method
  ↓
★ Principles（憲法）
  ↓
Intent → Quotes → Consensus
  ↓
Definition / DRA / Score
  ↓
★ Evidence（根拠はこちら）← v4
  ↓
Limitations
  ↓
DL / Next（診断→改善→コンサル）
  ↓
Citation Policy / Hub
  ↓
Research Footer
```

---

## ② 各セクションの目的

| Section | 目的 |
| --- | --- |
| Hero | **評価基準を定義する**というニュースをFVで伝える |
| Meta | Version / 調査日 / 更新日 / 次回レビュー |
| Stats | 調査規模を数字で示す |
| **Updates** | **更新タイムラインで「生きているページ」を証明する** |
| Timeline | SEO〜AI Decisionの歴史線上にARIを置く |
| Evolution | 3段階の進化で「なぜ今ARIか」を証明 |
| Method | 手法の再現性 |
| **Principles** | **憲法。施策の上位にある原理を固定する** |
| Intent | AIの判断順序 |
| Quotes | 一次データ（Evidenceへの入口） |
| Consensus | 原則を満たす実装手段としての7項目 |
| Definition / DRA / Score | Framework層 |
| **Evidence** | **根拠ライブラリへの導線。主張と根拠を分離する** |
| Limitations | 限界と継続方針 |
| Citation | 引用規約 |
| Hub | Research Hub 完全マップ |

---

## ③ 各セクションで伝える内容

### 00 TL;DR

> **Agent Readiness（エージェント・レディネス）**とは、企業・ブランド・店舗がAI検索・AIエージェントの時代に、**理解され・比較され・推薦され・実行される**ための準備状況を示す評価概念です。  
> 合同会社コア・リテールは、主要AI5社への100問調査に基づき、**Agent Readiness Principles（7原則）**、**DRA三層・100点評価フレームワーク**、評価手法、業界ベンチマークを定義しています。本ページは、その公式リファレンス（Version 1.0）です。

---

### 01 Hero

| 要素 | コピー |
| --- | --- |
| Eyebrow | AGENT READINESS RESEARCH / VERSION 1.0 |
| **H1** | AI時代の企業評価基準を定義する。主要AI5社・100項目の独自調査。 |
| リード | ChatGPT、Claude、Gemini、Perplexity、Grok——5つのAIに同じ100問を投げ、Agent Readinessの原則・評価フレーム・手法を統合した。本ページはその一次情報を公開する。 |
| サブ | AIが企業を評価する共通基準が見えてきた。 |
| 主CTA | ホワイトペーパーを無料ダウンロード |
| 副CTA | Principlesを読む（`#principles`） |

**メッセージの進化**

| 弱い | 強い（現在） |
| --- | --- |
| AI5社を調べました | **AI時代の企業評価基準を定義します** |

---

### 02 Meta — Research Meta（Version）【必須】

Hero直下、またはHero内のメタ行。研究論文・標準文書の体裁。

| 項目 | 値（v1.0時点） |
| --- | --- |
| Document | Agent Readiness White Paper |
| **Version** | **1.0** |
| Research Date | 2026-07 |
| Last Updated | 2026-07-05 |
| Next Review | 2026-10 |
| Publisher | Coa Retail（合同会社コア・リテール） |
| Program | Agent Readiness Research |

**UI:** 横並びのメタテーブル、または定義リスト。モノスペース感は出さず、小さめのラベル＋値。

**HTML例**

```html
<aside id="meta" class="research-meta" aria-label="Research metadata">
  <dl>
    <div><dt>Document</dt><dd>Agent Readiness White Paper</dd></div>
    <div><dt>Version</dt><dd>1.0</dd></div>
    <div><dt>Research Date</dt><dd>2026-07</dd></div>
    <div><dt>Last Updated</dt><dd>2026-07-05</dd></div>
    <div><dt>Next Review</dt><dd>2026-10</dd></div>
  </dl>
</aside>
```

**JSON-LD:** `TechArticle` に `version`: `"1.0"`, `datePublished`, `dateModified` を入れる。Next Reviewは本文とFAQで明示。

**更新ルール（運用）**

| 変更内容 | Version |
| --- | --- |
| 誤字・リンク修正 | パッチなし（Last Updatedのみ） |
| 引用・FAQ・説明の追加 | 1.0 → 1.1 |
| Principles / Frameworkの変更 | 1.x → 2.0 |
| 次回レビュー実施 | Next Reviewを更新、必要ならVersion上げ |

---

### 03 Stats

| ラベル | 数値 |
| --- | --- |
| 調査AI | **5** |
| 質問 | **100** |
| 分析項目 | **500+** |
| 抽出知見 | **120+** |
| 共通項 | **7** |
| 原則 | **7** |

（原則7をStatsに含めてもよい。入れない場合はPrinciplesセクションの数字で十分。）

---

### 04 Research Updates【必須・v4】

Agent ReadinessはAIの進化とともに変わる概念である。だから更新履歴をページ内に持つ。AI・Google・人間の全員が **「このページは生きている」** と判断できる。

#### H2

**Research Updates**

#### リード（確定文案）

> Agent Readinessは、AIの進化とともに更新される評価基準です。本ページは一度きりの公開ではなく、Research Updatesとして継続的に追記します。

#### タイムライン（初期データ・公開時）

| 年月 | 内容 | 状態 |
| --- | --- | --- |
| **2026.07** | Version 1.0 公開（AI5社・100項目・Principles・DRA） | **公開済** |
| **2026.08** | Claude 新モデル対応調査 | 予定 |
| **2026.09** | Google AI Mode 調査追加 | 予定 |
| **2026.10** | AI Commerce 研究追加 / Next Review | 予定 |

※ ユーザー提示の「Claude 6」はモデル名確定前のため、実装時は正式名称に置換。表示は「Claude 新モデル対応」でも可。

#### UI

- 縦タイムライン（左に年月、右に内容）
- 最新行を強調（`current` クラス）
- 予定行はミュート
- 下部リンク: `すべての更新を見る` → 将来 `/updates/`（v1.0はアンカー内で完結）

#### Meta / Limitations との関係

| 要素 | 役割 |
| --- | --- |
| `#meta` Next Review | 次の公式レビュー日 |
| `#updates` | **何が変わったか**の履歴 |
| `#limitations` | 時点の限界の説明 |
| `#roadmap` | 今後やりたい研究テーマ |

Roadmapの冒頭一文:

> 詳細な実施履歴は Research Updates（`#updates`）を参照。

#### 運用ルール

- 研究・調査・モデル対応を公開したら **必ず1行追記**
- Versionアップ時は Updates に「v1.1公開」等を記載
- 業界版（病院・採用・EC等）公開時もここに追記し、Benchmarks / Evidence へリンク

---

### 05 Why

- 意思決定の主体が人間からAIへ移っている
- 「見つかること」と「選ばれること」は別問題
- 施策の羅列ではなく、**評価基準の標準化**が必要
- Agent Readinessは固定概念ではなく、AI進化に合わせて更新する（→ `#updates`）

---

### 05 Timeline — Agent Readiness Timeline【必須】

世界観を一行の歴史で伝える。

```
SEO
  ↓
MEO
  ↓
GEO
  ↓
Agent Readiness   ← いまここ
  ↓
AI Commerce
  ↓
AI Decision
```

| 段階 | 一言定義 |
| --- | --- |
| SEO | 検索結果で見つかる |
| MEO | マップ・ローカルで見つかる |
| GEO | 生成AIに引用・言及される |
| **Agent Readiness** | **理解・比較・推薦・実行まで備える** |
| AI Commerce | AIが購買・予約を完結する |
| AI Decision | AIが意思決定の主体になる |

**1行の結論**

> Agent Readinessは、GEOの次であり、AI Commerce / AI Decisionの前提条件である。

UI: 縦フロー（スマホ）/ 横タイムライン（デスクトップ）。「いまここ」を強調。

---

### 06 Evolution — AI Evolution【必須】

Before→Afterの2カラムを、**3カラム進化図**に拡張する。これが Agent Readiness が必要な理由そのもの。

#### Google時代

```
検索
  ↓
人が比較
  ↓
購入
```

#### AI Search

```
相談
  ↓
AI比較
  ↓
人が決定
```

#### Agent

```
相談
  ↓
AI推薦
  ↓
予約
  ↓
決済
  ↓
実行
```

**1行の結論**

> 比較・推薦・実行の主体がAIに移るほど、企業は「AIに選ばれる準備」——Agent Readiness——が必要になる。

旧「Google時代 vs AI時代」の2カラムは、この3カラムに置換する（情報の重複を避ける）。

---

### 07 Method（フロー）

```
100問設計 → AI5社へ投入 → 回答取得 → 比較分析 → 専門家レビュー → ARI構築
```

補足テーブルは v2 どおり。Methodology層の本体。

---

### 08 Principles — Agent Readiness Principles【最重要・憲法】

**ブランド化の分岐点。** 施策一覧で終わるGEO/LLMOとの決定的な差。

#### H2

**Agent Readiness Principles**

#### リード

Agent Readinessは、施策のチェックリストではない。AI時代に企業が満たすべき**7つの原則**である。FAQ、Schema、料金公開、一次情報、更新日、導入事例は、すべてこの原則を満たすための実装手段である。

#### 7原則（確定・引用用・変更はメジャーバージョンアップ）

| # | 原則（日本語） | 原則（English・任意併記） | 意味（1文） |
| ---: | --- | --- | --- |
| 01 | **AIが理解できる** | Understandable | 何の会社で、誰向けで、何を提供するかが一意に分かること |
| 02 | **AIが比較できる** | Comparable | 他社と並べたとき、差分が構造的に取れること |
| 03 | **AIが検証できる** | Verifiable | 主張が数値・出典・更新日で裏付けられること |
| 04 | **AIが信頼できる** | Trustworthy | 誠実さ・専門性・一貫性があり、推薦してよいと判断できること |
| 05 | **AIが推薦できる** | Recommendable | ユーザーの問いに対し、理由付きで候補に入れられること |
| 06 | **AIが実行できる** | Actionable | 推薦の先で予約・購入・問い合わせを完結できること |
| 07 | **AIが継続的に学習できる** | Learnable | 情報が更新され、変化が機械可読に反映され続けること |

#### 正規定義ブロック（引用用）

> Agent Readiness Principles（エージェント・レディネス原則）とは、AI検索・AIエージェントの時代に、企業がAIから理解・比較・検証・信頼・推薦・実行・継続学習されるために満たすべき7つの原理である。個別の施策（FAQ、Schema、料金公開等）は、原則を満たすための実装手段として位置づける。

#### 原則 → 実装手段マップ（必須表）

| 原則 | 実装手段の例 |
| --- | --- |
| AIが理解できる | Schema.org / 定義の明記 / NAP一貫性 / FAQ / `llms.txt` |
| AIが比較できる | 比較表 / 料金・条件 / 対象者の明示 / プラン差分 |
| AIが検証できる | 数値実績 / 出典 / 更新日 / 一次情報 |
| AIが信頼できる | E-E-A-T / 弱み開示 / 代表者情報 / メディア掲載 |
| AIが推薦できる | 質問への対応力 / 推薦理由の言語化材料 / FAQ充実 |
| AIが実行できる | Web予約 / API / MCP / フォーム最適化 |
| AIが継続的に学習できる | 更新頻度 / 変更履歴 / リアルタイムデータ連携 |

#### Principles と Intent / DRA の関係

```
Principles（憲法・不変に近い）
  ↓ 満たす順序として観察される
Intent（AIは理解→比較→自信→推薦→実行したい）
  ↓ 測る枠組み
Framework（DRA・100点）
  ↓ 測り方
Methodology（100問・5社）
  ↓ 実測
Benchmark（業界調査）
```

| 原則 | Intent | DRA |
| --- | --- | --- |
| 理解できる | 正しく理解したい | Discovery |
| 比較できる | 比較したい | Recommendation |
| 検証できる / 信頼できる | 自信を持ちたい | Recommendation |
| 推薦できる | 推薦したい | Recommendation |
| 実行できる | 最後まで実行したい | Action |
| 継続的に学習できる | （横断） | 全層・鮮度 |

UI: 7枚の原則カード。番号大きく。英語ラベルは小さく併記可。マップ表はカード下。

---

### 09 Intent — AIは何をしたいのか？

Principlesの**下位**。原則を、AIの判断順序として説明する。

```
正しく理解したい → 比較したい → 自信を持ちたい → 推薦したい → 最後まで実行したい
```

接続コピー:

> 原則は「企業が満たすべき状態」。意図は「AIが実際にたどる判断の順序」。両方を揃えることで、施策の優先順位が決まる。

---

### 10 Quotes（一次データ）

v2どおり。共通回答 + 5社引用カード + 抽出注記。

---

### 11 Consensus — 5社一致の7項目

見出しを原則に接続する。

**H2:** 原則を満たすために、AI5社が一致した評価項目

各項目に「主に満たす原則」タグを付与。

| 項目 | 主原則 |
| --- | --- |
| Schema.org実装 | 理解できる |
| 料金・条件の透明性 | 比較できる / 検証できる |
| FAQ充実 | 理解できる / 推薦できる |
| 数値化された実績 | 検証できる |
| 情報の更新頻度 | 継続的に学習できる |
| 比較可能性 | 比較できる |
| E-E-A-T充足 | 信頼できる / 推薦できる |

---

### 12 Definition

正規定義（変更禁止）+ SEO / GEO / ARI 比較表。v2どおり。

Timelineとの接続一文:

> SEO・MEO・GEOは「見つかる・言及される」までの最適化である。Agent Readinessは、Principlesに基づき、実行と継続学習まで含む。

---

### 13–14 DRA / Score（Framework層）

v2どおり。セクションラベルに `FRAMEWORK` を付与してよい。

---

### 15 Evidence — Evidence Library【必須・v4】

研究の根拠ページ。主張と根拠を分離する。本ページ（`/research/`）からは **「根拠はこちら」** で飛ばす。

#### 本ページ上のセクション（ティーザー）

**H2:** Evidence

**リード:**

> 本リファレンスの主張は、AI回答・調査データ・実験・検証結果に基づきます。根拠の詳細は Evidence Library に集約しています。

**カード（6カテゴリへの入口）**

| カテゴリ | 内容 | v1.0の状態 |
| --- | --- | --- |
| AI回答 | 5社への100問回答の要約・代表引用 | 本ページ `#quotes` + Evidenceへ |
| 調査データ | 一致率・差異表・配点比較 | Evidence |
| 実験 | 介入前後の測定（今後） | 予定 |
| 検証結果 | Schema→推薦率など因果検証（今後） | 予定 |
| 引用元 | 外部ソース・メディア・一次資料 | Evidence |
| 更新履歴 | Research Updates の詳細ログ | `#updates` と同期 |

**CTA:** `Evidence Library を見る` → `/evidence/`

#### Evidence Library 本体ページ（`/evidence/`）

独立ページ。Research Hubの「根拠の保管庫」。

```
/evidence/
├── index.html          # Evidence Library トップ（カテゴリ一覧）
├── ai-responses/       # AI回答アーカイブ（将来）
├── datasets/           # 調査データ（将来）
├── experiments/        # 実験ログ（将来）
└── changelog.md 相当   # 更新履歴（Updatesと相互リンク）
```

**v1.0の最小実装**

`evidence/index.html` に以下を置くだけでよい。

1. Evidence Library の定義（1段落）
2. 6カテゴリの説明
3. 現時点で公開できる根拠へのリンク（`/research/#quotes`、研究レポート要約、dental調査）
4. 「実験・検証結果は今後追加」の明示
5. Research / Citation Policy への戻るリンク

**定義文（引用用）**

> Evidence Library（エビデンス・ライブラリ）とは、Agent Readiness ResearchにおけるAI回答、調査データ、実験、検証結果、引用元、更新履歴を集約した根拠ページである。リファレンスページ上の主張は、Evidence Libraryの項目を根拠とする。

#### なぜ必須か

| 効果 | 対象 |
| --- | --- |
| 「主張だけではない」 | 人間・メディア |
| 一次情報の深掘り先 | AI（引用の根拠URL） |
| 実験・検証の蓄積先 | 半年後の業界版・因果検証 |
| LP/PRからの「根拠はこちら」 | 導線の明確化 |

---

### 16 Limitations

v2の3点（時点 / 因果 / 継続）を維持。Metaの Next Review・`#updates` と相互リンク。

> 次回レビュー予定: 2026-10（`#meta`）。実施履歴は Research Updates（`#updates`）に追記します。

---

### 17–22 Findings / TOC / Roadmap / Download / Next

Roadmap冒頭:

> PrinciplesとFrameworkは維持しつつ、MethodologyとBenchmarkを更新します。実施履歴は Research Updates を参照。

**Next（診断→改善→コンサル）の導線を明示**

1. White Paper DL（本ページ）
2. ARI Diagnosis — `/report/`（約3分）
3. 改善提案 — `/improve.html`
4. コンサル（無料相談30分）— `https://www.coaretail.com/readiness/mtgschedule`

---

### 23 Citation Policy【必須】

旧 `#cite` を **Citation Policy** として格上げ。

#### H2

**Citation Policy**

#### 本文（確定文案）

> この研究は引用可能です。
>
> 引用時は、以下を記載してください。
>
> - **Agent Readiness Research**
> - **Coa Retail**（合同会社コア・リテール）
> - 引用URL: [https://readiness.coaretail.com/research/](https://readiness.coaretail.com/research/)
>
> Version番号の記載を推奨します（例: Agent Readiness Research, Version 1.0）。

#### 引用フォーマット（コピー用）

**日本語**

```
合同会社コア・リテール（2026）. Agent Readiness Research, Version 1.0.
https://readiness.coaretail.com/research/
```

**English**

```
Coa Retail (2026). Agent Readiness Research, Version 1.0.
https://readiness.coaretail.com/research/
```

#### 引用してよいもの / 注意

| 引用可 | 注意 |
| --- | --- |
| Principles（7原則）の名称と定義 | 原則の改変・部分改変は不可。原文のまま |
| DRA・100点モデルの概要 | 詳細配点はWPまたはMethodologyを参照と明記 |
| 調査規模（5社・100問等） | VersionとResearch Dateを併記推奨 |
| 本ページの図表の概念 | 図の無断改変は不可 |

商業利用・翻訳・二次配布の詳細が必要になった時点で `/research/citation-policy.html` に分離可能。v1.0は本セクションで完結。

---

### 26 Hub — Agent Readiness Research Hub【v4完全形】

```
readiness.coaretail.com
│
├── Agent Readiness          /                    概念トップ
├── White Paper              /research/#download  本ページDL → 将来 /papers/
├── Methodology              /methodology.html
├── Principles               /research/#principles → 将来 /principles/
├── Research                 /research/           本ページ（中核）
├── Evidence                 /evidence/           根拠ライブラリ ★v4
├── Updates                  /research/#updates   → 将来 /updates/
├── Benchmarks               /dental.html → /benchmarks/
├── Experiments              /evidence/ 内 → 将来 /experiments/
├── FAQ                      /research/#faq → /faq/
├── News                     予定 /news/
├── Cases                    予定 /cases/
└── ARI Diagnosis            /report/
         ↓
    Improve（/improve.html）
         ↓
    Consulting（readiness/mtgschedule）
```

| エンティティ | URL（v1.0） | 状態 |
| --- | --- | --- |
| Agent Readiness | `/` | 公開 |
| Research | `/research/` | 本ページ |
| Principles | `#principles` | 本ページ内 |
| White Paper | `#download` | 本ページ内 |
| Methodology | `/methodology.html` | 公開 |
| Evidence | `/evidence/` | **v1.0で新設** |
| Updates | `#updates` | 本ページ内 |
| Benchmarks | `/dental.html` | 公開（Dental） |
| Experiments | `/evidence/`（カテゴリ） | 予定枠 |
| FAQ | `#faq` | 本ページ内 |
| ARI Diagnosis | `/report/` | 公開 |
| Improve | `/improve.html` | 公開 |
| News / Cases | — | 予定 |

#### 半年後の蓄積（業界版はすべてHubへ）

```
Research Updates に毎月追記
  │
  ├── 2026.07  AI5社比較（v1.0）
  ├── 2026.xx  病院版     → /benchmarks/hospital/ + Evidence
  ├── 2026.xx  採用版     → /benchmarks/recruiting/
  ├── 2026.xx  EC版       → /benchmarks/ec/
  ├── 2026.xx  SaaS版     → /benchmarks/saas/
  └── 2026.xx  士業版     → /benchmarks/professional/
```

各業界版の公開時チェックリスト:

1. `#updates` に1行追加
2. `/benchmarks/{industry}/` にページ追加（または dental と同型）
3. `/evidence/` にデータ・引用を追加
4. Version / Last Updated を更新
5. PR → Research Hub の導線で公開

---

## Research Footer【必須・研究機関トーン】

```
────────────────────────────────
Agent Readiness Research
Coa Retail

Research Program
2026

Version 1.0  ·  Last Updated 2026-07-05  ·  Next Review 2026-10
────────────────────────────────
Principles · Framework · Methodology · Evidence · Benchmarks
Updates · Citation Policy · White Paper
────────────────────────────────
© 2026 Coa Retail（合同会社コア・リテール）
```

リンク追加: Evidence → `/evidence/` / Updates → `#updates`

トーン: セールスコピー禁止。**Research** を出す。

---

## ④ 必要な図解

| ID | 図解 | 配置 | 優先度 |
| --- | --- | --- | --- |
| D01 | Research Meta（Version表） | `#meta` | 必須 |
| D02 | Stats Bar | `#stats` | 必須 |
| D03 | **Research Updates タイムライン** | `#updates` | **必須** |
| D04 | Timeline（SEO→…→AI Decision） | `#timeline` | 必須 |
| D05 | AI Evolution（3カラム） | `#evolution` | 必須 |
| D06 | Method Flow（6段） | `#method` | 必須 |
| D07 | **Principles 7** | `#principles` | **最重要** |
| D08 | Principles→実装手段マップ | `#principles` | 必須 |
| D09 | Intent 5 | `#intent` | 必須 |
| D10 | Evidence 6カテゴリ | `#evidence` | **必須** |
| D11 | SEO→GEO→ARI Stack | `#definition` | 必須 |
| D12 | DRA / Score | `#dra` `#score` | 必須 |
| D13 | **Hub Map（完全形）** | `#hub` | **必須** |
| D14 | PRファネル（PR→Hub→WP→診断→改善→コンサル） | `#next` or `#hub` | 推奨 |

旧 Before→After 2カラムは **AI Evolution 3カラム（D04）に置換**。

---

## ⑤ イラスト / ⑥ アイコン

v2に加え:

| アイコン | 用途 |
| --- | --- |
| scroll-text / scale | Principles（憲法） |
| milestone / git-commit | Timeline |
| layers-3 | AI Evolution / 4層 |
| link-2 | Citation |
| calendar-clock | Next Review / Version |
| library | Research Hub |

---

## ⑦ CTA配置

リファレンス区間（Meta〜Principles〜Limitations）はCTA控えめ。Score以降で強める。

| 位置 | Primary | Secondary |
| --- | --- | --- |
| Nav | 資料をダウンロード | — |
| Hero | WP無料DL | Principlesを読む |
| Principles後 | 詳細を資料で読む | — |
| Score後 | WP DL | 約3分で診断 |
| Citation後 | — | （引用コピーボタンのみ） |
| Hub | — | 各エンティティへテキストリンク |

---

## ⑧ FAQ（追加分）

既存Qに加え:

**Q. Agent Readiness Principlesとは何ですか？**  
AI時代に企業が満たすべき7つの原理です。AIが理解できる、比較できる、検証できる、信頼できる、推薦できる、実行できる、継続的に学習できる——の7つです。FAQやSchemaなどの施策は、原則を満たすための実装手段です。

**Q. Versionはどのように更新されますか？**  
本リファレンスはVersion番号、Research Date、Last Updated、Next Reviewを公開しています。原則や評価フレームの変更はメジャーバージョンアップ、説明の追加はマイナーアップデートとして管理します。次回レビューは2026年10月を予定しています。

**Q. 引用するときはどうすればよいですか？**  
「Agent Readiness Research」「Coa Retail」および引用URL（https://readiness.coaretail.com/research/）を記載してください。Version番号の併記を推奨します。詳細はCitation Policyを参照してください。

**Q. Agent ReadinessはGEOの次ですか？**  
Timeline上、SEO → MEO → GEO の次に Agent Readiness を位置づけています。GEOが「言及される」までを扱うのに対し、Agent Readinessは実行と継続学習まで含み、AI Commerce / AI Decisionの前提条件となります。

**Q. Research Updatesとは何ですか？**  
Agent ReadinessはAIの進化とともに更新される評価基準です。Research Updatesは、Version公開・モデル対応・新規調査の追加履歴を時系列で公開する欄です。本ページが一度きりではなく、継続的に更新されていることを示します。

**Q. Evidence Libraryとは何ですか？**  
AI回答、調査データ、実験、検証結果、引用元、更新履歴を集約した根拠ページです。リファレンス上の主張の根拠は Evidence Library にあります。

---

## ⑨ 内部リンク・固定アンカー

**プレス・WP・他ページから刺すアンカー（変更禁止）**

| 用途 | URL |
| --- | --- |
| 定義 | `/research/#definition` |
| **Principles** | `/research/#principles` |
| Version | `/research/#meta` |
| **Research Updates** | `/research/#updates` |
| Timeline | `/research/#timeline` |
| AI Evolution | `/research/#evolution` |
| Intent | `/research/#intent` |
| Framework (DRA) | `/research/#dra` |
| Methodology | `/research/#method` |
| **Evidence** | `/evidence/`（ティーザー: `/research/#evidence`） |
| Limitations | `/research/#limitations` |
| **Citation Policy** | `/research/#citation` |
| Hub | `/research/#hub` |
| Stats | `/research/#stats` |

---

## ⑩ SEO / GEO / 標準化対応

### Title / Description

- **Title:** `Agent Readiness Principles — AI時代の企業評価基準（Version 1.0）| Coa Retail`
- **Description:** `Agent Readinessの7原則、DRA評価フレーム、主要AI5社・100項目の調査手法を定義。Version 1.0の公式リファレンス。引用可。`

### JSON-LD 追加プロパティ

```json
{
  "@type": "TechArticle",
  "headline": "Agent Readiness Research, Version 1.0",
  "version": "1.0",
  "datePublished": "2026-07-01",
  "dateModified": "2026-07-05",
  "author": { "@id": "https://www.coaretail.com/#organization" },
  "publisher": { "@id": "https://www.coaretail.com/#organization" },
  "about": [
    { "@id": "https://readiness.coaretail.com/#agent-readiness" },
    { "@id": "https://readiness.coaretail.com/research/#principles" }
  ]
}
```

Principlesは `DefinedTermSet` として7原則を `hasDefinedTerm` で列挙する。

```json
{
  "@type": "DefinedTermSet",
  "@id": "https://readiness.coaretail.com/research/#principles",
  "name": "Agent Readiness Principles",
  "description": "AI時代に企業が満たすべき7つの原理",
  "hasDefinedTerm": [
    { "@type": "DefinedTerm", "name": "AIが理解できる", "description": "何の会社で、誰向けで、何を提供するかが一意に分かること" },
    { "@type": "DefinedTerm", "name": "AIが比較できる", "description": "他社と並べたとき、差分が構造的に取れること" },
    { "@type": "DefinedTerm", "name": "AIが検証できる", "description": "主張が数値・出典・更新日で裏付けられること" },
    { "@type": "DefinedTerm", "name": "AIが信頼できる", "description": "誠実さ・専門性・一貫性があり、推薦してよいと判断できること" },
    { "@type": "DefinedTerm", "name": "AIが推薦できる", "description": "ユーザーの問いに対し、理由付きで候補に入れられること" },
    { "@type": "DefinedTerm", "name": "AIが実行できる", "description": "推薦の先で予約・購入・問い合わせを完結できること" },
    { "@type": "DefinedTerm", "name": "AIが継続的に学習できる", "description": "情報が更新され、変化が機械可読に反映され続けること" }
  ]
}
```

### llms.txt（Hub対応）

```
# Agent Readiness
> AI時代の企業評価基準を定義する Research Hub

## Core
- [Agent Readiness](https://readiness.coaretail.com/): 概念
- [Research](https://readiness.coaretail.com/research/): 公式リファレンス Version 1.0
- [Principles](https://readiness.coaretail.com/research/#principles): 7原則
- [Research Updates](https://readiness.coaretail.com/research/#updates): 更新履歴
- [Evidence](https://readiness.coaretail.com/evidence/): 根拠ライブラリ
- [Methodology](https://readiness.coaretail.com/methodology.html): 評価手法
- [ARI Diagnosis](https://readiness.coaretail.com/report/): 診断
- [Benchmarks](https://readiness.coaretail.com/dental.html): 業界調査

## Citation
Cite as: Agent Readiness Research, Coa Retail, https://readiness.coaretail.com/research/
```

---

## ⑪ HTMLセクション構成（v4・抜粋）

```html
<aside id="meta">…Version…</aside>
<section id="stats">…</section>

<!-- ★ 生きている証明 -->
<section id="updates" class="section">
  <h2>Research Updates</h2>
  <ol class="updates-timeline">
    <li data-status="done"><time>2026.07</time> v1.0公開</li>
    <li data-status="planned"><time>2026.08</time> Claude新モデル対応</li>
    <li data-status="planned"><time>2026.09</time> Google AI Mode調査追加</li>
    <li data-status="planned"><time>2026.10</time> AI Commerce研究追加</li>
  </ol>
</section>

<section id="timeline">…</section>
<section id="evolution">…</section>
<section id="method">…</section>
<section id="principles">…</section>
<section id="intent">…</section>
<section id="quotes">…</section>
<section id="consensus">…</section>
<section id="definition">…</section>
<section id="dra">…</section>
<section id="score">…</section>

<!-- ★ 根拠はこちら -->
<section id="evidence" class="section">
  <h2>Evidence</h2>
  <p>本リファレンスの主張の根拠は Evidence Library に集約しています。</p>
  <a class="btn btn-secondary" href="/evidence/">根拠はこちら</a>
</section>

<section id="limitations">…</section>
…
<section id="next">
  <!-- WP → Diagnosis → Improve → Consulting -->
</section>
<section id="citation">…</section>
<section id="hub">…完全マップ…</section>

<footer class="research-footer">
  …
  <a href="/evidence/">Evidence</a>
  <a href="#updates">Updates</a>
  …
</footer>
```

---

## ⑫ ディレクトリ構成（v4）

```
10_Projects/AI Readiness Index/
├── research/
│   ├── index.html              # Research Hub 中核（本ページ）
│   ├── thanks.html
│   ├── WHITEPAPER_LP_IA.md      # 本設計書 v4
│   └── assets/
│       ├── cover.webp
│       └── ARI_Research_Whitepaper_2026.pdf
├── evidence/                   # ★ Evidence Library（v1.0で新設）
│   └── index.html
├── methodology.html
├── dental.html                 # Benchmarks（Dental）→ 将来 /benchmarks/
├── improve.html
├── report/                     # ARI Diagnosis
├── index.html                  # Agent Readiness 概念トップ
├── llms.txt
├── sitemap.xml
│
│  # 将来追加（Hub蓄積）
├── benchmarks/
│   ├── hospital/
│   ├── recruiting/
│   ├── ec/
│   ├── saas/
│   └── professional/
├── updates/                    # Updates一覧（#updatesから分離時）
├── principles/                 # Principles単独ページ
├── experiments/
├── faq/
├── news/
├── papers/
└── cases/
```

### 実装順序（v4）

1. スケルトン + **Research Footer**
2. Hero + **Meta（Version）**
3. Stats
4. **Research Updates タイムライン**
5. Timeline + AI Evolution
6. Method
7. **Principles（憲法）**
8. Intent / Quotes / Consensus
9. Definition / DRA / Score
10. **Evidence ティーザー + `/evidence/index.html`**
11. Limitations
12. Citation Policy
13. **Hub 完全マップ**
14. FAQ + JSON-LD
15. DLフォーム + thanks（Next: 診断→改善→コンサル）
16. nav・sitemap・llms.txt

---

## 付録A. v3 → v4 差分

| 項目 | v3 | v4 |
| --- | --- | --- |
| 生命線 | Version / Next Reviewのみ | **Research Updates タイムライン** |
| 根拠 | Quotesがページ内のみ | **Evidence Library（独立ページ）** |
| PR導線 | PR→Hub→WP→診断→改善 | **→コンサルまで明示** |
| Hub | 部分マップ | **完全形（Evidence / Experiments / Diagnosis含む）** |
| 蓄積設計 | 薄い | **業界版（病院・採用・EC・SaaS・士業）をHubへ毎月追加** |
| 「生きている」証明 | 暗黙 | **UpdatesでAI・Google・人間が判定可能** |

---

## 付録B. 4層 + Evidence / Updates（積み上げ設計）

| 層・基盤 | 今あるもの | 今後足すもの |
| --- | --- | --- |
| Principles | `#principles` | `/principles/`、翻訳 |
| Framework | DRA、100点、Intent | 業界別ウェイト |
| Methodology | 100問、methodology.html | 再現手順の詳細 |
| Benchmark | dental.html | 病院・採用・EC・SaaS・士業 |
| **Evidence** | `/evidence/`（v1.0最小） | AI回答全文、実験、因果検証 |
| **Updates** | `#updates` | 毎月1行以上、将来 `/updates/` |

PR・WP・News・Cases・業界版は、すべてこの骨格を補強するコンテンツとしてHubに積む。

---

## 付録C. 感情導線チェック

| 読者の内言 | セクション | 成功条件 |
| --- | --- | --- |
| 何のページ？ | Hero + Meta | 「継続する標準の一次情報」 |
| **生きている？** | **Research Updates** | 更新履歴が見える。予定もある |
| 歴史のどこ？ | Timeline | GEOの次、Commerceの前 |
| なぜ必要？ | Evolution | Agent段階で実行までAIが担う |
| 施策一覧では？ | Principles | 「憲法がある。手段は下位」 |
| **根拠は？** | **Evidence** | 「根拠はこちら」で飛べる |
| 信じられる？ | Method + Limitations + Updates | プロセス・限界・更新計画 |
| 引用してよい？ | Citation Policy | 書き方まで分かった |
| 自社は？ | Score → WP → 診断 → 改善 → コンサル | 行動 |

---

## 付録E. PR運用メモ

```
プレスリリース公開日
  1. /research/ を更新（Updatesに「v1.0公開」）
  2. PR本文の主リンク = Research Hub（LPではない）
  3. 副リンク = White Paper DL / Evidence / ARI Diagnosis
  4. メディア向け = Citation Policy + Principles の引用文
```

半年後も同じ型:

```
PR「病院版 Agent Readiness 調査を公開」
  → Research Hub（Updatesに追記）
  → /benchmarks/hospital/
  → Evidence にデータ追加
  → 診断・改善へ
```

---

## 付録D. コピー禁止事項

- 施策の羅列だけで原則に触れないこと
- 「研究所設立」など実態のない組織の誇張
- VersionやNext Reviewを出さないまま「最新」と書くこと
- Principlesの無断改変を促す表現

---

_最終更新: 2026-07-05 v4 / Agent Readiness Research / Coa Retail_
