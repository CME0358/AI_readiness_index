#!/usr/bin/env node
/**
 * TMVU-03 — Internal link validation, orphan analysis, ABIS protection checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  computeIncomingRelatedCounts,
  extractFixedCtaLinks,
  extractRelatedInsightLinks,
  getPublishedSlugsFromFilesystem,
  isProtectedInternalLinkSlug,
  loadSchedule,
  PROTECTED_INTERNAL_LINK_SLUGS,
  ROOT,
  selectRelatedInsights,
  TOPIC_FAMILIES,
  validateInternalLinks,
} from './lib/insights-related-links.mjs';
import { validateInsightSeo } from './lib/insights-seo-package.mjs';

const jsonOut = process.argv.includes('--json');
const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function readHtml(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function gitBlob(pathRel) {
  try {
    return execSync(`git show HEAD:${pathRel}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

const schedule = loadSchedule();
const publishedSlugs = getPublishedSlugsFromFilesystem();
const scheduledSlugs = fs
  .readdirSync(path.join(ROOT, 'insights/_scheduled'))
  .filter((d) => fs.statSync(path.join(ROOT, 'insights/_scheduled', d)).isDirectory())
  .sort();

/** @type {Record<string, { kind: string, related: string[], framework: boolean, research: boolean, report: boolean, protected: boolean }>} */
const audit = {};

function auditArticle(slug, kind, htmlPath, context) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const related = extractRelatedInsightLinks(html).map((r) => r.slug);
  const cta = extractFixedCtaLinks(html);
  audit[slug] = {
    kind,
    related,
    framework: cta.framework,
    research: cta.research,
    report: cta.report,
    protected: isProtectedInternalLinkSlug(slug),
  };
  errors.push(...validateInternalLinks(html, slug, { ...context, requireRelated: !isProtectedInternalLinkSlug(slug) }));
}

for (const slug of publishedSlugs) {
  auditArticle(slug, 'Published', path.join(ROOT, 'insights', slug, 'index.html'), { mode: 'published' });
}

for (const slug of scheduledSlugs) {
  const entry = schedule.articles.find((a) => a.slug === slug);
  auditArticle(slug, 'Scheduled', path.join(ROOT, 'insights/_scheduled', slug, 'index.html'), {
    mode: 'scheduled',
    publishAt: entry?.publishAt || null,
    schedule,
  });
}

for (const slug of PROTECTED_INTERNAL_LINK_SLUGS) {
  const rel = `insights/_scheduled/${slug}/index.html`;
  const htmlPath = path.join(ROOT, rel);
  if (!fs.existsSync(htmlPath)) {
    fail(`Protected ABIS missing: ${slug}`);
    continue;
  }
  const current = fs.readFileSync(htmlPath, 'utf8');
  const baseline = gitBlob(rel);
  if (baseline !== null && baseline !== current) {
    fail(`Protected ABIS content modified: ${slug}`);
  }
  if (current.includes('related-insights')) {
    fail(`Protected ABIS has related-insights section: ${slug}`);
  }
  const entry = schedule.articles.find((a) => a.slug === slug);
  if (entry) {
    const baselineSchedule = gitBlob('insights/_scheduled/schedule.json');
    if (baselineSchedule) {
      const baseJson = JSON.parse(baselineSchedule);
      const baseEntry = baseJson.articles.find((a) => a.slug === slug);
      if (baseEntry && (baseEntry.status !== entry.status || baseEntry.publishAt !== entry.publishAt)) {
        fail(`Protected ABIS schedule entry modified: ${slug}`);
      }
    }
  }
  const seoErrors = validateInsightSeo(current, slug, { scheduled: true });
  if (baseline !== null) {
    for (const key of ['<title>', 'name="description"', '<h1>', 'property="og:title"']) {
      const curHas = current.includes(key);
      const baseHas = baseline.includes(key);
      if (curHas !== baseHas) fail(`Protected ABIS SEO structure changed: ${slug}`);
    }
  }
  if (seoErrors.length && baseline === current) {
    // SEO package validation only when content unchanged from perspective
  }
}

for (const slug of publishedSlugs) {
  if (isProtectedInternalLinkSlug(slug)) continue;
  const html = readHtml(`insights/${slug}/index.html`);
  for (const link of extractRelatedInsightLinks(html)) {
    if (isProtectedInternalLinkSlug(link.slug)) fail(`Public → Protected ABIS link: ${slug} → ${link.slug}`);
  }
}

for (const slug of scheduledSlugs) {
  if (isProtectedInternalLinkSlug(slug)) continue;
  const html = readHtml(`insights/_scheduled/${slug}/index.html`);
  for (const link of extractRelatedInsightLinks(html)) {
    if (isProtectedInternalLinkSlug(link.slug)) fail(`Scheduled → Protected ABIS link: ${slug} → ${link.slug}`);
  }
}

for (const slug of [...publishedSlugs, ...scheduledSlugs]) {
  if (isProtectedInternalLinkSlug(slug)) continue;
  for (const rel of selectRelatedInsights(
    slug,
    publishedSlugs.includes(slug)
      ? { mode: 'published' }
      : {
          mode: 'scheduled',
          publishAt: schedule.articles.find((a) => a.slug === slug)?.publishAt || null,
          schedule,
        },
  )) {
    if (isProtectedInternalLinkSlug(rel.slug)) fail(`Related candidate output includes protected ABIS: ${slug} → ${rel.slug}`);
  }
}

const orphanCounts = computeIncomingRelatedCounts({ schedule });
/** @type {{ slug: string, incoming: number }[]} */
const orphans = [];
for (const slug of publishedSlugs) {
  if (isProtectedInternalLinkSlug(slug)) continue;
  const incoming = orphanCounts[slug] || 0;
  if (incoming === 0) orphans.push({ slug, incoming });
}

function simulatePublish(slug) {
  const src = path.join(ROOT, 'insights/_scheduled', slug, 'index.html');
  if (!fs.existsSync(src)) return { ok: false, reason: 'missing' };
  const entry = schedule.articles.find((a) => a.slug === slug);
  const html = fs.readFileSync(src, 'utf8');
  const linkErrors = validateInternalLinks(html, slug, {
    mode: 'scheduled',
    publishAt: entry?.publishAt || null,
    schedule,
  });
  const seoErrors = validateInsightSeo(html, slug, { scheduled: true });
  return { ok: linkErrors.length === 0 && seoErrors.length === 0, linkErrors, seoErrors };
}

const sim1 = simulatePublish('ari-vs-geo-seo');
const sim2 = simulatePublish('execution-readiness');
if (!sim1.ok) fail(`Publish simulation failed: ari-vs-geo-seo (${[...sim1.linkErrors, ...sim1.seoErrors].join('; ')})`);
if (!sim2.ok) fail(`Publish simulation failed: execution-readiness (${[...sim2.linkErrors, ...sim2.seoErrors].join('; ')})`);

const report = {
  ok: errors.length === 0,
  errors,
  warnings,
  audit,
  orphans,
  orphanCount: orphans.length,
  protectedSlugs: [...PROTECTED_INTERNAL_LINK_SLUGS].sort(),
  topicFamilies: TOPIC_FAMILIES,
  simulations: {
    'ari-vs-geo-seo': sim1,
    'execution-readiness': sim2,
  },
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`TMVU-03 validation: ${report.ok ? 'PASS' : 'FAIL'}`);
  console.log(`Published: ${publishedSlugs.length}, Scheduled: ${scheduledSlugs.length}`);
  console.log(`Orphan published non-ABIS insights: ${orphans.length}`);
  if (orphans.length) {
    console.log('Orphans:', orphans.map((o) => o.slug).join(', '));
  }
  if (errors.length) {
    console.error('\nErrors:');
    errors.forEach((e) => console.error(' -', e));
  }
  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach((w) => console.log(' -', w));
  }
}

process.exit(report.ok ? 0 : 1);
