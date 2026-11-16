#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { downloadVisualArtifact } from './visual-artifact.mjs';

const repository = 'withbugs/kotatsu';
const allowedActions = new Map([
  ['issue', new Set(['list', 'view', 'edit', 'comment', 'create', 'close', 'reopen'])],
  ['pr', new Set(['list', 'view', 'checks', 'ready', 'edit', 'create', 'merge', 'close'])],
  ['run', new Set(['list', 'view'])],
]);

function validateVisualDownload(args) {
  const [, , runId, repoFlag, repo, headFlag, headSha] = args;
  if (
    args.length !== 7 || !/^[1-9]\d*$/.test(runId ?? '') || !Number.isSafeInteger(Number(runId))
    || repoFlag !== '--repo' || repo !== repository
    || headFlag !== '--head-sha' || !/^[0-9a-f]{40}$/.test(headSha ?? '')
  ) {
    throw new Error('use run download <run-id> --repo withbugs/kotatsu --head-sha <article-head-sha>');
  }
}

function runVisualDownload(args, options) {
  const runId = args[2];
  const headSha = args[6];
  const spawn = options.spawn ?? spawnSync;
  const lookup = spawn('gh', [
    'run', 'list', '--repo', repository, '--workflow', 'visual-check.yml', '--commit', headSha,
    '--limit', '100', '--json', 'databaseId,workflowName,status,conclusion,event,headSha,headBranch'
  ], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 60_000, windowsHide: true
  });
  if (lookup.error) throw lookup.error;
  if (lookup.status !== 0) throw new Error('could not verify the required Visual Check run');

  const runs = JSON.parse(lookup.stdout);
  const run = runs.find(({ databaseId }) => String(databaseId) === runId);
  if (
    !run || run.workflowName !== 'Visual Check' || run.headSha !== headSha
    || run.event !== 'pull_request' || !run.headBranch?.startsWith('article/')
    || run.status !== 'completed' || run.conclusion !== 'success'
  ) {
    throw new Error('run must be a successful Visual Check for the specified article PR head');
  }

  const result = downloadVisualArtifact({ runId, repository, run: spawn });
  console.log(`Visual artifact verified after attempt ${result.attempt}: ${result.directory}`);
  console.log(`Desktop screenshots: ${result.desktop.length}`);
  console.log(`Mobile screenshots: ${result.mobile.length}`);
  for (const screenshot of result.screenshots) console.log(`Screenshot: ${screenshot}`);
  return { status: 0 };
}

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
  if (group === 'run' && action === 'download') {
    validateVisualDownload(args);
    return args;
  }

  if (!allowedActions.get(group)?.has(action)) {
    throw new Error(`GitHub operation is outside the scheduled allowlist: ${group ?? ''} ${action ?? ''}`.trim());
  }
  validateRepository(args);
  return args;
}

export function runKotatsuGhResult(args, options = {}) {
  const validated = validateKotatsuGhArgs(args);
  if (validated[0] === 'run' && validated[1] === 'download') {
    return runVisualDownload(validated, options);
  }
  const result = (options.spawn ?? spawnSync)('gh', validated, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result;
}

export function runKotatsuGh(args, options = {}) {
  return runKotatsuGhResult(args, options).status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = runKotatsuGh(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
