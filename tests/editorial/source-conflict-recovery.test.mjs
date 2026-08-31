import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSourceConflictRecord,
  extractSourceConflictRecords,
  fingerprintSourceConflict,
  formatSourceConflictRecord,
  nextSourceConflictAction,
  selectSourceConflictRecord,
  sourceOwnerFor,
  transitionSourceConflict,
  validateSourceConflictRecord
} from '../../scripts/editorial/source-conflict-recovery.mjs';

function record() {
  return createSourceConflictRecord({
    repairSource: 'docs/editorial/plans/vol-003.md',
    conflictingSources: ['docs/editorial/ai-visual-policy.md', '.agents/kotatsu/visual-editor.md'],
    reasonCode: 'category-fixed-art-direction',
    issueNumber: 97,
    articlePr: 104,
    articleHeadSha: 'abc123',
    resumeAgent: 'agent:visual-editor'
  });
}

test('maps canonical sources to explicit editorial owners', () => {
  assert.equal(sourceOwnerFor('docs/editorial/plans/vol-003.md'), 'agent:editor-in-chief');
  assert.equal(sourceOwnerFor('docs/editorial/ai-visual-policy.md'), 'agent:visual-editor');
  assert.equal(sourceOwnerFor('docs/editorial/reader-trust-policy.md'), 'agent:copy-editor');
  assert.equal(sourceOwnerFor('scripts/editorial/check-editorial-planning.mjs'), 'agent:managing-editor');
  assert.equal(sourceOwnerFor('.agents/kotatsu/editor-in-chief.md'), 'agent:editor-in-chief');
  assert.equal(sourceOwnerFor('.agents/kotatsu/publisher.md'), 'agent:publisher');
  assert.equal(sourceOwnerFor('.agents/kotatsu/style-writer.md'), 'agent:writer-desk');
  assert.equal(sourceOwnerFor('unknown/file.md'), null);
});

test('creates a stable fingerprint independent of path order and separators', () => {
  const first = fingerprintSourceConflict({
    repairSource: 'docs\\editorial\\plans\\vol-003.md',
    conflictingSources: ['b.md', 'a.md'],
    reasonCode: 'PLAN-CONFLICT'
  });
  const second = fingerprintSourceConflict({
    repairSource: 'docs/editorial/plans/vol-003.md',
    conflictingSources: ['a.md', 'b.md', 'a.md'],
    reasonCode: 'plan-conflict'
  });
  assert.equal(first, second);
});

test('routes repair, review, and resolution without returning to the failing gate', () => {
  const required = record();
  assert.deepEqual(nextSourceConflictAction(required), {
    action: 'dispatch-source-owner',
    agent: 'agent:editor-in-chief',
    stateLabel: 'kotatsu:revise'
  });

  const review = transitionSourceConflict(required, 'repair-review', { repairPr: 105 });
  assert.equal(nextSourceConflictAction(review).agent, 'agent:managing-editor');

  const resolved = transitionSourceConflict(review, 'resolved', {
    verificationCommand: 'pnpm content:check',
    verifiedMainSha: 'def456',
    verifiedAt: '2026-08-31T21:30:00+09:00'
  });
  assert.deepEqual(nextSourceConflictAction(resolved), {
    action: 'resume-original-stage',
    agent: 'agent:visual-editor',
    stateLabel: 'kotatsu:ready'
  });
});

test('does not allow a source conflict to resolve without merged-source verification', () => {
  const review = transitionSourceConflict(record(), 'repair-review', { repairPr: 105 });
  assert.throws(() => transitionSourceConflict(review, 'resolved'), /requires verificationCommand/);
});

test('rejects a tampered durable record before dispatch', () => {
  const tampered = { ...record(), ownerAgent: 'agent:visual-editor' };
  assert.match(validateSourceConflictRecord(tampered).join('\n'), /ownerAgent/);
  assert.throws(() => nextSourceConflictAction(tampered), /ownerAgent/);
});

test('reuses an active fingerprint instead of creating another recovery loop', () => {
  const existing = transitionSourceConflict(record(), 'repair-in-progress');
  const selected = selectSourceConflictRecord([existing], record());
  assert.equal(selected.created, false);
  assert.equal(selected.action.action, 'continue-source-repair');
  assert.notEqual(selected.action.action, 'resume-original-stage');
});

test('round-trips the durable GitHub marker', () => {
  const expected = record();
  assert.deepEqual(extractSourceConflictRecords(formatSourceConflictRecord(expected)), [expected]);
});
