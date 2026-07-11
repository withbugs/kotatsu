import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const root = process.cwd();
const volumeDir = path.join(root, 'src', 'content', 'volumes');
const articleDir = path.join(root, 'src', 'content', 'articles');
const contentDirs = [volumeDir, articleDir];
const publicDir = path.join(root, 'public');
const pendingVisualMarker = '__AI_VISUAL_PENDING__';
const seasonalPolicyEffectiveAt = Date.parse('2026-07-12T00:00:00+09:00');

function listContentFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listContentFiles(fullPath);
    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function hasMeaningfulText(value) {
  return typeof value === 'string' && value.trim().length >= 10 && !value.includes('TODO');
}

function hasMeaningfulList(value) {
  return Array.isArray(value) && value.length >= 2 && value.every((item) => hasMeaningfulText(String(item)));
}

function requiresSeasonality(file, data, imageValue) {
  if (String(imageValue) === pendingVisualMarker) return false;

  if (file.startsWith(volumeDir)) {
    return Number(data.number) >= 2;
  }

  if (file.startsWith(articleDir)) {
    if (data.status !== 'published') return true;
    const publishAt = Date.parse(data.publishAt);
    return Number.isFinite(publishAt) && publishAt >= seasonalPolicyEffectiveAt;
  }

  return false;
}

function validateSeasonality(record, rel, errors, label) {
  if (!record || !hasMeaningfulText(record.seasonalContext)) {
    errors.push(`${rel}: ${label}.seasonalContext must describe publication period, locale, and climate`);
  }

  if (!record || !hasMeaningfulList(record.seasonalCues)) {
    errors.push(`${rel}: ${label}.seasonalCues must contain at least two concrete wardrobe or environment cues`);
  }

  if (!record || !hasMeaningfulList(record.seasonalAvoid)) {
    errors.push(`${rel}: ${label}.seasonalAvoid must contain at least two seasonal-misread risks`);
  }

  if (!record || record.seasonalityReviewedBy !== 'agent:visual-editor') {
    errors.push(`${rel}: ${label}.seasonalityReviewedBy must be agent:visual-editor`);
  }
}

const errors = [];
const referencedImages = new Map();

for (const dir of contentDirs) {
  for (const file of listContentFiles(dir)) {
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(root, file);
    const visual = parsed.data.visual;

    if (!visual || visual.source !== 'ai-generated') {
      errors.push(`${rel}: visual.source must be ai-generated`);
    }

    for (const key of ['coverImage', 'heroImage']) {
      const imageValue = parsed.data[key];
      if (!imageValue) continue;

      const isDraftArticle = file.startsWith(articleDir) && parsed.data.status === 'draft';
      const isPendingDraftHero =
        key === 'heroImage' && isDraftArticle && String(imageValue) === pendingVisualMarker;
      if (isPendingDraftHero) continue;

      const seasonalReviewRequired = requiresSeasonality(file, parsed.data, imageValue);
      if (seasonalReviewRequired) {
        validateSeasonality(visual, rel, errors, 'visual');
      }

      const existing = referencedImages.get(imageValue);
      referencedImages.set(imageValue, {
        seasonalReviewRequired: Boolean(existing?.seasonalReviewRequired || seasonalReviewRequired)
      });
    }
  }
}

for (const [image, reference] of referencedImages) {
  if (!image.startsWith('/')) {
    errors.push(`${image}: image path must be root-relative`);
    continue;
  }

  const imagePath = path.join(publicDir, image.slice(1));
  if (!fs.existsSync(imagePath)) {
    errors.push(`${image}: image file does not exist in public/`);
    continue;
  }

  const metaPath = imagePath.replace(/\.(png|jpe?g|webp|avif)$/i, '.json');
  if (!fs.existsSync(metaPath)) {
    errors.push(`${image}: missing AI visual metadata sidecar JSON`);
    continue;
  }

  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const metadataRel = path.relative(root, metaPath);
  if (metadata.source !== 'ai-generated') {
    errors.push(`${metadataRel}: source must be ai-generated`);
  }

  if (reference.seasonalReviewRequired) {
    validateSeasonality(metadata, metadataRel, errors, 'metadata');
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU AI visual checks passed.');
