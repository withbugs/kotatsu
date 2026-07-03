#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const root = process.cwd();
const volumeDir = path.join(root, 'src', 'content', 'volumes');
const publicDir = path.join(root, 'public');
const OFFICIAL_VOLUME_COVER_PREFIX = '/images/volumes/';

function listContentFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listContentFiles(fullPath);
    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function volumeSlugFromFile(file) {
  return path.basename(file).replace(/\.(md|mdx)$/, '');
}

function validateCoverImage(volume, rel, errors) {
  const { coverImage, coverAlt } = volume.data;

  if (!coverImage) {
    if (volume.data.status === 'active' || volume.data.status === 'complete') {
      errors.push(`${rel}: active or complete volume must have a formal coverImage`);
    }
    return;
  }

  if (!String(coverImage).startsWith(OFFICIAL_VOLUME_COVER_PREFIX)) {
    errors.push(`${rel}: formal volume coverImage must live under ${OFFICIAL_VOLUME_COVER_PREFIX}`);
  }

  if (!coverAlt || !String(coverAlt).includes('AI生成')) {
    errors.push(`${rel}: coverAlt must disclose AI生成ビジュアル`);
  }

  const imagePath = path.join(publicDir, String(coverImage).replace(/^\//, ''));
  if (!fs.existsSync(imagePath)) {
    errors.push(`${rel}: volume cover image does not exist in public/: ${coverImage}`);
    return;
  }

  const metaPath = imagePath.replace(/\.(png|jpe?g|webp|avif)$/i, '.json');
  if (!fs.existsSync(metaPath)) {
    errors.push(`${rel}: volume cover is missing AI visual metadata sidecar JSON: ${path.relative(root, metaPath)}`);
    return;
  }

  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (metadata.source !== 'ai-generated') {
    errors.push(`${path.relative(root, metaPath)}: source must be ai-generated`);
  }

  if (metadata.usage !== 'volume-cover') {
    errors.push(`${path.relative(root, metaPath)}: usage must be volume-cover`);
  }
}

const errors = [];

for (const file of listContentFiles(volumeDir)) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = matter(raw);
  const rel = path.relative(root, file);

  if (!['planning', 'active', 'complete'].includes(parsed.data.status)) {
    errors.push(`${rel}: invalid volume status: ${parsed.data.status}`);
    continue;
  }

  validateCoverImage({ slug: volumeSlugFromFile(file), data: parsed.data }, rel, errors);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU volume cover checks passed.');
