#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { validateEditorialIntegrity } from './editorial-integrity.mjs';
import { determinePublicationHandoff } from './publication-handoff.mjs';
import { loadArticles, parseArgs, validatePublishedSchedule } from './publishing-schedule.mjs';
import {
  containsLocalDateReference,
  jstDateKey,
  validateRecoveryTarget
} from './schedule-recovery.mjs';

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

function replaceIndentedBlock(frontmatter, newline, startPattern, replacement, insertBeforePattern) {
  const lines = frontmatter.split(newline);
  const start = lines.findIndex((line) => startPattern.test(line));

  if (start >= 0) {
    const parentIndent = lines[start].match(/^ */)?.[0].length || 0;
    let end = start + 1;
    while (end < lines.length) {
      if (lines[end].trim() === '') {
        end += 1;
        continue;
      }
      const indentation = lines[end].match(/^ */)?.[0].length || 0;
      if (indentation <= parentIndent) break;
      end += 1;
    }
    lines.splice(start, end - start, ...replacement);
  } else {
    const insertAt = lines.findIndex((line) => insertBeforePattern.test(line));
    if (insertAt < 0) throw new Error('frontmatter insertion point was not found');
    lines.splice(insertAt, 0, ...replacement);
  }

  return lines.join(newline);
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
    'visualRecheckRequired',
    'copyRecheckRequired',
    'editorialRevalidatedAt'
  ];

  return [
    '  scheduleRecovery:',
    ...keys
      .filter((key) => recovery[key] !== undefined)
      .map((key) => `    ${key}: ${yamlScalar(recovery[key])}`)
  ];
}

function buildRebookedArticleSource(source, {
  nextStatus,
  nextPublishAt,
  publicationDate,
  recovery,
  resetCopyReview,
  crossVolumeDecision
}) {
  const parts = splitFrontmatter(source);
  let frontmatter = parts.frontmatter;

  for (const field of ['status', 'publishAt']) {
    if (!new RegExp(`^${field}:\\s*.+$`, 'm').test(frontmatter)) {
      throw new Error(`${field} must exist as a top-level frontmatter field`);
    }
  }
  if (!/^  publicationDate:\s*.+$/m.test(frontmatter)) {
    throw new Error('editorial.publicationDate must exist in frontmatter');
  }

  frontmatter = frontmatter.replace(/^status:\s*.+$/m, `status: ${nextStatus}`);
  frontmatter = frontmatter.replace(/^publishAt:\s*.+$/m, `publishAt: ${yamlScalar(nextPublishAt)}`);
  frontmatter = frontmatter.replace(
    /^  publicationDate:\s*.+$/m,
    `  publicationDate: ${yamlScalar(publicationDate)}`
  );

  if (resetCopyReview) {
    frontmatter = replaceIndentedBlock(
      frontmatter,
      parts.newline,
      /^  integrityReview:\s*(?:#.*)?$/,
      [
        '  integrityReview:',
        '    status: pending',
        `    crossVolumeDecision: ${yamlScalar(crossVolumeDecision)}`
      ],
      /^  scheduleRecovery:|^visual:/
    );
  }

  frontmatter = replaceIndentedBlock(
    frontmatter,
    parts.newline,
    /^  scheduleRecovery:\s*(?:#.*)?$/,
    scheduleRecoveryBlock(recovery),
    /^visual:/
  );

  return `${parts.prefix}${frontmatter}${parts.suffix}`;
}

const args = parseArgs(process.argv.slice(2));
const slug = String(args.slug || args.article || '');
const nextPublishAt = String(args.publishAt || args['publish-at'] || '');
const reason = String(args.reason || 'scheduled Codex run was unavailable or the editorial handoff was delayed');
const now = args.now ? new Date(String(args.now)) : new Date();

if (!slug || !nextPublishAt) {
  console.error('Usage: pnpm article:rebook -- --slug="article-slug" --publishAt="2026-08-14T00:00:00+09:00" [--resume-unmerged-publication --editorial-revalidated-at=YYYY-MM-DD]');
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

const resumingUnmergedPublication = article.data.status === 'published';
if (resumingUnmergedPublication && !args['resume-unmerged-publication']) {
  console.error(`${article.relativePath}: published editorial recovery requires --resume-unmerged-publication and an open, unmerged article PR`);
  process.exit(1);
}
if (args['resume-unmerged-publication'] && !resumingUnmergedPublication) {
  console.error(`${article.relativePath}: --resume-unmerged-publication requires a published article`);
  process.exit(1);
}
if (resumingUnmergedPublication && !/^\d{4}-\d{2}-\d{2}$/.test(String(args['editorial-revalidated-at'] || ''))) {
  console.error(`${article.relativePath}: published editorial recovery requires --editorial-revalidated-at=YYYY-MM-DD`);
  process.exit(1);
}

if (!['draft', 'scheduled', 'published'].includes(article.data.status)) {
  console.error(`${article.relativePath}: only draft, scheduled, or explicitly resumed published articles can be editorially rebooked`);
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
const previousIntegrityReview = article.data.editorial.integrityReview;
const copyRecheckRequired =
  visualRecheckRequired ||
  resumingUnmergedPublication ||
  Boolean(args['copy-recheck-required']);
const nextIntegrityReview = copyRecheckRequired
  ? {
      status: 'pending',
      crossVolumeDecision: previousIntegrityReview?.crossVolumeDecision || 'pending'
    }
  : previousIntegrityReview;
const nextStatus = copyRecheckRequired
  ? 'draft'
  : article.data.status;
const nextRecovery = {
  originalPublishAt,
  previousPublishAt: article.data.publishAt,
  rescheduledPublishAt: nextPublishAt,
  rescheduledAt: now.toISOString(),
  reason,
  approvedBy: 'agent:managing-editor',
  attempt: Number(previousRecovery?.attempt || 0) + 1,
  mode: 'editorial',
  resumedFromUnmergedPublication: resumingUnmergedPublication,
  visualRecheckRequired,
  copyRecheckRequired,
  ...(args['editorial-revalidated-at']
    ? { editorialRevalidatedAt: String(args['editorial-revalidated-at']) }
    : {})
};

let nextSource;
let persisted;
try {
  nextSource = buildRebookedArticleSource(article.raw, {
    nextStatus,
    nextPublishAt,
    publicationDate: jstDateKey(nextDate),
    recovery: nextRecovery,
    resetCopyReview: copyRecheckRequired,
    crossVolumeDecision: nextIntegrityReview?.crossVolumeDecision || 'pending'
  });
  persisted = matter(nextSource);
} catch (error) {
  console.error(`${article.relativePath}: failed to prepare a lossless frontmatter update: ${error.message}`);
  process.exit(1);
}
if (persisted.content !== article.parsed.content) {
  console.error(`${article.relativePath}: editorial rebooking cannot change article body content`);
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
  ...validateEditorialIntegrity(candidate, {
    requireReview: nextStatus === 'scheduled'
  })
];

if (errors.length) {
  console.error(`${article.relativePath}: cannot rebook article:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

fs.writeFileSync(article.file, nextSource, 'utf8');
console.log(`Rebooked ${article.relativePath} from ${article.data.publishAt} to ${nextPublishAt}`);
if (visualRecheckRequired) {
  console.log(`Visual recheck required: article content, visual metadata, or sidecar still refers to ${previousDateKey}`);
  console.log('Copy review was reset because the publication context must be checked again after visual revalidation.');
  console.log('Required GitHub labels: kotatsu:revise + agent:visual-editor');
} else if (copyRecheckRequired) {
  console.log('Copy review required because an unmerged publication was reopened for editorial recovery.');
  console.log('Required GitHub labels: kotatsu:revise + agent:copy-editor');
} else if (nextStatus === 'scheduled') {
  const handoff = determinePublicationHandoff({
    status: nextStatus,
    publishAt: nextPublishAt,
    now
  });
  if (!handoff.errors.length) {
    console.log(`Required GitHub labels: ${handoff.stateLabel} + ${handoff.agentLabel}`);
  }
}
