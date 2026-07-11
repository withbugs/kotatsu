import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const candidateDir = path.join(root, 'docs', 'editorial', 'candidates');
const planDir = path.join(root, 'docs', 'editorial', 'plans');

const candidateSections = [
  '## 調査ログ',
  '## ウェブ調査による需要シグナル',
  '## 読者需要の仮説',
  '## テーマ候補',
  '## 季節感',
  '## 記事構成候補',
  '## 参照情報'
];
const planSections = [
  '## 調査サマリー',
  '## ウェブ需要シグナル',
  '## 読者需要の判断',
  '## テーマ',
  '## 季節感',
  '## 記事構成',
  '## AI生成ビジュアル方針',
  '## 執筆直前の再確認'
];

function listVolumeFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /^vol-\d{3}\.md$/.test(name));
}

function volumeNumber(file) {
  return Number(file.match(/^vol-(\d{3})\.md$/)?.[1]);
}

function sectionBody(raw, heading) {
  const start = raw.indexOf(heading);
  if (start < 0) return '';
  const remainder = raw.slice(start + heading.length);
  const nextHeading = remainder.search(/^##\s+/m);
  return nextHeading < 0 ? remainder : remainder.slice(0, nextHeading);
}

function requireSections(raw, sections, rel, errors) {
  const headings = new Set(raw.split(/\r?\n/).map((line) => line.trim()));
  for (const section of sections) {
    if (!headings.has(section)) errors.push(`${rel}: missing required section ${section}`);
  }
}

const errors = [];

for (const file of listVolumeFiles(candidateDir)) {
  if (volumeNumber(file) < 2) continue;
  const fullPath = path.join(candidateDir, file);
  const rel = path.relative(root, fullPath);
  const raw = fs.readFileSync(fullPath, 'utf8');

  requireSections(raw, candidateSections, rel, errors);
  if (!/^調査更新日:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(raw)) {
    errors.push(`${rel}: missing 調査更新日: YYYY-MM-DD`);
  }

  const searchQueries = raw.match(/^検索語:\s*.+$/gm) || [];
  if (searchQueries.length < 3) {
    errors.push(`${rel}: research log must include at least three 検索語 entries`);
  }

  const references = sectionBody(raw, '## 参照情報');
  const urls = references.match(/https?:\/\/[^\s)\]}>"']+/g) || [];
  if (urls.length < 4) {
    errors.push(`${rel}: 参照情報 must include at least four web source URLs`);
  }

  const sourceTypes = new Set(
    [...references.matchAll(/種別:\s*([^|\r\n]+)/g)].map((match) => match[1].trim())
  );
  if (sourceTypes.size < 3) {
    errors.push(`${rel}: 参照情報 must include at least three distinct 種別 values`);
  }

  const checkedDates = references.match(/確認日:\s*\d{4}-\d{2}-\d{2}/g) || [];
  if (checkedDates.length < 4) {
    errors.push(`${rel}: each of at least four references must include 確認日`);
  }
}

for (const file of listVolumeFiles(planDir)) {
  if (volumeNumber(file) < 2) continue;
  const fullPath = path.join(planDir, file);
  const rel = path.relative(root, fullPath);
  const raw = fs.readFileSync(fullPath, 'utf8');

  requireSections(raw, planSections, rel, errors);
  if (!/^編集承認日:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(raw)) {
    errors.push(`${rel}: missing 編集承認日: YYYY-MM-DD`);
  }

  const candidatePath = path.join(candidateDir, file);
  if (!fs.existsSync(candidatePath)) {
    errors.push(
      `${rel}: approved plan requires corresponding candidate memo ${path.relative(root, candidatePath)}`
    );
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU editorial planning checks passed.');
