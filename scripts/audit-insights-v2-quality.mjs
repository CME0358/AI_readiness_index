#!/usr/bin/env node
/**
 * Quality audit for v2 articles — template repetition, grading, fact flags.
 * Output: reports/v2-quality-audit.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './lib/insights-v2-paths.mjs';
import { charCountNoSpace } from './lib/business-days.mjs';

const content = JSON.parse(fs.readFileSync(PATHS.articlesContent, 'utf8'));
const plan = JSON.parse(fs.readFileSync(PATHS.editorialPlan, 'utf8'));

const BOILERPLATE_MARKERS = [
  '## 論点の整理',
  '## なぜ今問題になるのか',
  '## 背景にある構造',
  '## 企業が準備すべきこと',
  '## 次の一手',
  '## 実務チェック',
  '## 情報設計の原則',
  '定点観測と更新ログの運用が、Readiness改善の出発点になります',
  '施策を増やしてもAIに選ばれない理由は、情報の連続性の欠如にあることがあります',
  '多くの企業はWeb施策を積み上げてきましたが、AIに質問されたとき自社が候補に上がらない違和感が広がっています',
];

const TEMPLATE_INTRO = '多くの企業はWeb施策を積み上げてきましたが';

function first300(text) {
  return text.replace(/\s/g, '').slice(0, 300);
}

function countMarkers(body) {
  return BOILERPLATE_MARKERS.filter((m) => body.includes(m)).length;
}

function gradeArticle(a, planEntry, allFirst300) {
  const markers = countMarkers(a.body);
  const f300 = first300(a.body);
  const dupIntro = (allFirst300.filter((x) => x === f300).length > 1);
  const repeatTail = (a.body.match(/定点観測と更新ログの運用が/g) || []).length;
  const duplicateH2 = /## まとめ[\s\S]*## まとめ/.test(a.body);
  const slugInBody = a.body.includes(`${a.slug}の要点は`);
  const category = planEntry?.category || a.category;

  let verdict = 'PASS';
  const reasons = [];

  if (markers >= 5 || slugInBody) {
    verdict = 'REWRITE';
    reasons.push('テンプレート骨格（論点の整理/企業が準備すべきこと等）が支配的');
  }
  if (repeatTail >= 3) {
    verdict = verdict === 'PASS' ? 'REVISE' : verdict;
    reasons.push(`末尾の定型文が${repeatTail}回反復`);
  }
  if (duplicateH2) {
    verdict = verdict === 'PASS' ? 'REVISE' : verdict;
    reasons.push('「まとめ」H2が重複');
  }
  if (dupIntro && category !== 'AI Search') {
    if (verdict === 'PASS') verdict = 'REVISE';
    reasons.push('導入300字が他記事と同一');
  }

  // AI Search first 4 are more unique
  if (category === 'AI Search' && a.slug !== 'ai-search-shift' && markers <= 2 && !repeatTail) {
    if (verdict === 'REWRITE') verdict = 'REVISE';
  }
  if (a.slug === 'ai-search-shift' && duplicateH2) {
    verdict = 'REVISE';
    reasons.push('比較設計チェックとまとめの重複');
  }

  if (category === 'ABISへの導入') {
    if (/採択済み|国際標準として既に/.test(a.body) && !/ではなく|ではない|断定せず/.test(a.body)) {
      verdict = 'REVISE';
      reasons.push('ABIS表現要確認');
    }
  }

  const n = charCountNoSpace(a.body);
  if (n < 2000 || n > 2700) {
    if (verdict === 'PASS') verdict = 'REVISE';
    reasons.push(`文字数 ${n}（目標2000-2700）`);
  }

  if (reasons.length === 0) {
    reasons.push('テーマ固有の構成が主体で公開可能');
  }

  return { verdict, reasons, markers, charCount: n, repeatTail };
}

const allFirst300 = content.articles.map((a) => first300(a.body));
const results = content.articles.map((a) => {
  const planEntry = plan.articles.find((p) => p.slug === a.slug);
  const g = gradeArticle(a, planEntry, allFirst300);
  return {
    slug: a.slug,
    title: a.title,
    category: planEntry?.category || a.category,
    ...g,
  };
});

const counts = { PASS: 0, REVISE: 0, REWRITE: 0, REJECT: 0 };
for (const r of results) counts[r.verdict]++;

// Repetition clusters
const introClusters = {};
for (const a of content.articles) {
  const key = first300(a.body);
  introClusters[key] = (introClusters[key] || []).concat(a.slug);
}
const repetitionClusters = Object.entries(introClusters)
  .filter(([, slugs]) => slugs.length > 1)
  .map(([k, slugs]) => ({ slugs, sample: k.slice(0, 80) }));

const out = {
  generatedAt: new Date().toISOString(),
  counts,
  repetitionClusters,
  articles: results,
};

fs.mkdirSync(PATHS.reportsDir, { recursive: true });
fs.writeFileSync(path.join(PATHS.reportsDir, 'v2-quality-audit.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Counts:', counts);
console.log('Written:', path.join(PATHS.reportsDir, 'v2-quality-audit.json'));
