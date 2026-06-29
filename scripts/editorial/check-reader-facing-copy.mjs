#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const root = process.cwd();
const sourceDirs = [
  path.join(root, 'src', 'pages'),
  path.join(root, 'src', 'components'),
  path.join(root, 'src', 'layouts')
];
const contentDirs = [
  path.join(root, 'src', 'content', 'issues'),
  path.join(root, 'src', 'content', 'articles')
];

const blockedTerms = [
  'Issue planning',
  'NOW PLANNING',
  'Coming Soon',
  'Comming Soon',
  'Lorem ipsum',
  '編集長',
  '進行編集',
  '月刊号設計',
  'AI生成ビジュアル方針',
  '候補案',
  'TODO',
  '絶対買うべき',
  '今すぐ真似したい',
  'モテる',
  '垢抜け',
  '神アイテム',
  '正解コーデ',
  'これ一択',
  '爆売れ',
  '知らないと損',
  '買わせる'
];

function listFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath, pattern);
    return pattern.test(entry.name) ? [fullPath] : [];
  });
}

function rel(file) {
  return path.relative(root, file);
}

function findBlockedTerms(text, file, errors) {
  for (const term of blockedTerms) {
    if (text.includes(term)) {
      errors.push(`${rel(file)}: reader-facing copy must not include internal or unfinished term: ${term}`);
    }
  }
}

const errors = [];

for (const dir of sourceDirs) {
  for (const file of listFiles(dir, /\.(astro|ts|tsx|js|jsx)$/)) {
    findBlockedTerms(fs.readFileSync(file, 'utf8'), file, errors);
  }
}

for (const dir of contentDirs) {
  for (const file of listFiles(dir, /\.(md|mdx)$/)) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = matter(raw);

    if (parsed.data.status === 'draft') {
      continue;
    }

    const frontmatterText = [
      parsed.data.title,
      parsed.data.subtitle,
      parsed.data.description,
      parsed.data.heroAlt,
      parsed.data.coverAlt
    ]
      .filter(Boolean)
      .join('\n');

    findBlockedTerms(`${frontmatterText}\n${parsed.content}`, file, errors);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU reader-facing copy checks passed.');



