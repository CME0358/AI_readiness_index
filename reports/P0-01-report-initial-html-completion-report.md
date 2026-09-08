# P0-01 Completion Report — /report/ Initial HTML & Canonicalization

## TASK_ID
P0-01

## STATUS
VERIFIED（ローカルビルド・プレビュー検証済み。本番未反映）

## BRANCH
`fix/report-initial-html-p0-01`

## BASE_SHA
`a2a87abe69f878c1d357a43328ccfa9db17b063c`（main）

## FINAL_SHA_OR_UNCOMMITTED
未コミット（本ブランチ上の作業ツリー）

変更ファイル:
- `report/index.html`
- `report/src/agent-readiness-report.jsx`
- `vercel.json`
- `sitemap.xml`
- `scripts/lib/report-static-landing.mjs`（新規）
- `scripts/tests/report-initial-html.test.mjs`（新規）

---

## FINDINGS_WITH_EVIDENCE

### 1. 監査結果（本番・2026-09-08 観測）

| 項目 | `/report` | `/report/` | 判定 |
| --- | --- | --- | --- |
| HTTPステータス | 200 | 200 | 両方配信（redirect未適用＝**修正前**） |
| 初期HTML `#root` | 空 | 空 | **JS依存SPA**。script/style除去後は title+meta のみ（text ~34字） |
| canonical | なし | なし | **欠落** |
| robots meta | なし | なし | **欠落**（noindexではない） |
| X-Robots-Tag | なし | なし | ヘッダー制御なし |
| 本文（販売情報） | JS実行後のみ | 同上 | 前スレッド観測は**初期HTMLの事実**。Google未登録・JS故障とは断定しない |

**根拠:** `curl -sI https://readiness.coaretail.com/report/` → 200, `content-length: 2137`, body `<div id="root"></div>` のみ。

### 2. 切り分け

- **テンプレート不良ではない** — Viteビルドは正常。初期HTMLに販売本文を載せていない設計が原因。
- **JS依存** — `report/src/main.jsx` が `#root` を React で全面置換。購入フォーム・Stripe導線はクライアント側（回帰なし確認済み）。
- **取得制限** — `robots.txt` は `Allow: /`、 `/report/` の Disallow なし。GPTBot 専用ルールなし（学習許可は変更していない）。
- **bot到達ログ** — Vercel アクセスログは本セッションでは未参照。**UA偽装curlは本物bot許可の証拠にしない**（要件遵守）。

### 3. 正規化・内部リンク（修正前）

| 経路 | 状態 |
| --- | --- |
| sitemap.xml | `https://readiness.coaretail.com/report/` 登録済み（lastmod 2026-07-08） |
| llms.txt | `/report/` リンクあり |
| Insights / ホーム | `href="/report/"` 多数（既存テスト phase9b で検証済み） |
| `/report` vs `/report/` | 両方200・同一etag（正規化未統一） |

---

## CHANGES

### 実装方針
SSR全面移行は行わず、**Viteエントリ `report/index.html` に crawler-visible な静的ランディング**（`#report-static-landing`）を `#root` 内に配置。React起動時に同内容へ置換（bot別内容なし）。

### 主な変更
1. **`report/index.html`**
   - 販売説明・価格¥29,800（税別）・23項目・納品内容・購入/相談/Local GEOリンクを初期HTMLに追加
   - `rel=canonical` → `https://readiness.coaretail.com/report/`
   - `meta robots` → `index, follow`
   - OG/Twitter、`Product` JSON-LD（税別29,800）
   - `/report/p/*`・partner-preview では静的ブロックを非表示（`data-report-route=preview`）

2. **`report/src/agent-readiness-report.jsx`**
   - ヒーローに `Decision Product — Personalized Decision Report` と `id="start"`（静的CTA `#start` と整合）

3. **`vercel.json`**
   - `/report` → `/report/` 301 リダイレクト追加

4. **`sitemap.xml`**
   - `/report/` の `lastmod` を 2026-09-08 に更新

5. **テスト**
   - `scripts/lib/report-static-landing.mjs` — 必須マーカー定義
   - `scripts/tests/report-initial-html.test.mjs` — 初期HTML・canonical・robots・sitemap・distビルド検証

---

## FILES_CHANGED
（上記6ファイル）

---

## TESTS_AND_RESULTS

| テスト | 結果 |
| --- | --- |
| `node --test scripts/tests/report-initial-html.test.mjs` | **PASS** 5/5 |
| `node --test scripts/tests/market-positioning.test.mjs` | **PASS**（T03 Decision Product 復帰） |
| `node --test scripts/tests/phase9c-report-proof.test.mjs` | **PASS** |
| `node --test scripts/tests/product-report-design.test.mjs` | **PASS** |
| `cd report && npm run build` | **PASS**（dist/index.html 7.26KB、静的本文保持） |

### ローカル検証（修正後）

| 検証 | 結果 |
| --- | --- |
| script/style除去後テキスト長 | **854字**（修正前本番 ~34字） |
| マーカー（¥29,800, 23項目, Decision Product, レポートを入手する, 月額60,000円, 無料相談） | **すべて本文に存在** |
| canonical / robots | `https://readiness.coaretail.com/report/` / `index, follow` |
| ブラウザ描画（`http://127.0.0.1:5188/report/`） | ヒーロー・価格・FAQ・Local GEO CTA **一致** |
| 購入導線クリック | 「レポートを入手する」→ 入力フォーム（Stripe表記）**回帰なし** |
| Stripe実課金 | **未実行**（ローカル・テストモード範囲） |

---

## DEPLOYMENT_STATUS
**未デプロイ** — 本プロンプトでは本番反映指示なし。Vercel main マージ後 `npm run build:all` 経由で反映。

### 反映手順（レビュー後）
```bash
git checkout fix/report-initial-html-p0-01
# review → merge to main
# Vercel production deploy（既存ゲート）
```

---

## PRODUCTION_CHECKS
本番は**修正前コードのまま**。デプロイ後に再確認すべき項目:

1. `curl -sI https://readiness.coaretail.com/report` → **301** → `/report/`
2. 初期HTMLに `#report-static-landing` と ¥29,800 本文
3. `rel=canonical` が `/report/`
4. 購入フォーム・Stripe Payment Link（テストモードで1回）

---

## BLOCKERS
- **本番bot到達ログ** — Googlebot/Bingbot/OAI-SearchBot の実アクセス証跡は未検証（ログ権限・観測期間が必要）
- **本番デプロイ** — 明示許可待ち

---

## ROLLBACK
- `report/index.html` の `#report-static-landing` ブロックと head メタを削除し `#root` を空に戻す
- `vercel.json` の `/report` redirect を削除
- `sitemap.xml` lastmod を戻す（任意）

---

## NEXT_TASK
**P0-02**

---

## 更新履歴
- 2026-09-08: P0-01 実装・ローカル検証完了
