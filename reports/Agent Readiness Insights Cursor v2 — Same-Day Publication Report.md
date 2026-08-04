# Agent Readiness Insights Cursor v2 — Same-Day Publication Report

## 1. Overall Result

**判定: READY FOR SAME-DAY PUSH**

初回記事 `ai-search-shift` を **本日 2026-08-04** の臨時スケジュール（Web 11:00 / Buffer 11:30 / LinkedIn 12:00 JST）へ変更。残り29件は `editorial_hold` 維持。Buffer本番通信は未実行。

---

## 2. Current Execution Time

```text
2026-08-04 10:02 JST（作業実行時）
```

11:00 JST は未来時刻のため、時刻繰り下げ（45分ルール）は **適用なし**（`bumped: false`）。

---

## 3. Final Web Publication Time

```text
2026-08-04 11:00 JST
publishAt: 2026-08-04T11:00:00+09:00
```

---

## 4. Final Buffer Transfer Time

```text
2026-08-04 11:30 JST
bufferTransferAt: 2026-08-04T11:30:00+09:00
```

---

## 5. Final LinkedIn Publication Time

```text
2026-08-04 12:00 JST
linkedinPublishAt: 2026-08-04T12:00:00+09:00
```

---

## 6. Scheduled Article Count

| 種別 | 件数 |
| --- | ---: |
| Web `scheduled` (v2) | **1** |
| Web `editorial_hold` (v2) | 29 |
| v1 `published` | 16 |

---

## 7. Editorial Hold Count

**29件** — すべて `publishAt: null`、日時フィールドなし、一覧非表示。

---

## 8. Web Dry-Run Result

```bash
npm run publish:insights:dry -- --now "2026-08-04T11:00:00+09:00"
```

```text
[dry-run] Publish ai-search-shift (2026-08-04T11:00:00+09:00)
Would publish: ai-search-shift  ← 1件のみ
```

```bash
npm run publish:insights:dry  # 現在時刻（11:00前）
```

```text
No scheduled articles due  ← 正常
```

---

## 9. LinkedIn Dry-Run Result

```bash
npm run queue:linkedin:dry -- --now "2026-08-04T11:30:00+09:00"
```

```text
Processing ARI-LI-001 (ai-search-shift)  ← 1件のみ
URL verify failed: HTTP 404
Would set article_url_unavailable — no queue write  ← Buffer未送信
```

---

## 10. workflow_dispatch Availability

| Workflow | workflow_dispatch | 備考 |
| --- | --- | --- |
| `publish-scheduled-insights.yml` | ✅ あり | `now` / `force_slug` 入力可 |
| `queue-daily-linkedin-buffer.yml` | ✅ あり | `dry_run` 既定 `true`（手動本番時は `false` + Secrets必要） |

### 本日のcron限界

- Web cron: 10:00 JST のみ → **11:00公開は手動 dispatch 必須**
- Buffer cron: 10:30 JST のみ → **11:30転送は手動 dispatch 必須**

---

## 11. Push Readiness

```bash
npm run validate:insights:v2  → PASS
npm run test:insights:v2      → 8/8 pass
```

| 条件 | 結果 |
| --- | --- |
| Web scheduled 1件 | ✅ |
| LinkedIn scheduled 1件 | ✅ |
| editorial_hold 29件 | ✅ |
| Buffer本番なし | ✅ |
| Secretコミットなし | ✅ |

**判定: READY FOR SAME-DAY PUSH**

---

## 12. Same-Day Manual Operations

### Step 1 — push（今すぐ）

```bash
git add insights/_scheduled/schedule.json \
        insights/_scheduled/ai-search-shift/ \
        insights/_social/linkedin/ \
        insights/index.html insights/ \
        sitemap.xml llms.txt scripts/ package.json .github/workflows/ reports/

git commit -m "Same-day: ai-search-shift 2026-08-04 11:00 JST initial publication"
git push
```

### Step 2 — Web公開（11:00 JST以降）

GitHub → **Publish scheduled Insights** → Run workflow

- `now`: 空欄（実時刻使用）または `2026-08-04T11:00:00+09:00`
- `force_slug`: 空欄

期待: `ai-search-shift` 1件のみ公開。

### Step 3 — 公開確認（11:05頃）

```bash
curl -I https://readiness.coaretail.com/insights/ai-search-shift/
# HTTP 200 を確認
```

### Step 4 — LinkedIn dry-run（URL 200後）

```bash
npm run queue:linkedin:dry -- --now "2026-08-04T11:30:00+09:00"
```

### Step 5 — Buffer転送（ユーザー承認後・11:30以降）

GitHub → **Queue daily LinkedIn to Buffer** → Run workflow

- `dry_run`: **false**（Secrets設定済みの場合のみ）
- `now`: 空欄または `2026-08-04T11:30:00+09:00`

※ URL 404の間は送信されない（安全ゲート）。

### 明日以降の通常方針

```text
Web: 平日 10:00 JST
Buffer: 平日 10:30 JST
LinkedIn: 平日 11:30 JST
```

次の記事は REWRITE → PASS → 日付付与 → `scheduled` へ（5記事単位）。

---

## 変更ファイル

- `insights/_scheduled/schedule.json`
- `insights/_social/linkedin/queue.json`
- `insights/_scheduled/ai-search-shift/index.html`（date 2026-08-04）
- `insights/index.html`（planned 1件・2026.08.04 11:00）
- `crucial_data/editorial/publication-calendar.{csv,md}`
- `scripts/apply-same-day-publication.mjs`（新規）
- `scripts/validate-insights-v2.mjs`（動的ゲート検証）
- `reports/same-day-schedule.json`

---

## 更新履歴

- 2026-08-04 10:02 JST: Same-day schedule applied
