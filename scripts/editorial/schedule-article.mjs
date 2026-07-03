#!/usr/bin/env node
import fs from 'node:fs';
import { loadArticles, parseArgs } from './publishing-schedule.mjs';

const PENDING_VISUAL_MARKER = '__AI_VISUAL_PENDING__';
const args = parseArgs(process.argv.slice(2));
const slug = args.slug || args.article;
const publishAtArg = args.publishAt || args['publish-at'];

if (!slug) {
  console.error('Usage: pnpm article:schedule -- --slug="article-slug" [--publishAt="2026-07-04T00:00:00+09:00"]');
  process.exit(1);
}

const articles = loadArticles();
const article = articles.find((entry) => entry.slug === String(slug));

if (!article) {
  console.error(`Article not found: ${slug}`);
  process.exit(1);
}

const status = article.data.status;
if (status === 'published') {
  console.error(`${article.relativePath}: already published; cannot schedule`);
  process.exit(1);
}

if (!['draft', 'scheduled'].includes(status)) {
  console.error(`${article.relativePath}: article must be draft or scheduled before scheduling; current status is ${status}`);
  process.exit(1);
}

const rawPublishAt = article.raw.match(/^publishAt:\s*(["']?)(.+?)\1\s*$/m)?.[2];
const nextPublishAt = publishAtArg ? String(publishAtArg) : rawPublishAt;
const publishDate = nextPublishAt ? new Date(nextPublishAt) : null;

if (!publishDate || Number.isNaN(publishDate.getTime())) {
  console.error(`${article.relativePath}: publishAt must be a valid date string before scheduling`);
  process.exit(1);
}

const errors = [];
if (String(article.data.heroImage) === PENDING_VISUAL_MARKER) {
  errors.push('heroImage is still pending');
}

if (!article.data.heroAlt || !String(article.data.heroAlt).includes('AI生成')) {
  errors.push('heroAlt must disclose AI生成ビジュアル');
}

if (!article.data.visual || article.data.visual.source !== 'ai-generated') {
  errors.push('visual.source must be ai-generated');
}

if (errors.length) {
  console.error(`${article.relativePath}: cannot schedule article:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

let nextRaw = article.raw;

if (!/^status:\s*[^\r\n]+$/m.test(nextRaw)) {
  console.error(`${article.relativePath}: missing status line`);
  process.exit(1);
}

nextRaw = nextRaw.replace(/^status:\s*[^\r\n]+$/m, 'status: scheduled');

if (publishAtArg) {
  if (!/^publishAt:\s*[^\r\n]+$/m.test(nextRaw)) {
    console.error(`${article.relativePath}: missing publishAt line`);
    process.exit(1);
  }
  nextRaw = nextRaw.replace(/^publishAt:\s*[^\r\n]+$/m, `publishAt: "${nextPublishAt}"`);
}

if (nextRaw === article.raw) {
  console.log(`Already scheduled ${article.relativePath} for ${nextPublishAt}`);
  process.exit(0);
}

fs.writeFileSync(article.file, nextRaw, 'utf8');
console.log(`Scheduled ${article.relativePath} for ${nextPublishAt}`);
