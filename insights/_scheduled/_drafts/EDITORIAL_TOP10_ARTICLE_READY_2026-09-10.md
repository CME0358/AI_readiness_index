# ARTICLE_READY Top 10 — 2026-09-10

Agent Readiness Insights 向けの未公開ドラフト10本。`scripts/generate-insight-article.mjs` で HTML を生成した。**`schedule.json` には未適用。`insert-editorial-article.mjs --apply` は未実行。Buffer キューは未編集。公開もしていない。**

推奨日は提案のみ。既存スロット（2026-09-11 `competitors-visible-company-missing`、2026-09-14 `execution-readiness`、2026-09-15 `html-observation-check-limits`、2026-09-16 `seo-meo-ai-recommendation-gap`）は変更していない。

ソース・オブ・トゥルースは `insights/_scheduled/_drafts/<slug>/`（`source.md` + `index.html`）。`insights/<slug>/` へのミラーは、未公開ドラフトの既存パターンではないため行っていない。

---

## 生成物

| EIR | 提案日 | slug | intent | 型 |
| --- | --- | --- | --- | --- |
| EIR-20260917-001 | 2026-09-17 | `cloudflare-ai-traffic-search-agent-training` | NEWS | NEWS+TACTICAL · Visibility |
| EIR-20260918-001 | 2026-09-18 | `niq-similarweb-agentic-shelf-measurement` | EVIDENCE | MEASUREMENT · Visibility/Authority |
| EIR-20260924-001 | 2026-09-24 | `weighted-ai-visibility-stack` | EVIDENCE | MEASUREMENT+TACTICAL |
| EIR-20260925-001 | 2026-09-25 | `shopify-ai-vs-organic-structured-catalog` | EVIDENCE | DATA · Visibility/Actionability（浅い） |
| EIR-20260928-001 | 2026-09-28 | `google-ai-coexistence-measurement` | EVIDENCE | MEASUREMENT |
| EIR-20260929-001 | 2026-09-29 | `gemini-3-8-ai-mode-visibility` | NEWS | NEWS |
| EIR-20260930-001 | 2026-09-30 | `geo-social-citation-authority` | PROBLEM_AWARE | TACTICAL · Authority |
| EIR-20261001-001 | 2026-10-01 | `gsc-ai-impressions-how-to-read` | EVIDENCE | TACTICAL MEASUREMENT |
| EIR-20261002-001 | 2026-10-02 | `schema-not-ai-citation-cheat-code` | EVIDENCE | DATA/RESEARCH |
| EIR-20261003-001 | 2026-10-03 | `chatgpt-retrieval-citation-practice` | NEWS | TACTICAL |

各フォルダに `source.md` と生成 `index.html` がある。リード／meta はおおよそ120字以内。既存ドラフト末尾の「次のリソース／関連リソース」重複は source に入れておらず、ジェネレータが各1回だけ付与する。

ジェネレータの自動「関連Insights」は、未登録 slug のため generic 3本（agent-experience / agent-handoff / ai-agent-marketing-shift）に落ちる。カタログ接続は本文のインラインリンク（vis / auth / cloudflare-aeo / iab-ai-visibility / citation-vs-action / ari-vs-geo-seo 等）で補っている。schedule 投入後にトピック家族へ足せば、自動関連は差し替わる。

---

## 各稿の論点・出典・重複回避

### 1) cloudflare-ai-traffic-search-agent-training（2026-09-17）

- **論点：** Training 遮断の意図が Search 発見まで落ちるリスク。Search / Agent / Training の独立制御と、9/15 新規ドメイン既定（広告ページで Training+Agent 遮断、Search 許可、多目的クローラーは Training 既定の影響）。
- **一次：** [Cloudflare Changelog 2026-07-01](https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/) — 取得成功。
- **既存との差：** `cloudflare-aeo` は ranking→recommended / AEO ダッシュボード。本稿はクローラー3分類と誤遮断。
- **ABIS境界：** 許可・遮断と Visibility。実行プロトコル・取引レールには入らない。

### 2) niq-similarweb-agentic-shelf-measurement（2026-09-18）

- **論点：** エージェント棚・コンテンツ準備・AI流入・成果をつなぐ測定カテゴリ。IAB 4P とは別列。Q4 未提供を明記。
- **一次：** [NIQ × Similarweb 2026-09-02](https://nielseniq.com/global/en/news-center/2026/niq-and-similarweb-advance-agentic-commerce-measurement-for-the-ai-shopping-era/) — 取得成功。
- **既存との差：** `iab-ai-visibility` は回答面の 4P。本稿は Commerce 側の棚／準備／成果。
- **ABIS境界：** UCP / ACP は「測定前提の言及」まで。決済・プロトコル実装は扱わない。

### 3) weighted-ai-visibility-stack（2026-09-24）

- **論点：** 等重み平均をやめ、ChatGPT / Gemini / Claude を核、Google AI Overviews / AI Mode を別層、新興面は消さず加重低下。
- **分析：** [SEJ / Greg Jarboe](https://www.searchenginejournal.com/chatgpt-gemini-claude-lead-ai-visibility-is-it-time-to-stop-tracking-perplexity/588378/) — 取得成功。**業界分析**と明示。数字は StatCounter / Similarweb / 各社発表 / TechCrunch 経由 Similarweb に帰属。
- **既存との差：** `multi-agent-compare` は面の違いの説明。本稿は測定の加重ルール。
- **ABIS境界：** 測定設計のみ。

### 4) shopify-ai-vs-organic-structured-catalog（2026-09-25）

- **論点：** AI紹介の質（転換・PDP着地）とオーガニックの量は別仕事。構造化 Catalog 経由はスクレイプ／第三者フィードより転換が高い、という Shopify 公開データ。
- **一次：** [Shopify Enterprise 2026-08-11](https://www.shopify.com/enterprise/blog/ai-search-category-behavior) — 取得成功。
- **補助：** [TechCrunch 決算報道 2026-08-05](https://techcrunch.com/2026/08/05/shopify-says-ai-search-is-driving-more-traffic-and-sales-not-replacing-google/) — 取得成功（検索結果＋本文）。
- **既存との差：** `openai-product-discovery-agentic-commerce` は公式の商品探索発表。本稿は商人データの紹介品質とカタログ属性。
- **ABIS境界：** 比較・推薦・情報設計で停止。チェックアウト／決済プロトコルは扱わない。

### 5) google-ai-coexistence-measurement（2026-09-28）

- **論点：** オーディエンス重複 ≠ クリック保全。人数重複・クエリ置換・ゼロクリックを分ける。
- **分析：** [SEJ / Matt G. Southern 2026-09-04](https://www.searchenginejournal.com/google-chatgpt-audience-search-queries-clicks/588200/) — 取得成功。Similarweb 95%、Bocconi 9.4%、Wang et al. AI Mode クリック減などを原典名付きで引用。
- **既存との差：** `search-departure-ai` / `ai-search-52-percent` は入口移動の調査。本稿は測定の分解。
- **ABIS境界：** 測定のみ。

### 6) gemini-3-8-ai-mode-visibility（2026-09-29）

- **論点：** 3.8 Flash が有料 AI Mode に入った。合成・引用・フォローアップと、プラン別の可視性階層。AI Overviews 更新は公式に無いので主張しない。
- **一次：** [Google 2026-09-02](https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/) — 取得成功。
- **業界確認：** [Search Engine Land / Barry Schwartz](https://searchengineland.com/gemini-3-8-flash-rolling-out-in-google-search-486630) — 取得成功。
- **既存との差：** `multi-agent-compare` の「面が違う」を、同じ AI Mode 内のモデル／プラン階層に更新。
- **ABIS境界：** Cyber モデルと脆弱性探索は対象外。

### 7) geo-social-citation-authority（2026-09-30）

- **論点：** GEO の材料はサイト外（ソーシャル、個人、コミュニティ）にもある。Authority の証拠を Original / Structured / Corroborated で見る。
- **一次：** [We Are Social Australia 2026-09-07](https://wearesocial.com/au/blog/2026/09/generative-engine-optimisation-geo-guide/) — 取得成功。Digital 2026 / Meltwater、Adobe、Pew などの％はガイドが名前を出した出典に帰属。
- **既存との差：** 9/16 `seo-meo-ai-recommendation-gap` は公式面の SEO/MEO 後確認。本稿はサイト外の社会発信 Authority。
- **ABIS境界：** 引用源と一貫性。実行セマンティクスには入らない。

### 8) gsc-ai-impressions-how-to-read（2026-10-01）

- **論点：** GSC 生成AIレポートは診断レンズ。スコアボードにしない。
- **公式：** [Search Central 2026-06-03](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) — 取得成功。列挙は impressions / pages / countries / devices / dates。8/31 世界展開注記あり。クエリ・クリック・CTR は公式列挙に無い。
- **分析：** [SEJ / Carolyn Shelby 2026-08-04](https://www.searchenginejournal.com/google-reports-ai-search-impressions-how-to-read-them/582824/) — 取得成功。集計差やブレンド禁止は業界分析として分離。
- **既存との差：** `iab-ai-visibility` は IAB 4P。本稿は Google 公式インプレッションの読み方。
- **薄めなかった。** クエリ／CTR を「ある」とは書いていない。

### 9) schema-not-ai-citation-cheat-code（2026-10-02）

- **論点：** JSON-LD 追加は、すでに引用されているページで引用をほぼ動かさない。衛生には残し、引用チート予算は一貫性・本文へ再配分。
- **一次：** [Ahrefs 2026-05-11](https://ahrefs.com/blog/schema-ai-citations/) — 取得成功（1,885処理 / 約4,000対照、AIO −4.6%、AI Mode +2.4%、ChatGPT +2.2%）。
- **補助：** [SEJ Ahrefs myths pack](https://www.searchenginejournal.com/ai-search-myths-debunked-ahrefs-spa/584393/) — 取得成功。**提供記事**と明示。他の神話（llms.txt 等）は本稿の根拠に使っていない。
- **既存との差：** `schema` / `org-schema-basics` は役割と公式定義。本稿は制御研究によるチート否定。
- **ABIS境界：** マークアップ衛生と Authority。相互作用記述標準には入らない。

### 10) chatgpt-retrieval-citation-practice（2026-10-03）

- **論点：** 取得・キャッシュ・引用の実務点検。H1 付近スニペット、4MB、JS 非実行は RESONEO/SEL が支える範囲だけ。
- **主枠：** [Search Engine Land / RESONEO 2026-08-17](https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036) — 取得成功。**第三者観察。OpenAI 公式ではない。**
- **補助：** [Peec / Tomek Rudzki 2026-09-04](https://peec.ai/blog/chatgpt-built-its-own-search-index) — 取得成功。**Labrador 名称・自前インデックス説は第三者観察。OpenAI 確認として扱わない。**
- **既存との差：** 公式の商品探索発表ではなく、一般ページの拾われ方。
- **薄めなかった。** 未確認アーキテクチャを断定しないことで厚みを保った。

---

## ソース取得

| URL | 結果 |
| --- | --- |
| developers.cloudflare.com changelog 2026-07-01 | 成功 |
| nielseniq.com NIQ×Similarweb | 成功 |
| SEJ weighted visibility | 成功 |
| shopify.com/enterprise/blog/ai-search-category-behavior | 成功 |
| techcrunch.com Shopify earnings AI search | 成功（補助） |
| SEJ Google/ChatGPT coexistence | 成功 |
| blog.google Gemini 3.8 Flash | 成功 |
| searchengineland.com Gemini 3.8 AI Mode | 成功 |
| wearesocial.com.au GEO guide | 成功 |
| developers.google.com Search Central gen-ai-performance-reports | 成功 |
| SEJ GSC AI impressions | 成功 |
| ahrefs.com/blog/schema-ai-citations | 成功 |
| SEJ Ahrefs myths pack | 成功（提供記事） |
| searchengineland.com ChatGPT retrieval stack | 成功 |
| peec.ai ChatGPT search index | 成功 |

**取得失敗で本文を薄めた稿はない。** 弱いのは「公式未確認」であり、該当稿（加重スタック、共存測定、GSC の読み、ChatGPT 取得、Peec）はラベルで処理した。

---

## ABIS 境界（横断）

全稿を discovery / understanding / comparison / recommendation / visibility / authority（一部は浅い actionability＝測定や情報設計）に閉じた。入れてないもの：

- 実行プロトコル、ビジネス相互作用の意味論、取引レール、成果検証の標準
- Muse / Anthropic コマース実装の深掘り
- OpenAI / Google の内部実装を確定事実として書くこと
- Peec の Labrador を OpenAI 確認として書くこと

---

## 推奨スケジュール（提案のみ・未適用）

平日・1日1本の既存ポリシーに沿った提案。**schedule.json は未変更。**

| 提案日 | 曜 | slug |
| --- | --- | --- |
| 2026-09-17 | 木 | cloudflare-ai-traffic-search-agent-training |
| 2026-09-18 | 金 | niq-similarweb-agentic-shelf-measurement |
| 2026-09-24 | 木 | weighted-ai-visibility-stack |
| 2026-09-25 | 金 | shopify-ai-vs-organic-structured-catalog |
| 2026-09-28 | 月 | google-ai-coexistence-measurement |
| 2026-09-29 | 火 | gemini-3-8-ai-mode-visibility |
| 2026-09-30 | 水 | geo-social-citation-authority |
| 2026-10-01 | 木 | gsc-ai-impressions-how-to-read |
| 2026-10-02 | 金 | schema-not-ai-citation-cheat-code |
| 2026-10-03 | 土 | chatgpt-retrieval-citation-practice ※土日スキップ方針なら 2026-10-06（月）へずらす提案 |

投入するときは `insert-editorial-article.mjs --apply` と Buffer 編集を、この PR とは別オペレーションにすること。

---

## スポットチェック

- 10本とも `h1` / `.lead` / 本文 `h2` / `data-editorial-intent` あり
- source 由来のフッター重複なし（CTA・関連はジェネレータ各1回）
- `schedule.json` の 9/11・9/14・9/15・9/16 スロットは元のまま
- Buffer ファイルは未変更
