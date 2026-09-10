## WHAT CHANGED｜モデルと面の更新

Googleは2026年9月2日、Gemini 3.8 Flashを発表し、Geminiアプリ、Google Sheets、**AI Mode in Google Search**でGoogle AI Pro／Ultra加入者が利用できると[公式ブログ](https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/)に明記しました。Search担当VPの投稿では、AI Modeのモデルメニューから3.8 Flashを選べると案内されています。一方、AI Overviewsの既定モデル変更は同日の発表には含まれていません。

## WHY IT MATTERS｜複数AI面でのVisibility

同じGoogleエコシステムでも、AI Overviews（広く配信）、AI Mode（対話型・一部加入者向けモデル選択）、Geminiアプリ（直接対話）は、参照・要約・引用の挙動が一致しません。[マルチエージェント比較](/insights/multi-agent-compare/)と同様、単一画面の最適化では全体像を誤ります。モデル世代が変わると、同じ質問でも引用集合が入れ替わる可能性があります——確率論であり断定はできません。

## WHAT IS CONFIRMED｜確認できる事実

確認済み：(1)3.8 FlashのGAとモデルID gemini-3.8-flash。(2)AI ModeのピッカーでPro/Ultraが選択可能（英語先行の記述あり）。(3)AI Overviewsは2026年1月のGemini 3既定が公式に継続。(4)開発者向けAPIとEnterprise経路の提供。未確認：3.8 FlashがAI Overviews既定になる時期、無料層への展開、日本語クエリでの引用差分の定量データ。

## OBSERVATION DESIGN｜定点観測の設計

観測テンプレートを面ごとに分けます。AI Overviews：代表クエリ10件×週次スクリーンショット。AI Mode：加入アカウントで同一クエリを3.8 Flash選択時のみ実行。Geminiアプリ：ブランド指名とカテゴリ指名を分離。記録項目は、ブランド言及、引用URL、競合言及、警告文脈です。モデルバージョンと日時を必ずログに残します。

## ARI READING｜三柱での読み方

Visibilityは面ごとの出現率。Authorityは引用された公式・第三者情報の質。Actionabilityは回答後に辿れる予約・購入リンクの有効性です。モデル更新はインフラ変更であり、自社の商品属性や店舗情報の整備を代替しません。測定とコンテンツの両輪で対応してください。

## LIMITS｜過剰解釈を避ける

第三者の早期観測では、3.8 Flash選択時に引用数が変動したという報告がありますが、サンプルと条件が限定されます。自社データなしに業界全体へ一般化しないでください。SEO順位とAI Mode引用の相関は面によって異なります。因果を主張せず、変更ログとして蓄積します。

> **出典：** [Google「Introducing Gemini 3.8 Flash」2026-09-02](https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/)／[Google AI for Developers「Gemini 3.8 Flash」](https://ai.google.dev/gemini-api/docs/latest-model)

## JAPAN MARKET NOTE｜日本市場の注意

英語先行の記述があるため、日本語クエリではモデルメニューの表示や引用集合が異なる可能性があります。国内サービスは、日本語の代表質問セットを別途保持し、英語観測結果をそのまま転用しないでください。地域・言語・デバイスをログの必須フィールドにします。

## DEFAULT VS OPT-IN｜既定と選択の違い

3.8 Flashは現時点でAI Modeの**選択肢**であり、無料層の既定ではありません。将来既定が変われば観測母数が一気に変わるため、変更アナウンスをウォッチリストに登録してください。Overviews側の変更がない限り、大量トラフィック面での影響は限定的かもしれませんが、断定はできません。

## RESEARCH HANDOFF｜自社Researchへの接続

Research Hubでは複数AI・複数業種の定点観測を推奨しています。3.8 Flash導入後は、観測テンプレートのモデル欄を更新し、過去ログとの比較は世代タグ付きで保管してください。単発のスクリーンショット比較は再現性に欠けます。
