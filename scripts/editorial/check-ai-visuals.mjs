import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const root = process.cwd();
const contentDirs = [
  path.join(root, 'src', 'content', 'volumes'),
  path.join(root, 'src', 'content', 'articles')
];
const publicDir = path.join(root, 'public');

function listContentFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listContentFiles(fullPath);
    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const errors = [];
const referencedImages = new Set();

for (const dir of contentDirs) {
  for (const file of listContentFiles(dir)) {
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(root, file);
    const visual = parsed.data.visual;

    if (!visual || visual.source !== 'ai-generated') {
      errors.push(`${rel}: visual.source must be ai-generated`);
    }

    for (const key of ['coverImage', 'heroImage']) {
      if (parsed.data[key]) {
        referencedImages.add(parsed.data[key]);
      }
    }
  }
}

for (const image of referencedImages) {
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
  if (metadata.source !== 'ai-generated') {
    errors.push(`${path.relative(root, metaPath)}: source must be ai-generated`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU AI visual checks passed.');

