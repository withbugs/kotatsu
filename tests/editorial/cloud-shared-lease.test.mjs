import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import { spawn, spawnSync } from 'node:child_process';
import { CLOUD_LEASE_REF, CLOUD_LEASE_REPOSITORY_URL, claimCloudLease, releaseCloudLease, verifyCloudLease } from '../../scripts/editorial/kotatsu-cloud-lease.mjs';
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
      if(args[0]==='remote' && args[1]==='get-url')return{status:0,stdout:'https://github.com/withbugs/kotatsu.git\n',stderr:''};
      args=args.map(a=>a===CLOUD_LEASE_REPOSITORY_URL?bare:a);
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

// Real Git reads of effective config; writes are never forwarded in these negative cases.
test('rejects alternate/multiple push destinations and effective URL rewrites before claim or release writes', async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kotatsu-cas-target-'));
 const canonical=CLOUD_LEASE_REPOSITORY_URL;
 const parameters={role:'visual-editor',head:'f'.repeat(40),now:new Date('2026-10-03T22:00:00+09:00')};
 const cases=[
  {name:'alternate pushurl',config:[['remote.origin.pushurl',path.join(temp,'other.git')]]},
  {name:'multiple pushurls including a canonical one',config:[['remote.origin.pushurl',canonical],['remote.origin.pushurl','https://github.com/other/repository.git']]},
  {name:'duplicate canonical pushurls',config:[['remote.origin.pushurl',canonical],['remote.origin.pushurl',canonical]]},
  {name:'insteadOf',config:[['url.'+path.join(temp,'other.git')+'.insteadOf',canonical]]},
  {name:'pushInsteadOf',config:[['url.'+path.join(temp,'other.git')+'.pushInsteadOf',canonical]]},
  {name:'environment override',env:{GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'remote.origin.pushurl',GIT_CONFIG_VALUE_0:path.join(temp,'other.git')}},
  {name:'environment pushInsteadOf',env:{GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'url.'+path.join(temp,'other.git')+'.pushInsteadOf',GIT_CONFIG_VALUE_0:canonical}},
  {name:'environment insteadOf',env:{GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'url.'+path.join(temp,'other.git')+'.insteadOf',GIT_CONFIG_VALUE_0:canonical}},
  {name:'resolved canonical still has rewrite rule',config:[['remote.origin.url','https://alias.invalid/kotatsu'],['url.'+canonical+'.insteadOf','https://alias.invalid/kotatsu']]}
 ];
 try{
  for(const [n,fixture]of cases.entries()){
   const cwd=path.join(temp,String(n));fs.mkdirSync(cwd);
   const baseEnv={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
   const git=args=>{const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',env:baseEnv});assert.equal(r.status,0,r.stderr)};
   git(['init']);git(['remote','add','origin',canonical]);
   for(const [key,value]of fixture.config||[])git(['config','--add',key,value]);
   let writes=0;
   const run=async(args,input)=>{
    if(!['remote','config'].includes(args[0])){writes++;throw new Error('write attempted');}
    const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',input,env:{...baseEnv,...fixture.env}});return{status:r.status,stdout:r.stdout,stderr:r.stderr};
   };
   await assert.rejects(claimCloudLease(parameters,run),/canonical|rewriting/,fixture.name);
   await assert.rejects(releaseCloudLease('f'.repeat(40),run),/canonical|rewriting/,fixture.name);
   await assert.rejects(verifyCloudLease('f'.repeat(40),run),/canonical|rewriting/,fixture.name);
   assert.equal(writes,0,fixture.name);
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
