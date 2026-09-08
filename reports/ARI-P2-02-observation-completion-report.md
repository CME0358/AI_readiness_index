# ARI-P2-02 Completion Report — AI推薦・SEO・商談の観測基盤

## TASK_ID
ARI-P2-02

## STATUS
**DEPLOYED**（本番反映・本番確認済み 2026-09-08）  
**OBSERVING**（実運用ベースライン未取得 — 観測期間未経過のため成果達成としない）

## BRANCH
`fix/ari-p2-02-observation` → merged to `main`

## BASE_SHA
`1377d89c0fa009ff516125e5173a04d6e432e676`（main @ P2-01 DEPLOYED 後）

## FINAL_SHA_OR_UNCOMMITTED
`0ee76a1d4c67db4d7e801140f71fe3212a96628b`（main にマージ・push済み）

---

## FINDINGS_WITH_EVIDENCE

### 依存タスク

| 依存 | 状態 | 証拠 |
| --- | --- | --- |
| P0-03 計測基準 | **VERIFIED**（GA4実測APIはBLOCKED） | `reports/ARI-P0-03-measurement-completion-report.md` — `isNonProductionHost`, `traffic_type: internal`, `ari_debug=1` |
| P2-01 購入意図コンテンツ | **DEPLOYED** | `reports/ARI-P2-01-seo-intent-completion-report.md` — `/guides/` 本番200確認済み |

### ALREADY_SATISFIED（変更前から成立）

| 項目 | 証拠 |
| --- | --- |
| GSC週次メモテンプレ | `reports/Organic Search Weekly Baseline.md`（RMVU-05A） |
| GA4計測ID・イベント辞書 | `assets/ga4.js`, `scripts/lib/measurement/event-dictionary.mjs` |
| 非本番ホスト除外 | `isNonProductionHost()` — preview / vercel.app / localhost |
| 料金ファクト（照合用） | Company Report ¥29,800（税別）、Local GEO 月額¥60,000（税別） — `scripts/lib/observation/constants.mjs` |

### 新規実装（本タスク）

| 項目 | 証拠 |
| --- | --- |
| 非指名購入意図12問（企業/店舗/パートナー各4） | `scripts/lib/observation/purchase-intent-questions.mjs` — テストで12問・ブランド語0件 |
| 固定条件スキーマ + 手動CSV | `scripts/lib/observation/ai-response-schema.mjs`, `observation/templates/ai-response-record.csv` |
| UI/API分離集計・分母=successのみ | `scripts/lib/observation/ai-response-aggregator.mjs` — テスト `does not merge UI and API` |
| GSC/GA4/Bing/CRM 公式エクスポート取込 | `scripts/lib/observation/channel-import.mjs` |
| 週次比較・重複排除ルール | `scripts/lib/observation/weekly-baseline.mjs` |
| 手動週次Runbook | `observation/README.md` |
| 指名認識別枠 | `observation/named-entity/README.md` |
| CLI | `scripts/aggregate-ai-observations.mjs`, `scripts/import-observation-week.mjs` |

### BLOCKED（環境制約・仕様どおり）

| 項目 | 理由 |
| --- | --- |
| GSC Search Analytics API | リポジトリ内に接続なし — 手動CSVのみ |
| GA4 Data API | P0-03でBLOCKED — 手動エクスポートのみ |
| AI各社 API 自動実行 | 費用・承認未設定 — 手動記録様式で運用 |
| `booking_confirmed` | P0-03: `not_connected` — 商談はCRM手動 |
| 定期cron | 明示許可なし — **未設定**（稼働中としない） |

---

## FILES_CHANGED

```
observation/README.md
observation/named-entity/README.md
observation/templates/*.csv (5)
observation/weekly/.gitignore
observation/weekly/.gitkeep
scripts/lib/observation/constants.mjs
scripts/lib/observation/purchase-intent-questions.mjs
scripts/lib/observation/ai-response-schema.mjs
scripts/lib/observation/ai-response-aggregator.mjs
scripts/lib/observation/channel-import.mjs
scripts/lib/observation/weekly-baseline.mjs
scripts/aggregate-ai-observations.mjs
scripts/import-observation-week.mjs
scripts/tests/ari-p2-02-observation.test.mjs
reports/Organic Search Weekly Baseline.md
reports/ARI-P2-02-observation-completion-report.md
```

---

## CHANGES

1. **12問定義** — 自社名・readiness.coaretail.com を質問文に含めない（`assertNoBrandInQuestions` で検証）。
2. **記録列** — 社名言及（unprompted）、依頼先推薦、引用URL、料金正確性、相談導線、`execution_status` を分離。
3. **集計** — 有効回答数のみ分母。error/blocked/skipped は別バケット。`target_ai:interface_type` でUI/APIを混ぜない。
4. **チャネル取込** — GSC/Bingは非指名クエリのみ合算。GA4は非本番ホスト行を除外。
5. **週次レポート** — `weekly-report.json` に `baseline_status`（established/imported/missing/pending）を出力。
6. **運用** — `observation/weekly/` は gitignore（実データ・PIIをコミットしない）。

---

## TESTS_AND_RESULTS

```bash
node --test scripts/tests/ari-p2-02-observation.test.mjs
# 11/11 PASS
```

**CLIスモーク（ローカル）**

```bash
node scripts/aggregate-ai-observations.mjs --wave 2026-W36-test --input observation/weekly/2026-W36-test/ai-responses.csv
# denominator: 1

node scripts/import-observation-week.mjs --wave 2026-W36-test --dir observation/weekly/2026-W36-test ...
# weekly-report.json 生成、ai_observation: established（テスト1件）
```

**未実行（意図的）**

- 本番サイトへのデプロイ（本タスクはリポジトリ内観測基盤のみ）
- 実AI各社への本番プロンプト投入（手動運用待ち）

---

## DEPLOYMENT_STATUS
**DEPLOYED** — `git push origin main`（`1377d89..0ee76a1`）→ Vercel 自動デプロイ

## PRODUCTION_CHECKS

| URL | 結果 | 備考 |
| --- | --- | --- |
| `https://readiness.coaretail.com/` | HTTP 200 | `age: 0`（デプロイ直後） |
| `https://readiness.coaretail.com/guides/` | HTTP 200 | P2-01 回帰なし |
| `https://readiness.coaretail.com/report/` | HTTP 200 | 回帰なし |

**ローカル:** `npm run build:all` 成功（exit 0）

**注記:** P2-02 の観測基盤（`observation/`, 集計CLI）はリポジトリ内運用ツールであり、公開サイトの新規URLは追加していない。

---

## BLOCKERS

| Blocker | 解除条件 |
| --- | --- |
| 実ベースライン未取得 | 初回週次で12問×AIの手動記録 + GSC/GA4/CRMエクスポート |
| GA4/GSC API | 別タスクでOAuth・サービスアカウント設定 |
| AI API自動化 | 費用承認・各社APIキー |

---

## ROLLBACK

```bash
git checkout main
git branch -D fix/ari-p2-02-observation
```

`observation/` 配下と `scripts/lib/observation/` を削除すれば観測基盤のみ巻き戻し可能。P0-03計測・P2-01ガイドには影響なし。

---

## NEXT_TASK
**P3-01**（本観測基盤で初回週次 `2026-Wxx` を実行し、`weekly-report.json` と `Organic Search Weekly Baseline.md` に実数を記録）

---

## 12問一覧（購入意図・非指名）

### 企業向け（enterprise）
1. `ent-01` B2B企業がAI検索やAIアシスタントから見つけられるようにするには、何から手を付けるべきですか？
2. `ent-02` AI検索対策の依頼先を比較する際に確認すべきポイントを教えてください。
3. `ent-03` 自社サイトのAI検索対応状況を診断できるサービスはありますか？料金の目安も知りたいです。
4. `ent-04` SEO・GEO・AI検索対応状況の違いと、企業が最初に整備すべき領域を教えてください。

### 店舗向け（store）
5. `store-01` 店舗やクリニックの集客をAI検索で改善したいです。月額いくらくらいのサービスがありますか？
6. `store-02` 地域ビジネスでAIから予約や問い合わせにつなげるために必要な情報設計を教えてください。
7. `store-03` 飲食店や美容サロン向けのAI検索・MEO対策でおすすめの進め方は？
8. `store-04` 店舗の口コミと公式サイトの情報をAIに正しく理解させるには何が必要ですか？

### パートナー向け（partner）
9. `partner-01` 代理店がクライアント向けにAI検索対策を提供する場合、内製と外注の判断基準は？
10. `partner-02` 複数社にAI検索診断レポートを提供できる仕組みやツールはありますか？
11. `partner-03` SaaSやマーケティング会社がAI検索対策機能を組み込むべきか、専門会社に任せるべきか教えてください。
12. `partner-04` AI検索での競合比較状況を定期的に観測する方法と、取れる指標を教えてください。

---

## 更新履歴
- 2026-09-08: DEPLOYED — main マージ・本番確認
- 2026-09-08: 初版作成（VERIFIED + OBSERVING）
