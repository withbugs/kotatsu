import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectVisualArtifact } from '../../scripts/editorial/visual-artifact.mjs';

function writeScreenshot(root, project, name) {
  const directory = path.join(root, `layout-${project}`, 'screenshots');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name), Buffer.alloc(2048, 1));
}

test('visual artifact inspection requires desktop and mobile screenshots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-visual-artifact-'));
  try {
    writeScreenshot(root, 'chromium-desktop', 'home.jpg');
    writeScreenshot(root, 'chromium-mobile', 'home.jpg');

    const result = inspectVisualArtifact(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.desktop.length, 1);
    assert.equal(result.mobile.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('visual artifact inspection rejects an incomplete download', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotatsu-visual-artifact-incomplete-'));
  try {
    writeScreenshot(root, 'chromium-desktop', 'home.jpg');

    const result = inspectVisualArtifact(root);
    assert.match(result.errors.join('\n'), /mobile screenshots are missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
