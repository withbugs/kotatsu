import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMilestoneCompletion, parsePlanEntries } from '../../scripts/editorial/milestone-completion.mjs';

const planContent = `
| 公開順 | カテゴリ | 仮見出し | 狙い |
| --- | --- | --- | --- |
| 1 | STYLE | 一本目の記事 | 狙い |
| 2 | LIFE | 二本目の記事 | 狙い |
`;

function issue(title, labels, state = 'CLOSED') {
  return { title, state, labels: labels.map((name) => ({ name })) };
}

function completeIssues() {
  return [
    issue('[Vol. 003][PLAN] 計画', ['type:volume-plan', 'kotatsu:done']),
    issue('[Vol. 003][VISUAL] 正式カバー制作', ['type:volume-cover', 'kotatsu:done']),
    issue('[Vol. 003][STYLE] 一本目の記事', ['type:article', 'kotatsu:done']),
    issue('[Vol. 003][LIFE] 二本目の記事', ['type:article', 'kotatsu:done'])
  ];
}

test('plan entries are read from numbered article rows', () => {
  assert.deepEqual(parsePlanEntries(planContent), [
    { order: 1, category: 'STYLE', title: '一本目の記事' },
    { order: 2, category: 'LIFE', title: '二本目の記事' }
  ]);
});

test('a complete volume milestone is eligible to close', () => {
  const result = evaluateMilestoneCompletion({
    milestone: { title: 'Vol. 003 2026年9月号', state: 'open' },
    issues: completeIssues(),
    planContent
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

test('an open issue blocks milestone closure', () => {
  const issues = completeIssues();
  issues[2].state = 'OPEN';
  const result = evaluateMilestoneCompletion({
    milestone: { title: 'Vol. 003 2026年9月号', state: 'open' },
    issues,
    planContent
  });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join('\n'), /still open/);
});

test('missing planned article issues block milestone closure', () => {
  const result = evaluateMilestoneCompletion({
    milestone: { title: 'Vol. 003 2026年9月号', state: 'open' },
    issues: completeIssues().slice(0, -1),
    planContent
  });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join('\n'), /does not match approved plan count/);
  assert.match(result.reasons.join('\n'), /二本目の記事/);
});

test('missing done labels or formal artifacts block milestone closure', () => {
  const issues = completeIssues().filter((entry) => !entry.labels.some((label) => label.name === 'type:volume-cover'));
  issues[1].labels = issues[1].labels.filter((label) => label.name !== 'kotatsu:done');
  const result = evaluateMilestoneCompletion({
    milestone: { title: 'Vol. 003 2026年9月号', state: 'open' },
    issues,
    planContent
  });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join('\n'), /kotatsu:done/);
  assert.match(result.reasons.join('\n'), /formal cover/);
});
