# Agent Readiness Insights Cursor v2 — Buffer Integration Report

## 連携方式

Buffer GraphQL API（`https://api.buffer.com`）— QOL `upload_buffer_drafts.py` と同一 mutation パターンを Node.js 移植。

## 再利用

- `10_Projects/QOLmedia/.../upload_buffer_drafts.py` — CREATE_POST_MUTATION
- Buffer MCP — ローカル手動操作用（CI では REST/GraphQL 直接）

## 認証

- `BUFFER_ACCESS_TOKEN`
- `BUFFER_CHANNEL_ID`（LinkedIn チャネル）

## 日次転送

- `postsPerTransfer: 1`
- リポジトリに30件保持、Buffer へ毎営業日1件

## 上限対応

10件上限 — 一括転送禁止。 `buffer_rejected` / `manual_review` ステータス。

## 二重投稿防止

`bufferUpdateId` / `status === buffer_queued` / slug重複チェック

## 未設定事項

GitHub Secrets への BUFFER_* 登録（本番移行前必須）

## 本番移行

1. LinkedIn チャネル ID 取得
2. Secrets 設定
3. `npm run queue:linkedin:dry` で1件確認
4. 5営業日限定運用
5. 30記事通常運用
