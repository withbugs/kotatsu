import test from 'node:test';import assert from 'node:assert/strict';
import {dueRoleSlots,registerDueSlots,nextDispatch,markDispatchIntent,confirmStarted,confirmCompleted} from '../../scripts/editorial/cloud-dispatch.mjs';
test('22 JST delivers chief then visual with the same original scheduled datetime and no duplicate slot',()=>{
 let ledger=registerDueSlots({slots:[]},'2026-10-03T22:00:00+09:00');assert.equal(registerDueSlots(ledger,'2026-10-03T13:00:00Z').slots.length,2);assert.deepEqual(ledger.slots.map(s=>s.role),['editor-in-chief','visual-editor']);assert.equal(ledger.slots[0].scheduledAt,ledger.slots[1].scheduledAt);
 const now=new Date('2026-10-03T22:01:00+09:00');const next=nextDispatch(ledger,now);assert.equal(next.status,'ready');
 ledger=markDispatchIntent(ledger,next.slot.id,'request-1',now);assert.equal(nextDispatch(ledger,now).status,'hold');assert.throws(()=>markDispatchIntent(ledger,next.slot.id,'request-2',now));
 ledger=confirmStarted(ledger,next.slot.id,'request-1','native-task-1');assert.throws(()=>confirmCompleted(ledger,next.slot.id,{taskId:'native-task-1',terminal:true,workersStopped:true,leaseAbsent:false}));ledger=confirmCompleted(ledger,next.slot.id,{taskId:'native-task-1',terminal:true,workersStopped:true,leaseAbsent:true});assert.equal(ledger.slots.find(s=>s.id===next.slot.id).state,'completed');assert.equal(nextDispatch(ledger,now).slot.role,'visual-editor');
});
test('new slots remain pending behind active or unknown creation; 07 JST checkpoints; month/year keep actual and night date',()=>{
 const chief=dueRoleSlots('2026-12-31T22:00:00+09:00');let ledger={slots:chief};ledger.slots[0].state='unknown';ledger=registerDueSlots(ledger,'2027-01-01T00:00:00+09:00');assert.equal(nextDispatch(ledger,new Date('2027-01-01T00:01:00+09:00')).status,'hold');assert.equal(ledger.slots[2].nightDate,'2026-12-31');assert.equal(ledger.slots[2].scheduledJst,'2027-01-01T00:00:00+09:00');assert.equal(nextDispatch({slots:dueRoleSlots('2027-01-01T06:00:00+09:00')},new Date('2027-01-01T07:00:00+09:00')).status,'checkpoint');
 const roles=new Set([21,22,23,0,1,2,3,4,5,6].flatMap(h=>dueRoleSlots(`2026-10-03T${String(h).padStart(2,'0')}:00:00+09:00`).map(s=>s.role)));assert.equal(roles.size,6);
});
