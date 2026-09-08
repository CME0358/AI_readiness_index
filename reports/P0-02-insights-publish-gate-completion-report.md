# P0-02 Completion Report — Insights Publication Gate & Card Summary

## TASK_ID
P0-02

## STATUS
VERIFIED（ローカル同期・テスト済み。本番未反映）

## BRANCH
`fix/insights-publish-p0-02`（作業ツリーに P0-01 未コミット差分が同居 — マージ前に分離推奨）

## BASE_SHA
`a2a87abe69f878c1d357a43328ccfa9db17b063c`（main）

## FINAL_SHA_OR_UNCOMMITTED
未コミット

**新規:**
- `scripts/lib/insights-card-summary.mjs`
- `scripts/lib/insights-index-cards.mjs`
- `scripts/lib/insights-public-sync.mjs`
- `scripts/sync-insights-public-surfaces.mjs`
- `scripts/tests/insights-publish-gate-p0-02.test.mjs`
- `reports/P0-02-insights-publish-gate-completion-report.md`

**更新:**
- `scripts/lib/publish-scheduled-insights-core.mjs`
- `scripts/lib/unlock-next-insight.mjs`
- `insights/index.html`（sync 再生成）
- `sitemap.xml`（sync 再生成）
- `llms.txt`（sync 再生成）
- `vercel.json`（`/_scheduled/` 404、`/report` redirect は P0-01 同居）

---

## FINDINGS_WITH_EVIDENCE

### 1. 正式データ源と公開判定（事実）

| 項目 | 所在 |
| --- | --- |
| スケジュール | `insights/_scheduled/schedule.json` |
| ステータス | `scripts/lib/editorial-status.mjs` — `editorial_hold` / `scheduled` / `published` |
| 公開時刻 | `publishAt`（ISO8601 `+09:00`）、ポリシー `10:00` JST・平日のみ |
| 公開実行 | `publishDueArticles()` → `selectNextDueArticle()` + `publishAt <= now` |
| 日次ゲート | Vercel cron `0 0 * * 1-5`（UTC）→ reconcile / publish パイプライン |
| unlock | `unlock-next-insight.mjs` — 前日 15:00 JST 枠で `scheduled` 化 |
| RSS | **公開向け RSS フィードは未実装**（editorial-intelligence 内部 RSS のみ） |

### 2. 前スレッド観測の再確認（2026-09-08 本番 curl）

| 観測 | 本番（修正前） | ローカル（修正後 sync） |
| --- | --- | --- |
| planned slug | `openai-product-discovery-agentic-commerce` | `exec-readiness-kpi`（ローカル schedule が本番より遅延） |
| `2026-09-14` 日付 | planned カードに **表示**（公開予定として妥当） | 未公開 slug は sitemap/llms **非掲載** |
| `定義ではなく運用設計` | **掲載**（`three-pillars-ops` カード） | **除去** — metaDescription ベース要約に置換 |
| 空状態 | `hidden` だが HTML に文言残存 | 記事あり時は `hidden` 維持 + JS で `.insight-card` 全件判定 |
| sitemap 未公開 | 本番は `exec-readiness-kpi` 掲載済み（公開済みと推定） | `openai-product` / `exec-readiness`（未 on-disk）**非掲載** |

**切り分け:** 2026-09-14 は **公開予定カード**の日付表示であり、公開一覧リンクではない。問題は **編集メモ型 cardSummary の漏洩** と **sync 不整合リスク**。

### 3. ALREADY_SATISFIED（修正不要だった部分）

- `build:all` が `public_build/insights/_scheduled` を除去 — **事実**（`package.json` `build:all`）
- `validate-insights-v2.mjs` の planned カード 1 件ゲート — **既存**
- JST 10:00 前後の `extractDueArticles` — **既存テスト pass**（`publishing-reliability-v2.test.mjs`）

---

## CHANGES

1. **`insights-card-summary.mjs`** — `resolvePublicCardSummary()`  
   - `metaDescription` / SEO `meta` / `lead` を優先  
   - 句点なし「〜ではなく〜」末尾・途中切れ英字のみを編集メモ判定  
   - **句点付き正当な比較文は保持**（例: 「検索順位ではなく段階別到達率…。」）

2. **`insights-public-sync.mjs` + CLI** — 公開面を schedule + on-disk から一括再構築  
   - 掲載: `status=published` かつ `insights/{slug}/index.html` 実在のみ  
   - planned: 最早 `scheduled` 1 件（`data-scheduled-slug`、非リンク）  
   - sitemap / llms の Insights ブロックを公開済みのみに同期  
   - `assertNoUnpublishedSurfaceLeak()` で hold/scheduled 漏洩検査

3. **`publish-scheduled-insights-core.mjs`** — 公開後に `syncInsightsPublicSurfaces()` を呼び出し、`publicationState: 'PUBLISHED'` を設定

4. **`insights/index.html`** — sync 実行でカード要約修正、空状態 JS を `.insight-card` 全件基準に変更

5. **`vercel.json`** — `/insights/_scheduled/:path*` → 404（ビルド除外の二重防御）

---

## FILES_CHANGED
（上記）

---

## TESTS_AND_RESULTS

| テスト | 結果 |
| --- | --- |
| `node --test scripts/tests/insights-publish-gate-p0-02.test.mjs` | **PASS** 8/8 |
| `publish-planned-card.test.mjs` | **PASS** |
| `publishing-reliability-v2.test.mjs` | **PASS** |
| `publishing-reconcile.test.mjs` | **PASS** |
| 合計（上記4ファイル） | **PASS 51/51** |

**検証シナリオ（P0-02 テスト内）:**
- JST 09:59 → 未公開 / 10:00 → 公開対象
- hold 記事 → planned 除外
- dry-run → index 非変化
- sitemap/llms に scheduled slug 非掲載

**手動確認（ローカル sync 後）:**
- `three-pillars-ops` カード: 「定義ではなく運用設計とオーナーシップ」→ 読者向け meta 要約
- `llms.txt`: `openai-product` / `exec-readiness` **なし**
- `sitemap.xml`: 同上 **なし**

**未実行:** Buffer/SNS 実発火（要件どおり未実行）。既存 reconcile テストでゲート一致を確認。

---

## DEPLOYMENT_STATUS
**未デプロイ**

反映手順:
```bash
git checkout fix/insights-publish-p0-02
# P0-01 と分離してコミット推奨
node scripts/sync-insights-public-surfaces.mjs   # 必要時
npm run build:all
# merge → Vercel production
```

公開後は reconcile cron（平日 JST 10:00 帯）で `syncInsightsPublicSurfaces` が publish 経由自動実行。

---

## PRODUCTION_CHECKS
デプロイ後に確認:

1. `curl -sL https://readiness.coaretail.com/insights/ | rg '定義ではなく運用設計'` → **0件**
2. planned は 1 件のみ、`data-scheduled-slug` が schedule 最早 scheduled と一致
3. `curl -sL https://readiness.coaretail.com/sitemap.xml | rg openai-product` → **0件**（未公開時）
4. `curl -sI https://readiness.coaretail.com/insights/_scheduled/schedule.json` → **404**
5. 公開済み記事直URL → 200、未公開 scheduled → 404

---

## BLOCKERS
- **本番デプロイ** — 本プロンプトでは未許可
- **本番 schedule とローカル repo の差分** — 本番は `exec-readiness-kpi` 公開済み・planned が `openai` へ進行。ローカルは未 pull のため planned が `exec-readiness-kpi` のまま（**運用同期はデプロイ後の reconcile で整合**）
- **bot 到達ログ** — 未検証

---

## ROLLBACK
- 新規 lib 3 ファイル + sync CLI を削除
- `publish-scheduled-insights-core.mjs` の sync 呼び出しを元の逐次 insert に戻す
- `git checkout` で `insights/index.html` / `sitemap.xml` / `llms.txt` を復元
- `vercel.json` の `_scheduled` redirect を削除

---

## NEXT_TASK
**P0-03**

---

## 更新履歴
- 2026-09-08: P0-02 実装・ローカル sync・テスト完了
