# ARI-P2-01 Completion Report — SEO・購入意図コンテンツ・内部リンク

## TASK_ID
ARI-P2-01

## STATUS
**VERIFIED**（ローカルテスト済み・本番未反映）

## BRANCH
`fix/ari-p2-01-seo-intent`

## BASE_SHA
`9a09bb376907261dd03e1d1bab2f83668acb5686`

## FINAL_SHA_OR_UNCOMMITTED
`18371d35dbf3759aa2f31077ccf1b3a9727082b3`

---

## FINDINGS_WITH_EVIDENCE

### 依存 P1-03
**DEPLOYED**（`reports/ARI-P1-03-dropoff-completion-report.md`）。`/#company-check` 再試行・相談CTAを購入意図ガイドから接続。

### キーワード・需要データ棚卸し

| 状態 | 内容 |
| --- | --- |
| **データなし** | GSC/検索ボリュームの公式データはリポジトリに未接続 |
| **仮説** | `AI検索対策 内製 外注` — `QUERY_INVENTORY` で `hypothesis` ラベル |
| **mapped** | 依頼先・料金 → `/guides/ai-search-services/` + `/services/` |
| **evidence_backed** | ChatGPTに出ない → `blind` + Research 100問・5業種231件（`blind/index.html` L276-277） |
| **evidence_backed** | 競合比較 → `competitor-blind-spot` + 定点観測手順 |

検索量は**捏造していない**（`purchase-intent-topics.mjs` + テストで禁止パターン検証）。

### 優先3テーマ（実装済み）

| # | テーマ | URL | 選定理由 |
| --- | --- | --- | --- |
| 1 | 依頼先・料金・範囲 | `/guides/ai-search-services/` | 商流直結・`service-offerings.mjs` 根拠 |
| 2 | ChatGPTに出ない確認手順 | `/guides/chatgpt-visibility-check/` | `blind` 需要・無料 Check 接続 |
| 3 | 内製/外注・競合観測 | `/guides/inhouse-vs-outsource/` | `competitor-blind-spot` 購入直前ニーズ |

### ALREADY_SATISFIED（変更最小）

| 項目 | 証拠 |
| --- | --- |
| ¥29,800 / 月額¥60,000（税別） | `service-offerings.mjs` + 各 guide 表 |
| Insights 購入意図記事 | `ari-vs-geo-seo`, `blind`, `competitor-blind-spot` 既存 |
| 内部リンク自動化 | `insights-related-links.mjs`（TMVU-03） |
| `_scheduled` 非公開 | `build:all` で `public_build/insights/_scheduled` 削除 |

### バックログ（P2-01 未実装）

- `vendor-selection` — editorial_hold、公開ゲート後に playbook 接続
- 歯科垂直 `dental.html` — Report/相談分岐の専用 playbook
- Local GEO 詳細契約 — 別サイト・正式資料待ち

---

## FILES_CHANGED

### 新規
- `scripts/lib/purchase-intent-topics.mjs`
- `guides/index.html`
- `guides/ai-search-services/index.html`
- `guides/chatgpt-visibility-check/index.html`
- `guides/inhouse-vs-outsource/index.html`
- `scripts/tests/ari-p2-01-seo-intent.test.mjs`
- `reports/ARI-P2-01-seo-intent-completion-report.md`

### 変更
- `services/index.html` — 購入前ガイド導線
- `insights/blind/index.html` — CHECK/REPORT/ガイド CTA 出し分け
- `insights/ari-vs-geo-seo/index.html` — 料金ガイド・services 接続
- `insights/competitor-blind-spot/index.html` — 内製/外注ガイド・CONSULT
- `scripts/lib/insights-related-links.mjs` — 購入経路向け related 強化
- `sitemap.xml` — guides 4 URL
- `package.json` — `build:all` に `guides/`
- `llms.txt` — Guides 1行（主施策ではない）
- `assets/ga4.js` / `event-dictionary.mjs` — `purchase_guide` service_view

---

## CHANGES

1. **購入前ガイド（/guides/）** — 手順・根拠リンク・サービスCTA。Insights の言い換えではなく次の一手に特化。
2. **Insights CTA 出し分け** — blind→CHECK、ari-vs-geo-seo→料金ガイド、competitor→内製/外注+相談。
3. **内部リンク** — `blind`↔`ari-vs-geo-seo`、`competitor-blind-spot`↔`blind`/`citation-vs-action`。
4. **SEO基盤** — canonical・sitemap・build 経路。llms.txt/schema は補助のみ。

---

## TESTS_AND_RESULTS

```bash
node --test scripts/tests/ari-p2-01-seo-intent.test.mjs   # 9/9 PASS
node --test scripts/tests/related-links.test.mjs          # PASS
```

| スイート | 結果 |
| --- | --- |
| `ari-p2-01-seo-intent.test.mjs` | **9/9 PASS** |
| `related-links.test.mjs` | PASS |
| `organic-acquisition-week1.test.mjs` T11 | **FAIL（既存）** — `editorial_hold` 件数 < 19。本タスク変更とは無関係 |

---

## DEPLOYMENT_STATUS
**未デプロイ** — プロンプトに本番反映指示なし。

### 反映手順
```bash
git checkout main && git merge fix/ari-p2-01-seo-intent
npm run build:all
git push origin main
# Vercel 自動デプロイ後:
# curl guides/ai-search-services/ canonical
# blind → guide リンク確認
```

---

## PRODUCTION_CHECKS
未実施

---

## BLOCKERS
- **GSC/検索ボリューム** — データ未接続。キーワード優先度は仮説+商流+根拠で決定。
- **vendor-selection** — スケジュール `editorial_hold` のため playbook 未接続。

---

## ROLLBACK
```bash
git revert <merge-commit>
# guides/ 削除、insights CTA を旧 whitepaper/partner リンクに戻す
```

---

## NEXT_TASK
**P2-02**
