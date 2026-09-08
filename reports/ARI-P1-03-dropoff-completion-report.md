# ARI-P1-03 Completion Report — 診断・相談・予約・購入の離脱改善

## TASK_ID
ARI-P1-03

## STATUS
**DEPLOYED**（本番反映・本番確認済み 2026-09-08）

## BRANCH
`fix/ari-p1-03-dropoff`

## BASE_SHA
`845c28ceeeddea845cdf849baa7a1ff43d2f258e`

## FINAL_SHA_OR_UNCOMMITTED
`6cd9c817fc7763f38762b85be546d45a110f7007`

---

## FINDINGS_WITH_EVIDENCE

### 依存 P1-02
**COMPLETE**（`reports/ARI-P1-02-service-pages-completion-report.md` 存在）。本タスクはフローUXに集中し、料金・サービスページ構造は変更なし。

### フロー監査（実画面・コード）

| フロー | 入口 | 主要実装 | API / 外部 |
| --- | --- | --- | --- |
| 無料診断（URL Check） | `index.html` `#company-check` | `assets/homepage-public-check.js` | `POST /api/public-check` |
| 無料相談 | 各ページ CTA | outbound | `https://www.coaretail.com/readiness/mtgschedule` |
| 無料リード（Whitepaper） | `whitepaper/2026/free/` | `assets/whitepaper-lead-capture.js` | `POST /api/whitepaper-lead` |
| 有料診断（Company Report） | `/report/` SPA | `report/src/fulfillment.js` | Stripe + `POST /api/verify-purchase` |
| Whitepaper 有料版 checkout | `whitepaper/2026/research/checkout.html` | `assets/whitepaper-checkout.js` | Stripe Payment Links |
| 購入後クオリフィケーション | `improve.html` | `assets/partner-qualification.js` | `POST /api/partner-qualification` |

### 離脱原因（修正前）

| 原因 | 証拠 |
| --- | --- |
| 送信失敗時にグローバルエラー1件のみ、項目別フィードバックなし | `whitepaper-lead-capture.js` が `catch` のみ |
| API `400 invalid_form` の `fields` を未使用 | `api/whitepaper-lead.js` L38 vs 旧クライアント |
| 送信中の視覚フィードバック弱い（disabled だけ） | lead / partner フォーム |
| 公開チェック失敗後の再試行 CTA なし | `homepage-public-check.js` |
| Checkout 即リダイレクト・二重クリック余地 | `whitepaper-checkout.js` L20-22 |
| 診断結果→相談の導線が結果画面に不足 | `index.html` `company-check-next` に CONSULT なし |

### ALREADY_SATISFIED（変更なしで維持）

| 項目 | 証拠 |
| --- | --- |
| 公開チェックはメール不要 | `index.html`「メールアドレスは不要です」 |
| スコア表示なし・推定の断定なし | `index.html`「公開ページから読み取った手がかりであり、断定ではありません」 |
| 二重送信ガード（submit disabled） | 各フォーム既存 + 強化 |
| P0-03 `lead_created` → `lead_submit_success` エイリアス | `assets/ga4.js` + `ariMeasurement.once` on 201 only |
| 料金維持 ¥29,800 / 月額¥60,000 | 既存文言・ルーティング CTA 文言 |
| Stripe cancel 復帰 | `?canceled=1` → `#wp-canceled` |
| `booking_confirmed` not_connected | 外部 mtgschedule のみ（Webhook なし） |

### BLOCKED（本タスク範囲外）

| 項目 | 理由 |
| --- | --- |
| `booking_confirmed` イベント接続 | mtgschedule 側 Webhook 未接続（P0-03 辞書で not_connected） |
| Stripe 本番 Payment Link / webhook 実課金確認 | プロンプト禁止・sandbox 未実行 |
| report SPA checkout のブラウザ E2E | Vite ビルド + Stripe 実環境が必要。静的解析・既存 RMVU テストで代替 |

---

## FILES_CHANGED

### 新規
- `assets/form-ux.js` — 共有 UX（draft / field errors / submit busy）
- `scripts/tests/ari-p1-03-dropoff.test.mjs`
- `reports/ARI-P1-03-dropoff-completion-report.md`

### 変更
- `assets/whitepaper-lead-capture.js` — draft 保持、項目別エラー、送信中表示、失敗時復帰
- `assets/partner-qualification.js` — 同上 + 成功時相談リンク
- `assets/whitepaper-checkout.js` — 二重クリック防止・接続中表示
- `assets/homepage-public-check.js` — `runCheck` 抽出・再試行ボタン
- `index.html` — 再試行ボタン・無料相談 CTA
- `improve.html` / `whitepaper/2026/free/index.html` — `form-ux.js` 読込
- `scripts/tests/ari-p0-03-measurement.test.mjs` — invalid_form 分岐に追従（`lead_created` 成功パス限定は維持）

---

## CHANGES

1. **`AriFormUx`** — localStorage draft（PII キー名のみ、ログなし）、`mapServerFields`、`bindSubmitButton`（`aria-busy` + 「送信中…」）
2. **Whitepaper リード** — API `fields` を日本語メッセージにマップ。失敗時入力保持・再送可能。成功時のみ `lead_created` + dedupe
3. **Partner qualification** — purpose/scope/timeline の項目別エラー。CONSULT 推奨時に mtgschedule 直リンク
4. **Homepage Check** — エラー時「もう一度試す」。結果に無料相談 CTA 追加
5. **Whitepaper checkout** — `redirecting` フラグ、`Stripeに接続中…`、`whitepaper_checkout_start`（新規・P0-03 非canonical）

---

## TESTS_AND_RESULTS

```bash
node --test \
  scripts/tests/ari-p1-03-dropoff.test.mjs \
  scripts/tests/ari-p0-03-measurement.test.mjs \
  scripts/tests/phase2-lead-capture.test.mjs \
  scripts/tests/phase5-partner-qualification.test.mjs \
  scripts/tests/phase9b-public-check.test.mjs
```

| 結果 | 件数 |
| --- | ---: |
| PASS | 70 |
| FAIL | 0 |

**未検証（別記）:** ブラウザ実機 mobile/desktop、Stripe sandbox 決済完了、mtgschedule 完了遷移の本番確認

---

## DEPLOYMENT_STATUS
**DEPLOYED** — `main` @ `2039c59` を `origin/main` に push。Vercel `npm run build:all` 自動デプロイ完了（約2.5分後に本番反映確認）。

## PRODUCTION_CHECKS
| 確認項目 | 結果 |
| --- | --- |
| `https://readiness.coaretail.com/assets/form-ux.js` | HTTP **200**、`AriFormUx` 定義あり |
| `index.html` `data-public-check-retry` | **1件** |
| `index.html` `homepage_check_consult` + mtgschedule | **1件** |
| `whitepaper/2026/free/` `form-ux.js` 読込 | **1件** |
| `homepage-public-check.js` `runCheck` | **3件** |
| `whitepaper-checkout.js` `redirecting` ガード | 本番に反映 |
| `POST /api/public-check` (`www.coaretail.com`) | HTTP **200** `ok:true` |

---

## BLOCKERS
- `booking_confirmed` — mtgschedule Webhook 未接続（仕様上 BLOCKED）
- Stripe 実課金 E2E — 本タスクでは sandbox 未実行

---

## ROLLBACK
```bash
git revert 6cd9c81
# または main から fix/ari-p1-03-dropoff をマージしていない場合はブランチ破棄
```

`assets/form-ux.js` 削除時は `whitepaper/2026/free/index.html` と `improve.html` の script タグも戻す。

---

## NEXT_TASK
**P2-01**
