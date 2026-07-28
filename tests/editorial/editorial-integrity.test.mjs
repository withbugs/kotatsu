import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEditorialIntegrity } from '../../scripts/editorial/editorial-integrity.mjs';

const planEntryTitle = '仕事帰りの服を、週末へほどく人';
const planContent = `# Vol. 001\n\n| 6 | PEOPLE | ${planEntryTitle} | 狙い |`;
const sourcePlanEntryTitle = '夏休み明けの仕事服を整える人';
const sourcePlanContents = {
  'vol-002': `# Vol. 002\n\n| 6 | PEOPLE | ${sourcePlanEntryTitle} | 狙い |`
};

function crossVolumeReview(approval = { status: 'pending' }) {
  return {
    references: [{ volume: 'vol-002', planEntryTitle: sourcePlanEntryTitle }],
    allowedTopics: ['冷房による温度差'],
    excludedTopics: ['休み明けの仕事服'],
    managingEditorApproval: approval
  };
}

function passedCopyReview(crossVolumeDecision = 'accepted') {
  return {
    status: 'passed',
    reviewedBy: 'agent:copy-editor',
    reviewedAt: '2026-07-30',
    planAlignment: 'Vol. 001正式計画の週末への切り替えという狙いに沿っている。',
    timingAlignment: '2026年7月31日の日本の盛夏と公開時点に表現が合っている。',
    crossVolumeDecision
  };
}


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
    publishAt: new Date(publishAt),
    body: overrides.body ?? ''
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
    /explicitly accepted/
  );
});

test('cross-volume sources require structured boundaries', () => {
  const draft = article({
    data: {
      editorial: {
        ...article().data.editorial,
        sourceVolumes: ['vol-001', 'vol-002'],
        crossVolumeRationale: '冷房差だけを7月末の生活背景として参照し、8月固有の行事は持ち込まない。',
        integrityReview: { status: 'pending', crossVolumeDecision: 'pending' }
      }
    }
  });
  assert.match(
    validateEditorialIntegrity(draft, { planContent, sourcePlanContents }).join('\n'),
    /crossVolumeReview/
  );
});

test('a future volume plan entry title is reserved from article body reuse', () => {
  const draft = article({
    body: '休み明けの仕事服を整える感覚を、少しだけ先取りする。',
    data: {
      editorial: {
        ...article().data.editorial,
        sourceVolumes: ['vol-001', 'vol-002'],
        crossVolumeRationale: '冷房差だけを7月末の生活背景として参照し、次号の仕事服企画は先取りしない。',
        crossVolumeReview: crossVolumeReview(),
        integrityReview: { status: 'pending', crossVolumeDecision: 'pending' }
      }
    }
  });
  assert.match(
    validateEditorialIntegrity(draft, { planContent, sourcePlanContents }).join('\n'),
    /overlaps the reserved cross-volume plan entry/
  );
});

test('excluded cross-volume topics cannot appear in the article body', () => {
  const boundary = crossVolumeReview();
  boundary.excludedTopics = ['お盆の旅行'];
  const draft = article({
    body: 'お盆の旅行へ向けて、荷物を整えておきたい。',
    data: {
      editorial: {
        ...article().data.editorial,
        sourceVolumes: ['vol-001', 'vol-002'],
        crossVolumeRationale: '冷房差だけを7月末の生活背景として参照し、お盆の旅行文脈は持ち込まない。',
        crossVolumeReview: boundary,
        integrityReview: { status: 'pending', crossVolumeDecision: 'pending' }
      }
    }
  });
  assert.match(
    validateEditorialIntegrity(draft, { planContent, sourcePlanContents }).join('\n'),
    /contains excluded cross-volume topic/
  );
});

test('scheduling cross-volume use requires managing editor approval after copy review', () => {
  const scheduled = article({
    body: '冷房による温度差を、七月末の薄い羽織で受け止める。',
    data: {
      status: 'scheduled',
      editorial: {
        ...article().data.editorial,
        sourceVolumes: ['vol-001', 'vol-002'],
        crossVolumeRationale: '冷房差だけを7月末の生活背景として参照し、次号の仕事服企画は先取りしない。',
        crossVolumeReview: crossVolumeReview(),
        integrityReview: passedCopyReview()
      }
    }
  });
  assert.match(
    validateEditorialIntegrity(scheduled, { planContent, sourcePlanContents, requireReview: true }).join('\n'),
    /managing editor must approve/
  );
});

test('approved and bounded cross-volume use passes the scheduling gate', () => {
  const approval = {
    status: 'approved',
    reviewedBy: 'agent:managing-editor',
    reviewedAt: '2026-07-30',
    rationale: '次号の仕事服企画や休み明けの場面を本文へ持ち込まず、冷房差だけを補助情報として扱っている。'
  };
  const scheduled = article({
    body: '冷房による温度差を、七月末の薄い羽織で受け止める。',
    data: {
      status: 'scheduled',
      editorial: {
        ...article().data.editorial,
        sourceVolumes: ['vol-001', 'vol-002'],
        crossVolumeRationale: '冷房差だけを7月末の生活背景として参照し、次号の仕事服企画は先取りしない。',
        crossVolumeReview: crossVolumeReview(approval),
        integrityReview: passedCopyReview()
      }
    }
  });
  assert.deepEqual(
    validateEditorialIntegrity(scheduled, { planContent, sourcePlanContents, requireReview: true }),
    []
  );
});
