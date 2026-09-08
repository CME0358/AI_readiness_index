# 測定計画（P3-01）

## 着地先（対象別）

| 対象 | ラベル | 着地 | UTM campaign |
| --- | --- | --- | --- |
| enterprise | 企業向け — Company Report | https://readiness.coaretail.com/report/?utm_source=referral&utm_medium=outbound&utm_campaign=ari_ref_enterprise&utm_content=p3_enterprise_report | ari_ref_enterprise |
| enterprise | 企業向け — 無料URL確認 | https://readiness.coaretail.com/?utm_source=referral&utm_medium=outbound&utm_campaign=ari_ref_enterprise&utm_content=p3_enterprise_check#company-check | ari_ref_enterprise |
| store | 店舗向け — Local GEO | https://localgeo.coaretail.com/?utm_source=referral&utm_medium=outbound&utm_campaign=ari_ref_store&utm_content=p3_store_localgeo | ari_ref_store |
| store | 店舗向け — 飲食事例 | https://readiness.coaretail.com/cases/bar-secret/?utm_source=referral&utm_medium=outbound&utm_campaign=ari_ref_store&utm_content=p3_store_case | ari_ref_store |
| partner | 協業向け — 無料相談 | https://www.coaretail.com/readiness/mtgschedule?utm_source=referral&utm_medium=outbound&utm_campaign=ari_ref_partner&utm_content=p3_partner_consult | ari_ref_partner |
| partner | 協業向け — 内製/外注ガイド | https://readiness.coaretail.com/guides/inhouse-vs-outsource/?utm_source=referral&utm_medium=outbound&utm_campaign=ari_ref_partner&utm_content=p3_partner_guides | ari_ref_partner |

## /go/ 短縮URL（新規 — x-sidecar と非重複）

| short_id | 着地 |
| --- | --- |
| ref2609e1 | https://readiness.coaretail.com/go/ref2609e1 |
| ref2609e2 | https://readiness.coaretail.com/go/ref2609e2 |
| ref2609s1 | https://readiness.coaretail.com/go/ref2609s1 |
| ref2609c1 | https://readiness.coaretail.com/go/ref2609c1 |
| ref2609p1 | https://readiness.coaretail.com/go/ref2609p1 |
| ref2609p2 | https://readiness.coaretail.com/go/ref2609p2 |

## 衝突チェック
- x-sidecar との short_id 重複: なし

## 計測
- GA4: `landing_view`, `cta_click`, `service_view`（P0-03 辞書）
- 商談: mtgschedule（booking_confirmed は not_connected）
- **既存 x-sidecar の short_id は再利用しない**

## 除外
- テスト/社内: `traffic_type: internal`, `ari_debug=1`, preview/vercel.app
