import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const site = 'https://withbugs.github.io/kotatsu';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const heroPattern = /^\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp|avif|gif)$/i;
const shaPattern = /^[a-f0-9]{64}$/;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function validatePaths({ issue, slug, heroPath }) {
  if (!Number.isSafeInteger(issue) || issue < 1 ||
      typeof slug !== 'string' || !slugPattern.test(slug) ||
      typeof heroPath !== 'string' || !heroPattern.test(heroPath)) {
    throw new Error('Invalid published article identity or hero path');
  }
}

export function buildPagesChecks(articles, openIssues, distRoot) {
  const checks = [];
  const seen = new Set();
  for (const { slug, data } of articles) {
    const issue = data.editorial?.issueNumber;
    if (data.status !== 'published' || !openIssues.has(issue)) continue;
    const heroPath = data.heroImage;
    validatePaths({ issue, slug, heroPath });
    if (seen.has(issue)) throw new Error(`Multiple published articles claim issue #${issue}`);
    seen.add(issue);
    checks.push({
      issue, slug, heroPath,
      htmlHash: hash(readFileSync(path.join(distRoot, 'articles', slug, 'index.html'))),
      heroHash: hash(readFileSync(path.join(distRoot, heroPath.slice(1)))),
    });
  }
  return checks;
}

async function verifyResponse(get, url, type, expectedHash) {
  const response = await get(url, {
    redirect: 'error',
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status !== 200 || !response.headers.get('content-type')?.startsWith(type)) {
    await response.body?.cancel();
    throw new Error(`${url} did not return HTTP 200 with ${type} (HTTP ${response.status})`);
  }
  if (hash(Buffer.from(await response.arrayBuffer())) !== expectedHash) {
    throw new Error(`${url} did not match this build`);
  }
}

export async function verifyPagesArticle(check, { get = fetch, pause = delay } = {}) {
  validatePaths(check);
  if (!shaPattern.test(check.htmlHash) || !shaPattern.test(check.heroHash)) {
    throw new Error('Invalid build hashes');
  }
  const articleUrl = `${site}/articles/${check.slug}/`;
  const heroUrl = `${site}${check.heroPath}`;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const results = await Promise.allSettled([
      verifyResponse(get, articleUrl, 'text/html', check.htmlHash),
      verifyResponse(get, heroUrl, 'image/', check.heroHash),
    ]);
    const failures = results.filter(({ status }) => status === 'rejected');
    if (!failures.length) return { articleUrl, heroUrl, attempt };
    if (attempt === 4) {
      throw new Error(failures.map(({ reason }) => reason.message).join('; '));
    }
    await pause(5000);
  }
}

async function main() {
  if (process.argv[2] === 'prepare') {
    const { loadArticles } = await import('./publishing-schedule.mjs');
    const numbers = readFileSync(0, 'utf8').trim().split(/\s+/).filter(Boolean);
    if (numbers.some((number) => !/^\d+$/.test(number))) throw new Error('Invalid open issue list');
    const checks = buildPagesChecks(loadArticles(), new Set(numbers.map(Number)), 'dist');
    appendFileSync(process.env.GITHUB_OUTPUT, `checks=${JSON.stringify(checks)}\n`);
  } else if (process.argv[2] === 'verify') {
    const result = await verifyPagesArticle(JSON.parse(process.env.PAGES_CHECK));
    console.log(`Verified published HTML and hero from build ${process.env.GITHUB_SHA} (attempt ${result.attempt}).`);
    console.log(result.articleUrl);
    console.log(result.heroUrl);
  } else {
    throw new Error('Expected prepare or verify');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
