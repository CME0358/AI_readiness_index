# ARI-P3-01 Completion Report — 外部紹介・顧客事例・SNSの商談導線

## TASK_ID
ARI-P3-01

## STATUS
**VERIFIED**（ローカルテスト・/go/ リダイレクト検証済み。掲載・送信・投稿予約は未実施）

## BRANCH
`fix/ari-p3-01-referral`

## BASE_SHA
`89420674e958cff126d3ec90be65dd071a0985b6`（main @ P2-02 DEPLOYED 後）

## FINAL_SHA_OR_UNCOMMITTED
未コミット（本ブランチ上の差分）

---

## FINDINGS_WITH_EVIDENCE

### 依存タスク

| 依存 | 状態 | 影響 |
| --- | --- | --- |
| P1-02 サービス・事例ページ | **DEPLOYED** | `/cases/`, `/services/`, `service-offerings.mjs` を棚卸しの正本として利用 |
| P2-02 観測基盤 | **DEPLOYED + OBSERVING** | 週次商談観測は `observation/README.md` + runbook へ接続 |

### ALREADY_SATISFIED

| 項目 | 証拠 |
| --- | --- |
| 公開事例 Bar SECRET（観測/申告分離） | `cases/bar-secret/index.html`, `CASE_STUDIES` in `service-offerings.mjs` |
| 料金 ¥29,800 / 月額¥60,000（税別） | `OFFERINGS` — 変更なし |
| 相談URL | `ORGANIZATION.consultUrl` → mtgschedule |
| x-sidecar /go/ + UTM | `insights/_social/x-sidecar/redirects.json`, `api/go/[short_id].js` |
| 購入意図ガイド導線 | P2-01 `/guides/` |

### ギャップ → 本タスクで対応

| ギャップ | 対応 |
| --- | --- |
| 外部紹介パッケージなし | `referral/review/` 6種ドキュメント + 下書き6件 |
| 対象別着地・UTM計画なし | `landing-routes.mjs` + `03-measurement-plan.md` |
| 紹介用 /go/ なし | **新規** `ref2609*` 6本（x-sidecar と非重複） |
| SNS編集構成案なし | `editorial-mix.mjs` 40/30/20/10（Buffer未変更） |
| 事例ハブの対象別CTA弱い | `cases/index.html` に enterprise/store/partner 導線 |

### BLOCKED / 未実施（仕様どおり）

| 項目 | 理由 |
| --- | --- |
| SNS投稿・Buffer予約 | 本タスクで変更・投入しない |
| メール送信・広告出稿 | 下書きのみ |
| リリース転載＝取材実績 | 明示禁止・inventory に記載 |
| Bar SECRET 来店/売上数値 | 公開用検証データなし |
| booking_confirmed | P0-03: not_connected |

---

## FILES_CHANGED

```
api/go/[short_id].js
cases/index.html
insights/_social/referral/redirects.json
referral/README.md
referral/review/*.md (generated)
scripts/generate-referral-package.mjs
scripts/lib/referral/*.mjs (7)
scripts/tests/ari-p3-01-referral.test.mjs
reports/ARI-P3-01-referral-completion-report.md
```

---

## CHANGES

1. **棚卸し** — `inventory.mjs` + `01-inventory.md`（事例1件・代表プロフィール・PR/イベントは draft_only）
2. **事業者情報** — `business-info.mjs` + `02-business-info-pack.md`
3. **測定** — 企業/店舗/協業の着地先6ルート、新規 `/go/ref2609*`、UTM `ari_ref_*`
4. **API** — `/go/` が referral manifest を第2ソースとして解決（sidecar 優先・既存挙動維持）
5. **編集構成** — 購入前40%・事例30%・調査20%・ニュース10%（設定のみ）
6. **下書き6件** — X×2、LinkedIn×2、セミナー案、メール下書き（未送信）
7. **事例ハブ** — 対象別CTA + `data-funnel-cta` 計測属性

---

## TESTS_AND_RESULTS

```bash
node scripts/generate-referral-package.mjs
# ok: true, drafts: 6, redirects: 6, sidecarCollision: []

node --test scripts/tests/ari-p3-01-referral.test.mjs
# 9/9 PASS

node --test scripts/tests/x-traffic-sidecar.test.mjs
# 36/36 PASS（sidecar 回帰なし）
```

**/go/ 検証（ローカル handler）**

| short_id | 種別 | 着地 |
| --- | --- | --- |
| `x260908d` | sidecar | `/insights/recommendation-logic/`（既存） |
| `ref2609e1` | referral | `/report/?utm_campaign=ari_ref_enterprise` |
| `notreal1` | — | 404 |

---

## DEPLOYMENT_STATUS
**未デプロイ**（本プロンプトに本番反映指示なし）

## PRODUCTION_CHECKS
該当なし（承認前。デプロイ後は `/cases/` の対象別CTA と `/go/ref2609e1` の302を確認）

---

## BLOCKERS

| Blocker | 解除条件 |
| --- | --- |
| 社内承認 | `referral/review/` レビュー完了 |
| 実投稿 | 承認後 runbook `06-ops-runbook.md` に従い手動実行 |

---

## ROLLBACK

```bash
git checkout main
git branch -D fix/ari-p3-01-referral
```

`insights/_social/referral/` と `scripts/lib/referral/` を削除。`api/go` を sidecar のみに戻す。

---

## NEXT_TASK
**P3-02**

---

## 下書き一覧（6件・未掲載）

| ID | 媒体 | バケット | 対象 |
| --- | --- | --- | --- |
| draft-01 | X | 購入前疑問 | 企業 |
| draft-02 | LinkedIn | 事例 | 店舗 |
| draft-03 | LinkedIn | 独自調査 | 企業 |
| draft-04 | X | ニュース | 協業 |
| draft-05 | セミナー案 | 事例 | 協業 |
| draft-06 | メール下書き | 購入前疑問 | 企業 |

---

## 更新履歴
- 2026-09-08: 初版（VERIFIED）
