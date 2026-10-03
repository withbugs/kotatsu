import test from 'node:test';import assert from 'node:assert/strict';
import { overduePlanning } from '../../scripts/editorial/cloud-planning-preflight.mjs';
const plan=(number,title,state='open',labels=['type:volume-plan','planning:research'])=>({number,title,state,labels});
test('month-start and year-start retain unfinished current/prior plans even with volume records',()=>{
 const issues=[plan(1,'Vol.001 2026年12月号'),plan(2,'Vol.002 2027年1月号'),plan(3,'Vol.003 2027年2月号'),plan(4,'Vol.004 2027年1月号','closed',['type:volume-plan','kotatsu:done']),plan(5,'Vol.005 2027年1月号','closed')];
 assert.deepEqual(overduePlanning('2027-01-01',issues),[1,2,5]);
 assert.deepEqual(overduePlanning('2026-12-01',issues),[1]);
 assert.deepEqual(overduePlanning('2027-01-01',[{number:9,title:'Vol.002 2027年1月号',state:'open',labels:[]}]),[]);
 assert.throws(()=>overduePlanning('2027-01-01',[plan(6,'invalid')]));
});
