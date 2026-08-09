#!/usr/bin/env node
/**
 * RMVU-05C — Distributed Research Footprint Pilot tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';
import { loadSchedule } from '../lib/insights-related-links.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DRAFT_ROOT = path.join(ROOT, 'crucial_data/organic/rmvu05c');
const REGISTRY = path.join(ROOT, 'reports/RMVU-05C Distributed Research Footprint Registry.md');

const ASSET_IDS = [
  'RMVU05C-T1-GDOC',
  'RMVU05C-T1-LINKEDIN',
  'RMVU05C-T1-PDF',
  'RMVU05C-T2-GDOC',
  'RMVU05C-T2-LINKEDIN',
  'RMVU05C-T2-PDF',
  'RMVU05C-T3-GDOC',
  'RMVU05C-T3-LINKEDIN',
  'RMVU05C-T3-PDF',
];

const THEME_FILES = [
  ['theme-1', 'google-doc.md'],
  ['theme-1', 'linkedin.md'],
  ['theme-1', 'pdf-brief.md'],
  ['theme-2', 'google-doc.md'],
  ['theme-2', 'linkedin.md'],
  ['theme-2', 'pdf-brief.md'],
  ['theme-3', 'google-doc.md'],
  ['theme-3', 'linkedin.md'],
  ['theme-3', 'pdf-brief.md'],
];

const CANONICAL_URLS = {
  'theme-1': 'https://readiness.coaretail.com/insights/blind/',
  'theme-2': 'https://readiness.coaretail.com/insights/readiness-baseline/',
  'theme-3': 'https://readiness.coaretail.com/insights/ari-vs-geo-seo/',
};

function readDraft(theme, file) {
  return fs.readFileSync(path.join(DRAFT_ROOT, theme, file), 'utf8');
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return fm;
}

function allDrafts() {
  return THEME_FILES.map(([theme, file]) => ({
    theme,
    file,
    path: path.join(DRAFT_ROOT, theme, file),
    content: readDraft(theme, file),
    fm: parseFrontmatter(readDraft(theme, file)),
  }));
}

test('RMVU-05C T01 9 draft assets exist', () => {
  for (const [theme, file] of THEME_FILES) {
    assert.ok(fs.existsSync(path.join(DRAFT_ROOT, theme, file)), `${theme}/${file}`);
  }
});

test('RMVU-05C T02 3 themes × 3 formats', () => {
  for (const t of ['theme-1', 'theme-2', 'theme-3']) {
    assert.ok(fs.existsSync(path.join(DRAFT_ROOT, t, 'google-doc.md')));
    assert.ok(fs.existsSync(path.join(DRAFT_ROOT, t, 'linkedin.md')));
    assert.ok(fs.existsSync(path.join(DRAFT_ROOT, t, 'pdf-brief.md')));
  }
});

test('RMVU-05C T03 each asset has canonical URL', () => {
  for (const draft of allDrafts()) {
    const expected = CANONICAL_URLS[draft.theme];
    assert.equal(draft.fm.canonical_url, expected, draft.path);
    assert.match(draft.content, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('RMVU-05C T04 each asset has first-party source/evidence', () => {
  for (const draft of allDrafts()) {
    assert.match(draft.content, /readiness\.coaretail\.com\/research/);
    assert.match(draft.content, /readiness\.coaretail\.com\/evidence|Evidence Library|Evidence/);
  }
});

test('RMVU-05C T05 Company Report links only where contextually appropriate', () => {
  const drafts = allDrafts();
  // Theme 1 & 2 (money-adjacent): all formats should bridge to report
  for (const theme of ['theme-1', 'theme-2']) {
    for (const d of drafts.filter((x) => x.theme === theme)) {
      assert.match(d.content, /readiness\.coaretail\.com\/report/, d.path);
    }
  }
  // Theme 3 google-doc and pdf have contextual bridge; linkedin uses research only
  const t3LinkedIn = drafts.find((d) => d.theme === 'theme-3' && d.file === 'linkedin.md');
  assert.doesNotMatch(t3LinkedIn.content, /自社の改善優先順位を確認する/);
  assert.match(t3LinkedIn.content, /readiness\.coaretail\.com\/research/);
});

test('RMVU-05C T06 UTM parameters valid', () => {
  const expected = {
    'google-doc.md': { source: 'google_docs', medium: 'referral' },
    'linkedin.md': { source: 'linkedin', medium: 'organic_social' },
    'pdf-brief.md': { source: 'pdf', medium: 'referral' },
  };
  for (const draft of allDrafts()) {
    const exp = expected[draft.file];
    assert.equal(draft.fm.utm_source, exp.source, draft.path);
    assert.equal(draft.fm.utm_medium, exp.medium, draft.path);
    assert.equal(draft.fm.utm_campaign, 'rmvu05c', draft.path);
    assert.match(draft.content, /utm_campaign=rmvu05c/);
  }
});

test('RMVU-05C T07 no protected ABIS strings', () => {
  const blocked = ['ABIS', 'Agent Business Interaction Standard', ...PROTECTED_ABIS_SLUGS];
  for (const draft of allDrafts()) {
    for (const term of blocked) {
      assert.doesNotMatch(draft.content, new RegExp(term, 'i'), `${draft.path}: ${term}`);
    }
  }
});

test('RMVU-05C T08 no protected slugs in draft links', () => {
  for (const slug of PROTECTED_ABIS_SLUGS) {
    for (const draft of allDrafts()) {
      assert.doesNotMatch(draft.content, new RegExp(`/insights/${slug}/`));
    }
  }
});

test('RMVU-05C T09 no fake Research metrics', () => {
  const allowedNumbers = ['100', '231', '5.5', '97.8', '15.6', '5'];
  for (const draft of allDrafts()) {
    // Must not invent large round stats not in repo
    assert.doesNotMatch(draft.content, /当社調査では、\d{4,}件/);
    assert.doesNotMatch(draft.content, /\d{2,}%改善/);
    if (draft.content.includes('231')) {
      assert.match(draft.content, /5業種|Evidence|Research/);
    }
  }
});

test('RMVU-05C T10 no standalone Research Edition purchase CTA', () => {
  for (const draft of allDrafts()) {
    assert.doesNotMatch(draft.content, /buy\.stripe\.com/);
    assert.doesNotMatch(draft.content, /Research Edition.*購入/);
    assert.doesNotMatch(draft.content, /¥29,800.*単体.*Research/i);
  }
});

test('RMVU-05C T11 ARI positioning matches RMVU-04F', () => {
  for (const draft of allDrafts()) {
    assert.doesNotMatch(draft.content, /Technical Readiness Scanner/i);
    if (draft.theme === 'theme-3') {
      assert.match(draft.content, /Business|Recommendation|理解・比較・推薦/);
    }
  }
  const t1 = readDraft('theme-1', 'google-doc.md');
  assert.match(t1, /Discovery|Recommendation|Action/);
});

test('RMVU-05C T12 no Stripe modification in RMVU-05C scope', () => {
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'), /rmvu05c.*stripe/i);
  for (const draft of allDrafts()) {
    assert.doesNotMatch(draft.content, /STRIPE_/);
  }
});

test('RMVU-05C T13 no scheduled article publication', () => {
  const schedule = loadSchedule();
  for (const slug of ['readiness-baseline', 'ari-vs-geo-seo']) {
    const entry = schedule.articles.find((a) => a.slug === slug);
    assert.equal(entry?.status, 'editorial_hold');
  }
});

test('RMVU-05C T14 registry contains all 9 asset IDs', () => {
  const registry = fs.readFileSync(REGISTRY, 'utf8');
  for (const id of ASSET_IDS) {
    assert.match(registry, new RegExp(id));
  }
});

test('RMVU-05C drafts not exposed in public_build', () => {
  const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  assert.match(pkg, /rm -rf public_build\/crucial_data/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'public_build/crucial_data/organic/rmvu05c')));
});
