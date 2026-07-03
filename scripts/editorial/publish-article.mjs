#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  evaluatePublishCandidate,
  loadArticles,
  parseArgs,
  parseNow
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
function isBlank(value) {
  return !value || String(value).trim() === '';
}

function isPreparationText(value) {
  return String(value ?? '').includes('準備');
}

function firstLineAfterHeading(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return '';

  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) return '';
    if (trimmed) return trimmed;
  }

  return '';
}

function loadVolumePlanMeta(volumeSlug) {
  const planFile = path.join(process.cwd(), 'docs', 'editorial', 'plans', `${volumeSlug}.md`);
  if (!fs.existsSync(planFile)) return { title: '', subtitle: '' };

  const raw = fs.readFileSync(planFile, 'utf8');
  return {
    title: firstLineAfterHeading(raw, 'テーマ'),
    subtitle: firstLineAfterHeading(raw, 'サブコピー')
  };
}

function activateVolumeForArticle(article) {
  const volumeSlug = article.data.volume;
  if (!volumeSlug) return;

  const volumeFile = path.join(process.cwd(), 'src', 'content', 'volumes', `${volumeSlug}.md`);
  if (!fs.existsSync(volumeFile)) {
    console.warn(`Warning: volume file not found for ${volumeSlug}; top page may remain in planning state.`);
    return;
  }

  const raw = fs.readFileSync(volumeFile, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data;
  const plan = loadVolumePlanMeta(volumeSlug);
  let changed = false;

  function setField(key, value) {
    if (value === undefined || value === null || data[key] === value) return;
    data[key] = value;
    changed = true;
  }

  if (data.status === 'planning') {
    setField('status', 'active');
  }

  if (isBlank(data.title) || isPreparationText(data.title)) {
    const cleanedTitle = String(data.title ?? '').replace(/準備中/g, '').trim();
    setField('title', plan.title || cleanedTitle || article.data.title);
  }

  if (isBlank(data.subtitle) || isPreparationText(data.subtitle)) {
    setField('subtitle', plan.subtitle || article.data.description);
  }

  if (!changed) return;

  fs.writeFileSync(volumeFile, matter.stringify(parsed.content.trimStart(), data), 'utf8');
  console.log(`Activated ${path.relative(process.cwd(), volumeFile)} for ${article.data.title}`);
}

const args = parseArgs(process.argv.slice(2));
const slug = args.slug || args.article;

if (!slug) {
  console.error('Usage: pnpm article:publish -- --slug="article-slug"');
  process.exit(1);
}

const now = parseNow(args.now || process.env.KOTATSU_NOW);
const articles = loadArticles();
const result = evaluatePublishCandidate(articles, String(slug), { now });

if (result.candidate) {
  result.errors.push(...validateFormalVolumeCover(result.candidate));
}

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
  activateVolumeForArticle(article);
  console.log(`Already published: ${article.relativePath}`);
  process.exit(0);
}

if (!/^status:\s*["']?scheduled["']?\s*$/m.test(article.raw)) {
  console.error(`${article.relativePath}: status line must be exactly scheduled before publication`);
  process.exit(1);
}

const nextRaw = article.raw.replace(/^status:\s*["']?scheduled["']?\s*$/m, 'status: published');
fs.writeFileSync(article.file, nextRaw, 'utf8');
activateVolumeForArticle(article);

console.log(`Published ${article.relativePath}`);
console.log(
  `Schedule usage after publish: week ${result.targetWeek} ${result.weekPublishedCount + 1}/2, month ${result.targetMonth} ${result.monthPublishedCount + 1}/8.`
);
