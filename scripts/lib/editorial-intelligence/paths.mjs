import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATHS as V2_PATHS } from '../insights-v2-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..');

export const INTELLIGENCE_DIR = path.join(ROOT, 'crucial_data/editorial/intelligence');
export const INTELLIGENCE_PATHS = {
  dir: INTELLIGENCE_DIR,
  sources: path.join(INTELLIGENCE_DIR, 'sources.json'),
  events: path.join(INTELLIGENCE_DIR, 'events.json'),
  queue: path.join(INTELLIGENCE_DIR, 'queue.json'),
  draftsDir: path.join(INTELLIGENCE_DIR, 'drafts'),
  fixtures: path.join(INTELLIGENCE_DIR, 'fixtures/backfill-items.json'),
  dailyBrief: path.join(ROOT, 'reports/Editorial Intelligence Latest.md'),
  schedule: V2_PATHS.schedule,
};
