# ARI-P0-03 Completion Report — AI流入・問い合わせ計測の基準整備

## TASK_ID
ARI-P0-03

## STATUS
**DUAL_TAG_VALIDATION**（2026-09-10 — 専用プロパティ `G-RGP8XZHK5V` への二重送信フェーズ開始。GA4 Realtime 実測は手動確認待ち）

## BRANCH
`fix/ari-p0-03-measurement`

## BASE_SHA
`a2a87abe69f878c1d357a43328ccfa9db17b063c`（main）

## FINAL_SHA_OR_UNCOMMITTED
`a2a87abe69f878c1d357a43328ccfa9db17b063c`（未コミット差分あり）

---

## FINDINGS_WITH_EVIDENCE

### ALREADY_SATISFIED（変更前から成立）

| 項目 | 証拠 |
| --- | --- |
| GA4基盤（DUAL_TAG） | `assets/ga4.js` — legacy `G-BS30YQY1N7` + dedicated `G-RGP8XZHK5V`、gtag直接、GTMなし |
| `landing_view` 全ページ | `assets/ga4.js` `trackLandingView()` |
| `cta_click` / 初回・直近タッチ | `assets/sitewide-cta-tracking.js` — `ari_attribution_v1` |
| 購入＝Stripe検証後のみ | `api/verify-purchase.js` + `report/src/fulfillment.js` → `trackPurchaseVerified({ verified: true })` |
| サーバー側購入デデュープ | `scripts/lib/funnel/conversions.mjs` `ConversionRepository` + phase6テスト |
| 相談クリック≠予約完了 | `CONSULT_CLICK` は `partner_consult_cta_click` のみ。`CONSULT_BOOKED` は型定義のみ（phase6） |
| PII除外（クライアント） | `report/src/analytics.js` delete safe fields; whitepaper `track()` フィルタ |
| 価格商流維持 | ¥29,800 / 月額¥60,000 — 既存コピー・`REPORT_VALUE_JPY` 未変更 |
| P0-02依存 | Insights公開制御は計測タスクのブロッカーではない（並行可能） |

### ギャップ（本タスクで対応）

| ギャップ | 対応 |
| --- | --- |
| `service_view` 未実装 | `assets/ga4.js` に商業サービス面のみ発火 |
| canonical名とlegacy名の辞書不在 | `scripts/lib/measurement/event-dictionary.mjs` + `reports/ARI-P0-03-event-dictionary.md` |
| `diagnosis_*` / `lead_submit_success` / `purchase` エイリアス | `canonical-emit.mjs` + `window.ariMeasurement.emitWithAlias` |
| 購入GA二重計上（リロード） | `purchaseDedupeKey` + `localStorage` |
| 認知経路（任意）未収集 | whitepaperフォーム + `awarenessChannelSelfReported`（申告のみ、UTMと分離） |
| テストトラフィック分離 | `debug_mode` + `traffic_type: internal`（非本番ホスト / `?ari_debug=1`） |

### BLOCKED（本リポジトリ外・未検証）

| 項目 | 理由 |
| --- | --- |
| GA4直近28日実数 | Data API / 管理画面アクセスなし — 数値補完なし（辞書にデータ要求項目記載） |
| `booking_confirmed` | 予約Webhook未接続。`www.coaretail.com/readiness/mtgschedule` はアウトバウンドのみ |
| localgeo.coaretail.com タグ構成 | 別プロパティ／別リポジトリ。readiness側はUTM付きリンクのみ確認 |
| GA4収集検証（本番） | デプロイ未実施。コード送信検証のみ完了 |

### 実測ゼロ vs 未計測の区別

- **未計測（意図的）**: `booking_confirmed`, Local GEO購入, バックエンド商談成約
- **計測実装済み（本番未反映のためGA上の件数は未確認）**: `service_view`, canonicalエイリアス群
- **GA4件数ゼロかどうか**: **未検証**（BLOCKED）

---

## FILES_CHANGED

### 新規
- `scripts/lib/measurement/event-dictionary.mjs`
- `scripts/lib/measurement/canonical-emit.mjs`
- `scripts/tests/ari-p0-03-measurement.test.mjs`
- `reports/ARI-P0-03-event-dictionary.md`
- `reports/ARI-P0-03-measurement-completion-report.md`（本ファイル）

### 変更
- `assets/ga4.js`
- `assets/whitepaper-lead-capture.js`
- `report/src/analytics.js`
- `scripts/lib/funnel/events.mjs`
- `scripts/lib/funnel/conversions.mjs`
- `scripts/lib/funnel/lead-capture.mjs`
- `scripts/lib/funnel/lead-schema.mjs`
- `whitepaper/2026/free/index.html`

---

## CHANGES

1. **イベント辞書** — P0 canonical 8種の定義・実装状態・非同等イベントを機械可読＋Markdownで固定
2. **`service_view`** — `/report/`, `/research/`, `/whitepaper/`, `/framework/`, `/oisummit/`, `/improve.html`
3. **Canonicalエイリアス** — `report_start`→`diagnosis_start`, `report_result_view`→`diagnosis_complete`, `lead_created`→`lead_submit_success`, `purchase_verified`→`purchase`（verified=trueのみ）
4. **二重計上防止** — 購入: `ari_ga_purchase:{sessionId}`; リード成功: `ari_ga_lead_success:{leadId}`
5. **認知経路（任意）** — フォームselect → `awareness_channel_self_reported`（GA）/ `awarenessChannelSelfReported`（リードスキーマ）。UTMは上書きしない
6. **テスト分離** — 非本番ホスト・`ari_debug=1` で `traffic_type: internal`
7. **クロスドメイン** — GA linker追加なし。localgeoは既存UTM outbound（`utm_source=ari_report`）を維持

---

## TESTS_AND_RESULTS

```bash
node --test scripts/tests/ari-p0-03-measurement.test.mjs
# 9/9 PASS

node --test scripts/tests/ari-p0-03-measurement.test.mjs \
  scripts/tests/phase6-conversion-attribution.test.mjs \
  scripts/tests/analytics.test.mjs \
  scripts/tests/phase9e-revenue-measurement.test.mjs
# 32/32 PASS
```

| 検証種別 | 結果 |
| --- | --- |
| イベント送信コード検証 | PASS（静的テスト + モジュール単体） |
| GA4収集検証（DebugView/本番） | **未実施**（デプロイ待ち） |
| サブドメイン遷移 | コードレビュー: UTM outboundのみ、linkerなし |

---

## DEPLOYMENT_STATUS
**未デプロイ** — レビュー可能な未コミット差分。本番反映は別セッションで明示許可後。

## PRODUCTION_CHECKS
未実施（本番は現行 `ga4.js` — `service_view`・エイリアス・認知経路なし）

---

## BLOCKERS

1. GA4 Data API — 28日ベースライン取得にはプロパティ読取権限が必要
2. `booking_confirmed` — 予約システムWebhook契約・実装が必要
3. localgeo — 別リポジトリのタグ監査が必要（readiness側はUTM引継ぎのみ確認済み）

---

## ROLLBACK

- ブランチを破棄、または `assets/ga4.js` / `report/src/analytics.js` / whitepaper関連を revert
- 新規 `scripts/lib/measurement/` を削除しても既存legacyイベントは継続動作（エイリアス停止のみ）

---

## NEXT_TASK
**P1-01**

---

## 更新履歴
- 2026-09-08: ARI-P0-03 初回完了（VERIFIED）
