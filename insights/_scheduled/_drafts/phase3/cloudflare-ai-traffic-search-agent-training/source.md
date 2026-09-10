## WHAT CHANGED｜何が変わったか

Cloudflareは2026年7月1日、AIトラフィックをSearch（検索インデックス用）、Agent（リアルタイムの自動取得）、Training（モデル学習用）の三つに分類し、それぞれ独立して制御できるオプションを[公式changelog](https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/)で発表しました。各プリセットは全ページでブロック、広告表示ページのみブロック、ブロックしないの三択です。2026年9月15日からは新規ドメインの既定値が変更され、広告表示ページではTrainingとAgentをブロックし、Searchは許可されます。既存ドメインは9月15日までに任意でオプトアウトできます。

## WHY IT MATTERS｜なぜ境界線が重要か

検索と学習は同じ「AIクローラー」ではありません。Searchは後から質問に答えるためのインデックス用途で、参照流入や公平な補償が期待されるとCloudflareは説明しています。Agentはチャット取得ボットやブラウザ操作など、人の代理としてリアルタイムに動く自動取得です。Trainingはコンテンツをモデル学習や微調整に取り込む用途です。VisibilityはSearchとAgentの許可設計、Authorityはコンテンツがどの用途で再利用されるかの政策判断に直結します。

## WHAT IS ANNOUNCED｜発表で確定している事実

公式情報により、次が確定しています。(1)無料プランを含む全顧客が三分類を独立制御できる。(2)広告ページ向けのブロック粒度を選べる。(3)2026年9月15日から新規ドメインはTrainingとAgentを広告ページでブロック、Searchは許可。(4)SearchとTrainingを併用するマルチ目的クローラーにも新既定が適用される。本稿執筆時点（2026年9月10日）は既定変更の前日であり、変更後のトラフィック分布・引用率・収益影響は未観測です。効果は9月15日以降の定点観測が前提です。

## WHAT IS NOT YET KNOWN｜まだ観測できないこと

クローラー分類後に、各AIオペレーターがSearch経路をどう解釈するか、Agentブロックがチャット引用にどう効くか、Trainingブロックが学習利用を止めるかは、公開事例が十分ではありません。既存ドメインがオプトアウトした場合の分布も未確定です。CloudflareダッシュボードのOperator Activityは変更後に比較する必要があります。単発のブロック設定だけでAI推薦が改善したと断定することはできません。

## WHAT TO CHECK NOW｜今確認すべきこと

robots.txtとCloudflareのAI制御が矛盾していないか、広告ページの定義が自社サイトで正しく判定されるか、Search許可とTraining拒否の政策がコンテンツ所有者の意図と一致するかを点検します。比較に必要な公式情報（名称・価格・条件・地域・行動導線）の機械可読性は、クローラー種別を分けても変わらないVisibility要件です。Agentを許可する場合、リアルタイム取得に耐える更新頻度と在庫・空き情報の整合も確認します。

## ARI READING｜三柱での読み方

Visibilityでは、SearchとAgent経路で公式情報が取得できるかを見ます。Authorityでは、学習利用ポリシーと第三者情報の整合を見ます。Actionabilityは、クローラー設定ではなく予約・購入・問い合わせ導線の完成度で判断します。これは決済プロトコルや取引実行の話ではなく、情報政策と測定設計の問題として整理してください。[マルチエージェント比較](/insights/multi-agent-compare/)の観点と合わせ、オペレーターごとに許可方針を分けて記録することが実務的です。

> **出典：** [Cloudflare Changelog「New options to manage AI traffic」2026-07-01](https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/)

## COMPARISON TO PRIOR FRAMING｜既存論点との接続

[Cloudflare AEO](/insights/cloudflare-aeo/)が扱った「ranking→recommended」は、計測と推薦可視化の話でした。今回の三分類は、**どの用途のトラフィックを許可するか**という入口政策の話です。Diagnosticsで読み取り可能性を点検しても、Trainingを拒否する政策がなければ学習利用の観点は別管理が必要です。Operator Activityのログは、Search許可後にどのオペレーターがどの分類で来たかを記録する基盤になります。

## DECISION CHECKLIST｜経営向けの確認項目

経営判断では、(1)コンテンツの学習利用に対する公式方針、(2)広告収益とAI引用のトレードオフ、(3)Agent許可によるリアルタイム価格・在庫の更新責任、(4)主要AIオペレーターごとの許可ログの保管期間、を確認します。技術チームだけでブロック設定を決めず、法務・編集・営業が同じ表で合意することが重要です。
