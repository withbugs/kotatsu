#!/usr/bin/env bash
set -euo pipefail
cd /workspace/kotatsu
export PATH=/workspace/.onboarding/kotatsu/tools/node_modules/.bin:$PATH
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.onboarding/kotatsu/playwright-browsers
node scripts/editorial/kotatsu-identity.mjs bootstrap
pnpm install --offline --frozen-lockfile --ignore-scripts --store-dir /workspace/.onboarding/pnpm-store
# Official Playwright provisioning only; no mirror, auth change or OS package installation.
node scripts/editorial/provision-browser.mjs
