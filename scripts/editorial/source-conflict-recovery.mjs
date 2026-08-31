import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const sourceConflictMarker = '<!-- kotatsu:source-conflict-recovery -->';

const activeStates = new Set(['repair-required', 'repair-in-progress', 'repair-review']);
const validStates = new Set([...activeStates, 'resolved', 'blocked']);

const roleOwners = new Map([
  ['editor-in-chief', 'agent:editor-in-chief'],
  ['managing-editor', 'agent:managing-editor'],
  ['visual-editor', 'agent:visual-editor'],
  ['copy-editor', 'agent:copy-editor'],
  ['publisher', 'agent:publisher'],
  ['writer', 'agent:writer-desk'],
  ['writer-desk', 'agent:writer-desk'],
  ['style-writer', 'agent:writer-desk'],
  ['life-writer', 'agent:writer-desk'],
  ['weekend-writer', 'agent:writer-desk'],
  ['culture-writer', 'agent:writer-desk'],
  ['people-writer', 'agent:writer-desk'],
  ['shopping-writer', 'agent:writer-desk']
]);

function normalizePath(value) {
  return String(value || '').trim().replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalizePath).filter(Boolean))].sort();
}

function optionalPositiveInteger(value, label) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer`);
  return number;
}

export function sourceOwnerFor(sourcePath) {
  const source = normalizePath(sourcePath);

  const roleMatch = source.match(/^\.agents\/kotatsu\/([a-z-]+)\.md$/);
  if (roleMatch && roleOwners.has(roleMatch[1])) return roleOwners.get(roleMatch[1]);

  if (/^docs\/editorial\/(?:plans|candidates)\/vol-\d{3}\.md$/.test(source)) {
    return 'agent:editor-in-chief';
  }
  if (
    source === 'docs/editorial/ai-visual-policy.md' ||
    source.startsWith('docs/editorial/models/')
  ) {
    return 'agent:visual-editor';
  }
  if (
    source === 'docs/editorial/reader-trust-policy.md'
  ) {
    return 'agent:copy-editor';
  }
  if (
    source.startsWith('docs/editorial/') ||
    source.startsWith('scripts/editorial/') ||
    source.startsWith('tests/editorial/') ||
    source.startsWith('.github/') ||
    source.startsWith('.codex/') ||
    source.startsWith('.agents/kotatsu/') ||
    source === 'src/content/config.ts' ||
    source === 'package.json'
  ) {
    return 'agent:managing-editor';
  }

  return null;
}

export function fingerprintSourceConflict({ repairSource, conflictingSources = [], reasonCode }) {
  const canonical = JSON.stringify({
    repairSource: normalizePath(repairSource),
    conflictingSources: uniqueSorted(conflictingSources),
    reasonCode: String(reasonCode || '').trim().toLowerCase()
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function createSourceConflictRecord(input) {
  const repairSource = normalizePath(input.repairSource);
  const conflictingSources = uniqueSorted(input.conflictingSources || []);
  const ownerAgent = sourceOwnerFor(repairSource);

  if (!repairSource) throw new Error('repairSource is required');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(input.reasonCode?.trim() || '')) {
    throw new Error('reasonCode must be a stable lowercase slug');
  }
  if (conflictingSources.length === 0) throw new Error('at least one conflictingSource is required');
  if (!ownerAgent) throw new Error(`no source owner is registered for ${repairSource}`);
  if (!/^agent:[a-z0-9-]+$/.test(input.resumeAgent?.trim() || '')) {
    throw new Error('resumeAgent must be an agent label');
  }
  if (input.resumeState && input.resumeState !== 'kotatsu:ready') {
    throw new Error('resumeState must be kotatsu:ready');
  }

  const issueNumber = optionalPositiveInteger(input.issueNumber, 'issueNumber');
  if (!issueNumber) throw new Error('issueNumber is required');

  return {
    version: 1,
    class: 'Governance',
    fingerprint: fingerprintSourceConflict({ repairSource, conflictingSources, reasonCode: input.reasonCode }),
    state: 'repair-required',
    repairSource,
    conflictingSources,
    reasonCode: input.reasonCode.trim(),
    issueNumber,
    articlePr: optionalPositiveInteger(input.articlePr, 'articlePr'),
    articleHeadSha: input.articleHeadSha || null,
    ownerAgent,
    gateAgent: 'agent:managing-editor',
    resumeAgent: input.resumeAgent.trim(),
    resumeState: input.resumeState || 'kotatsu:ready',
    repairPr: null,
    verificationCommand: null,
    verifiedMainSha: null,
    verifiedAt: null
  };
}

export function validateSourceConflictRecord(record) {
  const errors = [];
  const expectedOwner = sourceOwnerFor(record?.repairSource);
  const expectedFingerprint = fingerprintSourceConflict({
    repairSource: record?.repairSource,
    conflictingSources: record?.conflictingSources,
    reasonCode: record?.reasonCode
  });

  if (record?.version !== 1) errors.push('version must be 1');
  if (record?.class !== 'Governance') errors.push('class must be Governance');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(record?.reasonCode || '')) errors.push('reasonCode must be a stable lowercase slug');
  if (!validStates.has(record?.state)) errors.push(`invalid state: ${record?.state}`);
  if (!expectedOwner || record?.ownerAgent !== expectedOwner) errors.push('ownerAgent does not match repairSource');
  if (record?.gateAgent !== 'agent:managing-editor') errors.push('gateAgent must be agent:managing-editor');
  if (record?.fingerprint !== expectedFingerprint) errors.push('fingerprint does not match the canonical conflict');
  if (!Number.isInteger(record?.issueNumber) || record.issueNumber <= 0) errors.push('issueNumber is required');
  if (!/^agent:[a-z0-9-]+$/.test(record?.resumeAgent || '')) errors.push('resumeAgent must be an agent label');
  if (record?.resumeState !== 'kotatsu:ready') errors.push('resumeState must be kotatsu:ready');
  if (!Array.isArray(record?.conflictingSources) || record.conflictingSources.length === 0) {
    errors.push('at least one conflictingSource is required');
  }
  if (['repair-review', 'resolved'].includes(record?.state) && !record?.repairPr) {
    errors.push(`${record.state} requires repairPr`);
  }
  if (
    record?.state === 'resolved' &&
    (!record.verificationCommand || !record.verifiedMainSha || !/^\d{4}-\d{2}-\d{2}T/.test(record.verifiedAt || ''))
  ) {
    errors.push('resolved requires verificationCommand, verifiedMainSha, and verifiedAt');
  }
  if (record?.state === 'blocked' && !record?.blocker) errors.push('blocked requires blocker');

  return errors;
}

export function transitionSourceConflict(record, state, additions = {}) {
  if (!validStates.has(state)) throw new Error(`invalid source-conflict state: ${state}`);
  const mutableFields = new Set([
    'repairPr',
    'verificationCommand',
    'verifiedMainSha',
    'verifiedAt',
    'blocker'
  ]);
  for (const key of Object.keys(additions)) {
    if (!mutableFields.has(key)) throw new Error(`source-conflict field is immutable: ${key}`);
  }
  const next = { ...record, ...additions, state };

  if (['repair-review', 'resolved'].includes(state) && !next.repairPr) {
    throw new Error(`${state} requires repairPr`);
  }
  if (
    state === 'resolved' &&
    (!next.verificationCommand || !next.verifiedMainSha || !/^\d{4}-\d{2}-\d{2}T/.test(next.verifiedAt || ''))
  ) {
    throw new Error('resolved requires verificationCommand, verifiedMainSha, and verifiedAt');
  }
  if (state === 'blocked' && !next.blocker) throw new Error('blocked requires blocker');

  const errors = validateSourceConflictRecord(next);
  if (errors.length) throw new Error(errors.join('; '));
  return next;
}

export function nextSourceConflictAction(record) {
  const errors = validateSourceConflictRecord(record);
  if (errors.length) throw new Error(errors.join('; '));

  if (record.state === 'repair-required') {
    return { action: 'dispatch-source-owner', agent: record.ownerAgent, stateLabel: 'kotatsu:revise' };
  }
  if (record.state === 'repair-in-progress') {
    return { action: 'continue-source-repair', agent: record.ownerAgent, stateLabel: 'kotatsu:running' };
  }
  if (record.state === 'repair-review') {
    return { action: 'review-source-repair', agent: record.gateAgent, stateLabel: 'kotatsu:review' };
  }
  if (record.state === 'resolved') {
    return { action: 'resume-original-stage', agent: record.resumeAgent, stateLabel: record.resumeState };
  }
  return { action: 'checkpoint', agent: record.gateAgent, stateLabel: 'kotatsu:revise' };
}

export function selectSourceConflictRecord(records, candidate) {
  const same = [...records].reverse().find((record) => record.fingerprint === candidate.fingerprint);
  if (same && activeStates.has(same.state)) {
    return { record: same, created: false, action: nextSourceConflictAction(same) };
  }
  return { record: candidate, created: true, action: nextSourceConflictAction(candidate) };
}

export function formatSourceConflictRecord(record) {
  return `${sourceConflictMarker}\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\``;
}

export function extractSourceConflictRecords(raw) {
  const pattern = /<!-- kotatsu:source-conflict-recovery -->\s*```json\s*([\s\S]*?)```/g;
  const records = [];
  for (const match of String(raw || '').matchAll(pattern)) {
    try {
      records.push(JSON.parse(match[1]));
    } catch {
      // A malformed marker is ignored so the caller can report and replace it explicitly.
    }
  }
  return records;
}

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, ...parts] = item.slice(2).split('=');
    const value = parts.join('=');
    if (key === 'conflict-source') {
      args.conflictingSources ||= [];
      args.conflictingSources.push(value);
    } else {
      args[key] = value;
    }
  }
  return args;
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  let record = createSourceConflictRecord({
    repairSource: args['repair-source'],
    conflictingSources: args.conflictingSources,
    reasonCode: args.reason,
    issueNumber: args.issue,
    articlePr: args['article-pr'],
    articleHeadSha: args['head-sha'],
    resumeAgent: args['resume-agent'],
    resumeState: args['resume-state']
  });
  const requestedState = args.state || 'repair-required';
  if (requestedState !== 'repair-required') {
    record = transitionSourceConflict(record, requestedState, {
      repairPr: args['repair-pr'] || null,
      verificationCommand: args['verification-command'] || null,
      verifiedMainSha: args['verified-main-sha'] || null,
      verifiedAt: args['verified-at'] || null,
      blocker: args.blocker || null
    });
  }
  console.log(formatSourceConflictRecord(record));
  console.log(JSON.stringify(nextSourceConflictAction(record)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
