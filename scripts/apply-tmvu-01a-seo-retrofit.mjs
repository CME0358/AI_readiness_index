#!/usr/bin/env node
/**
 * TMVU-01A — Existing Insights SEO Package Retrofit
 * Updates title, meta, OG, Twitter, H1, lead, JSON-LD headline/description only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INSIGHTS = path.join(ROOT, 'insights');

/** @type {Record<string, { intent: 'A'|'B'|'C', h1: string, titleSuffix: string, meta: string, lead: string, breadcrumb: string }>} */
const PACKAGES = {
  act: {
    intent: 'B',
    h1: 'AIのActionabilityとは？エージェントが企業を比較する基準',
    titleSuffix: 'AIのActionabilityとは？エージェントが企業を比較する基準',
    meta: 'ActionabilityはAIが予約・問い合わせ・決済まで進められる状態。料金・空き・導線など実行面の比較基準を、Agent Readinessの観点から解説します。',
    lead: 'Actionabilityとは、AIエージェントが企業を比較し、予約・問い合わせ・決済まで実行できる状態を指す。理解と信頼の先にある「実行」の比較基準を整理する。',
    breadcrumb: 'Actionability',
  },
  'ai-search-shift': {
    intent: 'A',
    h1: 'AI検索で「比較」はどう変わる？順位以外の評価軸',
    titleSuffix: 'AI検索で「比較」はどう変わる？順位以外の評価軸',
    meta: 'AI検索では比較の主語がユーザーからエージェントへ移る。候補形成・根拠提示・実行可能性など、順位以外の評価軸をAgent Readinessの視点で解説します。',
    lead: 'AI検索では、ユーザーが一覧を比較するのではなく、エージェントが候補を組み立てて説明する。比較の主語が移ると、企業に求められる情報設計も変わる。',
    breadcrumb: 'AI検索と比較',
  },
  auth: {
    intent: 'B',
    h1: 'Authorityとは？AIが企業を信頼する根拠',
    titleSuffix: 'Authorityとは？AIが企業を信頼する根拠',
    meta: 'AIが企業を推薦するうえでのAuthority（信頼の根拠）。一貫性・第三者情報・専門性など、Agent Readinessで整理する評価軸を解説します。',
    lead: 'Authorityとは、AIが安心して企業を紹介できる信頼の根拠を指す。見つけてもらえただけでは推薦されない——信頼の設計が次の課題になる。',
    breadcrumb: 'Authority',
  },
  blind: {
    intent: 'B',
    h1: 'AIに会社が出ない原因5つ｜Visibilityを阻害する要因',
    titleSuffix: 'AIに会社が出ない原因5つ｜Visibilityを阻害する要因',
    meta: 'サイトがあるのにAIに認識されない5つの原因。情報の分散・矛盾・構造化不足など、Visibilityを阻害するポイントと改善の方向性を解説します。',
    lead: 'サイトがあるのにAIに出てこない——その多くは偶然ではなく、Visibilityを阻害する設計上の原因がある。主な5つを整理する。',
    breadcrumb: 'Visibility阻害',
  },
  book: {
    intent: 'A',
    h1: 'AIが予約できる会社とできない会社の違い',
    titleSuffix: 'AIが予約できる会社とできない会社の違い',
    meta: 'AIエージェントが予約を完結できる会社とそうでない会社の差。空き状況・予約導線・機械可読な条件など、Actionabilityの実行面を解説します。',
    lead: 'AIが予約できる会社とできない会社の差は、空き・導線・条件の機械可読性にある。紹介できても予約できなければ、エージェントの仕事は途中で止まる。',
    breadcrumb: 'AI予約',
  },
  checklist: {
    intent: 'B',
    h1: 'AIに見つけてもらうチェックリスト｜Visibility改善',
    titleSuffix: 'AIに見つけてもらうチェックリスト｜Visibility改善',
    meta: 'AIに見つけてもらえる企業の共通点と、Visibilityを高める実践チェックリスト。情報設計・構造化・一貫性の観点で自社を点検できます。',
    lead: 'AIに見つけてもらえる企業には共通点がある。Visibilityを高めるための実践チェックリストで、自社の情報設計を点検する。',
    breadcrumb: 'Visibilityチェック',
  },
  'citation-vs-action': {
    intent: 'B',
    h1: 'AI回答で「引用される」と「実行される」の違い',
    titleSuffix: 'AI回答で「引用される」と「実行される」の違い',
    meta: 'AI回答に名前が出る引用と、予約・購入が完了する実行は別の成果。GEOの引用とAgent Readinessの実行が異なる段階である理由を解説します。',
    lead: 'AI回答に名前が出ること（引用）と、予約・購入が完了すること（実行）は別の成果。両者を混同すると、施策の優先順位がずれる。',
    breadcrumb: '引用と実行',
  },
  'competitor-blind-spot': {
    intent: 'C',
    h1: 'AI時代に競合分析が見えなくなる理由',
    titleSuffix: 'AI時代に競合分析が見えなくなる理由',
    meta: '固定の競合3社ベンチマークがAI検索では通用しなくなる理由。比較セットが質問文脈ごとに変わる事実と、新しい分析手法を解説します。',
    lead: '業界カテゴリから決めた競合3社のベンチマークは、AI検索では通用しなくなる。比較セットは質問文脈ごとに動的に変わるからだ。',
    breadcrumb: '競合分析の限界',
  },
  exec: {
    intent: 'B',
    h1: 'SEO・GEOの先にあるAgent Readinessとは',
    titleSuffix: 'SEO・GEOの先にあるAgent Readinessとは',
    meta: 'SEOからGEO、そしてAgent Readinessへ。AIが検索する存在から実行する存在へ移るなかで、企業が整えるべきVisibility・Authority・Actionabilityを解説します。',
    lead: 'Webの入口は検索からAIへ、ゴールは情報提供から実行へ移り始めている。SEOもGEOも重要だが、その先にあるのがAgent Readiness——理解・比較・推薦・実行までを評価する基準だ。',
    breadcrumb: '検索から実行へ',
  },
  files: {
    intent: 'A',
    h1: 'robots.txt・sitemap・llms.txtの違いと役割',
    titleSuffix: 'robots.txt・sitemap・llms.txtの違いと役割',
    meta: 'robots.txt、sitemap.xml、llms.txtの役割の違いと、AIが企業を理解するために見ている情報。3ファイルだけでは足りない理由を整理します。',
    lead: '「AI対応ならllms.txtだけで十分」は誤解だ。robots.txt・sitemap.xml・llms.txtは役割が異なり、AIは複数の情報を組み合わせて企業を理解する。',
    breadcrumb: 'robots / sitemap / llms.txt',
  },
  grounds: {
    intent: 'A',
    h1: 'llms.txtだけではAIに推薦されない理由',
    titleSuffix: 'llms.txtだけではAIに推薦されない理由',
    meta: 'llms.txtやSchema.orgを置いても推薦されない理由。AIが企業を選ぶ根拠——一貫性・エンティティ・第三者情報・実行可能性——を解説します。',
    lead: 'llms.txtを設置しても、それだけではAIに推薦される根拠にはならない。AIは一貫性・エンティティ・第三者情報・実行可能性まで含めて「紹介してよいか」を判断する。',
    breadcrumb: '推薦の根拠',
  },
  'http-402': {
    intent: 'A',
    h1: 'HTTP 402とx402｜AI決済が示すAgent Commerce',
    titleSuffix: 'HTTP 402とx402｜AI決済が示すAgent Commerce',
    meta: 'HTTP 402とx402が示すAI決済の流れ。予約から決済までAIが自律完結する時代に、企業が備えるべきActionabilityの視点を解説します。',
    lead: 'AIが予約の次に取り組むのは決済だ。HTTP 402とx402は、エージェントが取引を完結させるインターネットの方向を示している。',
    breadcrumb: 'HTTP 402とx402',
  },
  'llms-txt': {
    intent: 'A',
    h1: 'llms.txtとは？AI検索対策に必要かを解説',
    titleSuffix: 'llms.txtとは？AI検索対策に必要かを解説',
    meta: 'llms.txtの役割、robots.txtやsitemapとの違い、AI検索にどこまで有効かを解説。設置だけでは不十分な理由をAgent Readinessの観点から整理します。',
    lead: 'llms.txtはAI向けのサイト案内ファイルだが、設置するだけでは引用・推薦の根拠にはならない。役割と限界を整理したうえで、本当に必要な情報設計を考える。',
    breadcrumb: 'llms.txt',
  },
  pay: {
    intent: 'A',
    h1: 'AIが決済できる会社とできない会社の違い',
    titleSuffix: 'AIが決済できる会社とできない会社の違い',
    meta: 'AIエージェントが決済・取引完了まで進める会社とそうでない会社の差。Agent Commerce時代に求められるActionabilityを解説します。',
    lead: '予約の次は決済。AIが最後まで取引を完了できる企業だけが、Agent Commerce時代の競争力を持つ——その差は何から生まれるか。',
    breadcrumb: 'AI決済',
  },
  price: {
    intent: 'A',
    h1: 'AIは価格をどう理解する？比較可能な料金設計',
    titleSuffix: 'AIは価格をどう理解する？比較可能な料金設計',
    meta: 'AIが価格を理解・比較する仕組み。「料金が書いてある」だけでは足りない理由と、比較可能な価格情報の設計を解説します。',
    lead: '料金ページがあるだけでは、AIは価格を比較できない。条件・単位・例外が機械可読になって初めて、Actionabilityの一部になる。',
    breadcrumb: 'AIと価格',
  },
  'recommendation-logic': {
    intent: 'A',
    h1: 'AIの「おすすめ」はどう組み立てられる？',
    titleSuffix: 'AIの「おすすめ」はどう組み立てられる？',
    meta: 'AIがおすすめを組み立てるプロセス——候補収集・情報検証・優先順位付け・行動接続——を分解し、各段階で何が問われるかを解説します。',
    lead: 'AIの「おすすめ」は一瞬の回答ではなく、候補収集・検証・優先順位付け・行動接続の連なりだ。各段階で企業情報が評価される。',
    breadcrumb: 'AI推薦の仕組み',
  },
  reviews: {
    intent: 'A',
    h1: 'AIはレビューをどう比較する？星の数だけでは足りない',
    titleSuffix: 'AIはレビューをどう比較する？星の数だけでは足りない',
    meta: 'AIがレビューを比較する際の評価軸。星の平均だけでは決まらない理由と、信頼できる評価シグナルの見方を解説します。',
    lead: '星の平均だけでは、AIは企業を推薦しない。レビューの内容・分布・一貫性まで含めて比較している。',
    breadcrumb: 'AIとレビュー',
  },
  schema: {
    intent: 'A',
    h1: 'Schema.orgとllms.txt、AIはどちらを重視する？',
    titleSuffix: 'Schema.orgとllms.txt、AIはどちらを重視する？',
    meta: 'Schema.orgとllms.txtの役割の違い。AIが企業を理解・比較・実行するために、どちらをどう位置づけるべきかを解説します。',
    lead: 'Schema.orgとllms.txtは競合ではない。入口を案内するのがllms.txt、意味を機械可読で伝えるのがSchema.org——AIエージェント時代の優先順位を整理する。',
    breadcrumb: 'Schema.orgとllms.txt',
  },
  trust: {
    intent: 'B',
    h1: 'レビュー以外にAIが見る「信頼の証拠」',
    titleSuffix: 'レビュー以外にAIが見る「信頼の証拠」',
    meta: '星や口コミだけではAuthorityは完成しない。第三者掲載・一貫性・専門性など、AIが本当に見ている信頼の証拠を解説します。',
    lead: '星の数や口コミだけではAuthorityは完成しない。AIが本当に見ている信頼の証拠は、もっと広い——レビューの先にある評価軸を整理する。',
    breadcrumb: '信頼の証拠',
  },
  vis: {
    intent: 'B',
    h1: 'Visibilityとは？AIが企業を見つける仕組み',
    titleSuffix: 'Visibilityとは？AIが企業を見つける仕組み',
    meta: 'Agent ReadinessのVisibilityとは、AIが企業情報を認識・到達できる状態。AIに選ばれる前の入口として、見つけてもらうための設計を解説します。',
    lead: 'Visibilityとは、AIが企業情報を認識し、到達できる状態を指す。AIに選ばれる前に、まず見つけてもらえるかが入口になる。',
    breadcrumb: 'Visibility',
  },
  'why-ari': {
    intent: 'B',
    h1: 'なぜAgent Readinessが企業評価の新基準になるのか',
    titleSuffix: 'なぜAgent Readinessが企業評価の新基準になるのか',
    meta: '検索順位だけでは測れないAI時代の企業評価。Visibility・Authority・Actionabilityが揃った企業だけが満たす、Agent Readinessという新基準を解説します。',
    lead: '検索順位だけでは、AI時代の企業競争力は測れない。Visibility・Authority・Actionabilityが揃った企業だけが、新しい評価基準を満たす——それがAgent Readinessだ。',
    breadcrumb: 'なぜAgent Readinessか',
  },
  wrong: {
    intent: 'B',
    h1: 'AIは矛盾した情報をどう扱う？Authorityを失う共通点',
    titleSuffix: 'AIは矛盾した情報をどう扱う？Authorityを失う共通点',
    meta: 'AIが矛盾・古い情報をどう扱うか。Authorityを失う企業の共通パターンと、信頼を守るための情報一貫性の考え方を整理します。',
    lead: '矛盾した情報は、AIにとって「紹介を避ける理由」になる。Authorityを失う企業には、情報の不整合という共通パターンがある。',
    breadcrumb: '矛盾した情報',
  },
  zentoshin: {
    intent: 'C',
    h1: '全東信倒産が示すAI時代の「決済できる企業」',
    titleSuffix: '全東信倒産が示すAI時代の「決済できる企業」',
    meta: '全東信倒産から見る決済インフラと企業信用。AIに推薦されても決済できなければ売上は生まれない——Agent Readinessの視点で信用設計を解説します。',
    lead: '全東信の倒産は、決済インフラと企業信用の重要性を改めて示した。AIに選ばれても決済・信用設計が整っていなければ、事業は成長しない。',
    breadcrumb: '全東信と決済',
  },
};

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function socialBlock(slug, titleSuffix, meta) {
  const url = `https://readiness.coaretail.com/insights/${slug}/`;
  return `<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(titleSuffix)}">
<meta property="og:description" content="${escapeHtml(meta)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Agent Readiness Research Hub">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(titleSuffix)}">
<meta name="twitter:description" content="${escapeHtml(meta)}">`;
}

function applyPackage(slug, pkg) {
  const filePath = path.join(INSIGHTS, slug, 'index.html');
  if (!fs.existsSync(filePath)) {
    console.warn(`SKIP missing: ${slug}`);
    return false;
  }

  let html = fs.readFileSync(filePath, 'utf8');
  const pageTitle = `${pkg.titleSuffix} | Agent Readiness Insights`;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(pageTitle)}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(pkg.meta)}">`,
  );

  if (html.includes('property="og:title"')) {
    html = html.replace(/<meta property="og:type" content="[^"]*">\n?/g, '');
    html = html.replace(/<meta property="og:title" content="[^"]*">\n?/g, '');
    html = html.replace(/<meta property="og:description" content="[^"]*">\n?/g, '');
    html = html.replace(/<meta property="og:url" content="[^"]*">\n?/g, '');
    html = html.replace(/<meta property="og:site_name" content="[^"]*">\n?/g, '');
    html = html.replace(/<meta name="twitter:card" content="[^"]*">\n?/g, '');
    html = html.replace(/<meta name="twitter:title" content="[^"]*">\n?/g, '');
    html = html.replace(/<meta name="twitter:description" content="[^"]*">\n?/g, '');
  }

  html = html.replace(
    /(<link rel="canonical" href="[^"]+">)/,
    `$1\n${socialBlock(slug, pkg.titleSuffix, pkg.meta)}`,
  );

  html = html.replace(/"headline": "[^"]*"/, `"headline": ${JSON.stringify(pkg.h1)}`);
  html = html.replace(/"description": "[^"]*"/, `"description": ${JSON.stringify(pkg.meta)}`);

  html = html.replace(/<h1>[^<]*<\/h1>/, `<h1>${escapeHtml(pkg.h1)}</h1>`);
  html = html.replace(/<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">${escapeHtml(pkg.lead)}</p>`);

  html = html.replace(
    /(<nav class="breadcrumb"[\s\S]*?<span>)[^<]+(<\/span>\s*<\/nav>)/,
    `$1${escapeHtml(pkg.breadcrumb)}$2`,
  );

  fs.writeFileSync(filePath, html, 'utf8');
  return true;
}

const slugs = fs
  .readdirSync(INSIGHTS)
  .filter((d) => {
    const p = path.join(INSIGHTS, d);
    return fs.statSync(p).isDirectory() && !d.startsWith('_') && fs.existsSync(path.join(p, 'index.html'));
  })
  .sort();

let updated = 0;
for (const slug of slugs) {
  const pkg = PACKAGES[slug];
  if (!pkg) {
    console.warn(`WARN no package for slug: ${slug}`);
    continue;
  }
  if (applyPackage(slug, pkg)) {
    updated += 1;
    console.log(`OK ${slug} [${pkg.intent}]`);
  }
}

console.log(`\nUpdated ${updated}/${slugs.length} published insights.`);
