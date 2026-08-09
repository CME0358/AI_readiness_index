import { findNextHoldArticle, findScheduledArticle, resolvePublishYmd } from '../unlock-next-insight.mjs';
import { EDITORIAL_STATUSES } from '../editorial-status.mjs';
import { PRIORITY_BANDS } from './constants.mjs';

/**
 * Propose schedule preemption for P0/P1 — does NOT mutate schedule.
 */
export function proposeScheduleChange(candidate, schedule, { now = new Date() } = {}) {
  if (![PRIORITY_BANDS.P0, PRIORITY_BANDS.P1].includes(candidate.priority)) {
    return {
      applicable: false,
      reason: 'not_preempt_priority',
      candidate: candidate.event_id,
    };
  }

  const publishYmd = resolvePublishYmd({ now });
  const scheduled = findScheduledArticle(schedule);
  const nextHold = findNextHoldArticle(schedule);

  let targetSlot = publishYmd;
  let displaced = scheduled?.slug || nextHold?.slug || null;
  let displacedStatus = scheduled?.status || nextHold?.status || EDITORIAL_STATUSES.HOLD;
  let newDisplacedSlot = null;

  if (scheduled) {
    const holdQueue = schedule.articles.filter(
      (a) => a.series === 'v2' && a.status === EDITORIAL_STATUSES.HOLD && a.slug !== displaced,
    );
    newDisplacedSlot = holdQueue.length ? 'next_available_weekday' : 'end_of_hold_queue';
  } else if (nextHold) {
    displaced = nextHold.slug;
    newDisplacedSlot = 'shifted_one_slot_later';
  }

  return {
    applicable: true,
    candidate: candidate.event_id,
    candidate_slug: candidate.slug_proposal,
    target_slot: targetSlot,
    displaced_article: displaced,
    displaced_status: displacedStatus,
    new_displaced_slot: newDisplacedSlot,
    mutation_executed: false,
    mode: 'proposal_only',
  };
}

export function getNextAvailableSlot(schedule, { now = new Date() } = {}) {
  const publishYmd = resolvePublishYmd({ now });
  const scheduled = findScheduledArticle(schedule);
  const nextHold = findNextHoldArticle(schedule);
  return {
    next_available_slot: publishYmd,
    current_occupant: scheduled?.slug || null,
    occupant_priority: scheduled ? 'P2_EVERGREEN' : null,
    next_hold_evergreen: nextHold?.slug || null,
  };
}
