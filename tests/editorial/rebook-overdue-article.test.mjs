import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';
import test from 'node:test';

const script = path.resolve('scripts/editorial/rebook-overdue-article.mjs');

test('rebooking keeps a draft and updates public and editorial dates together', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-rebook-'));
  try {
    const articleDir = path.join(root, 'src', 'content', 'articles');
    const planDir = path.join(root, 'docs', 'editorial', 'plans');
    fs.mkdirSync(articleDir, { recursive: true });
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, 'vol-002.md'), '| 3 | WEEKEND | 小さな夏の外出 | 狙い |', 'utf8');
    fs.writeFileSync(path.join(articleDir, 'summer-outing.mdx'), `---
title: 小さな夏の外出
description: 夏の短い外出を考える記事です。
category: WEEKEND
volume: vol-002
kind: feature
template: feature
status: draft
publishAt: "2026-08-11T00:00:00+09:00"
heroImage: __AI_VISUAL_PENDING__
heroAlt: AI生成ビジュアル準備中
editorial:
  issueNumber: 52
  approvedPlan: docs/editorial/plans/vol-002.md
  planEntryTitle: 小さな夏の外出
  briefVolume: vol-002
  publicationDate: "2026-08-11"
  briefReviewedAt: "2026-08-03"
  sourceVolumes:
    - vol-002
  integrityReview:
    status: pending
    crossVolumeDecision: not-applicable
visual:
  source: ai-generated
  mode: photorealistic
  promptSummary: 真夏の駅前から静かな日陰へ歩いていく人物を中景で描く。
  intent: 暑い日の短い外出と休む余白を表す。
  avoid: []
tags: []
---

本文。
`, 'utf8');

    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-14T00:00:00+09:00',
      '--now=2026-08-12T16:00:00+09:00'
    ], { cwd: root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = matter(fs.readFileSync(path.join(articleDir, 'summer-outing.mdx'), 'utf8'));
    assert.equal(parsed.data.status, 'draft');
    assert.equal(parsed.data.publishAt, '2026-08-14T00:00:00+09:00');
    assert.equal(parsed.data.editorial.publicationDate, '2026-08-14');
    assert.equal(parsed.data.editorial.scheduleRecovery.originalPublishAt, '2026-08-11T00:00:00+09:00');
    assert.equal(parsed.data.editorial.scheduleRecovery.attempt, 1);
    assert.equal(parsed.data.editorial.scheduleRecovery.visualRecheckRequired, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rebooking requires visual review when a sidecar uses a Japanese publication date', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-rebook-localized-date-'));
  try {
    const articleDir = path.join(root, 'src', 'content', 'articles');
    const planDir = path.join(root, 'docs', 'editorial', 'plans');
    const imageDir = path.join(root, 'public', 'images', 'articles');
    fs.mkdirSync(articleDir, { recursive: true });
    fs.mkdirSync(planDir, { recursive: true });
    fs.mkdirSync(imageDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, 'vol-002.md'), '| 3 | WEEKEND | 小さな夏の外出 | 狙い |', 'utf8');
    fs.writeFileSync(path.join(imageDir, 'summer-outing.json'), JSON.stringify({
      seasonalContext: '2026年8月11日の山の日に合わせた真夏の外出'
    }), 'utf8');
    fs.writeFileSync(path.join(articleDir, 'summer-outing.mdx'), `---
title: 小さな夏の外出
description: 夏の短い外出を考える記事です。
category: WEEKEND
volume: vol-002
kind: feature
template: feature
status: draft
publishAt: "2026-08-11T00:00:00+09:00"
heroImage: /images/articles/summer-outing.webp
heroAlt: 夏の駅前から日陰へ歩く人物
editorial:
  issueNumber: 52
  approvedPlan: docs/editorial/plans/vol-002.md
  planEntryTitle: 小さな夏の外出
  briefVolume: vol-002
  publicationDate: "2026-08-11"
  briefReviewedAt: "2026-08-03"
  sourceVolumes:
    - vol-002
  integrityReview:
    status: pending
    crossVolumeDecision: not-applicable
visual:
  source: ai-generated
  mode: photorealistic
  promptSummary: 真夏の駅前から静かな日陰へ歩いていく人物を中景で描く。
  intent: 暑い日の短い外出と休む余白を表す。
  avoid: []
tags: []
---

本文。
`, 'utf8');

    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-14T00:00:00+09:00',
      '--now=2026-08-12T16:00:00+09:00'
    ], { cwd: root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Visual recheck required/);
    const parsed = matter(fs.readFileSync(path.join(articleDir, 'summer-outing.mdx'), 'utf8'));
    assert.equal(parsed.data.editorial.scheduleRecovery.visualRecheckRequired, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an interrupted unmerged publication can return to scheduled with an explicit recovery flag', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-rebook-unmerged-publication-'));
  try {
    const articleDir = path.join(root, 'src', 'content', 'articles');
    const planDir = path.join(root, 'docs', 'editorial', 'plans');
    fs.mkdirSync(articleDir, { recursive: true });
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, 'vol-002.md'), '| 3 | WEEKEND | 小さな夏の外出 | 狙い |', 'utf8');
    fs.writeFileSync(path.join(articleDir, 'summer-outing.mdx'), `---
title: 小さな夏の外出
description: 夏の短い外出を考える記事です。
category: WEEKEND
volume: vol-002
kind: feature
template: feature
status: published
publishAt: "2026-08-16T00:00:00+09:00"
heroImage: /images/articles/summer-outing.webp
heroAlt: 夏の駅前から日陰へ歩く人物のAI生成ビジュアル
editorial:
  issueNumber: 52
  approvedPlan: docs/editorial/plans/vol-002.md
  planEntryTitle: 小さな夏の外出
  briefVolume: vol-002
  publicationDate: "2026-08-16"
  briefReviewedAt: "2026-08-03"
  sourceVolumes:
    - vol-002
  integrityReview:
    status: passed
    reviewedBy: agent:copy-editor
    reviewedAt: "2026-08-15"
    planAlignment: 正式計画の見出しと狙いに沿い、観光案内ではなく夏の短い外出と服装の距離感を扱っている。
    timingAlignment: 公開予定日の盛夏の気候と生活文脈に沿い、薄手の服と日陰を選ぶ移動として整合している。
    crossVolumeDecision: not-applicable
visual:
  source: ai-generated
  mode: photorealistic
  promptSummary: 真夏の駅前から静かな日陰へ歩いていく人物を中景で描く。
  intent: 暑い日の短い外出と休む余白を表す。
  avoid: []
tags: []
---

本文。
`, 'utf8');

    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-20T00:00:00+09:00',
      '--now=2026-08-17T09:00:00+09:00',
      '--resume-unmerged-publication'
    ], { cwd: root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = matter(fs.readFileSync(path.join(articleDir, 'summer-outing.mdx'), 'utf8'));
    assert.equal(parsed.data.status, 'scheduled');
    assert.equal(parsed.data.publishAt, '2026-08-20T00:00:00+09:00');
    assert.equal(parsed.data.editorial.publicationDate, '2026-08-20');
    assert.equal(parsed.data.editorial.scheduleRecovery.resumedFromUnmergedPublication, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
