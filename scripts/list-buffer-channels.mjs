#!/usr/bin/env node
/**
 * List Buffer channels (id, service, name) for .env BUFFER_CHANNEL_ID setup.
 * Usage: node scripts/list-buffer-channels.mjs
 * Requires: BUFFER_ACCESS_TOKEN in .env or env
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bufferGraphql, getBufferConfig } from './lib/buffer-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const QUERY = `
query AccountChannels {
  account {
    email
    organizations {
      id
      name
      channelCount
    }
  }
}
`;

const CHANNELS_QUERY = `
query OrgChannels($input: ChannelsInput!) {
  channels(input: $input) {
    id
    name
    displayName
    service
    type
    isDisconnected
  }
}
`;

async function main() {
  const cfg = getBufferConfig();
  if (!cfg.accessToken) {
    console.error('Set BUFFER_ACCESS_TOKEN in .env (from https://publish.buffer.com/settings/api)');
    process.exit(1);
  }

  const acc = await bufferGraphql(cfg.accessToken, QUERY, {});
  const orgs = acc.data?.account?.organizations || [];
  console.log('Account:', acc.data?.account?.email);
  console.log('');

  for (const org of orgs) {
    console.log(`Organization: ${org.name} (${org.id}) — channels: ${org.channelCount}`);
    const res = await bufferGraphql(cfg.accessToken, CHANNELS_QUERY, {
      input: { organizationId: org.id },
    });
    for (const ch of res.data?.channels || []) {
      const mark = ch.id === cfg.channelId ? ' ← BUFFER_CHANNEL_ID (current)' : '';
      console.log(
        `  [${ch.service}] ${ch.displayName || ch.name}  id=${ch.id}  type=${ch.type}${ch.isDisconnected ? ' (disconnected)' : ''}${mark}`
      );
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
