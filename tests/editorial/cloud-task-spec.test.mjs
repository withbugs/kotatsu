import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {cloudTaskSpec} from '../../scripts/editorial/cloud-task-spec.mjs';
test('all six native task envelopes retain complete exact role prompt and original model/effort',()=>{
 const settings=JSON.parse(fs.readFileSync('docs/editorial/cloud-schedules.json'));
 for(const r of settings.roles){const at=`2026-12-31T${String(r.hours[0]).padStart(2,'0')}:00:00+09:00`;const spec=cloudTaskSpec(r.role,at);const full=fs.readFileSync(r.prompt,'utf8');assert.ok(spec.prompt.includes(full));assert.equal(spec.fullRolePromptSha256,crypto.createHash('sha256').update(full).digest('hex'));assert.equal(spec.model,r.model);assert.equal(spec.reasoningEffort,'high');assert.ok(spec.prompt.indexOf('begin ')<spec.prompt.indexOf(full));assert.ok(spec.prompt.lastIndexOf(' finish ')>spec.prompt.indexOf(full));}
 assert.throws(()=>cloudTaskSpec('visual-editor','2026-10-03T21:00:00+09:00'));
});
