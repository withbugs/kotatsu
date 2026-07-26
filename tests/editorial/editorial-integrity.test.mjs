import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEditorialIntegrity } from '../../scripts/editorial/editorial-integrity.mjs';

const planEntryTitle = '仕事帰りの服を、週末へほどく人';
const planContent = `# Vol. 001\n\n| 6 | PEOPLE | ${planEntryTitle} | 狙い |`;

function article(overrides = {}) {
  const publishAt = overrides.publishAt ?? '2026-07-31T00:00:00+09:00';
  const data = {
    title: planEntryTitle,
    volume: 'vol-001',
    status: 'draft',
    publishAt,
    editorial: {
      issueNumber: 18,
      approvedPlan: 'docs/editorial/plans/vol-001.md',
      planEntryTitle,
      briefVolume: 'vol-001',
      publicationDate: '2026-07-31',
      briefReviewedAt: '2026-07-27',
      sourceVolumes: ['vol-001'],
      integrityReview: {
        status: 'pending',
        crossVolumeDecision: 'not-applicable'
      }
    },
    ...overrides.data
  };

  return {
    relativePath: 'src/content/articles/example.mdx',
    slug: 'example',
    data,
    publishAt: new Date(publishAt)
  };
}

test('published articles before the policy date remain valid without metadata', () => {
  const oldArticle = article({
    publishAt: '2026-07-22T00:00:00+09:00',
    data: { status: 'published', editorial: undefined }
  });
  assert.deepEqual(validateEditorialIntegrity(oldArticle, { planContent }), []);
});

test('unfinished articles require editorial integrity metadata', () => {
  const draft = article({ data: { editorial: undefined } });
  assert.match(validateEditorialIntegrity(draft, { planContent }).join('\n'), /metadata is required/);
});

test('article volume, plan, and publication date must agree', () => {
  const draft = article({
    data: {
      editorial: {
        ...article().data.editorial,
        briefVolume: 'vol-002',
        publicationDate: '2026-08-01'
      }
    }
  });
  const errors = validateEditorialIntegrity(draft, { planContent }).join('\n');
  assert.match(errors, /briefVolume must match/);
  assert.match(errors, /publicationDate must match/);
});

test('the plan entry title must exist in the approved volume plan', () => {
  const draft = article({
    data: {
      editorial: {
        ...article().data.editorial,
        planEntryTitle: '別のVol.から持ち込まれた見出し'
      }
    }
  });
  assert.match(validateEditorialIntegrity(draft, { planContent }).join('\n'), /not present/);
});

test('cross-volume sources require an explicit rationale', () => {
  const draft = article({
    data: {
      editorial: {
        ...article().data.editorial,
        sourceVolumes: ['vol-001', 'vol-002'],
        integrityReview: { status: 'pending', crossVolumeDecision: 'pending' }
      }
    }
  });
  assert.match(validateEditorialIntegrity(draft, { planContent }).join('\n'), /crossVolumeRationale/);
});

test('scheduling is blocked until the copy editor passes integrity review', () => {
  const scheduled = article({ data: { status: 'scheduled' } });
  assert.match(
    validateEditorialIntegrity(scheduled, { planContent, requireReview: true }).join('\n'),
    /copy-editor integrity review must pass/
  );
});

test('a complete independent review passes the scheduling gate', () => {
  const scheduled = article({
    data: {
      status: 'scheduled',
      editorial: {
        ...article().data.editorial,
        integrityReview: {
          status: 'passed',
          reviewedBy: 'agent:copy-editor',
          reviewedAt: '2026-07-30',
          planAlignment: 'Vol. 001正式計画の週末への切り替えという狙いに沿っている。',
          timingAlignment: '2026年7月31日の日本の盛夏と公開時点に表現が合っている。',
          crossVolumeDecision: 'not-applicable'
        }
      }
    }
  });
  assert.deepEqual(validateEditorialIntegrity(scheduled, { planContent, requireReview: true }), []);
});

test('copy review must decide whether a cross-volume source is accepted or removed', () => {
  const scheduled = article({
    data: {
      status: 'scheduled',
      editorial: {
        ...article().data.editorial,
        sourceVolumes: ['vol-001', 'vol-002'],
        crossVolumeRationale: '冷房差だけを7月末の生活背景として参照し、8月固有の行事は持ち込まない。',
        integrityReview: {
          status: 'passed',
          reviewedBy: 'agent:copy-editor',
          reviewedAt: '2026-07-30',
          planAlignment: 'Vol. 001正式計画の週末への切り替えという狙いに沿っている。',
          timingAlignment: '2026年7月31日の日本の盛夏と公開時点に表現が合っている。',
          crossVolumeDecision: 'not-applicable'
        }
      }
    }
  });
  assert.match(
    validateEditorialIntegrity(scheduled, { planContent, requireReview: true }).join('\n'),
    /explicitly accepted or removed/
  );
});
