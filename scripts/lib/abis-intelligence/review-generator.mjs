import fs from 'node:fs';
import path from 'node:path';
import { ABIS_INTELLIGENCE_PATHS } from './paths.mjs';

export function generateAbisReviewMarkdown(event, impact, { ari_article_status = 'UNKNOWN' } = {}) {
  const lines = [
    '---',
    'visibility: PRIVATE',
    'abis_intelligence: true',
    `event_id: ${impact.event_id}`,
    `company: ${impact.company}`,
    `source_url: ${impact.source_url}`,
    `source_date: ${impact.source_date || 'UNKNOWN'}`,
    `abis_impact_score: ${impact.abis_impact_score}`,
    `severity: ${impact.severity}`,
    `recommended_action: ${impact.recommended_action}`,
    `confidence: ${impact.confidence}`,
    `ari_article_status: ${ari_article_status}`,
    `binding_only_change: ${impact.binding_only_change}`,
    `created_at: ${new Date().toISOString()}`,
    '---',
    '',
    `# PRIVATE ABIS Impact Review — ${event.title}`,
    '',
    '> **INTERNAL ONLY** — Not for public Insights, SEO, sitemap, llms.txt, or public_build.',
    '',
    '## Source',
    '',
    `- Company: ${impact.company}`,
    `- URL: ${impact.source_url}`,
    `- Published: ${impact.source_date || 'UNKNOWN'}`,
    '',
    '## ABIS Impact Score',
    '',
    `**${impact.abis_impact_score}/100** · Severity: **${impact.severity}**`,
    '',
    '### Dimension Breakdown',
    '',
    `- Semantic Model: ${impact.semantic_impact}/25`,
    `- Authority / Authorization: ${impact.authority_impact}/20`,
    `- Interaction / Execution: ${impact.interaction_execution_impact}/20`,
    `- Evidence / Outcome: ${impact.evidence_outcome_impact}/15`,
    `- Binding / Ecosystem: ${impact.binding_ecosystem_impact}/10`,
    `- Standardization / Patent relevance: ${impact.standardization_patent_relevance}/10`,
    '',
    '## Affected Areas (suggestion only)',
    '',
    ...impact.affected_areas.map((a) => `- ${a}`),
    '',
    '## Reasoning Summary',
    '',
    impact.reasoning_summary,
    '',
    '## Recommended Action',
    '',
    impact.recommended_action,
    '',
    '## Patent / Standards Flags',
    '',
  ];

  if (impact.patent_flags?.length) {
    for (const f of impact.patent_flags) lines.push(`- ${f}`);
    lines.push('', '*No infringement, patentability, or FTO conclusions.*');
  } else {
    lines.push('- (none)');
  }

  lines.push(
    '',
    '## ARI Editorial Status (reference only)',
    '',
    ari_article_status,
    '',
    '---',
    '',
    '<!-- PRIVATE ABIS Impact Watch · NOT FOR PUBLICATION -->',
    '',
  );

  return lines.join('\n');
}

export function writeAbisReview(event, impact, options = {}) {
  fs.mkdirSync(ABIS_INTELLIGENCE_PATHS.reviewsDir, { recursive: true });
  const reviewPath = path.join(ABIS_INTELLIGENCE_PATHS.reviewsDir, `${impact.event_id}.md`);
  fs.writeFileSync(reviewPath, generateAbisReviewMarkdown(event, impact, options));
  return reviewPath;
}
