# Scheduled Insights（予約公開）

公開前のコラム HTML をここに置き、`schedule.json` の `publishAt`（JST）に達したら GitHub Actions が自動公開する。

**方針:** 平日（月〜金）のみ・1日1本・JST 10:00。土日は公開しない。

## スケジュール

| 公開日時（JST） | 曜 | slug | タイトル |
| --- | --- | --- | --- |
| 2026-07-13 10:00 | 月 | `files` | robots.txt・sitemap.xml・llms.txtの違い |
| 2026-07-14 10:00 | 火 | `schema` | Schema.orgとllms.txt |
| 2026-07-15 10:00 | 水 | `grounds` | llms.txtだけでは推薦されない理由 |
| 2026-07-16 10:00 | 木 | `exec` | 検索から実行へ |
| 2026-07-17 10:00 | 金 | `vis` | Visibilityとは何か |
| 2026-07-20 10:00 | 月 | `blind` | Visibilityを阻害する5つの原因 |
| 2026-07-21 10:00 | 火 | `checklist` | Visibility実践チェックリスト |
| 2026-07-22 10:00 | 水 | `auth` | Authorityとは何か |
| 2026-07-23 10:00 | 木 | `trust` | レビューだけでは足りない |
| 2026-07-24 10:00 | 金 | `wrong` | Authorityを失う企業の共通点 |
| 2026-07-27 10:00 | 月 | `act` | Actionabilityとは何か |
| 2026-07-28 10:00 | 火 | `price` | AIは価格をどう理解するか |
| 2026-07-29 10:00 | 水 | `reviews` | AIはレビューをどう比較するか |
| 2026-07-30 10:00 | 木 | `book` | AIが予約できる会社 |
| 2026-07-31 10:00 | 金 | `pay` | AIが決済できる会社 |
| 2026-08-03 10:00 | 月 | `why-ari` | なぜAgent Readinessが新しい基準か |

## 仕組み

1. `.github/workflows/publish-scheduled-insights.yml` が毎日 **01:00 UTC（= 10:00 JST）** に実行
2. `scripts/publish-scheduled-insights.mjs` が期限到来記事を `insights/{slug}/` へ移動
3. `insights/index.html` / `sitemap.xml` / `llms.txt` を更新して commit & push
4. Vercel が push を検知して本番デプロイ
5. `public_build` には `_scheduled` を含めない（`package.json` の `build:all`）
6. 土日は `publishAt` が無いため何も公開されない（平日のみスケジュール）

## 手動実行

```bash
npm run publish:insights:dry
node scripts/publish-scheduled-insights.mjs --now "2026-07-17T10:00:00+09:00"
node scripts/publish-scheduled-insights.mjs --force-slug vis
```

GitHub の Actions タブから **Publish scheduled Insights** → Run workflow でも実行できる。
