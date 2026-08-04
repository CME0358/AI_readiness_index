#!/usr/bin/env node
/**
 * Generate v2 implementation reports.
 * Usage: node scripts/generate-insights-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PATHS, ROOT } from './lib/insights-v2-paths.mjs';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function runValidation() {
  try {
    return execSync('node scripts/validate-insights-v2.mjs --json', { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    return e.stdout || e.message;
  }
}

function main() {
  const plan = readJson(PATHS.editorialPlan);
  const queue = readJson(PATHS.linkedinQueue);
  const validationRaw = runValidation();
  let validation = {};
  try {
    validation = JSON.parse(validationRaw);
  } catch {
    validation = { raw: validationRaw };
  }

  const impl = `# Agent Readiness Insights Cursor v2 — Implementation Report

生成日: ${new Date().toISOString().slice(0, 10)}

## 新規ファイル

- \`crucial_data/editorial/\` — knowledge-graph, editorial-plan, calendar, article-meta, articles-v2-content
- \`crucial_data/prompts/\` — insights-column-v2.md, linkedin-post-v2.md
- \`crucial_data/linkedin/posts/\` — 30 LinkedIn投稿文
- \`insights/_social/linkedin/\` — queue, logs, README
- \`scripts/lib/\` — paths, business-days, buffer-client, url-verify
- \`scripts/generate-insights-v2.mjs\`
- \`scripts/validate-insights-v2.mjs\`
- \`scripts/queue-daily-linkedin-buffer.mjs\`
- \`scripts/generate-insights-report.mjs\`
- \`scripts/tests/queue-daily-linkedin-buffer.test.mjs\`
- \`.github/workflows/queue-daily-linkedin-buffer.yml\`
- \`.env.example\`

## 更新ファイル

- \`package.json\` — v2 npm scripts
- \`insights/_scheduled/schedule.json\` — v2 30件追記
- \`insights/index.html\` — v2 公開予定カード

## スクリプト

| コマンド | 役割 |
|---|---|
| \`npm run generate:insights:v2\` | MD/HTML/schedule/queue 生成 |
| \`npm run validate:insights:v2\` | 検証 |
| \`npm run queue:linkedin:dry\` | Buffer dry-run |
| \`npm run report:insights:v2\` | レポート生成 |

## GitHub Actions

- \`publish-scheduled-insights.yml\` — 既存（Web 10:00 JST）
- \`queue-daily-linkedin-buffer.yml\` — 新規（Buffer 10:15 JST）

## 環境変数

\`.env.example\` 参照

## 運用フロー

Web公開(10:00) → URL検証 → Buffer転送(10:15) → LinkedIn予約(11:00)
`;

  const editorial = `# Agent Readiness Insights Cursor v2 — Editorial Report

## 30テーマ一覧

${plan.articles.map((a) => `${a.order}. **${a.slug}** — ${a.title} (${a.category})`).join('\n')}

## カテゴリ分布

${JSON.stringify(plan.distribution, null, 2)}

## Knowledge Graph

\`crucial_data/editorial/knowledge-graph.json\` — 30トピック

## 既存記事との差別化

各 v2 記事に \`differentiation\` フィールドを設定。v1（19本）とのタイトル・slug 衝突なし。

## 読者導線

AI Search → Agent Readiness基礎 → 構造化 → 実行ドメイン → エージェント → 経営 → Business Interaction → ABIS
`;

  const valReport = `# Agent Readiness Insights Cursor v2 — Validation Report

\`\`\`json
${JSON.stringify(validation, null, 2)}
\`\`\`
`;

  const bufferReport = `# Agent Readiness Insights Cursor v2 — Buffer Integration Report

## 連携方式

Buffer GraphQL API（\`https://api.buffer.com\`）— QOL \`upload_buffer_drafts.py\` と同一 mutation パターンを Node.js 移植。

## 再利用

- \`10_Projects/QOLmedia/.../upload_buffer_drafts.py\` — CREATE_POST_MUTATION
- Buffer MCP — ローカル手動操作用（CI では REST/GraphQL 直接）

## 認証

- \`BUFFER_ACCESS_TOKEN\`
- \`BUFFER_CHANNEL_ID\`（LinkedIn チャネル）

## 日次転送

- \`postsPerTransfer: 1\`
- リポジトリに30件保持、Buffer へ毎営業日1件

## 上限対応

10件上限 — 一括転送禁止。 \`buffer_rejected\` / \`manual_review\` ステータス。

## 二重投稿防止

\`bufferUpdateId\` / \`status === buffer_queued\` / slug重複チェック

## 未設定事項

GitHub Secrets への BUFFER_* 登録（本番移行前必須）

## 本番移行

1. LinkedIn チャネル ID 取得
2. Secrets 設定
3. \`npm run queue:linkedin:dry\` で1件確認
4. 5営業日限定運用
5. 30記事通常運用
`;

  fs.mkdirSync(PATHS.reportsDir, { recursive: true });
  fs.writeFileSync(path.join(PATHS.reportsDir, 'Agent Readiness Insights Cursor v2 — Implementation Report.md'), impl);
  fs.writeFileSync(path.join(PATHS.reportsDir, 'Agent Readiness Insights Cursor v2 — Editorial Report.md'), editorial);
  fs.writeFileSync(path.join(PATHS.reportsDir, 'Agent Readiness Insights Cursor v2 — Validation Report.md'), valReport);
  fs.writeFileSync(path.join(PATHS.reportsDir, 'Agent Readiness Insights Cursor v2 — Buffer Integration Report.md'), bufferReport);
  console.log('Reports written to reports/');
}

main();
