/**
 * Lightweight editorial intent contract for Insights planning and CTA routing.
 * This is repository metadata only; it does not create or migrate storage.
 */

export const EDITORIAL_INTENTS = Object.freeze({
  PROBLEM_AWARE: 'PROBLEM_AWARE',
  EVIDENCE: 'EVIDENCE',
  NEWS: 'NEWS',
  SOLUTION_AWARE: 'SOLUTION_AWARE',
  PRODUCT_AWARE: 'PRODUCT_AWARE',
  RESEARCH: 'RESEARCH',
});

export const EDITORIAL_INTENT_VALUES = Object.freeze(Object.values(EDITORIAL_INTENTS));

export const WEEKLY_EDITORIAL_TARGET = Object.freeze({
  [EDITORIAL_INTENTS.PROBLEM_AWARE]: 3,
  [EDITORIAL_INTENTS.EVIDENCE]: 1,
  [EDITORIAL_INTENTS.NEWS]: 1,
});

const LOCAL_TERMS = /店舗|歯科|クリニック|美容|エステ|フィットネス|地域サービス|小売|来店|MEO/i;
const PROBLEM_TERMS = /出てこない|認識されない|推薦されない|何から|対策|予約|購入|問い合わせ|来店|確認する方法/i;
const PRODUCT_TERMS = /SaaS|選定|ベンダー|費用|価格|外注|自社対応/i;
const EVIDENCE_TERMS = /観測|計測|検証|比較結果|実測|調査結果|画面|変化/i;

function textOf(article = {}) {
  return [article.title, article.cardSummary, article.seoTitle, article.primarySearchIntent, article.metaDescription]
    .filter(Boolean)
    .join(' ');
}

export function normalizeEditorialIntent(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return EDITORIAL_INTENT_VALUES.includes(normalized) ? normalized : null;
}

export function isLocalIntent(article = {}) {
  const text = textOf(article);
  return LOCAL_TERMS.test(text) && (PROBLEM_TERMS.test(text) || /集客|AI検索|推薦/i.test(text));
}

/**
 * Explicit metadata always wins. Fallbacks are deliberately conservative:
 * current events are NEWS, clear operational questions are PROBLEM_AWARE,
 * and everything else defaults to RESEARCH.
 */
export function classifyEditorialIntent(article = {}) {
  const explicit = normalizeEditorialIntent(article.editorialIntent);
  if (explicit) return explicit;
  if (article.series === 'current-event' || article.editorialType === 'current_event') return EDITORIAL_INTENTS.NEWS;
  const type = String(article.editorialType || '').toLowerCase();
  if (type === 'evidence' || type === 'measured_observation') return EDITORIAL_INTENTS.EVIDENCE;
  if (type === 'product_aware') return EDITORIAL_INTENTS.PRODUCT_AWARE;
  if (type === 'problem_aware') return EDITORIAL_INTENTS.PROBLEM_AWARE;

  const text = textOf(article);
  if (PRODUCT_TERMS.test(text)) return EDITORIAL_INTENTS.PRODUCT_AWARE;
  if (article.searchIntentClass === 'A' && PROBLEM_TERMS.test(text)) return EDITORIAL_INTENTS.PROBLEM_AWARE;
  if (article.searchIntentClass === 'B' && EVIDENCE_TERMS.test(text)) return EDITORIAL_INTENTS.EVIDENCE;
  return EDITORIAL_INTENTS.RESEARCH;
}

export function countEditorialIntents(articles = [], { eligibleOnly = false } = {}) {
  const counts = Object.fromEntries(EDITORIAL_INTENT_VALUES.map((intent) => [intent, 0]));
  for (const article of articles) {
    if (eligibleOnly && !['scheduled', 'editorial_hold', 'ready_for_schedule'].includes(article.status)) continue;
    counts[classifyEditorialIntent(article)] += 1;
  }
  return counts;
}

function neededIntents(selected) {
  return Object.entries(WEEKLY_EDITORIAL_TARGET)
    .map(([intent, target]) => ({ intent, remaining: Math.max(0, target - (selected[intent] || 0)) }))
    .sort((a, b) => b.remaining - a.remaining || a.intent.localeCompare(b.intent));
}

/**
 * Select a bounded weekday plan without mutating schedule or queue state.
 * Current-event NEWS is retained as an override, then remaining slots rebalance.
 */
export function planWeeklyEditorialMix(articles = [], { slots = 5, existing = [] } = {}) {
  const selected = Object.fromEntries(EDITORIAL_INTENT_VALUES.map((intent) => [intent, 0]));
  const used = new Set();
  for (const article of existing) {
    if (article?.slug) used.add(article.slug);
    selected[classifyEditorialIntent(article)] += 1;
  }

  const candidates = articles
    .filter((article) => article?.slug && !used.has(article.slug) && article.status !== 'published')
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  const chosen = [];

  const currentNews = candidates.find((article) => classifyEditorialIntent(article) === EDITORIAL_INTENTS.NEWS && (article.series === 'current-event' || article.editorialType === 'current_event'));
  if (currentNews && chosen.length < slots) {
    chosen.push(currentNews);
    used.add(currentNews.slug);
    selected[EDITORIAL_INTENTS.NEWS] += 1;
  }

  while (chosen.length < slots) {
    const needs = neededIntents(selected);
    const preferred = needs.find(({ remaining }) => remaining > 0);
    const pool = candidates.filter((article) => !used.has(article.slug));
    if (!pool.length) break;
    const next = preferred
      ? pool.find((article) => classifyEditorialIntent(article) === preferred.intent) || pool[0]
      : pool[0];
    chosen.push(next);
    used.add(next.slug);
    selected[classifyEditorialIntent(next)] += 1;
  }

  const missing = Object.entries(WEEKLY_EDITORIAL_TARGET)
    .filter(([intent, target]) => selected[intent] < target)
    .map(([intent, target]) => ({ intent, missing: target - selected[intent] }));
  return {
    target: WEEKLY_EDITORIAL_TARGET,
    selected: chosen,
    counts: selected,
    missing,
    status: missing.length ? 'EDITORIAL_MIX_DEGRADED' : 'EDITORIAL_MIX_TARGET_MET',
  };
}

export function ctaIntentProfile(intent, { local = false } = {}) {
  const check = { type: 'CHECK', label: '自社サイトを無料で確認する', destination: '/#company-check' };
  const report = { type: 'REPORT', label: 'Company Reportで詳しく調べる', destination: '/report/' };
  const learn = { type: 'LEARN', label: '無料ガイドを見る', destination: '/whitepaper/2026/free/' };
  const localCta = { type: 'LOCAL', label: '店舗・クリニックの集客改善を任せたい', destination: 'https://localgeo.coaretail.com/?utm_source=ari_insights&utm_medium=outbound&utm_campaign=direct_buyer&utm_content=insight_local' };
  const profiles = {
    PROBLEM_AWARE: [check, ...(local ? [localCta] : [report])],
    EVIDENCE: [check, report],
    NEWS: [learn, check],
    SOLUTION_AWARE: [check, report],
    PRODUCT_AWARE: [report, check],
    RESEARCH: [learn, check],
  };
  return profiles[intent] || [learn, check];
}

export function socialFramingGuidance(intent, channel) {
  const guidance = {
    x: { hook: 'concrete_observation', cta: 'CHECK_or_article_link' },
    linkedin: { hook: 'management_implication', cta: 'decision_framing' },
    facebook: { hook: 'practical_local_implication', cta: 'concrete_check' },
  };
  const base = guidance[channel] || guidance.x;
  return { ...base, intent: normalizeEditorialIntent(intent) || EDITORIAL_INTENTS.RESEARCH };
}

export { LOCAL_TERMS };
