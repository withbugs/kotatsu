export const creativeVisualPolicyVolume = 3;

export const articleCategories = new Set([
  'STYLE',
  'LIFE',
  'WEEKEND',
  'CULTURE',
  'PEOPLE',
  'SHOPPING',
  'COLUMN'
]);

export const visualModes = new Set(['photorealistic', 'illustration', 'collage']);
export const compositionFamilies = new Set([
  'portrait-presence',
  'human-environment',
  'human-action',
  'street-observation',
  'object-narrative',
  'material-study',
  'spatial-interior',
  'editorial-illustration',
  'editorial-collage',
  'abstract-symbolic'
]);
export const sceneFamilies = new Set([
  'interior',
  'street',
  'transit',
  'cafe',
  'workshop',
  'vehicle',
  'nature',
  'graphic-space'
]);
export const perspectives = new Set([
  'eye-level',
  'overhead',
  'low-angle',
  'high-angle',
  'first-person',
  'detail',
  'long-lens-layered'
]);
export const humanPresences = new Set(['none', 'anonymous', 'roster-model']);

const contrastAxes = [
  'visualMode',
  'compositionFamily',
  'sceneFamily',
  'perspective',
  'cameraDistance',
  'visualTemperature',
  'visualDensity',
  'humanPresence'
];

function hasText(value, minLength = 10) {
  return typeof value === 'string' && value.trim().length >= minLength && !value.includes('TODO');
}

function sectionBody(raw, heading) {
  const start = raw.indexOf(heading);
  if (start < 0) return '';
  const remainder = raw.slice(start + heading.length);
  const nextHeading = remainder.search(/^##\s+/m);
  return nextHeading < 0 ? remainder : remainder.slice(0, nextHeading);
}

export function validatePlanCreativeFreedom(raw) {
  const errors = [];
  const body = sectionBody(raw, '## AI生成ビジュアル方針');
  if (!body) return errors;

  const categoryPattern = new RegExp(`\\b(?:${[...articleCategories].join('|')})\\b`);
  const sequencePattern = /(?:構図|画風|媒体|場所|視点|距離|モデル).*(?:シークエンス|公開順|第[一二三四五六七八九十0-9]+本)/;

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (categoryPattern.test(trimmed)) {
      errors.push(
        '## AI生成ビジュアル方針 must remain volume-wide; category-specific visual commitments belong only in ## ビジュアルプログラム'
      );
      break;
    }
  }

  if (sequencePattern.test(body)) {
    errors.push(
      'the volume plan must not assign an article-by-article visual sequence; exact art direction belongs to agent:visual-editor'
    );
  }

  return errors;
}

export function extractVisualProgram(raw) {
  const body = sectionBody(raw, '## ビジュアルプログラム');
  if (!body) return { error: 'missing required section ## ビジュアルプログラム' };

  const fencedJson = body.match(/```json\s*([\s\S]*?)```/i);
  if (!fencedJson) return { error: 'ビジュアルプログラム must contain one fenced json object' };

  try {
    return { program: JSON.parse(fencedJson[1]) };
  } catch (error) {
    return { error: `ビジュアルプログラム contains invalid JSON (${error.message})` };
  }
}

export function validateVisualProgram(program, volumeSlug) {
  const errors = [];
  const nonPhoto = program?.nonPhotorealisticArticle;
  const roster = program?.rosterModelArticle;

  if (program?.version !== 1) errors.push('visual program version must be 1');
  if (program?.volume !== volumeSlug) errors.push(`visual program volume must be ${volumeSlug}`);
  if (program?.creativeOwner !== 'agent:visual-editor') {
    errors.push('visual program creativeOwner must be agent:visual-editor');
  }

  if (!articleCategories.has(nonPhoto?.category)) {
    errors.push('nonPhotorealisticArticle.category must be a valid article category');
  }
  if (
    !Array.isArray(nonPhoto?.allowedModes) ||
    nonPhoto.allowedModes.length === 0 ||
    nonPhoto.allowedModes.some((mode) => !['illustration', 'collage'].includes(mode))
  ) {
    errors.push('nonPhotorealisticArticle.allowedModes must contain illustration and/or collage');
  }
  if (!articleCategories.has(roster?.category)) {
    errors.push('rosterModelArticle.category must be a valid article category');
  }
  if (nonPhoto?.category && nonPhoto.category === roster?.category) {
    errors.push('non-photorealistic and roster-model commitments must use different categories');
  }
  if (
    !Array.isArray(program?.retiredPatterns) ||
    program.retiredPatterns.length < 3 ||
    program.retiredPatterns.some((item) => !hasText(item))
  ) {
    errors.push('retiredPatterns must describe at least three recent visual patterns not to repeat');
  }

  const forbiddenAssignments = ['compositionFamily', 'sceneFamily', 'perspective', 'cameraDistance', 'modelId'];
  for (const key of forbiddenAssignments) {
    if (Object.hasOwn(nonPhoto || {}, key) || Object.hasOwn(roster || {}, key)) {
      errors.push(`${key} belongs to the visual editor, not the volume plan`);
    }
  }

  return errors;
}

export function countVisualDifferences(current, previous) {
  return contrastAxes.filter(
    (axis) => current?.[axis] != null && previous?.[axis] != null && current[axis] !== previous[axis]
  );
}

export function validateCreativeVisual(record, options = {}) {
  const {
    frontmatterMode,
    category,
    program,
    previousCategory,
    rosterIds = new Set(),
    label = 'metadata'
  } = options;
  const errors = [];
  const requireValue = (key, allowed) => {
    if (!allowed.has(record?.[key])) errors.push(`${label}.${key} must be one of: ${[...allowed].join(', ')}`);
  };

  requireValue('visualMode', visualModes);
  requireValue('compositionFamily', compositionFamilies);
  requireValue('sceneFamily', sceneFamilies);
  requireValue('perspective', perspectives);
  requireValue('humanPresence', humanPresences);

  if (frontmatterMode !== record?.visualMode) {
    errors.push(`${label}.visualMode must match frontmatter visual.mode (${frontmatterMode})`);
  }
  if (!hasText(record?.creativeRationale)) {
    errors.push(`${label}.creativeRationale must explain the selected visual language`);
  }

  if (record?.humanPresence === 'roster-model') {
    if (!rosterIds.has(record?.modelId)) {
      errors.push(`${label}.modelId must identify a registered roster model when humanPresence is roster-model`);
    }
  } else if (record?.modelId) {
    errors.push(`${label}.modelId is only allowed when humanPresence is roster-model`);
  }

  if (program && category === program.nonPhotorealisticArticle?.category) {
    if (!program.nonPhotorealisticArticle.allowedModes.includes(record?.visualMode)) {
      errors.push(`${label}.visualMode must fulfill the volume non-photorealistic commitment`);
    }
  }
  if (program && category === program.rosterModelArticle?.category && record?.humanPresence !== 'roster-model') {
    errors.push(`${label}.humanPresence must fulfill the volume roster-model commitment`);
  }

  if (previousCategory) {
    if (record?.sameCategoryReviewedAgainst !== previousCategory.slug) {
      errors.push(`${label}.sameCategoryReviewedAgainst must be ${previousCategory.slug}`);
    }
    if (!hasText(record?.categoryVisualDifference)) {
      errors.push(`${label}.categoryVisualDifference must explain the change from the previous same-category hero`);
    }
    const differences = countVisualDifferences(record, previousCategory.metadata);
    if (differences.length < 3) {
      errors.push(
        `${label} must differ from ${previousCategory.slug} on at least three visual axes; changed: ${differences.join(', ') || 'none'}`
      );
    }
  }

  return errors;
}
