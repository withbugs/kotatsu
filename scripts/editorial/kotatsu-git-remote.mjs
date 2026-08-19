#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const branchPattern = /^(?:article|codex|kotatsu|planning)\/[A-Za-z0-9._\/-]+$/;

function isAllowedBranch(branch) {
  return branchPattern.test(branch)
    && !branch.includes('..')
    && !branch.includes('//')
    && !branch.endsWith('/')
    && !branch.endsWith('.')
    && !branch.endsWith('.lock');
}

export function validateKotatsuGitRemoteArgs(args) {
  const [operation, remote, ...rest] = args;
  if (remote !== 'origin') throw new Error('scheduled Git operations may use only origin');

  if (operation === 'fetch') {
    if (rest[0] !== 'main' || rest.length > 2) {
      throw new Error('fetch must request origin main and at most one article or planning branch');
    }
    if (rest[1] && !isAllowedBranch(rest[1])) throw new Error(`branch is not allowed: ${rest[1]}`);
    return args;
  }

  if (operation === 'push') {
    if (rest.length !== 1 || !rest[0].startsWith('HEAD:')) {
      throw new Error('push must use exactly HEAD:<branch>');
    }
    const destination = rest[0].slice('HEAD:'.length);
    if (!isAllowedBranch(destination)) throw new Error(`push destination is not allowed: ${destination}`);
    return args;
  }

  throw new Error(`remote Git operation is outside the scheduled allowlist: ${operation ?? ''}`.trim());
}

export function runKotatsuGitRemote(args, options = {}) {
  const validated = validateKotatsuGitRemoteArgs(args);
  const [operation, remote, ...rest] = validated;
  const commandArgs = operation === 'fetch'
    ? [
        'fetch', remote,
        '+refs/heads/main:refs/remotes/origin/main',
        ...(rest[1] ? [`+refs/heads/${rest[1]}:refs/remotes/origin/${rest[1]}`] : []),
      ]
    : validated;
  const result = (options.spawn ?? spawnSync)('git', commandArgs, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = runKotatsuGitRemote(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
