## SCOPE｜本稿の立場

OpenAIはChatGPTの取得・引用アーキテクチャの詳細を公式に十分公開していません。本稿は、[Peec.aiの分析](https://peec.ai/blog/chatgpt-built-its-own-search-index)および複数の第三者調査が示す**仮説と観測**を整理し、実務示唆を抽出します。Labrador等の内部名称やパイプライン構成は、OpenAI確認済みの事実ではありません。断定ではなく、検証可能なチェック項目に落とし込みます。

## WHAT THIRD PARTIES OBSERVE｜第三者が報告する構図

Peec.aiは、2026年5〜7月にChatGPTのサーバーイベントに現れた result_source 値（Labrador、Bright、Oxylabs、SERP等）を分析し、取得経路がクエリやモードで切り替わると報告しています。別研究では、Labrador系インデックスがURL・タイトル・短いスニペットを保持するという観測もありますが、サンプルと期間は限定されます。OpenAIの公式仕様として扱わないでください。

## IMPLICATION FOR VISIBILITY｜Visibilityへの示唆

複数パイプラインが存在する場合、同一質問でも引用集合が入れ替わり得ます。定点観測では、日付・地域・モード（無料／有料）を固定し、URL重複率を記録します。Google順位だけを追っても、ChatGPT側のパイプライン変更で結果が変わる可能性がある——というのが第三者分析の警告です。因果ではなく、観測設計の注意として読みます。

## IMPLICATION FOR AUTHORITY｜Authorityへの示唆

ニュース・百科・専門サイトがLabrador系で多いという報告は、**権威ドメインの引用**を示唆しますが、一般事業者サイトの条件は業種依存です。ページ冒頭200文字前後の可視テキストに、誰が何を提供するかが明確にあるか——という実務チェックが、複数の第三者記事で推奨されています。メタディスクリプションだけに依存しない設計は、HTML観測とも整合します。

## IMPLICATION FOR ACTIONABILITY｜Actionabilityへの示唆

商品・店舗系クエリでは、ショッピングやローカル向けの別フィードが使われるという第三者分析があります。[ChatGPT商品探索](/insights/openai-product-discovery-agentic-commerce/)で整理した価格・在庫・購入導線の整備は、取得経路が分かれても有効なActionability要件です。引用より先に、比較と実行に必要な事実の一貫性を確認してください。

## WHAT TO CHECK NOW｜自社でできる検証

(1)代表質問10件を週次で同一条件実行し、引用URLをログ。(2)ページ上部の可視テキストが単体で事業を説明できるか確認。(3)公式情報と第三者情報の主張が一致しているか監査。(4)パイプライン変更の報告をウォッチし、急な引用消失時にコンテンツ更新と切り分け。OpenAI公式発表がない領域は「未確認」とラベル付けします。

## LIMITS｜言えないこと

Labradorの存在・仕様・学習利用はOpenAI未確認です。Peec.ai、Search Engine Land、各SEOベンダーの分析は参考資料であり、再現が必要です。取得経路の説明を実行プロトコルや決済仕様の話と混同しないでください。本稿はVisibility・Authority・Actionabilityの実務設計に限定します。

> **出典（第三者分析）：** [Peec.ai「ChatGPT built its own search index」](https://peec.ai/blog/chatgpt-built-its-own-search-index)／※OpenAI公式確認済み情報ではありません

## REPRODUCTION PROTOCOL｜再現手順

第三者分析を自社で再現する手順：(1)同一アカウント・同一モードで質問を固定、(2)引用URLと result_source 相当の手がかりをスクリーンショット保存（利用可能な場合）、(3)ページ更新前後で二週間隔再実行、(4)変更点をコンテンツ・技術・外部要因に分類。OpenAIの仕様変更で過去分析が無効化される前提で、最新の第三者報告を継続ウォッチします。

## PAID VS FREE｜モード差の記録

第三者報告では、無料インスタントモードと有料思考モードで取得経路が異なる可能性が示唆されています。観測条件にモードを明記しないと、チーム内で結果が一致しません。

## DOCUMENTATION DISCIPLINE｜記録の型

観測ログには、質問文・日時・モード・引用URL・ページ更新日・第三者分析の参照日を必須化します。OpenAI未確認の分析を社内標準として固定しないよう、「仮説」「再現済み」「未再現」のラベルを付けて共有してください。
