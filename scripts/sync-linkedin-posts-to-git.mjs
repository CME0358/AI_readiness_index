#!/usr/bin/env node
/**
 * Copy LinkedIn post bodies to git-tracked insights/_social/linkedin/posts/
 * and update queue.json contentFile paths for GitHub Actions runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT } from './lib/insights-v2-paths.mjs';

const GIT_POSTS_DIR = path.join(ROOT, 'insights/_social/linkedin/posts');
const SOURCE_DIR = PATHS.linkedinDir;

fs.mkdirSync(GIT_POSTS_DIR, { recursive: true });

const queue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
let copied = 0;

for (const post of queue.posts) {
  const src = path.join(SOURCE_DIR, `${post.slug}.md`);
  const dest = path.join(GIT_POSTS_DIR, `${post.slug}.md`);
  if (!fs.existsSync(src)) {
    console.warn('Missing source:', src);
    continue;
  }
  fs.copyFileSync(src, dest);
  post.contentFile = `insights/_social/linkedin/posts/${post.slug}.md`;
  copied++;
}

fs.writeFileSync(PATHS.linkedinQueue, JSON.stringify(queue, null, 2) + '\n', 'utf8');
console.log('Copied', copied, 'LinkedIn posts to git-tracked path');
