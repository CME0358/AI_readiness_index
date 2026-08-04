# Agent Readiness Insights Cursor v2 — Pre-Implementation Audit

調査日: 2026-08-04

## 現在の公開フロー

1. `crucial_data/column/*.md` 原稿
2. `scripts/generate-insight-article.mjs` → HTML
3. `insights/_scheduled/{slug}/index.html` + `schedule.json`
4. GitHub Actions `publish-scheduled-insights.yml`（cron 01:00 UTC = 10:00 JST）
5. `scripts/publish-scheduled-insights.mjs` → `insights/{slug}/` へ移動、index/sitemap/llms 更新
6. Vercel `npm run build:all` → readiness.coaretail.com

## 既存記事数

| 区分 | 件数 |
|---|---:|
| 公開済み | 3 |
| 予約済み（v1） | 16 |
| **合計** | **19** |

## 公開済み記事

| slug | 公開日 |
|---|---|
| zentoshin | 2026-07-08 |
| http-402 | 2026-07-09 |
| llms-txt | 2026-07-10 |

## 予約済み記事（v1）

`files`〜`why-ari` 16本（2026-07-13 〜 2026-08-03、平日10:00 JST）

## 既存スクリプト

| ファイル | 役割 |
|---|---|
| `scripts/generate-insight-article.mjs` | MD→HTML |
| `scripts/publish-scheduled-insights.mjs` | Web予約公開 |

## 既存 GitHub Actions

| ファイル | cron |
|---|---|
| `.github/workflows/publish-scheduled-insights.yml` | `0 1 * * *` |

## Buffer 関連資産

| 資産 | 場所 | 再利用 |
|---|---|---|
| Buffer GraphQL API | `10_Projects/QOLmedia/.../upload_buffer_drafts.py` | ✅ createPost mutation |
| Buffer MCP | Cursor `user-buffer` | ローカル/MCP用 |
| ARI LinkedIn 連携 | **なし** | 新規実装 |

## 再利用可能なコード

- `upload_buffer_drafts.py` の `CREATE_POST_MUTATION` / `create_buffer_post()` パターン
- `upload_qol_x_buffer.py` の日次1件・冪等・ログ設計
- 既存 `publish-scheduled-insights.mjs` の schedule.json 更新パターン

## 変更予定ファイル

| ファイル | 変更内容 |
|---|---|
| `package.json` | v2 npm scripts 追加 |
| `insights/_scheduled/schedule.json` | v2 30件追記（既存16件保持） |
| `insights/index.html` | v2 公開予定カード追記 |
| `.env.example` | Buffer 環境変数追加 |

## 新規作成予定ファイル

- `crucial_data/editorial/` — Knowledge Graph, Editorial Plan, Calendar
- `crucial_data/prompts/` — column + LinkedIn プロンプト
- `crucial_data/linkedin/posts/` — LinkedIn 投稿文
- `insights/_social/linkedin/` — queue, logs, README
- `scripts/lib/` — 共有ユーティリティ
- `scripts/queue-daily-linkedin-buffer.mjs`
- `scripts/generate-insights-v2.mjs`
- `scripts/validate-insights-v2.mjs`
- `scripts/generate-insights-report.mjs`
- `.github/workflows/queue-daily-linkedin-buffer.yml`
- `reports/*` — 4種レポート

## 想定リスク

1. Buffer 10件上限 — 日次1件転送で回避
2. GitHub Actions cron 遅延 — LinkedIn 11:00 JST で余裕確保
3. 記事公開前 URL 404 — HTTP 200 確認必須
4. 二重投稿 — bufferUpdateId + status チェック
5. crucial_data は .gitignore — ローカル/Vault 管理、CI は queue.json のみ commit

## 実装方針

- 既存 Web 公開フローは変更せず拡張
- Buffer 連携は QOL 実装の GraphQL パターンを Node.js 移植
- 30投稿は `queue.json` に保持、Buffer へは毎営業日1件
- dry-run デフォルト安全、認証未設定時は停止
- note 機能は対象外
