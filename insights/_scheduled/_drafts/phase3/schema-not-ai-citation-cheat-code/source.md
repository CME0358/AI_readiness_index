## PROBLEM｜誤解の起点

「Schemaを入れればAIに引用される」という話は、構造化データの役割を過大評価しています。Schema.orgはページ上の意味を機械可読にする共通語彙であり、[Googleの構造化データガイド](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)も、リッチリザルト等の**理解補助**として説明しています。AI引用の決定論的なトリガーではありません。本稿は、[Schema.orgとllms.txt](/insights/schema/)の更新角度として、構造化の限界を整理します。

## WHAT SCHEMA DOES｜構造化が担うこと

Organization、Product、FAQ、LocalBusinessなどの型は、名称・所在地・価格・営業時間などの**同一性と比較属性**を明示します。これはVisibility（発見・理解）とAuthority（根拠の明確化）の土台に効きます。検索エンジンやAIがページを解釈するコストを下げ、矛盾検出を早めます。ただし、内容が薄い・矛盾しているページにSchemaを足しても、信頼は増えません。

## WHAT SCHEMA DOES NOT｜構造化が担わないこと

Schemaは、モデル学習の優先権や、回答内の引用スロットを保証しません。ノイズの多いマークアップは、品質評価を損ねる可能性があります。JavaScriptだけで生成し、人間が読む本文と食い違う場合、Authorityを逆に毀損します。Actionability（予約・購入の実行）は、Schema単体では完結しません。API、在庫、決済導線が別途必要です。

## EVIDENCE PRACTICE｜実務での使い方

優先順位は次の通りです。(1)本文と一致する事実の整備(2)主要型の正確なマークアップ(3)検証ツールでのエラー解消(4)更新プロセスのオーナー設定。引用定点観測で改善が見えた場合も、同時期のコンテンツ更新と切り分けて記録します。相関を因果にしないことが研究運用の基本です。

## COMMON FAILURES｜よくある失敗

全ページに同一のFAQ Schemaを貼る、存在しない評価をReview型で示す、価格や在庫が更新されないProduct Schema——これらは短期の露出狙いで長期の信頼を損ないます。AI向けに「キーワード詰め」したJSON-LDは、人間向けコンテンツ品質の低下を招きます。

## ARI READING｜三柱での位置づけ

Visibility：構造化により発見・理解がしやすい状態にする。Authority：マークアップが主張の証拠と一致しているか。Actionability：構造化されたOfferやActionが実際の予約・購入フローに接続しているか。チートコードではなく、情報設計の一部として位置づけてください。

## LIMITS｜言えること・言えないこと

Schema実装は、HTML観測で確認できる信号の一つです。AI回答での引用や推薦を証明するものではありません。プラットフォームごとの利用方針は更新されます。公式ドキュメントを継続参照し、実験結果は自社クエリで再現してください。

> **出典：** [Schema.org](https://schema.org/)／[Google Search Central「Intro to structured data」](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)

## REVIEW CADENCE｜定期レビュー

四半期に、主要テンプレートのSchemaと可視本文の差分監査を行います。価格改定・店舗移転・サービス終了時は、Schema削除・更新をリリースチェックリストに含めます。自動生成Schemaの品質は、生成AIの要約品質と同様にドリフトします。

## RELATION TO llms.txt｜併用の原則

llms.txtは入口の案内、Schemaはページ上の意味の固定——役割が異なります。どちらか一方だけ整備しても、Authorityの穴は残ります。

## TEAM OWNERSHIP｜担当設計

Schemaのオーナーはマーケ単独にせず、商品マスタ・店舗情報・法務表記の更新と同じチケットに紐づけます。組織Schemaの所在地変更がProduct Schemaに反映されない場合、AI比較で別法人と誤認されるリスクがあります。

## TESTING NOTE｜検証の限界

リッチリザルトテストの合格は、AI回答での引用を意味しません。テスト結果と定点観測を別ログに保管し、相関を因果と混同しないでください。
