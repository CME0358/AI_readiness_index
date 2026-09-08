import { isNonProductionHost } from '../measurement/event-dictionary.mjs';
import { WEEKLY_METRIC_KEYS } from './constants.mjs';

function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cells[i] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
}

/** GSC export: Query, Clicks, Impressions, CTR, Position (English or Japanese headers). */
export function importGscQueries(csvText, { brandTerms = [] } = {}) {
  const { rows } = parseCsv(csvText);
  let clicks = 0;
  let impressions = 0;
  let matchedRows = 0;

  for (const row of rows) {
    const query = String(pick(row, ['Query', 'クエリ', 'query'])).toLowerCase();
    if (!query) continue;
    const isBranded = brandTerms.some((t) => query.includes(String(t).toLowerCase()));
    if (isBranded) continue;
    clicks += num(pick(row, ['Clicks', 'クリック数', 'clicks']));
    impressions += num(pick(row, ['Impressions', '表示回数', 'impressions']));
    matchedRows += 1;
  }

  return {
    source: 'gsc_export',
    non_branded_organic_clicks: clicks,
    non_branded_organic_impressions: impressions,
    row_count: matchedRows,
    note: 'Manual GSC export; branded queries excluded by brandTerms.',
  };
}

/** GA4 exploration CSV — flexible column names. */
export function importGa4Export(csvText) {
  const { headers, rows } = parseCsv(csvText);
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const hostCol = headers.find((h) => /host|hostname|ページ|page/i.test(h));
  const eventCol = headers.find((h) => /event|イベント/i.test(h));
  const sessionsCol = headers.find((h) => /session|セッション/i.test(h));
  const countCol = headers.find((h) => /count|イベント数|event count/i.test(h));

  let serviceViews = 0;
  let aiReferralSessions = 0;
  let excludedInternal = 0;

  for (const row of rows) {
    const host = hostCol ? row[hostCol] : '';
    if (host && isNonProductionHost(host.replace(/^https?:\/\//, '').split('/')[0])) {
      excludedInternal += 1;
      continue;
    }

    if (eventCol) {
      const ev = String(row[eventCol] || '').toLowerCase();
      const count = num(countCol ? row[countCol] : 1);
      if (ev === 'service_view') serviceViews += count;
    }

    if (sessionsCol) {
      const channel = String(pick(row, ['Session source', 'セッションのソース', 'source', '参照元'])).toLowerCase();
      const medium = String(pick(row, ['Session medium', 'セッションのメディア', 'medium', 'メディア'])).toLowerCase();
      const sessions = num(row[sessionsCol]);
      if (
        channel.includes('chatgpt')
        || channel.includes('perplexity')
        || channel.includes('claude')
        || channel.includes('gemini')
        || medium.includes('ai')
      ) {
        aiReferralSessions += sessions;
      }
    }
  }

  return {
    source: 'ga4_export',
    service_view_events: serviceViews,
    ai_referral_sessions: aiReferralSessions,
    excluded_non_production_rows: excludedInternal,
    headers_detected: lowerHeaders,
    note: 'Manual GA4 export. Excludes preview/vercel/localhost via isNonProductionHost. For self-reported vs first-touch dedupe, use weekly-baseline rules.',
  };
}

/** Bing Webmaster export — Query, Clicks, Impressions. */
export function importBingQueries(csvText, { brandTerms = [] } = {}) {
  const { rows } = parseCsv(csvText);
  let clicks = 0;
  let impressions = 0;

  for (const row of rows) {
    const query = String(pick(row, ['Query', 'Keyword', 'クエリ', 'query'])).toLowerCase();
    if (!query) continue;
    const isBranded = brandTerms.some((t) => query.includes(String(t).toLowerCase()));
    if (isBranded) continue;
    clicks += num(pick(row, ['Clicks', 'クリック数', 'clicks']));
    impressions += num(pick(row, ['Impressions', '表示回数', 'impressions']));
  }

  return {
    source: 'bing_export',
    non_branded_organic_clicks: clicks,
    non_branded_organic_impressions: impressions,
    note: 'Manual Bing export; branded queries excluded.',
  };
}

/** CRM manual export — date, stage columns. */
export function importCrmExport(csvText) {
  const { rows } = parseCsv(csvText);
  let inquiries = 0;
  let consults = 0;
  let orders = 0;

  for (const row of rows) {
    const stage = String(pick(row, ['stage', 'ステージ', 'status', 'ステータス'])).toLowerCase();
    if (!stage) continue;
    if (stage.includes('inquiry') || stage.includes('問い合わせ') || stage.includes('lead')) inquiries += 1;
    else if (stage.includes('consult') || stage.includes('商談') || stage.includes('mtg')) consults += 1;
    else if (stage.includes('order') || stage.includes('受注') || stage.includes('won')) orders += 1;
  }

  return {
    source: 'crm_export',
    inquiry_count: inquiries,
    consult_count: consults,
    order_count: orders,
    note: 'Manual CRM export; map stages in observation/README.md.',
  };
}

export function mergeChannelImports(parts) {
  const merged = { schema: 'weekly_channel_import_v1' };
  for (const key of WEEKLY_METRIC_KEYS) merged[key] = 0;

  for (const part of parts) {
    for (const key of WEEKLY_METRIC_KEYS) {
      if (typeof part[key] === 'number') merged[key] += part[key];
    }
    merged.sources = merged.sources || [];
    merged.sources.push(part.source);
  }

  return merged;
}

export { parseCsv };
