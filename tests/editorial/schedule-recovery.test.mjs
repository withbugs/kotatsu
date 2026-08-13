import assert from 'node:assert/strict';
import test from 'node:test';
import {
  containsLocalDateReference,
  earliestRecoveryDateKey,
  localDateReferenceVariants,
  validateRecoveryTarget
} from '../../scripts/editorial/schedule-recovery.mjs';

test('recovery date references include common Japanese and numeric formats', () => {
  const date = new Date('2026-08-11T00:00:00+09:00');
  const variants = localDateReferenceVariants(date);

  assert.ok(variants.includes('2026-08-11'));
  assert.ok(variants.includes('2026/8/11'));
  assert.ok(variants.includes('2026年8月11日'));
  assert.ok(variants.includes('2026年08月11日'));
});

test('localized recovery date references are detected without matching another day', () => {
  const date = new Date('2026-08-11T00:00:00+09:00');

  assert.equal(containsLocalDateReference('2026年8月11日の山の日', date), true);
  assert.equal(containsLocalDateReference({ note: '撮影想定 2026/08/11' }, date), true);
  assert.equal(containsLocalDateReference('2026年8月12日の予定', date), false);
});

test('a morning recovery may use the same JST publication day', () => {
  assert.equal(earliestRecoveryDateKey(new Date('2026-08-12T09:00:00+09:00')), '2026-08-12');
});

test('a recovery after the publisher run starts on the next JST day', () => {
  assert.equal(earliestRecoveryDateKey(new Date('2026-08-12T16:00:00+09:00')), '2026-08-13');
});

test('routine same-month recovery within seven days is accepted', () => {
  const result = validateRecoveryTarget({
    originalPublishAt: '2026-08-11T00:00:00+09:00',
    currentPublishAt: '2026-08-11T00:00:00+09:00',
    nextPublishAt: '2026-08-14T00:00:00+09:00',
    now: new Date('2026-08-12T16:00:00+09:00')
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.requiresEditorialRevalidation, false);
});

test('a stale date before the next publisher run is rejected', () => {
  const result = validateRecoveryTarget({
    originalPublishAt: '2026-08-11T00:00:00+09:00',
    currentPublishAt: '2026-08-11T00:00:00+09:00',
    nextPublishAt: '2026-08-12T00:00:00+09:00',
    now: new Date('2026-08-12T16:00:00+09:00')
  });
  assert.match(result.errors.join('\n'), /next publisher run/);
});

test('a delay over seven days requires editorial revalidation', () => {
  const blocked = validateRecoveryTarget({
    originalPublishAt: '2026-08-11T00:00:00+09:00',
    currentPublishAt: '2026-08-11T00:00:00+09:00',
    nextPublishAt: '2026-08-21T00:00:00+09:00',
    now: new Date('2026-08-12T09:00:00+09:00')
  });
  assert.match(blocked.errors.join('\n'), /editorial-revalidated-at/);

  const accepted = validateRecoveryTarget({
    originalPublishAt: '2026-08-11T00:00:00+09:00',
    currentPublishAt: '2026-08-11T00:00:00+09:00',
    nextPublishAt: '2026-08-21T00:00:00+09:00',
    now: new Date('2026-08-12T09:00:00+09:00'),
    editorialRevalidatedAt: '2026-08-12'
  });
  assert.deepEqual(accepted.errors, []);
  assert.equal(accepted.requiresEditorialRevalidation, true);
});
