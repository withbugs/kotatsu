import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {NIGHT_SCHEDULE,nightClock} from './night-schedule.mjs';
import {claimCloudLease,releaseCloudLease,verifyCloudLease,gitLeaseCommand} from './kotatsu-cloud-lease.mjs';
import {assertEditorialIdentity} from './kotatsu-identity.mjs';
const directory='/workspace/.onboarding/kotatsu/cloud-checkout.lock';
export function acquireCloudGuard(directory,role,now=new Date()){
 if(!Object.hasOwn(NIGHT_SCHEDULE,role))throw new Error('unknown cloud role');
 if(!nightClock(now).workerAllowed)throw new Error('outside night worker window; checkpoint without dispatch');
 fs.mkdirSync(path.dirname(directory),{recursive:true});
 try{fs.mkdirSync(directory)}catch(e){if(e.code==='EEXIST')throw new Error('cloud checkout already leased; no duplicate start or automatic lock removal');throw e;}
 fs.writeFileSync(path.join(directory,'owner.json'),JSON.stringify({role,pid:process.pid,startedAt:now.toISOString()}));
 return()=>fs.rmSync(directory,{recursive:true});
}
export async function beginNativeCloudRun(role,{directory:dir=directory,claim=claimCloudLease,identity=assertEditorialIdentity,readHead=()=>gitLeaseCommand(['rev-parse','HEAD']),now=new Date()}={}){
 identity();const releaseLocal=acquireCloudGuard(dir,role,now);
 try{const h=await readHead();if(h.status!==0)throw new Error('HEAD unavailable');const lease=await claim({role,head:h.stdout.trim(),now});fs.writeFileSync(path.join(dir,'owner.json'),JSON.stringify({...lease,startedAt:now.toISOString(),scope:'entire native cloud task and all workers'}));return lease;}
 catch(e){releaseLocal();throw e;}
}
export async function finishNativeCloudRun(token,{directory:dir=directory,verify=verifyCloudLease,release=releaseCloudLease,workersStopped=false}={}){
 if(workersStopped!==true)throw new Error('all workers must be confirmed terminal; retain lease');
 const owner=JSON.parse(fs.readFileSync(path.join(dir,'owner.json')));if(owner.token!==token)throw new Error('local owner differs; retain lease');
 await verify(token);await release(token);fs.rmSync(dir,{recursive:true});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [mode,roleOrToken,...flags]=process.argv.slice(2);
 if(flags.some(f=>!['--apply=true','--workers-stopped=true'].includes(f))||!flags.includes('--apply=true'))throw new Error('explicit --apply=true required; no role subprocess launcher');
 if(mode==='begin')console.log(JSON.stringify(await beginNativeCloudRun(roleOrToken)));
 else if(mode==='finish')await finishNativeCloudRun(roleOrToken,{workersStopped:flags.includes('--workers-stopped=true')});
 else throw new Error('begin <role> --apply=true / finish <owner token> --apply=true --workers-stopped=true');
}
