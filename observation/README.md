# ARI 観測基盤（P2-02）

手動週次運用を前提とした、AI推薦・SEO・商談の観測インフラです。  
**API自動取得は未接続** — 公式エクスポートと手動記録のみ使用します。

## 観測モード

| モード | 用途 | 質問セット |
| --- | --- | --- |
| `purchase_intent` | 非指名・購入意図 | `scripts/lib/observation/purchase-intent-questions.mjs`（12問） |
| `named_entity` | 指名認識テスト | `observation/named-entity/`（別枠） |

購入意図テストの質問文に自社名を含めないこと。宣伝プロンプトは推薦テストに使わない。

## 固定条件（毎回記録）

各AI回答行に必須：

- `question_id` / `question_text`
- `target_ai` — chatgpt | gemini | claude | perplexity
- `model_id` — 記録できる場合のみ。不明は `unknown`
- `search_enabled` — yes | no | unknown
- `interface_type` — **ui または api（混在集計禁止）**
- `observed_at` — ISO 8601（例: `2026-09-08T10:00:00+09:00`）
- `locale` — 既定 `ja-JP`
- `region` — 既定 `JP`
- `conversation_state` — new | followup
- `repeat_count` — 同一条件の繰り返し回数

### AIごとの条件差（要記録）

| AI | 既定 search | 注意 |
| --- | --- | --- |
| ChatGPT | unknown | プラン・UIトグルで検索可否が変わる。UIとAPIは別母集団 |
| Gemini | unknown | Google Search grounding は有効時のみ |
| Claude | unknown | Web search は有効時のみ |
| Perplexity | yes | 検索ネイティブ。API（pplx-api）はUIと別 |

## 結果列（分母とは別集計）

| 列 | 内容 |
| --- | --- |
| `mentions_brand_unprompted` | 質問に社名なしで Coa Retail / Agent Readiness 等が出たか |
| `recommends_vendor` / `vendor_names` | 依頼先・サービスの推薦 |
| `citation_urls` | 引用URL（`|` 区切り） |
| `pricing_claim_accurate` | yes / no / unknown / n/a |
| `pricing_claim_notes` | 料金誤認の内容（PIIなし） |
| `has_consult_path` / `consult_path_notes` | 相談・問い合わせ導線 |
| `execution_status` | success のみ分母。error / blocked / skipped は別 |

**正式料金（照合用・変更禁止）**

- Company Report: **29,800円（税別）**
- Local GEO 店舗向け: **月額60,000円（税別）**

## 週次フォルダ構成

```
observation/weekly/2026-W36/
  ai-responses.csv      # 手動記録（templates/ai-response-record.csv をコピー）
  gsc-queries.csv       # GSC 公式エクスポート
  ga4-export.csv        # GA4 探索レポート CSV
  bing-queries.csv      # Bing Webmaster（任意）
  crm-export.csv        # 問い合わせ・商談・受注（手動）
  weekly-report.json    # 生成物（gitignore 推奨）
```

`observation/weekly/` 配下の実データはリポジトリにコミットしない。

## 週次手順（手動）

1. **月曜** — 前週の日付範囲を決める（例: `2026-W36`, start `2026-09-01`, end `2026-09-07`）
2. **AI観測** — 12問 × 対象AI × UI（APIは別ファイル推奨）を実行し `ai-responses.csv` に記録
3. **GSC** — 検索パフォーマンスをエクスポート → `gsc-queries.csv`
4. **GA4** — `service_view` と AI参照セッションの探索をエクスポート → `ga4-export.csv`
5. **CRM** — 問い合わせ・商談・受注をエクスポート → `crm-export.csv`
6. **集計**

```bash
node scripts/aggregate-ai-observations.mjs \
  --wave 2026-W36 \
  --input observation/weekly/2026-W36/ai-responses.csv \
  --output observation/weekly/2026-W36/ai-aggregate.json

node scripts/import-observation-week.mjs \
  --wave 2026-W36 \
  --dir observation/weekly/2026-W36 \
  --week-start 2026-09-01 \
  --week-end 2026-09-07
```

7. **週次メモ** — `reports/Organic Search Weekly Baseline.md` に数値と差分を追記

## 週次比較の分離

| 指標 | ソース |
| --- | --- |
| 非指名オーガニック | GSC / Bing エクスポート |
| AI引用 | `citation_urls` 集計 |
| AI参照流入 | GA4 セッション（chatgpt / perplexity 等） |
| サービス閲覧 | GA4 `service_view` |
| 問い合わせ / 商談 / 受注 | CRM エクスポート |

### 重複排除・除外

- **テスト/社内**: GA4取込時 `preview` / `*.vercel.app` / `localhost` を除外（`isNonProductionHost`）
- **初回AI流入と自己申告**: CRMで `awareness_channel=AI` かつ `first_ai_touch=AI` の同一 `lead_id` は問い合わせ1回に丸める
- **サイト内**: `traffic_type: internal` / `?ari_debug=1` は本番集計に含めない（P0-03）

## ベースライン状態

`weekly-report.json` の `baseline_status`:

- `established` — AI有効回答が1件以上
- `imported` — 該当チャネルCSVあり
- `missing` — 未取込
- `pending` — 観測期間未経過（OBSERVING）

モックやサンプルCSVを本番ダッシュボードに載せない。

## 定期実行

cron / GitHub Actions は**明示許可がある場合のみ**設定。未設定を稼働中と報告しない。

## 関連

- 計測辞書: `scripts/lib/measurement/event-dictionary.mjs`
- 週次メモ: `reports/Organic Search Weekly Baseline.md`
- 完了レポート: `reports/ARI-P2-02-observation-completion-report.md`
