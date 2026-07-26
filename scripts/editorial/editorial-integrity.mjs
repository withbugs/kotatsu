import fs from 'node:fs';
import path from 'node:path';

export const EDITORIAL_INTEGRITY_POLICY_EFFECTIVE_AT = Date.parse('2026-07-27T00:00:00+09:00');

const REVIEW_STATUSES = new Set(['pending', 'passed']);
const CROSS_VOLUME_DECISIONS = new Set(['pending', 'not-applicable', 'accepted', 'removed']);
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function hasText(value, minLength = 1) {
  return typeof value === 'string' && value.trim().length >= minLength && !value.includes('TODO');
}

function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00+09:00`);
  return !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value;
}

function dateKey(date) {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function publishDateFor(article) {
  if (article.publishAt instanceof Date) return article.publishAt;
  return article.data.publishAt ? new Date(article.data.publishAt) : null;
}

export function requiresEditorialIntegrity(article) {
  if (article.data.status !== 'published') return true;
  const publishAt = publishDateFor(article);
  return publishAt instanceof Date && !Number.isNaN(publishAt.getTime()) &&
    publishAt.getTime() >= EDITORIAL_INTEGRITY_POLICY_EFFECTIVE_AT;
}

export function validateEditorialIntegrity(article, options = {}) {
  if (!requiresEditorialIntegrity(article)) return [];

  const root = options.root ?? process.cwd();
  const requireReview = options.requireReview ?? article.data.status !== 'draft';
  const errors = [];
  const rel = article.relativePath ?? `article:${article.slug ?? article.data.title ?? 'unknown'}`;
  const editorial = article.data.editorial;
  const publishAt = publishDateFor(article);

  if (!editorial || typeof editorial !== 'object') {
    return [`${rel}: editorial integrity metadata is required`];
  }

  if (!Number.isInteger(editorial.issueNumber) || editorial.issueNumber < 1) {
    errors.push(`${rel}: editorial.issueNumber must be a positive integer`);
  }

  const expectedPlan = `docs/editorial/plans/${article.data.volume}.md`;
  if (editorial.approvedPlan !== expectedPlan) {
    errors.push(`${rel}: editorial.approvedPlan must match article volume: ${expectedPlan}`);
  }

  if (editorial.briefVolume !== article.data.volume) {
    errors.push(`${rel}: editorial.briefVolume must match article volume ${article.data.volume}`);
  }

  if (!publishAt || Number.isNaN(publishAt.getTime())) {
    errors.push(`${rel}: publishAt must be valid before editorial integrity can be checked`);
  } else if (editorial.publicationDate !== dateKey(publishAt)) {
    errors.push(`${rel}: editorial.publicationDate must match publishAt in Asia/Tokyo: ${dateKey(publishAt)}`);
  }

  if (!isDateKey(editorial.briefReviewedAt)) {
    errors.push(`${rel}: editorial.briefReviewedAt must be YYYY-MM-DD`);
  } else if (isDateKey(editorial.publicationDate) && editorial.briefReviewedAt > editorial.publicationDate) {
    errors.push(`${rel}: editorial.briefReviewedAt cannot be after editorial.publicationDate`);
  }

  if (!hasText(editorial.planEntryTitle, 4)) {
    errors.push(`${rel}: editorial.planEntryTitle is required`);
  }

  let planContent = options.planContent;
  if (planContent === undefined && editorial.approvedPlan === expectedPlan) {
    const planPath = path.join(root, editorial.approvedPlan);
    if (!fs.existsSync(planPath)) {
      errors.push(`${rel}: approved plan does not exist: ${editorial.approvedPlan}`);
    } else {
      planContent = fs.readFileSync(planPath, 'utf8');
    }
  }
  if (typeof planContent === 'string' && hasText(editorial.planEntryTitle, 4) &&
      !planContent.includes(editorial.planEntryTitle)) {
    errors.push(`${rel}: editorial.planEntryTitle is not present in ${expectedPlan}`);
  }

  const sourceVolumes = editorial.sourceVolumes;
  if (!Array.isArray(sourceVolumes) || sourceVolumes.length < 1) {
    errors.push(`${rel}: editorial.sourceVolumes must list at least the article volume`);
  } else {
    if (!sourceVolumes.includes(article.data.volume)) {
      errors.push(`${rel}: editorial.sourceVolumes must include ${article.data.volume}`);
    }
    if (new Set(sourceVolumes).size !== sourceVolumes.length) {
      errors.push(`${rel}: editorial.sourceVolumes must not contain duplicates`);
    }
    for (const volume of sourceVolumes) {
      if (!/^vol-\d{3}$/.test(String(volume))) {
        errors.push(`${rel}: invalid source volume: ${volume}`);
      }
    }
  }

  const crossVolumeSources = Array.isArray(sourceVolumes)
    ? sourceVolumes.filter((volume) => volume !== article.data.volume)
    : [];
  if (crossVolumeSources.length && !hasText(editorial.crossVolumeRationale, 20)) {
    errors.push(`${rel}: cross-volume sources require editorial.crossVolumeRationale`);
  }

  const review = editorial.integrityReview;
  if (!review || typeof review !== 'object' || !REVIEW_STATUSES.has(review.status)) {
    errors.push(`${rel}: editorial.integrityReview.status must be pending or passed`);
    return errors;
  }

  if (!CROSS_VOLUME_DECISIONS.has(review.crossVolumeDecision)) {
    errors.push(`${rel}: editorial.integrityReview.crossVolumeDecision is invalid`);
  }

  if (requireReview && review.status !== 'passed') {
    errors.push(`${rel}: independent copy-editor integrity review must pass before scheduling`);
  }

  if (review.status === 'passed') {
    if (review.reviewedBy !== 'agent:copy-editor') {
      errors.push(`${rel}: editorial.integrityReview.reviewedBy must be agent:copy-editor`);
    }
    if (!isDateKey(review.reviewedAt)) {
      errors.push(`${rel}: editorial.integrityReview.reviewedAt must be YYYY-MM-DD`);
    } else {
      if (isDateKey(editorial.briefReviewedAt) && review.reviewedAt < editorial.briefReviewedAt) {
        errors.push(`${rel}: integrity review cannot predate the brief review`);
      }
      if (isDateKey(editorial.publicationDate) && review.reviewedAt > editorial.publicationDate) {
        errors.push(`${rel}: integrity review cannot be after publicationDate`);
      }
    }
    if (!hasText(review.planAlignment, 20)) {
      errors.push(`${rel}: integrity review must explain planAlignment`);
    }
    if (!hasText(review.timingAlignment, 20)) {
      errors.push(`${rel}: integrity review must explain timingAlignment`);
    }
    if (crossVolumeSources.length && !['accepted', 'removed'].includes(review.crossVolumeDecision)) {
      errors.push(`${rel}: cross-volume sources must be explicitly accepted or removed`);
    }
    if (!crossVolumeSources.length && review.crossVolumeDecision !== 'not-applicable') {
      errors.push(`${rel}: crossVolumeDecision must be not-applicable when no other volume is referenced`);
    }
  }

  return errors;
}
