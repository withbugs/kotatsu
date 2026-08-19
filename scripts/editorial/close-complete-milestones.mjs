#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { evaluateMilestoneCompletion, volumeSlugFromMilestoneTitle } from './milestone-completion.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.length ? value.join('=') : true];
}));

function run(command, commandArgs, allowFailure = false) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' });
  if (result.status !== 0 && !allowFailure) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result;
}

function ghJson(commandArgs) {
  return JSON.parse(run('gh', commandArgs).stdout);
}

const repository = 'withbugs/kotatsu';
if (args.repo && args.repo !== repository) {
  throw new Error(`milestone closeout is restricted to ${repository}`);
}
const planRef = String(args['plan-ref'] || 'origin/main');
const apply = args.apply === true || args.apply === 'true';
const milestones = ghJson(['api', `repos/${repository}/milestones?state=open&per_page=100`])
  .filter((milestone) => volumeSlugFromMilestoneTitle(milestone.title));

for (const milestone of milestones) {
  const volumeSlug = volumeSlugFromMilestoneTitle(milestone.title);
  const issues = ghJson([
    'issue', 'list', '--repo', repository, '--milestone', milestone.title,
    '--state', 'all', '--limit', '200', '--json', 'number,title,state,labels'
  ]);
  const planResult = run('git', ['show', `${planRef}:docs/editorial/plans/${volumeSlug}.md`], true);
  const result = evaluateMilestoneCompletion({
    milestone,
    issues,
    planContent: planResult.status === 0 ? planResult.stdout : ''
  });

  if (!result.eligible) {
    console.log(`Skipped ${milestone.title}: ${result.reasons.join('; ')}`);
    continue;
  }

  if (!apply) {
    console.log(`Eligible ${milestone.title}: rerun with --apply to close`);
    continue;
  }

  run('gh', [
    'api', '--method', 'PATCH', `repos/${repository}/milestones/${milestone.number}`,
    '-f', 'state=closed'
  ]);
  console.log(`Closed ${milestone.title}`);
}
