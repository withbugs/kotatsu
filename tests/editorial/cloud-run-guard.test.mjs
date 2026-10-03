import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import { acquireCloudGuard } from '../../scripts/editorial/cloud-run-guard.mjs';
test('overlapping roles cannot lease the shared isolated checkout; completed lease can resume',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kotatsu-guard-'));const lock=path.join(root,'lease');const now=new Date('2026-10-03T22:00:00+09:00');
 try {const release=acquireCloudGuard(lock,'editor-in-chief',now);assert.throws(()=>acquireCloudGuard(lock,'visual-editor',now),/already leased/);release();acquireCloudGuard(lock,'visual-editor',now)();assert.throws(()=>acquireCloudGuard(lock,'publisher',new Date('2026-10-04T07:00:00+09:00')),/outside/);}finally{fs.rmSync(root,{recursive:true,force:true})}
});

import { beginNativeCloudRun, finishNativeCloudRun } from '../../scripts/editorial/cloud-run-guard.mjs';
test('native task lease survives begin process and every worker; uncertain finish retains ownership',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kotatsu-native-'));const directory=path.join(root,'lease');const token='a'.repeat(40);let calls=[];
 try{
  const lease=await beginNativeCloudRun('visual-editor',{directory,identity:()=>calls.push('identity'),readHead:async()=>({status:0,stdout:'f'.repeat(40)}),claim:async()=>({token,role:'visual-editor',head:'f'.repeat(40)}),now:new Date('2026-10-03T22:00:00+09:00')});assert.equal(lease.token,token);assert.ok(fs.existsSync(directory));
  await assert.rejects(finishNativeCloudRun(token,{directory,workersStopped:false}),/terminal/);assert.ok(fs.existsSync(directory));
  await assert.rejects(finishNativeCloudRun('b'.repeat(40),{directory,workersStopped:true}),/owner/);
  await assert.rejects(finishNativeCloudRun(token,{directory,workersStopped:true,verify:async()=>{throw new Error('unavailable')}}),/unavailable/);assert.ok(fs.existsSync(directory));
  await finishNativeCloudRun(token,{directory,workersStopped:true,verify:async()=>calls.push('verify'),release:async()=>calls.push('release')});assert.ok(!fs.existsSync(directory));assert.deepEqual(calls,['identity','verify','release']);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
