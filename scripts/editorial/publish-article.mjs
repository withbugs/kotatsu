#!/usr/bin/env node
import fs from 'node:fs';
import {
  evaluatePublishCandidate,
  loadArticles,
  parseArgs,
  parseNow
} from './publishing-schedule.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = args.slug || args.article;

if (!slug) {
  console.error('Usage: pnpm article:publish -- --slug="article-slug"');
  process.exit(1);
}

const now = parseNow(args.now || process.env.KOTATSU_NOW);
const articles = loadArticles();
const result = evaluatePublishCandidate(articles, String(slug), { now });

for (const warning of result.warnings) {
  console.warn(`Warning: ${warning}`);
}

if (result.errors.length) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}

const article = result.candidate;

if (!article) {
  console.error(`Article not found: ${slug}`);
  process.exit(1);
}

if (article.data.status === 'published') {
  console.log(`Already published: ${article.relativePath}`);
  process.exit(0);
}

if (!/^status:\s*["']?scheduled["']?\s*$/m.test(article.raw)) {
  console.error(`${article.relativePath}: status line must be exactly scheduled before publication`);
  process.exit(1);
}

const nextRaw = article.raw.replace(/^status:\s*["']?scheduled["']?\s*$/m, 'status: published');
fs.writeFileSync(article.file, nextRaw, 'utf8');

console.log(`Published ${article.relativePath}`);
console.log(
  `Schedule usage after publish: week ${result.targetWeek} ${result.weekPublishedCount + 1}/2, month ${result.targetMonth} ${result.monthPublishedCount + 1}/8.`
);
