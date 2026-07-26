#!/usr/bin/env node
import { validateEditorialIntegrity } from './editorial-integrity.mjs';
import { loadArticles } from './publishing-schedule.mjs';

const errors = loadArticles().flatMap((article) => validateEditorialIntegrity(article));

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('KOTATSU editorial integrity checks passed.');
