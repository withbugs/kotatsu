#!/usr/bin/env node
import { parseArgs } from './publishing-schedule.mjs';
import { downloadVisualArtifact } from './visual-artifact.mjs';

const args = parseArgs(process.argv.slice(2));
const runId = String(args.runId || args['run-id'] || '');
const repository = String(args.repo || args.repository || '');
const outputDirectory = args.output ? String(args.output) : undefined;
const maxAttempts = Number(args.attempts || 2);

if (!runId || !repository) {
  console.error('Usage: pnpm visual:artifact -- --run-id=<actions-run-id> --repo=owner/name [--output=<directory>]');
  process.exit(1);
}

try {
  console.log(`Downloading ${repository} Visual Check run ${runId}. This may take several minutes; wait for the command to exit.`);
  const result = downloadVisualArtifact({ runId, repository, outputDirectory, maxAttempts });
  console.log(`Visual artifact verified after attempt ${result.attempt}: ${result.directory}`);
  console.log(`Desktop screenshots: ${result.desktop.length}`);
  console.log(`Mobile screenshots: ${result.mobile.length}`);
  for (const screenshot of result.screenshots) console.log(`Screenshot: ${screenshot}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
