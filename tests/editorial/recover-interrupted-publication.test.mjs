import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';
import test from 'node:test';

const script = path.resolve('scripts/editorial/recover-interrupted-publication.mjs');

function createFixture(body = '本文。') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-delivery-recovery-'));
  const articleDir = path.join(root, 'src', 'content', 'articles');
  const planDir = path.join(root, 'docs', 'editorial', 'plans');
  const imageDir = path.join(root, 'public', 'images', 'articles');
  fs.mkdirSync(articleDir, { recursive: true });
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(imageDir, { recursive: true });
  fs.writeFileSync(path.join(planDir, 'vol-002.md'), '| 3 | WEEKEND | 小さな夏の外出 | 狙い |', 'utf8');
  fs.writeFileSync(path.join(imageDir, 'summer-outing.json'), JSON.stringify({
    source: 'ai-generated',
    seasonalContext: '2026年8月16日の盛夏に合わせた短い外出'
  }), 'utf8');
  const articlePath = path.join(articleDir, 'summer-outing.mdx');
  fs.writeFileSync(articlePath, `---
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
    planAlignment: 正式計画の見出しと狙いに沿い、夏の短い外出と服装の距離感を扱っている。
    timingAlignment: 再予約後の2026年8月16日の盛夏と公開時点に表現が合っている。
    crossVolumeDecision: not-applicable
visual:
  source: ai-generated
  mode: photorealistic
  promptSummary: 真夏の駅前から静かな日陰へ歩いていく人物を中景で描く。
  intent: 暑い日の短い外出と休む余白を表す。
  seasonalContext: 2026年8月16日の日本の盛夏。
  avoid: []
tags: []
---

${body}
`, 'utf8');
  return { root, articlePath, sidecarPath: path.join(imageDir, 'summer-outing.json') };
}

test('delivery recovery preserves passed gates and updates internal dates', () => {
  const fixture = createFixture();
  try {
    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-20T00:00:00+09:00',
      '--now=2026-08-20T13:00:00+09:00',
      '--resume-unmerged-publication'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /kotatsu:publish \+ agent:publisher/);
    const parsed = matter(fs.readFileSync(fixture.articlePath, 'utf8'));
    assert.equal(parsed.data.status, 'scheduled');
    assert.equal(parsed.data.publishAt, '2026-08-20T00:00:00+09:00');
    assert.equal(parsed.data.editorial.publicationDate, '2026-08-20');
    assert.equal(parsed.data.editorial.integrityReview.status, 'passed');
    assert.equal(parsed.data.editorial.scheduleRecovery.mode, 'delivery');
    assert.equal(parsed.data.editorial.scheduleRecovery.approvedBy, 'agent:publisher');
    assert.equal(parsed.data.editorial.scheduleRecovery.qualityGatesPreserved, true);
    assert.match(parsed.data.editorial.integrityReview.timingAlignment, /2026年8月20日/);
    assert.match(fs.readFileSync(fixture.sidecarPath, 'utf8'), /2026年8月20日/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('delivery recovery rejects an unauthorized handler', () => {
  const fixture = createFixture();
  try {
    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-20T00:00:00+09:00',
      '--handled-by=agent:editor-in-chief'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /--handled-by/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('delivery recovery uses the current booking rather than the audit origin for its seven-day limit', () => {
  const fixture = createFixture();
  try {
    const parsed = matter(fs.readFileSync(fixture.articlePath, 'utf8'));
    parsed.data.editorial.scheduleRecovery = {
      originalPublishAt: '2026-08-11T00:00:00+09:00',
      previousPublishAt: '2026-08-11T00:00:00+09:00',
      rescheduledPublishAt: '2026-08-16T00:00:00+09:00',
      rescheduledAt: '2026-08-14T00:05:12.764Z',
      reason: 'The original slot was rebooked after production recovery.',
      approvedBy: 'agent:managing-editor',
      attempt: 1,
      visualRecheckRequired: false
    };
    fs.writeFileSync(fixture.articlePath, matter.stringify(parsed.content, parsed.data), 'utf8');

    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-20T00:00:00+09:00',
      '--now=2026-08-20T17:00:00+09:00',
      '--resume-unmerged-publication'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const recovered = matter(fs.readFileSync(fixture.articlePath, 'utf8'));
    assert.equal(recovered.data.editorial.scheduleRecovery.originalPublishAt, '2026-08-11T00:00:00+09:00');
    assert.equal(recovered.data.editorial.scheduleRecovery.previousPublishAt, '2026-08-16T00:00:00+09:00');
    assert.equal(recovered.data.editorial.scheduleRecovery.approvedBy, 'agent:publisher');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('delivery recovery refuses to rewrite a reader-facing date', () => {
  const fixture = createFixture('2026年8月16日に歩いた記録。');
  try {
    const before = fs.readFileSync(fixture.articlePath, 'utf8');
    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-20T00:00:00+09:00',
      '--now=2026-08-20T13:00:00+09:00',
      '--resume-unmerged-publication'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /reader-facing content/);
    assert.equal(fs.readFileSync(fixture.articlePath, 'utf8'), before);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('delivery recovery over seven days requires editorial recovery', () => {
  const fixture = createFixture();
  try {
    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-24T00:00:00+09:00',
      '--now=2026-08-20T13:00:00+09:00',
      '--resume-unmerged-publication'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /limited to seven days/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
