# Agent Readiness Insights Cursor v2 — Implementation Report

生成日: 2026-08-03

## 新規ファイル

- `crucial_data/editorial/` — knowledge-graph, editorial-plan, calendar, article-meta, articles-v2-content
- `crucial_data/prompts/` — insights-column-v2.md, linkedin-post-v2.md
- `crucial_data/linkedin/posts/` — 30 LinkedIn投稿文
- `insights/_social/linkedin/` — queue, logs, README
- `scripts/lib/` — paths, business-days, buffer-client, url-verify
- `scripts/generate-insights-v2.mjs`
- `scripts/validate-insights-v2.mjs`
- `scripts/queue-daily-linkedin-buffer.mjs`
- `scripts/generate-insights-report.mjs`
- `scripts/tests/queue-daily-linkedin-buffer.test.mjs`
- `.github/workflows/queue-daily-linkedin-buffer.yml`
- `.env.example`

## 更新ファイル

- `package.json` — v2 npm scripts
- `insights/_scheduled/schedule.json` — v2 30件追記
- `insights/index.html` — v2 公開予定カード

## スクリプト

| コマンド | 役割 |
|---|---|
| `npm run generate:insights:v2` | MD/HTML/schedule/queue 生成 |
| `npm run validate:insights:v2` | 検証 |
| `npm run queue:linkedin:dry` | Buffer dry-run |
| `npm run report:insights:v2` | レポート生成 |

## GitHub Actions

- `publish-scheduled-insights.yml` — 既存（Web 10:00 JST）
- `queue-daily-linkedin-buffer.yml` — 新規（Buffer 10:15 JST）

## 環境変数

`.env.example` 参照

## 運用フロー

Web公開(10:00) → URL検証 → Buffer転送(10:15) → LinkedIn予約(11:00)
