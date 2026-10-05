/**
 * Required Insights hero toolchain: Codex Native (`codex exec`) plus the Mac
 * `convert-webp.mjs` converter. Pillow, GenerateImage, ffmpeg drawtext, and
 * bare `cwebp` are not substitutes. If this toolchain is missing, callers
 * must leave packageReadiness HERO_PENDING and skip image generation.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export const INSIGHTS_HERO_CONVERT_WEBP = '/Users/takeshisasaki/ari-webp-tool-l5sDwJ/convert-webp.mjs';
export const INSIGHTS_HERO_CONVERT_NODE = '/usr/local/bin/node';

export const FORBIDDEN_INSIGHTS_HERO_FALLBACKS = Object.freeze([
  'Pillow',
  'GenerateImage',
  'ffmpeg drawtext',
  'cwebp',
]);

export const INSIGHTS_HERO_TOOLCHAIN_CODE = 'INSIGHTS_HERO_TOOLCHAIN_MISSING';

const FORBIDDEN_HELP = `Do not fall back to ${FORBIDDEN_INSIGHTS_HERO_FALLBACKS.join(', ')}. Leave packageReadiness HERO_PENDING and skip image generation.`;

export function codexNativeExecArgs(workspace, outputPath) {
  return [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--cd',
    workspace,
    '--sandbox',
    'workspace-write',
    '--output-last-message',
    outputPath,
  ];
}

function defaultWhichCodex() {
  const result = spawnSync('which', ['codex'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout?.trim()) return result.stdout.trim();
  return '';
}

export function inspectInsightsHeroToolchain({
  whichCodex = defaultWhichCodex,
  existsSync = fs.existsSync,
} = {}) {
  const missing = [];
  let codexPath = '';
  try {
    codexPath = whichCodex() || '';
  } catch {
    codexPath = '';
  }
  if (!codexPath) missing.push('codex');
  if (!existsSync(INSIGHTS_HERO_CONVERT_NODE)) missing.push(INSIGHTS_HERO_CONVERT_NODE);
  if (!existsSync(INSIGHTS_HERO_CONVERT_WEBP)) missing.push(INSIGHTS_HERO_CONVERT_WEBP);
  return {
    ok: missing.length === 0,
    missing,
    codexPath,
    converter: INSIGHTS_HERO_CONVERT_WEBP,
    nodePath: INSIGHTS_HERO_CONVERT_NODE,
  };
}

export function insightsHeroToolchainError(missing) {
  const error = new Error(
    `${INSIGHTS_HERO_TOOLCHAIN_CODE}: Insights heroes require Codex Native (codex exec --ephemeral --skip-git-repo-check --sandbox workspace-write) and ${INSIGHTS_HERO_CONVERT_WEBP} via ${INSIGHTS_HERO_CONVERT_NODE}. Missing: ${missing.join(', ')}. ${FORBIDDEN_HELP}`,
  );
  error.code = INSIGHTS_HERO_TOOLCHAIN_CODE;
  error.missing = missing;
  return error;
}

export function assertInsightsHeroToolchain(options = {}) {
  const report = inspectInsightsHeroToolchain(options);
  if (!report.ok) throw insightsHeroToolchainError(report.missing);
  return report;
}
