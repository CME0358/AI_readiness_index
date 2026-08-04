# LinkedIn Queue（Agent Readiness Insights v2）

Buffer 予約投稿上限（10件）を回避するため、**リポジトリ側に全投稿を保持**し、**毎営業日1件のみ** Buffer へ転送する。

## ファイル

| ファイル | 役割 |
|---|---|
| `queue.json` | 全投稿キュー |
| `published-log.json` | 転送成功ログ |
| `failed-log.json` | 失敗・再試行ログ |

## 運用ポリシー

- タイムゾーン: Asia/Tokyo
- 転送: 平日 10:15 JST、1件/日
- LinkedIn投稿: 11:00 JST
- Web公開確認（HTTP 200）後のみ転送

## ステータス

```
draft → scheduled → article_published → ready_for_buffer → buffer_queued → published
```

異常: `article_publish_failed` / `article_url_unavailable` / `buffer_transfer_failed` / `buffer_rejected` / `manual_review`

## コマンド

```bash
npm run queue:linkedin:dry    # dry-run（queue.json 不変）
npm run queue:linkedin        # 本番転送（要 BUFFER_* 環境変数）
```

## 環境変数

`.env.example` 参照。GitHub Secrets で管理。

## 冪等性

- `bufferUpdateId` あり → 再送しない
- `status === buffer_queued` → 再送しない
- slug / articleUrl 重複禁止
