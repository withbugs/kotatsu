import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertEditorialIdentity, EDITORIAL_NAME, EDITORIAL_EMAIL } from './kotatsu-identity.mjs';
import { NIGHT_SCHEDULE, nightClock } from './night-schedule.mjs';

export const CLOUD_LEASE_REPOSITORY_URL = 'https://github.com/withbugs/kotatsu.git';
export const CLOUD_LEASE_REF = 'refs/heads/kotatsu/cloud-editorial-lease';
export function gitLeaseCommand(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['pipe','pipe','pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject); child.on('close', status => resolve({ status, stdout, stderr }));
    child.stdin.end(input);
  });
}
async function checked(run, args, input) {
  const result = await run(args, input);
  if (result.status !== 0) throw new Error(`shared lease ${args[0]} failed; do not dispatch or bypass: ${result.stderr}`);
  return result.stdout.trim();
}
async function repository(run) {
  const canonical = new Set([CLOUD_LEASE_REPOSITORY_URL, 'https://github.com/withbugs/kotatsu']);
  // --all is essential: Git pushes to every configured pushurl, not the fetch URL.
  // get-url resolves insteadOf/pushInsteadOf, including effective environment config.
  for (const args of [['remote','get-url','--all','origin'], ['remote','get-url','--push','--all','origin']]) {
    const urls = (await checked(run, args)).split('\n');
    if (urls.length !== 1 || !canonical.has(urls[0])) throw new Error('shared lease requires one canonical fetch and push destination; stop before any lease write');
  }
  // A validated resolved URL could be rewritten again when passed literally. Reject
  // all effective URL rewrite rules (local/global/include/environment) and use one
  // fixed HTTPS target, so changing origin pushurl after validation cannot redirect it.
  const rewrites = await run(['config','--get-regexp','^url\\..*\\.(insteadof|pushinsteadof)$']);
  if (rewrites.status !== 1 || rewrites.stdout.trim()) throw new Error('shared lease URL rewriting is unsupported; stop before any lease write');
}
export async function claimCloudLease({ role, head, now = new Date() }, run = gitLeaseCommand) {
  if (!Object.hasOwn(NIGHT_SCHEDULE, role) || !/^[a-f0-9]{40}$/.test(head) || !nightClock(now).workerAllowed) throw new Error('invalid role/head or outside worker window');
  await repository(run);
  if(run===gitLeaseCommand)assertEditorialIdentity();
  const metadata = JSON.stringify({ role, head, runId: randomUUID(), startedAt: now.toISOString(), stopAt: 'next 07:00 JST; no automatic stale takeover' });
  const blob = await checked(run, ['hash-object','-w','--stdin'], metadata);
  const tree = await checked(run, ['mktree'], `100644 blob ${blob}\tlease.json\n`);
  const token = await checked(run, ['-c',`user.name=${EDITORIAL_NAME}`,'-c',`user.email=${EDITORIAL_EMAIL}`,'commit-tree',tree], metadata);
  // Empty expected value means create-if-absent, atomically checked by the Git server.
  // This one fixed lease ref is the sole CAS exception; main/article refs cannot be selected.
  await checked(run, ['push','--no-follow-tags','--porcelain',`--force-with-lease=${CLOUD_LEASE_REF}:`,CLOUD_LEASE_REPOSITORY_URL,`${token}:${CLOUD_LEASE_REF}`]);
  return { token, role, head, ref: CLOUD_LEASE_REF };
}
export async function releaseCloudLease(token, run = gitLeaseCommand) {
  if (!/^[a-f0-9]{40}$/.test(token)) throw new Error('full owner token required');
  await repository(run);
  // A stale owner cannot delete a later owner's lease.
  await checked(run, ['push','--no-follow-tags','--porcelain',`--force-with-lease=${CLOUD_LEASE_REF}:${token}`,CLOUD_LEASE_REPOSITORY_URL,`:${CLOUD_LEASE_REF}`]);
}
export async function verifyCloudLease(token, run = gitLeaseCommand) {
  if (!/^[a-f0-9]{40}$/.test(token)) throw new Error('full owner token required');
  await repository(run);
  const value = await checked(run, ['ls-remote',CLOUD_LEASE_REPOSITORY_URL,CLOUD_LEASE_REF]);
  if (value.split(/\s+/)[0] !== token) throw new Error('shared lease ownership lost; stop before dispatch');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [operation, ...arguments_] = process.argv.slice(2);
  const args = Object.fromEntries(arguments_.map(a => { const i=a.indexOf('='); if(i<3)throw new Error('use --key=value');return[a.slice(2,i),a.slice(i+1)]; }));
  if (args.apply !== 'true') throw new Error('shared lock operations require --apply=true after cutover approval');
  if (operation === 'claim') console.log(JSON.stringify(await claimCloudLease({role:args.role,head:args.head})));
  else if(operation === 'release') await releaseCloudLease(args.token);
  else if(operation === 'verify') await verifyCloudLease(args.token);
  else throw new Error('claim/release/verify only');
}
