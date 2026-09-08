# ARI-P1-02 Completion Report — サービス・料金・見本・実績ページ

## TASK_ID
ARI-P1-02

## STATUS
**VERIFIED**（ローカルテスト済み・本番未反映）

## BRANCH
`fix/ari-p1-02-service-pages`（P0-03 計測差分を含む同一作業ツリー）

## BASE_SHA
`a2a87abe69f878c1d357a43328ccfa9db17b063c`

## FINAL_SHA_OR_UNCOMMITTED
`a2a87abe69f878c1d357a43328ccfa9db17b063c`（未コミット）

---

## FINDINGS_WITH_EVIDENCE

### 依存 P1-01
**NOT_STARTED**（リポジトリ内に P1-01 完了レポートなし）。本タスクは既存 URL（`/report/`, `/improve.html`, `/research/`）を拡充する形で**独立実施可能**と判断。

### ALREADY_SATISFIED（変更前）

| 項目 | 証拠 |
| --- | --- |
| Company Report ¥29,800（税別） | `scripts/lib/product-catalog.mjs` `priceExTax: 29_800` |
| Local GEO 月額 ¥60,000（税別） | `index.html`, `report/index.html` outbound UTM |
| Advisory ¥198,000〜・12ヶ月 | `improve.html` + `product-positioning.test.mjs` |
| レポート demo 見本（SPA内） | `report/src/agent-readiness-report.jsx` `?report=demo` + `reportMode === "sample"` + SAMPLE banner |
| 研究と商用の分離方針 | `evidence/index.html`, `methodology.html` |
| Bar SECRET 社内実績言及 | `50_Knowledge/INDEX.md`「GEO対策後にAI検索上位表示達成」 |

### ギャップ（本タスクで対応）

| ギャップ | 対応 |
| --- | --- |
| サービス・料金の一覧ハブなし | `/services/` 新設 |
| 見本の入口が report SPA 内のみ | `/sample/` → `/report/?report=demo` |
| 公開事例ページなし | `/cases/`, `/cases/bar-secret/` |
| 未確認商用条件の明示場所なし | `/services/#unresolved` 管理リスト |
| sitemap / build 未登録 | `sitemap.xml`, `package.json` `build:all` 更新 |

### BLOCKED

| 項目 | 理由 |
| --- | --- |
| Bar SECRET 観測クエリ・スクリーンショット公開 | 公開版ログ未整備 |
| 来店数・売上インパクト | 検証データなし — ページに掲載せず |
| Local GEO 契約・広告費詳細 | 別サイト・正式資料待ち |
| 匿名化した実購入レポート PDF | リポジトリに実物なし — demo 見本で代替（明示） |

---

## FILES_CHANGED

### 新規
- `scripts/lib/service-offerings.mjs`
- `services/index.html`
- `sample/index.html`
- `cases/index.html`
- `cases/bar-secret/index.html`
- `scripts/tests/ari-p1-02-service-pages.test.mjs`
- `reports/ARI-P1-02-service-pages-completion-report.md`

### 変更
- `index.html` — nav + hub card 07
- `sitemap.xml` — 4 URL 追加
- `llms.txt` — Services / Sample / Cases
- `package.json` — `build:all` に services/sample/cases コピー
- `assets/ga4.js` — `service_view` パス追加
- `scripts/lib/measurement/event-dictionary.mjs` — 同上

---

## CHANGES

1. **`/services/`** — 3製品の料金（税別）・契約・成果物・対応外・申込後フロー比較表。研究（Methodology）と成果（Cases）の区別を明記。
2. **`/sample/`** — ILLUSTRATIVE / 架空データのバナー。既存 `?report=demo` にリンク。購入 CTA へ接続。
3. **`/cases/bar-secret/`** — 観測・顧客申告・ログを表で分離。増加率・因果は断定しない。公式サイトリンクのみ。
4. **`service-offerings.mjs`** — 価格・範囲の単一ソース + `UNRESOLVED_COMMERCIAL` リスト。
5. **内部リンク** — 研究→サービス、事例→相談、見本→購入。トップ nav / hub / llms 同期。

---

## TESTS_AND_RESULTS

```bash
node --test scripts/tests/ari-p1-02-service-pages.test.mjs
# 8/8 PASS

node --test scripts/tests/ari-p1-02-service-pages.test.mjs \
  scripts/tests/product-positioning.test.mjs \
  scripts/tests/ari-p0-03-measurement.test.mjs
# 38/38 PASS
```

| 検証 | 結果 |
| --- | --- |
| 価格・税区分・canonical | PASS（静的テスト） |
| 架空見本の明示 | PASS |
| Bar SECRET 増加率なし | PASS |
| AggregateRating/Review スキーマなし | PASS |
| GA4 / service_view | コード検証 PASS |
| 本番 HTML 確認 | **未実施**（未デプロイ） |

---

## DEPLOYMENT_STATUS
未デプロイ。`npm run build:all` で `public_build/services|sample|cases` に含まれる。

## PRODUCTION_CHECKS
未実施。

---

## BLOCKERS
- 実購入レポートの匿名化見本 PDF — 素材が Vault 外
- Bar SECRET 定点観測の公開版 — 別タスクで Evidence 連携可能
- P1-01 未完了 — 本タスクのブロッカーではない

---

## ROLLBACK
新規 `services/`, `sample/`, `cases/` 削除。sitemap・index・package.json・ga4 の差分を revert。

---

## NEXT_TASK
**P1-03**

---

## 更新履歴
- 2026-09-08: ARI-P1-02 初回完了（VERIFIED）
