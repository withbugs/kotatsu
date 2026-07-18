#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${relativePath}: missing`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function requireText(relativePath, text) {
  if (!read(relativePath).includes(text)) {
    errors.push(`${relativePath}: missing required text ${JSON.stringify(text)}`);
  }
}

function rejectPattern(relativePath, pattern, description) {
  if (pattern.test(read(relativePath))) {
    errors.push(`${relativePath}: contains stale rule ${description}`);
  }
}

requireText('docs/editorial/rule-hierarchy.md', 'docs/editorial/agent-workflow.md');
requireText('docs/editorial/agent-workflow.md', 'draft -> scheduled -> published');
requireText('docs/editorial/agent-workflow.md', '制作担当同士は直接');
requireText('docs/editorial/agent-workflow.md', '未来週のライター修正');
requireText('docs/editorial/agent-workflow.md', '未生成のままreviewへ進めない');
requireText('.github/ISSUE_TEMPLATE/article.yml', 'id: publication_schedule');
requireText('.github/ISSUE_TEMPLATE/volume-plan.yml', 'planning:research');
requireText('.github/ISSUE_TEMPLATE/visual.yml', '画像生成または実画像確認ができなければ完成扱いにしない');

for (const label of ['planning:research', 'planning:shortlist', 'planning:finalize']) {
  requireText('.github/labels.yml', `name: ${label}`);
}

rejectPattern(
  'docs/editorial/ai-editorial-room.md',
  /draft(?:(?!scheduled)[^\n]){0,40}published/i,
  'draft directly to published'
);
rejectPattern(
  'prompts/kotatsu/agent-handoff.md',
  /current monthly issue/i,
  'monthly issue terminology'
);

for (const category of ['style', 'life', 'weekend', 'culture', 'people', 'shopping']) {
  const role = `.agents/kotatsu/${category}-writer.md`;
  requireText(role, '.agents/kotatsu/writer.md');
  const lines = read(role).split(/\r?\n/).length;
  if (lines > 20) errors.push(`${role}: category role card should stay under 20 lines; found ${lines}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Editorial rule consistency check passed.');
