import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NIGHT_SCHEDULE, nightClock } from './night-schedule.mjs';
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
  const release=acquireCloudGuard('/workspace/.onboarding/kotatsu/cloud-checkout.lock',role);
  const child=spawn(command[0],command.slice(1),{stdio:'inherit'});
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
  child.on('error',e=>{release();console.error(e.message);process.exitCode=1});
  child.on('exit',(code,signal)=>{release();process.exitCode=code ?? (signal ? 1 : 0)});
}
