# RMVU-05H — Cloudflare AEO Source Review (Phase 0)

Primary source: https://blog.cloudflare.com/aeo  
Source announcement date: **2026-08-06** (RSS / editorial intelligence)  
Review date: **2026-08-09**

---

## FACT（Cloudflare公式に書かれている）

1. Cloudflareは Agent Readiness ダッシュボード統合と **Answer Engine Optimization (AEO)** ツールを発表した。
2. タイトル: *From ranking to recommended: get your site ready to thrive in the age of AI agents*
3. 顧客の意思決定は、人間がホームページを見る前に、AIアシスタントの応答内で起きる場面が増えている。
4. Cloudflareのカウントでは、HTMLページリクエストの **半数未満** が人間由来。エージェント向けトラフィックの割合は増加中。
5. 従来の指標（人間のクリック・PV）だけでは全体像を描けない。
6. **Agent Readiness Diagnostics** は、エージェントがサイトを読む方法（robots.txt、sitemap、ヘッダー、Markdown版、認証・ツール用メタデータ等）でサイトをスキャンし、pass/fail/neutral と根拠を返す。
7. **AEO tab** は、カテゴリ内の質問でAIアシスタント（現時点で Anthropic Claude と OpenAI GPT）が自社を推薦するかをプローブする。検索順位のような指標はない。
8. 業界・カテゴリはサイトから推定し、カテゴリ横断のベンチマークを事前計算して再利用する。
9. **AI Operator Activity** で OpenAI/Google 等のクロール・リファラルトラフィックを可視化する。
10. AEO Visibility は **early access** をリクエストする形（一般提供の詳細は本文末尾）。

---

## CLOUDFLARE POSITION

- Discoverability は「検索結果ページでの順位」から「エージェントに見つけられ、読まれ、自信を持って推薦されること」へ移行している。
- エージェントをサイトの **コアユーザーベース** として扱うべき。
- 技術的には、見つけやすく・読みやすく・信頼できるサイトが推薦されやすい（早期SEOと同型の論旨）。
- Diagnostics = 読めるか。AEO = 推薦されるか。の二層。
- Cloudflare経由のトラフィックを計測できるため、推定より実測に近いデータを提供できる、という位置づけ。

---

## ARI INTERPRETATION

| Layer | Impact |
|-------|--------|
| **Discovery** | 高 — 「見つけられ、読まれ、推薦される」へのフレーム転換 |
| **Understanding** | 中 — machine-readable copy、メタデータ、一貫した企業表現 |
| **Comparison** | 中 — AEOがカテゴリ内推薦・引用位置を測る |
| **Recommendation** | 高 — 核心メッセージが ranking → recommended |
| **Action** | 低〜中 — 本文は主に可視性・推薦。実行導線そのものは副次 |

Cloudflareは **infrastructure / measurement** 視点。ARIは **Business / Recommendation Readiness** 全体（一貫性・比較情報・行動導線）で読む。

---

## UNKNOWN

- AEO Visibility の一般提供時期・地域・料金
- プローブ対象モデル・プロンプトの固定性（将来変更の可能性）
- ベンチマークパネルの更新頻度
- 非Cloudflare利用サイトでの同等計測方法（本文はCloudflareダッシュボード前提）
- 「推薦されない」ことと売上損失の因果（Cloudflareも推定に留める）

---

## Editorial Decision

**NEW ARTICLE** — Current Event として独立価値あり。

**Reason:** `ari-vs-geo-seo` は SEO/GEO/ARI 比較の evergreen。本件は Cloudflare 2026-08 発表に基づく **ranking→recommended** の時事解釈。`ai-search-shift` は比較軸の一般論。重複は部分あり（cannibalization MERGE 未満）だが、Current Event + 公式一次ソースの解釈記事として差別化。
