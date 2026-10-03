import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import { spawn, spawnSync } from 'node:child_process';
import { CLOUD_LEASE_REF, claimCloudLease, releaseCloudLease, verifyCloudLease } from '../../scripts/editorial/kotatsu-cloud-lease.mjs';
test('two isolated tasks claim one shared bare-repository ref: exactly one succeeds; stale release fails', async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kotatsu-cas-'));
  const bare=path.join(temp,'remote.git');
  function sync(args){const r=spawnSync('git',args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
  try {
    sync(['init','--bare',bare]);
    const commands=[];
    function client(name){const cwd=path.join(temp,name);sync(['clone',bare,cwd]);return async(args,input)=>{
      commands.push(args);
      // Simulate the approved URL check; every actual push goes to this local test fixture.
      if(args.join(' ')==='remote get-url origin')return{status:0,stdout:'https://github.com/withbugs/kotatsu.git\n',stderr:''};
      return await new Promise((resolve,reject)=>{const c=spawn('git',['-C',cwd,...args],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);c.on('error',reject);c.on('close',status=>resolve({status,stdout,stderr}));c.stdin.end(input)});
    };}
    const a=client('a'),b=client('b');const parameters={role:'editor-in-chief',head:'f'.repeat(40),now:new Date('2026-10-03T22:00:00+09:00')};
    const outcomes=await Promise.allSettled([claimCloudLease(parameters,a),claimCloudLease({...parameters,role:'visual-editor'},b)]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(o=>o.status==='rejected').length,1);
    const winner=outcomes.find(o=>o.status==='fulfilled').value;await verifyCloudLease(winner.token,a);
    await assert.rejects(releaseCloudLease('e'.repeat(40),b),/failed/);
    await verifyCloudLease(winner.token,b);await releaseCloudLease(winner.token,a);
    const next=await claimCloudLease(parameters,b);await assert.rejects(releaseCloudLease(winner.token,a),/failed/);await releaseCloudLease(next.token,b);
    for(const args of commands.filter(a=>a[0]==='push'))assert.ok(args.slice(2).every(a=>!a.includes('refs/heads/main')));
    assert.equal(sync(['--git-dir',bare,'for-each-ref','--format=%(refname)']).trim(),'');
    assert.equal(CLOUD_LEASE_REF,'refs/heads/kotatsu/cloud-editorial-lease');
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
