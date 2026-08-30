#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = 'withbugs/kotatsu';
const allowedActions = new Map([
  ['issue', new Set(['list', 'view', 'edit', 'comment', 'create', 'close', 'reopen'])],
  ['pr', new Set(['list', 'view', 'checks', 'ready', 'edit', 'create', 'merge', 'close'])],
  ['run', new Set(['list', 'view'])],
]);

function validateRepository(args) {
  const selectors = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--repo') selectors.push(args[index + 1]);
    if (arg.startsWith('--repo=')) selectors.push(arg.slice('--repo='.length));
    if (arg === '-R' || arg.startsWith('-R=')) throw new Error('use the explicit --repo form');
  }
  if (selectors.length !== 1 || selectors[0] !== repository) {
    throw new Error(`scheduled GitHub commands must use --repo ${repository}`);
  }
  if (args.includes('--hostname') || args.some((arg) => arg.startsWith('--hostname='))) {
    throw new Error('custom GitHub hostnames are not allowed');
  }
}

function validateApi(args) {
  const listEndpoint = `repos/${repository}/milestones?state=open&per_page=100`;
  if (args.length === 1 && args[0] === listEndpoint) return;

  const [methodFlag, method, endpoint, fieldFlag, field] = args;
  const updatePattern = /^repos\/withbugs\/kotatsu\/milestones\/\d+$/;
  if (
    args.length === 5 && methodFlag === '--method' && method === 'PATCH'
    && updatePattern.test(endpoint) && fieldFlag === '-f' && field === 'state=closed'
  ) return;
  throw new Error('GitHub API operation is outside the scheduled milestone allowlist');
}

export function validateKotatsuGhArgs(args) {
  const [group, action] = args;
  if (group === 'api') {
    validateApi(args.slice(1));
    return args;
  }

  if (!allowedActions.get(group)?.has(action)) {
    throw new Error(`GitHub operation is outside the scheduled allowlist: ${group ?? ''} ${action ?? ''}`.trim());
  }
  validateRepository(args);
  return args;
}

export function runKotatsuGh(args, options = {}) {
  const validated = validateKotatsuGhArgs(args);
  const result = (options.spawn ?? spawnSync)('gh', validated, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = runKotatsuGh(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
