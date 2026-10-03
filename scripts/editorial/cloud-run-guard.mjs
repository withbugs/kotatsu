import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NIGHT_SCHEDULE, nightClock } from './night-schedule.mjs';
import { claimCloudLease, releaseCloudLease, gitLeaseCommand } from './kotatsu-cloud-lease.mjs';
export function acquireCloudGuard(directory, role, now = new Date()) {
  if (!Object.hasOwn(NIGHT_SCHEDULE, role)) throw new Error('unknown cloud role');
  if (!nightClock(now).workerAllowed) throw new Error('outside night worker window; checkpoint without dispatch');
  fs.mkdirSync(path.dirname(directory),{recursive:true});
  try { fs.mkdirSync(directory); } catch (e) { if(e.code==='EEXIST') throw new Error('cloud checkout already leased; no duplicate start or automatic lock removal'); throw e; }
  fs.writeFileSync(path.join(directory,'owner.json'),JSON.stringify({role,pid:process.pid,startedAt:now.toISOString()}));
  return () => fs.rmSync(directory,{recursive:true});
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [role, separator, ...command] = process.argv.slice(2);
  if (separator !== '--' || !command.length) throw new Error('Usage: node scripts/editorial/cloud-run-guard.mjs <role> -- <approved role launcher>');
  if (process.env.KOTATSU_SHARED_LEASE_ENABLED !== '1') throw new Error('shared lease is not enabled; review-only, do not run a role');
  const release=acquireCloudGuard('/workspace/.onboarding/kotatsu/cloud-checkout.lock',role);
  let lease;
  try {
    const head = await gitLeaseCommand(['rev-parse','HEAD']);
    if(head.status!==0)throw new Error('cannot read cloud checkout HEAD');
    lease=await claimCloudLease({role,head:head.stdout.trim()});
  } catch(error) { release(); throw error; }
  const child=spawn(command[0],command.slice(1),{stdio:'inherit',env:{...process.env,KOTATSU_CLOUD_LEASE_TOKEN:lease.token}});
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
  child.on('error',async e=>{release();await releaseCloudLease(lease.token).catch(e=>console.error(e.message));console.error(e.message);process.exitCode=1});
  child.on('exit',async(code,signal)=>{
    release();
    // Uncertain termination retains the shared lease; never let a second task race surviving work.
    if(code===0 && !signal) await releaseCloudLease(lease.token).catch(e=>{console.error(e.message);process.exitCode=1});
    else console.error(`Shared lease retained after failure/interruption: ${lease.token}; confirm all workers stopped before owner-only release`);
    process.exitCode=process.exitCode || code || (signal ? 1 : 0);
  });
}
