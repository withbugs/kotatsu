#!/usr/bin/env node
import { parseArgs, parseNow } from './publishing-schedule.mjs';
import { findEarliestRecoverySlot } from './schedule-recovery.mjs';

const args = parseArgs(process.argv.slice(2));
const now = parseNow(args.now);
const occupiedPublishAt = String(args.occupied || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const result = findEarliestRecoverySlot({
  now,
  occupiedPublishAt,
  startDateKey: args.start
});

if (result.errors.length) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}

console.log(`Recovery publishAt: ${result.publishAt}`);
console.log('Protected publication dates remain unchanged.');
