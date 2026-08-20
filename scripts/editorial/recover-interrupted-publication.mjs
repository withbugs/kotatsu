#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { validateEditorialIntegrity } from './editorial-integrity.mjs';
import { determinePublicationHandoff } from './publication-handoff.mjs';
import { loadArticles, parseArgs, validatePublishedSchedule } from './publishing-schedule.mjs';
import {
  containsLocalDateReference,
  earliestRecoveryDateKey,
  jstDateKey,
  replaceLocalDateReferences
} from './schedule-recovery.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const args = parseArgs(process.argv.slice(2));
const slug = String(args.slug || args.article || '');
const nextPublishAt = String(args.publishAt || args['publish-at'] || '');
const reason = String(args.reason || 'publication delivery was interrupted after editorial approval');
const now = args.now ? new Date(String(args.now)) : new Date();

if (!slug || !nextPublishAt) {
  console.error('Usage: pnpm article:recover-publication -- --slug="article-slug" --publishAt="2026-08-20T00:00:00+09:00" [--resume-unmerged-publication]');
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

const previousStatus = article.data.status;
if (!['scheduled', 'published'].includes(previousStatus)) {
  console.error(`${article.relativePath}: delivery recovery requires a scheduled or published article`);
  process.exit(1);
}
if (previousStatus === 'published' && !args['resume-unmerged-publication']) {
  console.error(`${article.relativePath}: published recovery requires --resume-unmerged-publication and an open, unmerged article PR`);
  process.exit(1);
}
if (article.data.editorial?.integrityReview?.status !== 'passed') {
  console.error(`${article.relativePath}: delivery recovery cannot bypass an incomplete copy review`);
  process.exit(1);
}

const previousPublishAt = new Date(String(article.data.publishAt || ''));
const nextDate = new Date(nextPublishAt);
if (Number.isNaN(previousPublishAt.getTime()) || Number.isNaN(nextDate.getTime())) {
  console.error(`${article.relativePath}: current and recovery publishAt must be valid dates`);
  process.exit(1);
}
if (previousPublishAt > now) {
  console.error(`${article.relativePath}: publication is not due; use the normal schedule`);
  process.exit(1);
}
if (jstDateKey(previousPublishAt) >= jstDateKey(nextDate)) {
  console.error(`${article.relativePath}: recovery publishAt must be later than the interrupted publication date`);
  process.exit(1);
}
const previousDateKey = jstDateKey(previousPublishAt);
const nextDateKey = jstDateKey(nextDate);
const delayDays = Math.round((Date.parse(`${nextDateKey}T00:00:00Z`) - Date.parse(`${previousDateKey}T00:00:00Z`)) / DAY_MS);
if (delayDays > 7 || previousDateKey.slice(0, 7) !== nextDateKey.slice(0, 7)) {
  console.error(`${article.relativePath}: delivery recovery is limited to seven days in the same month; use editorial recovery`);
  process.exit(1);
}
if (nextDateKey < earliestRecoveryDateKey(now)) {
  console.error(`${article.relativePath}: recovery publishAt must leave time for the next publisher run`);
  process.exit(1);
}

const readerFacing = {
  title: article.data.title,
  description: article.data.description,
  heroAlt: article.data.heroAlt,
  tags: article.data.tags,
  body: article.parsed.content
};
if (containsLocalDateReference(readerFacing, previousPublishAt)) {
  console.error(`${article.relativePath}: reader-facing content refers to ${previousDateKey}; use editorial recovery`);
  process.exit(1);
}

const heroImage = String(article.data.heroImage || '');
let sidecarPath = null;
let nextSidecar = null;
if (heroImage.startsWith('/')) {
  sidecarPath = path.join(process.cwd(), 'public', heroImage.slice(1)).replace(/\.(png|jpe?g|webp|avif)$/i, '.json');
  if (fs.existsSync(sidecarPath)) {
    try {
      nextSidecar = replaceLocalDateReferences(
        JSON.parse(fs.readFileSync(sidecarPath, 'utf8')),
        previousPublishAt,
        nextDate
      );
    } catch (error) {
      console.error(`${article.relativePath}: hero sidecar is invalid JSON: ${error.message}`);
      process.exit(1);
    }
  }
}

const previousRecovery = article.data.editorial.scheduleRecovery;
const nextEditorial = replaceLocalDateReferences(article.data.editorial, previousPublishAt, nextDate);
const nextVisual = replaceLocalDateReferences(article.data.visual, previousPublishAt, nextDate);
nextEditorial.publicationDate = nextDateKey;
nextEditorial.scheduleRecovery = {
  originalPublishAt: previousRecovery?.originalPublishAt || article.data.publishAt,
  previousPublishAt: article.data.publishAt,
  rescheduledPublishAt: nextPublishAt,
  rescheduledAt: now.toISOString(),
  reason,
  approvedBy: 'agent:managing-editor',
  attempt: Number(previousRecovery?.attempt || 0) + 1,
  mode: 'delivery',
  resumedFromUnmergedPublication: previousStatus === 'published',
  qualityGatesPreserved: true,
  visualRecheckRequired: false,
  automatedDateFieldsUpdated: true,
  ...(previousRecovery?.editorialRevalidatedAt
    ? { editorialRevalidatedAt: previousRecovery.editorialRevalidatedAt }
    : {}),
  ...(previousRecovery?.visualRevalidatedAt
    ? { visualRevalidatedAt: previousRecovery.visualRevalidatedAt }
    : {})
};

const nextData = {
  ...article.parsed.data,
  status: 'scheduled',
  publishAt: nextPublishAt,
  editorial: nextEditorial,
  visual: nextVisual
};
const candidate = {
  ...article,
  data: nextData,
  publishAt: nextDate,
  publishAtIsValid: true
};
const scheduleResult = validatePublishedSchedule(
  articles.map((entry) => (entry.slug === slug ? candidate : entry)),
  { now }
);
const errors = [
  ...scheduleResult.errors,
  ...validateEditorialIntegrity(candidate, { requireReview: true })
];
if (errors.length) {
  console.error(`${article.relativePath}: cannot recover publication:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

fs.writeFileSync(article.file, matter.stringify(article.parsed.content, nextData), 'utf8');
if (sidecarPath && nextSidecar) {
  fs.writeFileSync(sidecarPath, `${JSON.stringify(nextSidecar, null, 2)}\n`, 'utf8');
}

const handoff = determinePublicationHandoff({ status: 'scheduled', publishAt: nextPublishAt, now });
console.log(`Recovered ${article.relativePath} from ${article.data.publishAt} to ${nextPublishAt}`);
console.log('Editorial, visual, and copy gates were preserved; only delivery dates and internal date metadata changed.');
console.log(`Required GitHub labels: ${handoff.stateLabel} + ${handoff.agentLabel}`);
