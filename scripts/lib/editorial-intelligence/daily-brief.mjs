import { PRIORITY_BANDS } from './constants.mjs';
import { QUEUE_LIFECYCLE } from './queue-reconcile.mjs';

function activeEntries(entries = []) {
  return entries.filter((e) => !e.lifecycle || e.lifecycle === QUEUE_LIFECYCLE.ACTIVE);
}

export function generateDailyBrief({
  alerts = [],
  queue = { entries: [] },
  ignored = [],
  processed = [],
  blocked = [],
  registry = { sources: [] },
  slot = {},
  dryRun = true,
} = {}) {
  const active = activeEntries(queue.entries);
  const p0 = active.filter((e) => e.priority === PRIORITY_BANDS.P0);
  const p1 = active.filter((e) => e.priority === PRIORITY_BANDS.P1);
  const p2 = active.filter((e) => e.priority === PRIORITY_BANDS.P2);
  const refresh = processed.filter((e) => e.article_type === 'EXISTING_ARTICLE_REFRESH');

  const lines = [
    '# Editorial Intelligence Daily Brief',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${dryRun ? 'DRY RUN' : 'LIVE (no auto-publish)'}`,
    '',
    '## Critical P0',
    '',
  ];

  if (p0.length === 0) lines.push('- (none)');
  else for (const e of p0) lines.push(`- **${e.company}** — ${e.title} (score ${e.score})`);

  lines.push('', '## High Priority P1', '');
  if (p1.length === 0) lines.push('- (none)');
  else for (const e of p1) lines.push(`- **${e.company}** — ${e.title} (score ${e.score})`);

  lines.push('', '## Standard P2', '');
  if (p2.length === 0) lines.push('- (none)');
  else for (const e of p2) lines.push(`- ${e.company} — ${e.title}`);

  lines.push('', '## Refresh Opportunities', '');
  if (refresh.length === 0) lines.push('- (none)');
  else {
    for (const e of refresh) {
      lines.push(`- ${e.title} → refresh \`${e.canonical_conflict}\``);
    }
  }

  lines.push('', '## Ignored / Low Relevance', '');
  if (ignored.length === 0) lines.push('- (none)');
  else for (const e of ignored.slice(0, 10)) lines.push(`- ${e.company}: ${e.title} (score ${e.score})`);

  lines.push('', '## Blocked', '');
  if (blocked.length === 0) lines.push('- (none)');
  else for (const b of blocked) lines.push(`- ${b.event_id}: ${b.reason}`);

  lines.push('', '## Breaking Alerts', '');
  if (alerts.length === 0) lines.push('- (none)');
  else {
    for (const a of alerts) {
      lines.push(`### ${a.company}: ${a.title}`);
      lines.push(`- Score: ${a.score} · Priority: ${a.priority}`);
      lines.push(`- Source: ${a.source}`);
      lines.push(`- Recommended: ${a.recommended_action}`);
      lines.push(`- Conflict: ${a.existing_page_conflict}`);
      lines.push('');
    }
  }

  lines.push('## Source Health', '');
  for (const s of registry.sources || []) {
    lines.push(`- **${s.company}** (${s.source_id}): ${s.health_status || 'UNKNOWN'} · failures ${s.consecutive_failures || 0}`);
  }

  lines.push('', '## Queue Impact / Schedule Simulation', '');
  lines.push(`- Next slot: ${slot.next_available_slot || 'TBD'}`);
  lines.push(`- Current occupant: ${slot.current_occupant || 'none'}`);
  lines.push(`- Next evergreen hold: ${slot.next_hold_evergreen || 'none'}`);
  lines.push('- Schedule mutation executed: **NO**');
  lines.push('- Human approval required before publish: **YES**');
  lines.push('');

  return lines.join('\n');
}
