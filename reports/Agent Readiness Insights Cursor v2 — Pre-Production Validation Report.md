# Agent Readiness Insights Cursor v2 — Pre-Production Validation Report

## 1. Executive Summary

Pre-Production Stabilization を実施し、リモート公開状態の監査・v1スケジュール同期・v2公開日再計算・初回記事（`ai-search-shift`）の校正・GitHub Actions向けLinkedIn本文配置・dry-run検証まで完了した。

**判定: PRE-PRODUCTION READY**

初回記事1本のWeb公開準備は完了。Buffer本番通信は未実行。残り29本はテンプレート品質のため公開日前に REWRITE が必要（一括公開は不可）。

---

## 2. Overall Result

| 項目 | 結果 |
| --- | --- |
| v1リモート監査 | 16/16 公開済み確認 |
| v1ローカル同期 | 16件 `published` に更新・`_scheduled`→`insights/` 移動 |
| v2開始日 | 2026-08-04 → **2026-08-05** に再計算 |
| 初回記事品質 | **PASS**（`ai-search-shift`） |
| Web dry-run | **PASS**（1件のみ） |
| LinkedIn dry-run | **PASS**（404拒否・queue未更新） |
| GitHub本文取得 | **PASS**（30件を `insights/_social/linkedin/posts/` に配置） |
| Buffer本番 | **未実行**（禁止遵守） |

---

## 3. Blocking Issues

**初回公開をブロックする問題: なし**

**初回公開後・2本目以降をブロックする問題:**

1. v2残29記事が REWRITE 判定（テンプレート骨格・末尾反復）
2. GitHub Secrets 未設定（`BUFFER_ACCESS_TOKEN`, `BUFFER_CHANNEL_ID`, `BUFFER_ORGANIZATION_ID`）
3. 2本目以降公開前に各記事の個別校正が必要

---

## 4. v1 Remote Sync Result

### 分類

| 分類 | 件数 | 該当 |
| --- | ---: | --- |
| `published_remote` | 16 | files, schema, grounds, exec, vis, blind, checklist, auth, trust, wrong, act, price, reviews, book, pay, why-ari |
| `scheduled_local_only` | 0 | （同期後解消） |
| `missing_remote` | 0 | — |
| `inconsistent` | 0 | — |

### リモート確認（全16件）

- HTTP 200 / noindex なし
- canonical 正常
- sitemap.xml / llms.txt / insights/index.html 掲載済み

### 同期アクション

`scripts/sync-v1-published-state.mjs` により:

- `schedule.json` → `status: published`（16件）
- `insights/_scheduled/{slug}` → `insights/{slug}` へ移動
- ローカル `index.html` / `sitemap.xml` / `llms.txt` をリモート状態に整合

詳細: `reports/v1-sync-result.json`

---

## 5. v2 Schedule Correction

| 項目 | 変更前 | 変更後 |
| --- | --- | --- |
| 開始日 | 2026-08-04（火）10:00 | **2026-08-05（水）10:00** |
| 終了日 | 2026-09-14 | **2026-09-15** |
| Buffer転送 | 10:15 JST | **10:30 JST** |
| LinkedIn投稿 | 11:00 JST | **11:30 JST** |

**再計算理由:** 2026-08-04 10:00 の公開処理はリモート未完了（`ai-search-shift` HTTP 404）。過去日時を残さず、次の安全な営業日から開始。

**実行:** `scripts/reschedule-v2-publication.mjs --start 2026-08-05`

詳細: `reports/v2-schedule-reschedule.json`

---

## 6. 30 Article Quality Review

監査: `scripts/audit-insights-v2-quality.mjs` → `reports/v2-quality-audit.json`

| 判定 | 件数 |
| --- | ---: |
| PASS | 1 |
| REVISE | 0 |
| REWRITE | 29 |
| REJECT | 0 |

### PASS（1件）

| slug | 理由 |
| --- | --- |
| `ai-search-shift` | テンプレート骨格除去・内部リンク追加・2021字・校正済み |

### REWRITE（29件）— 代表的理由

- 「論点の整理」「なぜ今問題になるのか」「企業が準備すべきこと」等の共通骨格
- 末尾「定点観測と更新ログ…」の反復（最大8回）
- `{slug}の要点は…` 定型まとめ
- LinkedIn投稿の同一フレーズ反復

**AI Search 2〜4本目**（recommendation-logic, citation-vs-action, competitor-blind-spot）は骨格反復は少ないが、末尾反復・文字数過多のため REWRITE または公開前 REVISE が必要。

---

## 7. Repetition Analysis

### 検出パターン

| パターン | 影響記事数 |
| --- | ---: |
| 導入「多くの企業はWeb施策を…」 | 26 |
| 「企業が準備すべきこと」H2 | 26 |
| 「次の一手」「実務チェック」「情報設計の原則」 | 26 |
| LinkedIn「施策を増やしてもAIに選ばれない…」反復 | 22 |
| 末尾「定点観測と更新ログ…」8回反復 | 4 |

### クラスタ

articles 5以降（three-pillars-ops〜）は導入300字・H2構成・結論がほぼ同一。見出しと結論文のみ差し替えた同型記事群。

---

## 8. Fact and Terminology Review

| 分類 | 代表例 | 対応 |
| --- | --- | --- |
| `stable_fact` | Agent Readiness三層（V/A/A）、Schema.org Organization型の役割 | 初回記事はそのまま |
| `verification_required` | AI推薦の内部段階数、MCP仕様詳細 | 断定を弱める・公開前確認 |
| `unsupported_claim` | なし（架空統計は追加していない） | — |
| `opinion_or_inference` | 「順位だけでは不十分なケースが増える」 | 推論として許容 |

---

## 9. ABIS Expression Review

ABIS関連4記事（abis-intro, abis-ari-bridge, standards-landscape, abis-readiness-gap）:

| チェック | 結果 |
| --- | --- |
| ABIS = Agent Business Interaction Standard | ✅ 本文に明記 |
| 採択済み国際標準と断定しない | ✅ 「新興イニシアチブ」「正式標準と断定せず」 |
| ARIとABISを同一視しない | ✅ 評価軸 vs 記述枠組み |
| Business Authorityは事業者側 | ✅ 問題なし |
| API/MCPだけで全解決と表現しない | ✅ 問題なし |

**注意:** ABIS記事4本は表現は概ね適切だが、テンプレート骨格の REWRITE が先。公開前に個別校正必須。

---

## 10. Initial Article Candidates

### 候補3本

| slug | title | 品質 | 選定理由 |
| --- | --- | --- | --- |
| **ai-search-shift** | AI検索が変える「比較」の意味 | **PASS** | 初見向け・時事非依存・既存19本と差別化・LinkedIn訴求明確 |
| ari-vs-geo-seo | SEO・GEO・ARIの役割分担 | REWRITE | 初学者向けだがテンプレート骨格が強い |
| readiness-baseline | 「準備できている」の最低ライン | REWRITE | 実務的だがテンプレート骨格が強い |

### 初回公開記事（選定）

**`ai-search-shift`**

- 想定読者: 経営者・マーケ担当（Agent Readiness初見）
- 既存記事との差: exec/why-ariの「定義」ではなく「比較行為」の変化に焦点
- LinkedIn訴求: 「比較の主語がユーザー→AIへ移る」

---

## 11. Selected Initial Article — 校正内容

- テンプレート末尾（重複まとめ・定型チェック）削除
- 内部リンク追加（exec, vis, act, why-ari, grounds — 公開済みのみ）
- meta description / cardSummary 改善
- LinkedIn投稿文改善（455字、#AIsearch）
- HTML再生成（canonical, JSON-LD, CTA確認済み）

---

## 12. Web Dry-Run Result

```bash
npm run publish:insights:dry -- --now 2026-08-05T10:00:00+09:00
```

| 確認項目 | 結果 |
| --- | --- |
| 対象1件のみ | ✅ `ai-search-shift` |
| `_scheduled`→`insights/` 移動 | ✅ dry-run確認 |
| index/sitemap/llms更新 | ✅ dry-run確認 |
| 他記事非公開 | ✅ v1は既にpublished、v2他29本は未due |
| Buffer未送信 | ✅ |

---

## 13. LinkedIn Dry-Run Result

```bash
npm run queue:linkedin:dry -- --now 2026-08-05T10:30:00+09:00
```

| 確認項目 | 結果 |
| --- | --- |
| 対象1件 | ✅ ARI-LI-001 |
| postsPerTransfer=1 | ✅ |
| 投稿本文読込 | ✅ `insights/_social/linkedin/posts/ai-search-shift.md` |
| URL 404拒否 | ✅ 正常（Web未公開） |
| queue.json未更新 | ✅ |
| Buffer未通信 | ✅ dry-run |

---

## 14. GitHub Runtime File Availability

### 問題（修正前）

- LinkedIn本文が `crucial_data/` のみ → `.gitignore` でCIから不可

### 修正

- `insights/_social/linkedin/posts/{slug}.md` ×30 をGit管理下に配置
- `queue.json` の `contentFile` を上記パスに更新
- `scripts/sync-linkedin-posts-to-git.mjs` で `crucial_data`→Gitパス同期可能

### 検証

`validate-insights-v2.mjs` — Gitパスから30件読込 ✅

---

## 15. GitHub Actions 実行順序

| 時刻 (JST) | Workflow | 挙動 |
| --- | --- | --- |
| 10:00 | publish-scheduled-insights | Web公開→git push |
| 10:30 | queue-daily-linkedin-buffer | URL 200確認→Buffer（Secrets未設定時はdry-run） |
| 11:30 | Buffer予約 | LinkedIn投稿時刻 |

### 遅延・失敗時

| シナリオ | 挙動 |
| --- | --- |
| Web Action遅延 | Buffer側はURL 404→`article_url_unavailable`、送信しない |
| Bufferが先に動く | URL未公開→404拒否（安全） |
| 当日再試行 | `workflow_dispatch` + `--now` + `--force-slug`（dry-run推奨） |
| 翌日持ち越し | `article_url_unavailable` のまま。Web公開後に再実行で復帰 |
| Secrets未設定 | schedule時は自動dry-run（workflow.yml L56-58） |

**推奨:** Buffer 10:30 / LinkedIn 11:30 へ変更済み（Web公開後15〜30分バッファ）

---

## 16. Remaining Manual Actions

1. **GitHub Secrets 設定** — `BUFFER_ACCESS_TOKEN`, `BUFFER_CHANNEL_ID`, `BUFFER_ORGANIZATION_ID`
2. **初回Web公開** — 2026-08-05 10:00 JST に `publish-scheduled-insights` が動くよう変更をpush
3. **公開後LinkedIn dry-run** — URL 200確認後、`npm run queue:linkedin:dry`
4. **Buffer本番** — 初回記事URL 200確認後、Secrets設定済みで初回のみ live 実行（ユーザー承認後）
5. **2本目以降** — 各公開日の7営業日前までに REWRITE 記事の校正完了

---

## 17. Production Readiness Decision

### 判定

```text
PRE-PRODUCTION READY
```

### 根拠

- ✅ v1公開状態整理済み（16件リモート整合）
- ✅ v2開始日を未来日（2026-08-05）に再設定
- ✅ 初回記事 PASS
- ✅ 初回HTML PASS
- ✅ Web dry-run PASS
- ✅ LinkedIn dry-run PASS（404拒否正常）
- ✅ GitHub Actionsで投稿本文取得可能
- ✅ Buffer一括送信なし
- ✅ 本番Buffer通信なし

### Observations（非ブロッキング）

- 残29記事 REWRITE — 順次公開前に校正必要
- 初回LinkedIn本番はWeb公開＋Secrets設定後

---

## 更新履歴

- 2026-08-04: Pre-Production Stabilization 完了
