import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..');

export const ABIS_INTELLIGENCE_DIR = path.join(ROOT, 'crucial_data/abis-intelligence');
export const ABIS_INTELLIGENCE_PATHS = {
  dir: ABIS_INTELLIGENCE_DIR,
  events: path.join(ABIS_INTELLIGENCE_DIR, 'events.json'),
  impactQueue: path.join(ABIS_INTELLIGENCE_DIR, 'impact-queue.json'),
  notificationState: path.join(ABIS_INTELLIGENCE_DIR, 'notification-state.json'),
  reviewsDir: path.join(ABIS_INTELLIGENCE_DIR, 'reviews'),
  internalDailyBrief: path.join(ABIS_INTELLIGENCE_DIR, 'internal-daily-brief.md'),
};

/** Paths that must never contain ABIS intelligence output. */
export const PUBLIC_SURFACE_PATHS = {
  publicBuild: path.join(ROOT, 'public_build'),
  sitemap: path.join(ROOT, 'sitemap.xml'),
  llms: path.join(ROOT, 'llms.txt'),
  editorialBrief: path.join(ROOT, 'reports/Editorial Intelligence Latest.md'),
};
