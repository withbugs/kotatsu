import test from 'node:test';import assert from 'node:assert/strict';
import { validateCloudVisualEvidence } from '../../scripts/editorial/cloud-visual-evidence.mjs';
function fixture(){
 const routes=['/home/','/archive/','/old/','/latest/','/kotatsu/articles/candidate/'].map((path,i)=>({path,kind:i===4?'candidate':'published'}));
 const images=routes.flatMap(r=>['chromium-desktop','chromium-mobile'].map(project=>({file:`${project}${r.path.replaceAll('/','-')}.jpg`,project,route:r.path,sha256:'abc',bytes:2000})));
 const manifest={head:'head',tree:'tree',lockHash:'lock',testHashes:'test',browser:{playwright:'1.61.1',revision:'1228',runtime:'149.0.7827.55'},os:'Debian13',fonts:{inventoryHash:'fonts',rendered:['Noto Sans CJK JP']},tests:{expected:12,unexpected:0,flaky:0,skipped:0},routes,viewports:[{},{}],images,candidate:{slug:'candidate',bodyCharacters:300,heroHash:'hero',contentHash:'content'}};
 const target={scope:'article',pr:126,issue:119,slug:'candidate',sourceFile:'src/content/articles/candidate.mdx'};
 manifest.target=target; manifest.candidateTests={expected:2,unexpected:0,skipped:0,flaky:0}; manifest.candidateReport=images.filter(i=>i.route==='/kotatsu/articles/candidate/').map(i=>({project:i.project,status:'passed',expectedStatus:'passed',route:i.route,file:i.file,sha256:i.sha256}));
 const receipt={target,head:'head',result:'passed',reviewer:'visual-editor',reviewedAt:'2026-10-03T00:00:00Z',environmentDifferences:'CI Ubuntu vs cloud Debian; fonts differ',images:images.map(i=>({...i,opened:true,result:'passed'}))};
 return {manifest,receipt,context:{head:'head',tree:'tree',ciTree:'tree',expectedTarget:target}};
}
test('same-head complete review with declared OS/font differences passes',()=>{const f=fixture();assert.deepEqual(validateCloudVisualEvidence(f.manifest,f.receipt,f.context),[])});
test('head updates and CI merge-tree mismatches expire evidence',()=>{const f=fixture();assert.match(validateCloudVisualEvidence(f.manifest,f.receipt,{...f.context,head:'next'}).join('\n'),/head changed/);assert.match(validateCloudVisualEvidence(f.manifest,f.receipt,{...f.context,ciTree:'different'}).join('\n'),/tree differs/)});
test('archive-only evidence, absent hero/body and unreviewed mobile cannot pass',()=>{for(const mutate of [f=>{f.manifest.images.pop();f.receipt.images.pop()},f=>{f.manifest.candidate.heroHash=null},f=>{f.manifest.candidate.bodyCharacters=0},f=>{f.receipt.images[0].opened=false},f=>{f.receipt.images[0].sha256='stale'},f=>{f.manifest.fonts.inventoryHash=null},f=>{f.manifest.browser.runtime='151'},f=>{f.manifest.tests.unexpected=1}]){const f=fixture();mutate(f);assert.ok(validateCloudVisualEvidence(f.manifest,f.receipt,f.context).length)}});
test('source hash changes invalidate a previously accepted receipt',()=>{const f=fixture();f.manifest.sourceHashes={'a':'old'};assert.match(validateCloudVisualEvidence(f.manifest,f.receipt,{...f.context,sourceHashes:{a:'new'}}).join('\n'),/bytes changed/)});

test('unrelated published sample and workflow scope cannot approve an expected article',()=>{
 const f=fixture();assert.match(validateCloudVisualEvidence(f.manifest,f.receipt,{...f.context,expectedTarget:{...f.context.expectedTarget,slug:'different'}}).join('\n'),/expected PR/);
 f.manifest.target.scope='workflow';assert.match(validateCloudVisualEvidence(f.manifest,f.receipt,{...f.context,expectedTarget:{...f.context.expectedTarget,scope:'article'}}).join('\n'),/expected PR/);
});
test('candidate counts, failed statuses and missing report fail closed',()=>{
 for(const mutate of [f=>f.manifest.candidateTests={expected:0,unexpected:2,skipped:0,flaky:0},f=>f.manifest.candidateTests.unexpected=2,f=>f.manifest.candidateReport=[],f=>f.manifest.candidateReport[0].status='failed',f=>f.manifest.candidateReport[0].sha256='wrong']){const f=fixture();mutate(f);assert.ok(validateCloudVisualEvidence(f.manifest,f.receipt,f.context).length)}
});
