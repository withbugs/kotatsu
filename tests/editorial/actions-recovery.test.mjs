import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRunMutationArgs, evaluateRequiredActionRuns, parseArgs } from '../../scripts/editorial/actions-recovery.mjs';

const now = new Date('2026-09-13T06:00:00Z');
const headSha = 'c9f9938859251ef4445e6d57abbbebf2374d12b7';

function run(workflowName, overrides = {}) {
  return {
    databaseId: workflowName === 'CI' ? 101 : 102,
    workflowName,
    status: 'completed',
    conclusion: 'success',
    headSha,
    createdAt: '2026-09-13T05:00:00Z',
    updatedAt: '2026-09-13T05:01:00Z',
    attempt: 1,
    ...overrides,
  };
}

test('CLI parsing accepts the pnpm argument separator', () => {
  assert.deepEqual(
    parseArgs(['--', '--ci-run=101', '--visual-run=102', `--head-sha=${headSha}`, '--apply']),
    { 'ci-run': '101', 'visual-run': '102', 'head-sha': headSha, apply: true },
  );
});

test('required successful runs are ready for artifact inspection and merge', () => {
  const result = evaluateRequiredActionRuns([run('CI'), run('Visual Check')], { now, expectedHeadSha: headSha });
  assert.equal(result.action, 'ready');
  assert.equal(result.visualRunId, 102);
});

test('a fresh queued run remains a bounded wait', () => {
  const result = evaluateRequiredActionRuns([
    run('CI'),
    run('Visual Check', { status: 'queued', conclusion: '', updatedAt: '2026-09-13T05:45:00Z' }),
  ], { now, expectedHeadSha: headSha });
  assert.equal(result.action, 'wait');
  assert.equal(result.waiting[0].staleAfterMinutes, 30);
});

test('a queued run older than 30 minutes is restarted without invalidating successful checks', () => {
  const result = evaluateRequiredActionRuns([
    run('CI'),
    run('Visual Check', { status: 'queued', conclusion: '', updatedAt: '2026-09-13T05:20:00Z' }),
  ], { now, expectedHeadSha: headSha });
  assert.equal(result.action, 'restart');
  assert.deepEqual(result.restart.map((entry) => entry.databaseId), [102]);
  assert.equal(result.restart[0].cancelFirst, true);
});

test('a failed completed run is rerun immediately', () => {
  const result = evaluateRequiredActionRuns([
    run('CI', { conclusion: 'failure' }),
    run('Visual Check'),
  ], { now, expectedHeadSha: headSha });
  assert.equal(result.action, 'restart');
  assert.equal(result.restart[0].cancelFirst, false);
});

test('an in-progress run receives a longer stale threshold', () => {
  const waiting = evaluateRequiredActionRuns([
    run('CI'),
    run('Visual Check', { status: 'in_progress', conclusion: '', updatedAt: '2026-09-13T05:15:00Z' }),
  ], { now, expectedHeadSha: headSha });
  assert.equal(waiting.action, 'wait');

  const restart = evaluateRequiredActionRuns([
    run('CI'),
    run('Visual Check', { status: 'in_progress', conclusion: '', updatedAt: '2026-09-13T04:59:00Z' }),
  ], { now, expectedHeadSha: headSha });
  assert.equal(restart.action, 'restart');
});

test('automatic retries stop after the third attempt', () => {
  const result = evaluateRequiredActionRuns([
    run('CI'),
    run('Visual Check', {
      status: 'queued', conclusion: '', updatedAt: '2026-09-13T05:00:00Z', attempt: 3,
    }),
  ], { now, expectedHeadSha: headSha });
  assert.equal(result.action, 'blocked');
  assert.equal(result.reason, 'automatic-retry-exhausted');
});

test('head SHA mismatches block all mutations', () => {
  const result = evaluateRequiredActionRuns([
    run('CI'),
    run('Visual Check', { headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
  ], { now, expectedHeadSha: headSha });
  assert.equal(result.action, 'blocked');
  assert.equal(result.reason, 'invalid-run-set');
});

test('malformed run timestamps block cancellation rather than appearing stale', () => {
  const result = evaluateRequiredActionRuns([
    run('CI'),
    run('Visual Check', { status: 'queued', conclusion: '', updatedAt: 'not-a-date' }),
  ], { now, expectedHeadSha: headSha });
  assert.equal(result.action, 'blocked');
  assert.match(result.errors.join('\n'), /invalid timestamp/);
});

test('Actions mutations are repository locked and limited to cancel or rerun', () => {
  assert.deepEqual(
    buildRunMutationArgs('cancel', 123),
    ['run', 'cancel', '123', '--repo', 'withbugs/kotatsu'],
  );
  assert.deepEqual(
    buildRunMutationArgs('rerun', '456'),
    ['run', 'rerun', '456', '--repo', 'withbugs/kotatsu'],
  );
  assert.throws(() => buildRunMutationArgs('delete', 123));
  assert.throws(() => buildRunMutationArgs('cancel', 'not-a-run'));
});
