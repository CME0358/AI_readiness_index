import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../insights-v2-paths.mjs';
import { getPublishedSlugsFromFilesystem } from '../insights-related-links.mjs';
import { SCORE_THRESHOLDS, ARTICLE_TYPES } from './constants.mjs';

function tokenOverlap(a, b) {
  const ta = new Set((a || '').toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set((b || '').toLowerCase().split(/\s+/).filter(Boolean));
  let n = 0;
  for (const t of ta) if (tb.has(t)) n++;
  return n / Math.max(ta.size, tb.size, 1);
}

function loadExistingTitles(root) {
  const slugs = getPublishedSlugsFromFilesystem(root);
  const entries = [];
  for (const slug of slugs) {
    const htmlPath = path.join(root, 'insights', slug, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    entries.push({ slug, h1, title, status: 'published' });
  }
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  for (const a of schedule.articles) {
    entries.push({
      slug: a.slug,
      h1: a.title,
      title: a.seoTitle || a.title,
      status: a.status,
      primarySearchIntent: a.primarySearchIntent,
    });
  }
  return entries;
}

export function classifyCannibalization(event, { root }) {
  const existing = loadExistingTitles(root);
  const probe = `${event.title} ${event.excerpt || ''}`;
  let best = { slug: null, similarity: 0, entry: null };
  for (const e of existing) {
    const sim = Math.max(
      tokenOverlap(probe, e.title),
      tokenOverlap(probe, e.h1),
      tokenOverlap(probe, e.primarySearchIntent || ''),
    );
    if (sim > best.similarity) best = { slug: e.slug, similarity: sim, entry: e };
  }
  if (best.similarity >= 0.55) {
    return {
      decision: 'REFRESH EXISTING',
      article_type: ARTICLE_TYPES.EXISTING_ARTICLE_REFRESH,
      conflict_slug: best.slug,
      similarity: best.similarity,
    };
  }
  if (best.similarity >= 0.35) {
    return {
      decision: 'MERGE',
      article_type: ARTICLE_TYPES.EVERGREEN_UPDATE,
      conflict_slug: best.slug,
      similarity: best.similarity,
    };
  }
  if ((event.score || 0) < SCORE_THRESHOLDS.DRAFT_MIN) {
    return { decision: 'SKIP', article_type: ARTICLE_TYPES.IGNORE, conflict_slug: null, similarity: 0 };
  }
  return {
    decision: 'NEW ARTICLE',
    article_type:
      event.priority === 'P0'
        ? ARTICLE_TYPES.BREAKING_ANALYSIS
        : ARTICLE_TYPES.CURRENT_EVENT_ANALYSIS,
    conflict_slug: null,
    similarity: best.similarity,
  };
}

export function buildInterpretation(event, scoring) {
  const layers = scoring.ari_layers || [];
  return {
    what_happened: `${event.company}が公式情報で「${event.title}」を公開した。`,
    why_it_matters: 'AIが企業情報を発見・理解・比較・推薦・行動する各段階への影響を評価する必要がある。',
    ari_layer_impact: layers,
    business_impact: layers.includes('Recommendation') || layers.includes('Actionability')
      ? '顧客獲得・AI推薦・実行導線に影響する可能性'
      : '情報設計・AI可視性への間接影響',
    what_companies_should_do: '一般論ではなく、自社がどのReadiness段階で止まっているかを定点観測で確認する。',
    priority_recommendation: event.priority,
    evidence_needed: '公式ソースURLと公開日の確認。ARI Research/Evidenceは関連がある場合のみ接続。',
    article_worthiness: (event.score || 0) >= 50 ? 'YES' : 'NO',
    risks_unknowns: '製品の一般提供時期・地域・詳細仕様は公式発表以外で断定しない。',
  };
}
