# 承認後運用手順

1. `referral/review/` の下書きを社内レビュー（許諾範囲・料金・事例表現）
2. 問題なければ `insights/_social/referral/redirects.json` の status を更新
3. SNS投稿は **手動** または既存 queue スクリプトで **新規枠** に投入（Buffer 予約済みは触らない）
4. 投稿本文に /go/ref* URL を含める（X は必須）
5. 週次: `observation/` + GA4/CRM エクスポートで商談導線を観測（P2-02）

**未実施として報告するもの:** 掲載、送信、予約投稿、広告出稿
