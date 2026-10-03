import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const EDITORIAL_NAME='withbugs';
export const EDITORIAL_EMAIL='28248251+withbugs@users.noreply.github.com';
const identity=`${EDITORIAL_NAME} <${EDITORIAL_EMAIL}>`;
function git(cwd,args,input){const r=spawnSync('git',args,{cwd,input,encoding:'utf8'});if(r.error||r.status!==0)throw new Error('Git identity inspection failed; stop before commit/push');return r.stdout.trim();}
export function assertEditorialIdentity({cwd=process.cwd(),env=process.env,gitHook=false}={}){
 for(const key of ['GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'])if(Object.hasOwn(env,key) && (!gitHook || env[key] !== (key.endsWith('_NAME')?EDITORIAL_NAME:EDITORIAL_EMAIL)))throw new Error('Identity environment override present; stop before commit/push');
 for(const [key,value]of [['user.name',EDITORIAL_NAME],['user.email',EDITORIAL_EMAIL]])if(git(cwd,['config','--local','--get',key])!==value)throw new Error('Approved repo-local identity missing; bootstrap before commit/push');
 for(const key of ['GIT_AUTHOR_IDENT','GIT_COMMITTER_IDENT'])if(!git(cwd,['var',key]).startsWith(identity+' '))throw new Error('Effective author/committer differs; stop before commit/push');
}
export function initializeEditorialIdentity(cwd=process.cwd()){
 for(const key of ['GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'])if(Object.hasOwn(process.env,key))throw new Error('Identity environment override present; stop before bootstrap');
 const url=git(cwd,['remote','get-url','--all','origin']);if(!['https://github.com/withbugs/kotatsu.git','https://github.com/withbugs/kotatsu'].includes(url))throw new Error('Identity bootstrap is repository-locked');
 const hooks=path.join(cwd,'.githooks/kotatsu');
 if(!fs.existsSync(path.join(hooks,'pre-commit'))||!fs.existsSync(path.join(hooks,'pre-push')))throw new Error('Identity hooks missing; stop');
 const old=spawnSync('git',['config','--local','--get','core.hooksPath'],{cwd,encoding:'utf8'});
 if(old.status!==1 && (old.status!==0 || old.stdout.trim()!==hooks))throw new Error('Existing hooksPath differs; do not replace other hooks');
 const legacy=git(cwd,['rev-parse','--git-path','hooks']);
 if(old.status===1 && fs.existsSync(path.resolve(cwd,legacy)))for(const name of ['pre-commit','pre-merge-commit','pre-push'])if(fs.existsSync(path.join(path.resolve(cwd,legacy),name)))throw new Error('Existing identity-sensitive hook; do not overwrite');
 git(cwd,['config','--local','user.name',EDITORIAL_NAME]);git(cwd,['config','--local','user.email',EDITORIAL_EMAIL]);git(cwd,['config','--local','core.hooksPath',hooks]);
 assertEditorialIdentity({cwd});
}
export function assertEditorialCommitRange({cwd=process.cwd(),tip='HEAD',base='origin/main'}={}){
 assertEditorialIdentity({cwd});
 if(!/^(?:HEAD|[a-f0-9]{40})$/.test(tip)||!['origin/main'].includes(base))throw new Error('Only HEAD/full commit with trusted origin/main baseline allowed');
 const commits=git(cwd,['rev-list',`${base}..${tip}`]).split('\n').filter(Boolean);
 for(const sha of commits)for(const field of ['%an <%ae>','%cn <%ce>'])if(git(cwd,['show','-s','--format='+field,sha])!==identity)throw new Error('Outgoing commit identity differs; stop before push (values withheld)');
 return commits.length;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  const [mode='check',tip]=process.argv.slice(2);
  if(mode==='bootstrap')initializeEditorialIdentity();
  else if(mode==='check')assertEditorialIdentity();
  else if(mode==='hook')assertEditorialIdentity({gitHook:true});
  else if(mode==='push')assertEditorialCommitRange({tip:tip||'HEAD'});
  else throw new Error('bootstrap/check/push only');
  console.log('Approved local/effective editorial identity verified.');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
