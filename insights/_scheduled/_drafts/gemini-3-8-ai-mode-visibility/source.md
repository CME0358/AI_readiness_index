## WHAT CHANGED｜モデル更新がAI Modeに入った

Googleは2026年9月2日、Gemini 3.8 Flashと3.8 Flash Cyberを発表しました。公式ブログは、3.8 Flashを「最も知的なワークホース」とし、ソフトウェア工学、エージェント作業、専門領域の多段階推論で3.7 Flashから改善した、と書いています。速度と導入時価格は3.7 Flashと同じ、としています。

消費者向けの提供面として、公式は次を列挙しています。**Google AI ProおよびUltraの加入者**向けに、Geminiアプリ、**Google検索のAI Mode**、Google SheetsのGemini。Search Engine Land（Barry Schwartz、同日）は、3.7のときと同様、AI ModeではPro / Ultra加入者がモデルを選べる、英語から、世界の加入者へ、と伝えています。GoogleのRobby Stein氏（製品担当VP）の投稿として、「Searchに着地した」「モデルドロップダウンで選ぶ」という説明が引用されています。

公式発表もSearch Engine Landも、**AI Overviewsの既定モデルが3.8 Flashに変わったとは書いていません**。無料枠のAI Mode既定が変わった、という公式記述も、この2つの一次・業界記事にはありません。無料枠への拡大時期を、ARIは推測しません。

3.8 Flash Cyberは、Fairwind Program経由の信頼できる防御側向けです。脆弱性発見とパッチの話であり、ARIの可視性論からは外します。

## WHY IT MATTERS｜合成・引用・フォローアップの質

ARIのVisibilityは、面に出るかだけではありません。同じAI Modeでも、モデルが変わると、比較の組み立て、根拠の出し方、追加質問への答え方が変わり得ます。公式が強調しているのは、コーディングと多段階推論、エージェント作業です。検索の引用品質を、この発表だけで「向上した」と数値化することはできません。言えるのは、**有料層のAI Modeは、無料層やAI Overviewsとは別の合成エンジンになりうる**、という階層の更新です。

[複数エージェント比較](/insights/multi-agent-compare/)は、面ごとに参照と能力が違う、という前提でした。今回は、同じGoogle検索のAI Mode内部でも、加入プランとモデル選択で階層が分かれる、という更新です。定点観測で「Gemini」と一枚にしていると、Pro/Ultraの3.8 Flashと、それ以外の応答を平均してしまいます。

Search Engine Landは、モデルが良くなればSearchとAI Modeも良くなるだろう、無料枠にも後から広がるだろう、と書いています。これは業界側の見通しであり、公式のロードマップではありません。

## VISIBILITY TIERS｜今、誰が見ている面か

発表時点で、公式とSearch Engine Landから言える階層は次です。

- **AI Mode（有料・選択）**：Pro / Ultraが3.8 Flashを選べる（Search Engine Landは英語先行、世界の加入者、と記述）
- **AI Mode（それ以外）**：この2資料では、既定モデルの更新は確認できない
- **AI Overviews**：3.8 Flashへの更新は、公式列挙にない
- **Geminiアプリ / Sheets**：Pro / Ultra向け、と公式が列挙

「Geminiで自社が出ない」を一枚の失敗にしない方がよいです。有料AI Modeだけに出る、無料だけに出る、Overviewsだけに出る、は別の観測です。引用の有無やリンクの出し方も、モデルとクエリと時点に依存します。ローンチ直後の挙動を、仕様として固定しません。

## WHAT TO CHECK NOW｜今確認すること

- 代表質問を、AI Modeの無料（または既定）と、Pro/Ultraで3.8 Flashを選んだ場合で、分けて記録する
- 自社・競合の出方、説明の正確さ、引用リンクの有無を、面ごとに残す
- AI Overviewsの結果を、AI Mode 3.8 Flashの結果と平均しない
- 公式情報（社名、提供、条件）が、新しい合成でも矛盾なく読めるか
- フォローアップ（追加の比較質問）で、説明が崩れないか
- 「ランキングが上がった」ではなく、描写の正確さと比較材料の残り方を見る

[Visibility](/insights/vis/)と[推薦の組み立て](/insights/recommendation-logic/)は、モデル更新後の点検項目を置く場所です。サイバー性能ベンチマークは、本記事の対象外です。

## WHAT THIS DOES NOT PROVE｜発表だけでは分からないこと

- 3.8 Flashが、すべての業種・言語で引用品質を上げたこと
- AI Overviewsや無料AI Modeが、同じ週に切り替わったこと
- 有料層に出れば、無料層や従来検索でも優位になること
- 特定のコンテンツ形式が、3.8 Flashで必ず引用されること
- 無料枠への展開時期

公式のベンチマーク（DeepSWE、HLE-Verified、金融・法律エージェント等）は、コーディングと専門推論の話です。企業の地域名・料金ページの引用率ではありません。

## NEXT ACTION｜次の一手

観測表に「面」と「モデル／プラン」の列を足します。今週は、主力の比較質問をAI Modeの階層で撮り直し、描写のずれだけを直します。Overviews用の施策と、有料AI Mode用の施策を、同じ「Gemini対策」に束ねないようにします。

> **出典：** [Tulsee Doshi / Raluca Ada Popa, Google, “Introducing Gemini 3.8 Flash and 3.8 Flash Cyber,” 2026-09-02](https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/)。業界確認：[Barry Schwartz, Search Engine Land, “Gemini 3.8 Flash rolling out in Google Search,” 2026-09-02](https://searchengineland.com/gemini-3-8-flash-rolling-out-in-google-search-486630)。
