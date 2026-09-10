## PROBLEM｜単一スコアでは読めない

「AI Visibilityスコア」一つで改善判断をすると、検索面・回答面・引用面の差が消えます。Googleは2026年6月、Search Consoleに生成AI機能向けの専用レポートを追加し、AI OverviewsやAI Mode、Discover上の生成AI表示におけるインプレッションを分離して見せると[公式ブログ](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)で説明しました。業界全体でも、AI回答での露出・文脈・行動影響を分けて測る試みが進んでいますが、単一KPIへの還元はまだ統一されていません。

## FRAMEWORK｜三層スタックの考え方

本稿ではAI Visibilityを次の三層で重み付けして読む運用モデルを提案します。第1層Search Reach（検索・発見）、第2層Answer Presence（回答・概要への掲載）、第3層Citation Authority（回答内での引用・根拠としての掲載）。重みは業種で変えます。比較購買では第2・3層、地域サービスでは第1層と行動導線の接続が効きやすい——ただしこれは観測設計の仮説であり、因果は各層で別途検証が必要です。

## LAYER 1｜Search Reach

伝統的な検索流入・インデックス・クリックは、AIが参照元を辿る確率に影響します。GSCの全体パフォーマンスと生成AIレポートを併読し、同じURLが両方に出るかを見ます。ここで止まると「見つかるが引用されない」ギャップを見逃します。[Visibilityの定義](/insights/vis/)は入口として有効ですが、本稿は定義の再説明ではなく測定運用に焦点を当てます。

## LAYER 2｜Answer Presence

回答や概要にブランド・サービス名が現れるか。クリックが発生しないインプレッションでも、比較候補に入ったシグナルとして価値があります。定点質問セットで複数AIを観測し、日付・地域・質問文を固定します。スコア化するなら「出現率」より「出現文脈（推奨・中立・警告）」を記録してください。

## LAYER 3｜Citation Authority

引用は、Authorityの可視化に近い層です。公式情報・第三者レビュー・構造化データが、回答の根拠として選ばれているかを見ます。引用がなく名前だけ出る場合、Understandingはあるが根拠が弱い可能性があります。IAB系の可視性枠組みとも接続できますが、本稿はプロトコル語彙ではなく観測運用に留めます。

## OPERATIONS｜重み付けの実務

四半期ごとに重みを見直します。例：B2C物販はAnswer 40%・Citation 35%・Search 25%、地域サービスはSearch 45%・Answer 35%・Citation 20%——数値は仮置きで、自社の問い合わせログと合わせて調整します。改善は層ごとに担当を分け、Visibility担当は第1・2層、Authority担当は第3層、Actionability担当は予約・購入完了率を追います。

## LIMITS｜言えること・言えないこと

このスタックは、AI推薦の因果や売上を証明するものではありません。層間の相関を見つけるための運用骨格です。ツールが増えても、質問設計・更新頻度・根拠の一貫性は自社データが必要です。単一ベンダーのスコアをそのまま予算判断に使うのは避けてください。

> **出典：** [Google Search Central「Search Generative AI performance reports」2026-06](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)／業界測定ギャップに関するフレームワーク統合（編集部整理）

## REPORTING TEMPLATE｜月次レポートの型

月次では、層ごとに次の一行サマリを固定します。Search Reach：主要URLのクリック推移±%。Answer Presence：定点質問セットでの出現率と文脈タグ。Citation Authority：引用URLの公式/第三者比率と誤り件数。Actionabilityは別表で、AI経由セッションの予約・購入完了率を記録します。四半期レビューで重みを更新し、改善施策は層単位でしか因果検証できない——という前提を経営に共有してください。

## TOOLING NOTE｜ツール選定の注意

ベンダースコアを第2層・第3層の代替にしないでください。質問セット・地域・モデル世代が異なると数値は比較不能です。GSC生成AIレポートはGoogle内の第1・2層の片側ログとして位置づけ、他AIは手動または自社Researchで補完します。
