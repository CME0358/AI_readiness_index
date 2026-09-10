import { randomUUID } from 'node:crypto';
import {
  makeAdhocTargetId,
  OISUMMIT_CAPTURE_TARGETS,
  resolveCaptureTarget,
} from './target-registry.mjs';
import {
  buildCaptureFields,
  CAPTURE_ALLOWED,
  normalizeAdhocTarget,
  normalizeRegisteredTarget,
} from './capture-core.mjs';

const INTENT_RE = /^(?:OISUMMIT記録|OISUMMIT\s*capture|イベント記録)\s*/i;
const RESULT_RE = /\b(HOT|WARM|CONTACT|MISS)\b/i;

const ROUTE_MAP = Object.freeze([
  [/agent\s*execution|エージェント実行/i, 'AGENT_EXECUTION'],
  [/agent\s*readiness|エージェントレディネス/i, 'AGENT_READINESS'],
  [/\bMAR\b|住民\s*Journey|Municipal/i, 'MAR'],
  [/partnership|パートナー/i, 'PARTNERSHIP'],
]);

const NEXT_MAP = Object.freeze([
  [/打ち合わせ|ミーティング|meeting|MTG|面談/i, 'MEETING'],
  [/紹介|intro/i, 'INTRO'],
  [/資料|material/i, 'MATERIAL'],
  [/フォロー|follow/i, 'FOLLOW'],
]);

const CONTACT_MAP = Object.freeze([
  [/メール|email/i, 'EMAIL'],
  [/名刺|business\s*card/i, 'BUSINESS_CARD'],
  [/linkedin/i, 'LINKEDIN'],
  [/\bQR\b/i, 'QR'],
]);

const GOV_HINT = /(市|県|区|町|村|都|府|道|自治体)/;

export function hasCaptureIntent(text) {
  return INTENT_RE.test(String(text || '').trim());
}

export function stripCaptureIntent(text) {
  return String(text || '').replace(INTENT_RE, '').trim();
}

function detectRoute(text) {
  for (const [re, route] of ROUTE_MAP) {
    if (re.test(text)) return route;
  }
  return '';
}

function detectResult(text) {
  const m = String(text).match(RESULT_RE);
  return m ? m[1].toUpperCase() : '';
}

function detectNextAction(text, result) {
  for (const [re, action] of NEXT_MAP) {
    if (re.test(text)) return action;
  }
  if (result === 'MISS') return 'FOLLOW';
  if (result === 'HOT') return 'MEETING';
  if (result === 'WARM') return 'FOLLOW';
  return 'NONE';
}

function detectContactMethod(text) {
  for (const [re, method] of CONTACT_MAP) {
    if (re.test(text)) return method;
  }
  return 'NONE';
}

function ymdJst(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

function detectDue(text, now = new Date()) {
  if (/なし|未定|none/i.test(text)) return 'NONE';
  if (/\b9\/14\b/.test(text)) return '9/14';
  if (/\b9\/15\b/.test(text)) return '9/15';
  if (/\b9\/16\b/.test(text)) return '9/16';
  if (/明日/.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ymd = ymdJst(tomorrow);
    const m = ymd.match(/-(\d{2})$/);
    const day = m ? `${Number(ymd.slice(5, 7))}/${Number(m[1])}` : '';
    if (CAPTURE_ALLOWED.due.has(day)) return day;
    return 'CUSTOM';
  }
  if (/来週|月曜|火曜|水曜|木曜|金曜|土曜|日曜/.test(text)) return 'CUSTOM';
  return '';
}

function inferAdhocType(name, text) {
  if (GOV_HINT.test(name) || /自治体|行政|MAR/.test(text)) return 'government';
  if (/パートナー|partner/i.test(text)) return 'partner';
  if (/企業|会社|株式会社|Inc\.|Corp/i.test(name + text)) return 'company';
  return '';
}

function inferAdhocRoute(text) {
  const detected = detectRoute(text);
  if (detected) return detected;
  if (/AI\s*Agent|AI活用|EC|Agent/i.test(text)) return 'AGENT_READINESS';
  return '';
}

function firstTargetLine(body) {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines[0] || '';
}

function memoFromBody(body, targetName) {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rest = lines.slice(1).filter((line) => {
    if (RESULT_RE.test(line) && line.length < 20) return false;
    if (/^(明日|来週|メール|名刺)/.test(line) && line.length < 24) return false;
    return true;
  });
  const memo = rest.join(' ').trim();
  if (memo) return memo.slice(0, 300);
  if (targetName && body.length > targetName.length) {
    return body.replace(targetName, '').replace(RESULT_RE, '').trim().slice(0, 300);
  }
  return '';
}

export function parseCaptureMessage(text, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const raw = String(text || '').trim();
  if (!hasCaptureIntent(raw)) {
    return { status: 'ignored', reason: 'no_capture_intent' };
  }

  const body = stripCaptureIntent(raw);
  if (!body) {
    return { status: 'needs_confirmation', missing: ['target_name', 'result'], questions: ['誰と話しましたか？', '結果は HOT / WARM / CONTACT / MISS のどれですか？'] };
  }

  const targetLine = firstTargetLine(body);
  const resolved = resolveCaptureTarget(targetLine, options.targets || OISUMMIT_CAPTURE_TARGETS);
  const result = detectResult(body);
  const routeDetected = detectRoute(body);
  const missing = [];
  const questions = [];

  let targetMeta = null;
  if (!resolved) {
    missing.push('target_name');
    questions.push('企業・団体名を教えてください。');
  } else if (resolved.kind === 'registered') {
    targetMeta = normalizeRegisteredTarget(resolved.target);
    if (routeDetected && routeDetected !== resolved.target.route) {
      // Prefer explicit utterance route when user names a different theme.
      targetMeta.route = routeDetected;
    }
  } else {
    const adhocType = inferAdhocType(resolved.name, body);
    const adhocRoute = routeDetected || inferAdhocRoute(body);
    if (!adhocType) missing.push('target_type');
    if (!adhocRoute) missing.push('route');
    if (!adhocType) questions.push('種別は 企業 / 自治体 / パートナー / その他 のどれですか？');
    if (!adhocRoute) questions.push('話したテーマは Agent Readiness / MAR / Agent Execution / Partnership のどれですか？');
    if (adhocType && adhocRoute) {
      targetMeta = normalizeAdhocTarget({ name: resolved.name, type: adhocType, route: adhocRoute }, makeAdhocTargetId());
    }
  }

  if (!result) {
    missing.push('result');
    questions.push('結果は HOT / WARM / CONTACT / MISS のどれですか？');
  }

  const due = detectDue(body, now);
  const contact_method = detectContactMethod(body);
  const next_action = result ? detectNextAction(body, result) : '';

  const draftInput = targetMeta ? {
    capture_id: randomUUID(),
    ...targetMeta,
    result,
    person: cleanPerson(body),
    department_title: '',
    memo: memoFromBody(body, targetLine),
    next_action: next_action || 'NONE',
    due: due || 'NONE',
    contact_method: contact_method || 'NONE',
    source: 'oisummit_capture_grok',
  } : null;

  const preview = draftInput ? formatPreview(draftInput) : null;

  if (missing.length) {
    return {
      status: 'needs_confirmation',
      missing,
      questions,
      draft: draftInput,
      preview,
    };
  }

  const fields = buildCaptureFields(draftInput, now);
  return {
    status: 'ready',
    draft: draftInput,
    fields,
    preview,
  };
}

function cleanPerson(text) {
  const m = String(text).match(/(?:担当|氏名)[:：]?\s*([^\n。、,]{1,40})/);
  return m ? m[1].trim().slice(0, 160) : '';
}

export function formatPreview(input) {
  const routeLabel = {
    AGENT_EXECUTION: 'Agent Execution',
    AGENT_READINESS: 'Agent Readiness',
    MAR: 'MAR',
    PARTNERSHIP: 'Partnership',
  }[input.route] || input.route;

  const lines = [
    'OISUMMIT Capture',
    '',
    input.target_name,
    `${input.result} / ${routeLabel}`,
  ];
  if (input.memo) lines.push('', 'Memo:', input.memo);
  if (input.next_action && input.next_action !== 'NONE') {
    lines.push('', 'Next:', nextActionLabel(input.next_action, input.memo));
  }
  if (input.due && input.due !== 'NONE') lines.push('', 'Due:', input.due);
  if (input.contact_method && input.contact_method !== 'NONE') {
    lines.push('', 'Contact:', input.contact_method);
  }
  return lines.join('\n');
}

function nextActionLabel(next, memo) {
  if (/30分|打ち合わせ|meeting/i.test(memo || '')) return memo.slice(0, 120);
  const map = {
    MEETING: 'Meeting提案',
    INTRO: '紹介',
    MATERIAL: '資料送付',
    FOLLOW: 'フォロー',
    NONE: 'なし',
  };
  return map[next] || next;
}

export function mergeCaptureDraft(base, patch = {}) {
  const merged = { ...(base || {}), ...patch };
  const fields = buildCaptureFields(merged);
  return {
    status: 'ready',
    draft: merged,
    fields,
    preview: formatPreview(merged),
  };
}
