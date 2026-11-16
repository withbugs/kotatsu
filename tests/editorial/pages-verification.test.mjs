import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPagesChecks, verifyPagesArticle } from '../../scripts/editorial/pages-verification.mjs';

const html = '<h1>Published heading</h1><article>Published body</article>';
const hero = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const article = {
  slug: 'read-a-local-notice',
  data: {
    status: 'published',
    editorial: { issueNumber: 139 },
    heroImage: '/images/articles/notice-hero.png',
  },
};

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'kotatsu-pages-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'articles', article.slug), { recursive: true });
  mkdirSync(path.join(root, 'images', 'articles'), { recursive: true });
  writeFileSync(path.join(root, 'articles', article.slug, 'index.html'), html);
  writeFileSync(path.join(root, 'images', 'articles', 'notice-hero.png'), hero);
  return root;
}

function liveResponse(url) {
  return url.endsWith('.png')
    ? new Response(hero, { headers: { 'content-type': 'image/png' } })
    : new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

test('prepare includes an already published article with an open issue, not closed or unpublished work', (t) => {
  const dist = fixture(t);
  const draft = { slug: 'draft-article', data: { status: 'draft', editorial: { issueNumber: 140 } } };
  const checks = buildPagesChecks([article, draft], new Set([139, 140]), dist);
  assert.deepEqual(checks.map(({ issue, slug }) => ({ issue, slug })), [{ issue: 139, slug: article.slug }]);
  assert.deepEqual(buildPagesChecks([article], new Set(), dist), []);
  assert.throws(() => buildPagesChecks([article, article], new Set([139]), dist), /Multiple published articles/);
});

test('verification retries a temporary 404 and requires both exact responses from the fixed site', async (t) => {
  const [check] = buildPagesChecks([article], new Set([139]), fixture(t));
  let requests = 0;
  let waits = 0;
  const result = await verifyPagesArticle(check, {
    get: async (url, options) => {
      assert.ok(url.startsWith('https://withbugs.github.io/kotatsu/'));
      assert.equal(options.redirect, 'error');
      requests += 1;
      return requests === 1 ? new Response('Not deployed yet', { status: 404 }) : liveResponse(url);
    },
    pause: async () => { waits += 1; },
  });
  assert.equal(result.attempt, 2);
  assert.equal(requests, 4);
  assert.equal(waits, 1);
});

test('a stale body or wrong image cannot pass despite HTTP 200; retries are bounded', async (t) => {
  const [check] = buildPagesChecks([article], new Set([139]), fixture(t));
  for (const imageMismatch of [false, true]) {
    let waits = 0;
    await assert.rejects(verifyPagesArticle(check, {
      get: async (url) => url.endsWith('.png') === imageMismatch
        ? new Response('Old or wrong content', {
          headers: { 'content-type': imageMismatch ? 'image/png' : 'text/html' },
        })
        : liveResponse(url),
      pause: async () => { waits += 1; },
    }), /did not match this build/);
    assert.equal(waits, 3);
  }
});

test('unsafe paths are rejected before any network call', async () => {
  await assert.rejects(verifyPagesArticle({
    issue: 139, slug: 'read-a-local-notice', heroPath: '/images/../index.html',
  }, { get: () => assert.fail('Unexpected network request') }), /Invalid published article/);
});
