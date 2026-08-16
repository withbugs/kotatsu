import assert from 'node:assert/strict';
import test from 'node:test';
import { determinePublicationHandoff } from '../../scripts/editorial/publication-handoff.mjs';

test('a future scheduled article remains planned for the publisher', () => {
  const result = determinePublicationHandoff({
    status: 'scheduled',
    publishAt: '2026-08-16T00:00:00+09:00',
    now: new Date('2026-08-15T12:00:00+09:00')
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.action, 'wait');
  assert.equal(result.stateLabel, 'kotatsu:planned');
  assert.equal(result.agentLabel, 'agent:publisher');
});

test('a due scheduled article is routed to the publisher', () => {
  const result = determinePublicationHandoff({
    status: 'scheduled',
    publishAt: '2026-08-16T00:00:00+09:00',
    now: new Date('2026-08-16T09:00:00+09:00')
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.action, 'publish');
  assert.equal(result.stateLabel, 'kotatsu:publish');
  assert.equal(result.agentLabel, 'agent:publisher');
});

test('a scheduled article from a prior JST day returns to rebooking', () => {
  const result = determinePublicationHandoff({
    status: 'scheduled',
    publishAt: '2026-08-16T00:00:00+09:00',
    now: new Date('2026-08-17T09:00:00+09:00')
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.action, 'rebook');
  assert.equal(result.stateLabel, 'kotatsu:review');
  assert.equal(result.agentLabel, 'agent:managing-editor');
});

test('handoff rejects an article that has not been scheduled', () => {
  const result = determinePublicationHandoff({
    status: 'draft',
    publishAt: '2026-08-16T00:00:00+09:00',
    now: new Date('2026-08-16T09:00:00+09:00')
  });

  assert.match(result.errors.join('\n'), /must be scheduled/);
});
