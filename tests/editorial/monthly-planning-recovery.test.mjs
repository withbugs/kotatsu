import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessMonthlyPlanning,
  expectedPlanningStage,
  planningBootstrapCommands,
} from '../../scripts/editorial/monthly-planning-recovery.mjs';

const currentMilestone = {
  number: 2,
  title: 'Vol. 002 2026年8月号',
  state: 'open',
};

test('planning stages follow the second, third, and fourth Mondays', () => {
  assert.equal(expectedPlanningStage('2026-08-09'), null);
  assert.equal(expectedPlanningStage('2026-08-10'), 'research');
  assert.equal(expectedPlanningStage('2026-08-17'), 'shortlist');
  assert.equal(expectedPlanningStage('2026-08-24'), 'finalize');
  assert.equal(expectedPlanningStage('2026-08-31'), 'finalize');
});

test('a missing next-month plan becomes a finalize recovery after the fourth Monday', () => {
  const result = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone],
  });
  assert.equal(result.status, 'recovery-required');
  assert.equal(result.targetMonth, '2026-09');
  assert.equal(result.expectedStage, 'finalize');
  assert.equal(result.actualStage, 'missing');
  assert.equal(result.volume, '003');
});

test('an existing research Issue resumes rather than being duplicated', () => {
  const result = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone, {
      number: 3, title: 'Vol. 003 2026年9月号', state: 'open',
    }],
    issues: [{
      number: 91,
      title: '[Vol. 003][PLAN] 2026年9月号テーマ検討',
      state: 'OPEN',
      labels: [{ name: 'type:volume-plan' }, { name: 'planning:research' }],
      url: 'https://github.com/withbugs/kotatsu/issues/91',
    }],
  });
  assert.equal(result.recoveryRequired, true);
  assert.equal(result.issueNumber, 91);
  assert.equal(result.actualStage, 'research');
  assert.equal(result.expectedStage, 'finalize');
});

test('a completed target plan does not reopen', () => {
  const result = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone, {
      number: 3, title: 'Vol. 003 2026年9月号', state: 'open',
    }],
    issues: [{
      number: 91,
      title: '[Vol. 003][PLAN] 2026年9月号テーマ検討',
      state: 'CLOSED',
      labels: [{ name: 'type:volume-plan' }, { name: 'kotatsu:done' }],
    }],
  });
  assert.equal(result.status, 'complete');
  assert.equal(result.recoveryRequired, false);
});

test('a missing current-month plan remains recoverable after a month boundary', () => {
  const result = assessMonthlyPlanning({
    today: '2026-09-01',
    milestones: [currentMilestone],
  });
  assert.equal(result.reason, 'current-month-volume-missing');
  assert.equal(result.targetMonth, '2026-09');
  assert.equal(result.expectedStage, 'finalize');
  assert.equal(result.recoveryRequired, true);
});

test('planning is not due before the second Monday when the current volume exists', () => {
  const result = assessMonthlyPlanning({
    today: '2026-08-08',
    milestones: [currentMilestone],
  });
  assert.equal(result.status, 'not-due');
  assert.equal(result.recoveryRequired, false);
});

test('a different open future plan blocks duplicate bootstrap', () => {
  const result = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone],
    issues: [{
      number: 91,
      title: '[Vol. 004][PLAN] 2026年10月号テーマ検討',
      state: 'OPEN',
      labels: [{ name: 'type:volume-plan' }, { name: 'planning:research' }],
    }],
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.recoveryRequired, false);
  assert.equal(result.conflictingIssueNumber, 91);
});

test('an open current-month plan does not block next-month planning', () => {
  const result = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone],
    issues: [{
      number: 38,
      title: '[Vol. 002][PLAN] 2026年8月号テーマ検討',
      state: 'OPEN',
      labels: [{ name: 'type:volume-plan' }, { name: 'planning:finalize' }],
    }],
  });
  assert.equal(result.status, 'recovery-required');
  assert.equal(result.targetMonth, '2026-09');
  assert.equal(result.conflictingIssueNumber, null);
});

test('a completed plan with a missing milestone repairs its queue record', () => {
  const result = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone],
    issues: [{
      number: 91,
      title: '[Vol. 003][PLAN] 2026年9月号テーマ検討',
      state: 'CLOSED',
      labels: [{ name: 'type:volume-plan' }, { name: 'kotatsu:done' }],
    }],
  });
  assert.equal(result.status, 'recovery-required');
  assert.equal(result.recoveryRequired, true);
  assert.equal(result.actualStage, 'complete');
  assert.equal(result.milestoneNumber, null);
});

test('bootstrap creates one repository-locked milestone and research Issue', () => {
  const status = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone],
  });
  const commands = planningBootstrapCommands(status);
  assert.equal(commands.length, 2);
  assert.deepEqual(commands[0].slice(0, 4), [
    'api', '--method', 'POST', 'repos/withbugs/kotatsu/milestones',
  ]);
  assert.ok(commands[1].includes('[Vol. 003][PLAN] 2026年9月号テーマ検討'));
  assert.ok(commands[1].includes('planning:research'));
  assert.ok(commands[1].includes('Vol. 003 2026年9月号'));
});

test('bootstrap wakes a planned Issue without resetting active work', () => {
  const status = assessMonthlyPlanning({
    today: '2026-08-27',
    milestones: [currentMilestone, {
      number: 3, title: 'Vol. 003 2026年9月号', state: 'open',
    }],
    issues: [{
      number: 91,
      title: '[Vol. 003][PLAN] 2026年9月号テーマ検討',
      state: 'OPEN',
      labels: [{ name: 'type:volume-plan' }, { name: 'planning:research' }],
    }],
  });
  const planned = {
    number: 91,
    state: 'OPEN',
    milestone: { title: status.milestoneTitle },
    labels: [
      { name: 'type:volume-plan' },
      { name: 'planning:research' },
      { name: 'agent:editor-in-chief' },
      { name: 'kotatsu:planned' },
    ],
  };
  const [plannedEdit] = planningBootstrapCommands(status, planned);
  assert.ok(plannedEdit.includes('--remove-label'));
  assert.ok(plannedEdit.includes('kotatsu:planned'));
  assert.ok(plannedEdit.includes('kotatsu:ready'));

  const running = {
    ...planned,
    labels: planned.labels
      .filter((label) => label.name !== 'kotatsu:planned')
      .concat({ name: 'kotatsu:running' }),
  };
  assert.deepEqual(planningBootstrapCommands(status, running), []);
});
