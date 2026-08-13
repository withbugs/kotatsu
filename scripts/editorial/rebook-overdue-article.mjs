#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { validateEditorialIntegrity } from './editorial-integrity.mjs';
import { loadArticles, parseArgs, validatePublishedSchedule } from './publishing-schedule.mjs';
import {
  containsLocalDateReference,
  jstDateKey,
  validateRecoveryTarget
} from './schedule-recovery.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = String(args.slug || args.article || '');
const nextPublishAt = String(args.publishAt || args['publish-at'] || '');
const reason = String(args.reason || 'scheduled Codex run was unavailable or the editorial handoff was delayed');
const now = args.now ? new Date(String(args.now)) : new Date();

if (!slug || !nextPublishAt) {
  console.error('Usage: pnpm article:rebook -- --slug="article-slug" --publishAt="2026-08-14T00:00:00+09:00"');
  process.exit(1);
}

if (Number.isNaN(now.getTime())) {
  console.error('--now must be a valid date when provided');
  process.exit(1);
}

const articles = loadArticles();
const article = articles.find((entry) => entry.slug === slug);

if (!article) {
  console.error(`Article not found: ${slug}`);
  process.exit(1);
}

if (!['draft', 'scheduled'].includes(article.data.status)) {
  console.error(`${article.relativePath}: only draft or scheduled articles can be rebooked`);
  process.exit(1);
}

if (!article.data.editorial) {
  console.error(`${article.relativePath}: editorial metadata is required before recovery`);
  process.exit(1);
}

const previousRecovery = article.data.editorial.scheduleRecovery;
const originalPublishAt = previousRecovery?.originalPublishAt || article.data.publishAt;
const validation = validateRecoveryTarget({
  originalPublishAt,
  currentPublishAt: article.data.publishAt,
  nextPublishAt,
  now,
  editorialRevalidatedAt: args['editorial-revalidated-at']
});

if (validation.errors.length) {
  console.error(`${article.relativePath}: cannot rebook article:\n- ${validation.errors.join('\n- ')}`);
  process.exit(1);
}

const nextDate = new Date(nextPublishAt);
const previousPublishDate = new Date(article.data.publishAt);
const previousDateKey = jstDateKey(previousPublishDate);
const heroImage = String(article.data.heroImage || '');
let sidecarContent = '';
if (heroImage.startsWith('/')) {
  const sidecar = path.join(process.cwd(), 'public', heroImage.slice(1)).replace(/\.(png|jpe?g|webp|avif)$/i, '.json');
  sidecarContent = fs.existsSync(sidecar) ? fs.readFileSync(sidecar, 'utf8') : '';
}
const visualRecheckRequired =
  containsLocalDateReference(article.parsed.content, previousPublishDate) ||
  containsLocalDateReference(article.data.visual || {}, previousPublishDate) ||
  containsLocalDateReference(sidecarContent, previousPublishDate);
const nextEditorial = {
  ...article.data.editorial,
  publicationDate: jstDateKey(nextDate),
  scheduleRecovery: {
    originalPublishAt,
    previousPublishAt: article.data.publishAt,
    rescheduledPublishAt: nextPublishAt,
    rescheduledAt: now.toISOString(),
    reason,
    approvedBy: 'agent:managing-editor',
    attempt: Number(previousRecovery?.attempt || 0) + 1,
    visualRecheckRequired,
    ...(args['editorial-revalidated-at']
      ? { editorialRevalidatedAt: String(args['editorial-revalidated-at']) }
      : {})
  }
};
const nextData = {
  ...article.parsed.data,
  publishAt: nextPublishAt,
  editorial: nextEditorial
};
const candidate = {
  ...article,
  data: nextData,
  publishAt: nextDate,
  publishAtIsValid: true
};
const reservationCandidate = {
  ...candidate,
  data: { ...candidate.data, status: 'scheduled' }
};
const scheduleResult = validatePublishedSchedule(
  articles.map((entry) => (entry.slug === slug ? reservationCandidate : entry)),
  { now }
);
const errors = [
  ...scheduleResult.errors,
  ...validateEditorialIntegrity(candidate, { requireReview: article.data.status === 'scheduled' })
];

if (errors.length) {
  console.error(`${article.relativePath}: cannot rebook article:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

fs.writeFileSync(article.file, matter.stringify(article.parsed.content, nextData), 'utf8');
console.log(`Rebooked ${article.relativePath} from ${article.data.publishAt} to ${nextPublishAt}`);
if (visualRecheckRequired) {
  console.log(`Visual recheck required: article content, visual metadata, or sidecar still refers to ${previousDateKey}`);
}
