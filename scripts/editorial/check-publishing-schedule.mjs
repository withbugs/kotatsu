#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  MONTHLY_PUBLISH_LIMIT,
  WEEKLY_PUBLISH_LIMIT,
  evaluatePublishCandidate,
  loadArticles,
  parseArgs,
  parseNow,
  validatePublishedSchedule
} from './publishing-schedule.mjs';

const OFFICIAL_VOLUME_COVER_PREFIX = '/images/volumes/';

function validateFormalVolumeCover(article) {
  const errors = [];
  if (!article?.data?.volume) return errors;

  const root = process.cwd();
  const volumeFile = path.join(root, 'src', 'content', 'volumes', `${article.data.volume}.md`);
  if (!fs.existsSync(volumeFile)) {
    return [`${article.relativePath}: volume file not found: ${path.relative(root, volumeFile)}`];
  }

  const parsed = matter(fs.readFileSync(volumeFile, 'utf8'));
  const coverImage = parsed.data.coverImage;
  const coverAlt = parsed.data.coverAlt;
  const rel = path.relative(root, volumeFile);

  if (!coverImage) {
    errors.push(`${rel}: formal volume coverImage is required before publishing articles in ${article.data.volume}`);
    return errors;
  }

  if (!String(coverImage).startsWith(OFFICIAL_VOLUME_COVER_PREFIX)) {
    errors.push(`${rel}: formal volume coverImage must live under ${OFFICIAL_VOLUME_COVER_PREFIX}`);
  }

  if (!coverAlt || !String(coverAlt).includes('AI生成')) {
    errors.push(`${rel}: coverAlt must disclose AI生成ビジュアル`);
  }

  const imagePath = path.join(root, 'public', String(coverImage).replace(/^\//, ''));
  if (!fs.existsSync(imagePath)) {
    errors.push(`${rel}: formal volume cover image does not exist in public/: ${coverImage}`);
    return errors;
  }

  const metaPath = imagePath.replace(/\.(png|jpe?g|webp|avif)$/i, '.json');
  if (!fs.existsSync(metaPath)) {
    errors.push(`${rel}: formal volume cover metadata sidecar is missing: ${path.relative(root, metaPath)}`);
    return errors;
  }

  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (metadata.source !== 'ai-generated') {
    errors.push(`${path.relative(root, metaPath)}: source must be ai-generated`);
  }

  if (metadata.usage !== 'volume-cover') {
    errors.push(`${path.relative(root, metaPath)}: usage must be volume-cover`);
  }

  return errors;
}

const args = parseArgs(process.argv.slice(2));
const now = parseNow(args.now || process.env.KOTATSU_NOW);
const articles = loadArticles();

const result = args.candidate
  ? evaluatePublishCandidate(articles, String(args.candidate), { now })
  : validatePublishedSchedule(articles, { now });

if (args.candidate && result.candidate) {
  result.errors.push(...validateFormalVolumeCover(result.candidate));
}

for (const warning of result.warnings) {
  console.warn(`Warning: ${warning}`);
}

if (result.errors.length) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}

if (args.candidate) {
  const article = result.candidate;
  console.log(
    `KOTATSU publish gate passed for ${article.slug}: week ${result.targetWeek} ${result.weekPublishedCount + 1}/${WEEKLY_PUBLISH_LIMIT}, month ${result.targetMonth} ${result.monthPublishedCount + 1}/${MONTHLY_PUBLISH_LIMIT}.`
  );
} else {
  console.log(
    `KOTATSU publishing schedule checks passed. Limits: ${WEEKLY_PUBLISH_LIMIT}/week, ${MONTHLY_PUBLISH_LIMIT}/month.`
  );
}
