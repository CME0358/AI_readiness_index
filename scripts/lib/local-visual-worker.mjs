import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_HERO_CSS_HREF,
  repairCanonicalHeroCssLink,
  validateOptionalHeroPresentation,
} from './insights-presentation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(__dirname, '../..');
export const CANONICAL_HERO_SIZE = Object.freeze({ width: 1672, height: 941 });
export const MAX_CANDIDATES_PER_RUN = 1;
export const MAX_GENERATION_ATTEMPTS = 3;
export const PRODUCTION_ORIGIN = 'https://readiness.coaretail.com';
export const DEFAULT_LOCK_PATH = '/private/tmp/ari-insights-visual-worker.lock';
export const DEFAULT_LOG_DIR = path.join(os.homedir(), 'Library/Logs/ARIInsightsVisualWorker');
export const WORKER_INTEGRITY_PATHS = Object.freeze([
  'scripts/local-visual-worker.sh',
  'scripts/run-insights-visual-worker.mjs',
  'scripts/lib/local-visual-worker.mjs',
  'scripts/lib/insights-presentation.mjs',
  'launchd/com.ari.insights.visual-worker.plist',
]);

const PROTECTED_SLUGS = new Set(['_scheduled', '_social']);

export function makeRunId(now = new Date()) {
  return `${now.toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
}

export function configFor(root = DEFAULT_ROOT, overrides = {}) {
  return {
    root,
    schedulePath: path.join(root, 'insights/_scheduled/schedule.json'),
    canonPath: path.join(root, 'ARI_INSIGHTS_VISUAL_CANON.md'),
    indexPath: path.join(root, 'insights/index.html'),
    insightsPath: path.join(root, 'insights'),
    assetsPath: path.join(root, 'assets/insights'),
    origin: PRODUCTION_ORIGIN,
    lockPath: overrides.lockPath || process.env.ARI_VISUAL_WORKER_LOCK_PATH || DEFAULT_LOCK_PATH,
    logDir: overrides.logDir || process.env.ARI_VISUAL_WORKER_LOG_DIR || DEFAULT_LOG_DIR,
    maxCandidates: MAX_CANDIDATES_PER_RUN,
    ...overrides,
  };
}

export function canonicalHeroPath(config, slug) {
  return path.join(config.assetsPath, slug, 'hero.webp');
}

export function canonicalHeroUrl(config, slug) {
  return `${config.origin}/assets/insights/${encodeURIComponent(slug)}/hero.webp`;
}

export function articleUrl(config, slug) {
  return `${config.origin}/insights/${encodeURIComponent(slug)}/`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadSchedule(config) {
  return readJson(config.schedulePath);
}

export function isProtectedSlug(slug) {
  return !slug || slug.startsWith('_') || PROTECTED_SLUGS.has(slug);
}

export function isPublishedArticle(article) {
  return article?.status === 'published' && !isProtectedSlug(article.slug);
}

export function sortNewestFirst(articles) {
  return [...articles].sort((a, b) =>
    new Date(b.publishedAt || b.publishAt || 0).getTime() -
    new Date(a.publishedAt || a.publishAt || 0).getTime()
  );
}

export async function defaultProductionCheck(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    return { ok: response.status === 200, status: response.status, url: response.url };
  } catch (error) {
    return { ok: false, status: null, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverCandidates(config, {
  productionCheck = defaultProductionCheck,
  schedule = loadSchedule(config),
} = {}) {
  const candidates = [];
  const reasons = [];
  for (const article of sortNewestFirst(schedule.articles || [])) {
    if (!isPublishedArticle(article)) {
      reasons.push({ slug: article?.slug, state: 'excluded', reason: 'not_published_or_protected' });
      continue;
    }
    if (fs.existsSync(canonicalHeroPath(config, article.slug))) {
      reasons.push({ slug: article.slug, state: 'skip', reason: 'hero_exists' });
      continue;
    }
    const production = await productionCheck(articleUrl(config, article.slug), article);
    if (!production.ok) {
      reasons.push({ slug: article.slug, state: 'skip', reason: 'production_not_200', production });
      continue;
    }
    candidates.push({ ...article, production });
    if (candidates.length >= config.maxCandidates) break;
  }
  return { candidates, reasons };
}

export function acquireLock(lockPath, { runId = makeRunId(), now = new Date(), staleMs = 6 * 60 * 60 * 1000 } = {}) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  if (fs.existsSync(lockPath)) {
    let existing = null;
    try { existing = readJson(lockPath); } catch { existing = { malformed: true }; }
    const age = existing?.startedAt ? now.getTime() - new Date(existing.startedAt).getTime() : Infinity;
    let alive = false;
    if (Number.isInteger(existing?.pid) && existing.pid > 0) {
      try { process.kill(existing.pid, 0); alive = true; } catch { alive = false; }
    }
    if (alive || (!alive && age <= staleMs)) {
      return { acquired: false, reason: 'active', existing };
    }
    fs.unlinkSync(lockPath);
  }
  const lock = { pid: process.pid, startedAt: now.toISOString(), runId };
  let fd;
  try {
    fd = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') return { acquired: false, reason: 'active', existing: readJson(lockPath) };
    throw error;
  }
  fs.writeFileSync(fd, JSON.stringify(lock, null, 2) + '\n');
  fs.closeSync(fd);
  return { acquired: true, lock, release: () => releaseLock(lockPath, runId) };
}

export function releaseLock(lockPath, runId) {
  if (!fs.existsSync(lockPath)) return false;
  try {
    const current = readJson(lockPath);
    if (current.runId !== runId) return false;
  } catch { return false; }
  fs.unlinkSync(lockPath);
  return true;
}

export function runCommand(command, args, { cwd, input, env, allowFailure = false, timeout = 0 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    input,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}): ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

export function gitStatusIsSafe(root, workerPaths = WORKER_INTEGRITY_PATHS) {
  const status = runCommand('git', ['status', '--porcelain'], { cwd: root }).stdout.trimEnd();
  if (!status.trim()) return { safe: true, status: '' };
  const allowed = new Set(workerPaths.map((p) => path.isAbsolute(p) ? path.relative(root, p) : p));
  const dirtyFiles = status.split('\n').map((line) => line.slice(3).replace(/^"|"$/g, ''));
  const workerCodeDirty = dirtyFiles.filter((file) => allowed.has(file));
  return {
    safe: workerCodeDirty.length === 0,
    status,
    dirtyFiles,
    sourceWorktreeDirty: dirtyFiles.filter((file) => !allowed.has(file)),
    workerCodeDirty,
  };
}

function isNetworkFailure(error) {
  return /could not resolve host|unable to access|network is unreachable|failed to connect|connection timed out|temporary failure in name resolution/i.test(String(error?.message || error));
}

function classifyWorkerFailure(error) {
  const message = String(error?.message || '');
  if (message.startsWith('VISUAL_WORKER_REMOTE_DIVERGED')) return 'VISUAL_WORKER_REMOTE_DIVERGED';
  if (message.startsWith('VISUAL_WORKER_CODE_DIRTY')) return 'VISUAL_WORKER_CODE_DIRTY';
  if (message.startsWith('VISUAL_WORKER_NETWORK_BLOCKED')) return 'VISUAL_WORKER_NETWORK_BLOCKED';
  return 'VISUAL_WORKER_SKIPPED';
}

export function checkRemoteDivergence(root, { fetch = true } = {}) {
  if (fetch) runCommand('git', ['fetch', '--prune', 'origin'], { cwd: root });
  const head = runCommand('git', ['rev-parse', 'HEAD'], { cwd: root }).stdout.trim();
  const remote = runCommand('git', ['rev-parse', 'origin/main'], { cwd: root }).stdout.trim();
  const mergeBase = runCommand('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root }).stdout.trim();
  const headIsAncestor = runCommand('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], { cwd: root, allowFailure: true }).status === 0;
  const remoteIsAncestor = runCommand('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: root, allowFailure: true }).status === 0;
  return { diverged: !headIsAncestor && !remoteIsAncestor, remoteAhead: headIsAncestor && head !== remote, head, remote, mergeBase };
}

export function readOriginMainSha(root) {
  return runCommand('git', ['rev-parse', 'origin/main'], { cwd: root }).stdout.trim();
}

export function createBriefPrompt({ articleHtml, canon, slug, attempt, outputDir }) {
  return `You are the ARI Insights Local Visual Worker. This is attempt ${attempt} for slug ${slug}.

Work only inside this isolated workspace: ${outputDir}
Do not access or modify the production repository, Buffer, SNS, Git remote, or any file outside this workspace.
Do not use OPENAI_API_KEY. Do not use the OpenAI Images API. Use ChatGPT-login Native image generation only.

Read the complete article below and the authoritative Visual Canon below. First decide and save a JSON file named visual-brief.json with exactly these fields:
ARTICLE, PRIMARY_TOPIC, KEY_PHRASE, IMAGE_TEXT, LAYOUT, RATIONALE.
Then make exactly one Native image-generation call. MODE is TYPOGRAPHIC ONLY.
Save the temporary PNG as generation-${attempt}.png in this workspace.
The image must be a premium B2B editorial 16:9 hero: white or very light neutral background, navy/blue/subtle cyan accents, strong hierarchy, generous negative space, central safe area, thumbnail-readable.
Do not use explanatory, conceptual, data, abstract, generic AI art, photography, people, robots, brains, AI chips, dashboards, 3D objects, sculptures, or logos.
Use only article-supported short text. Japanese text must be exact and legible.
After generation, save quality.json with boolean fields: TEXT_CORRECT, JAPANESE_CORRECT, NO_GARBLED_TEXT, TYPOGRAPHIC_ONLY, ARTICLE_RELEVANT, SAFE_AREA_PASS, THUMBNAIL_READABLE, VISUAL_CANON_PASS, and numeric width and height. Set a field false if it fails.
Do not create alternate images or derivatives.

AUTHORITATIVE VISUAL CANON:
${canon}

ARTICLE HTML:
${articleHtml}
`;
}

export function imageDimensions(file, cwd) {
  const result = runCommand('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { cwd, allowFailure: true });
  const width = Number((result.stdout.match(/pixelWidth:\s*(\d+)/) || [])[1]);
  const height = Number((result.stdout.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  return { width, height, ok: result.status === 0 && Number.isFinite(width) && Number.isFinite(height) };
}

export function readQualityGate(workspace, attempt) {
  const briefPath = path.join(workspace, 'visual-brief.json');
  const qualityPath = path.join(workspace, 'quality.json');
  const imagePath = path.join(workspace, `generation-${attempt}.png`);
  if (!fs.existsSync(imagePath) || !fs.existsSync(briefPath) || !fs.existsSync(qualityPath)) {
    return { ok: false, reason: 'missing_generation_artifacts', imagePath };
  }
  let quality;
  let brief;
  try { quality = readJson(qualityPath); brief = readJson(briefPath); } catch (error) {
    return { ok: false, reason: 'invalid_quality_json', error: error.message };
  }
  const dimensions = imageDimensions(imagePath, workspace);
  const required = ['TEXT_CORRECT', 'JAPANESE_CORRECT', 'NO_GARBLED_TEXT', 'TYPOGRAPHIC_ONLY', 'ARTICLE_RELEVANT', 'SAFE_AREA_PASS', 'THUMBNAIL_READABLE', 'VISUAL_CANON_PASS'];
  const flags = Object.fromEntries(required.map((key) => [key, quality[key] === true]));
  const ok = dimensions.ok && dimensions.width === CANONICAL_HERO_SIZE.width && dimensions.height === CANONICAL_HERO_SIZE.height && required.every((key) => flags[key]);
  return { ok, imagePath, dimensions, quality: flags, brief, reason: ok ? null : 'quality_gate_failed' };
}

export function optimizeToWebp(input, output, cwd) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  runCommand('/usr/bin/sips', ['-s', 'format', 'webp', '--setProperty', 'formatOptions', '82', input, '--out', output], { cwd });
  if (!fs.existsSync(output) || fs.statSync(output).size === 0) throw new Error('webp_output_missing');
  return output;
}

function metaTag(property, content) {
  return `<meta ${property.startsWith('og:') ? 'property' : 'name'}="${property}" content="${content}">`;
}

export function integrateCanonicalHero(config, slug, { root = config.root } = {}) {
  const heroUrl = canonicalHeroUrl(config, slug);
  const heroPath = `/assets/insights/${slug}/hero.webp`;
  const articlePath = path.join(root, 'insights', slug, 'index.html');
  const indexPath = path.join(root, 'insights/index.html');
  if (!fs.existsSync(articlePath)) throw new Error(`article_missing:${slug}`);
  let article = fs.readFileSync(articlePath, 'utf8');
  if (!article.includes(heroUrl)) {
    const meta = `\n${metaTag('og:image', heroUrl)}\n${metaTag('twitter:image', heroUrl)}\n`;
    const marker = '<meta name="twitter:card" content="summary_large_image">';
    if (!article.includes(marker)) throw new Error(`article_metadata_marker_missing:${slug}`);
    article = article.replace(marker, marker + meta);
    const hero = `\n<figure class="insight-hero"><img src="${heroPath}" alt="${slug} のInsight Hero" width="${CANONICAL_HERO_SIZE.width}" height="${CANONICAL_HERO_SIZE.height}" loading="eager"></figure>\n`;
    const articleMarker = '</header>\n\n<article';
    if (!article.includes(articleMarker)) throw new Error(`article_hero_marker_missing:${slug}`);
    article = article.replace(articleMarker, `</header>${hero}\n<article`);
    fs.writeFileSync(articlePath, article, 'utf8');
  }
  let index = fs.readFileSync(indexPath, 'utf8');
  const cardMarker = `data-insight-slug="${slug}"`;
  if (!index.includes(cardMarker)) throw new Error(`index_card_missing:${slug}`);
  const cardStart = index.indexOf(`<a class="insight-card" href="/insights/${slug}/"`);
  if (cardStart < 0) throw new Error(`index_card_start_missing:${slug}`);
  if (!index.includes(heroPath, cardStart)) {
    const insertAt = index.indexOf('>', cardStart) + 1;
    const thumbnail = `\n        <div class="insight-card-thumb">\n          <img src="${heroPath}" alt="" loading="lazy" width="${CANONICAL_HERO_SIZE.width}" height="${CANONICAL_HERO_SIZE.height}">\n        </div>`;
    index = index.slice(0, insertAt) + thumbnail + index.slice(insertAt);
    fs.writeFileSync(indexPath, index, 'utf8');
  }
  return { articlePath, indexPath, heroUrl, heroPath };
}

function articleBodySnapshot(html) {
  return html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] || '';
}

function publishDateSnapshot(html) {
  return [
    html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || '',
    html.match(/<time\b[^>]*datetime="([^"]+)"/)?.[1] || '',
  ].join('|');
}

function validateCanonicalHeroCss(css) {
  const hero = css.match(/\.insight-hero\s*\{([^}]*)\}/)?.[1] || '';
  const image = css.match(/\.insight-hero\s+img\s*\{([^}]*)\}/)?.[1] || '';
  const mobile = css.match(/@media\s*\(max-width:\s*768px\)[\s\S]*?\.insight-hero\s*\{([^}]*)\}/)?.[1] || '';
  const checks = {
    maxWidth820: /max-width:\s*820px/.test(hero),
    width100: /width:\s*100%/.test(image),
    heightAuto: /height:\s*auto/.test(image),
    aspectRatio: /aspect-ratio:\s*16\s*\/\s*9/.test(image),
    objectFitContain: /object-fit:\s*contain/.test(image),
    mobileWidth: /width:\s*calc\(100%\s*-\s*32px\)/.test(mobile),
    mobileMaxNone: /max-width:\s*none/.test(mobile),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function validatePresentationContract(config, slug, { root = config.root } = {}) {
  const hero = canonicalHeroPath({ ...config, assetsPath: path.join(root, 'assets/insights') }, slug);
  if (!fs.existsSync(hero)) return { ok: true, status: 'HERO_OPTIONAL', errors: [] };
  const articlePath = path.join(root, 'insights', slug, 'index.html');
  const indexPath = path.join(root, 'insights/index.html');
  const cssPath = path.join(root, 'assets/insights/hero.css');
  const errors = [];
  if (!fs.existsSync(articlePath)) errors.push('article_missing');
  if (!fs.existsSync(indexPath)) errors.push('index_missing');
  if (!fs.existsSync(cssPath)) errors.push('hero_css_missing');
  if (errors.length) return { ok: false, status: 'PRESENTATION_BLOCKED', errors };
  const article = fs.readFileSync(articlePath, 'utf8');
  const index = fs.readFileSync(indexPath, 'utf8');
  const heroUrl = canonicalHeroUrl(config, slug);
  const rel = `/assets/insights/${slug}/hero.webp`;
  const articleGate = validateOptionalHeroPresentation(article, { slug, heroExists: true, heroCssExists: true, heroUrl });
  if (!articleGate.ok) errors.push(...articleGate.errors);
  const cardStart = index.indexOf(`data-insight-slug="${slug}"`);
  const cardEnd = cardStart >= 0 ? index.indexOf('</a>', cardStart) : -1;
  const card = cardStart >= 0 ? index.slice(cardStart, cardEnd >= 0 ? cardEnd : cardStart + 2000) : '';
  if (!card.includes(rel)) errors.push('index_thumbnail_reference');
  if (!card.includes('insight-card-thumb')) errors.push('index_thumbnail_contract');
  const cssGate = validateCanonicalHeroCss(fs.readFileSync(cssPath, 'utf8'));
  if (!cssGate.ok) errors.push('hero_css_contract');
  return { ok: errors.length === 0, status: errors.length ? 'PRESENTATION_BLOCKED' : 'PRESENTATION_VALID', errors, css: cssGate.checks };
}

export function repairPresentationContract(config, slug, { root = config.root } = {}) {
  const hero = canonicalHeroPath({ ...config, assetsPath: path.join(root, 'assets/insights') }, slug);
  if (!fs.existsSync(hero)) return { ok: true, status: 'HERO_OPTIONAL', changed: false };
  const cssPath = path.join(root, 'assets/insights/hero.css');
  const articlePath = path.join(root, 'insights', slug, 'index.html');
  if (!fs.existsSync(cssPath) || !fs.existsSync(articlePath)) return { ok: false, status: 'PRESENTATION_BLOCKED', changed: false, reason: 'canonical_asset_or_article_missing' };
  const before = fs.readFileSync(articlePath, 'utf8');
  const repaired = repairCanonicalHeroCssLink(before, { heroCssExists: true });
  if (repaired.status === 'PRESENTATION_BLOCKED') return { ok: false, status: repaired.status, changed: false, reason: repaired.reason };
  if (repaired.changed) fs.writeFileSync(articlePath, repaired.html, 'utf8');
  const after = repaired.html;
  if (articleBodySnapshot(before) !== articleBodySnapshot(after)) return { ok: false, status: 'PRESENTATION_BLOCKED', changed: repaired.changed, reason: 'article_body_changed' };
  if (publishDateSnapshot(before) !== publishDateSnapshot(after)) return { ok: false, status: 'PRESENTATION_BLOCKED', changed: repaired.changed, reason: 'publish_date_changed' };
  const validation = validatePresentationContract(config, slug, { root });
  return { ...validation, status: repaired.changed ? 'PRESENTATION_REPAIRED' : validation.status, changed: repaired.changed };
}

export function validateIntegration(config, slug, { root = config.root } = {}) {
  const hero = canonicalHeroPath(config, slug);
  const articlePath = path.join(root, 'insights', slug, 'index.html');
  const indexPath = path.join(root, 'insights/index.html');
  const errors = [];
  if (!fs.existsSync(hero)) errors.push('hero_missing');
  if (!fs.existsSync(articlePath)) errors.push('article_missing');
  if (!fs.existsSync(indexPath)) errors.push('index_missing');
  if (!errors.length) {
    const article = fs.readFileSync(articlePath, 'utf8');
    const index = fs.readFileSync(indexPath, 'utf8');
    const url = canonicalHeroUrl(config, slug);
    const rel = `/assets/insights/${slug}/hero.webp`;
    for (const [name, ok] of [
      ['article_hero', article.includes(rel)],
      ['index_thumbnail', index.includes(rel)],
      ['og_image', article.includes(`<meta property="og:image" content="${url}">`)],
      ['twitter_image', article.includes(`<meta name="twitter:image" content="${url}">`)],
    ]) if (!ok) errors.push(name);
  }
  return { ok: errors.length === 0, errors };
}

export function createLogger(config, runId) {
  fs.mkdirSync(config.logDir, { recursive: true });
  const file = path.join(config.logDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  return (entry) => {
    const safe = { runAt: new Date().toISOString(), runId, ...entry };
    delete safe.token;
    delete safe.apiKey;
    fs.appendFileSync(file, JSON.stringify(safe) + '\n', 'utf8');
  };
}

function codexEnvironment() {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.OPENAI_API_KEY_FILE;
  delete env.AZURE_OPENAI_API_KEY;
  return env;
}

export function runNativeGeneration(workspace, candidate, canon, attempt) {
  const articlePath = path.join(workspace, 'article.html');
  const prompt = createBriefPrompt({
    articleHtml: fs.readFileSync(articlePath, 'utf8'),
    canon,
    slug: candidate.slug,
    attempt,
    outputDir: workspace,
  });
  const outputPath = path.join(workspace, `codex-${attempt}.final.txt`);
  const result = runCommand('codex', [
    'exec', '--ephemeral', '--skip-git-repo-check',
    '--cd', workspace, '--sandbox', 'workspace-write',
    '--output-last-message', outputPath,
  ], { cwd: workspace, input: prompt, env: codexEnvironment(), allowFailure: true, timeout: 12 * 60 * 1000 });
  return {
    ok: result.status === 0 && fs.existsSync(path.join(workspace, `generation-${attempt}.png`)),
    status: result.status,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stderr: (result.stderr || '').slice(-2000),
    capabilityFailure: /usage limit|token limit|authentication|not available|unavailable|OPENAI_API_KEY|api key|rate limit/i.test(`${result.stderr || ''}\n${result.stdout || ''}`),
    outputPath,
  };
}

export async function createIsolatedWorktree(root, runId, baseSha) {
  const workspace = fs.mkdtempSync(path.join('/private/tmp', `ari-insights-visual-${runId}-`));
  const result = runCommand('git', ['worktree', 'add', '--detach', workspace, baseSha], { cwd: root, allowFailure: true });
  if (result.status !== 0) {
    fs.rmSync(workspace, { recursive: true, force: true });
    throw new Error(`worktree_create_failed:${(result.stderr || '').trim()}`);
  }
  return workspace;
}

function createReadOnlyOriginSnapshot(root, runId, baseSha) {
  const workspace = fs.mkdtempSync(path.join('/private/tmp', `ari-insights-visual-snapshot-${runId}-`));
  const archive = path.join('/private/tmp', `ari-insights-visual-snapshot-${runId}.tar`);
  try {
    runCommand('git', ['archive', '--format=tar', '--output', archive, baseSha], { cwd: root });
    runCommand('/usr/bin/tar', ['-xf', archive, '-C', workspace], { cwd: root });
    return workspace;
  } catch (error) {
    fs.rmSync(workspace, { recursive: true, force: true });
    throw error;
  } finally {
    fs.rmSync(archive, { force: true });
  }
}

async function createExecutionWorkspace(root, runId, baseSha, { readOnly = false } = {}) {
  return readOnly
    ? createReadOnlyOriginSnapshot(root, runId, baseSha)
    : await createIsolatedWorktree(root, runId, baseSha);
}

function removeIsolatedWorktree(root, workspace) {
  runCommand('git', ['worktree', 'remove', '--force', workspace], { cwd: root, allowFailure: true });
  if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
}

export async function verifyProduction(config, slug, { productionCheck = defaultProductionCheck } = {}) {
  const article = await productionCheck(articleUrl(config, slug));
  const hero = await productionCheck(canonicalHeroUrl(config, slug));
  const index = await productionCheck(`${config.origin}/insights/`);
  const errors = [];
  if (!article.ok) errors.push(`article_http_${article.status || 'error'}`);
  if (!hero.ok) errors.push(`hero_http_${hero.status || 'error'}`);
  if (!index.ok) errors.push(`index_http_${index.status || 'error'}`);
  if (hero.ok && hero.contentType && !hero.contentType.toLowerCase().includes('image/webp')) errors.push(`hero_content_type_${hero.contentType}`);
  return { ok: errors.length === 0, article, hero, index, errors };
}

async function productionCheckWithContent(url, options, check = defaultProductionCheck, contentFetch = fetch) {
  const result = await check(url, options);
  if (!result.ok) return result;
  try {
    const response = await contentFetch(url, { redirect: 'follow' });
    return { ...result, contentType: response.headers.get('content-type') || '', body: await response.text() };
  } catch (error) {
    return { ...result, contentType: '', body: '', error: error.message };
  }
}

export async function verifyProductionReferences(config, slug, { productionCheck = defaultProductionCheck, contentFetch = fetch } = {}) {
  const article = await productionCheckWithContent(articleUrl(config, slug), {}, productionCheck, contentFetch);
  const index = await productionCheckWithContent(`${config.origin}/insights/`, {}, productionCheck, contentFetch);
  const hero = await productionCheckWithContent(canonicalHeroUrl(config, slug), {}, productionCheck, contentFetch);
  const heroCss = await productionCheckWithContent(`${config.origin}/assets/insights/hero.css`, {}, productionCheck, contentFetch);
  const heroUrl = canonicalHeroUrl(config, slug);
  const rel = `/assets/insights/${slug}/hero.webp`;
  const errors = [];
  if (!article.ok || !article.body.includes(rel)) errors.push('article_hero_reference');
  if (!article.body.includes('../../assets/insights/hero.css') && !article.body.includes('/assets/insights/hero.css')) errors.push('article_hero_css_reference');
  if (!article.body.includes('class="insight-hero"')) errors.push('article_hero_markup');
  if (!index.ok || !index.body.includes(rel)) errors.push('index_thumbnail_reference');
  if (!article.body.includes(`<meta property="og:image" content="${heroUrl}">`)) errors.push('og_image_reference');
  if (!article.body.includes(`<meta name="twitter:image" content="${heroUrl}">`)) errors.push('twitter_image_reference');
  if (!hero.ok || !hero.contentType.toLowerCase().includes('image/webp')) errors.push('hero_webp');
  if (!heroCss.ok || !heroCss.body) errors.push('hero_css_http');
  else if (!validateCanonicalHeroCss(heroCss.body).ok) errors.push('hero_css_contract');
  return { ok: errors.length === 0, article, index, hero, heroCss, errors };
}

async function processCandidate({ root, config, candidate, runId, log, productionCheck, workspace, baseSha }) {
  const recoveryDir = path.join(config.logDir, 'recovery', candidate.slug, runId);
  fs.mkdirSync(recoveryDir, { recursive: true });
  try {
    const sourceArticle = path.join(workspace, 'insights', candidate.slug, 'index.html');
    const canon = fs.readFileSync(path.join(workspace, 'ARI_INSIGHTS_VISUAL_CANON.md'), 'utf8');
    fs.copyFileSync(sourceArticle, path.join(workspace, 'article.html'));
    let quality = null;
    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      log({ stage: 'CODEX_EXEC_STARTED', slug: candidate.slug, attempt });
      const generation = runNativeGeneration(workspace, candidate, canon, attempt);
      quality = generation.ok ? readQualityGate(workspace, attempt) : { ok: false, reason: generation.timedOut ? 'timeout' : 'codex_exec_failure' };
      log({ stage: 'GENERATION_RESULT', slug: candidate.slug, attempt, generation: { ok: generation.ok, status: generation.status, timedOut: generation.timedOut }, quality: quality.reason || 'pass' });
      log({ stage: 'QUALITY_RESULT', slug: candidate.slug, attempt, ok: quality.ok, reason: quality.reason || null });
      if (!generation.ok && (generation.capabilityFailure || generation.timedOut)) {
        return { finalResult: 'VISUAL_WORKER_SKIPPED', slug: candidate.slug, reason: generation.timedOut ? 'timeout' : 'capability_or_auth_failure' };
      }
      if (quality.ok) break;
    }
    if (!quality?.ok) return { finalResult: 'VISUAL_WORKER_SKIPPED_QUALITY', slug: candidate.slug };
    const heroOutput = canonicalHeroPath(config, candidate.slug).replace(config.root, workspace);
    optimizeToWebp(quality.imagePath, heroOutput, workspace);
    integrateCanonicalHero({ ...config, root: workspace, assetsPath: path.join(workspace, 'assets/insights') }, candidate.slug, { root: workspace });
    log({ stage: 'PRESENTATION_CHECK_STARTED', slug: candidate.slug });
    const presentation = repairPresentationContract(
      { ...config, root: workspace, assetsPath: path.join(workspace, 'assets/insights') },
      candidate.slug,
      { root: workspace },
    );
    log({ stage: 'PRESENTATION_RESULT', slug: candidate.slug, presentationState: presentation.status, presentationErrors: presentation.errors || [presentation.reason].filter(Boolean) });
    if (!presentation.ok) return { finalResult: 'VISUAL_WORKER_PRESENTATION_BLOCKED', slug: candidate.slug, presentation };
    const integration = validateIntegration({ ...config, root: workspace, assetsPath: path.join(workspace, 'assets/insights') }, candidate.slug, { root: workspace });
    if (!integration.ok) throw new Error(`integration_failed:${integration.errors.join(',')}`);
    const diff = runCommand('git', ['diff', '--name-only'], { cwd: workspace }).stdout.trim().split('\n').filter(Boolean);
    const allowed = new Set([`assets/insights/${candidate.slug}/hero.webp`, `insights/${candidate.slug}/index.html`, 'insights/index.html']);
    if (diff.some((file) => !allowed.has(file))) throw new Error(`unexpected_worker_diff:${diff.join(',')}`);
    runCommand('git', ['diff', '--check'], { cwd: workspace });
    runCommand('git', ['add', '--', ...[...allowed]], { cwd: workspace });
    const staged = runCommand('git', ['diff', '--cached', '--name-only'], { cwd: workspace }).stdout.trim().split('\n').filter(Boolean);
    if (staged.some((file) => !allowed.has(file))) throw new Error(`unexpected_staged_file:${staged.join(',')}`);
    runCommand('git', ['commit', '-m', `feat(insights): add hero for ${candidate.slug}`], { cwd: workspace });
    const commitSha = runCommand('git', ['rev-parse', 'HEAD'], { cwd: workspace }).stdout.trim();
    log({ stage: 'COMMIT_CREATED', slug: candidate.slug, commitSha, baseSha });
    runCommand('git', ['fetch', '--prune', 'origin'], { cwd: workspace });
    const base = readOriginMainSha(workspace);
    const parent = runCommand('git', ['rev-parse', 'HEAD^'], { cwd: workspace }).stdout.trim();
    log({ stage: 'PRE_PUSH_REMOTE_CHECK', slug: candidate.slug, baseSha, currentOriginMain: base, commitParent: parent });
    if (base !== baseSha || parent !== baseSha) throw new Error('VISUAL_WORKER_REMOTE_DIVERGED');
    runCommand('git', ['push', 'origin', 'HEAD:main'], { cwd: workspace });
    log({ stage: 'PUSH_RESULT', slug: candidate.slug, ok: true, force: false });
    const production = await verifyProductionReferences(config, candidate.slug, { productionCheck });
    log({ stage: 'PRODUCTION_VERIFY_RESULT', slug: candidate.slug, ok: production.ok, errors: production.errors });
    if (!production.ok) {
      fs.cpSync(quality.imagePath, path.join(recoveryDir, path.basename(quality.imagePath)));
      return { finalResult: 'PRODUCTION_VERIFY_FAILED', slug: candidate.slug, production, recoveryDir };
    }
    return { finalResult: 'SUCCESS', slug: candidate.slug, production };
  } finally { /* workspace cleanup is owned by runWorker */ }
}

export async function runWorker({ root = DEFAULT_ROOT, dryRun = false, simulate = false, now = new Date(), fetch = true, productionCheck, runId = makeRunId(now), configOverrides = {} } = {}) {
  const config = configFor(root, configOverrides);
  const log = createLogger(config, runId);
  log({ stage: 'RUN_STARTED', mode: dryRun ? 'dry-run' : simulate ? 'simulate' : 'run' });
  const lock = acquireLock(config.lockPath, { runId, now });
  if (!lock.acquired) {
    log({ stage: 'LOCK', finalResult: 'VISUAL_WORKER_SKIPPED', candidateState: 'lock_active' });
    return { finalResult: 'VISUAL_WORKER_SKIPPED', reason: 'lock_active', runId };
  }
  log({ stage: 'LOCK', acquired: true });
  let workspace = null;
  try {
    const safety = gitStatusIsSafe(root);
    if (safety.workerCodeDirty?.length) {
      throw new Error(`VISUAL_WORKER_CODE_DIRTY:${safety.workerCodeDirty.join(',')}`);
    }
    let sync;
    try {
      sync = checkRemoteDivergence(root, { fetch: !dryRun && fetch });
    } catch (error) {
      if (isNetworkFailure(error)) throw new Error(`VISUAL_WORKER_NETWORK_BLOCKED:${error.message}`);
      throw error;
    }
    log({ stage: 'FETCH_COMPLETED', fetched: !dryRun && fetch, remoteAhead: sync.remoteAhead, diverged: sync.diverged });
    if (sync.diverged) throw new Error('VISUAL_WORKER_REMOTE_DIVERGED');
    const baseSha = readOriginMainSha(root);
    log({ stage: 'BASE_SHA', baseSha });
    workspace = await createExecutionWorkspace(root, runId, baseSha, { readOnly: dryRun || simulate });
    log({ stage: 'WORKTREE_CREATED', workspace, baseSha, readOnly: dryRun || simulate });
    const workspaceConfig = configFor(workspace, { origin: config.origin, logDir: config.logDir, lockPath: config.lockPath, maxCandidates: config.maxCandidates });
    log({ stage: 'CANDIDATE_DISCOVERY_STARTED' });
    const discovered = await discoverCandidates(workspaceConfig, { productionCheck });
    log({ stage: discovered.candidates.length ? 'CANDIDATE_SELECTED' : 'NO_CANDIDATE', candidates: discovered.candidates.map((a) => a.slug), reasons: discovered.reasons.slice(0, 30) });
    if (!discovered.candidates.length) return { finalResult: 'NO_CANDIDATE', runId, reasons: discovered.reasons };
    const candidate = discovered.candidates[0];
    if (dryRun || simulate) return { finalResult: 'DRY_RUN_CANDIDATE', runId, slug: candidate.slug, title: candidate.title };
    const result = await processCandidate({ root, config, candidate, runId, log, productionCheck, workspace, baseSha });
    log({ slug: candidate.slug, finalResult: result.finalResult });
    return { ...result, runId };
  } catch (error) {
    const finalResult = classifyWorkerFailure(error);
    log({ stage: 'ERROR', finalResult, error: error.message });
    return { finalResult, error: error.message, runId };
  } finally {
    if (workspace) {
      removeIsolatedWorktree(root, workspace);
      log({ stage: 'WORKTREE_CLEANUP', workspace });
    }
    log({ stage: 'FINAL_RESULT', runId });
    lock.release();
  }
}
