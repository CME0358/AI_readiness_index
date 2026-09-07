import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  extractHttpsUrl,
  fetchChannelPosts,
  runAudit,
} from '../audit-buffer-future-queue.mjs';

const NOW = new Date('2026-09-07T00:00:00.000Z');
const cfg = {
  accessToken: 'test-token',
  organizationId: 'org-test',
  channelIds: { x: 'channel-x', linkedin: 'channel-li', facebook: 'channel-fb' },
};

function page(nodes, hasNextPage = false, endCursor = null) {
  return { data: { posts: { edges: nodes.map((node) => ({ node })), pageInfo: { hasNextPage, endCursor } } } };
}

function post(id, channelId, dueAt, status = 'scheduled', text = `https://readiness.coaretail.com/insights/${id}/`) {
  return { id, channelId, dueAt, status, text };
}

test('A: one-page channel returns nodes and passes variables', async () => {
  const calls = [];
  const posts = await fetchChannelPosts({
    accessToken: 'token', organizationId: 'org', channelId: 'channel-x',
    graphql: async (_token, query, variables) => {
      calls.push({ query, variables });
      return page([post('one', 'channel-x', '2026-09-10T00:00:00Z')]);
    },
  });
  assert.equal(posts.length, 1);
  assert.deepEqual(calls[0].variables, { organizationId: 'org', channelId: 'channel-x', after: null });
  assert.match(calls[0].query, /\$organizationId/);
  assert.match(calls[0].query, /after: \$after/);
  assert.match(calls[0].query, /pageInfo \{ hasNextPage endCursor \}/);
});

test('B: multi-page channel follows endCursor to completion', async () => {
  const afters = [];
  const posts = await fetchChannelPosts({
    accessToken: 'token', organizationId: 'org', channelId: 'channel-x',
    graphql: async (_token, _query, variables) => {
      afters.push(variables.after);
      return variables.after === null
        ? page([post('one', 'channel-x', '2026-09-10T00:00:00Z')], true, 'cursor-1')
        : page([post('two', 'channel-x', '2026-09-11T00:00:00Z')]);
    },
  });
  assert.deepEqual(afters, [null, 'cursor-1']);
  assert.deepEqual(posts.map((item) => item.id), ['one', 'two']);
});

test('C: all three channels paginate independently', async () => {
  const calls = [];
  const output = await runAudit({
    now: NOW, cfg,
    graphql: async (_token, _query, variables) => {
      calls.push(variables);
      const first = variables.after === null;
      const id = variables.channelId === 'channel-x' ? 'x' : variables.channelId === 'channel-li' ? 'li' : 'fb';
      return first
        ? page([post(`${id}-1`, variables.channelId, '2026-09-10T00:00:00Z')], true, `${id}-cursor`)
        : page([post(`${id}-2`, variables.channelId, '2026-09-11T00:00:00Z')]);
    },
  });
  assert.equal(calls.length, 6);
  assert.deepEqual(output.by_channel, { x: 2, linkedin: 2, facebook: 2 });
});

test('D: repeated cursor fails closed', async () => {
  await assert.rejects(() => fetchChannelPosts({
    accessToken: 'token', organizationId: 'org', channelId: 'channel-x',
    graphql: async () => page([post('one', 'channel-x', '2026-09-10T00:00:00Z')], true, 'same'),
  }), /cursor repeated/);
});

test('E: next page without cursor fails closed', async () => {
  await assert.rejects(() => fetchChannelPosts({
    accessToken: 'token', organizationId: 'org', channelId: 'channel-x',
    graphql: async () => page([], true, ''),
  }), /missing endCursor/);
});

test('F: page safety limit fails closed', async () => {
  await assert.rejects(() => fetchChannelPosts({
    accessToken: 'token', organizationId: 'org', channelId: 'channel-x', maxPages: 2,
    graphql: async (_token, _query, variables) => page([], true, `cursor-${variables.after || 'first'}`),
  }), /exceeded max pages \(2\)/);
});

test('G: mismatched channel ID fails closed', async () => {
  await assert.rejects(() => fetchChannelPosts({
    accessToken: 'token', organizationId: 'org', channelId: 'channel-x',
    graphql: async () => page([post('wrong', 'channel-li', '2026-09-10T00:00:00Z')]),
  }), /channel mismatch/);
});

test('H/I: future filter retains future mixed statuses and excludes past posts', async () => {
  const output = await runAudit({
    now: NOW, cfg,
    graphql: async (_token, _query, variables) => page([
      post(`future-${variables.channelId}`, variables.channelId, '2026-09-08T00:00:00Z', 'pending'),
      post(`past-${variables.channelId}`, variables.channelId, '2026-09-06T00:00:00Z', 'sent'),
    ]),
  });
  assert.equal(output.total, 3);
  assert.deepEqual(new Set(output.posts.map((item) => item.status)), new Set(['pending']));
});

test('J/K/L: extracts insights, go, and arbitrary HTTPS URLs', () => {
  assert.equal(extractHttpsUrl('see https://readiness.coaretail.com/insights/example/'), 'https://readiness.coaretail.com/insights/example/');
  assert.equal(extractHttpsUrl('see https://readiness.coaretail.com/go/x260907d'), 'https://readiness.coaretail.com/go/x260907d');
  assert.equal(extractHttpsUrl('see https://example.com/path?q=1.'), 'https://example.com/path?q=1');
});

test('M: output sorting is scheduled time, channel, then remote ID', async () => {
  const output = await runAudit({
    now: NOW, cfg,
    graphql: async (_token, _query, variables) => page([
      post(`z-${variables.channelId}`, variables.channelId, '2026-09-10T00:00:00Z'),
      post(`a-${variables.channelId}`, variables.channelId, '2026-09-09T00:00:00Z'),
    ]),
  });
  assert.deepEqual(output.posts.map((item) => item.scheduled_at), [
    '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z',
    '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z',
  ]);
  assert.deepEqual(output.posts.slice(0, 3).map((item) => item.channel), ['facebook', 'linkedin', 'x']);
});

test('N: BFQ implementation has no Buffer mutation operations or secret logging', () => {
  const source = fs.readFileSync(new URL('../audit-buffer-future-queue.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /createPost|updatePost|deletePost|publishPost|reschedule/);
  assert.doesNotMatch(source, /Authorization|Bearer|BUFFER_ACCESS_TOKEN.*console/);
});
