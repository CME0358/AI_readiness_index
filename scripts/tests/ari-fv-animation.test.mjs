#!/usr/bin/env node
/**
 * ARI FV animation — timeline architecture tests
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

function loadMaster() {
  const code = fs.readFileSync(path.join(ROOT, 'assets/ari-fv-timeline.js'), 'utf8');
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function('window', code.replace('typeof window !== \'undefined\' ? window : globalThis', 'window'))(sandbox.window);
  return sandbox.window.ARI_FV_MASTER;
}

test('ARI FV master duration is 50s with 5 industries', () => {
  const master = loadMaster();
  assert.equal(master.duration, 50);
  assert.equal(master.industries.length, 5);
  assert.equal(master.id, 'ARI-FV-MASTER');
});

test('ARI FV industries cover 0–50s without gaps', () => {
  const master = loadMaster();
  master.industries.forEach((ind, i) => {
    assert.equal(ind.duration, 10);
    assert.equal(ind.start, i * 10);
    assert.equal(ind.phases.length, 6);
    assert.equal(ind.phases[0].phase, 'search');
    assert.equal(ind.phases[0].offset, 0);
    assert.equal(ind.phases[0].duration, 2);
    assert.equal(ind.phases[4].phase, 'recommend');
    assert.equal(ind.phases[5].phase, 'transition');
    assert.equal(ind.phases[5].offset, 9.6);
  });
});

test('ARI FV homepage uses animation mount, not hero image', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(home, /id="ari-fv-animation"/);
  assert.match(home, /ari-fv-animation\.css/);
  assert.match(home, /ari-fv-timeline\.js/);
  assert.doesNotMatch(home, /agent-readiness-hero\.webp/);
});

test('ARI FV homepage loads GSAP for animation', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(home, /gsap@3\.14\.2/);
  assert.match(home, /ari-fv-animation\.js/);
});

test('ARI FV device frame asset is in assets/device', () => {
  const frame = path.join(ROOT, 'assets/device/mockup_iphone16-frame.webp');
  const original = path.join(ROOT, 'assets/device/mockup_iphone16.webp');
  assert.ok(fs.existsSync(frame), 'frame asset missing');
  assert.ok(fs.existsSync(original), 'original asset missing');
  const js = fs.readFileSync(path.join(ROOT, 'assets/ari-fv-animation.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/ari-fv-animation.css'), 'utf8');
  assert.match(js, /assets\/device\/mockup_iphone16-frame\.webp/);
  assert.match(css, /--ari-fv-screen-inset:\s*1px/);
  assert.match(css, /--ari-fv-glass-peak:\s*0\.18/);
  assert.match(css, /ari-fv-device__glass-reflection-dark/);
  assert.match(css, /ari-fv-device__glass-edge-falloff/);
});

test('ARI FV left column copy unchanged', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(home, /AIに「見つかる」だけでなく/);
  assert.match(home, /Agent Readiness Research Hub/);
  assert.match(home, /Frameworkを見る/);
  assert.match(home, /診断を申し込む/);
});

test('ARI FV hero image asset only used outside homepage', () => {
  const refs = [];
  const skip = new Set(['node_modules', '.git', 'public_build', '.venv-tts']);
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (skip.has(name)) continue;
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) walk(full);
      else if (/\.(html|jsx|js|css|md|mjs)$/.test(name) && !full.includes(`${path.sep}scripts${path.sep}tests${path.sep}`)) {
        const src = fs.readFileSync(full, 'utf8');
        if (src.includes('agent-readiness-hero.webp')) refs.push(path.relative(ROOT, full));
      }
    }
  }
  walk(ROOT);
  assert.deepEqual(refs.sort(), [
    'video/readiness-promo-60s/hyperframes/capture/extracted/page.html'
  ]);
});
