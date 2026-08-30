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
function splitBoundaryList(value) {
  return String(value || '').split('||').map((entry) => entry.trim()).filter(Boolean);
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
const crossVolumeReferences = splitBoundaryList(
  args.crossVolumePlanEntries || args['cross-volume-plan-entries']
).map((entry) => {
  const [referenceVolume, ...titleParts] = entry.split('::');
  return { volume: referenceVolume.trim(), planEntryTitle: titleParts.join('::').trim() };
});
const crossVolumeAllowedTopics = splitBoundaryList(
  args.crossVolumeAllowedTopics || args['cross-volume-allowed-topics']
);
const crossVolumeExcludedTopics = splitBoundaryList(
  args.crossVolumeExcludedTopics || args['cross-volume-excluded-topics']
);
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

if (crossVolumeSources.length) {
  const referenceVolumes = new Set(crossVolumeReferences.map((reference) => reference.volume));
  if (crossVolumeReferences.length !== crossVolumeSources.length ||
      referenceVolumes.size !== crossVolumeReferences.length ||
      crossVolumeSources.some((entry) => !referenceVolumes.has(entry)) ||
      crossVolumeReferences.some((reference) => reference.planEntryTitle.length < 4)) {
    console.error('--cross-volume-plan-entries must map every source as vol-XXX::plan entry title');
    process.exit(1);
  }
  if (!crossVolumeAllowedTopics.length || crossVolumeAllowedTopics.some((topic) => topic.length < 3)) {
    console.error('--cross-volume-allowed-topics must list concrete topics separated by ||');
    process.exit(1);
  }
  if (!crossVolumeExcludedTopics.length || crossVolumeExcludedTopics.some((topic) => topic.length < 3)) {
    console.error('--cross-volume-excluded-topics must list reserved topics separated by ||');
    process.exit(1);
  }
  for (const reference of crossVolumeReferences) {
    const sourcePlanPath = path.join(process.cwd(), 'docs', 'editorial', 'plans', `${reference.volume}.md`);
    if (!fs.existsSync(sourcePlanPath) ||
        !fs.readFileSync(sourcePlanPath, 'utf8').includes(reference.planEntryTitle)) {
      console.error(`Cross-volume plan entry is not present in docs/editorial/plans/${reference.volume}.md`);
      process.exit(1);
    }
  }
} else if (crossVolumeReferences.length || crossVolumeAllowedTopics.length || crossVolumeExcludedTopics.length) {
  console.error('Cross-volume boundary arguments require another entry in --source-volumes');
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
const crossVolumeReferenceYaml = crossVolumeReferences
  .map((reference) => `      - volume: ${JSON.stringify(reference.volume)}\n        planEntryTitle: ${JSON.stringify(reference.planEntryTitle)}`)
  .join('\n');
const crossVolumeAllowedYaml = crossVolumeAllowedTopics
  .map((topic) => `      - ${JSON.stringify(topic)}`)
  .join('\n');
const crossVolumeExcludedYaml = crossVolumeExcludedTopics
  .map((topic) => `      - ${JSON.stringify(topic)}`)
  .join('\n');
const crossVolumeReviewYaml = crossVolumeSources.length
  ? `  crossVolumeReview:\n    references:\n${crossVolumeReferenceYaml}\n    allowedTopics:\n${crossVolumeAllowedYaml}\n    excludedTopics:\n${crossVolumeExcludedYaml}\n    managingEditorApproval:\n      status: pending\n`
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
${crossVolumeYaml}${crossVolumeReviewYaml}  integrityReview:
    status: pending
    crossVolumeDecision: ${crossVolumeDecision}
visual:
  source: ai-generated
  mode: pending
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
