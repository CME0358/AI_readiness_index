#!/usr/bin/env node
/** TMVU-01A PHASE 8 — strengthen weak Direct Answers (100–200 chars, priority slugs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSIGHTS = path.join(ROOT, 'insights');

/** @type {Record<string, string>} */
const DIRECT_ANSWERS = {
  'llms-txt':
    'llms.txtは、AI向けにサイト内の重要コンテンツを案内するテキストファイルです。ただし、設置するだけでAI検索や推薦が改善するわけではなく、構造化データ・信頼性・実行可能性などと組み合わせて評価する必要があります。',
  schema:
    'Schema.orgはページ内容の意味を機械可読で伝える構造化データ、llms.txtはAI向けのサイト案内ファイルです。競合ではなく役割が異なり、AIが企業を理解・比較・実行するには両方の設計が求められます。',
  'http-402':
    'HTTP 402は「支払いが必要」を示すステータスコードで、x402はAIエージェントが決済まで自律完結する方向の仕組みです。予約の次の関門は決済であり、Agent Commerce時代にはActionabilityの一部として求められます。',
  'ai-search-shift':
    'AI検索では、ユーザーが検索結果を比較するのではなく、エージェントが質問文脈に応じた候補を組み立てます。比較の主語が移るため、順位だけでなく根拠提示・実行可能性まで整える必要があります。',
  'recommendation-logic':
    'AIの「おすすめ」は単一の根拠ではなく、候補収集・情報検証・優先順位付け・行動接続の連なりで組み立てられます。各段階で企業情報の一貫性、信頼性、実行可能性が評価され、弱い段階があると候補から外れます。',
  'citation-vs-action':
    'AI回答に企業名が引用されること（Visibility/Authority）と、予約・購入が完了すること（Actionability）は別の成果です。GEOで引用されても、実行導線がなければAgent Readinessは完成しません。',
  book:
    'AIが予約できる会社は、空き状況・予約導線・条件が機械可読な状態を備えています。紹介されても予約完了まで進めない企業には、Actionability——実行面のAction Readiness——が欠けています。',
  pay:
    'AIが決済できる会社は、取引完了までの導線と条件が機械可読な状態を備えています。予約の次の関門は決済であり、Agent Commerce時代のActionabilityはここまで含みます。',
  reviews:
    'AIはレビューを星の平均だけでは比較しません。口コミの内容・分布・他チャネル情報との一貫性まで評価し、Authorityの一部として推薦可否の判断材料にします。星だけが高くても、内容や信頼シグナルが弱ければ推薦されにくくなります。',
};

for (const [slug, lead] of Object.entries(DIRECT_ANSWERS)) {
  const filePath = path.join(INSIGHTS, slug, 'index.html');
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">${lead}</p>`);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`OK ${slug} (${[...lead].length} chars)`);
}
