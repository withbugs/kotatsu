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
requireText('docs/editorial/rule-hierarchy.md', 'docs/editorial/recovery-workflow.md');
requireText('docs/editorial/agent-workflow.md', 'draft -> scheduled -> published');
requireText('docs/editorial/agent-workflow.md', '制作担当同士は直接');
requireText('docs/editorial/agent-workflow.md', '未来週のライター修正');
requireText('docs/editorial/agent-workflow.md', '未生成のままreviewへ進めない');
requireText('docs/editorial/agent-workflow.md', 'editorial.integrityReview.status: passed');
requireText('.agents/kotatsu/editor-in-chief.md', '持ち込まない季節・生活イベント');
requireText('.agents/kotatsu/managing-editor.md', 'crossVolumeReview.managingEditorApproval');
requireText('.agents/kotatsu/managing-editor.md', 'node scripts/editorial/close-complete-milestones.mjs --apply');
requireText('.agents/kotatsu/copy-editor.md', 'editorial.integrityReview');
requireText('.agents/kotatsu/copy-editor.md', 'managingEditorApproval');
requireText('docs/editorial/agent-workflow.md', 'crossVolumeReview.managingEditorApproval');
requireText('docs/editorial/agent-workflow.md', '## Volume Closeout');
requireText('docs/editorial/agent-workflow.md', 'node scripts/editorial/close-complete-milestones.mjs --apply');
requireText('docs/editorial/agent-workflow.md', '## Recovery');
requireText('docs/editorial/agent-workflow.md', 'pnpm article:rebook');
requireText('docs/editorial/agent-workflow.md', 'pnpm article:handoff');
requireText('docs/editorial/agent-workflow.md', '17:00');
requireText('docs/editorial/agent-workflow.md', '技術的失敗');
requireText('docs/editorial/recovery-workflow.md', '## Recovery Classes');
requireText('docs/editorial/recovery-workflow.md', 'pnpm recovery:slot');
requireText('docs/editorial/recovery-workflow.md', 'pnpm article:recover-publication');
requireText('docs/editorial/recovery-workflow.md', 'protected');
requireText('docs/editorial/recovery-workflow.md', '連鎖的に動かさない');
requireText('docs/editorial/recovery-workflow.md', '読者向け本文');
requireText('docs/editorial/recovery-workflow.md', 'frontmatter全体を再シリアライズせず');
requireText('.agents/kotatsu/publisher.md', 'milestone自体は閉じない');
requireText('.agents/kotatsu/publisher.md', '13:00と17:00のどちらも同じ公開枠');
requireText('.agents/kotatsu/publisher.md', 'pnpm visual:artifact');
requireText('.agents/kotatsu/publisher.md', 'pnpm article:recover-publication');
requireText('.agents/kotatsu/publisher.md', 'Issue labelだけで対象を絞り込まない');
requireText('.agents/kotatsu/visual-editor.md', '10:00と18:00のどちらも同じ制作枠');
requireText('.agents/kotatsu/visual-editor.md', '2時間を超えて有意な進捗がない');
requireText('.agents/kotatsu/copy-editor.md', '11:00と15:00のどちらも同じ校正枠');
requireText('.agents/kotatsu/managing-editor.md', '9:00、12:00、16:00');
requireText('.agents/kotatsu/managing-editor.md', 'pnpm article:handoff');
requireText('.agents/kotatsu/managing-editor.md', '対象branchへのdetached switch');
requireText('.agents/kotatsu/writer.md', 'detached switch');
requireText('docs/editorial/github-access-policy.md', 'git status --porcelain');
requireText('docs/editorial/github-access-policy.md', 'git switch --detach');
requireText('docs/editorial/github-access-policy.md', 'rebaseを使用しない');
requireText('docs/editorial/github-access-policy.md', 'kotatsu-github.mjs');
requireText('docs/editorial/github-access-policy.md', 'kotatsu-git-remote.mjs');
requireText('docs/editorial/github-access-policy.md', 'sandbox_permissions: "require_escalated"');
requireText('docs/editorial/github-access-policy.md', 'pnpm install --offline --frozen-lockfile --ignore-scripts');
requireText('.codex/rules/kotatsu-scheduled-network.rules', 'scripts/editorial/kotatsu-github.mjs');
requireText('.codex/rules/kotatsu-scheduled-network.rules', 'scripts/editorial/kotatsu-git-remote.mjs');
requireText('.codex/rules/kotatsu-scheduled-network.rules', 'scripts/editorial/close-complete-milestones.mjs');
requireText('.codex/rules/kotatsu-scheduled-network.rules', 'pnpm", "install", "--offline", "--frozen-lockfile", "--ignore-scripts');
requireText('tests/editorial/scheduled-network-brokers.test.mjs', 'rejects main pushes');
requireText('.agents/kotatsu/copy-editor.md', '過去日を記録して通過させない');
requireText('.agents/kotatsu/publisher.md', '古い日付のまま公開しない');
requireText('package.json', '"milestone:close"');
requireText('package.json', '"article:rebook"');
requireText('package.json', '"article:recover-publication"');
requireText('package.json', '"recovery:slot"');
requireText('package.json', '"article:handoff"');
requireText('package.json', '"visual:artifact"');
requireText('.github/ISSUE_TEMPLATE/article.yml', 'id: publication_schedule');
requireText('.github/ISSUE_TEMPLATE/article.yml', 'id: brief_target_volume');
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
rejectPattern(
  'docs/editorial/agent-workflow.md',
  /(?:20:00|21:00|22:00)/,
  'late recovery window'
);
rejectPattern(
  'docs/editorial/agent-workflow.md',
  /article:rebook[^\n]*resume-unmerged-publication/,
  'delivery recovery mixed into editorial rebooking'
);
requireText('.agents/kotatsu/writer-desk.md', '1回の起動で複数記事');
rejectPattern(
  'README.md',
  /(?:20:00|21:00|22:00)/,
  'late recovery window'
);
rejectPattern(
  '.codex/rules/kotatsu-scheduled-network.rules',
  /pattern\s*=\s*\["(?:gh|git)"/,
  'direct network command permission'
);
for (const role of ['managing-editor', 'publisher', 'visual-editor', 'copy-editor']) {
  rejectPattern(
    `.agents/kotatsu/${role}.md`,
    /(?:20:00|21:00|22:00)/,
    'late recovery window'
  );
}

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
