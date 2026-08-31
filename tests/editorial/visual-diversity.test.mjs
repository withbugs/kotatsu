import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countVisualDifferences,
  extractVisualProgram,
  validateCreativeVisual,
  validatePlanCreativeFreedom,
  validateVisualProgram
} from '../../scripts/editorial/visual-diversity.mjs';

const program = {
  version: 1,
  volume: 'vol-003',
  creativeOwner: 'agent:visual-editor',
  nonPhotorealisticArticle: {
    category: 'CULTURE',
    allowedModes: ['illustration', 'collage']
  },
  rosterModelArticle: {
    category: 'PEOPLE'
  },
  retiredPatterns: [
    '窓辺に白いシャツを置く静物構図',
    '鞄へ物を入れる匿名の手元構図',
    '日陰の街路を歩く人物の後ろ姿'
  ]
};

function creativeRecord(overrides = {}) {
  return {
    visualMode: 'illustration',
    compositionFamily: 'editorial-illustration',
    sceneFamily: 'graphic-space',
    perspective: 'high-angle',
    cameraDistance: 'wide',
    visualTemperature: 'mixed',
    visualDensity: 'dense',
    humanPresence: 'none',
    creativeRationale: '記事の抽象的な余韻を、紙の質感と大胆な視点で視覚化する。',
    sameCategoryReviewedAgainst: 'previous-culture',
    categoryVisualDifference: '前回の窓辺の静物から、平面的な構成と高い視点へ切り替えた。',
    ...overrides
  };
}

test('extracts and validates the bounded volume visual program', () => {
  const raw = `# Plan\n\n## ビジュアルプログラム\n\n\`\`\`json\n${JSON.stringify(program)}\n\`\`\`\n`;
  const parsed = extractVisualProgram(raw);
  assert.deepEqual(parsed.program, program);
  assert.deepEqual(validateVisualProgram(parsed.program, 'vol-003'), []);
});

test('keeps exact art direction out of the editor-in-chief plan', () => {
  const overDirected = structuredClone(program);
  overDirected.nonPhotorealisticArticle.compositionFamily = 'editorial-illustration';
  assert.match(validateVisualProgram(overDirected, 'vol-003').join('\n'), /belongs to the visual editor/);
});

test('accepts a volume-wide visual policy that leaves exact direction to the visual editor', () => {
  const raw = `## AI生成ビジュアル方針

- すべてのheroはAI生成物とする。
- 具体的な媒体、構図、場所、視点、距離、モデルはビジュアル編集が記事ごとに選定する。
`;
  assert.deepEqual(validatePlanCreativeFreedom(raw), []);
});

test('rejects category-fixed art direction outside the bounded visual program', () => {
  const raw = `## AI生成ビジュアル方針

- STYLEを material-macro、LIFEを still-life-oblique とする。
`;
  assert.match(validatePlanCreativeFreedom(raw).join('\n'), /category-specific visual commitments/);
});

test('rejects an article-by-article visual sequence in the volume plan', () => {
  const raw = `## AI生成ビジュアル方針

- 構図のシークエンスは第1本を近接、第2本を俯瞰とする。
`;
  assert.match(validatePlanCreativeFreedom(raw).join('\n'), /article-by-article visual sequence/);
});

test('rejects a visual program without three retired recent patterns', () => {
  const incomplete = structuredClone(program);
  incomplete.retiredPatterns = ['one pattern'];
  assert.match(validateVisualProgram(incomplete, 'vol-003').join('\n'), /at least three recent visual patterns/);
});

test('accepts a non-photorealistic article that changes at least three visual axes', () => {
  const previousCategory = {
    slug: 'previous-culture',
    metadata: {
      visualMode: 'photorealistic',
      compositionFamily: 'still-life-oblique',
      cameraDistance: 'close',
      visualTemperature: 'cool',
      visualDensity: 'airy'
    }
  };
  const errors = validateCreativeVisual(creativeRecord(), {
    frontmatterMode: 'illustration',
    category: 'CULTURE',
    program,
    previousCategory,
    rosterIds: new Set(['K-01-NAO'])
  });
  assert.deepEqual(errors, []);
  assert.ok(countVisualDifferences(creativeRecord(), previousCategory.metadata).length >= 3);
});

test('rejects a future still-life mode and a frontmatter-sidecar mismatch', () => {
  const errors = validateCreativeVisual(creativeRecord({ visualMode: 'still-life' }), {
    frontmatterMode: 'photorealistic',
    category: 'STYLE',
    program,
    rosterIds: new Set()
  });
  assert.match(errors.join('\n'), /visualMode must be one of/);
  assert.match(errors.join('\n'), /must match frontmatter/);
});

test('enforces the roster commitment and registered model identity', () => {
  const missingModel = validateCreativeVisual(creativeRecord({
    visualMode: 'photorealistic',
    compositionFamily: 'portrait-presence',
    sceneFamily: 'workshop',
    perspective: 'eye-level',
    humanPresence: 'anonymous',
    sameCategoryReviewedAgainst: undefined,
    categoryVisualDifference: undefined
  }), {
    frontmatterMode: 'photorealistic',
    category: 'PEOPLE',
    program,
    rosterIds: new Set(['K-04-MIKI'])
  });
  assert.match(missingModel.join('\n'), /roster-model commitment/);

  const validModel = validateCreativeVisual(creativeRecord({
    visualMode: 'photorealistic',
    compositionFamily: 'portrait-presence',
    sceneFamily: 'workshop',
    perspective: 'eye-level',
    humanPresence: 'roster-model',
    modelId: 'K-04-MIKI',
    sameCategoryReviewedAgainst: undefined,
    categoryVisualDifference: undefined
  }), {
    frontmatterMode: 'photorealistic',
    category: 'PEOPLE',
    program,
    rosterIds: new Set(['K-04-MIKI'])
  });
  assert.deepEqual(validModel, []);
});

test('rejects same-category metadata that changes fewer than three axes', () => {
  const previousCategory = {
    slug: 'previous-culture',
    metadata: creativeRecord({ categoryVisualDifference: undefined })
  };
  const errors = validateCreativeVisual(creativeRecord({ visualTemperature: 'cool' }), {
    frontmatterMode: 'illustration',
    category: 'CULTURE',
    program,
    previousCategory,
    rosterIds: new Set()
  });
  assert.match(errors.join('\n'), /at least three visual axes/);
});
