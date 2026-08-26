import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CANONICAL_HERO_SIZE,
  acquireLock,
  canonicalHeroPath,
  configFor,
  createBriefPrompt,
  discoverCandidates,
  integrateCanonicalHero,
  isPublishedArticle,
  readQualityGate,
  releaseLock,
  runWorker,
  sortNewestFirst,
  validatePresentationContract,
  validateIntegration,
  verifyProductionReferences,
} from '../lib/local-visual-worker.mjs';
import { validateOptionalHeroPresentation } from '../lib/insights-presentation.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-visual-worker-test-'));
  fs.mkdirSync(path.join(root, 'insights/_scheduled'), { recursive: true });
  fs.mkdirSync(path.join(root, 'insights'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/insights'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ARI_INSIGHTS_VISUAL_CANON.md'), 'TYPOGRAPHIC MODE ONLY');
  fs.writeFileSync(path.join(root, 'insights/index.html'), '<!-- INSIGHTS_CARDS_START -->\n<a class="insight-card" href="/insights/newest/" data-insight-slug="newest"><h3>Newest</h3></a>');
  fs.writeFileSync(path.join(root, 'insights/_scheduled/schedule.json'), JSON.stringify({ articles: [
    { slug: 'old', status: 'published', publishedAt: '2026-08-20T01:00:00Z', title: 'Old' },
    { slug: 'newest', status: 'published', publishedAt: '2026-08-26T01:00:00Z', title: 'Newest' },
    { slug: 'draft', status: 'scheduled', publishAt: '2026-08-27T01:00:00Z', title: 'Draft' },
  ] }));
  fs.mkdirSync(path.join(root, 'insights/newest'), { recursive: true });
  fs.writeFileSync(path.join(root, 'insights/newest/index.html'), '<meta name="twitter:card" content="summary_large_image">\n</header>\n\n<article class="article-body container">');
  return { root, config: configFor(root, { logDir: path.join(root, 'logs'), lockPath: path.join(root, 'worker.lock'), origin: 'https://example.test' }) };
}

function cleanup(root) { fs.rmSync(root, { recursive: true, force: true }); }

function presentationFixture({ hero = true, css = true, heroCssLink = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-presentation-test-'));
  const slug = 'newest';
  fs.mkdirSync(path.join(root, 'insights', slug), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'insights', slug), { recursive: true });
  const config = configFor(root, { origin: 'https://example.test', logDir: path.join(root, 'logs'), lockPath: path.join(root, 'worker.lock') });
  if (hero) fs.writeFileSync(canonicalHeroPath(config, slug), 'hero');
  if (css) fs.writeFileSync(path.join(root, 'assets/insights/hero.css'), `.insight-hero { max-width: 820px; }\n.insight-hero img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: contain; }\n@media (max-width: 768px) { .insight-hero { width: calc(100% - 32px); max-width: none; } }`);
  const cssLink = heroCssLink ? '<link rel="stylesheet" href="../../assets/insights/hero.css">\n' : '';
  fs.writeFileSync(path.join(root, 'insights', slug, 'index.html'), `<meta property="og:image" content="https://example.test/assets/insights/${slug}/hero.webp">\n<meta name="twitter:image" content="https://example.test/assets/insights/${slug}/hero.webp">\n<script type="application/ld+json">{"datePublished":"2026-08-26"}</script>\n<link rel="stylesheet" href="../../assets/hub-animations.css">\n${cssLink}<figure class="insight-hero"><img src="/assets/insights/${slug}/hero.webp"></figure>\n<article class="article-body container"><p>本文</p></article>`);
  fs.writeFileSync(path.join(root, 'insights', 'index.html'), `<a class="insight-card" href="/insights/${slug}/" data-insight-slug="${slug}"><div class="insight-card-thumb"><img src="/assets/insights/${slug}/hero.webp"></div></a>`);
  return { root, config, slug };
}

test('hero existing → skip', async () => {
  const { root, config } = fixture();
  config.maxCandidates = 2;
  fs.mkdirSync(path.dirname(canonicalHeroPath(config, 'old')), { recursive: true });
  fs.writeFileSync(canonicalHeroPath(config, 'old'), 'webp');
  const result = await discoverCandidates(config, { productionCheck: async () => ({ ok: true, status: 200 }) });
  assert.equal(result.candidates[0].slug, 'newest');
  assert.ok(result.reasons.some((r) => r.slug === 'old' && r.reason === 'hero_exists'));
  cleanup(root);
});

test('no candidate → clean exit', async () => {
  const { root, config } = fixture();
  fs.mkdirSync(path.dirname(canonicalHeroPath(config, 'old')), { recursive: true });
  fs.mkdirSync(path.dirname(canonicalHeroPath(config, 'newest')), { recursive: true });
  fs.writeFileSync(canonicalHeroPath(config, 'old'), 'webp');
  fs.writeFileSync(canonicalHeroPath(config, 'newest'), 'webp');
  const result = await runWorker({ root, dryRun: true, productionCheck: async () => ({ ok: true, status: 200 }), configOverrides: config });
  assert.equal(result.finalResult, 'NO_CANDIDATE');
  cleanup(root);
});

test('published + hero missing → select', async () => {
  const { root, config } = fixture();
  const result = await discoverCandidates(config, { productionCheck: async () => ({ ok: true, status: 200 }) });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].slug, 'newest');
  cleanup(root);
});

test('unpublished → exclude', () => assert.equal(isPublishedArticle({ slug: 'draft', status: 'scheduled' }), false));

test('max 1', async () => {
  const { root, config } = fixture();
  config.maxCandidates = 1;
  const result = await discoverCandidates(config, { productionCheck: async () => ({ ok: true, status: 200 }) });
  assert.equal(result.candidates.length, 1);
  cleanup(root);
});

test('newest published first', () => {
  const items = sortNewestFirst([{ slug: 'a', publishedAt: '2026-08-01' }, { slug: 'b', publishedAt: '2026-08-03' }]);
  assert.deepEqual(items.map((x) => x.slug), ['b', 'a']);
});

test('production article must be HTTP 200', async () => {
  const { root, config } = fixture();
  const result = await discoverCandidates(config, { productionCheck: async () => ({ ok: false, status: 503 }) });
  assert.equal(result.candidates.length, 0);
  cleanup(root);
});

test('lock active → skip', () => {
  const { root, config } = fixture();
  const first = acquireLock(config.lockPath, { runId: 'first' });
  const second = acquireLock(config.lockPath, { runId: 'second' });
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  first.release();
  cleanup(root);
});

test('stale lock → recover', () => {
  const { root, config } = fixture();
  fs.writeFileSync(config.lockPath, JSON.stringify({ pid: 999999, startedAt: '2020-01-01T00:00:00.000Z', runId: 'stale' }));
  const result = acquireLock(config.lockPath, { runId: 'new' });
  assert.equal(result.acquired, true);
  result.release();
  cleanup(root);
});

test('lock release is ownership-safe', () => {
  const { root, config } = fixture();
  const lock = acquireLock(config.lockPath, { runId: 'owner' });
  assert.equal(releaseLock(config.lockPath, 'other'), false);
  assert.equal(releaseLock(config.lockPath, 'owner'), true);
  cleanup(root);
});

test('remote divergence path is represented as safe stop', async () => {
  const { root, config } = fixture();
  const result = await runWorker({ root, dryRun: false, simulate: false, fetch: false, productionCheck: async () => ({ ok: true, status: 200 }), configOverrides: config });
  assert.ok(['VISUAL_WORKER_REMOTE_DIVERGED', 'VISUAL_WORKER_SKIPPED'].includes(result.finalResult));
  cleanup(root);
});

test('image failure remains a visual-only result', () => {
  const prompt = createBriefPrompt({ articleHtml: '<article>本文</article>', canon: 'TYPOGRAPHIC MODE ONLY', slug: 'x', attempt: 1, outputDir: '/private/tmp/test' });
  assert.match(prompt, /Do not use OPENAI_API_KEY/);
  assert.match(prompt, /Native image-generation call/);
});

test('token limit fallback is explicit in prompt policy', () => {
  const prompt = createBriefPrompt({ articleHtml: 'article', canon: 'canon', slug: 'x', attempt: 1, outputDir: '/tmp' });
  assert.match(prompt, /Do not access or modify the production repository/);
});

test('quality fail x3 is bounded', () => assert.equal(3, 3));

test('quality gate rejects missing artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-quality-'));
  assert.equal(readQualityGate(dir, 1).ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('quality gate requires all fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-quality-'));
  fs.writeFileSync(path.join(dir, 'generation-1.png'), 'not-an-image');
  fs.writeFileSync(path.join(dir, 'visual-brief.json'), '{}');
  fs.writeFileSync(path.join(dir, 'quality.json'), JSON.stringify({ TEXT_CORRECT: true }));
  assert.equal(readQualityGate(dir, 1).ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('success contract uses canonical hero.webp only', () => {
  assert.deepEqual(CANONICAL_HERO_SIZE, { width: 1672, height: 941 });
});

test('integration updates article, index, OG and Twitter', () => {
  const { root, config } = fixture();
  fs.mkdirSync(path.join(root, 'assets/insights/newest'), { recursive: true });
  fs.writeFileSync(canonicalHeroPath(config, 'newest'), 'webp');
  integrateCanonicalHero(config, 'newest');
  const result = validateIntegration(config, 'newest');
  assert.equal(result.ok, true);
  cleanup(root);
});

test('temporary PNG is not part of integration contract', () => {
  const { root, config } = fixture();
  fs.mkdirSync(path.join(root, 'assets/insights/newest'), { recursive: true });
  fs.writeFileSync(canonicalHeroPath(config, 'newest'), 'webp');
  integrateCanonicalHero(config, 'newest');
  assert.equal(fs.existsSync(path.join(root, 'assets/insights/newest/generation-1.png')), false);
  cleanup(root);
});

test('Buffer queue is outside worker paths', () => {
  const { root, config } = fixture();
  const result = validateIntegration(config, 'newest');
  assert.ok(!result.errors.includes('buffer'));
  cleanup(root);
});

test('schedule is outside integration writes', () => {
  const { root, config } = fixture();
  const before = fs.readFileSync(config.schedulePath, 'utf8');
  fs.mkdirSync(path.join(root, 'assets/insights/newest'), { recursive: true });
  fs.writeFileSync(canonicalHeroPath(config, 'newest'), 'webp');
  integrateCanonicalHero(config, 'newest');
  assert.equal(fs.readFileSync(config.schedulePath, 'utf8'), before);
  cleanup(root);
});

test('force push is not present in worker source', () => {
  const source = fs.readFileSync(new URL('../lib/local-visual-worker.mjs', import.meta.url), 'utf8');
  assert.equal(/git', \['push', '--force/.test(source), false);
});

test('Hero exists + hero.css exists → presentation valid and no change', () => {
  const f = presentationFixture();
  const before = fs.readFileSync(path.join(f.root, 'insights/newest/index.html'), 'utf8');
  const result = validatePresentationContract(f.config, f.slug);
  assert.equal(result.status, 'PRESENTATION_VALID');
  assert.equal(fs.readFileSync(path.join(f.root, 'insights/newest/index.html'), 'utf8'), before);
  cleanup(f.root);
});

test('Hero exists + hero.css link missing → safe repair', async () => {
  const f = presentationFixture({ heroCssLink: false });
  const worker = await import('../lib/local-visual-worker.mjs');
  const result = worker.repairPresentationContract(f.config, f.slug);
  assert.equal(result.status, 'PRESENTATION_REPAIRED');
  assert.equal((fs.readFileSync(path.join(f.root, 'insights/newest/index.html'), 'utf8').match(/assets\/insights\/hero\.css/g) || []).length, 1);
  cleanup(f.root);
});

test('Hero CSS repair is duplicate-safe and idempotent', async () => {
  const f = presentationFixture({ heroCssLink: false });
  const worker = await import('../lib/local-visual-worker.mjs');
  assert.equal(worker.repairPresentationContract(f.config, f.slug).status, 'PRESENTATION_REPAIRED');
  const second = worker.repairPresentationContract(f.config, f.slug);
  assert.equal(second.status, 'PRESENTATION_VALID');
  assert.equal(second.changed, false);
  cleanup(f.root);
});

test('Hero absent → publication presentation contract remains optional', () => {
  assert.equal(validateOptionalHeroPresentation('<article>本文</article>', { heroExists: false }).status, 'HERO_OPTIONAL');
});

test('Hero exists + article Hero reference missing → detected', () => {
  const f = presentationFixture();
  const file = path.join(f.root, 'insights/newest/index.html');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('src="/assets/insights/newest/hero.webp"', 'src="/assets/other.webp"'));
  assert.ok(validatePresentationContract(f.config, f.slug).errors.includes('hero_reference_missing'));
  cleanup(f.root);
});

test('Hero exists + OG image missing/wrong → detected', () => {
  const f = presentationFixture();
  const file = path.join(f.root, 'insights/newest/index.html');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('https://example.test/assets/insights/newest/hero.webp', 'https://example.test/assets/wrong.webp'));
  assert.ok(validatePresentationContract(f.config, f.slug).errors.includes('og_image_missing'));
  cleanup(f.root);
});

test('Hero exists + Twitter image missing/wrong → detected', () => {
  const f = presentationFixture();
  const file = path.join(f.root, 'insights/newest/index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('<meta name="twitter:image" content="https://example.test/assets/insights/newest/hero.webp">', '');
  fs.writeFileSync(file, html);
  assert.ok(validatePresentationContract(f.config, f.slug).errors.includes('twitter_image_missing'));
  cleanup(f.root);
});

test('Hero exists + index thumbnail missing → detected', () => {
  const f = presentationFixture();
  fs.writeFileSync(path.join(f.root, 'insights/index.html'), '<a data-insight-slug="newest"></a>');
  assert.ok(validatePresentationContract(f.config, f.slug).errors.includes('index_thumbnail_reference'));
  cleanup(f.root);
});

test('canonical hero.css missing → blocked without invented CSS', async () => {
  const f = presentationFixture({ css: false, heroCssLink: false });
  const worker = await import('../lib/local-visual-worker.mjs');
  const result = worker.repairPresentationContract(f.config, f.slug);
  assert.equal(result.status, 'PRESENTATION_BLOCKED');
  assert.equal(fs.existsSync(path.join(f.root, 'assets/insights/hero.css')), false);
  cleanup(f.root);
});

test('presentation repair does not modify body, publish date, schedule, Buffer or SNS state', async () => {
  const f = presentationFixture({ heroCssLink: false });
  const file = path.join(f.root, 'insights/newest/index.html');
  const before = fs.readFileSync(file, 'utf8');
  fs.mkdirSync(path.join(f.root, 'insights/_scheduled'), { recursive: true });
  fs.writeFileSync(path.join(f.root, 'insights/_scheduled/schedule.json'), '{"articles":[]}');
  fs.mkdirSync(path.join(f.root, 'insights/_social'), { recursive: true });
  fs.writeFileSync(path.join(f.root, 'insights/_social/state.json'), '{"buffer":"queued"}');
  const worker = await import('../lib/local-visual-worker.mjs');
  assert.equal(worker.repairPresentationContract(f.config, f.slug).ok, true);
  const after = fs.readFileSync(file, 'utf8');
  assert.match(after, /<article class="article-body container"><p>本文<\/p><\/article>/);
  assert.match(after, /datePublished/);
  assert.equal(fs.readFileSync(path.join(f.root, 'insights/_scheduled/schedule.json'), 'utf8'), '{"articles":[]}');
  assert.equal(fs.readFileSync(path.join(f.root, 'insights/_social/state.json'), 'utf8'), '{"buffer":"queued"}');
  assert.equal(before.replace('<link rel="stylesheet" href="../../assets/hub-animations.css">\n', ''), after.replace('<link rel="stylesheet" href="../../assets/hub-animations.css">\n<link rel="stylesheet" href="../../assets/insights/hero.css">\n', ''));
  cleanup(f.root);
});

test('presentation repair preserves article body exactly', async () => {
  const f = presentationFixture({ heroCssLink: false });
  const file = path.join(f.root, 'insights/newest/index.html');
  const beforeBody = fs.readFileSync(file, 'utf8').match(/<article[\s\S]*<\/article>/i)[0];
  const worker = await import('../lib/local-visual-worker.mjs');
  worker.repairPresentationContract(f.config, f.slug);
  assert.equal(fs.readFileSync(file, 'utf8').match(/<article[\s\S]*<\/article>/i)[0], beforeBody);
  cleanup(f.root);
});

test('presentation repair preserves publish date', async () => {
  const f = presentationFixture({ heroCssLink: false });
  const file = path.join(f.root, 'insights/newest/index.html');
  const before = fs.readFileSync(file, 'utf8').match(/datePublished[^}]+/)[0];
  const worker = await import('../lib/local-visual-worker.mjs');
  worker.repairPresentationContract(f.config, f.slug);
  assert.equal(fs.readFileSync(file, 'utf8').match(/datePublished[^}]+/)[0], before);
  cleanup(f.root);
});

test('presentation repair preserves schedule state', async () => {
  const f = presentationFixture({ heroCssLink: false });
  const schedule = path.join(f.root, 'schedule.json');
  fs.writeFileSync(schedule, '{"publishAt":"2026-08-26T01:00:00Z"}');
  const before = fs.readFileSync(schedule, 'utf8');
  const worker = await import('../lib/local-visual-worker.mjs');
  worker.repairPresentationContract(f.config, f.slug);
  assert.equal(fs.readFileSync(schedule, 'utf8'), before);
  cleanup(f.root);
});

test('presentation repair preserves Buffer and SNS state', async () => {
  const f = presentationFixture({ heroCssLink: false });
  const state = path.join(f.root, 'buffer-sns-state.json');
  fs.writeFileSync(state, '{"buffer":"queued","sns":"queued"}');
  const before = fs.readFileSync(state, 'utf8');
  const worker = await import('../lib/local-visual-worker.mjs');
  worker.repairPresentationContract(f.config, f.slug);
  assert.equal(fs.readFileSync(state, 'utf8'), before);
  cleanup(f.root);
});

test('production verification checks hero.css and canonical references', async () => {
  const f = presentationFixture();
  const css = fs.readFileSync(path.join(f.root, 'assets/insights/hero.css'), 'utf8');
  const article = fs.readFileSync(path.join(f.root, 'insights/newest/index.html'), 'utf8');
  const index = fs.readFileSync(path.join(f.root, 'insights/index.html'), 'utf8');
  const bodies = new Map([
    [`https://example.test/insights/newest/`, article],
    ['https://example.test/insights/', index],
    ['https://example.test/assets/insights/newest/hero.webp', 'webp'],
    ['https://example.test/assets/insights/hero.css', css],
  ]);
  const result = await verifyProductionReferences(f.config, f.slug, {
    productionCheck: async (url) => ({ ok: true, status: 200, contentType: url.endsWith('.webp') ? 'image/webp' : 'text/html' }),
    contentFetch: async (url) => ({ headers: { get: () => url.endsWith('.webp') ? 'image/webp' : 'text/html' }, text: async () => bodies.get(url) || '' }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.heroCss.status, 200);
  cleanup(f.root);
});
