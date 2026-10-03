import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function validateCloudVisualEvidence(manifest, receipt, { head, tree, ciTree, directory, sourceHashes, expectedTarget }) {
  const errors=[];
  const requireValue=(condition,message)=>{if(!condition)errors.push(message)};
  for(const key of ['head','tree','lockHash','testHashes','browser','os','fonts','routes','viewports','images','candidate']) requireValue(Boolean(manifest[key]),`missing ${key}`);
  requireValue(manifest.head === head,'PR head changed; regenerate and review all images');
  requireValue(manifest.tree === tree && tree === ciTree,'CI checkout tree differs from rendered head');
  requireValue(manifest.browser?.playwright === '1.61.1' && manifest.browser?.revision === '1228' && manifest.browser?.runtime === '149.0.7827.55','official browser identity differs');
  requireValue(manifest.tests?.expected === 12 && manifest.tests?.unexpected === 0 && manifest.tests?.flaky === 0 && manifest.tests?.skipped === 0,'existing twelve visual tests must pass');
  requireValue(manifest.candidateTests?.expected === 2 && manifest.candidateTests?.unexpected === 0 && manifest.candidateTests?.skipped === 0 && manifest.candidateTests?.flaky === 0, 'candidate two-test success gate missing');
  requireValue(Boolean(expectedTarget) && JSON.stringify(manifest.target) === JSON.stringify(expectedTarget) && JSON.stringify(receipt?.target) === JSON.stringify(expectedTarget) && manifest.candidate?.slug === expectedTarget?.slug, 'expected PR/Issue/candidate scope differs');
  requireValue(manifest.candidate?.bodyCharacters >= 100 && manifest.candidate?.heroHash && manifest.candidate?.contentHash,'candidate body or hero missing');
  requireValue(manifest.fonts?.inventoryHash && manifest.fonts?.rendered?.length,'font inventory or actual rendered fonts missing');
  requireValue(manifest.viewports?.length === 2,'desktop/mobile viewports missing');
  const expectedRoutes=manifest.routes || [];
  requireValue(expectedRoutes.length>=5 && expectedRoutes.some(r=>r.kind==='candidate'),'candidate route missing');
  const images=manifest.images || [];
  const reports = manifest.candidateReport || [];
  requireValue(reports.length === 2 && new Set(reports.map(r=>r.project)).size === 2 && reports.every(r => ['chromium-desktop','chromium-mobile'].includes(r.project) && r.status === 'passed' && r.expectedStatus === 'passed' && r.route === `/kotatsu/articles/${expectedTarget?.slug}/` && images.some(i=>i.project===r.project && i.route===r.route && i.file===r.file && i.sha256===r.sha256)), 'candidate report status/count/route/image mismatch');
  const pairs=new Set(images.map(i=>`${i.project}:${i.route}`));
  requireValue(pairs.size===images.length,'duplicate image route/project');
  for(const route of expectedRoutes) for(const project of ['chromium-desktop','chromium-mobile']) requireValue(pairs.has(`${project}:${route.path}`),`missing image ${project}:${route.path}`);
  requireValue(receipt?.head===head && receipt?.result==='passed' && receipt?.reviewer && receipt?.reviewedAt && receipt?.environmentDifferences,'complete human image review receipt missing');
  const reviews=new Map((receipt?.images || []).map(i=>[i.file,i]));
  requireValue(reviews.size===images.length && receipt?.images?.length===images.length,'review must cover every image exactly once');
  for(const i of images){
    requireValue(i.sha256 && i.bytes>=1024,`invalid image metadata ${i.file}`);
    const reviewed=reviews.get(i.file);requireValue(reviewed?.opened===true && reviewed?.sha256===i.sha256 && reviewed?.result==='passed',`image not opened and accepted: ${i.file}`);
    if(directory){const full=path.resolve(directory,i.file);requireValue(full.startsWith(path.resolve(directory)+path.sep),'image path escapes evidence directory');if(full.startsWith(path.resolve(directory)+path.sep))requireValue(fs.existsSync(full)&&digest(full)===i.sha256,`image hash changed: ${i.file}`);}
  }
  if(sourceHashes) requireValue(JSON.stringify(manifest.sourceHashes)===JSON.stringify(sourceHashes),'source, lockfile or test bytes changed');
  return errors;
}
