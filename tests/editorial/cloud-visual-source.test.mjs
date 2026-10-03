import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectVisualSource, assertCandidateInTree } from '../../scripts/editorial/cloud-visual-source.mjs';

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-source-'));
  const git = (...args) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const write = (file, bytes = 'committed input') => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), bytes);
  };
  try {
    git('init');
    write('.gitignore', 'node_modules/\ndist/\n.astro/\ntest-results/\n.env\nsrc/content/articles/ignored.mdx\n');
    write('src/content/articles/candidate.mdx');
    write('public/images/hero.png');
    write('astro.config.mjs');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture');
    run({ root, git, write, output: path.join(root, 'test-results/evidence') });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('HEAD-bound candidate inputs pass and only generated roots are excluded', () => fixture(({root, write, output}) => {
  for (const file of ['node_modules/cache.txt', 'dist/index.html', '.astro/types.d.ts', 'test-results/evidence/manifest.json']) write(file);
  const source = inspectVisualSource(root, output);
  const candidate = assertCandidateInTree(source, 'src/content/articles/candidate.mdx', 'public/images/hero.png');
  assert.ok(candidate.sourceBlob && candidate.heroBlob);
  assert.equal(Object.keys(source.sourceHashes).length, 4);
}));
test('untracked article, public asset and root config cannot enter same-head evidence', () => {
  for (const file of ['src/content/articles/untracked.mdx', 'public/images/untracked.png', 'astro.config.ts']) fixture(({root, write, output}) => {
    write(file);
    assert.throws(() => inspectVisualSource(root, output), /untracked or ignored input/);
  });
});
test('gitignored content and .env are still live inputs and fail', () => {
  for (const file of ['src/content/articles/ignored.mdx', '.env']) fixture(({root, write, output}) => {
    write(file);
    assert.throws(() => inspectVisualSource(root, output), /untracked or ignored input/);
  });
});
test('source output exclusions and candidate paths outside HEAD are rejected', () => fixture(({root, output}) => {
  assert.throws(() => inspectVisualSource(root, path.join(root, 'src/content/evidence')), /visual output/);
  const source = inspectVisualSource(root, output);
  assert.throws(() => assertCandidateInTree(source, 'src/content/articles/new.mdx', 'public/images/hero.png'), /target HEAD tree/);
  assert.throws(() => assertCandidateInTree(source, 'src/content/articles/candidate.mdx', 'public/images/new.png'), /target HEAD tree/);
  assert.throws(() => assertCandidateInTree(source, 'src/content/articles/candidate.mdx', 'public/../secret'), /target HEAD tree/);
}));
test('assume-unchanged cannot hide source bytes that differ from HEAD', () => fixture(({root, git, write, output}) => {
  git('update-index', '--assume-unchanged', 'src/content/articles/candidate.mdx');
  write('src/content/articles/candidate.mdx', 'uncommitted live input');
  assert.throws(() => inspectVisualSource(root, output), /differs from HEAD blob/);
}));
