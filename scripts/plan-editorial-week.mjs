#!/usr/bin/env node
/**
 * Report-only weekly editorial mix planner. It never publishes or mutates schedule.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './lib/insights-v2-paths.mjs';
import {
  EDITORIAL_INTENTS,
  classifyEditorialIntent,
  countEditorialIntents,
  ctaIntentProfile,
  planWeeklyEditorialMix,
} from './lib/editorial-intent.mjs';

const args = process.argv.slice(2);
const writeGapReport = args.includes('--write-gap-report');
const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
const articles = schedule.articles || [];
const future = articles.filter((article) => ['scheduled', 'editorial_hold', 'ready_for_schedule'].includes(article.status));
const counts = countEditorialIntents(future);
const plan = planWeeklyEditorialMix(future, { slots: 5 });
const available = Object.values(counts).reduce((sum, value) => sum + value, 0);
const output = {
  generatedAt: new Date().toISOString(),
  inventory: {
    published: articles.filter((article) => article.status === 'published').length,
    scheduled: articles.filter((article) => article.status === 'scheduled').length,
    editorialHold: articles.filter((article) => article.status === 'editorial_hold').length,
    eligibleFuture: future.length,
    counts,
  },
  weeklyMixCapacity: plan.status === 'EDITORIAL_MIX_TARGET_MET' ? 'FULL' : 'DEGRADED',
  plan: {
    target: plan.target,
    status: plan.status,
    missing: plan.missing,
    slots: plan.selected.map((article, index) => ({
      weekday: ['MON', 'TUE', 'WED', 'THU', 'FRI'][index] || `SLOT_${index + 1}`,
      slug: article.slug,
      title: article.title || article.slug,
      editorialIntent: classifyEditorialIntent(article),
      primaryCta: ctaIntentProfile(classifyEditorialIntent(article))[0].type,
      secondaryCta: ctaIntentProfile(classifyEditorialIntent(article))[1].type,
      sourceArticle: article.slug,
      newDraftRequired: false,
    })),
  },
  available,
};

console.log(JSON.stringify(output, null, 2));

if (writeGapReport) {
  const missing = plan.missing.length
    ? plan.missing.map(({ intent, missing: count }) => `- ${intent}: ${count}本不足`).join('\n')
    : '- なし';
  const slots = plan.selected.map((article, index) => {
    const intent = classifyEditorialIntent(article);
    const [primary, secondary] = ctaIntentProfile(intent);
    return `| ${['月', '火', '水', '木', '金'][index] || `slot${index + 1}`} | ${intent} | ${article.title || article.slug} | ${article.slug} | ${primary.type} / ${secondary.type} | no |`;
  }).join('\n');
  const report = `# Phase 9D Editorial Gap Report\n\nGenerated: ${output.generatedAt}\n\nThis is a planning report only. No content was published and no schedule was changed.\n\n## Future inventory\n\n- Published: ${output.inventory.published}\n- Scheduled: ${output.inventory.scheduled}\n- Editorial hold: ${output.inventory.editorialHold}\n- Eligible future pool: ${output.inventory.eligibleFuture}\n\n| Intent | Available |\n| --- | ---: |\n${Object.entries(counts).map(([intent, count]) => `| ${intent} | ${count} |`).join('\n')}\n\n## Weekly target\n\n- 3 PROBLEM_AWARE\n- 1 EVIDENCE\n- 1 NEWS\n\nCapacity: **${output.weeklyMixCapacity}**\n\nMissing inventory:\n${missing}\n\n## Proposed next full week\n\n| Day | Intent | Working title | Source article | Primary / secondary CTA | Draft required |\n| --- | --- | --- | --- | --- | --- |\n${slots}\n\nBecause the current pool is insufficient, the selector degrades to the best available eligible content and records the missing categories. New drafts are not created automatically.\n`;
  const reportPath = path.join(process.cwd(), 'reports/phase9d-editorial-gap.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.error(`Wrote ${reportPath}`);
}
