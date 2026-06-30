import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=') || true];
  })
);

function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

const title = args.title || process.env.KOTATSU_ARTICLE_TITLE;
if (!title) {
  console.error('Usage: pnpm article:new -- --title="..." --category=STYLE --volume=vol-001');
  process.exit(1);
}

const category = args.category || 'STYLE';
const volume = args.volume || 'vol-001';
const slug = args.slug || slugify(title);
const outDir = path.join(process.cwd(), 'src', 'content', 'articles');
const outPath = path.join(outDir, `${slug}.mdx`);

if (fs.existsSync(outPath)) {
  console.error(`Article already exists: ${path.relative(process.cwd(), outPath)}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const template = `---
title: ${title}
description: TODO: 記事の狙いを一文で書く。
category: ${category}
volume: ${volume}
kind: feature
template: feature
status: draft
publishAt: "${new Date().toISOString()}"
heroImage: "__AI_VISUAL_PENDING__"
heroAlt: TODO: AI生成ビジュアルをビジュアル編集工程で生成する
visual:
  source: ai-generated
  mode: photorealistic
  promptSummary: TODO: ビジュアル編集工程で生成プロンプトの要約を書く。
  intent: TODO: 編集意図を書く。
  avoid:
    - real brand logos
    - real store signage
    - celebrity likeness
tags: []
---

TODO: 本文を書く。
`;

fs.writeFileSync(outPath, template, 'utf8');
console.log(`Created ${path.relative(process.cwd(), outPath)}`);