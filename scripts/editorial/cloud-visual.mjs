#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import { createRequire } from 'node:module';import { spawnSync } from 'node:child_process';
import { digest,validateCloudVisualEvidence } from './cloud-visual-evidence.mjs';
import { runKotatsuGhResult } from './kotatsu-github.mjs';
import { runKotatsuGitRemote } from './kotatsu-git-remote.mjs';
const require=createRequire(import.meta.url);const testRequire=createRequire(require.resolve('@playwright/test'));const {chromium,devices}=testRequire('playwright');const matter=require('gray-matter');
const root=process.cwd();
function command(cmd,args,options={}){const r=spawnSync(cmd,args,{encoding:'utf8',...options});if(r.error||r.status!==0)throw new Error(`${cmd} ${args.join(' ')} failed: ${r.error?.message||r.stderr||r.stdout}`);return r.stdout.trim();}
const git=(...args)=>command('git',args);
const args=Object.fromEntries(process.argv.slice(3).map(a=>{if(!/^--[^=]+=.+$/.test(a))throw new Error('use --key=value');const i=a.indexOf('=');return[a.slice(2,i),a.slice(i+1)]}));
const mode=process.argv[2];const dir=path.resolve(args.dir||'test-results/cloud-evidence');
function sourceHashes(){return Object.fromEntries(git('ls-files').split('\n').sort().filter(f=>fs.existsSync(f)).map(f=>[f,digest(f)]));}
function fonts(){const inventory=command('fc-list',[':','file'],{stdio:['ignore','pipe','ignore']}).split('\n').sort();return {inventoryHash: digestBuffer(inventory.map(f=>`${f}:${fs.existsSync(f.replace(/:\s*$/,''))?digest(f.replace(/:\s*$/,'')):'missing'}`).join('\n')),inventory};}
function digestBuffer(s){const c=require('node:crypto');return c.createHash('sha256').update(s).digest('hex')}
function jsonGh(a){const r=runKotatsuGhResult([...a,'--repo','withbugs/kotatsu'],{stdio:'pipe'});if(r.status!==0||r.error)throw new Error(`GitHub read failed: ${r.stderr||r.error}`);return JSON.parse(r.stdout)}
if(git('status','--porcelain','--untracked-files=no'))throw new Error('commit tracked source before generating or verifying head evidence');
if(mode==='generate'){
 if(process.env.PLAYWRIGHT_BROWSERS_PATH!=='/workspace/.onboarding/kotatsu/playwright-browsers')throw new Error('set documented browser cache');
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.candidate||''))throw new Error('candidate slug required');
 const file=['md','mdx'].map(e=>`src/content/articles/${args.candidate}.${e}`).find(f=>fs.existsSync(f));if(!file)throw new Error('candidate source missing');
 const article=matter(fs.readFileSync(file,'utf8'));const hero=path.join('public',String(article.data.heroImage||'').replace(/^\//,''));
 if(article.content.trim().length<100||!article.data.heroImage||!fs.existsSync(hero)||fs.statSync(hero).size<1024)throw new Error('candidate body/hero missing; do not pass on archive-only screenshots');
 fs.mkdirSync(dir,{recursive:false});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kotatsu-visual-'));const config=path.join(temp,'config.ts');
 const configText=(candidate)=>`import {defineConfig} from ${JSON.stringify(path.join(root,'node_modules/@playwright/test'))};import base from ${JSON.stringify(path.join(root,'playwright.config'))};export default defineConfig({...base,testDir:${JSON.stringify(path.join(root,'tests/visual'))},testMatch:${JSON.stringify(candidate?'cloud-candidate.spec.ts':'kotatsu-layout.spec.ts')},outputDir:${JSON.stringify(path.join(dir,candidate?'candidate-results':'layout-results'))},workers:2,reporter:[['json',{outputFile:${JSON.stringify(path.join(dir,candidate?'candidate-tests.json':'tests.json'))}}]],webServer:{...base.webServer,cwd:${JSON.stringify(root)},reuseExistingServer:false,command:${JSON.stringify(candidate?'pnpm dev --port 4321':base.webServer.command)}},use:{...base.use}});`;
 try{
 command('pnpm',['build'],{stdio:'inherit'});
 fs.writeFileSync(config,configText(false));command('pnpm',['exec','playwright','test','--config',config],{stdio:'inherit'});
 fs.writeFileSync(config,configText(true));command('pnpm',['exec','playwright','test','--config',config],{stdio:'inherit',env:{...process.env,KOTATSU_VISUAL_CANDIDATE:args.candidate}});
 const tests=JSON.parse(fs.readFileSync(path.join(dir,'tests.json')));const candidateTests=JSON.parse(fs.readFileSync(path.join(dir,'candidate-tests.json')));
 if(candidateTests.stats.expected!==2||candidateTests.stats.unexpected||candidateTests.stats.skipped||candidateTests.stats.flaky)throw new Error('candidate tests incomplete');
 const images=[];const routes=new Map();
 function readSuites(suites){for(const suite of suites){for(const spec of suite.specs||[])for(const test of spec.tests){for(const result of test.results){for(const a of result.attachments||[]){if(a.name==='cloud-metrics'){const metrics=JSON.parse(Buffer.from(a.body,'base64').toString());routes.set(metrics.route,{path:metrics.route,kind:metrics.candidate?'candidate':'published'});const image=result.attachments.find(i=>i.name.startsWith('screenshot-'));if(!image)throw new Error('metrics without screenshot');const name=`images/${test.projectName}-${images.length+1}.jpg`;fs.mkdirSync(path.join(dir,'images'),{recursive:true});fs.writeFileSync(path.join(dir,name),image.path?fs.readFileSync(image.path):Buffer.from(image.body,'base64'));images.push({file:name,route:metrics.route,project:test.projectName,sha256:digest(path.join(dir,name)),bytes:fs.statSync(path.join(dir,name)).size,metrics});}}}}readSuites(suite.suites||[]);}}
 readSuites(tests.suites);readSuites(candidateTests.suites);
 const browser=await chromium.launch();const runtime=browser.version();await browser.close();
 const rendered=images.flatMap(i=>i.metrics.fonts||[]);
 const manifest={head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),sourceHashes:sourceHashes(),lockHash:digest('pnpm-lock.yaml'),testHashes:sourceHashes()['tests/visual/kotatsu-layout.spec.ts'],browser:{playwright:testRequire('playwright/package.json').version,revision:'1228',runtime},os:fs.readFileSync('/etc/os-release','utf8'),fonts:{...fonts(),rendered},tests:tests.stats,candidateTests:candidateTests.stats,routes:[...routes.values()],viewports:[{project:'chromium-desktop',viewport:{width:1440,height:1100},dpr:1},{project:'chromium-mobile',viewport:devices['Pixel 7'].viewport,dpr:devices['Pixel 7'].deviceScaleFactor}],images,candidate:{slug:args.candidate,status:article.data.status,scope:article.data.status==='published'?'published source rendered locally':'draft dev loopback preview only',bodyCharacters:article.content.trim().length,contentHash:digest(file),heroHash:digest(hero)},generatedAt:new Date().toISOString()};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(dir,'review.json'),JSON.stringify({head:manifest.head,result:'pending',reviewer:'',reviewedAt:'',environmentDifferences:'',images:images.map(i=>({file:i.file,sha256:i.sha256,opened:false,result:'pending'}))},null,2));
 console.log(`Generated ${images.length} images. Open every image and complete ${dir}/review.json; generation alone is not approval.`);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}else if(mode==='verify'){
 for(const k of ['pr','ci-run','visual-run'])if(!/^\d+$/.test(args[k]||''))throw new Error(`numeric ${k} required`);
 const pr=jsonGh(['pr','view',args.pr,'--json','headRefOid,state']);if(pr.state!=='OPEN')throw new Error('PR not open');
 const head=git('rev-parse','HEAD');if(pr.headRefOid!==head)throw new Error('PR/local head differs; evidence expired');
 const runs=[];for(const [key,name]of [['ci-run','CI'],['visual-run','Visual Check']]){const run=jsonGh(['run','view',args[key],'--json','headSha,status,conclusion,workflowName,jobs,event']);if(run.headSha!==head||run.status!=='completed'||run.conclusion!=='success'||run.workflowName!==name||run.event!=='pull_request')throw new Error(`required ${name} run not successful for current head`);runs.push({id:args[key],...run});}
 const job=runs[1].jobs.find(j=>j.name==='visual');if(!job)throw new Error('Visual Check job missing');
 const logs=runKotatsuGhResult(['run','view',args['visual-run'],'--job',String(job.databaseId),'--log','--repo','withbugs/kotatsu'],{stdio:'pipe'});if(logs.status!==0)throw new Error('CI checkout log unavailable');
 const match=logs.stdout.match(/fetch[^\n]*\+([a-f0-9]{40}):refs\/remotes\/pull\/\d+\/merge/);if(!match)throw new Error('actual CI merge checkout SHA missing');
 if(runKotatsuGitRemote(['fetch-ci-merge','origin',match[1]])!==0)throw new Error('CI merge object unavailable');
 const ciTree=git('rev-parse',`${match[1]}^{tree}`);const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));const receipt=JSON.parse(fs.readFileSync(path.join(dir,'review.json')));
 const errors=validateCloudVisualEvidence(manifest,receipt,{head,tree:git('rev-parse','HEAD^{tree}'),ciTree,directory:dir,sourceHashes:sourceHashes()});
 if(manifest.os!==fs.readFileSync('/etc/os-release','utf8')||manifest.fonts.inventoryHash!==fonts().inventoryHash)errors.push('local OS/fonts changed after rendering');
 if(errors.length)throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(dir,'verified.json'),JSON.stringify({head,ciCheckout:match[1],ciTree,runs:runs.map(r=>({id:r.id,name:r.workflowName,conclusion:r.conclusion})),manifestHash:digest(path.join(dir,'manifest.json')),receiptHash:digest(path.join(dir,'review.json')),result:'passed',productionEquivalent:false,verifiedAt:new Date().toISOString()},null,2));console.log('Same-head cloud visual gate passed; recheck PR head immediately before merge.');
}else throw new Error('Usage: cloud-visual.mjs generate --candidate=slug --dir=fresh-dir | verify --dir=dir --pr=id --ci-run=id --visual-run=id');
