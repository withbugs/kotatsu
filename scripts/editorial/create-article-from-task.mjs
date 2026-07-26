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
  console.error('Usage: pnpm article:new -- --title="..." --category=STYLE --volume=vol-001 --issue=18 --publishAt="2026-07-31T00:00:00+09:00" --brief-reviewed-at=2026-07-27');
  process.exit(1);
}

const category = args.category || 'STYLE';
const volume = args.volume || 'vol-001';
const issueNumber = Number(args.issue);
const publishAt = String(args.publishAt || args['publish-at'] || '');
const publishDate = new Date(publishAt);
const briefReviewedAt = String(args.briefReviewedAt || args['brief-reviewed-at'] || '');
const planEntryTitle = String(args.planEntryTitle || args['plan-entry-title'] || title);
const sourceVolumes = String(args.sourceVolumes || args['source-volumes'] || volume)
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const crossVolumeRationale = String(args.crossVolumeRationale || args['cross-volume-rationale'] || '');
const slug = args.slug || slugify(title);
const outDir = path.join(process.cwd(), 'src', 'content', 'articles');
const outPath = path.join(outDir, `${slug}.mdx`);

function jstDateKey(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

if (!Number.isInteger(issueNumber) || issueNumber < 1) {
  console.error('--issue must be a positive GitHub Issue number');
  process.exit(1);
}

if (Number.isNaN(publishDate.getTime())) {
  console.error('--publishAt must be a valid ISO date');
  process.exit(1);
}

const briefReviewDate = new Date(`${briefReviewedAt}T00:00:00+09:00`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(briefReviewedAt) || Number.isNaN(briefReviewDate.getTime()) ||
    jstDateKey(briefReviewDate) !== briefReviewedAt) {
  console.error('--brief-reviewed-at must be YYYY-MM-DD');
  process.exit(1);
}

if (briefReviewedAt > jstDateKey(publishDate)) {
  console.error('--brief-reviewed-at cannot be after the publication date');
  process.exit(1);
}

if (!sourceVolumes.includes(volume) || sourceVolumes.some((entry) => !/^vol-\d{3}$/.test(entry)) ||
    new Set(sourceVolumes).size !== sourceVolumes.length) {
  console.error('--source-volumes must include the article volume and use vol-XXX values');
  process.exit(1);
}

const crossVolumeSources = sourceVolumes.filter((entry) => entry !== volume);
if (crossVolumeSources.length && crossVolumeRationale.trim().length < 20) {
  console.error('--cross-volume-rationale must explain the applicable scope when another volume is referenced');
  process.exit(1);
}

if (fs.existsSync(outPath)) {
  console.error(`Article already exists: ${path.relative(process.cwd(), outPath)}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const sourceVolumeYaml = sourceVolumes.map((entry) => `    - ${JSON.stringify(entry)}`).join('\n');
const crossVolumeYaml = crossVolumeSources.length
  ? `  crossVolumeRationale: ${JSON.stringify(crossVolumeRationale)}\n`
  : '';
const crossVolumeDecision = crossVolumeSources.length ? 'pending' : 'not-applicable';

const template = `---
title: ${JSON.stringify(title)}
description: "TODO: 記事の狙いを一文で書く。"
category: ${category}
volume: ${volume}
kind: feature
template: feature
status: draft
publishAt: ${JSON.stringify(publishAt)}
heroImage: "__AI_VISUAL_PENDING__"
heroAlt: "TODO: AI生成ビジュアルをビジュアル編集工程で生成する"
editorial:
  issueNumber: ${issueNumber}
  approvedPlan: ${JSON.stringify(`docs/editorial/plans/${volume}.md`)}
  planEntryTitle: ${JSON.stringify(planEntryTitle)}
  briefVolume: ${JSON.stringify(volume)}
  publicationDate: ${JSON.stringify(jstDateKey(publishDate))}
  briefReviewedAt: ${JSON.stringify(briefReviewedAt)}
  sourceVolumes:
${sourceVolumeYaml}
${crossVolumeYaml}  integrityReview:
    status: pending
    crossVolumeDecision: ${crossVolumeDecision}
visual:
  source: ai-generated
  mode: photorealistic
  promptSummary: "TODO: ビジュアル編集工程で生成プロンプトの要約を書く。"
  intent: "TODO: 編集意図を書く。"
  seasonalContext: "TODO: 公開時期、想定地域、気温や天候を書く。"
  seasonalCues:
    - "TODO: 素材、袖丈、重ね着など服装の季節要素を書く。"
    - "TODO: 光、湿度、植物、路面、小物など環境の季節要素を書く。"
  seasonalAvoid:
    - seasonally implausible layering
    - "TODO: 別の季節に見える色、素材、小物を書く。"
  seasonalityReviewedBy: "TODO: ビジュアル編集工程で確認者を書く。"
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
