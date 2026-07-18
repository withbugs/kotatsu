import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_PUBLISH_INTERVAL_HOURS,
  validatePublishedSchedule
} from '../../scripts/editorial/publishing-schedule.mjs';

function article(slug, status, publishAt) {
  const date = new Date(publishAt);
  return {
    relativePath: `src/content/articles/${slug}.mdx`,
    slug,
    data: { title: slug, status, publishAt },
    publishAt: date,
    publishAtIsValid: !Number.isNaN(date.getTime())
  };
}

const now = new Date('2026-08-31T00:00:00+09:00');

test(`scheduled and published articles require a ${MIN_PUBLISH_INTERVAL_HOURS}-hour interval`, () => {
  const result = validatePublishedSchedule(
    [
      article('first', 'published', '2026-07-22T00:00:00+09:00'),
      article('second', 'scheduled', '2026-07-23T23:00:00+09:00')
    ],
    { now }
  );

  assert.match(result.errors.join('\n'), /publishAt must be at least 48 hours/);
});

test('an interval of exactly 48 hours is accepted', () => {
  const result = validatePublishedSchedule(
    [
      article('first', 'published', '2026-07-22T00:00:00+09:00'),
      article('second', 'scheduled', '2026-07-24T00:00:00+09:00')
    ],
    { now }
  );

  assert.equal(result.errors.length, 0);
});

test('draft dates do not reserve a publication slot', () => {
  const result = validatePublishedSchedule(
    [
      article('first', 'draft', '2026-07-22T00:00:00+09:00'),
      article('second', 'scheduled', '2026-07-22T00:00:00+09:00')
    ],
    { now }
  );

  assert.equal(result.errors.length, 0);
});
