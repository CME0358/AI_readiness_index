# Agent Readiness Insights Cursor v2 — Initial Production Gate Report

## 1. Overall Result

**判定: READY TO PUSH**

初回記事 `ai-search-shift` のみが自動公開・Buffer転送の対象。残り29記事は `editorial_hold` に移行し、日時なし・一覧非表示・スクリプト除外を実装済み。Buffer本番通信は未実行。

---

## 2. Initial Article

| 項目 | 値 |
| --- | --- |
| slug | `ai-search-shift` |
| Web | 2026-08-05 10:00 JST |
| Buffer | 2026-08-05 10:30 JST |
| LinkedIn | 2026-08-05 11:30 JST |
| 品質 | PASS（Pre-Production監査済み） |

---

## 3. Scheduled Web Articles

| status | 件数 | 該当 |
| --- | ---: | --- |
| `scheduled` (v2) | **1** | ai-search-shift |
| `editorial_hold` (v2) | **29** | 残り全v2 |
| `published` (v1) | 16 | files〜why-ari |

---

## 4. Editorial Hold Articles

29件すべて:

```json
{
  "status": "editorial_hold",
  "publishAt": null
}
```

- HTML / MD / LinkedIn本文 / articleUrl は保持
- 公開予定一覧（index.html）から除外
- 公開スクリプト・Buffer dispatcher の対象外

---

## 5. Scheduled LinkedIn Posts

| status | 件数 |
| --- | ---: |
| `scheduled` | **1** (ARI-LI-001 / ai-search-shift) |
| `editorial_hold` | **29** |

保留29件: `articlePublishAt`, `bufferTransferAt`, `linkedinPublishAt` すべて `null`

---

## 6. Buffer Eligible Posts

2026-08-05 10:30 JST 時点の転送候補: **1件** (`ai-search-shift` のみ)

`--force-slug recommendation-logic` → **exit 1**（editorial_hold は強制転送不可）

---

## 7. Validation Result

```bash
npm run validate:insights:v2
# Validation: PASS (fail: 0, review: 1 — BUFFER credentials local未設定)

npm run test:insights:v2
# 8/8 pass（gate tests含む）
```

### ゲートチェック（追加済み）

- editorial_hold に publishAt / bufferTransferAt / linkedinPublishAt なし ✅
- 公開スクリプトが editorial_hold を対象にしない ✅
- Buffer が editorial_hold を対象にしない ✅
- index.html に editorial_hold の planned カードなし ✅
- scheduled Web 1件 / scheduled LinkedIn 1件 ✅

---

## 8. Web Dry-Run Result

```bash
npm run publish:insights:dry -- --now "2026-08-05T10:00:00+09:00"
# [dry-run] Publish ai-search-shift
# Would publish: ai-search-shift （1件のみ）

npm run publish:insights:dry
# No scheduled articles due（2026-08-04時点 — 意図どおり）
```

---

## 9. LinkedIn Dry-Run Result

```bash
npm run queue:linkedin:dry -- --now "2026-08-05T10:30:00+09:00"
# Processing ARI-LI-001 (ai-search-shift)
# URL verify failed: HTTP 404 → queue未更新（Web未公開のため正常）
```

残り29件は候補に出ない ✅

---

## 10. Git Diff Summary

| 確認項目 | 結果 |
| --- | --- |
| v1公開済み記事の削除 | ❌ なし（status→published、insights/へ移動） |
| sitemap既存URL削除 | ❌ なし（files等は維持） |
| llms.txt既存URL削除 | ❌ なし（追記のみ） |
| slug変更 | ❌ なし |
| 30記事誤公開 | ❌ なし |
| Buffer本番通信 | ❌ 未実行 |
| Secret値コミット | ❌ なし（.envはgitignore） |

### 主な変更ファイル

- `insights/_scheduled/schedule.json` — v1 published + v2 gate
- `insights/_social/linkedin/queue.json` — gate状態
- `insights/index.html` — planned 1件のみ
- `scripts/lib/editorial-status.mjs` — 新規
- `scripts/apply-initial-production-gate.mjs` — 新規
- `scripts/publish-scheduled-insights.mjs` — editorial_hold除外
- `scripts/queue-daily-linkedin-buffer.mjs` — editorial_hold除外 + force-slug拒否
- `scripts/validate-insights-v2.mjs` — ゲート検証追加

---

## 11. Remaining Risks

1. **GitHub Secrets未設定** — Buffer workflowはdry-runまたは失敗停止
2. **初回LinkedIn** — Web公開（URL 200）後までBuffer転送不可
3. **残29記事 REWRITE** — PASSになるまで `editorial_hold` 維持。5記事単位で編集
4. **index.html** — v1同期によりカード順序が更新（llms-txt等の既存記事カード位置要確認）

---

## 12. Push Readiness

### 判定

```text
READY TO PUSH
```

### 満たした条件

- ✅ Web scheduled 1件
- ✅ LinkedIn scheduled 1件
- ✅ editorial_hold 29件
- ✅ 保留記事に日時なし
- ✅ Web dry-run 1件
- ✅ LinkedIn dry-run 1件
- ✅ Buffer本番通信なし
- ✅ Secretコミットなし

### 推奨pushコマンド

```bash
git add insights/_scheduled/schedule.json \
        insights/_social/linkedin/ \
        insights/index.html insights/ \
        sitemap.xml llms.txt \
        scripts/ package.json .github/workflows/

git commit -m "Gate v2: ai-search-shift only scheduled, 29 editorial_hold"
```

---

## 新ステータス定義

| status | 意味 |
| --- | --- |
| `editorial_hold` | 生成済みだが品質未完了。自動公開・転送禁止 |
| `editorial_review` | 編集中（将来用） |
| `ready_for_schedule` | 品質PASS後、日付付与前（将来用） |
| `scheduled` | 自動公開・転送対象 |
| `published` | 公開済み |

---

## 次工程（初回公開後）

```text
5記事 REWRITE → 品質監査 PASS → 日付付与 → scheduled へ
```

1バッチ最大5記事。PASS前は `editorial_hold` 解除しない。

---

## 更新履歴

- 2026-08-04: Initial Production Gate 適用
