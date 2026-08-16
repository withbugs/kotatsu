import { jstDateKey } from './schedule-recovery.mjs';

export const PUBLICATION_HANDOFFS = {
  wait: {
    action: 'wait',
    stateLabel: 'kotatsu:planned',
    agentLabel: 'agent:publisher'
  },
  publish: {
    action: 'publish',
    stateLabel: 'kotatsu:publish',
    agentLabel: 'agent:publisher'
  },
  rebook: {
    action: 'rebook',
    stateLabel: 'kotatsu:review',
    agentLabel: 'agent:managing-editor'
  }
};

export function determinePublicationHandoff({ status, publishAt, now = new Date() }) {
  const publishDate = new Date(String(publishAt || ''));
  const currentDate = now instanceof Date ? now : new Date(now);
  const errors = [];

  if (status !== 'scheduled') {
    errors.push(`article must be scheduled before publication handoff; current status is ${status || 'missing'}`);
  }
  if (Number.isNaN(publishDate.getTime())) errors.push('publishAt must be a valid date');
  if (Number.isNaN(currentDate.getTime())) errors.push('now must be a valid date');
  if (errors.length) return { errors };

  const publishDateKey = jstDateKey(publishDate);
  const currentDateKey = jstDateKey(currentDate);
  let handoff;

  if (publishDateKey < currentDateKey) {
    handoff = PUBLICATION_HANDOFFS.rebook;
  } else if (publishDate <= currentDate) {
    handoff = PUBLICATION_HANDOFFS.publish;
  } else {
    handoff = PUBLICATION_HANDOFFS.wait;
  }

  return {
    errors,
    ...handoff,
    publishAt: publishDate.toISOString(),
    publishDateKey,
    currentDateKey
  };
}
