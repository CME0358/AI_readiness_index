## WHAT CHANGED｜Shopify側の構造化

Shopifyは2026年のSpring Editionで、Catalog APIとShopify CatalogをAIエージェント向けの構造化商品基盤として拡張しました。[公式ヘルプ](https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/products)によれば、対象商品はAIチャネル向けにタイトル・説明・オプション・画像・価格・在庫などが構造化され、Catalogが継続更新する設計です。クロール・インデックス・独自フィードと併存し、Catalogは「権威ある商品データフィード」として位置づけられています。

## WHY IT MATTERS｜二つの発見経路

事業者は「AIチャネル経由の構造化配信」と「オーガニックなWeb発見」の両方を意識する必要があります。Catalogに載ることは、エージェント検索・比較の近道になり得ます。一方、公式サイトや地図・レビュー・メディア掲載など、Catalog外の情報がAuthorityを補強します。片方だけ最適化すると、価格・在庫・条件の不一致が比較段階で露呈します。

## CATALOG PATH｜構造化カタログで揃えるもの

Shopify Catalog Mappingは、メタフィールドやカスタムフィールドを正しくマッピングするための機能です。カテゴリ、バリエーション名、GTIN、素材・サイズなど比較属性の欠落は、AIの候補脱落要因になります。公式ブログは、AI検索でCatalog経由の結果がスクレイピングベースより高いコンバージョンを示したと述べていますが、自社での再現は業種・価格帯・質問設計に依存します。

## ORGANIC PATH｜オーガニック発見を残す設計

ヘルプは、商品データの正確性に加えSEOベストプラクティスに従うことを推奨しています。構造化データ、サイトマップ、明確なポリシーページ、ブランドストーリーは、Catalog外のクローラーと人間双方に効きます。Agentic向けの発見ファイル（llms.txt等）はCatalogを置き換えません。Visibilityは「複数入口で同じ商品実体に到達できるか」として設計します。

## GOVERNANCE｜配信制御と整合

管理画面のAgenticセクションで、どのAIチャネルにCatalogデータを出すかを制御できます。チャネルごとに価格・在庫・販売条件が異なる場合、Catalogとストアフロントの差分を定期監査してください。Actionabilityでは、チェックアウトリンク・Shopサインイン・在庫切れ時の代替導線まで含めてテストします。

## WHAT TO CHECK NOW｜実務チェックリスト

(1)主要SKUの属性がCatalogと商品ページで一致するか。(2)比較に効くフィールド（配送、返品、サイズ表）が欠けていないか。(3)Catalog未対応チャネル向けにHTMLでも同情報が読めるか。(4)AI経由流入のリファラとコンバージョンをGSC・Analyticsで分離できるか。プロトコル実装の話ではなく、情報の二重入口を矛盾なく保つことが目的です。

> **出典：** [Shopify Help「Catalog and product discovery for agentic storefronts」](https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/products)／[Shopify News「Spring '26 Edition」](https://www.shopify.com/news/spring-26-edition-dev)

## MERCHANT SCENARIOS｜典型パターン

単一ブランドD2Cは、Catalogとストアフロントの差分が小さい一方、マーケットプレイス出品者は同一SKUの複数店舗表記がAI比較で混乱を招きます。B2B見積り商品は、公開価格とCatalog価格の乖離がAuthorityを損ねます。シナリオごとに、どちらの入口が主要かを決め、劣位入口を意図的に閉じるか整合させるかを選びます。

## UPDATE CADENCE｜更新頻度の設計

Catalogは継続更新と説明されていますが、オーガニック側のブログ・FAQ・ポリシーが古いと、AIが異なる年代の情報を合成するリスクがあります。価格改定・在庫切れ・季節商品の上下架は、Catalog・HTML・構造化データを同一チケットで更新する運用にしてください。

## ACTIONABILITY CHECK｜実行導線の確認

Catalog経由で商品が見つかっても、チェックアウト・Shopサインイン・在庫切れ時の代替案が機能しないとActionabilityは失敗します。代表SKUで、AIチャネルから実際に購入テストを四半期に一度行い、エラー率を記録してください。
