#!/usr/bin/env node
/**
 * Apply breaking editorial insertion with full schedule/queue/index updates.
 *
 * Usage:
 *   node scripts/apply-emergency-editorial-insert.mjs --slug SLUG --date YYYY-MM-DD [--dry-run] [--no-hero-trigger]
 */
import { applyEmergencyEditorialInsert } from './lib/apply-emergency-editorial-insert.mjs';
import { getScheduledSeoPackage } from './lib/insights-seo-package.mjs';

const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const slug = value('--slug');
const targetDate = value('--date');
const dryRun = args.includes('--dry-run');
const triggerHero = !args.includes('--no-hero-trigger');

if (!slug || !targetDate) {
  console.error('Usage: node scripts/apply-emergency-editorial-insert.mjs --slug SLUG --date YYYY-MM-DD [--dry-run] [--no-hero-trigger]');
  process.exit(1);
}

const seo = getScheduledSeoPackage(slug);
const scheduleMetadata = {
  title: seo?.h1?.slice(0, 48) || slug,
  cardSummary: seo?.meta?.slice(0, 80) || '',
  llmsLabel: seo?.h1 || slug,
  series: 'current-event',
  editorialType: 'current_event',
  seoTitle: seo?.h1 || slug,
  metaDescription: seo?.meta || '',
  searchIntentClass: seo?.intent || 'B',
  primarySearchIntent: seo?.primarySearchIntent || '',
};

const result = applyEmergencyEditorialInsert({
  slug,
  targetDate,
  scheduleMetadata,
  dryRun,
  triggerHero: dryRun ? false : triggerHero,
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 2);
