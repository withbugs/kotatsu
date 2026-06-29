#!/usr/bin/env node
import {
  MONTHLY_PUBLISH_LIMIT,
  WEEKLY_PUBLISH_LIMIT,
  evaluatePublishCandidate,
  loadArticles,
  parseArgs,
  parseNow,
  validatePublishedSchedule
} from './publishing-schedule.mjs';

const args = parseArgs(process.argv.slice(2));
const now = parseNow(args.now || process.env.KOTATSU_NOW);
const articles = loadArticles();

const result = args.candidate
  ? evaluatePublishCandidate(articles, String(args.candidate), { now })
  : validatePublishedSchedule(articles, { now });

for (const warning of result.warnings) {
  console.warn(`Warning: ${warning}`);
}

if (result.errors.length) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}

if (args.candidate) {
  const article = result.candidate;
  console.log(
    `KOTATSU publish gate passed for ${article.slug}: week ${result.targetWeek} ${result.weekPublishedCount + 1}/${WEEKLY_PUBLISH_LIMIT}, month ${result.targetMonth} ${result.monthPublishedCount + 1}/${MONTHLY_PUBLISH_LIMIT}.`
  );
} else {
  console.log(
    `KOTATSU publishing schedule checks passed. Limits: ${WEEKLY_PUBLISH_LIMIT}/week, ${MONTHLY_PUBLISH_LIMIT}/month.`
  );
}
