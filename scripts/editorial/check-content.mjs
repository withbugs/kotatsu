import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const root = process.cwd();
const articleDir = path.join(root, 'src', 'content', 'articles');
const bannedWords = [
  '絶対買うべき',
  '今すぐ真似したい',
  'モテる',
  '垢抜け',
  '神アイテム',
  '正解コーデ',
  'これ一択',
  '爆売れ',
  '知らないと損'
];

function listContentFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listContentFiles(fullPath);
    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const errors = [];

for (const file of listContentFiles(articleDir)) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = matter(raw);
  const rel = path.relative(root, file);

  for (const word of bannedWords) {
    if (raw.includes(word)) {
      errors.push(`${rel}: banned expression found: ${word}`);
    }
  }

  const requiredFields = ['title', 'description', 'category', 'volume', 'status', 'publishAt', 'heroImage', 'heroAlt'];
  for (const field of requiredFields) {
    if (!parsed.data[field]) {
      errors.push(`${rel}: missing frontmatter field: ${field}`);
    }
  }

  if (parsed.data.heroAlt && !String(parsed.data.heroAlt).includes('AI生成')) {
    errors.push(`${rel}: heroAlt must disclose AI生成ビジュアル`);
  }

  if (parsed.content.trim().length < 80) {
    errors.push(`${rel}: content is too short for publication`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU content checks passed.');

