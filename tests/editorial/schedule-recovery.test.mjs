import assert from 'node:assert/strict';
import test from 'node:test';
import { earliestRecoveryDateKey, validateRecoveryTarget } from '../../scripts/editorial/schedule-recovery.mjs';

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
