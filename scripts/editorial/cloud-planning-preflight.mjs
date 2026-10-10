import { fileURLToPath } from 'node:url';
import { nightClock } from './night-schedule.mjs';
import { runKotatsuGhResult } from './kotatsu-github.mjs';
export function overduePlanning(today, issues) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today))throw new Error('valid date required');
 const month=today.slice(0,7);
 return issues.filter(issue=>{
  const labels=new Set((issue.labels||[]).map(l=>typeof l==='string'?l:l.name));
  if(!labels.has('type:volume-plan'))return false;
  const match=String(issue.title).match(/(\d{4})年(\d{1,2})月号/);
  if(!match)throw new Error(`planning Issue ${issue.number} has no publication month; stop`);
  const target=`${match[1]}-${match[2].padStart(2,'0')}`;
  return target<=month && !(String(issue.state).toLowerCase()==='closed' && labels.has('kotatsu:done'));
 }).map(i=>i.number);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const r=runKotatsuGhResult(['issue','list','--repo','withbugs/kotatsu','--state','all','--label','type:volume-plan','--limit','1000','--json','number,title,state,labels'],{stdio:'pipe'});
 if(r.status!==0||r.error)throw new Error('planning preflight read failed; stop');
 const issues=JSON.parse(r.stdout);if(issues.length>=1000)throw new Error('planning list may be truncated; stop');
 const overdue=overduePlanning(nightClock().date,issues);
 if(overdue.length)throw new Error(`unfinished current/prior-month planning: ${overdue.join(',')}; stop normal article work, route Planning Recovery to source owner`);
 console.log('Cloud planning preflight passed.');
}
