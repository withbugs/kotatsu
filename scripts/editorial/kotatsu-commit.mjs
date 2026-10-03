import {spawnSync} from 'node:child_process';
import {assertEditorialIdentity} from './kotatsu-identity.mjs';
const args=process.argv.slice(2);
if(args.length!==2||!['-m','-F'].includes(args[0])||!args[1])throw new Error('Use approved commit -m <message> or -F <message file>; identity overrides are not accepted');
assertEditorialIdentity();
const result=spawnSync('git',['commit',...args],{stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;
