import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateHoldStockHero } from '../lib/phase3-stock-build.mjs';
import {
  CANONICAL_HERO_SIZE,
  classifyWorkerFailure,
  createBriefPrompt,
  optimizeToWebp,
  runNativeGeneration,
} from '../lib/local-visual-worker.mjs';
import {
  FORBIDDEN_INSIGHTS_HERO_FALLBACKS,
  INSIGHTS_HERO_CONVERT_NODE,
  INSIGHTS_HERO_CONVERT_WEBP,
  INSIGHTS_HERO_TOOLCHAIN_CODE,
  assertInsightsHeroToolchain,
  codexNativeExecArgs,
  inspectInsightsHeroToolchain,
} from '../lib/insights-hero-toolchain.mjs';

function missingToolchain() {
  const error = new Error(`${INSIGHTS_HERO_TOOLCHAIN_CODE}: codex`);
  error.code = INSIGHTS_HERO_TOOLCHAIN_CODE;
  error.missing = ['codex'];
  return error;
}

test('converter path stays on the historical Mac convert-webp.mjs', () => {
  assert.equal(INSIGHTS_HERO_CONVERT_WEBP, '/Users/takeshisasaki/ari-webp-tool-l5sDwJ/convert-webp.mjs');
  assert.equal(INSIGHTS_HERO_CONVERT_NODE, '/usr/local/bin/node');
  assert.deepEqual(FORBIDDEN_INSIGHTS_HERO_FALLBACKS, ['Pillow', 'GenerateImage', 'ffmpeg drawtext', 'cwebp']);
});

test('codex exec keeps the native workspace-write flags', () => {
  assert.deepEqual(codexNativeExecArgs('/tmp/ws', '/tmp/ws/codex-1.final.txt'), [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--cd',
    '/tmp/ws',
    '--sandbox',
    'workspace-write',
    '--output-last-message',
    '/tmp/ws/codex-1.final.txt',
  ]);
});

test('toolchain inspection hard-fails when codex or convert-webp is missing', () => {
  const report = inspectInsightsHeroToolchain({
    whichCodex: () => '',
    existsSync: () => false,
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, ['codex', INSIGHTS_HERO_CONVERT_NODE, INSIGHTS_HERO_CONVERT_WEBP]);
  assert.throws(
    () => assertInsightsHeroToolchain({ whichCodex: () => '', existsSync: () => false }),
    (error) => error.code === INSIGHTS_HERO_TOOLCHAIN_CODE
      && /Pillow/.test(error.message)
      && /GenerateImage/.test(error.message)
      && /cwebp/.test(error.message)
      && /HERO_PENDING/.test(error.message),
  );
});

test('toolchain inspection passes only when codex and convert-webp.mjs exist', () => {
  const report = inspectInsightsHeroToolchain({
    whichCodex: () => '/usr/local/bin/codex',
    existsSync: (file) => file === INSIGHTS_HERO_CONVERT_NODE || file === INSIGHTS_HERO_CONVERT_WEBP,
  });
  assert.equal(report.ok, true);
  assert.equal(report.converter, INSIGHTS_HERO_CONVERT_WEBP);
});

test('worker classifies a missing toolchain as a hard failure', () => {
  assert.equal(classifyWorkerFailure(missingToolchain()), 'VISUAL_WORKER_TOOLCHAIN_MISSING');
  assert.equal(classifyWorkerFailure(new Error('VISUAL_WORKER_REMOTE_DIVERGED')), 'VISUAL_WORKER_REMOTE_DIVERGED');
});

test('runNativeGeneration does not spawn codex when the toolchain is missing', () => {
  assert.throws(
    () => runNativeGeneration('/tmp/unused', { slug: 'x' }, 'canon', 1, {
      assertToolchain: () => { throw missingToolchain(); },
      run: () => { throw new Error('codex must not be invoked'); },
    }),
    (error) => error.code === INSIGHTS_HERO_TOOLCHAIN_CODE,
  );
});

test('runNativeGeneration calls codex exec and rejects a missing binary', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-hero-native-'));
  fs.writeFileSync(path.join(workspace, 'article.html'), '<article>本文</article>');
  let captured = null;
  assert.throws(
    () => runNativeGeneration(workspace, { slug: 'native-slug' }, 'TYPOGRAPHIC MODE ONLY', 1, {
      assertToolchain: () => ({ ok: true }),
      run: (command, args) => {
        captured = { command, args };
        return { status: null, stdout: '', stderr: '', error: { code: 'ENOENT' } };
      },
    }),
    (error) => error.code === INSIGHTS_HERO_TOOLCHAIN_CODE && error.missing.includes('codex'),
  );
  assert.equal(captured.command, 'codex');
  assert.deepEqual(captured.args, codexNativeExecArgs(workspace, path.join(workspace, 'codex-1.final.txt')));
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('optimizeToWebp refuses Pillow and bare cwebp substitutes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-hero-webp-'));
  const input = path.join(dir, 'generation-1.png');
  const output = path.join(dir, 'hero.webp');
  fs.writeFileSync(input, 'png');
  assert.throws(
    () => optimizeToWebp(input, output, dir, {
      assertToolchain: () => ({ ok: true, nodePath: '/usr/bin/cwebp', converter: '/tmp/cwebp' }),
      run: () => { throw new Error('cwebp must not be invoked'); },
    }),
    (error) => error.code === INSIGHTS_HERO_TOOLCHAIN_CODE,
  );
  assert.equal(fs.existsSync(output), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('optimizeToWebp invokes convert-webp.mjs through the Mac node path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-hero-webp-'));
  const input = path.join(dir, 'generation-1.png');
  const output = path.join(dir, 'nested', 'hero.webp');
  fs.writeFileSync(input, 'png');
  let captured = null;
  const written = optimizeToWebp(input, output, dir, {
    assertToolchain: () => ({
      ok: true,
      nodePath: INSIGHTS_HERO_CONVERT_NODE,
      converter: INSIGHTS_HERO_CONVERT_WEBP,
    }),
    run: (command, args) => {
      captured = { command, args };
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, 'webp');
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.equal(written, output);
  assert.deepEqual(captured, {
    command: INSIGHTS_HERO_CONVERT_NODE,
    args: [INSIGHTS_HERO_CONVERT_WEBP, input, output],
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hold-stock generation leaves no hero.webp when Codex Native is unavailable', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-hero-stock-'));
  const slug = 'toolchain-missing';
  fs.mkdirSync(path.join(root, 'insights/_scheduled', slug), { recursive: true });
  fs.writeFileSync(path.join(root, 'insights/_scheduled', slug, 'index.html'), '<article></article>');
  const result = await generateHoldStockHero(slug, {
    root,
    assertToolchain: () => { throw missingToolchain(); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'HERO_TOOLCHAIN_MISSING');
  assert.equal(result.attempts, 0);
  assert.equal(result.toolchainMissing, true);
  assert.equal(fs.existsSync(path.join(root, 'assets/insights', slug, 'hero.webp')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('brief contract and canonical hero size stay unchanged', () => {
  assert.deepEqual(CANONICAL_HERO_SIZE, { width: 1672, height: 941 });
  const prompt = createBriefPrompt({
    articleHtml: '<article>本文</article>',
    canon: 'TYPOGRAPHIC MODE ONLY',
    slug: 'x',
    attempt: 1,
    outputDir: '/private/tmp/test',
  });
  assert.match(prompt, /MODE is TYPOGRAPHIC ONLY/);
  assert.match(prompt, /visual-brief.json/);
  assert.match(prompt, /at most one Japanese headline of 12 characters/);
  assert.match(prompt, /ChatGPT-login Native image generation only/);
});
