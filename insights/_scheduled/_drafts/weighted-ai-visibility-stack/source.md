## WHAT CHANGED｜何が議論されているか

Search Engine Journalに2026年9月、Greg Jarboe氏の論考が掲載されました。論点は、Siege MediaのRoss Hudgens氏が「PerplexityをLLMトラッカーから外すべき」と主張したことに対し、**外すな、重みを下げろ**、という対案です。これはOpenAIやGoogleの公式発表ではなく、**業界メディア上の分析**です。数字は本文が引用した各社データに帰属させ、SEJ記事の解釈と混ぜません。

Jarboe氏の整理は、市場が「全部のアシスタントを同じ1票で平均する」段階を過ぎつつある、一方で「主要4つ以外は無視してよい」とまでは言えない、というものです。ARIではこれを、[複数エージェント比較](/insights/multi-agent-compare/)の測定版として読みます。平均スコアは便利ですが、どの面で誰に見えているかを隠します。

## THE TRADE ANALYSIS｜3層に分けて測る、という提案

SEJ論考が提案しているのは、次の3層です（Jarboe氏の整理）。

- **第1層（核）**：規模と戦略的意味の両方がある面。ChatGPTとGeminiは別々に測り、汎用LLMスコアに平均しない。B2Bや専門職向けならClaudeを核に足す
- **第2層（検索エコシステム内のAI）**：GoogleのAI OverviewsとAI Modeは、別のLLMとして平均せず、検索行程がどう変わったかを見る層。Microsoft Copilotは、Microsoft 365の露出が大きい組織でこの層に入りうる、という記述がある
- **第3層（新興・特化）**：Perplexity、Grok、DeepSeekなど。同じ重みは付けない。消さず、異常な可視性・流入・引用・成長を監視する

Hudgens氏の問題意識（小さい面に大きな重みを置くと合成スコアが歪む）は、論考も共有しています。処方だけが違う、とJarboe氏は書いています。

## NUMBERS IN THE SOURCES｜数字は出典ごとに置く

SEJ本文が名前を出して引用している範囲だけを置きます。ARIが独自に測った数字ではありません。

- **StatCounter**（世界のAIチャットボット紹介シェア）：2026年6月、Perplexity 7.91%、Gemini 7.94%。8月、Perplexity 4.31%、Gemini 10.9%
- **Similarweb**（7つの主要AIアシスタントの世界Web訪問、2026年5月）：ChatGPT 53.9%、Gemini 27.9%、Claude 9.2%、DeepSeek 4.1%、Grok 2.4%、PerplexityとCopilotは各1.3%。別の記述では、ChatGPTのシェアが前年の76.4%から2026年5月頃に約52.7%、Geminiは約9%から27.3%、Claudeは1.6%から8.9%
- **OpenAI**（SEJ経由）：2026年2月に週次アクティブユーザー9億超、7月末に全製品でアクティブユーザー10億超、という社発表の引用
- **Google**（SEJ経由）：Geminiアプリが月間10億ユーザーを超えた（8月の社発表引用）。AI Overviewsは月間25億超、AI Modeは月間10億超（6月の社発表引用）。AI Modeのクエリはローンチ以降四半期ごとに2倍超、という社発表の引用
- **SimilarwebをTechCrunchが報じた数字**（SEJ経由）：2026年5月、米Google検索の43%にAI Overviews。AI Mode訪問は2025年6月の1.26億から2026年5月の2.79億
- **Anthropic**（SEJ経由）：企業・開発者向けの広がりを示す社発表の引用（Bedrock上の顧客数、年次換算売上、高額顧客数など）

紹介シェアと利用シェアは、論考自身が「違う」と注意しています。訪問シェアが小さい面でも、特定業種では戦略的に残ることがあります。数字を1本の「勝者表」にしない、というのが論考の本筋です。

## WHY AVERAGES HIDE THE SIGNAL｜平均が隠すもの

論考の仮想例です。引用率がChatGPT 40%、Gemini 35%、Claude 30%、Perplexity 90%なら、単純平均は48.75%です。Perplexityが自社にとって小さな紹介源なら、90%を核と同じ1票にしてはいけません。逆に、特定業種でPerplexity紹介が無視できないなら、削除は信号を消します。

ARIの言い方に戻すと、聞くべきなのは「平均可視性は何点か」ではなく、[Visibility](/insights/vis/)が**どの面の、どの問いの、誰に対して**成立しているかです。論考は、次の3データセットを接続せよ、と書いています。

1. 露出（利用・訪問・面の分布）
2. 可視性（言及、引用、リンクURL、それを生むプロンプト）
3. 事業影響（分析できる範囲で、AI紹介と成果）

これは[IABのAI可視性](/insights/iab-ai-visibility/)が、単一スコアをDecision-Gradeと取り違えるな、と注意した話と同型です。加重は、4Pのどれを、どの面で見るか、を決める操作です。

## WHAT TO CHECK NOW｜今すぐ確認すること

- いまの「AI可視性スコア」は、各面を等重みで平均していないか
- ChatGPT / Gemini / Claudeを、別列で見ているか
- GoogleのAI OverviewsとAI Modeを、LLM平均に混ぜていないか
- Perplexity等を消さず、紹介シェアや業種適合で重みを付けているか
- 消費者向けとB2B向けで、核の面を変えているか（論考はClaudeを企業・専門職の核に置ける、と述べている）
- 平均点の上下だけで、改善優先度を決めていないか

[複数エージェント比較](/insights/multi-agent-compare/)は、参照源とポリシーが面ごとに違う、という前提の解説です。本記事はその前提を、測定の加重ルールに落とします。

## WHAT THIS DOES NOT PROVE｜論考だけでは分からないこと

- 来四半期のシェア順位が、この表のまま固まること
- Perplexityを外せば、合成スコアが「正しく」なること
- 特定の重み係数（例：ChatGPT 50%）が業界標準であること
- 加重スタックを作れば推薦される、売上が上がること
- OpenAI・Google・Anthropicが、この3層分類を公式に採用していること

社発表のユーザー数と、Similarwebの訪問シェアと、StatCounterの紹介シェアは、定義が違います。横断して「何位」と決め打ちしません。

## NEXT ACTION｜次の一手

核の3面と、GoogleのAI検索層と、新興面の監視リストを、表で分けます。重みは、自社の紹介シェアと顧客の利用面から仮置きし、四半期で見直します。平均点は社内共有用の見出しに残してよいですが、改善判断は面別の列で行います。

> **出典（業界分析）：** [Greg Jarboe, Search Engine Journal, “ChatGPT, Gemini & Claude Lead AI Visibility, Is It Time To Stop Tracking Perplexity?,” 2026-09](https://www.searchenginejournal.com/chatgpt-gemini-claude-lead-ai-visibility-is-it-time-to-stop-tracking-perplexity/588378/)。本文中の数値は、SEJが引用したStatCounter、Similarweb、各社発表、TechCrunch経由Similarwebに帰属します。ARIの独自調査ではありません。
