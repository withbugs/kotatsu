import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {NIGHT_SCHEDULE,nightClock} from './night-schedule.mjs';
export function dueRoleSlots(scheduledAt){
 const when=new Date(scheduledAt);if(!Number.isFinite(when.getTime())||!/(?:Z|[+-]\d\d:\d\d)$/.test(scheduledAt))throw new Error('scheduled datetime with timezone required');
 const clock=nightClock(when);if(clock.minute!==0||when.getUTCSeconds()!==0)throw new Error('whole scheduled hour required');
 const roles=Object.keys(NIGHT_SCHEDULE).filter(r=>NIGHT_SCHEDULE[r].includes(clock.hour));
 return roles.map((role,index)=>({id:`${clock.date}T${String(clock.hour).padStart(2,'0')}:00:00+09:00/${role}`,role,scheduledAt:when.toISOString(),scheduledJst:`${clock.date}T${String(clock.hour).padStart(2,'0')}:00:00+09:00`,nightDate:clock.nightDate,state:'pending',predecessor:index?`${clock.date}T${String(clock.hour).padStart(2,'0')}:00:00+09:00/${roles[index-1]}`:null}));
}
export function registerDueSlots(ledger,scheduledAt){const result=structuredClone(ledger);result.slots??=[];for(const slot of dueRoleSlots(scheduledAt))if(!result.slots.some(s=>s.id===slot.id))result.slots.push(slot);return result;}
export function nextDispatch(ledger,now=new Date()){
 const clock=nightClock(now);
 if((ledger.slots||[]).some(s=>['starting','running','unknown'].includes(s.state)))return{status:'hold',reason:'active or uncertain task; reconcile before another start'};
 if(!clock.workerAllowed)return{status:'checkpoint',reason:'outside night window; do not start roles'};
 const slot=(ledger.slots||[]).filter(s=>s.state==='pending' && Date.parse(s.scheduledAt)<=now.getTime()).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id)).find(s=>!s.predecessor || ledger.slots.find(p=>p.id===s.predecessor)?.state==='completed');
 return slot?{status:'ready',slot}:{status:'idle'};
}
export function markDispatchIntent(ledger,id,requestId,now=new Date()){
 const next=nextDispatch(ledger,now);if(next.status!=='ready'||next.slot.id!==id||!requestId)throw new Error('cannot start slot out of order or while active/uncertain');
 const result=structuredClone(ledger);Object.assign(result.slots.find(s=>s.id===id),{state:'starting',requestId});return result;
}
export function confirmStarted(ledger,id,requestId,taskId){const result=structuredClone(ledger);const slot=result.slots.find(s=>s.id===id);if(!slot||slot.state!=='starting'||slot.requestId!==requestId||!taskId)throw new Error('unexpected start response; hold');Object.assign(slot,{state:'running',taskId});return result;}
export function confirmCompleted(ledger,id,{taskId,terminal,workersStopped,leaseAbsent}){const result=structuredClone(ledger);const slot=result.slots.find(s=>s.id===id);if(!slot||slot.state!=='running'||slot.taskId!==taskId||terminal!==true||workersStopped!==true||leaseAbsent!==true)throw new Error('task/worker/lease terminal confirmation required');slot.state='completed';return result;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [mode,file,scheduledAt]=process.argv.slice(2);const ledger=JSON.parse(fs.readFileSync(file));
 if(mode==='register')console.log(JSON.stringify(registerDueSlots(ledger,scheduledAt),null,2));
 else if(mode==='next')console.log(JSON.stringify(nextDispatch(ledger),null,2));
 else throw new Error('register/next <private durable ledger JSON> [scheduled datetime]; persistence is parent responsibility');
}
