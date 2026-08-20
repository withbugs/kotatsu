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

function splitFrontmatter(source) {
  const newline = source.startsWith('---\r\n') ? '\r\n' : source.startsWith('---\n') ? '\n' : null;
  if (!newline) throw new Error('article must start with YAML frontmatter');

  const contentStart = 3 + newline.length;
  const closingStart = source.indexOf(`${newline}---`, contentStart);
  if (closingStart < 0) throw new Error('article frontmatter closing marker was not found');

  return {
    prefix: source.slice(0, contentStart),
    frontmatter: source.slice(contentStart, closingStart),
    suffix: source.slice(closingStart),
    newline
  };
}

function yamlScalar(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(String(value));
}

function scheduleRecoveryBlock(recovery) {
  const keys = [
    'originalPublishAt',
    'previousPublishAt',
    'rescheduledPublishAt',
    'rescheduledAt',
    'reason',
    'approvedBy',
    'attempt',
    'mode',
    'resumedFromUnmergedPublication',
    'qualityGatesPreserved',
    'visualRecheckRequired',
    'automatedDateFieldsUpdated',
    'editorialRevalidatedAt',
    'visualRevalidatedAt'
  ];

  return [
    '  scheduleRecovery:',
    ...keys
      .filter((key) => recovery[key] !== undefined)
      .map((key) => `    ${key}: ${yamlScalar(recovery[key])}`)
  ];
}

function replaceScheduleRecoveryBlock(frontmatter, newline, recovery) {
  const lines = frontmatter.split(newline);
  const start = lines.findIndex((line) => /^  scheduleRecovery:\s*(?:#.*)?$/.test(line));
  const replacement = scheduleRecoveryBlock(recovery);

  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length) {
      if (lines[end].trim() === '') {
        end += 1;
        continue;
      }
      const indentation = lines[end].match(/^ */)?.[0].length || 0;
      if (indentation <= 2) break;
      end += 1;
    }
    lines.splice(start, end - start, ...replacement);
  } else {
    const visualStart = lines.findIndex((line) => /^visual:\s*(?:#.*)?$/.test(line));
    if (visualStart < 0) throw new Error('visual frontmatter section was not found');
    lines.splice(visualStart, 0, ...replacement);
  }

  return lines.join(newline);
}

function buildRecoveredArticleSource(source, fromDate, toDate, recovery, nextPublishAt) {
  const parts = splitFrontmatter(source);
  let frontmatter = replaceLocalDateReferences(parts.frontmatter, fromDate, toDate);
  if (!/^status:\s*.+$/m.test(frontmatter) || !/^publishAt:\s*.+$/m.test(frontmatter)) {
    throw new Error('status and publishAt must exist as top-level frontmatter fields');
  }
  frontmatter = frontmatter.replace(/^status:\s*.+$/m, 'status: scheduled');
  frontmatter = frontmatter.replace(/^publishAt:\s*.+$/m, `publishAt: ${yamlScalar(nextPublishAt)}`);
  frontmatter = replaceScheduleRecoveryBlock(frontmatter, parts.newline, recovery);
  return `${parts.prefix}${frontmatter}${parts.suffix}`;
}

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
if (args['handled-by'] && args['handled-by'] !== 'agent:publisher') {
  console.error('--handled-by may only be agent:publisher for delivery recovery');
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
nextEditorial.publicationDate = nextDateKey;
nextEditorial.scheduleRecovery = {
  originalPublishAt: previousRecovery?.originalPublishAt || article.data.publishAt,
  previousPublishAt: article.data.publishAt,
  rescheduledPublishAt: nextPublishAt,
  rescheduledAt: now.toISOString(),
  reason,
  approvedBy: 'agent:publisher',
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

let nextSource;
let persisted;
try {
  nextSource = buildRecoveredArticleSource(
    article.raw,
    previousPublishAt,
    nextDate,
    nextEditorial.scheduleRecovery,
    nextPublishAt
  );
  persisted = matter(nextSource);
} catch (error) {
  console.error(`${article.relativePath}: failed to prepare a lossless frontmatter update: ${error.message}`);
  process.exit(1);
}
if (persisted.content !== article.parsed.content) {
  console.error(`${article.relativePath}: delivery recovery cannot change article body content`);
  process.exit(1);
}
const candidate = {
  ...article,
  raw: nextSource,
  parsed: persisted,
  data: persisted.data,
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

fs.writeFileSync(article.file, nextSource, 'utf8');
if (sidecarPath && nextSidecar) {
  fs.writeFileSync(sidecarPath, `${JSON.stringify(nextSidecar, null, 2)}\n`, 'utf8');
}

const handoff = determinePublicationHandoff({ status: 'scheduled', publishAt: nextPublishAt, now });
console.log(`Recovered ${article.relativePath} from ${article.data.publishAt} to ${nextPublishAt}`);
console.log('Editorial, visual, and copy gates were preserved; only delivery dates and internal date metadata changed.');
console.log(`Required GitHub labels: ${handoff.stateLabel} + ${handoff.agentLabel}`);
