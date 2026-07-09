# Scheduled Insights（予約公開）

公開前のコラム HTML をここに置き、`schedule.json` の `publishAt`（JST）に達したら GitHub Actions が自動公開する。

## スケジュール（今回）

| 公開日時（JST） | slug | タイトル |
| --- | --- | --- |
| 2026-07-13 10:00 | `robots-sitemap-llms` | robots.txt・sitemap.xml・llms.txtの違い |
| 2026-07-14 10:00 | `schema-vs-llms-txt` | Schema.orgとllms.txt |
| 2026-07-15 10:00 | `why-llms-txt-is-not-enough` | llms.txtだけでは推薦されない理由 |
| 2026-07-16 10:00 | `search-to-action` | 検索から実行へ |

## 仕組み

1. `.github/workflows/publish-scheduled-insights.yml` が毎日 **01:00 UTC（= 10:00 JST）** に実行
2. `scripts/publish-scheduled-insights.mjs` が期限到来記事を `insights/{slug}/` へ移動
3. `insights/index.html` / `sitemap.xml` / `llms.txt` を更新して commit & push
4. Vercel が push を検知して本番デプロイ
5. `public_build` には `_scheduled` を含めない（`package.json` の `build:all`）

## 手動実行

```bash
# 確認のみ
npm run publish:insights:dry

# 特定日時をシミュレート
node scripts/publish-scheduled-insights.mjs --now "2026-07-13T10:00:00+09:00"

# 強制公開（1本）
node scripts/publish-scheduled-insights.mjs --force-slug robots-sitemap-llms
```

GitHub の Actions タブから **Publish scheduled Insights** → Run workflow でも実行できる。
