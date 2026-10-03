import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NIGHT_SCHEDULE, nightClock } from './night-schedule.mjs';

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
  const url = await checked(run, ['remote', 'get-url', 'origin']);
  if (!['https://github.com/withbugs/kotatsu.git','https://github.com/withbugs/kotatsu'].includes(url)) throw new Error('shared lease is repository-locked to withbugs/kotatsu');
}
export async function claimCloudLease({ role, head, now = new Date() }, run = gitLeaseCommand) {
  if (!Object.hasOwn(NIGHT_SCHEDULE, role) || !/^[a-f0-9]{40}$/.test(head) || !nightClock(now).workerAllowed) throw new Error('invalid role/head or outside worker window');
  await repository(run);
  const metadata = JSON.stringify({ role, head, runId: randomUUID(), startedAt: now.toISOString(), stopAt: 'next 07:00 JST; no automatic stale takeover' });
  const blob = await checked(run, ['hash-object','-w','--stdin'], metadata);
  const tree = await checked(run, ['mktree'], `100644 blob ${blob}\tlease.json\n`);
  const token = await checked(run, ['-c','user.name=KOTATSU lease','-c','user.email=kotatsu-lease@example.invalid','commit-tree',tree], metadata);
  // Empty expected value means create-if-absent, atomically checked by the Git server.
  // This one fixed lease ref is the sole CAS exception; main/article refs cannot be selected.
  await checked(run, ['push','--porcelain',`--force-with-lease=${CLOUD_LEASE_REF}:`,'origin',`${token}:${CLOUD_LEASE_REF}`]);
  return { token, role, head, ref: CLOUD_LEASE_REF };
}
export async function releaseCloudLease(token, run = gitLeaseCommand) {
  if (!/^[a-f0-9]{40}$/.test(token)) throw new Error('full owner token required');
  await repository(run);
  // A stale owner cannot delete a later owner's lease.
  await checked(run, ['push','--porcelain',`--force-with-lease=${CLOUD_LEASE_REF}:${token}`,'origin',`:${CLOUD_LEASE_REF}`]);
}
export async function verifyCloudLease(token, run = gitLeaseCommand) {
  if (!/^[a-f0-9]{40}$/.test(token)) throw new Error('full owner token required');
  await repository(run);
  const value = await checked(run, ['ls-remote','origin',CLOUD_LEASE_REF]);
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
