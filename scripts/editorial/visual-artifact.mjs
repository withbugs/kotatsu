import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const VISUAL_ARTIFACT_NAME = 'kotatsu-visual-check';
const IMAGE_PATTERN = /\.(?:jpe?g|png)$/i;

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

export function inspectVisualArtifact(directory) {
  const screenshots = collectFiles(directory).filter((file) => {
    const segments = path.normalize(file).split(path.sep);
    return IMAGE_PATTERN.test(file) && segments.includes('screenshots');
  });
  const desktop = screenshots.filter((file) => /chromium-desktop/i.test(file));
  const mobile = screenshots.filter((file) => /chromium-mobile/i.test(file));
  const empty = screenshots.filter((file) => fs.statSync(file).size < 1024);
  const errors = [];

  if (desktop.length === 0) errors.push('desktop screenshots are missing');
  if (mobile.length === 0) errors.push('mobile screenshots are missing');
  if (empty.length > 0) errors.push(`${empty.length} screenshot file(s) are empty or truncated`);

  return { directory, screenshots, desktop, mobile, empty, errors };
}

function validRunId(value) {
  return /^\d+$/.test(String(value || ''));
}

function validRepository(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value || ''));
}

export function downloadVisualArtifact({
  runId,
  repository,
  outputDirectory,
  maxAttempts = 2,
  timeoutMs = 10 * 60 * 1000,
  run = spawnSync
}) {
  if (!validRunId(runId)) throw new Error('runId must be a numeric GitHub Actions run id');
  if (!validRepository(repository)) throw new Error('repository must use owner/name format');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new Error('maxAttempts must be an integer between 1 and 5');
  }

  const root = outputDirectory
    ? path.resolve(outputDirectory)
    : fs.mkdtempSync(path.join(os.tmpdir(), `kotatsu-visual-${runId}-`));
  fs.mkdirSync(root, { recursive: true });
  const failures = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptDirectory = path.join(root, `attempt-${attempt}`);
    fs.mkdirSync(attemptDirectory, { recursive: true });

    const existing = inspectVisualArtifact(attemptDirectory);
    if (existing.errors.length === 0) return { ...existing, attempt, reused: true };

    const result = run('gh', [
      'run', 'download', String(runId),
      '--repo', repository,
      '--name', VISUAL_ARTIFACT_NAME,
      '--dir', attemptDirectory
    ], {
      stdio: 'inherit',
      timeout: timeoutMs,
      windowsHide: true
    });

    if (result.error) failures.push(`attempt ${attempt}: ${result.error.message}`);
    else if (result.status !== 0) failures.push(`attempt ${attempt}: gh exited with status ${result.status}`);

    const inspection = inspectVisualArtifact(attemptDirectory);
    if (result.status === 0 && inspection.errors.length === 0) {
      return { ...inspection, attempt, reused: false };
    }
    failures.push(`attempt ${attempt}: ${inspection.errors.join('; ')}`);
  }

  throw new Error(`visual artifact download did not complete:\n- ${failures.join('\n- ')}`);
}
