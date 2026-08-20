import fs from 'node:fs';
import path from 'node:path';

export const EDITORIAL_INTEGRITY_POLICY_EFFECTIVE_AT = Date.parse('2026-07-27T00:00:00+09:00');

const REVIEW_STATUSES = new Set(['pending', 'passed']);
const CROSS_VOLUME_DECISIONS = new Set(['pending', 'not-applicable', 'accepted', 'removed']);
const MANAGING_EDITOR_DECISIONS = new Set(['pending', 'approved', 'rejected']);
const MIN_SHARED_TITLE_PHRASE_LENGTH = 8;
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

function normalizeForComparison(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, '');
}

function longestSharedPhrase(left, right, minLength = MIN_SHARED_TITLE_PHRASE_LENGTH) {
  const source = normalizeForComparison(left);
  const target = normalizeForComparison(right);
  const maxLength = Math.min(source.length, target.length);

  for (let length = maxLength; length >= minLength; length -= 1) {
    for (let start = 0; start <= source.length - length; start += 1) {
      const phrase = source.slice(start, start + length);
      if (target.includes(phrase)) return phrase;
    }
  }

  return '';
}

function articleBody(article) {
  return article.parsed?.content ?? article.body ?? '';
}

function validateTopicList(errors, rel, field, topics) {
  if (!Array.isArray(topics) || topics.length < 1) {
    errors.push(`${rel}: ${field} must list at least one topic`);
    return [];
  }

  const validTopics = [];
  const normalized = new Set();
  for (const topic of topics) {
    if (!hasText(topic, 3)) {
      errors.push(`${rel}: ${field} entries must contain at least 3 characters`);
      continue;
    }
    const key = normalizeForComparison(topic);
    if (normalized.has(key)) {
      errors.push(`${rel}: ${field} must not contain duplicate topics`);
      continue;
    }
    normalized.add(key);
    validTopics.push(topic);
  }
  return validTopics;
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

  const recovery = editorial.scheduleRecovery;
  if (recovery !== undefined) {
    if (!recovery || typeof recovery !== 'object') {
      errors.push(`${rel}: editorial.scheduleRecovery must be an object`);
    } else {
      for (const field of ['originalPublishAt', 'previousPublishAt', 'rescheduledPublishAt', 'rescheduledAt']) {
        if (Number.isNaN(new Date(String(recovery[field] || '')).getTime())) {
          errors.push(`${rel}: editorial.scheduleRecovery.${field} must be a valid date`);
        }
      }
      if (recovery.rescheduledPublishAt !== article.data.publishAt) {
        errors.push(`${rel}: editorial.scheduleRecovery.rescheduledPublishAt must match publishAt`);
      }
      if (!hasText(recovery.reason, 10)) {
        errors.push(`${rel}: editorial.scheduleRecovery.reason must explain the delay`);
      }
      if (recovery.approvedBy !== 'agent:managing-editor') {
        errors.push(`${rel}: editorial.scheduleRecovery.approvedBy must be agent:managing-editor`);
      }
      if (!Number.isInteger(recovery.attempt) || recovery.attempt < 1) {
        errors.push(`${rel}: editorial.scheduleRecovery.attempt must be a positive integer`);
      }
      if (recovery.mode !== undefined && !['editorial', 'delivery'].includes(recovery.mode)) {
        errors.push(`${rel}: editorial.scheduleRecovery.mode must be editorial or delivery`);
      }
      if (recovery.mode === 'delivery') {
        if (recovery.qualityGatesPreserved !== true) {
          errors.push(`${rel}: delivery recovery must preserve completed quality gates`);
        }
        if (recovery.automatedDateFieldsUpdated !== true) {
          errors.push(`${rel}: delivery recovery must record automated internal date updates`);
        }
        if (recovery.visualRecheckRequired !== false) {
          errors.push(`${rel}: delivery recovery cannot require an editorial visual recheck`);
        }
      }
      if (recovery.editorialRevalidatedAt !== undefined && !isDateKey(recovery.editorialRevalidatedAt)) {
        errors.push(`${rel}: editorial.scheduleRecovery.editorialRevalidatedAt must be YYYY-MM-DD`);
      }
      if (typeof recovery.visualRecheckRequired !== 'boolean') {
        errors.push(`${rel}: editorial.scheduleRecovery.visualRecheckRequired must be boolean`);
      }
      if (recovery.visualRevalidatedAt !== undefined && !isDateKey(recovery.visualRevalidatedAt)) {
        errors.push(`${rel}: editorial.scheduleRecovery.visualRevalidatedAt must be YYYY-MM-DD`);
      }
      if (requireReview && recovery.visualRecheckRequired && !isDateKey(recovery.visualRevalidatedAt)) {
        errors.push(`${rel}: recovery date references require visual revalidation before scheduling`);
      }
    }
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

  const boundary = editorial.crossVolumeReview;
  let managingEditorApproval;
  if (crossVolumeSources.length) {
    if (!boundary || typeof boundary !== 'object') {
      errors.push(`${rel}: cross-volume sources require editorial.crossVolumeReview`);
    } else {
      const references = Array.isArray(boundary.references) ? boundary.references : [];
      const referenceVolumes = references.map((reference) => reference?.volume);
      const uniqueReferenceVolumes = new Set(referenceVolumes);
      if (references.length !== crossVolumeSources.length || uniqueReferenceVolumes.size !== references.length ||
          crossVolumeSources.some((volume) => !uniqueReferenceVolumes.has(volume))) {
        errors.push(`${rel}: crossVolumeReview.references must identify one plan entry for every cross-volume source`);
      }

      for (const reference of references) {
        if (!reference || !crossVolumeSources.includes(reference.volume) || !hasText(reference.planEntryTitle, 4)) {
          errors.push(`${rel}: each cross-volume reference requires a source volume and plan entry title`);
          continue;
        }

        const sourcePlanPath = `docs/editorial/plans/${reference.volume}.md`;
        let sourcePlanContent = options.sourcePlanContents?.[reference.volume];
        if (sourcePlanContent === undefined) {
          const fullPath = path.join(root, sourcePlanPath);
          if (fs.existsSync(fullPath)) sourcePlanContent = fs.readFileSync(fullPath, 'utf8');
        }
        if (typeof sourcePlanContent !== 'string') {
          errors.push(`${rel}: cross-volume source plan does not exist: ${sourcePlanPath}`);
        } else if (!sourcePlanContent.includes(reference.planEntryTitle)) {
          errors.push(`${rel}: cross-volume plan entry is not present in ${sourcePlanPath}`);
        }

        const sharedPhrase = longestSharedPhrase(reference.planEntryTitle, articleBody(article));
        if (sharedPhrase) {
          errors.push(
            `${rel}: article body overlaps the reserved cross-volume plan entry ` +
            `${JSON.stringify(reference.planEntryTitle)} through phrase ${JSON.stringify(sharedPhrase)}`
          );
        }
      }

      const allowedTopics = validateTopicList(
        errors,
        rel,
        'editorial.crossVolumeReview.allowedTopics',
        boundary.allowedTopics
      );
      const excludedTopics = validateTopicList(
        errors,
        rel,
        'editorial.crossVolumeReview.excludedTopics',
        boundary.excludedTopics
      );
      const allowedKeys = new Set(allowedTopics.map(normalizeForComparison));
      const normalizedBody = normalizeForComparison(articleBody(article));
      for (const topic of excludedTopics) {
        const normalizedTopic = normalizeForComparison(topic);
        if (allowedKeys.has(normalizedTopic)) {
          errors.push(`${rel}: a cross-volume topic cannot be both allowed and excluded: ${topic}`);
        }
        if (normalizedBody.includes(normalizedTopic)) {
          errors.push(`${rel}: article body contains excluded cross-volume topic: ${topic}`);
        }
      }

      managingEditorApproval = boundary.managingEditorApproval;
      if (!managingEditorApproval || !MANAGING_EDITOR_DECISIONS.has(managingEditorApproval.status)) {
        errors.push(`${rel}: crossVolumeReview.managingEditorApproval.status must be pending, approved, or rejected`);
      }
    }
  } else if (boundary !== undefined) {
    errors.push(`${rel}: editorial.crossVolumeReview must be omitted when no other volume is referenced`);
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
    if (crossVolumeSources.length && review.crossVolumeDecision !== 'accepted') {
      errors.push(`${rel}: retained cross-volume sources must be explicitly accepted by the copy editor`);
    }
    if (!crossVolumeSources.length && review.crossVolumeDecision !== 'not-applicable') {
      errors.push(`${rel}: crossVolumeDecision must be not-applicable when no other volume is referenced`);
    }

    if (crossVolumeSources.length && requireReview) {
      if (managingEditorApproval?.status !== 'approved') {
        errors.push(`${rel}: managing editor must approve accepted cross-volume use before scheduling`);
      } else {
        if (managingEditorApproval.reviewedBy !== 'agent:managing-editor') {
          errors.push(`${rel}: cross-volume approval reviewedBy must be agent:managing-editor`);
        }
        if (!isDateKey(managingEditorApproval.reviewedAt)) {
          errors.push(`${rel}: cross-volume approval reviewedAt must be YYYY-MM-DD`);
        } else {
          if (isDateKey(review.reviewedAt) && managingEditorApproval.reviewedAt < review.reviewedAt) {
            errors.push(`${rel}: managing editor cross-volume approval cannot predate copy review`);
          }
          if (isDateKey(editorial.publicationDate) &&
              managingEditorApproval.reviewedAt > editorial.publicationDate) {
            errors.push(`${rel}: managing editor cross-volume approval cannot be after publicationDate`);
          }
        }
        if (!hasText(managingEditorApproval.rationale, 20)) {
          errors.push(
            `${rel}: managing editor cross-volume approval must explain why the future article remains distinct`
          );
        }
      }
    }
  }

  return errors;
}
