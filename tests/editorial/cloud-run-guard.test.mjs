import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import { acquireCloudGuard } from '../../scripts/editorial/cloud-run-guard.mjs';
test('overlapping roles cannot lease the shared isolated checkout; completed lease can resume',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kotatsu-guard-'));const lock=path.join(root,'lease');const now=new Date('2026-10-03T22:00:00+09:00');
 try {const release=acquireCloudGuard(lock,'editor-in-chief',now);assert.throws(()=>acquireCloudGuard(lock,'visual-editor',now),/already leased/);release();acquireCloudGuard(lock,'visual-editor',now)();assert.throws(()=>acquireCloudGuard(lock,'publisher',new Date('2026-10-04T07:00:00+09:00')),/outside/);}finally{fs.rmSync(root,{recursive:true,force:true})}
});
