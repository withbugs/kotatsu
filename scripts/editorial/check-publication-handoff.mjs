#!/usr/bin/env node
import { determinePublicationHandoff } from './publication-handoff.mjs';
import { loadArticles, parseArgs, parseNow } from './publishing-schedule.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = String(args.slug || args.article || '');

if (!slug) {
  console.error('Usage: pnpm article:handoff -- --slug="article-slug" [--now="2026-08-16T09:00:00+09:00"]');
  process.exit(1);
}

const article = loadArticles().find((entry) => entry.slug === slug);
if (!article) {
  console.error(`Article not found: ${slug}`);
  process.exit(1);
}

const result = determinePublicationHandoff({
  status: article.data.status,
  publishAt: article.data.publishAt,
  now: parseNow(args.now || process.env.KOTATSU_NOW)
});

if (result.errors.length) {
  console.error(`${article.relativePath}: cannot determine publication handoff:\n- ${result.errors.join('\n- ')}`);
  process.exit(1);
}

if (args.json) {
  console.log(JSON.stringify({ slug, ...result }));
} else {
  console.log(`Publication handoff for ${slug}: ${result.action}`);
  console.log(`Required GitHub labels: ${result.stateLabel} + ${result.agentLabel}`);
}
