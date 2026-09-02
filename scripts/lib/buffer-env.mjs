import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BUFFER_ENV_KEYS = Object.freeze([
  'BUFFER_ACCESS_TOKEN',
  'BUFFER_CHANNEL_ID',
  'BUFFER_CHANNEL_ID_LINKEDIN',
  'BUFFER_CHANNEL_ID_FACEBOOK',
  'BUFFER_CHANNEL_ID_TWITTER',
  'BUFFER_ORGANIZATION_ID',
]);

export function canonicalBufferEnvPath(env = process.env) {
  return env.ARI_BUFFER_ENV_FILE?.trim() || path.join(
    os.homedir(),
    'Downloads/Obsidian_Vault/10_Projects/Agent Readiness/.env',
  );
}

/** Load only approved Buffer keys; pre-existing process env always wins. */
export function loadCanonicalBufferEnv({ env = process.env, file = canonicalBufferEnvPath(env) } = {}) {
  if (!fs.existsSync(file)) return { loaded: false, source: file, present: [] };
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !BUFFER_ENV_KEYS.includes(match[1]) || env[match[1]]) continue;
    env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return { loaded: true, source: file, present: BUFFER_ENV_KEYS.filter((key) => Boolean(env[key]?.trim())) };
}
