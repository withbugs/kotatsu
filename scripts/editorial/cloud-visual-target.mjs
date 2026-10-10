export function resolveCloudVisualTarget({ scope, candidate, issueNumber, pr, candidateFile, articleIssueNumber, articleStatus, issue }) {
  if (!['article', 'workflow'].includes(scope) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate || '')) throw new Error('explicit article/workflow scope and candidate required');
  const articleFiles = pr.files.filter(f => /^src\/content\/articles\/[^/]+\.(md|mdx)$/.test(f.path)).map(f => f.path);
  const articleAssets = pr.files.some(f => f.path.startsWith('public/images/articles/'));
  if (scope === 'article') {
    if (articleFiles.length !== 1 || articleFiles[0] !== candidateFile || candidateFile.replace(/^src\/content\/articles\//, '').replace(/\.(md|mdx)$/, '') !== candidate) throw new Error('expected candidate differs from article PR changed source');
    if (!Number.isSafeInteger(issueNumber) || issueNumber < 1 || articleIssueNumber !== issueNumber || issue?.number !== issueNumber || !issue.labels.some(l => (typeof l === 'string' ? l : l.name) === 'type:article')) throw new Error('candidate editorial Issue differs from expected article Issue');
    if (!new RegExp(`(?:#${issueNumber}(?!\\d)|https://github\\.com/withbugs/kotatsu/issues/${issueNumber}(?!\\d))`).test(pr.body || '')) throw new Error('article PR does not reference expected Issue');
  } else {
    if (articleFiles.length || articleAssets || issueNumber !== undefined || articleStatus !== 'published') throw new Error('workflow scope requires an article-free PR and a published sample; it cannot approve an article');
  }
  return { scope, pr: pr.number, issue: scope === 'article' ? issueNumber : null, slug: candidate, sourceFile: candidateFile };
}

export function summarizeCandidateReport(report, slug, images) {
  const tests = [];
  function walk(suites) {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) tests.push(...spec.tests);
      walk(suite.suites);
    }
  }
  walk(report.suites);
  const route = `/kotatsu/articles/${slug}/`;
  if (tests.length !== 2 || report.stats?.expected !== 2 || report.stats?.unexpected !== 0 || report.stats?.skipped !== 0 || report.stats?.flaky !== 0) throw new Error('candidate test report must contain exactly two successful tests');
  const projects = new Set();
  return tests.map(test => {
    if (!['chromium-desktop', 'chromium-mobile'].includes(test.projectName) || projects.has(test.projectName) || test.expectedStatus !== 'passed' || test.results.length !== 1 || test.results[0].status !== 'passed') throw new Error('candidate test status/project/count differs');
    projects.add(test.projectName);
    const attachment = test.results[0].attachments.find(a => a.name === 'cloud-metrics');
    if (!attachment?.body) throw new Error('candidate test metrics missing');
    const metrics = JSON.parse(Buffer.from(attachment.body, 'base64').toString());
    const image = images.find(i => i.project === test.projectName && i.route === route);
    if (metrics.route !== route || metrics.candidate !== true || metrics.bodyCharacters < 100 || metrics.brokenImages !== 0 || !image) throw new Error('candidate report route/body/images differ from expected target');
    return { project: test.projectName, status: 'passed', expectedStatus: 'passed', route, file: image.file, sha256: image.sha256 };
  }).sort((a,b) => a.project.localeCompare(b.project));
}
