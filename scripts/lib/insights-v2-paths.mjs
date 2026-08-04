import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

export const PATHS = {
  editorialPlan: path.join(ROOT, 'crucial_data/editorial/editorial-plan.json'),
  knowledgeGraph: path.join(ROOT, 'crucial_data/editorial/knowledge-graph.json'),
  articleMeta: path.join(ROOT, 'crucial_data/editorial/article-meta-v2.json'),
  articlesContent: path.join(ROOT, 'crucial_data/editorial/articles-v2-content.json'),
  publicationCalendarCsv: path.join(ROOT, 'crucial_data/editorial/publication-calendar.csv'),
  publicationCalendarMd: path.join(ROOT, 'crucial_data/editorial/publication-calendar.md'),
  columnDir: path.join(ROOT, 'crucial_data/column'),
  linkedinDir: path.join(ROOT, 'crucial_data/linkedin/posts'),
  schedule: path.join(ROOT, 'insights/_scheduled/schedule.json'),
  linkedinQueue: path.join(ROOT, 'insights/_social/linkedin/queue.json'),
  linkedinPublishedLog: path.join(ROOT, 'insights/_social/linkedin/published-log.json'),
  linkedinFailedLog: path.join(ROOT, 'insights/_social/linkedin/failed-log.json'),
  insightsIndex: path.join(ROOT, 'insights/index.html'),
  scheduledDir: path.join(ROOT, 'insights/_scheduled'),
  reportsDir: path.join(ROOT, 'reports'),
};

export const ARTICLE_BASE_URL = 'https://readiness.coaretail.com/insights';

export function articleUrl(slug) {
  return `${ARTICLE_BASE_URL}/${slug}/`;
}
