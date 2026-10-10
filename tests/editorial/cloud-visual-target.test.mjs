import test from 'node:test';import assert from 'node:assert/strict';
import { resolveCloudVisualTarget, summarizeCandidateReport } from '../../scripts/editorial/cloud-visual-target.mjs';
function article(){return{scope:'article',candidate:'rain',issueNumber:119,pr:{number:126,body:'Closes #119',files:[{path:'src/content/articles/rain.mdx'}]},candidateFile:'src/content/articles/rain.mdx',articleIssueNumber:119,articleStatus:'draft',issue:{number:119,labels:[{name:'type:article'}]}};}
test('article target is bound to changed PR source and its expected editorial Issue',()=>{
 assert.equal(resolveCloudVisualTarget(article()).slug,'rain');
 for(const override of [{candidate:'sample',candidateFile:'src/content/articles/sample.mdx'},{issueNumber:118},{pr:{...article().pr,body:'Closes #118'}},{issue:{number:119,labels:[]}}])assert.throws(()=>resolveCloudVisualTarget({...article(),...override}));
});
test('article-free workflow smoke is explicit and cannot be used for article/assets PR',()=>{
 const input={scope:'workflow',candidate:'sample',candidateFile:'src/content/articles/sample.mdx',articleStatus:'published',pr:{number:127,files:[{path:'README.md'}]}};
 assert.equal(resolveCloudVisualTarget(input).scope,'workflow');assert.throws(()=>resolveCloudVisualTarget({...input,pr:article().pr}));assert.throws(()=>resolveCloudVisualTarget({...input,pr:{number:127,files:[{path:'public/images/articles/rain.png'}]}}));assert.throws(()=>resolveCloudVisualTarget({...input,issueNumber:119}));
});
test('candidate report must have two passed projects and metrics for the expected route',()=>{
 const route='/kotatsu/articles/rain/';const images=['chromium-desktop','chromium-mobile'].map(project=>({project,route,file:project+'.jpg',sha256:project}));
 const stats={expected:2,unexpected:0,skipped:0,flaky:0};
 function report(){return{stats:{...stats},suites:[{specs:[{tests:images.map(i=>({projectName:i.project,expectedStatus:'passed',results:[{status:'passed',attachments:[{name:'cloud-metrics',body:Buffer.from(JSON.stringify({route,candidate:true,bodyCharacters:200,brokenImages:0})).toString('base64')}]}]}))}]}]};}
 assert.equal(summarizeCandidateReport(report(),'rain',images).length,2);
 for(const mutate of [r=>r.stats={expected:0,unexpected:2},r=>r.suites[0].specs[0].tests[0].results[0].status='failed',r=>r.suites[0].specs[0].tests.pop(),r=>r.suites[0].specs[0].tests[0].projectName='chromium-mobile']){const r=report();mutate(r);assert.throws(()=>summarizeCandidateReport(r,'rain',images));}
 assert.throws(()=>summarizeCandidateReport(report(),'sample',images));
});
