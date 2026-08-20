import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';
import test from 'node:test';

const script = path.resolve('scripts/editorial/rebook-overdue-article.mjs');

function createFixture({ status = 'draft', sidecarDate = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-rebook-'));
  const articleDir = path.join(root, 'src', 'content', 'articles');
  const planDir = path.join(root, 'docs', 'editorial', 'plans');
  const imageDir = path.join(root, 'public', 'images', 'articles');
  fs.mkdirSync(articleDir, { recursive: true });
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(imageDir, { recursive: true });
  fs.writeFileSync(path.join(planDir, 'vol-002.md'), '| 3 | WEEKEND | 小さな夏の外出 | 狙い |', 'utf8');
  if (sidecarDate) {
    fs.writeFileSync(path.join(imageDir, 'summer-outing.json'), JSON.stringify({
      seasonalContext: `${sidecarDate}の盛夏に合わせた短い外出`
    }), 'utf8');
  }
  const articlePath = path.join(articleDir, 'summer-outing.mdx');
  fs.writeFileSync(articlePath, `---
title: 小さな夏の外出
description: 夏の短い外出を考える記事です。
category: WEEKEND
volume: vol-002
kind: feature
template: feature
status: ${status}
publishAt: "2026-08-11T00:00:00+09:00"
heroImage: ${sidecarDate ? '/images/articles/summer-outing.webp' : '__AI_VISUAL_PENDING__'}
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
    status: ${status === 'published' ? 'passed' : 'pending'}
    ${status === 'published' ? 'reviewedBy: agent:copy-editor\n    reviewedAt: "2026-08-10"\n    planAlignment: 正式計画に沿っている。\n    timingAlignment: 盛夏の公開時期に沿っている。' : ''}
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
  return { root, articlePath };
}

test('editorial rebooking updates public and editorial dates together', () => {
  const fixture = createFixture();
  try {
    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-14T00:00:00+09:00',
      '--now=2026-08-12T16:00:00+09:00'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = matter(fs.readFileSync(fixture.articlePath, 'utf8'));
    assert.equal(parsed.data.status, 'draft');
    assert.equal(parsed.data.publishAt, '2026-08-14T00:00:00+09:00');
    assert.equal(parsed.data.editorial.publicationDate, '2026-08-14');
    assert.equal(parsed.data.editorial.scheduleRecovery.mode, 'editorial');
    assert.equal(parsed.data.editorial.scheduleRecovery.attempt, 1);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('editorial rebooking requires visual review for an old sidecar date', () => {
  const fixture = createFixture({ sidecarDate: '2026年8月11日' });
  try {
    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-14T00:00:00+09:00',
      '--now=2026-08-12T16:00:00+09:00'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Visual recheck required/);
    const parsed = matter(fs.readFileSync(fixture.articlePath, 'utf8'));
    assert.equal(parsed.data.editorial.scheduleRecovery.visualRecheckRequired, true);
    assert.equal(parsed.data.editorial.integrityReview.status, 'pending');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('published articles are routed to the separate delivery recovery command', () => {
  const fixture = createFixture({ status: 'published' });
  try {
    const before = fs.readFileSync(fixture.articlePath, 'utf8');
    const result = spawnSync(process.execPath, [
      script,
      '--slug=summer-outing',
      '--publishAt=2026-08-14T00:00:00+09:00',
      '--now=2026-08-12T16:00:00+09:00'
    ], { cwd: fixture.root, encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /article:recover-publication/);
    assert.equal(fs.readFileSync(fixture.articlePath, 'utf8'), before);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
