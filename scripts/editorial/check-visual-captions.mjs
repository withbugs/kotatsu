#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const root = process.cwd();
const articleDir = path.join(root, 'src', 'content', 'articles');
const publicDir = path.join(root, 'public');
const pending = '__AI_VISUAL_PENDING__';
const errors = [];

if (fs.existsSync(articleDir)) {
  for (const entry of fs.readdirSync(articleDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(md|mdx)$/.test(entry.name)) continue;

    const file = path.join(articleDir, entry.name);
    const article = matter(fs.readFileSync(file, 'utf8'));
    const heroImage = String(article.data.heroImage || '');
    if (!heroImage || heroImage === pending) continue;

    if (!heroImage.startsWith('/')) {
      errors.push(`${path.relative(root, file)}: heroImage must be root-relative`);
      continue;
    }

    const sidecar = path.join(publicDir, heroImage.slice(1)).replace(/\.(png|jpe?g|webp|avif)$/i, '.json');
    if (!fs.existsSync(sidecar)) continue;

    try {
      const metadata = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      const caption = typeof metadata.caption === 'string' ? metadata.caption.trim() : '';
      if (caption.length < 10 || caption.includes('TODO')) {
        errors.push(`${path.relative(root, sidecar)}: article visual caption must be an edited sentence`);
      }
    } catch {
      // check-ai-visuals.mjs reports malformed sidecars.
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Article visual caption check passed.');
