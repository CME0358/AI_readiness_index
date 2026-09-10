## WHAT CHANGED｜何が変わったか

NIQは2026年9月2日、Similarwebとの協業として **Agentic Commerce Measurement** を発表しました。公式リリースは、AIが発見だけでなく購入プロセスの一部になりつつある、という前提のうえで、ブランド・小売・技術プラットフォームが「エージェント経済で商品がどう買われるか」を理解するための測定を足す、と説明しています。

初期フォーカスは5領域です。

- **Consumer Intent**：消費者がAIアシスタントに何を尋ね、どのニーズやプロンプトが判断を形作るか
- **Agentic Shelf Visibility**：AIが選択肢を勧めるとき、商品がどこに現れ、競合と比べてどう見えるか
- **Product Content Readiness**：商品情報が揃い、構造化され、AIが発見・理解・正確に推薦できる状態か
- **AI-Driven Traffic**：ブランドや小売の商品ページに届くトラフィックのうち、AI由来（直接クリックと、エージェント発見の影響を受けた後続訪問）はどれか
- **AI-Driven Conversion**：AIの影響を受けた接点が、検証可能なオムニチャネル購買行動につながるか

初期版は2026年第4四半期、限られたカテゴリと市場から始まり、対象を広げるとされています。対象プラットフォームとして、ChatGPT、Gemini、Google AI Mode、Perplexity、Claudeが挙げられています。**現時点では未提供**です。FAQでも「今日使える製品ではない」と明記されています。

## WHY IT MATTERS｜測定カテゴリが先に動いた

[IABのAI可視性計測](/insights/iab-ai-visibility/)は、Presence・Prominence・Portrayal・Persuasionの4Pと、Directional／Decision-Gradeという品質区分を、メディアと広告の側から整理した枠でした。NIQ×Similarwebは、同じ「見えるか」問題を、**棚・コンテンツ準備・トラフィック・購買結果**までつなぐCommerce Intelligenceとして置いています。

ARIとの重なりは、最初の3領域にあります。Agentic Shelf Visibilityは発見と推薦の可視性、Product Content Readinessは理解と比較に耐える情報設計、Consumer Intentは「どの問いで比較されているか」です。IABの4Pが回答面の見え方を測るのに対し、こちらは商品がエージェント棚に載るか、載ったあと何が起きるか、までを一つの測定物語にしようとしています。

リリースは、GoogleのUniversal Commerce ProtocolとOpenAIのAgentic Commerce Protocolを、発見から評価・推薦・購入までを一つのAI体験に閉じるインフラの例として挙げています。ARIでは、この言及を「購入完了までが同じ画面で起きうる、という測定上の前提」として受け取ります。プロトコルの実装手順や決済レールの解説には入りません。

## HOW TO READ IT IN ARI｜IABともARIとも役割が違う

ARIの三柱で読むと、役割分担は次のように置けます。

- **Visibility**：Agentic Shelf VisibilityとAI-Driven Traffic。棚に出るか、公式ページへ戻るか
- **Authority / Understanding**：Product Content Readinessと、意図に対する正確な描写。欠落や誤表現は推薦根拠を崩す
- **Actionability（浅い層）**：AI-Driven Conversionは「見えること」と「買われたこと」を分ける指標であり、予約・決済プロトコルそのものではない

[引用と実行の差](/insights/citation-vs-action/)で整理してきた通り、棚に出ることと、比較のあと行動が完了することは別の観測です。NIQの5領域は、その差を測定カテゴリとして名前を付けた点に新しさがあります。初期版の対象カテゴリ・市場は未発表なので、「自社カテゴリがQ4から測れる」とは言えません。

Similarweb側の公式コメントは、AIの影響はプラットフォームを離れたあとも続く、デジタル信号で行程全体を見る、という位置づけです。これはIABが測る回答内の可視性とは別レイヤーです。両方を平均して一つの「AIスコア」にしない方が、ARIの使い方に近いです。

## WHAT TO CHECK NOW｜製品を待たずに確認できること

測定製品の一般提供を待たなくても、公式リリースが名前を付けた5領域は、自社の観測設計に使えます。

- 代表質問を決め、自社商品が「エージェント棚」に載るか、競合とどう並ぶかを記録する（Shelf Visibility）
- 商品名・仕様・対象・制約・提供条件が、公式ページで欠落なく読めるか（Content Readiness）
- AI経由とそれ以外の流入を、参照元が分かる範囲で分けて見る（Traffic）
- 見えることと、問い合わせ・購入などの結果を、同じKPIに混ぜない（Conversionは別列）
- IABの4Pを使っているなら、PresenceとShelf Visibilityを同一視しない

[Visibility](/insights/vis/)と[IAB計測](/insights/iab-ai-visibility/)は、棚の観測と回答面の観測を分ける参照になります。

## WHAT THIS DOES NOT PROVE｜リリースだけでは分からないこと

- Q4初期版の対象カテゴリ、国、精度、価格
- ChatGPT等の掲載が、NIQの数値と一致すること
- コンテンツを整えた企業が、棚で必ず勝つこと
- AI-Driven Conversionが、従来のラストクリック成果と一致すること
- Universal Commerce ProtocolやAgentic Commerce Protocolの実装詳細、対応義務

リリースには将来見通しに関する注意書きがあります。発表は測定カテゴリの宣言であり、自社カテゴリでの実測結果ではありません。

## NEXT ACTION｜次の一手

まず、IABの4Pと、棚・準備・流入・結果を、ダッシュボード上で別列にします。次に、主力商品のContent Readiness（名称、仕様、対象、制約、比較条件）を公式ページで点検します。Q4の製品発表は、対象市場が自社に当たるかだけを追えば足ります。決済プロトコルの実装検討は、この記事の範囲外です。

> **出典：** [NIQ, “NIQ and Similarweb Advance Agentic Commerce Measurement for the AI Shopping Era,” 2026-09-02](https://nielseniq.com/global/en/news-center/2026/niq-and-similarweb-advance-agentic-commerce-measurement-for-the-ai-shopping-era/)。本記事は公式リリースとFAQの範囲で整理しています。IAB枠との差分はARIの読みであり、NIQ公式の比較声明ではありません。
