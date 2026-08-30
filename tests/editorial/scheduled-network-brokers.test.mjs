import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKotatsuGhArgs } from '../../scripts/editorial/kotatsu-github.mjs';
import { validateKotatsuGitRemoteArgs } from '../../scripts/editorial/kotatsu-git-remote.mjs';

test('GitHub broker accepts the required repository-scoped operations', () => {
  assert.doesNotThrow(() => validateKotatsuGhArgs(['issue', 'list', '--repo', 'withbugs/kotatsu']));
  assert.doesNotThrow(() => validateKotatsuGhArgs([
    'pr', 'edit', '93', '--repo', 'withbugs/kotatsu', '--body', 'Finalized planning record',
  ]));
  assert.doesNotThrow(() => validateKotatsuGhArgs(['pr', 'merge', '65', '--repo', 'withbugs/kotatsu']));
  assert.doesNotThrow(() => validateKotatsuGhArgs(['run', 'view', '123', '--repo', 'withbugs/kotatsu']));
  assert.doesNotThrow(() => validateKotatsuGhArgs(['api', 'repos/withbugs/kotatsu/milestones?state=open&per_page=100']));
  assert.doesNotThrow(() => validateKotatsuGhArgs([
    'api', '--method', 'PATCH', 'repos/withbugs/kotatsu/milestones/2', '-f', 'state=closed',
  ]));
});

test('GitHub broker rejects other repositories, auth changes, and arbitrary API calls', () => {
  assert.throws(() => validateKotatsuGhArgs(['issue', 'list', '--repo', 'withbugs/other']));
  assert.throws(() => validateKotatsuGhArgs([
    'pr', 'edit', '93', '--repo', 'withbugs/other', '--body', 'Do not allow this',
  ]));
  assert.throws(() => validateKotatsuGhArgs([
    'issue', 'list', '--repo', 'withbugs/kotatsu', '--repo=withbugs/other',
  ]));
  assert.throws(() => validateKotatsuGhArgs(['issue', 'list', '-R', 'withbugs/kotatsu']));
  assert.throws(() => validateKotatsuGhArgs(['auth', 'logout']));
  assert.throws(() => validateKotatsuGhArgs(['api', 'repos/withbugs/kotatsu/git/refs/heads/main']));
  assert.throws(() => validateKotatsuGhArgs([
    'api', '--method', 'DELETE', 'repos/withbugs/kotatsu/milestones/2',
  ]));
});

test('Git remote broker accepts isolated fetch and HEAD push shapes', () => {
  assert.doesNotThrow(() => validateKotatsuGitRemoteArgs(['fetch', 'origin', 'main']));
  assert.doesNotThrow(() => validateKotatsuGitRemoteArgs([
    'fetch', 'origin', 'main', 'article/issue-52-weekend-small-summer-outing',
  ]));
  assert.doesNotThrow(() => validateKotatsuGitRemoteArgs([
    'push', 'origin', 'HEAD:article/issue-52-weekend-small-summer-outing',
  ]));
});

test('Git remote broker rejects main pushes, force forms, and other remotes', () => {
  assert.throws(() => validateKotatsuGitRemoteArgs(['push', 'origin', 'main']));
  assert.throws(() => validateKotatsuGitRemoteArgs(['push', 'origin', '--force', 'HEAD:article/example']));
  assert.throws(() => validateKotatsuGitRemoteArgs(['push', 'origin', 'HEAD:main']));
  assert.throws(() => validateKotatsuGitRemoteArgs(['push', 'origin', 'HEAD:article/../main']));
  assert.throws(() => validateKotatsuGitRemoteArgs(['fetch', 'upstream', 'main']));
});
