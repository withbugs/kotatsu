import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Only root-level dependency/build/test products are excluded. Source directories,
// configuration and .env files remain inputs even when a gitignore matches them.
const generatedRoots = new Set(['.git', 'node_modules', 'dist', '.astro', 'playwright-report', 'test-results', '.pnpm-store']);
function git(root, args, input) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', input });
  if (result.error || result.status !== 0) throw new Error(`source Git read failed: ${result.error?.message || result.stderr}`);
  return result.stdout;
}
export function assertVisualOutputLocation(root, directory) {
  const relative = path.relative(path.resolve(root), path.resolve(directory));
  const inside = relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  if (inside && !relative.startsWith(`test-results${path.sep}`)) {
    throw new Error('visual output must be outside checkout or within dedicated test-results; never exclude a source directory');
  }
}
export function inspectVisualSource(root, directory) {
  root = path.resolve(root);
  assertVisualOutputLocation(root, directory);
  if (git(root, ['status', '--porcelain', '--untracked-files=no']).trim()) throw new Error('commit tracked source before visual evidence');
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  const tree = git(root, ['rev-parse', 'HEAD^{tree}']).trim();
  const entries = git(root, ['ls-tree', '-r', '-z', 'HEAD']).split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t');
    const [mode, type, blob] = record.slice(0, tab).split(' ');
    return { mode, type, blob, file: record.slice(tab + 1) };
  }).sort((a, b) => a.file.localeCompare(b.file, 'en'));
  const tracked = new Map(entries.map(entry => [entry.file, entry]));
  function walk(directory, relative = '') {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!relative && generatedRoots.has(item.name)) continue;
      const file = relative ? `${relative}/${item.name}` : item.name;
      const full = path.join(root, file);
      if (item.isSymbolicLink()) throw new Error(`source symlink cannot bind live bytes to HEAD: ${file}`);
      if (item.isDirectory()) walk(full, file);
      else if (!tracked.has(file)) throw new Error(`untracked or ignored input outside generated outputs: ${file}`);
      else if (!item.isFile()) throw new Error(`non-regular source input: ${file}`);
    }
  }
  walk(root);
  const sourceHashes = {};
  const blobs = {};
  for (const entry of entries) {
    const full = path.join(root, entry.file);
    if (!['100644', '100755'].includes(entry.mode) || entry.type !== 'blob' || !fs.existsSync(full) || !fs.lstatSync(full).isFile()) {
      throw new Error(`HEAD input must exist as a regular file: ${entry.file}`);
    }
    const bytes = fs.readFileSync(full);
    if (git(root, ['hash-object', '--stdin'], bytes).trim() !== entry.blob) throw new Error(`live input differs from HEAD blob: ${entry.file}`);
    sourceHashes[entry.file] = crypto.createHash('sha256').update(bytes).digest('hex');
    blobs[entry.file] = entry.blob;
  }
  return { head, tree, sourceHashes, blobs };
}
export function assertCandidateInTree(snapshot, sourceFile, heroFile) {
  for (const [file, prefix] of [[sourceFile, 'src/content/articles/'], [heroFile, 'public/']]) {
    if (typeof file !== 'string' || file.includes('..') || !file.startsWith(prefix) || !snapshot.blobs[file] || !snapshot.sourceHashes[file]) {
      throw new Error(`candidate source/hero must belong to target HEAD tree: ${file}`);
    }
  }
  return { sourceFile, heroFile, sourceBlob: snapshot.blobs[sourceFile], heroBlob: snapshot.blobs[heroFile] };
}
