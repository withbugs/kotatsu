#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = 'withbugs/kotatsu';
const stageOrder = ['research', 'shortlist', 'finalize'];
const workflowStates = ['ready', 'planned', 'running', 'review', 'revise', 'publish', 'done'];

function labelsOf(issue) {
  return new Set((issue?.labels || []).map((label) => (
    typeof label === 'string' ? label : label.name
  )));
}

function parseIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`invalid date: ${value}`);
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function monthKey(year, month) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function nextMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return `${year}年${month}月号`;
}

function publicationMonthFromText(value) {
  const match = String(value || '').match(/(\d{4})年(\d{1,2})月号/);
  return match ? monthKey(Number(match[1]), Number(match[2])) : null;
}

function volumeNumberFromText(value) {
  const match = String(value || '').match(/Vol\.\s*(\d{3})/);
  return match ? Number(match[1]) : null;
}

function mondaysInMonth(year, month) {
  const result = [];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= days; day += 1) {
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1) result.push(day);
  }
  return result;
}

export function expectedPlanningStage(today) {
  const { year, month, day } = parseIsoDate(today);
  const mondays = mondaysInMonth(year, month);
  const [second, third, fourth] = mondays.slice(1, 4);
  if (day < second) return null;
  if (day < third) return 'research';
  if (day < fourth) return 'shortlist';
  return 'finalize';
}

function planningStage(issue) {
  if (!issue) return 'missing';
  const labels = labelsOf(issue);
  const stages = stageOrder.filter((stage) => labels.has(`planning:${stage}`));
  if (stages.length > 1) return 'invalid';
  if (String(issue.state).toLowerCase() === 'closed' && labels.has('kotatsu:done')) {
    return 'complete';
  }
  return stages.length === 1 ? stages[0] : 'missing';
}

function planningWorkflowState(issue) {
  if (!issue) return 'missing';
  const labels = labelsOf(issue);
  const states = workflowStates.filter((state) => labels.has(`kotatsu:${state}`));
  return states.length === 1 ? states[0] : states.length ? 'invalid' : 'missing';
}

function stageRank(stage) {
  if (stage === 'complete') return stageOrder.length;
  return stageOrder.indexOf(stage);
}

function allKnownVolumeNumbers(issues, milestones) {
  return [...issues, ...milestones]
    .map((item) => volumeNumberFromText(item.title))
    .filter(Number.isInteger);
}

export function assessMonthlyPlanning({ today, issues = [], milestones = [] }) {
  const { year, month } = parseIsoDate(today);
  const currentMonth = monthKey(year, month);
  const nextPublicationMonth = nextMonth(currentMonth);
  const expectedForNextMonth = expectedPlanningStage(today);
  const hasCurrentVolume = [...issues, ...milestones]
    .some((item) => publicationMonthFromText(item.title) === currentMonth);

  let targetMonth = null;
  let expectedStage = null;
  let reason = 'before-second-monday';

  if (!hasCurrentVolume) {
    targetMonth = currentMonth;
    expectedStage = 'finalize';
    reason = 'current-month-volume-missing';
  } else if (expectedForNextMonth) {
    targetMonth = nextPublicationMonth;
    expectedStage = expectedForNextMonth;
    reason = 'next-month-planning-window';
  }

  if (!targetMonth) {
    return {
      today,
      status: 'not-due',
      recoveryRequired: false,
      reason,
      currentMonth,
      targetMonth: nextPublicationMonth,
      expectedStage: null,
    };
  }

  const targetIssue = issues.find((issue) => publicationMonthFromText(issue.title) === targetMonth);
  const targetMilestone = milestones.find((milestone) => (
    publicationMonthFromText(milestone.title) === targetMonth
  ));
  const actualStage = planningStage(targetIssue);
  const workflowState = planningWorkflowState(targetIssue);
  const otherOpenPlanning = issues.find((issue) => {
    const issueMonth = publicationMonthFromText(issue.title);
    return String(issue.state).toLowerCase() === 'open'
      && issueMonth
      && issueMonth > currentMonth
      && issueMonth !== targetMonth;
  });
  const targetVolumeNumber = volumeNumberFromText(targetIssue?.title)
    ?? volumeNumberFromText(targetMilestone?.title)
    ?? Math.max(0, ...allKnownVolumeNumbers(issues, milestones)) + 1;
  const volume = String(targetVolumeNumber).padStart(3, '0');
  const invalidStage = actualStage === 'invalid';
  const invalidWorkflow = workflowState === 'invalid' || workflowState === 'publish';
  const blocked = !targetIssue && Boolean(otherOpenPlanning);
  const issueClosedWithoutCompletion = Boolean(targetIssue)
    && String(targetIssue.state).toLowerCase() === 'closed'
    && actualStage !== 'complete';
  const workflowNeedsRecovery = Boolean(targetIssue)
    && actualStage !== 'complete'
    && workflowState !== 'planned';
  const recoveryRequired = !blocked && !invalidStage && !invalidWorkflow && (
    !targetIssue
    || !targetMilestone
    || stageRank(actualStage) < stageRank(expectedStage)
    || actualStage === 'finalize'
    || issueClosedWithoutCompletion
    || workflowNeedsRecovery
  );

  let recoveryCause = null;
  if (!targetIssue) recoveryCause = 'planning-issue-missing';
  else if (!targetMilestone) recoveryCause = 'milestone-missing';
  else if (issueClosedWithoutCompletion) recoveryCause = 'issue-closed-without-done';
  else if (stageRank(actualStage) < stageRank(expectedStage)) recoveryCause = 'stage-behind-calendar';
  else if (actualStage === 'finalize') recoveryCause = 'finalize-not-complete';
  else if (workflowNeedsRecovery) recoveryCause = 'stage-work-incomplete';

  return {
    today,
    status: blocked || invalidStage || invalidWorkflow
      ? 'blocked'
      : recoveryRequired ? 'recovery-required' : actualStage === 'complete' ? 'complete' : 'on-track',
    recoveryRequired,
    reason: invalidStage
      ? 'multiple-planning-stage-labels'
      : invalidWorkflow ? 'invalid-planning-workflow-state'
        : blocked ? 'another-open-future-plan' : reason,
    recoveryCause,
    currentMonth,
    targetMonth,
    targetMonthLabel: monthLabel(targetMonth),
    expectedStage,
    actualStage,
    workflowState,
    volume,
    issueNumber: targetIssue?.number ?? null,
    issueUrl: targetIssue?.url ?? null,
    milestoneNumber: targetMilestone?.number ?? null,
    milestoneTitle: targetMilestone?.title ?? `Vol. ${volume} ${monthLabel(targetMonth)}`,
    planningBranch: `planning/vol-${volume}`,
    candidatePath: `docs/editorial/candidates/vol-${volume}.md`,
    planPath: `docs/editorial/plans/vol-${volume}.md`,
    conflictingIssueNumber: otherOpenPlanning?.number ?? null,
  };
}

function jstToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function runGh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'gh failed').trim());
  }
  return result.stdout.trim();
}

function ghJson(args) {
  return JSON.parse(runGh(args));
}

function fetchPlanningState() {
  const milestones = ghJson([
    'api', `repos/${repository}/milestones?state=all&per_page=100`,
  ]);
  const issues = ghJson([
    'issue', 'list', '--repo', repository, '--state', 'all', '--label', 'type:volume-plan',
    '--limit', '200', '--json', 'number,title,state,labels,milestone,url',
  ]);
  return { issues, milestones };
}

function issueBody(status) {
  return `## Planning target

- Volume number: ${status.volume}
- Target publication month: ${status.targetMonthLabel}
- Planning branch: \`${status.planningBranch}\`
- Candidate memo: \`${status.candidatePath}\`
- Approved plan: \`${status.planPath}\`

## Planning recovery

- Detected on: ${status.today} JST
- Calendar stage due: \`planning:${status.expectedStage}\`
- Start stage: \`planning:research\`

Complete each missing stage in order. Every stage keeps its own research record and managing-editor gate, but a late plan does not wait for another Monday before continuing.`;
}

export function planningBootstrapCommands(status, issue = null) {
  if (!status.recoveryRequired) return [];
  if (status.status === 'blocked') throw new Error(`planning recovery is blocked: ${status.reason}`);

  const commands = [];
  const milestoneTitle = status.milestoneTitle;
  if (!status.milestoneNumber) {
    commands.push([
      'api', '--method', 'POST', `repos/${repository}/milestones`,
      '-f', `title=${milestoneTitle}`,
      '-f', `description=${status.targetMonthLabel}のテーマ、記事構成、公開順、AI生成ビジュアル方針の検討`,
    ]);
  }

  if (!status.issueNumber) {
    commands.push([
      'issue', 'create', '--repo', repository,
      '--title', `[Vol. ${status.volume}][PLAN] ${status.targetMonthLabel}テーマ検討`,
      '--body', issueBody(status),
      '--milestone', milestoneTitle,
      '--label', 'type:volume-plan',
      '--label', 'agent:editor-in-chief',
      '--label', 'planning:research',
      '--label', 'kotatsu:ready',
    ]);
    return commands;
  }

  const labels = labelsOf(issue);
  if (String(issue?.state).toLowerCase() === 'closed' && !labels.has('kotatsu:done')) {
    commands.push(['issue', 'reopen', String(status.issueNumber), '--repo', repository]);
  }
  const editArgs = ['issue', 'edit', String(status.issueNumber), '--repo', repository];
  if (!issue?.milestone || issue.milestone.title !== milestoneTitle) {
    editArgs.push('--milestone', milestoneTitle);
  }
  if (!stageOrder.some((stage) => labels.has(`planning:${stage}`))) {
    editArgs.push('--add-label', 'planning:research');
  }
  if (!labels.has('agent:editor-in-chief')) editArgs.push('--add-label', 'agent:editor-in-chief');
  const activeStates = [
    'kotatsu:ready', 'kotatsu:running', 'kotatsu:review', 'kotatsu:revise', 'kotatsu:done',
  ];
  if (labels.has('kotatsu:planned')) {
    editArgs.push('--remove-label', 'kotatsu:planned', '--add-label', 'kotatsu:ready');
  } else if (!activeStates.some((label) => labels.has(label))) {
    editArgs.push('--add-label', 'kotatsu:ready');
  }
  if (editArgs.length > 5) commands.push(editArgs);
  return commands;
}

function ensurePlanningQueue(status) {
  if (!status.recoveryRequired) return;
  const state = status.issueNumber ? fetchPlanningState() : { issues: [] };
  const issue = state.issues.find((item) => item.number === status.issueNumber);
  for (const command of planningBootstrapCommands(status, issue)) runGh(command);
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (arg === '--apply') parsed.apply = true;
    else if (arg.startsWith('--today=')) parsed.today = arg.slice('--today='.length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (parsed.apply && parsed.today) throw new Error('--today cannot be used with --apply');
  return parsed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const today = args.today || jstToday();
    let state = fetchPlanningState();
    let status = assessMonthlyPlanning({ today, ...state });
    if (args.apply && status.recoveryRequired) {
      ensurePlanningQueue(status);
      state = fetchPlanningState();
      status = assessMonthlyPlanning({ today, ...state });
    }
    console.log(JSON.stringify(status, null, 2));
    if (status.status === 'blocked') process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
