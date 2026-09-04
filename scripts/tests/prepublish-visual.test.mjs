import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  VISUAL_MODES,
  configFor,
  discoverPrepublishCandidates,
  discoverRecoveryCandidates,
  integrateScheduledCanonicalHero,
  validateScheduledIntegration,
} from '../lib/local-visual-worker.mjs';
import {
  PACKAGE_STATES,
  evaluateMorningPreflight,
  findNextPrepublishCandidate,
  markHeroPending,
  markHeroReady,
  resolvePackageState,
} from '../lib/insights-package-readiness.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-prepublish-visual-'));
  const slug = 'marketing-info-design';
  fs.mkdirSync(path.join(root, 'assets/insights', slug), { recursive: true });
  fs.mkdirSync(path.join(root, 'insights/_scheduled', slug), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/insights'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/insights/hero.css'), '.insight-hero { max-width: 820px; }');
  fs.writeFileSync(path.join(root, 'insights/_scheduled/schedule.json'), JSON.stringify({
    articles: [{
      slug,
      status: 'scheduled',
      publishAt: '2026-09-04T10:00:00+09:00',
      title: 'マーケが担う情報設計の再定義',
    }],
  }));
  fs.writeFileSync(path.join(root, 'insights/_scheduled', slug, 'index.html'), `<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../../assets/hub-animations.css">
<header class="article-header container"></header>

  <article class="article-body container" data-article-slug="${slug}"><p>本文</p></article>`);
  fs.writeFileSync(path.join(root, 'insights/index.html'), `<article class="insight-card planned" data-scheduled-slug="${slug}"><h3>planned</h3></article>`);
  return { root, slug };
}

test('A. scheduled future article without hero becomes prepublish candidate', () => {
  const { root } = fixture();
  const config = configFor(root);
  const schedule = JSON.parse(fs.readFileSync(config.schedulePath, 'utf8'));
  const result = discoverPrepublishCandidates(config, {
    schedule,
    now: new Date('2026-09-04T09:00:00+09:00'),
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].visualMode, VISUAL_MODES.PRIMARY_PREPUBLISH);
  fs.rmSync(root, { recursive: true, force: true });
});

test('B. hero exists → prepublish candidate skipped', () => {
  const { root, slug } = fixture();
  const config = configFor(root);
  fs.writeFileSync(path.join(root, 'assets/insights', slug, 'hero.webp'), 'hero');
  const schedule = JSON.parse(fs.readFileSync(config.schedulePath, 'utf8'));
  const result = discoverPrepublishCandidates(config, {
    schedule,
    now: new Date('2026-09-04T09:00:00+09:00'),
  });
  assert.equal(result.candidates.length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('D/E. morning preflight detects missing hero and package state', () => {
  const { root, slug } = fixture();
  const schedule = JSON.parse(fs.readFileSync(path.join(root, 'insights/_scheduled/schedule.json'), 'utf8'));
  const report = evaluateMorningPreflight({
    now: new Date('2026-09-04T09:00:00+09:00'),
    root,
    schedule,
  });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'PREPUBLISH_HERO_MISSING');
  assert.equal(report.slug, slug);
  fs.rmSync(root, { recursive: true, force: true });
});

test('scheduled integration updates planned card and scheduled article refs', () => {
  const { root, slug } = fixture();
  fs.writeFileSync(path.join(root, 'assets/insights', slug, 'hero.webp'), 'hero');
  const config = { root, origin: 'https://readiness.coaretail.com', assetsPath: path.join(root, 'assets/insights') };
  integrateScheduledCanonicalHero(config, slug, { root });
  const validation = validateScheduledIntegration(config, slug, { root });
  assert.equal(validation.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('readiness state transitions', () => {
  const entry = { slug: 'x', status: 'scheduled', publishAt: '2026-09-05T10:00:00+09:00' };
  markHeroPending(entry, { now: new Date('2026-09-04T06:00:00Z') });
  assert.equal(entry.packageReadiness, PACKAGE_STATES.HERO_PENDING);
  markHeroReady(entry, { now: new Date('2026-09-04T06:30:00Z') });
  assert.equal(entry.packageReadiness, PACKAGE_STATES.PACKAGE_READY);
  assert.ok(entry.heroReadyAt);
});

test('recovery mode remains published-only', async () => {
  const { root } = fixture();
  const config = configFor(root);
  const schedule = JSON.parse(fs.readFileSync(config.schedulePath, 'utf8'));
  const result = await discoverRecoveryCandidates(config, {
    schedule,
    productionCheck: async () => ({ ok: true, status: 200 }),
  });
  assert.equal(result.candidates.length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findNextPrepublishCandidate returns earliest future scheduled article', () => {
  const { root } = fixture();
  const schedule = JSON.parse(fs.readFileSync(path.join(root, 'insights/_scheduled/schedule.json'), 'utf8'));
  schedule.articles.push({
    slug: 'later-article',
    status: 'scheduled',
    publishAt: '2026-09-10T10:00:00+09:00',
    title: 'Later',
  });
  fs.mkdirSync(path.join(root, 'insights/_scheduled/later-article'), { recursive: true });
  fs.writeFileSync(path.join(root, 'insights/_scheduled/later-article/index.html'), '<article></article>');
  const candidate = findNextPrepublishCandidate(schedule, {
    now: new Date('2026-09-04T09:00:00+09:00'),
    root,
  });
  assert.equal(candidate.slug, 'marketing-info-design');
  fs.rmSync(root, { recursive: true, force: true });
});

test('package state resolves to PACKAGE_READY when hero exists before publish day', () => {
  const { root, slug } = fixture();
  fs.writeFileSync(path.join(root, 'assets/insights', slug, 'hero.webp'), 'hero');
  const entry = { slug, status: 'scheduled', publishAt: '2026-09-04T10:00:00+09:00' };
  assert.equal(
    resolvePackageState(entry, { now: new Date('2026-09-04T09:00:00+09:00'), root }),
    PACKAGE_STATES.PACKAGE_READY,
  );
  fs.rmSync(root, { recursive: true, force: true });
});
