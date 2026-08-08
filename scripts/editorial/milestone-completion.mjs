export function volumeSlugFromMilestoneTitle(title) {
  const match = String(title || '').match(/^Vol\.\s+(\d{3})\b/);
  return match ? `vol-${match[1]}` : null;
}

export function parsePlanEntries(planContent) {
  return String(planContent || '')
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      return { order: Number(cells[0]), category: cells[1], title: cells[2] };
    })
    .filter((entry) => Number.isInteger(entry.order) && entry.category && entry.title);
}

function labelsOf(issue) {
  return new Set((issue.labels || []).map((label) => typeof label === 'string' ? label : label.name));
}

export function evaluateMilestoneCompletion({ milestone, issues, planContent }) {
  const reasons = [];
  const volumeSlug = volumeSlugFromMilestoneTitle(milestone?.title);
  const planEntries = parsePlanEntries(planContent);
  const normalizedIssues = Array.isArray(issues) ? issues : [];

  if (String(milestone?.state).toLowerCase() !== 'open') reasons.push('milestone is not open');
  if (!volumeSlug) reasons.push('milestone title does not identify Vol. XXX');
  if (!planEntries.length) reasons.push('approved plan has no article entries');
  if (!normalizedIssues.length) reasons.push('milestone has no issues');

  const openIssues = normalizedIssues.filter((issue) => String(issue.state).toLowerCase() !== 'closed');
  if (openIssues.length) reasons.push(`${openIssues.length} issue(s) are still open`);

  const notDone = normalizedIssues.filter((issue) => !labelsOf(issue).has('kotatsu:done'));
  if (notDone.length) reasons.push(`${notDone.length} issue(s) do not have kotatsu:done`);

  const planIssues = normalizedIssues.filter((issue) => labelsOf(issue).has('type:volume-plan'));
  const coverIssues = normalizedIssues.filter((issue) => labelsOf(issue).has('type:volume-cover'));
  const articleIssues = normalizedIssues.filter((issue) => labelsOf(issue).has('type:article'));

  if (planIssues.length !== 1) reasons.push('exactly one completed volume plan issue is required');
  if (coverIssues.length !== 1) reasons.push('exactly one completed formal cover issue is required');
  if (articleIssues.length !== planEntries.length) {
    reasons.push(`article issue count ${articleIssues.length} does not match approved plan count ${planEntries.length}`);
  }

  for (const entry of planEntries) {
    const matchingIssue = articleIssues.find((issue) =>
      String(issue.title).includes(`[${entry.category}]`) && String(issue.title).endsWith(entry.title)
    );
    if (!matchingIssue) reasons.push(`article issue is missing for plan entry: ${entry.category} / ${entry.title}`);
  }

  return {
    eligible: reasons.length === 0,
    volumeSlug,
    planEntries,
    articleIssues,
    reasons
  };
}
