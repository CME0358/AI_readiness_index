## WHAT THE METRIC IS｜AIインプレッションとは

Google Search Consoleの生成AIパフォーマンスレポートは、SearchやDiscover上の生成AI機能において、サイトのURLが表示された回数をインプレッションとして記録します。[ヘルプセンター](https://support.google.com/webmasters/answer/16984139)（取得時点で公開確認に制限あり）および[2026年6月の公式ブログ](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)が一次説明です。クリックが発生しない露出もカウントされるため、従来のCTR前提とは読み方が異なります。

## WHY CLICKS MAY BE ZERO｜クリックがない理由

AI回答内に要約が完結すると、一覧やサイトへのクリックが発生しません。インプレッションは「AI機能内でURLが参照された」シグナルに近く、流入シグナルではありません。全体パフォーマンスのクリック減と生成AIインプレッション増が同時に起きても、単純な悪化とは限りません。比較は同URL・同期間で行い、クエリ集合の変化も確認します。

## HOW TO USE｜実務的な使い方

第一、ベースライン：過去28日の生成AIインプレッションと全体クリックを並べる。第二、URL別：インプレッション上位URLの本文が回答で正しく要約されるか手動確認。第三、国・デバイス別：地域サービスは国フィルタを必須に。第四、改善仮説：インプレッションはあるが引用文脈が不正確なURLをAuthority改善候補に。第五、Actionability：インプレッションURLから予約・購入に進めるかを別チェック。

## PAIR WITH HTML OBSERVATION｜軽量観測との併用

[HTML観測の限界](/insights/html-observation-check-limits/)で整理したように、公開HTMLの確認はAI回答の代替になりません。GSCはGoogle内の露出ログ、HTML観測はサイト側の材料確認——役割が異なります。両方を突き合わせ、「露出はあるが材料が不足」「材料はあるが露出がない」の象限に分類すると改善順序が明確になります。

## DASHBOARD DESIGN｜経営向けの見せ方

経営レポートでは、生成AIインプレッションを単独KPIにしないでください。セット指標は、(1)生成AIインプレッション（Visibility）(2)引用文脈の正確性サンプル監査（Authority）(3)AI経由セッションとコンバージョン（Actionability）です。未確定の推測値や他社ベンチマークを混ぜないことが重要です。

## LIMITS｜言えないこと

インプレッションはGoogle検索内の指標です。ChatGPT等の引用数は別データです。インプレッションから売上や推薦順位を推定することはできません。レポートは2026年に段階展開されたため、長期トレンドはデータ蓄積後に評価してください。

> **出典：** [Google Search Console Help「Generative AI performance reports」](https://support.google.com/webmasters/answer/16984139)（公開確認に制限あり）／[Google Search Central Blog 2026-06](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)

## EXPORT TIPS｜データエクスポートの実務

レポートから国・デバイス・ページをエクスポートし、BIツールで全体パフォーマンスとJOINします。クエリ粒度が公開されない場合、ページ粒度で代替します。インプレッション急増URLは、サーバーログで同時期のAI関連リファラを確認し、クリックレス露出と実流入の差を記録してください。

## FAQ FOR EXECUTIVES｜経営FAQ

「AIインプレッションが増えた＝成功か」→いいえ。要約の正確性と導線がセット。「クリックが減った＝失敗か」→いいえ。誤露出減の可能性もある。判断には手動サンプル監査が必要です。

## INTEGRATION WITH CHECK｜公開Checkとの接続

自社サイトの公開Checkで、インプレッション上位URLの比較情報・行動導線が揃っているかを確認します。GSCは「見えた」ログ、Checkは「材料があるか」の観測——両方が揃って初めて改善優先度を決められます。

## VERSION NOTE｜レポート更新

Googleはフィードバックに基づき追加メトリクスを検討しています。未提供の指標は推測で補完せず、公式更新を待ってテンプレートを改訂してください。
