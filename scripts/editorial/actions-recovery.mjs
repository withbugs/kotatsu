#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runKotatsuGhResult } from './kotatsu-github.mjs';

export const ACTIONS_REPOSITORY = 'withbugs/kotatsu';
export const REQUIRED_WORKFLOWS = ['CI', 'Visual Check'];
export const DEFAULT_QUEUED_STALE_MINUTES = 30;
export const DEFAULT_RUNNING_STALE_MINUTES = 60;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_WAIT_SECONDS = 15 * 60;
export const DEFAULT_POLL_SECONDS = 15;

const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'pending', 'requested', 'waiting']);

function parseArgs(argv) {
  return Object.fromEntries(argv.map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=') || true];
  }));
}

function runTimestamp(run) {
  const value = run.updatedAt || run.createdAt;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function ageMinutes(run, now) {
  const timestamp = runTimestamp(run);
  return timestamp === null ? Number.POSITIVE_INFINITY : Math.max(0, (now.getTime() - timestamp) / 60000);
}

function normalizeRun(run) {
  return {
    ...run,
    databaseId: Number(run.databaseId),
    attempt: Number(run.attempt || 1),
    conclusion: run.conclusion || '',
  };
}

export function evaluateRequiredActionRuns(runs, options = {}) {
  const now = options.now ?? new Date();
  const expectedHeadSha = String(options.expectedHeadSha || '');
  const queuedStaleMinutes = options.queuedStaleMinutes ?? DEFAULT_QUEUED_STALE_MINUTES;
  const runningStaleMinutes = options.runningStaleMinutes ?? DEFAULT_RUNNING_STALE_MINUTES;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const normalized = runs.map(normalizeRun);
  const errors = [];

  for (const workflowName of REQUIRED_WORKFLOWS) {
    const matches = normalized.filter((run) => run.workflowName === workflowName);
    if (matches.length !== 1) errors.push(`expected exactly one ${workflowName} run; found ${matches.length}`);
  }

  if (new Set(normalized.map((run) => run.databaseId)).size !== normalized.length) {
    errors.push('required workflow run ids must be distinct');
  }
  for (const run of normalized) {
    if (!Number.isInteger(run.databaseId) || run.databaseId < 1) errors.push(`invalid run id for ${run.workflowName}`);
    if (!Number.isInteger(run.attempt) || run.attempt < 1) errors.push(`invalid attempt for ${run.workflowName}`);
    if (runTimestamp(run) === null) errors.push(`invalid timestamp for ${run.workflowName}`);
  }

  if (expectedHeadSha) {
    for (const run of normalized) {
      if (run.headSha !== expectedHeadSha) {
        errors.push(`${run.workflowName || run.databaseId} head SHA ${run.headSha} does not match ${expectedHeadSha}`);
      }
    }
  }

  if (errors.length > 0) return { action: 'blocked', reason: 'invalid-run-set', errors, runs: normalized };

  const waiting = [];
  const restart = [];
  const blocked = [];

  for (const run of normalized) {
    if (run.status === 'completed' && run.conclusion === 'success') continue;

    if (run.status === 'completed') {
      if (run.attempt >= maxAttempts) blocked.push({ ...run, reason: 'attempt-limit' });
      else restart.push({ ...run, cancelFirst: false, reason: `completed-${run.conclusion || 'without-conclusion'}` });
      continue;
    }

    if (ACTIVE_STATUSES.has(run.status)) {
      const age = ageMinutes(run, now);
      const staleAfter = run.status === 'queued' ? queuedStaleMinutes : runningStaleMinutes;
      if (age < staleAfter) waiting.push({ ...run, ageMinutes: age, staleAfterMinutes: staleAfter });
      else if (run.attempt >= maxAttempts) blocked.push({ ...run, ageMinutes: age, reason: 'attempt-limit' });
      else restart.push({ ...run, ageMinutes: age, cancelFirst: true, reason: `stale-${run.status}` });
      continue;
    }

    blocked.push({ ...run, reason: `unsupported-status-${run.status || 'empty'}` });
  }

  if (blocked.length > 0) return { action: 'blocked', reason: 'automatic-retry-exhausted', blocked, runs: normalized };
  if (restart.length > 0) return { action: 'restart', restart, waiting, runs: normalized };
  if (waiting.length > 0) return { action: 'wait', waiting, runs: normalized };

  return {
    action: 'ready',
    visualRunId: normalized.find((run) => run.workflowName === 'Visual Check').databaseId,
    runs: normalized,
  };
}

function broker(args) {
  const result = runKotatsuGhResult(args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`GitHub broker failed (${args.slice(0, 3).join(' ')}): ${detail || `exit ${result.status}`}`);
  }
  return String(result.stdout || '').trim();
}

function loadRun(runId) {
  const output = broker([
    'run', 'view', String(runId), '--repo', ACTIONS_REPOSITORY,
    '--json', 'databaseId,workflowName,status,conclusion,headSha,createdAt,updatedAt,attempt,url',
  ]);
  return JSON.parse(output);
}

function loadRuns(runIds) {
  return runIds.map(loadRun);
}

export function buildRunMutationArgs(action, runId) {
  if (!['cancel', 'rerun'].includes(action)) throw new Error(`unsupported Actions mutation: ${action}`);
  if (!/^\d+$/.test(String(runId))) throw new Error('Actions run id must be numeric');
  return ['run', action, String(runId), '--repo', ACTIONS_REPOSITORY];
}

function mutateRun(action, runId) {
  const args = buildRunMutationArgs(action, runId);
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`Actions recovery failed (${args.slice(0, 3).join(' ')}): ${detail || `exit ${result.status}`}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTerminal(runId, deadline, pollMs) {
  let run = loadRun(runId);
  while (run.status !== 'completed' && Date.now() < deadline) {
    await sleep(pollMs);
    run = loadRun(runId);
  }
  return run;
}

async function restartRuns(decision, deadline, pollMs) {
  for (const run of decision.restart) {
    let current = loadRun(run.databaseId);
    if (current.status === 'completed' && current.conclusion === 'success') continue;

    if (run.cancelFirst && current.status !== 'completed') {
      console.log(`Cancelling stale ${run.workflowName} run ${run.databaseId} (attempt ${run.attempt}).`);
      try {
        mutateRun('cancel', run.databaseId);
      } catch (error) {
        current = loadRun(run.databaseId);
        if (current.status !== 'completed') throw error;
      }
      current = await waitForTerminal(run.databaseId, deadline, pollMs);
      if (current.status !== 'completed') {
        throw new Error(`${run.workflowName} run ${run.databaseId} did not finish cancellation before the recovery deadline`);
      }
    }

    if (current.status === 'completed' && current.conclusion === 'success') continue;
    console.log(`Re-running ${run.workflowName} run ${run.databaseId}.`);
    mutateRun('rerun', run.databaseId);
  }
}

export async function recoverRequiredActionRuns({
  runIds,
  expectedHeadSha,
  now = new Date(),
  apply = false,
  queuedStaleMinutes = DEFAULT_QUEUED_STALE_MINUTES,
  runningStaleMinutes = DEFAULT_RUNNING_STALE_MINUTES,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  waitSeconds = DEFAULT_WAIT_SECONDS,
  pollSeconds = DEFAULT_POLL_SECONDS,
}) {
  let runs = loadRuns(runIds);
  let decision = evaluateRequiredActionRuns(runs, {
    now, expectedHeadSha, queuedStaleMinutes, runningStaleMinutes, maxAttempts,
  });
  if (!apply || decision.action === 'ready' || decision.action === 'blocked') return decision;

  const deadline = Date.now() + waitSeconds * 1000;
  const pollMs = pollSeconds * 1000;
  let lastSummary = '';

  while (Date.now() < deadline) {
    if (decision.action === 'restart') await restartRuns(decision, deadline, pollMs);
    if (Date.now() >= deadline) break;

    await sleep(pollMs);
    runs = loadRuns(runIds);
    decision = evaluateRequiredActionRuns(runs, {
      now: new Date(), expectedHeadSha, queuedStaleMinutes, runningStaleMinutes, maxAttempts,
    });

    const summary = runs.map((run) => `${run.workflowName}:${run.status}:${run.conclusion || '-'}:attempt-${run.attempt}`).join(', ');
    if (summary !== lastSummary) {
      console.log(`Actions recovery status: ${summary}`);
      lastSummary = summary;
    }

    if (decision.action === 'ready' || decision.action === 'blocked') return decision;
  }

  return {
    ...decision,
    action: 'checkpoint',
    reason: 'bounded-wait-expired',
    nextAction: 'rerun the same recovery command from the next daytime recovery coordinator',
  };
}

async function main(argv) {
  const args = parseArgs(argv);
  const unknown = Object.keys(args).filter((key) => !['ci-run', 'visual-run', 'head-sha', 'apply'].includes(key));
  if (unknown.length > 0) throw new Error(`Unsupported option(s): ${unknown.join(', ')}`);
  const ciRun = String(args['ci-run'] || '');
  const visualRun = String(args['visual-run'] || '');
  const headSha = String(args['head-sha'] || '');
  if (!/^\d+$/.test(ciRun) || !/^\d+$/.test(visualRun) || !/^[0-9a-f]{40}$/i.test(headSha)) {
    throw new Error('Usage: pnpm recovery:actions -- --ci-run=<id> --visual-run=<id> --head-sha=<40-char SHA> [--apply]');
  }

  const result = await recoverRequiredActionRuns({
    runIds: [ciRun, visualRun],
    expectedHeadSha: headSha,
    now: new Date(),
    apply: args.apply === true || args.apply === 'true',
    queuedStaleMinutes: DEFAULT_QUEUED_STALE_MINUTES,
    runningStaleMinutes: DEFAULT_RUNNING_STALE_MINUTES,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    waitSeconds: DEFAULT_WAIT_SECONDS,
    pollSeconds: DEFAULT_POLL_SECONDS,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.action === 'blocked') process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
