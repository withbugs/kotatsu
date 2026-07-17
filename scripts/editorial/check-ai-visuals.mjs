import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { diversityPolicyEffectiveAt, seasonalPolicyEffectiveAt } from './visual-policy-dates.mjs';

const root = process.cwd();
const volumeDir = path.join(root, 'src', 'content', 'volumes');
const articleDir = path.join(root, 'src', 'content', 'articles');
const contentDirs = [volumeDir, articleDir];
const publicDir = path.join(root, 'public');
const modelRosterPath = path.join(root, 'docs', 'editorial', 'models', 'roster.json');
const pendingVisualMarker = '__AI_VISUAL_PENDING__';
const allowedTemperatures = new Set(['cool', 'neutral', 'warm', 'mixed']);
const allowedDensities = new Set(['airy', 'balanced', 'dense']);

function listContentFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listContentFiles(fullPath);
    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function hasText(value, minLength = 3) {
  return typeof value === 'string' && value.trim().length >= minLength && !value.includes('TODO');
}

function hasMeaningfulText(value) {
  return hasText(value, 10);
}

function hasMeaningfulList(value) {
  return Array.isArray(value) && value.length >= 2 && value.every((item) => hasMeaningfulText(String(item)));
}

function hasPalette(value) {
  return Array.isArray(value) && value.length >= 3 && value.every((item) => hasText(String(item), 2));
}

function readJson(file, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error.message})`);
    return null;
  }
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

function requiresDiversity(file, data, imageValue) {
  if (String(imageValue) === pendingVisualMarker) return false;

  if (file.startsWith(volumeDir)) {
    return Number(data.number) >= 2;
  }

  if (file.startsWith(articleDir)) {
    const publishAt = Date.parse(data.publishAt);
    return Number.isFinite(publishAt) && publishAt >= diversityPolicyEffectiveAt;
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

function validateDiversity(record, rel, errors, expectedComparisons = []) {
  if (!record || !hasText(record.compositionFamily)) {
    errors.push(`${rel}: metadata.compositionFamily must identify the visual grammar`);
  }
  if (!record || !hasText(record.cameraDistance)) {
    errors.push(`${rel}: metadata.cameraDistance must identify the framing distance`);
  }
  if (!record || !allowedTemperatures.has(record.visualTemperature)) {
    errors.push(`${rel}: metadata.visualTemperature must be cool, neutral, warm, or mixed`);
  }
  if (!record || !allowedDensities.has(record.visualDensity)) {
    errors.push(`${rel}: metadata.visualDensity must be airy, balanced, or dense`);
  }
  if (!record || !hasPalette(record.dominantPalette)) {
    errors.push(`${rel}: metadata.dominantPalette must list at least three visible dominant colors`);
  }
  if (!record || !Array.isArray(record.similarityReviewedAgainst) || record.similarityReviewedAgainst.length < 2) {
    errors.push(`${rel}: metadata.similarityReviewedAgainst must list at least two recent article slugs`);
  }
  if (!record || !hasMeaningfulText(record.visualDifference)) {
    errors.push(`${rel}: metadata.visualDifference must explain how this image differs from recent heroes`);
  }
  if (!record || record.reviewedBy !== 'agent:visual-editor') {
    errors.push(`${rel}: metadata.reviewedBy must be agent:visual-editor`);
  }

  for (const slug of expectedComparisons) {
    if (!record?.similarityReviewedAgainst?.includes(slug)) {
      errors.push(`${rel}: metadata.similarityReviewedAgainst must include recent article ${slug}`);
    }
  }
}

function validateReaderComfort(record, rel, errors) {
  const readerComfort = record?.readerComfort;

  if (!readerComfort || readerComfort.reviewedBy !== 'agent:visual-editor') {
    errors.push(`${rel}: metadata.readerComfort.reviewedBy must be agent:visual-editor`);
  }
  if (!readerComfort || !Array.isArray(readerComfort.hygieneSensitiveItemsOnFloor)) {
    errors.push(`${rel}: metadata.readerComfort.hygieneSensitiveItemsOnFloor must be an array`);
  } else if (readerComfort.hygieneSensitiveItemsOnFloor.length > 0) {
    errors.push(`${rel}: hygiene-sensitive personal items must not be placed directly on a floor, ground, pavement, or entrance dirt floor`);
  }
  if (!readerComfort || !hasMeaningfulText(readerComfort.placementNotes)) {
    errors.push(`${rel}: metadata.readerComfort.placementNotes must describe where personal items are placed in the visible image`);
  }
}

const errors = [];
const referencedImages = new Map();
const articleVisuals = [];
const roster = readJson(modelRosterPath, errors, path.relative(root, modelRosterPath));
const modelById = new Map((roster?.models || []).map((model) => [model.id, model]));

for (const model of modelById.values()) {
  if (!hasText(model.referenceImage)) {
    errors.push(`${path.relative(root, modelRosterPath)}: model ${model.id} is missing referenceImage`);
    continue;
  }
  const referencePath = path.join(root, model.referenceImage);
  if (!fs.existsSync(referencePath)) {
    errors.push(`${path.relative(root, modelRosterPath)}: model ${model.id} reference image does not exist: ${model.referenceImage}`);
  }
}

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
      const diversityReviewRequired = requiresDiversity(file, parsed.data, imageValue);
      if (seasonalReviewRequired) {
        validateSeasonality(visual, rel, errors, 'visual');
      }

      const existing = referencedImages.get(imageValue);
      referencedImages.set(imageValue, {
        seasonalReviewRequired: Boolean(existing?.seasonalReviewRequired || seasonalReviewRequired),
        diversityReviewRequired: Boolean(existing?.diversityReviewRequired || diversityReviewRequired),
        expectedComparisons: existing?.expectedComparisons || []
      });

      if (file.startsWith(articleDir) && key === 'heroImage') {
        articleVisuals.push({
          slug: path.basename(file, path.extname(file)),
          publishAt: Date.parse(parsed.data.publishAt),
          image: String(imageValue),
          diversityReviewRequired
        });
      }
    }
  }
}

const chronologicalArticles = articleVisuals
  .filter((entry) => Number.isFinite(entry.publishAt) && entry.image !== pendingVisualMarker)
  .sort((a, b) => a.publishAt - b.publishAt || a.slug.localeCompare(b.slug));

for (const current of chronologicalArticles) {
  if (!current.diversityReviewRequired) continue;
  const previous = chronologicalArticles
    .filter((entry) => entry.publishAt < current.publishAt)
    .slice(-2)
    .map((entry) => entry.slug);
  const reference = referencedImages.get(current.image);
  if (reference) reference.expectedComparisons = previous;
}

const metadataByImage = new Map();

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

  const metadataRel = path.relative(root, metaPath);
  const metadata = readJson(metaPath, errors, metadataRel);
  if (!metadata) continue;
  metadataByImage.set(image, metadata);

  if (metadata.source !== 'ai-generated') {
    errors.push(`${metadataRel}: source must be ai-generated`);
  }

  if (reference.seasonalReviewRequired) {
    validateSeasonality(metadata, metadataRel, errors, 'metadata');
  }

  if (reference.diversityReviewRequired) {
    validateDiversity(metadata, metadataRel, errors, reference.expectedComparisons);
    validateReaderComfort(metadata, metadataRel, errors);
  }

  if (metadata.modelId && !modelById.has(metadata.modelId)) {
    errors.push(`${metadataRel}: modelId ${metadata.modelId} is not registered in docs/editorial/models/roster.json`);
  }
}

for (let index = 0; index < chronologicalArticles.length; index += 1) {
  const current = chronologicalArticles[index];
  if (!current.diversityReviewRequired || index === 0) continue;

  const previous = chronologicalArticles[index - 1];
  const currentMetadata = metadataByImage.get(current.image);
  const previousMetadata = metadataByImage.get(previous.image);
  if (!currentMetadata || !previousMetadata) continue;

  if (previousMetadata.compositionFamily && currentMetadata.compositionFamily === previousMetadata.compositionFamily) {
    errors.push(`${current.slug}: compositionFamily repeats adjacent article ${previous.slug}`);
  }

  if (previousMetadata.modelId && currentMetadata.modelId === previousMetadata.modelId) {
    errors.push(`${current.slug}: modelId repeats adjacent article ${previous.slug}`);
  }

  const recentWindow = chronologicalArticles.slice(Math.max(0, index - 3), index + 1);
  const stillLifeCount = recentWindow.filter((entry) =>
    String(metadataByImage.get(entry.image)?.compositionFamily || '').startsWith('still-life')
  ).length;
  if (recentWindow.length === 4 && stillLifeCount > 2) {
    errors.push(`${current.slug}: more than two of the latest four article heroes use still-life composition families`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU AI visual checks passed.');
